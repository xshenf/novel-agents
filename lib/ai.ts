import { searchMemory, RECENT_CONTENT_BUDGET_TOKENS } from './memory';
import { db } from './db';
import { formatAntiAiInstructions } from './rules';
import { hasUsableKey } from './agent/config';
import { callModelApi, fetchModels } from './modelApi';
import { safeParseJSON } from './safeParseJSON';
import { generateKernelSettings } from './kernelGenerator';

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

// ================= AI 统一对外服务接口 =================
export const ai = {
  /**
   * 动态获取当前服务商的可用模型列表
   */
  async fetchModels(apiKey: string, apiProvider: string, apiBaseUrl?: string): Promise<string[]> {
    return fetchModels(apiKey, apiProvider, apiBaseUrl);
  },
  /**
   * AI 推演网络小说核心设定 (10 大维度，各 3 套备选推荐)
   * 串行执行：每个维度推演时携带前面所有已完成的设定，确保设定统一
   * 推演顺序：世界观 -> 力量体系 -> 功法体系 -> 金手指 -> 核心冲突 -> 爽点卖点 -> 地理地图 -> 势力阵营 -> 货币体系 -> 关键物品
   * onProgress 回调在每完成一个维度时触发，参数为 (dimKey, dimLabel, index, total, dimOptions)
   */
  async generateKernelSettings(
    projectTitle: string, genre: string, tone: string,
    apiKey?: string, modelName?: string,
    onProgress?: (dimKey: string, dimLabel: string, index: number, total: number, dimOptions?: Array<{ name: string; description: string }>) => void,
    _concurrency?: number,
    forbiddenSetting?: string
  ): Promise<any> {
    return generateKernelSettings(projectTitle, genre, tone, apiKey, modelName, onProgress, _concurrency, forbiddenSetting);
  },

  /**
   * AI 聊天与记忆查询
   */
  async chat(projectId: string, query: string, apiKey?: string, modelName?: string, signal?: AbortSignal): Promise<string> {
    const memory = await searchMemory(projectId, query);
    const systemInstruction = `你是一个高级小说创作助手。你非常熟悉这部小说的设定和剧情，能基于提供的上下文记忆，准确、专业、充满创作灵感地回答作者的问题。请保持小说文风，并给出明确、符合逻辑的推断。`;
    const prompt = `【当前背景上下文信息】:\n${memory.contextText}\n\n【作者提问】:\n${query}\n\n请结合上下文进行专业解答，说明事实并给出合理的创作建议。`;

    if (hasUsableKey(apiKey)) {
      return await callModelApi(apiKey!, modelName || '', systemInstruction, prompt, false, signal);
    }

    // 延迟模拟网络请求
    await new Promise(resolve => setTimeout(resolve, 800));
    throw new Error("请先配置 API Key 后再使用 AI 功能");
  },

  /**
   * AI 自动写小说章节正文
   */
  async autoWriteChapter(projectId: string, chapterTitle: string, apiKey?: string, modelName?: string, instruction?: string, signal?: AbortSignal): Promise<string> {
    // 开启正文滑动窗口：最近章节注入原文（文风、情节末梢、细节连贯性远胜摘要）
    const memory = await searchMemory(projectId, chapterTitle, chapterTitle, {
      recentContentBudgetTokens: RECENT_CONTENT_BUDGET_TOKENS,
    });

    // 获取当前项目的文风设定与反 AI 规则配置
    const project = await db.getProject(projectId);
    const styleText = (project?.styleSetting || '').trim();
    const styleBlock = styleText ? `\n本书既定文风（务必严格贴合）：${styleText}` : '';
    const antiAiLines = formatAntiAiInstructions(project?.antiAiStyleRules);
    const antiAiInstructions = antiAiLines
      ? `\n请务必严格遵守以下文风控制与反AI写作控制规则（极其重要）：\n` + antiAiLines
      : '';
    const forbiddenText = (project?.forbiddenSetting || '').trim();
    const forbiddenInstructions = forbiddenText
      ? `\n请务必严格遵循以下“禁止出现的设定”负向约束（极其重要，严禁违背）：\n` + forbiddenText
      : '';

    const systemInstruction = `你是一个网络小说全职写手，擅长撰写情节跌宕起伏、伏笔连贯、人物塑造深刻的网络小说。
你的任务是根据提供的小说设定、相关人物卡、前文回顾等上下文，接着作者给出的正文继续往下续写。
要求：
1. 章节标题是：“${chapterTitle}”。
2. 字数在 1000 字左右，结构必须包含：起（环境烘托与引子）、承（角色互动与对话）、转（核心冲突与博弈）、合（悬念留白与下章伏笔）。
3. 必须绝对遵循人物卡的性格描述、关系背景以及“写作禁忌”。
4. 行文文风必须与本书既定文风严格一致，并与上下文中最近章节正文的笔触、语感自然衔接。${styleBlock}${antiAiInstructions}${forbiddenInstructions}
5. 仅输出章节的正文内容，不要包含任何多余的引言、前言或总结。`;

    const prompt = `【小说设定与长期记忆】:\n${memory.contextText}\n\n【本章写作指令/特殊要求】: ${instruction || '根据前文剧情自然过渡，重点刻画人物内心的试探与拉扯'}\n\n请自动生成章节“${chapterTitle}”的完整正文：`;

    if (hasUsableKey(apiKey)) {
      return await callModelApi(apiKey!, modelName || '', systemInstruction, prompt, false, signal);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
    throw new Error("请先配置 API Key 后再使用 AI 功能");
  },

  /**
   * AI 多维度设定自动生成
   */
  async generateInspirations(projectId: string, apiKey?: string, modelName?: string, signal?: AbortSignal): Promise<{ characters: any[]; worldRules: any[] }> {
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
      const jsonStr = await callModelApi(apiKey!, modelName || '', systemInstruction, prompt, true, signal);
      return safeParseJSON(jsonStr);
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
    throw new Error("请先配置 API Key 后再使用 AI 功能");
  },

  /**
   * AI 智能向导新书生成
   */
  async autoPlanBook(genre: string, tone: string, tags: string[], apiKey?: string, modelName?: string, signal?: AbortSignal): Promise<{ title: string; description: string; styleSetting: string; worldSetting: string; powerSystem?: string; coreConflict?: string; sellingPoints?: string }> {
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
5. 【力量体系】(powerSystem)：100字以内，设计境界划分、升级路线和核心能力。
6. 【核心冲突】(coreConflict)：100字以内，主角面对的终极矛盾与危机。
7. 【卖点】(sellingPoints)：100字以内，本书的核心爽点和市场吸引力。

必须以下列 JSON 格式输出：
{
  "title": "自动生成的精妙书名",
  "description": "自动生成的精彩故事简介",
  "styleSetting": "自动生成的文风设定描述",
  "worldSetting": "自动生成的背景世界观设定描述",
  "powerSystem": "自动生成的力量体系描述",
  "coreConflict": "自动生成的核心冲突描述",
  "sellingPoints": "自动生成的卖点描述"
}`;

    if (hasUsableKey(apiKey)) {
      const jsonStr = await callModelApi(apiKey!, modelName || '', systemInstruction, prompt, true, signal);
      return safeParseJSON(jsonStr);
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
    throw new Error("请先配置 API Key 后再使用 AI 功能");
  },

  /**
   * AI 正文续写
   */
  async continueWriting(projectId: string, currentText: string, instruction?: string, apiKey?: string, modelName?: string, chapterTitle?: string, signal?: AbortSignal): Promise<string> {
    const memory = await searchMemory(projectId, instruction || currentText, chapterTitle);
    const systemInstruction = `你是一个职业网络小说作家。你将基于提供的小说世界观、人物卡、前文回顾等上下文，接着作者给出的正文继续往下续写。
要求：
1. 风格、文笔、口吻要与已有内容高度一致。
2. 遵循人物卡里的“current_state”与“forbidden”（禁忌项）。
3. 故事节奏适中，多用细节描写、眼神、对白，少用平铺直叙。
4. 仅输出续写的内容，不要包含任何前言、后记或解释性文字。`;

    const prompt = `【小说上下文设定】:\n${memory.contextText}\n\n【作者当前已写的正文末尾】:\n\"\"\"\n${currentText}\n\"\"\"\n\n${instruction ? `【作者的特殊写作指令】: ${instruction}\n` : ''}\n请接着上面正文自然续写约300-500字。`;

    if (hasUsableKey(apiKey)) {
      return await callModelApi(apiKey!, modelName || '', systemInstruction, prompt, false, signal);
    }

    await new Promise(resolve => setTimeout(resolve, 1200));
    throw new Error("请先配置 API Key 后再使用 AI 功能");
  },

  /**
   * AI 文本润色
   */
  async polish(currentText: string, instruction?: string, apiKey?: string, modelName?: string, signal?: AbortSignal): Promise<string> {
    const systemInstruction = `你是一个金牌小说编辑。请根据作者的要求对输入的章节正文进行润色。
要求：
1. 保持原意不变，提升文字的表现力、画面感、心理活动和环境烘托。
2. 语气行文要流畅，符合小说题材文风。
3. 仅输出润色后的正文，不要有任何多余的解释。`;

    const prompt = `【待润色的文本】:\n\"\"\"\n${currentText}\n\"\"\"\n\n【润色要求/风格选项】: ${instruction || '提升文学美感，加强环境烘托与心理描写'}\n\n请输出润色后的结果：`;

    if (hasUsableKey(apiKey)) {
      return await callModelApi(apiKey!, modelName || '', systemInstruction, prompt, false, signal);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    throw new Error("请先配置 API Key 后再使用 AI 功能");
  },

  /**
   * AI 章节大纲生成
   */
  async generateOutline(projectId: string, projectTitle: string, projectDesc: string, numChapters: number = 3, apiKey?: string, modelName?: string, signal?: AbortSignal): Promise<string> {
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
      return await callModelApi(apiKey!, modelName || '', systemInstruction, prompt, false, signal);
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
    throw new Error("请先配置 API Key 后再使用 AI 功能");
  },

  /**
   * AI 逻辑一致性自检
   */
  async checkConsistency(projectId: string, currentText: string, apiKey?: string, modelName?: string, signal?: AbortSignal, excludeChapterId?: string): Promise<AICheckResult> {
    // 开启正文滑动窗口：与前文正文逐句比对才能查出细节矛盾；
    // excludeChapterId 排除刚落库的本章，避免"自己和自己比对"使校验失真
    const memory = await searchMemory(projectId, currentText, undefined, {
      recentContentBudgetTokens: RECENT_CONTENT_BUDGET_TOKENS,
      excludeChapterIds: excludeChapterId ? [excludeChapterId] : undefined,
    });
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
      const jsonStr = await callModelApi(apiKey!, modelName || '', systemInstruction, prompt, true, signal);
      return safeParseJSON<AICheckResult>(jsonStr);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    throw new Error("请先配置 API Key 后再使用 AI 功能");
  },

  /**
   * 自动章节摘要与状态提取
   */
  async summarizeChapter(currentText: string, apiKey?: string, modelName?: string, signal?: AbortSignal): Promise<AISummaryResult> {
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
      const jsonStr = await callModelApi(apiKey!, modelName || '', systemInstruction, prompt, true, signal);
      return safeParseJSON<AISummaryResult>(jsonStr);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    throw new Error("请先配置 API Key 后再使用 AI 功能");
    },

  /**
   * 维护全书滚动概要：prev 为空时从全部章节摘要 bootstrap，否则在 prev 基础上折叠最新一章摘要。
   * 返回压缩后的新概要（调用方负责落库）。用于在长篇里以「有界的滚动概要」替代「逐章全量摘要」注入。
   */
  async updateRollingSynopsis(projectId: string, apiKey?: string, modelName?: string, signal?: AbortSignal): Promise<string> {
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
      return await callModelApi(apiKey!, modelName || '', systemInstruction, prompt, false, signal);
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
  async updateWorldState(projectId: string, apiKey?: string, modelName?: string, signal?: AbortSignal): Promise<Array<{ category: string; name: string; content: string; updatedAtChapter?: string }>> {
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
      const raw = await callModelApi(apiKey!, modelName || '', systemInstruction, prompt, false, signal);
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