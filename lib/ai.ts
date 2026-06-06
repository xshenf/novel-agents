import { searchMemory } from './memory';
import { db } from './db';
import { formatAntiAiInstructions } from './rules';

export interface AIChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface AISummaryResult {
  summary: string;
  characterChanges: Array<{ character: string; change: string }>;
  newForeshadowing: string[];
  resolvedForeshadowing: string[];
  timelineEvents: string[];
}

export interface AICheckResult {
  passed: boolean;
  issues: string[];
  suggestions: string[];
}

/**
 * 并发控制器：限制同时执行的 Promise 数量
 * @param tasks 任务函数数组
 * @param concurrency 最大并发数
 * @param onProgress 每完成一个任务时的回调 (completed, total)
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  onProgress?: (result: T, completed: number, total: number) => void
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;
  let completedCount = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const idx = nextIndex++;
      let result: T;
      try {
        result = await tasks[idx]();
      } catch (err) {
        result = err as any;
      }
      results[idx] = result;
      completedCount++;
      if (onProgress) onProgress(result, completedCount, tasks.length);
    }
  }

  const workerCount = Math.min(concurrency, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}



// 清洗并安全解析 LLM 返回的 JSON 字符串。
// LLM 经常返回带 markdown 代码块标记、尾部注释或其它非法 JSON，直接 JSON.parse 会崩溃。
function safeParseJSON<T = any>(raw: string, fallback?: T): T {
  // 1. 先直接尝试
  try {
    return JSON.parse(raw);
  } catch { /* continue */ }

  // 2. 剥离 markdown 代码块标记（```json ... ```）
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  try {
    return JSON.parse(cleaned);
  } catch { /* continue */ }

  // 3. 尝试提取第一个完整的 JSON 对象或数组
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch { /* continue */ }
  }
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      return JSON.parse(arrMatch[0]);
    } catch { /* continue */ }
  }

  // 4. 全部失败：抛出或返回 fallback
  if (fallback !== undefined) return fallback;
  throw new Error(`Failed to parse JSON from LLM response: ${raw.slice(0, 200)}...`);
}

// 判断调用方是否提供了「可用」的 API Key（兼容原始字符串与打包后的 JSON 配置）。
// 仅当返回 false（未配置 Key）时才使用本地 mock；配置了 Key 时一律走真实接口，
// 真实接口的错误会向上抛出而不再被静默吞掉伪装成 mock 结果。
function hasUsableKey(apiKey?: string): boolean {
  if (!apiKey || !apiKey.trim()) return false;
  const t = apiKey.trim();
  if (t.startsWith('{') && t.endsWith('}')) {
    try {
      const o = JSON.parse(t);
      return !!(o.apiKey && String(o.apiKey).trim());
    } catch {
      return false;
    }
  }
  return true;
}

