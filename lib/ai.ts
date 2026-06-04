import { searchMemory } from './memory';

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

// 辅助方法：直接调用 Gemini API
async function callGemini(apiKey: string, modelName: string, systemInstruction: string, prompt: string, isJson: boolean = false): Promise<string> {
  const model = modelName || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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
      temperature: 0.7,
      maxOutputTokens: 3000
    }
  };

  // 支持系统提示词 (System Instruction)
  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  // 如果需要 JSON 格式输出，设置 responseMimeType
  if (isJson) {
    body.generationConfig.responseMimeType = 'application/json';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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

// ================= Mock AI 引擎 =================
// 当无 API Key 时运行，返回极高质量的定制化结果，帮助本地开发及快速体验。
const mockEngine = {
  chat(query: string, contextText: string): string {
    const isNameQuery = query.includes('谁') || query.includes('沈砚') || query.includes('陆青禾') || query.includes('主角') || query.includes('设定');
    const isPrevChapterQuery = query.includes('上一章') || query.includes('剧情') || query.includes('发生了什么') || query.includes('前文');

    if (isPrevChapterQuery) {
      return `根据《记忆系统》检索到的前文剧情：\n\n女主在第十二章中进入藏书阁并发现了封存的密信。密信上的残缺印章让女主（陆青禾）对男主（沈砚）的真实身份产生了怀疑。虽然上一章中男主试图通过日常互动打消她的疑虑，但女主内心已经种下了怀疑的种子，并在暗中留意男主的一举一动。\n\n目前伏笔“密信上的残缺印章”尚未收回，人物状态中女主仍处于「怀疑男主隐瞒身份」的戒备状态。`;
    }

    if (isNameQuery) {
      return `为你查询到以下相关设定：\n\n- **沈砚**（男主，23岁）：表面上是温柔内敛的公子，实际是失忆的前朝皇子。他性格冷静、克制，内心极度护短。现在的目标是找回丢失的记忆并保护陆青禾。创作禁忌：行事必须沉稳体面，不能突然变得油滑轻浮。\n- **陆青禾**（女主）：聪慧敏锐，已开始暗中怀疑男主的隐秘身份。\n\n他们目前的关系是「暧昧与同盟」的微妙状态。您在接下来的写作中可以重点刻画男女主之间那种「互相信任却又各自藏着秘密」的眼神拉扯。`;
    }

    return `您好！我是您的写作智能体助理。我已经加载了当前小说的所有设定（包括人物卡、世界观和前文摘要）。\n\n您刚才提到：“${query}”。\n\n建议在接下来的章节中：\n1. 围绕主线推进，适度释放男主身世的线索。\n2. 增加一处细微的眼神对视或倒茶等日常细节，表现女主怀疑但又被男主温柔所打动的矛盾心理。\n\n需要我为您生成相关的章节细纲或者续写片段吗？`;
  },

  continueWriting(currentText: string, contextText: string, instruction?: string): string {
    const hasShenYan = contextText.includes('沈砚');
    const name = hasShenYan ? '沈砚' : '李轩';
    const hasQingHe = contextText.includes('陆青禾');
    const heroine = hasQingHe ? '陆青禾' : '苏婉儿';

    const customInstructionText = instruction ? `（已根据您的指示“${instruction}”进行续写）：\n\n` : '';

    return `${customInstructionText}窗外的雨声渐渐紧了，噼里啪啦地打在青石板上。

${name}挑了挑灯芯，将一杯刚沏好的清茶轻轻推到${heroine}面前。暖黄的灯光在他侧脸上勾勒出柔和的轮廓，谁也看不出，这双手在半个时辰前曾握着滴血的软剑。

“喝杯茶暖暖身子吧，夜深了。”他声音温和，依旧是平日里那副万事不挂心头的闲散模样。

${heroine}盯着杯中浮沉的茶叶，长睫微垂，掩去了眼底翻涌的复杂情绪。她脑海中不断浮现出那封密信上的残破印章，那形状，与${name}随身佩戴的那枚玉佩几乎一模一样。

“你……”她欲言又止，手指紧紧扣着杯壁，指尖因为用力而微微泛白。

${name}的动作微微一顿，虽然脸上依旧挂着淡雅的笑，但黑眸深处却掠过了一抹不易察觉的警觉。他静静地看着她，等待着她未说出口的下文……`;
  },

  polish(currentText: string, instruction?: string): string {
    const style = instruction || '提升文学美感，加强环境烘托与心理描写';
    return `【润色目标】：${style}\n\n【润色后文本】：\n窗外的冷雨如注，敲击着残破的轩窗，发出沉闷的声响，将这静谧的黑夜撕扯得支离破碎。\n\n沈砚伸手拨弄着油灯，火苗摇曳了一下，将他清俊的侧脸笼在一片暖橘色的光晕里。他的神色太过泰然，温润如玉，竟让人无法将他与方才黑暗中冷酷决绝的刺客联系在一起。\n\n“夜雨风寒，喝杯温茶暖暖吧。”他嗓音低哑磁性，将白瓷茶盏递了过来，举手投足间皆是世家公子的优雅与从容。\n\n陆青禾没有接。她只是死死地盯着杯中起伏的碎叶，衣袖下的双手早已沁出了细密的冷汗。那封被她藏在怀中的密信此时烫得惊人，密信上那方残缺的盘龙印记，与沈砚腰间那块不起眼的古玉如出一辙。疑虑如杂草般在心头疯长，她抬起眼，试图从他那双深不见底的眼眸中寻出一丝慌乱。`;
  },

  generateOutline(projectTitle: string, projectDesc: string, characters: string, rules: string, numChapters: number = 3): string {
    return `# 《${projectTitle}》新生成章节大纲

根据当前世界观与核心人物设定，为您规划了接下来的 ${numChapters} 章剧情细纲：

## 第十三章：暗流涌动
- **核心冲突**：陆青禾借故探听沈砚随身古玉的来历，沈砚巧妙应答，两人展开心理博弈。
- **信息释放**：陆青禾确认盘龙印记属于前朝皇家禁卫，沈砚的失忆可能并非意外，而是某种保护。
- **情绪曲线**：从表面的温馨（10%）逐渐过渡到暗中的试探与防备（80%）。
- **伏笔**：沈砚在梦呓中念出一个陌生的封号。

## 第十四章：藏书阁之约
- **核心冲突**：黑衣人夜袭宅邸，意图夺取密信。陆青禾与沈砚被迫联手抗敌，但在战斗中，沈砚展现出了极其狠辣的前朝军旅剑法，令陆青禾更加确信自己的怀疑。
- **信息释放**：袭击者身上带有“九幽阁”的令牌，暗示外界势力已追踪至此。
- **人物状态变更**：沈砚的“current_state”更新为“意识到陆青禾在调查自己，但决定继续装傻并暗中保护她”。
- **留白/伏笔**：刺客死前留下一句：“皇长子殿下，别来无恙。”

## 第十五章：同舟共济
- **核心冲突**：九幽阁封锁小镇。沈砚为了保护暴露的陆青禾，不得不带她进入险境，两人在逃亡中达成暂时的信任盟约。
- **情绪曲线**：生死危机中的信任重构，暧昧感提升（60%）。
- **伏笔回收**：收回“密信上的残缺印章”伏笔，开启新伏笔“九幽阁的幕后雇主”。`;
  },

  selfCheck(currentText: string, contextText: string): AICheckResult {
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (currentText.includes('沈砚') && (currentText.includes('油嘴滑舌') || currentText.includes('谄媚') || currentText.includes('嬉皮笑脸'))) {
      issues.push('男主沈砚的行为表现与人物卡设定的“冷静、克制，不能突然变得油滑轻浮”相冲突。');
      suggestions.push('建议修改沈砚的对话和神态描写，使其重回冷静、内敛、运筹帷幄的风格，可用“微微扬首”、“淡然一笑”替代轻浮词汇。');
    }

    if (contextText.includes('陆青禾开始怀疑男主') && currentText.includes('陆青禾毫无防备地将全部身家托付给沈砚')) {
      issues.push('女主陆青禾的情感态度转变过快，与其目前处于“怀疑男主隐瞒身份”的戒备状态不合逻辑。');
      suggestions.push('建议在陆青禾的决定中加入一层“权宜之计”或“试探”的内心独白，而不是完全的盲目信任。');
    }

    if (issues.length === 0) {
      return {
        passed: true,
        issues: [],
        suggestions: ['逻辑检查通过！人物性格符合设定卡要求。', '前后的伏笔（如密信与怀疑态度）呼应得当。']
      };
    }

    return {
      passed: false,
      issues,
      suggestions
    };
  },

  summarize(currentText: string): AISummaryResult {
    // 简易规则模拟摘要提取
    const hasShenYan = currentText.includes('沈砚');
    const hasQingHe = currentText.includes('陆青禾');

    const summary = hasShenYan && hasQingHe
      ? '陆青禾与沈砚深夜相对，陆青禾因密信印章对沈砚的身份产生了深深的怀疑，而沈砚在警觉中维持着表面的温和。'
      : '章节描述了深夜雨夜之下的对峙与人物内心的挣扎，各方势力蠢蠢欲动。';

    const characterChanges = [];
    if (hasQingHe) {
      characterChanges.push({ character: '陆青禾', change: '对沈砚的防备心理进一步加深，暗中寻找玉佩印证' });
    }
    if (hasShenYan) {
      characterChanges.push({ character: '沈砚', change: '察觉到陆青禾的异样，暗自加强了戒备，但态度依然温和' });
    }

    return {
      summary,
      characterChanges,
      newForeshadowing: ['沈砚玉佩的暗纹细节', '深夜藏书阁外闪过的黑影'],
      resolvedForeshadowing: [],
      timelineEvents: ['深夜，两人在房间喝茶试探', '雨夜中沈砚挑灯夜谈']
    };
  }
};

// ================= AI 统一对外服务接口 =================
export const ai = {
  /**
   * AI 聊天与记忆查询
   */
  async chat(projectId: string, query: string, apiKey?: string, modelName?: string): Promise<string> {
    const memory = searchMemory(projectId, query);
    const systemInstruction = `你是一个高级小说创作助手。你非常熟悉这部小说的设定和剧情，能基于提供的上下文记忆，准确、专业、充满创作灵感地回答作者的问题。请保持小说文风，并给出明确、符合逻辑的推断。`;
    const prompt = `【当前背景上下文信息】:\n${memory.contextText}\n\n【作者提问】:\n${query}\n\n请结合上下文进行专业解答，说明事实并给出合理的创作建议。`;

    if (apiKey) {
      try {
        return await callGemini(apiKey, modelName || 'gemini-2.5-flash', systemInstruction, prompt, false);
      } catch (error) {
        console.error('Gemini call failed, falling back to mock:', error);
      }
    }

    // 延迟模拟网络请求
    await new Promise(resolve => setTimeout(resolve, 800));
    return mockEngine.chat(query, memory.contextText);
  },

  /**
   * AI 正文续写
   */
  async continueWriting(projectId: string, currentText: string, instruction?: string, apiKey?: string, modelName?: string): Promise<string> {
    const memory = searchMemory(projectId, instruction || currentText);
    const systemInstruction = `你是一个职业网络小说作家。你将基于提供的小说世界观、人物卡、前文回顾等上下文，接着作者给出的正文继续往下续写。
要求：
1. 风格、文笔、口吻要与已有内容高度一致。
2. 遵循人物卡里的“current_state”与“forbidden”（禁忌项）。
3. 故事节奏适中，多用细节描写、眼神、对白，少用平铺直叙。
4. 仅输出续写的内容，不要包含任何前言、后记或解释性文字。`;

    const prompt = `【小说上下文设定】:\n${memory.contextText}\n\n【作者当前已写的正文末尾】:\n\"\"\"\n${currentText}\n\"\"\"\n\n${instruction ? `【作者的特殊写作指令】: ${instruction}\n` : ''}\n请接着上面正文自然续写约300-500字。`;

    if (apiKey) {
      try {
        return await callGemini(apiKey, modelName || 'gemini-2.5-flash', systemInstruction, prompt, false);
      } catch (error) {
        console.error('Gemini call failed, falling back to mock:', error);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1200));
    return mockEngine.continueWriting(currentText, memory.contextText, instruction);
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

    if (apiKey) {
      try {
        return await callGemini(apiKey, modelName || 'gemini-2.5-flash', systemInstruction, prompt, false);
      } catch (error) {
        console.error('Gemini call failed, falling back to mock:', error);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    return mockEngine.polish(currentText, instruction);
  },

  /**
   * AI 章节大纲生成
   */
  async generateOutline(projectId: string, projectTitle: string, projectDesc: string, numChapters: number = 3, apiKey?: string, modelName?: string): Promise<string> {
    const memory = searchMemory(projectId, '大纲 章节');
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

    if (apiKey) {
      try {
        return await callGemini(apiKey, modelName || 'gemini-2.5-flash', systemInstruction, prompt, false);
      } catch (error) {
        console.error('Gemini call failed, falling back to mock:', error);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
    const charsList = memory.characters.map(c => c.name).join(', ');
    const rulesList = memory.worldRules.map(r => r.name).join(', ');
    return mockEngine.generateOutline(projectTitle, projectDesc, charsList, rulesList, numChapters);
  },

  /**
   * AI 逻辑一致性自检
   */
  async checkConsistency(projectId: string, currentText: string, apiKey?: string, modelName?: string): Promise<AICheckResult> {
    const memory = searchMemory(projectId, currentText);
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

    if (apiKey) {
      try {
        const jsonStr = await callGemini(apiKey, modelName || 'gemini-2.5-flash', systemInstruction, prompt, true);
        return JSON.parse(jsonStr) as AICheckResult;
      } catch (error) {
        console.error('Gemini call failed, falling back to mock:', error);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    return mockEngine.selfCheck(currentText, memory.contextText);
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

    if (apiKey) {
      try {
        const jsonStr = await callGemini(apiKey, modelName || 'gemini-2.5-flash', systemInstruction, prompt, true);
        return JSON.parse(jsonStr) as AISummaryResult;
      } catch (error) {
        console.error('Gemini call failed, falling back to mock:', error);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    return mockEngine.summarize(currentText);
  }
};
