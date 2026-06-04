import { searchMemory } from './memory';
import { db } from './db';

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

    return `您好！我是您的自动写作智能体助理。我已经加载了当前小说的所有设定（包括人物卡、世界观和前文摘要）。\n\n您刚才提到：“${query}”。\n\n建议在接下来的章节中：\n1. 围绕主线推进，适度释放男主身世的线索。\n2. 增加一处细微的眼神对视或倒茶等日常细节，表现女主怀疑但又被男主温柔所打动的矛盾心理。\n\n需要我为您生成相关的章节细纲或者续写片段吗？`;
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

## 第十三章：深夜茶香的试探
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
  },

  autoWriteChapter(chapterTitle: string, contextText: string): string {
    const hasShenYan = contextText.includes('沈砚');
    const name = hasShenYan ? '沈砚' : '李轩';
    const hasQingHe = contextText.includes('陆青禾');
    const heroine = hasQingHe ? '陆青禾' : '苏婉儿';

    return `夜幕沉沉，将偏远小镇彻底卷入了一片湿冷的死寂之中。冷风夹杂着如注的暴雨，狠狠砸向老旧的雕花木窗，发出阵阵如泣如诉的呜咽声。

静谧的茶室内，油灯的火苗在微风中有些摇曳，将沈砚清俊的脸庞笼在一层温润的微光里。他白衣出尘，正手执竹勺，不急不躁地为茶案对面的陆青禾续上一杯滚烫 of 清茶。茶香升腾，与满室冷冽的雨水气息交融。

“风大雨急，陆姑娘深夜方归，莫要受了风寒。”他嗓音温和清朗，言语间尽是谦谦君子的体贴。谁也无法想到，这双手在半个时辰前，曾在黑暗中利落地结果了数名顶尖杀手。

陆青禾没有接话，袖中的指尖因为用力而微微发白。她的衣袖下，藏着那一封刚刚从陆家藏书阁密室死档中偷出来的残破信封。信封一角的盘龙火漆封印虽已残缺不全，但那印章的雕龙之角……

她抬起双眸，看似闲聊般望向沈砚腰间系着的那块青色古玉。

灯影之下，古玉佩的边缘隐隐有一抹残破的雕纹，其形状，与密信上的印记如出一辙。

“沈公子这古玉看起来有些年头了，”陆青禾轻抚盏壁，杏眼深处掠过一抹极细微的审视，“看那上面的盘龙纹样，倒像是中州京城达官显贵所用之物。不知沈公子是在何处寻得的？”

沈砚倒茶的手腕没有丝毫的抖动，然而眼睫垂下的瞬间，黑眸深处掠过了一抹幽深至极的沉晦。

“随身顽石而已，”沈砚抿了一口热茶，神色浮现出一抹自嘲与遗憾，“实不相瞒陆姑娘，在下重伤后前尘尽忘，这玉佩的来历早就不复记忆。若非陆姑娘今日问起，在下甚至从未在意过这纹样的出处。”

“原来如此，”陆青禾端起茶杯，浅浅尝了一口，掩去眼底冷冽的疑光，“倒是我多问了。这夜雨扰人，喝了公子的热茶，确实身子暖和了许多。”

沈砚微笑着颔首，黑眸深邃，仿佛能将陆青禾整个人看穿，却只是默默陪她喝着茶，任由窗外雷声大作，屋内的暗流不断奔涌……`;
  },

  generateInspirations(projectTitle: string): { characters: any[]; worldRules: any[] } {
    return {
      characters: [
        {
          name: "苏婉儿",
          role: "反派",
          age: "21",
          identity: "九幽阁卧底暗探，伪装成清风镇药铺苏掌柜之女",
          personality: ["冷酷无情", "极擅伪装", "心思缜密"],
          goals: ["夺回遗失的前朝密信", "暗中斩杀前朝皇子沈砚"],
          currentState: "伪装成采药姑娘，正密切监视陆家藏书阁动向",
          forbidden: ["不能轻易动情", "不能暴露九幽阁暗哨网"]
        },
        {
          name: "王苍山",
          role: "配角",
          age: "55",
          identity: "镇守清风镇的仙盟巡查执事，贪婪成性",
          personality: ["唯利是图", "城府极深", "欺软怕硬"],
          goals: ["搜刮小镇修真世家", "早日调回中州总部"],
          currentState: "已得知藏书阁有异动，正暗中调遣仙盟卫兵封锁道路",
          forbidden: ["在主角面前不能表现得太聪明"]
        }
      ],
      worldRules: [
        {
          name: "天澜宗",
          type: "faction",
          description: "中州五大正统宗门之一，明面上尊奉仙盟统御，实则暗中培养死士，与九幽阁有千丝万缕的利益勾连。"
        },
        {
          name: "清风小镇",
          type: "location",
          description: "小说故事发生的起点，位于各大世家势力与凡人交汇的边缘，鱼龙混杂，各方密探与散修齐聚。"
        },
        {
          name: "噬魂绝命针",
          type: "item",
          description: "九幽阁刺客特制的影杀暗器，针身淬有九幽炼狱草之毒，见血即化，元婴期以下中招者三刻内必全身溃烂。"
        },
        {
          name: "天道枷锁法则",
          type: "rule",
          description: "清风镇一带所笼罩的天然阵法限制。所有境界高于筑基期的修士在此地动手，其实力均会被压制在筑基巅峰，灵力无法外放超过三丈。"
        }
      ]
    };
  },

  autoPlanBook(genre: string, tone: string, tags: string[]): { title: string; description: string; styleSetting: string; worldSetting: string } {
    const isSuspense = genre.includes('悬疑') || tone.includes('悬疑') || tags.join(' ').includes('伏笔');
    const isXianxia = genre.includes('仙侠') || genre.includes('玄幻') || tags.join(' ').includes('修仙') || tags.join(' ').includes('凡人');

    if (isSuspense) {
      return {
        title: "九幽诡案录：藏书阁里的失魂人",
        description: "雨夜政变，大理寺管卷人李轩于阁中惊醒，前尘尽忘，唯有袖中一封诡异火漆密信与腰间带血的盘龙玉饰。随着他翻阅一卷卷封存的豪门禁忌古籍，一个涉及仙盟至高统治者、世家颠覆、前朝遗留死士组织‘九幽阁’的滔天阴谋，在重重迷雾与冷雨中剥茧抽丝般被揭开。",
        styleSetting: `${tone}调性。行文冰冷克制、悬疑色彩浓厚，强调案发现场、环境氛围描写及严密的细节比对与逻辑推导。`,
        worldSetting: "大周皇朝覆灭数百年，仙盟成为人界新主。世家大族在各省城圈地统治，修行资源高度垄断。江湖暗地里有前朝残余力量‘九幽阁’图谋复辟。凡人界与仙宗隔绝，唯有极少数古卷记录着当年的真相。"
      };
    }

    if (isXianxia) {
      return {
        title: "天道因果书：我能看见剧情密信",
        description: "凡骨少年李轩在偏远小镇的修真世家陆家当杂役，资质低下被视为废柴。一日，他意外在一卷残经中发现了能够偷看‘未来密信’的石碑。靠着预知未来因果的密信，李轩游走于宗门争斗、世家覆灭、前朝残党与仙盟神使之间，步步为营，改写因果，逆天修道。",
        styleSetting: `${tone}风格。快节奏，多打脸反转与智谋博弈，主角性格冷静理智、果断狠辣，注重眼神及细微交锋的刻画。`,
        worldSetting: "修真界由‘仙盟’统领，之下有陆、苏、王三大修真世家分居各地。修士境界划分为：炼气、筑基、结丹、元婴、化神。灵气日渐稀薄，天地之间设有一重重‘天道枷锁’，限制修士的力量极限。"
      };
    }

    // fallback
    return {
      title: "造化密友：我能偷看天机信件",
      description: "一个小杂役依靠脑海里突然出现的‘神秘信箱’，每天都能收到来自各大正魔两道巨擘、神魔妖仙之间的私密信件。他依靠信息不对称，游走于各大势力之间，黑吃黑，纳百川，从一介凡人最终成长为执掌万物因果的主宰。",
      styleSetting: `${tone}文风。基调轻松，带着微小的智斗与装逼，主角行事低调、幕后黑手风格。`,
      worldSetting: "万界交汇，宗门林立。修行体系以神识与仙道为主。世界深处有仙界特使掌管的因果仙碑，所有私密交谈和信件传递如果涉及天机，都会被因果仙碑记录并漏给主角。"
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
   * AI 自动写小说章节正文
   */
  async autoWriteChapter(projectId: string, chapterTitle: string, apiKey?: string, modelName?: string, instruction?: string): Promise<string> {
    const memory = searchMemory(projectId, chapterTitle);
    const systemInstruction = `你是一个网络小说全职写手，擅长撰写情节跌宕起伏、伏笔连贯、人物塑造深刻的网络小说。
你的任务是根据提供的小说设定、相关人物卡、前文回顾等上下文，接着作者给出的正文继续往下续写。
要求：
1. 章节标题是：“${chapterTitle}”。
2. 字数在 1000 字左右，结构必须包含：起（环境烘托与引子）、承（角色互动与对话）、转（核心冲突与博弈）、合（悬念留白与下章伏笔）。
3. 必须绝对遵循人物卡的性格描述、关系背景以及“写作禁忌”。
4. 行文文风必须与小说项目的文风一致。
5. 仅输出章节的正文内容，不要包含任何多余的引言、前言或总结。`;

    const prompt = `【小说设定与长期记忆】:\n${memory.contextText}\n\n【本章写作指令/特殊要求】: ${instruction || '根据前文剧情自然过渡，重点刻画人物内心的试探与拉扯'}\n\n请自动生成章节“${chapterTitle}”的完整正文：`;

    if (apiKey) {
      try {
        return await callGemini(apiKey, modelName || 'gemini-2.5-flash', systemInstruction, prompt, false);
      } catch (error) {
        console.error('Gemini autoWriteChapter failed, falling back to mock:', error);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
    return mockEngine.autoWriteChapter(chapterTitle, memory.contextText);
  },

  /**
   * AI 多维度设定自动生成
   */
  async generateInspirations(projectId: string, apiKey?: string, modelName?: string): Promise<{ characters: any[]; worldRules: any[] }> {
    const project = db.getProject(projectId);
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
1. 👥 推荐角色 (characters)
2. 🏰 推荐势力与地点 (worldRules, type 设为 'faction' 或 'location')
3. 🗡️ 推荐法宝与道具 (worldRules, type 设为 'item')
4. 📜 推荐世界法则与功法体系 (worldRules, type 设为 'rule')

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

    if (apiKey) {
      try {
        const jsonStr = await callGemini(apiKey, modelName || 'gemini-2.5-flash', systemInstruction, prompt, true);
        return JSON.parse(jsonStr);
      } catch (error) {
        console.error('Gemini generateInspirations failed, falling back to mock:', error);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
    return mockEngine.generateInspirations(title);
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

    if (apiKey) {
      try {
        const jsonStr = await callGemini(apiKey, modelName || 'gemini-2.5-flash', systemInstruction, prompt, true);
        return JSON.parse(jsonStr);
      } catch (error) {
        console.error('Gemini autoPlanBook failed, falling back to mock:', error);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
    return mockEngine.autoPlanBook(genre, tone, tags);
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