// 辅助方法：直接调用大语言模型 API（支持 Gemini 及多种 OpenAI 兼容服务商）
async function callModelApi(apiKey: string, modelName: string, systemInstruction: string, prompt: string, isJson: boolean = false): Promise<string> {
  // 默认配置
  let config = {
    apiKey: apiKey,
    apiProvider: 'gemini',
    apiBaseUrl: '',
    temperature: 0.7,
    maxTokens: 3000,
    systemInstruction: '',
    reasoningEnabled: false
  };

  // 尝试解析 JSON 包装的全面配置
  if (apiKey && apiKey.trim().startsWith('{') && apiKey.trim().endsWith('}')) {
    try {
      const parsed = JSON.parse(apiKey);
      config = { ...config, ...parsed };
    } catch (e) {
      // 解析失败则视其为普通的单个 apiKey
    }
  }

  const temp = config.temperature ?? 0.7;
  const tokens = config.maxTokens ?? 3000;
  
  // 合并系统提示词
  const finalSystemInstruction = [config.systemInstruction, systemInstruction]
    .map(s => s ? s.trim() : '')
    .filter(Boolean)
    .join('\n');

  // 1. 如果是 Gemini 服务商协议
  if (config.apiProvider === 'gemini') {
    const model = modelName || 'gemini-2.5-flash';
    const rawBaseUrl = config.apiBaseUrl ? config.apiBaseUrl.trim() : 'https://generativelanguage.googleapis.com';
    const baseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;
    const url = `${baseUrl}/v1beta/models/${model}:generateContent`;

    const body: any = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: temp,
        maxOutputTokens: tokens
      }
    };

    if (config.reasoningEnabled) {
      body.thinkingConfig = {
        thinkingBudget: 2048
      };
    }

    if (finalSystemInstruction) {
      body.systemInstruction = {
        parts: [{ text: finalSystemInstruction }]
      };
    }

    if (isJson) {
      body.generationConfig.responseMimeType = 'application/json';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errText}`);
    }

    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Empty response from Gemini API');
    }
    return text;
  }

  // 2. 如果是 OpenAI 或其他兼容的 API 协议（OpenAI, DeepSeek, Claude 中转, Custom 等）
  else {
    let rawBaseUrl = 'https://api.openai.com/v1';
    if (config.apiProvider === 'deepseek') {
      rawBaseUrl = 'https://api.deepseek.com/v1';
    } else if (config.apiBaseUrl) {
      rawBaseUrl = config.apiBaseUrl.trim();
    }
    const baseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;
    const url = `${baseUrl}/chat/completions`;

    // 确定模型名称
    let model = modelName;
    if (!model) {
      if (config.apiProvider === 'deepseek') {
        model = 'deepseek-chat';
      } else if (config.apiProvider === 'openai') {
        model = 'gpt-4o-mini';
      } else {
        model = 'gpt-4o-mini'; // 兜底
      }
    }

    const messages: any[] = [];
    if (finalSystemInstruction) {
      messages.push({
        role: 'system',
        content: finalSystemInstruction
      });
    }
    messages.push({
      role: 'user',
      content: prompt
    });

    const body: any = {
      model: model,
      messages: messages,
      temperature: temp,
      max_tokens: tokens
    };

    if (isJson) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`${config.apiProvider} API error (${response.status}): ${errText}`);
    }

    const result = await response.json();
    const text = result?.choices?.[0]?.message?.content;
    if (text === undefined || text === null) {
      throw new Error(`Empty response from ${config.apiProvider} API`);
    }
    return text;
  }
}

// ================= AI 统一对外服务接口 =================
export const ai = {
  /**
   * 动态获取当前服务商的可用模型列表
   */
  async fetchModels(apiKey: string, apiProvider: string, apiBaseUrl?: string): Promise<string[]> {
    if (!apiKey) {
      throw new Error('获取模型列表需要提供 API Key');
    }

    try {
      if (apiProvider === 'gemini') {
        const rawBaseUrl = apiBaseUrl ? apiBaseUrl.trim() : 'https://generativelanguage.googleapis.com';
        const baseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;
        const url = `${baseUrl}/v1beta/models`;

        const res = await fetch(url, { headers: { 'x-goog-api-key': apiKey } });
        if (!res.ok) {
          throw new Error(`Gemini API returned status ${res.status}`);
        }
        const data = await res.json();
        if (data.models && Array.isArray(data.models)) {
          // 提取模型名并过滤简化，去掉 models/ 前缀
          return data.models.map((m: any) => {
            const name = m.name || '';
            return name.startsWith('models/') ? name.substring(7) : name;
          });
        }
        return [];
      } else {
        // OpenAI 兼容接口
        let rawBaseUrl = 'https://api.openai.com/v1';
        if (apiProvider === 'deepseek') {
          rawBaseUrl = 'https://api.deepseek.com/v1';
        } else if (apiBaseUrl) {
          rawBaseUrl = apiBaseUrl.trim();
        }
        const baseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;
        const url = `${baseUrl}/models`;

        const res = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });
        if (!res.ok) {
          throw new Error(`${apiProvider} API returned status ${res.status}`);
        }
        const data = await res.json();
        if (data.data && Array.isArray(data.data)) {
          return data.data.map((m: any) => m.id || '').filter(Boolean);
        }
        return [];
      }
    } catch (error: any) {
      console.error('Fetch models error:', error);
      throw new Error(`获取模型列表失败: ${error.message || '未知错误'}`);
    }
  },
  /**
   * AI 推演网络小说核心设定 (10 大维度，各 3 套备选推荐)
   * 按维度并发调用，concurrency 控制同时请求数
   * onProgress 回调在每完成一个维度时触发，参数为 (dimKey, dimLabel, index, total, dimOptions)
   */
  async generateKernelSettings(
    projectTitle: string, genre: string, tone: string,
    apiKey?: string, modelName?: string,
    onProgress?: (dimKey: string, dimLabel: string, index: number, total: number, dimOptions?: Array<{ name: string; description: string }>) => void,
    concurrency: number = 3
  ): Promise<any> {
    const dimensions = [
      { key: 'worldSetting', label: '世界观设定', desc: '小说主舞台的大陆疆域、宏观规则、历史背景与社会法则' },
      { key: 'coreConflict', label: '核心冲突', desc: '推动主线发展的主要矛盾，主角面临的终极敌对势力或危机' },
      { key: 'sellingPoints', label: '爽点卖点', desc: '网文吸引读者的商业爽点，如打脸、越级挑战、幕后黑手等节奏设计' },
      { key: 'powerSystem', label: '力量体系', desc: '修炼境界、超自然等级与晋升逻辑' },
      { key: 'skillSystem', label: '功法体系', desc: '核心功法、武技、法术的分类与层级' },
      { key: 'goldFinger', label: '金手指', desc: '主角的特殊外挂、系统、随身宝物或独占机缘' },
      { key: 'location', label: '地理地图', desc: '核心地域、重要场景与地理格局' },
      { key: 'faction', label: '势力阵营', desc: '主要势力、宗门、组织及其关系' },
      { key: 'currency', label: '货币体系', desc: '世界中的交易媒介、资源体系与价值尺度' },
      { key: 'item', label: '关键物品', desc: '推动剧情的重要道具、神器、宝物' },
    ];

    if (!hasUsableKey(apiKey)) {
      throw new Error("请先配置 API Key 后再使用 AI 功能");
    }

    // 构建每个维度的任务
    const tasks = dimensions.map((dim) => {
      const systemInstruction = `你是一个专业的顶级网络小说总策划和架构师。你的任务是根据给定的书名、题材和文风，为小说的「${dim.label}」维度推演 3 套风格迥异、极具网文爽点与创意的备选方案。

维度说明：${dim.desc}

要求：
1. 每套方案的 description 必须在 150-300 字之间，内容详实、有画面感、有具体细节，不能泛泛而谈。
2. 三套方案之间风格差异要大，覆盖不同的网文流派和读者偏好。
3. 必须符合「${genre}」题材和「${tone}」文风。

请以纯 JSON 格式输出（不要 markdown 标记），结构如下：
{
  "options": [
    {"name": "方案A名称（6字以内）", "description": "方案A的详细描述，150-300字"},
    {"name": "方案B名称（6字以内）", "description": "方案B的详细描述，150-300字"},
    {"name": "方案C名称（6字以内）", "description": "方案C的详细描述，150-300字"}
  ]
}`;

      const prompt = `小说的名字是：《${projectTitle}》
题材是：${genre}
文风是：${tone}

请为「${dim.label}」维度推演 3 套高品质备选方案。`;

      return async () => {
        const jsonStr = await callModelApi(apiKey!, modelName || 'gemini-2.5-flash', systemInstruction, prompt, true);
        const parsed = safeParseJSON<{ options: Array<{ name: string; description: string }> }>(jsonStr, { options: [] });
        return { key: dim.key, label: dim.label, options: parsed.options || [] };
      };
    });

    // 并发执行，按 concurrency 控制并发数
    const taskResults = await runWithConcurrency(tasks, concurrency, (result, completed, total) => {
      if (onProgress && !(result instanceof Error)) {
        const item = result as { key: string; label: string; options: Array<{ name: string; description: string }> };
        onProgress(item.key, item.label, completed, total, item.options);
      }
    });

    const finalResult: Record<string, any> = {};
    for (const r of taskResults) {
      if (r && !(r instanceof Error)) {
        const item = r as { key: string; label: string; options: any[] };
        finalResult[item.key] = item.options;
      }
    }

    return finalResult;
  },

  /**
   * AI 聊天与记忆查询
   */
  async chat(projectId: string, query: string, apiKey?: string, modelName?: string): Promise<string> {
    const memory = await searchMemory(projectId, query);
    const systemInstruction = `你是一个高级小说创作助手。你非常熟悉这部小说的设定和剧情，能基于提供的上下文记忆，准确、专业、充满创作灵感地回答作者的问题。请保持小说文风，并给出明确、符合逻辑的推断。`;
    const prompt = `【当前背景上下文信息】:\n${memory.contextText}\n\n【作者提问】:\n${query}\n\n请结合上下文进行专业解答，说明事实并给出合理的创作建议。`;

    if (hasUsableKey(apiKey)) {
      return await callModelApi(apiKey!, modelName || 'gemini-2.5-flash', systemInstruction, prompt, false);
    }

    // 延迟模拟网络请求
    await new Promise(resolve => setTimeout(resolve, 800));
    throw new Error("请先配置 API Key 后再使用 AI 功能");
  },

  /**
   * AI 自动写小说章节正文
   */
  async autoWriteChapter(projectId: string, chapterTitle: string, apiKey?: string, modelName?: string, instruction?: string): Promise<string> {
    const memory = await searchMemory(projectId, chapterTitle, chapterTitle);
    
    // 获取当前项目的文风设定与反 AI 规则配置
    const project = await db.getProject(projectId);
    const styleText = (project?.styleSetting || '').trim();
    const styleBlock = styleText ? `\n本书既定文风（务必严格贴合）：${styleText}` : '';
    const antiAiLines = formatAntiAiInstructions(project?.antiAiStyleRules);
    const antiAiInstructions = antiAiLines
      ? `\n请务必严格遵守以下文风控制与反AI写作控制规则（极其重要）：\n` + antiAiLines
      : '';

    // few-shot：取本书最近一章有实质内容的正文片段作为文风范例（模仿笔触，不照抄情节）
    const allChapters = await db.getChapters(projectId);
    let styleExemplar = '';
    for (let i = allChapters.length - 1; i >= 0; i--) {
      const c = (allChapters[i].content || '').trim();
      if (c.length >= 200) { styleExemplar = c.slice(0, 400); break; }
    }
    const exemplarBlock = styleExemplar
      ? `\n\n【本书已有正文片段（请揣摩并模仿其笔触、语感与节奏，但不要照抄其情节）】：\n${styleExemplar}`
      : '';

    const systemInstruction = `你是一个网络小说全职写手，擅长撰写情节跌宕起伏、伏笔连贯、人物塑造深刻的网络小说。
你的任务是根据提供的小说设定、相关人物卡、前文回顾等上下文，接着作者给出的正文继续往下续写。
要求：
1. 章节标题是：“${chapterTitle}”。
2. 字数在 1000 字左右，结构必须包含：起（环境烘托与引子）、承（角色互动与对话）、转（核心冲突与博弈）、合（悬念留白与下章伏笔）。
3. 必须绝对遵循人物卡的性格描述、关系背景以及“写作禁忌”。
4. 行文文风必须与本书既定文风严格一致。${styleBlock}${antiAiInstructions}
5. 仅输出章节的正文内容，不要包含任何多余的引言、前言或总结。`;

    const prompt = `【小说设定与长期记忆】:\n${memory.contextText}${exemplarBlock}\n\n【本章写作指令/特殊要求】: ${instruction || '根据前文剧情自然过渡，重点刻画人物内心的试探与拉扯'}\n\n请自动生成章节“${chapterTitle}”的完整正文：`;

    if (hasUsableKey(apiKey)) {
      return await callModelApi(apiKey!, modelName || 'gemini-2.5-flash', systemInstruction, prompt, false);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
    throw new Error("请先配置 API Key 后再使用 AI 功能");
  },

  /**
   * AI 多维度设定自动生成
   */
  async generateInspirations(projectId: string, apiKey?: string, modelName?: string): Promise<{ characters: any[]; worldRules: any[] }> {
    const project = await db.getProject(projectId);
    const title = project?.title || '';
    const desc = project?.description || '';
    const style = project?.styleSetting || '';
    const world = project?.worldSetting || '';

    const systemInstruction = `你是一个资深网络小说策划和灵感生成器。你擅长为小说项目设计丰富、饱满、符合题材风格的多维度设定，包括角色、势力、地点、法宝道具、世界法则。
你的任务是根据提供的小说书名、简介、文风和世界观，自动生成一组极具吸引力的多维度设定，以 JSON 格式输出。`;

    const prompt = `【小说书名】: ${title}
【小说简介】: ${desc}
【小说文风】: ${style}
【小说基本世界观】: ${world}

请为此小说生成以下推荐设定（要求每个类别生成 2-3 个极具张力和创意的项）：
1. 推荐角色 (characters)
2. 推荐势力与地点 (worldRules, type 设为 'faction' 或 'location')
3. ️ 推荐法宝与道具 (worldRules, type 设为 'item')
4. 推荐世界法则与功法体系 (worldRules, type 设为 'rule')

必须以纯 JSON 格式输出（不要有 markdown 标记，并且确保输出的是合法的 JSON 格式，不要包含任何多余字符），结构如下：
{
  "characters": [
    {
      "name": "名字",
      "role": "反派 / 主角 / 配角",
      "age": "20",
      "identity": "身份背景",
      "personality": ["性格1", "性格2"],
      "goals": ["目标1", "目标2"],
      "currentState": "当前所处状态或正在做的事情",
      "forbidden": ["写作禁忌"]
    }
  ],
  "worldRules": [
    {
      "name": "设定项名称",
      "type": "location / faction / rule / item",
      "description": "设定项的详细描述与背景"
    }
  ]
}`;

    if (hasUsableKey(apiKey)) {
      const jsonStr = await callModelApi(apiKey!, modelName || 'gemini-2.5-flash', systemInstruction, prompt, true);
      return safeParseJSON(jsonStr);
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
    throw new Error("请先配置 API Key 后再使用 AI 功能");
  },

  /**
   * AI 智能向导新书生成
   */
  async autoPlanBook(genre: string, tone: string, tags: string[], apiKey?: string, modelName?: string): Promise<{ title: string; description: string; styleSetting: string; worldSetting: string }> {
    const systemInstruction = `你是一个顶级小说企划大师和文学导师。
你的任务是根据作者选定的小说分类、文风调性以及题材标签，自动规划推演并生成一个极其精彩、极具商业价值与艺术想象力的小说项目策划。
必须以 JSON 格式输出，不要包含任何 markdown 标记或多余的解释。`;

    const prompt = `【小说题材分类】: ${genre}
【故事文风调性】: ${tone}
【故事看点标签】: ${tags.join(', ')}

请根据上述偏好，推演并自动设计小说项目的基本框架。
要求：
1. 【小说书名】(title)：精妙、吸睛、有网文张力。
2. 【故事简介】(description)：100-200字，点明核心冲突、主角目标和爽点。
3. 【文风设定】(styleSetting)：说明具体的行文风格和节奏偏好。
4. 【世界观设定】(worldSetting)：200字以内，设计出力量体系、地理特色和背景矛盾。

必须以下列 JSON 格式输出：
{
  "title": "自动生成的精妙书名",
  "description": "自动生成的精彩故事简介",
  "styleSetting": "自动生成的文风设定描述",
  "worldSetting": "自动生成的背景世界观设定描述"
}`;

    if (hasUsableKey(apiKey)) {
      const jsonStr = await callModelApi(apiKey!, modelName || 'gemini-2.5-flash', systemInstruction, prompt, true);
      return safeParseJSON(jsonStr);
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
    throw new Error("请先配置 API Key 后再使用 AI 功能");
  },

  /**
   * AI 正文续写
   */
  async continueWriting(projectId: string, currentText: string, instruction?: string, apiKey?: string, modelName?: string, chapterTitle?: string): Promise<string> {
    const memory = await searchMemory(projectId, instruction || currentText, chapterTitle);
    const systemInstruction = `你是一个职业网络小说作家。你将基于提供的小说世界观、人物卡、前文回顾等上下文，接着作者给出的正文继续往下续写。
要求：
1. 风格、文笔、口吻要与已有内容高度一致。
2. 遵循人物卡里的“current_state”与“forbidden”（禁忌项）。
3. 故事节奏适中，多用细节描写、眼神、对白，少用平铺直叙。
4. 仅输出续写的内容，不要包含任何前言、后记或解释性文字。`;

    const prompt = `【小说上下文设定】:\n${memory.contextText}\n\n【作者当前已写的正文末尾】:\n\"\"\"\n${currentText}\n\"\"\"\n\n${instruction ? `【作者的特殊写作指令】: ${instruction}\n` : ''}\n请接着上面正文自然续写约300-500字。`;

    if (hasUsableKey(apiKey)) {
      return await callModelApi(apiKey!, modelName || 'gemini-2.5-flash', systemInstruction, prompt, false);
    }

    await new Promise(resolve => setTimeout(resolve, 1200));
    throw new Error("请先配置 API Key 后再使用 AI 功能");
  },

  /**
   * AI 文本润色
   */
  async polish(currentText: string, instruction?: string, apiKey?: string, modelName?: string): Promise<string> {
    const systemInstruction = `你是一个金牌小说编辑。请根据作者的要求对输入的章节正文进行润色。
要求：
1. 保持原意不变，提升文字的表现力、画面感、心理活动和环境烘托。
2. 语气行文要流畅，符合小说题材文风。
3. 仅输出润色后的正文，不要有任何多余的解释。`;

    const prompt = `【待润色的文本】:\n\"\"\"\n${currentText}\n\"\"\"\n\n【润色要求/风格选项】: ${instruction || '提升文学美感，加强环境烘托与心理描写'}\n\n请输出润色后的结果：`;

    if (hasUsableKey(apiKey)) {
      return await callModelApi(apiKey!, modelName || 'gemini-2.5-flash', systemInstruction, prompt, false);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    throw new Error("请先配置 API Key 后再使用 AI 功能");
  },

  /**
   * AI 章节大纲生成
   */
  async generateOutline(projectId: string, projectTitle: string, projectDesc: string, numChapters: number = 3, apiKey?: string, modelName?: string): Promise<string> {
    const memory = await searchMemory(projectId, '大纲 章节');
    const systemInstruction = `你是一个资深网络小说架构师和大纲主笔。你将基于小说的基本设定和目前的章节回顾，为作者规划生成接下来的章节大纲。`;
    const prompt = `【小说名】: ${projectTitle}
【小说简介】: ${projectDesc}

【小说当前记忆背景设定】:
${memory.contextText}

【生成任务】:
请基于上述背景，详细生成接下来的 ${numChapters} 个章节的大纲，要求每一章大纲包含：
1. 章节标题
2. 核心冲突/剧情线
3. 伏笔/信息释放点
4. 情绪起伏/人物心理状态变化
5. 预计字数与节奏。`;

    if (hasUsableKey(apiKey)) {
      return await callModelApi(apiKey!, modelName || 'gemini-2.5-flash', systemInstruction, prompt, false);
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
    const charsList = memory.characters.map(c => c.name).join(', ');
    const rulesList = memory.worldRules.map(r => r.name).join(', ');
    const project = await db.getProject(projectId);
    let inferredGenre = '玄幻奇幻';
    if (project) {
      const text = (project.worldSetting + " " + project.description).toLowerCase();
      if (text.includes("电子竞技") || text.includes("电竞") || text.includes("召唤师")) {
        inferredGenre = "电子竞技";
      } else if (text.includes("规则怪谈") || text.includes("怪谈空间") || text.includes("乘车守则")) {
        inferredGenre = "规则怪谈";
      } else if (text.includes("豪门") || text.includes("总裁") || text.includes("晚宴") || text.includes("千金")) {
        inferredGenre = "女生言情";
      } else if (text.includes("修真") || text.includes("元婴") || text.includes("筑基") || text.includes("仙侠") || text.includes("剑仙")) {
        inferredGenre = "仙侠武侠";
      } else if (text.includes("末日") || text.includes("废土") || text.includes("科幻") || text.includes("星际")) {
        inferredGenre = "科幻末世";
      } else if (text.includes("诡秘") || text.includes("不可名状") || text.includes("理智") || text.includes("收容")) {
        inferredGenre = "悬疑惊悚";
      }
    }
    throw new Error("请先配置 API Key 后再使用 AI 功能");
  },

  /**
   * AI 逻辑一致性自检
   */
  async checkConsistency(projectId: string, currentText: string, apiKey?: string, modelName?: string): Promise<AICheckResult> {
    const memory = await searchMemory(projectId, currentText);
    const systemInstruction = `你是一个极度挑剔的小说审校编辑。你的任务是比对作者新写的章节正文与小说的人物卡、世界观设定、前文回顾等记忆，查找其中可能存在的逻辑漏洞、设定冲突、人物性格崩坏或违反写作禁忌的地方。`;
    const prompt = `【小说设定与前文背景】:\n${memory.contextText}\n\n【作者新写的正文内容】:\n\"\"\"\n${currentText}\n\"\"\"\n\n请详细检查上述正文是否与设定冲突。
请以 JSON 格式输出，格式如下：
{
  "passed": false, // 如果没有检测到任何逻辑与设定冲突，设为 true，否则为 false
  "issues": [
    "冲突点1的详细描述",
    "冲突点2的详细描述"
  ],
  "suggestions": [
    "修改建议1",
    "修改建议2"
  ]
}`;

    if (hasUsableKey(apiKey)) {
      const jsonStr = await callModelApi(apiKey!, modelName || 'gemini-2.5-flash', systemInstruction, prompt, true);
      return safeParseJSON<AICheckResult>(jsonStr);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    throw new Error("请先配置 API Key 后再使用 AI 功能");
  },

  /**
   * 自动章节摘要与状态提取
   */
  async summarizeChapter(currentText: string, apiKey?: string, modelName?: string): Promise<AISummaryResult> {
    const systemInstruction = `你是一个小说精简摘要与实体变化分析工具。你的任务是分析一章小说的正文，提取其核心事件、人物状态改变、新埋下的伏笔和已回收的伏笔。`;
    const prompt = `【本章正文】:\n\"\"\"\n${currentText}\n\"\"\"\n\n请提取本章摘要、人物状态变化、伏笔变化和时间线事件。
必须以 JSON 格式输出，字段如下：
{
  "summary": "100字以内的本章核心剧情精炼摘要",
  "characterChanges": [
    { "character": "角色名", "change": "本章中该角色的心理或身体状态变化，如：开始怀疑男主身世" }
  ],
  "newForeshadowing": ["本章新出现的伏笔或线索，如：玉佩上的盘龙纹"],
  "resolvedForeshadowing": ["本章收回的之前埋下的伏笔/解释了的事物，如：密信的来源"],
  "timelineEvents": ["本章内发生的关键时间线事件，格式为 '时间 + 地点 + 事件'，如：第三日夜，陆青禾在藏书阁看到密信"]
}`;

    if (hasUsableKey(apiKey)) {
      const jsonStr = await callModelApi(apiKey!, modelName || 'gemini-2.5-flash', systemInstruction, prompt, true);
      return safeParseJSON<AISummaryResult>(jsonStr);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    throw new Error("请先配置 API Key 后再使用 AI 功能");
    },

  /**
   * 维护全书滚动概要：prev 为空时从全部章节摘要 bootstrap，否则在 prev 基础上折叠最新一章摘要。
   * 返回压缩后的新概要（调用方负责落库）。用于在长篇里以「有界的滚动概要」替代「逐章全量摘要」注入。
   */
  async updateRollingSynopsis(projectId: string, apiKey?: string, modelName?: string): Promise<string> {
    const [project, chapters] = await Promise.all([
      db.getProject(projectId),
      db.getChapters(projectId),
    ]);
    const prev = (project?.rollingSynopsis || '').trim();
    const summarized = chapters.filter(c => c.summary && c.summary.trim() !== '');
    if (summarized.length === 0) return prev;

    // prev 为空 → 从全部章节摘要重建；否则只折叠最新一章，保证 LLM 输入有界
    const isBootstrap = !prev;
    const last = summarized[summarized.length - 1];
    const material = isBootstrap
      ? summarized.map(c => `${c.title}：${c.summary}`).join('\n')
      : `${last.title}：${last.summary}`;

    const systemInstruction = `你是小说连续性管理员，负责维护一份贯穿全书的「滚动剧情概要」。这份概要会在 AI 写作后续章节时作为长期记忆注入，必须准确、连贯、不遗漏关键转折。`;
    const prompt = `【现有滚动概要】：\n${prev || '（暂无，请基于下方章节摘要新建）'}\n\n【${isBootstrap ? '全部章节摘要（按顺序）' : '新增章节摘要'}】：\n${material}\n\n请输出更新后的全书滚动概要：
要求：
1. 用不超过 600 字的连贯叙述，按时间顺序概括从开篇到目前的主线脉络与关键转折。
2. 保留：核心冲突进展、主要人物当前处境与关系变化、尚未解决的悬念/伏笔。
3. 合并重复信息，略去无关紧要的细节与对白。
4. 只输出概要正文本身，不要标题、解释或分点编号。`;

    if (hasUsableKey(apiKey)) {
      return await callModelApi(apiKey!, modelName || 'gemini-2.5-flash', systemInstruction, prompt, false);
    }

    // 无可用模型时的兜底：拼接并保留尾部，保证字段有值且有界
    await new Promise(resolve => setTimeout(resolve, 300));
    const merged = isBootstrap ? material : `${prev}\n${material}`;
    return merged.length > 1200 ? merged.slice(-1200) : merged;
  },

  /**
   * 维护世界状态台账：读取现有台账 + 滚动概要 + 最近章节摘要，让 AI 输出更新后的非锁定条目。
   * 返回条目数组（调用方负责落库 via db.replaceAutoWorldStates）。
   */
  async updateWorldState(projectId: string, apiKey?: string, modelName?: string): Promise<Array<{ category: string; name: string; content: string; updatedAtChapter?: string }>> {
    const [project, chapters, existingStates] = await Promise.all([
      db.getProject(projectId),
      db.getChapters(projectId),
      db.getWorldStates(projectId),
    ]);

    const rolling = (project?.rollingSynopsis || '').trim();
    const summarized = chapters.filter(c => c.summary && c.summary.trim() !== '');
    const recentSummaries = summarized.slice(-5).map(c => `${c.title}：${c.summary}`).join('\n');

    // 标记哪些条目已锁定，AI 不得修改
    const lockedInfo = existingStates.filter(s => s.pinned).map(s => `[${s.category}] ${s.name}（已锁定，不可修改）`).join('\n');
    const unlockedInfo = existingStates.filter(s => !s.pinned).map(s => `[${s.category}] ${s.name}：${s.content}`).join('\n');

    const systemInstruction = `你是小说连续性管理员，负责维护一份「世界当前状态台账」。这份台账记录随剧情演化的动态世界信息，会在 AI 写作后续章节时作为长期记忆注入，必须准确反映当前剧情进展。`;
    const prompt = `【现有世界状态台账（非锁定条目，可更新）】：
${unlockedInfo || '（暂无）'}

【已锁定条目（人工校对过，不可修改/删除）】：
${lockedInfo || '（无）'}

【全书滚动概要】：
${rolling || '（暂无）'}

【最近章节摘要】：
${recentSummaries || '（暂无）'}

请输出更新后的世界状态条目数组 JSON。维度限定为以下 6 类：
- 势力格局：各势力当前态势、关系变化
- 主角境界：主角当前修为/实力等级
- 当前所在地：主角/核心角色当前所在位置
- 时间进度：故事当前时间节点
- 关键物品：重要物品当前归属
- 其他：不属于以上类别但重要的动态世界信息

输出格式（纯 JSON 数组，不要 markdown 代码块）：
[{"category":"势力格局","name":"天澜宗","content":"当前态势描述...","updatedAtChapter":"第X章"}]

要求：
1. 基于滚动概要和最近章节摘要，更新已有条目的 content，补充新增条目。
2. 已锁定条目不要出现在输出中（它们会被保留）。
3. 每条 content 控制在 100 字以内，简明扼要。
4. 只输出 JSON 数组，不要任何解释。`;

    if (hasUsableKey(apiKey)) {
      const raw = await callModelApi(apiKey!, modelName || 'gemini-2.5-flash', systemInstruction, prompt, false);
      const parsed = safeParseJSON<Array<{ category: string; name: string; content: string; updatedAtChapter?: string }>>(raw, []);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      // 解析失败时返回现有非锁定条目不变
      return existingStates.filter(s => !s.pinned).map(s => ({ category: s.category, name: s.name, content: s.content, updatedAtChapter: s.updatedAtChapter }));
    }

    // 无可用模型时的兜底：返回现有台账不变
    await new Promise(resolve => setTimeout(resolve, 300));
    return existingStates.filter(s => !s.pinned).map(s => ({ category: s.category, name: s.name, content: s.content, updatedAtChapter: s.updatedAtChapter }));
  },
};

const genreToCategory: Record<string, string> = {
  // 玄幻奇幻
  '东方玄幻': '玄幻奇幻',
  '异世大陆': '玄幻奇幻',
  '王朝争霸': '玄幻奇幻',
  '史诗奇幻': '玄幻奇幻',
  '高武世界': '玄幻奇幻',
  // 仙侠武侠
  '古典仙侠': '仙侠武侠',
  '幻想修仙': '仙侠武侠',
  '现代修真': '仙侠武侠',
  '传统武侠': '仙侠武侠',
  '武侠幻想': '仙侠武侠',
  // 都市青春
  '都市生活': '都市青春',
  '异术超能': '都市青春',
  '商战职场': '都市青春',
  '娱乐明星': '都市青春',
  '青春校园': '都市青春',
  // 历史军事
  '架空历史': '历史军事',
  '秦汉三国': '历史军事',
  '两宋元明': '历史军事',
  '特种兵王': '历史军事',
  '战争幻想': '历史军事',
  // 科幻末世
  '未来世界': '科幻末世',
  '星际文明': '科幻末世',
  '时空穿梭': '科幻末世',
  '末世危机': '科幻末世',
  '古武机甲': '科幻末世',
  // 悬疑惊悚
  '诡秘神秘': '悬疑惊悚',
  '规则怪谈': '悬疑惊悚',
  '探险寻宝': '悬疑惊悚',
  '侦探推理': '悬疑惊悚',
  '灵异民俗': '悬疑惊悚',
  // 游戏体育
  '虚拟网游': '游戏体育',
  '电子竞技': '游戏体育',
  '游戏异界': '游戏体育',
  '体育竞技': '游戏体育',
  // 轻小说
  '原生幻想': '轻小说',
  '衍生同人': '轻小说',
  '搞笑吐槽': '轻小说',
  '恋爱日常': '轻小说',
  // 女生言情
  '豪门总裁': '女生言情',
  '宫廷侯爵': '女生言情',
  '种田经商': '女生言情',
  '幻情仙侠': '女生言情',
  '浪漫青春': '女生言情'
};