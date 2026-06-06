import { searchMemory } from './memory';
import { db } from './db';
import { DEFAULT_ANTI_AI_RULES } from './rules';

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

  generateOutline(projectTitle: string, projectDesc: string, characters: string, rules: string, numChapters: number = 3, genre?: string): string {
    const currentGenre = genre || '玄幻奇幻';
    interface OutlineItem {
      title: string;
      conflict: string;
      release: string;
      curve: string;
    }
    
    const conflictTemplates: Record<string, OutlineItem[]> = {
      '玄幻奇幻': [
        { title: '觉醒与冲突', conflict: '主角被反派冷嘲热讽，在家族仪式上展现出逆天资质/武魂，全场震惊。', release: '世人皆以为主角是废柴，其实暗藏太古神体。', curve: '压抑（10%）到爽快暴涨（90%）' },
        { title: '藏经阁风波', conflict: '主角在藏经阁挑选功法，巧遇隐世长老，并与家族天才子弟发生争执，立下三月之约。', release: '长老看中主角心性，暗中给予指点。', curve: '冲突摩擦，斗志高昂（80%）' },
        { title: '大荒试炼', conflict: '主角进入危险的大荒山脉历练，遭遇妖兽袭击与家族死士的截杀，绝境突破。', release: '反派的阴谋逐渐露出冰山一角。', curve: '生死一线，突破极限（95%）' }
      ],
      '仙侠武侠': [
        { title: '山门仙缘', conflict: '仙门大选，凡人主角历经天梯重力压制，终获绝品灵根。', release: '世间罕见的纯阳/纯阴灵根。', curve: '期望与艰难跋涉（70%）' },
        { title: '洞府论道', conflict: '同门师兄为了争夺聚灵阵位置进行刁难，在切磋擂台一剑分高下。', release: '领悟了至高剑意。', curve: '轻松化解（80%）' },
        { title: '秘境夺宝', conflict: '太古遗迹开启，各派精英齐聚，主角暗中布局，虎口夺食取走万年仙草。', release: '被魔道妖女暗中盯上。', curve: '尔虞我诈，险象环生（90%）' }
      ],
      '都市青春': [
        { title: '第一桶金', conflict: '主角在写字楼被客户刁难，利用未来的商业记忆或神级技能，强势拿下一份天价订单。', release: '行业大佬抛来橄榄枝。', curve: '逆袭打脸（85%）' },
        { title: '名流晚宴', conflict: '同学聚会或商业晚宴上，主角被前女友和富二代嘲讽，反手展现惊人身家，震撼全场。', release: '揭露主角其实是幕后控股股东。', curve: '反转打脸（95%）' },
        { title: '暴风雨前的宁静', conflict: '竞争对手联合行业巨头对主角公司发起全面围剿，危机降临，主角早已布下伏笔。', release: '关键盟友的态度转变。', curve: '暗流涌动，压抑铺垫（50%）' }
      ],
      '历史军事': [
        { title: '边关惊雷', conflict: '胡虏进犯，边关守将溃逃，主角临危受命，率领百名乡勇死守孤城。', release: '主角改良的火药与守城战术生效。', curve: '热血悲壮，绝境反击（90%）' },
        { title: '朝堂辩驳', conflict: '朝廷奸臣主和，欲割地赔款，主角班师回朝，在金銮殿上舌战群儒，痛斥权贵。', release: '天子暗中支持主角的强硬政策。', curve: '慷慨激昂（85%）' },
        { title: '沙场点兵', conflict: '主角被任命为三军统帅，整合三军纪律，斩杀违纪勋贵，立军威。', release: '三军将士归心，战力飙升。', curve: '威严庄重，热血高潮（80%）' }
      ],
      '科幻末世': [
        { title: '废土觉醒', conflict: '辐射尘埃中的拾荒者主角，在一场机械巨兽的袭击中觉醒了掌控金属的超能。', release: '这具身体的主人其实携带者文明火种的绝密芯片。', curve: '生存危机与希望诞生（75%）' },
        { title: '钢铁壁垒的交易', conflict: '主角进入幸存者地下城，面对贪婪的佣兵团长和军阀的盘剥，用黑科技资源做交易。', release: '机械飞升派系早已渗透地下城。', curve: '尔虞我诈（80%）' },
        { title: '深空跃迁的死局', conflict: '智械危机爆发，太空港口遭遇围堵，主角率领破旧飞船强行进行未知坐标的星际跃迁。', release: '进入了传说中的失落星域。', curve: '惊心动魄（95%）' }
      ],
      '悬疑惊悚': [
        { title: '诡秘遗物', conflict: '主角收到一个神秘包裹，里面的日记制造了重重悬念，日记记载着自己的死期，周围开始出现诡异现象。', release: '主角发现了日记其实是用自己的血写成的。', curve: '惊悚恐惧，压抑窒息（85%）' },
        { title: '规则怪谈的陷阱', conflict: '主角被卷入深夜公交车的怪谈规则空间，所有乘客皆是异类，必须严守规则才能存活。', release: '发现规则中有一条是被篡改的谎言。', curve: '智商拉满，心跳过载（90%）' },
        { title: '迷雾背后的真相', conflict: '调查局 of 黑衣人包围了现场，欲收容异常。主角利用规则反向设局，成功逃脱。', release: '异常管理局背后的势力并非正义。', curve: '悬念迭起（80%）' }
      ],
      '游戏体育': [
        { title: '重返巅峰的手速', conflict: '昔日天才电竞选手因手伤退役，今日在网吧代练，展现出不可思议的零延迟神操作。', release: '手伤其实已被黑科技纳米虫修复。', curve: '战队战术默契度暴涨，初露锋芒（80%）' },
        { title: '海选赛的碾压', conflict: '组建草根战队参加全国海选，面对职业战队青训营的挑衅，在赛场上完成惊天五杀。', release: '引起豪门关注，重回视野。', curve: '热血沸腾（90%）' },
        { title: '宿敌的战书', conflict: '职业联赛春季赛抽签，首轮即对上当年的背叛者队伍，宿敌相见，火药味十足。', release: '对手已经开始研究主角的新英雄池。', curve: '暗流涌动，战意昂扬（75%）' }
      ],
      '轻小说': [
        { title: '天降美少女的烦恼', conflict: '平凡主角的衣柜里突然掉出一个自称是魔王继承人的猫耳美少女，生活被打乱。', release: '少女其实是为了躲避神界的追捕才逃到人间。', curve: '搞笑温馨，剧情节奏轻快（70%）' },
        { title: '学生会的修罗场', conflict: '傲娇会长与青梅竹马在社团活动室发生争执，主角被迫夹在中间，进行极限端水。', release: '主角的超能力差一点暴露。', curve: '修罗场，爆笑日常（75%）' },
        { title: '异世界勇者招聘会', conflict: '主角在学校后门发现了一个传送门，里面居然在招聘前往异世界的临时勇者。', release: '异世界的工资居然可以用金币结算。', curve: '脑洞大开，轻松愉快（80%）' }
      ],
      '女生言情': [
        { title: '雨夜的救赎', conflict: '落魄千金主角在暴雨中遭遇家族背叛与退婚，落魄至极，一辆迈巴赫停在面前，帝都最尊贵的男人走下车。', release: '这个男人居然是她当年无意救下的小男孩。', curve: '反转，爽快打脸前夫（85%）' },
        { title: '豪门晚宴的交锋', conflict: '在顾氏财阀的周年庆典上，继妹故意弄脏主角的礼服想看她出丑，主角身着高定盛装惊艳出场。', release: '晚宴男主宣布她才是唯一的合法继承人。', curve: '扬眉吐气（90%）' },
        { title: '危险的契约', conflict: '男主与主角达成假结婚契约，共同应付顾老爷子。在同居生活中，两人的情愫悄然滋长。', release: '男主早已在三年前就爱上了主角。', curve: '甜中带撩，极致拉扯（80%）' }
      ]
    };

    const defaultOutline: OutlineItem[] = [
      { title: '深夜茶香的试探', conflict: '陆青禾借故探听沈砚随身古玉的来历，沈砚巧妙应答，两人展开心理博弈。', release: '陆青禾确认盘龙印记属于前朝皇家禁卫，沈砚的失忆可能并非意外。', curve: '从表面的温馨（10%）逐渐过渡到暗中的试探与防备（80%）。' },
      { title: '藏书阁之约', conflict: '黑衣人夜袭宅邸，意图夺取密信。陆青禾与沈砚被迫联手抗敌，沈砚展现出前朝军旅剑法。', release: '袭击者身上带有“九幽阁”的令牌，暗示外界势力已追踪至此。', curve: '生死危机中的信任重构（60%）。' },
      { title: '同舟共济的抉择', conflict: '九幽阁封锁小镇。沈砚为了保护暴露的陆青禾，不得不带她进入险境，达成暂时的盟约。', release: '收回“密信上的残缺印章”伏笔，开启新伏笔“九幽阁的幕后雇主”。', curve: '生死与共的信任感（85%）。' }
    ];

    let matched = conflictTemplates[currentGenre];
    if (!matched) {
      // 模糊匹配
      const keys = Object.keys(conflictTemplates);
      const found = keys.find(k => currentGenre.includes(k) || k.includes(currentGenre));
      matched = found ? conflictTemplates[found] : defaultOutline;
    }

    const outlineTitle = `# 《${projectTitle}》新生成章节大纲\n\n根据当前世界观与核心人物设定，为您规划了接下来的 ${numChapters} 章剧情细纲：\n\n`;
    let body = '';
    const chineseNumbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '二十一', '二十二', '二十三', '二十四', '二十五', '二十六', '二十七', '二十八', '二十九', '三十', '三十一', '三十二', '三十三', '三十四', '三十五', '三十六', '三十七', '三十八', '三十九', '四十', '四十一', '四十二', '四十三', '四十四', '四十五', '四十六', '四十七', '四十八', '四十九', '五十'];
    for (let i = 0; i < numChapters; i++) {
      const ch = matched[i % matched.length];
      const chapNum = chineseNumbers[i] || String(i + 1);
      body += `## 第${chapNum}章：${ch.title}${i >= matched.length ? '（续）' : ''}\n`;
      body += `- **核心冲突**：${ch.conflict}\n`;
      body += `- **信息释放**：${ch.release}\n`;
      body += `- **情绪曲线**：${ch.curve}\n`;
      body += `- **相关人物**：${characters || '主角'}\n`;
      body += `- **世界规则**：${rules || '普适法则'}\n\n`;
    }

    return outlineTitle + body;
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
    const mappedCategory = genreToCategory[genre] || genre;
    const g = titleTemplates[genre] || titleTemplates[mappedCategory] || titleTemplates['玄幻奇幻'];
    
    // 随机组合算法
    const selectRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
    const prefix = selectRandom(g.prefixes);
    const core = selectRandom(g.cores);
    const suffix = selectRandom(g.suffixes);
    
    let title = `${prefix}${core}${suffix}`;
    // 35% 几率加入前/后缀式组合词，使书名更有网文感
    if (Math.random() < 0.35) {
      if (tags.length > 0) {
        title = Math.random() < 0.5 
          ? `从${tags[0]}开始的${title}` 
          : `${title}：我能看见${tags[0]}`;
      } else {
        title = `我即是${title}`;
      }
    }

    const worldSetting = worldSettings[genre] || worldSettings[mappedCategory] || worldSettings['玄幻奇幻'];

    // 根据题材与文风，拼接出极其贴合的文网简介
    let description = "";
    const displayTags = tags.length > 0 ? tags.slice(0, 3).join('、') : '超凡奇遇';
    
    if (genre === '电子竞技') {
      description = `顶级电竞职业联赛全球瞩目。曾因意外黯然退役的传奇中单主角，携带着【${displayTags}】的独门手速与战术理解重返赛场。重装上阵的他，以【${tone}】的王者姿态在赛区内掀起狂澜，带领新星战队捧起象征至高荣誉的召唤师奖杯。`;
    } else if (mappedCategory === '女生言情') {
      description = `在波澜诡谲的情感与家族利益交织的漩涡中，主角带着前世的记忆与【${displayTags}】的底牌强势归来。面对重重欺骗与豪门世家的打压，她决定以【${tone}】的手段破局，在步步为营的博弈与情深至切的拉扯中，走出属于她的一条青云之路。`;
    } else if (mappedCategory === '悬疑惊悚') {
      description = `迷雾笼罩的小镇，规则怪谈频出。主角在未知荒原或恐怖废墟中惊醒，失去了所有记忆。为了解开死亡谜题，主角依靠【${displayTags}】在san值狂掉的边缘艰难求生。这不仅是一场与怪诞危险的博弈，更是一场带有【${tone}】色彩的极致脑洞求生记。`;
    } else if (mappedCategory === '历史军事') {
      description = `烽火连天，江山动荡。主角意外重回到这个充满权谋与铁血的史诗乱世。身怀【${displayTags}】等底牌与现代智慧的他，以【${tone}】的狠辣谋略与治国之术，在朝堂上步步为营，在战场上气吞万里，开启了收复河山、登基称帝的终极霸业。`;
    } else if (mappedCategory === '科幻末世') {
      description = `星海崩塌，人类面临灭顶之灾。主角在废土废墟或星际舰队中觉醒，凭借【${displayTags}】的底牌，游走在赛博都市与深空战舰之间。以【${tone}】为基调，在暗流涌动的各方博弈中黑吃黑、起狂澜，开启了一段逆天改命的星海跃迁传奇。`;
    } else if (mappedCategory === '轻小说') {
      description = `这是一部非常轻松的异世界冒险物语。主角意外转生，却只拿到了【${displayTags}】这种系统。面对傲娇的萌娘、奇葩的勇者与吐槽不断的魔王，主角以【${tone}】的日常姿态开店赚钱，过上了温馨又搞笑的日常冒险生活。`;
    } else {
      // 仙侠、玄幻、科幻、都市等通用模板
      description = `这是一个融合了【${displayTags}】元素的【${genre}】宏大故事。主角在一个荒野开局中低调觉醒，依靠自身心智与机缘，在暗流汹涌的各方博弈中低调蓄势，黑吃黑，起狂澜。行文以【${tone}】为骨，剧情节奏极快，反击打脸酣畅淋漓，演绎了一场逆天改命的终极传奇。`;
    }

    return {
      title,
      description,
      styleSetting: `${tone}风格。行文流畅自然，强调细节铺垫与人物心理交锋，注重节奏掌控。`,
      worldSetting
    };
  },

  generateKernelSettings(projectTitle: string, genre: string, tone: string): any {
    const mappedCategory = genreToCategory[genre] || genre;
    const templates: Record<string, any> = {
      '仙侠武侠': {
        powerSystem: [
          { name: "传统凡人修仙境界", description: "境界划分为：炼气期、筑基期、结丹期、元婴期、化神期。每一阶分为九层，升级需要渡劫和服用相应破境丹药，灵力质变。" },
          { name: "血脉神相觉醒体系", description: "修行不炼气，而是觉醒神魔祖先血脉。境界为：觉醒境、显像境、法相境、归神境、不死至尊。法相大小决定战力上限。" },
          { name: "赛博机甲飞飞升体系", description: "将肉身与钢铁阵法融合。境界为：碳基筑基、核动力金丹、纳米元婴、量子飞升。用核聚变阵法提供无限灵力，科技修仙。" }
        ],
        goldFinger: [
          { name: "太古吞噬仙药小鼎", description: "主角体内的神秘青铜小鼎，能将任何垃圾丹药、杂质灵草提纯为百分之百药效的无杂质九转金丹，并可催熟灵药。" },
          { name: "熟练度极限肝帝面板", description: "主角能将自己掌握的所有法术、神通、炼丹术以数据熟练度面板呈现。只要练习就必然增加熟练度，且能突破上限达到化境。" },
          { name: "天道错觉模拟器", description: "能向天道发送错觉信号，让天道以为主角正在遭遇死劫或已经陨落，从而直接略过雷劫，甚至白嫖天地造化洗礼。" }
        ],
        coreConflict: [
          { name: "真仙宗门夺基之仇与家族危机", description: "起因：主角家族的灵脉被高高在上的真仙宗门看中，欲强行剥夺。冲突：主角反杀宗门使者，与该顶级宗门结下血海深仇，面临灭族危机。" },
          { name: "九幽魔劫爆发与正道伪君子围剿", description: "起因：九幽魔气泄露，主角觉醒魔神血脉。冲突：正道魁首以除魔卫道为名，欲炼化主角血脉，实则是为了掠夺其神魔本源。" },
          { name: "天道崩塌与帝路争锋", description: "起因：三百年一次的帝路重开，但这一纪元天道法则残缺，只能诞生一位大帝。冲突：诸天万界天骄与古代沉睡的至尊疯狂厮杀，争夺唯一的证道契机。" }
        ],
        factionsMap: [
          { name: "东荒三宗、西漠佛国、北海妖域", description: "天玄大陆地理庞大。东荒由三大长生仙宗统治，西漠由大雷音寺及佛国掌控信仰，北海则是无尽妖族统领。各方犬牙交错，摩擦不断。" },
          { name: "九重天界与凡界仙盟", description: "世界分为九重天。下界由修士建立的‘万仙盟’共同打理，而上三重天则是高高在上的真仙道统，俯瞰并奴役下界凡人修士。" },
          { name: "诸天万界与不朽古族", description: "三千大世界，万界争锋。古老的不朽世家占据了资源最丰厚的祖星，建立跨越星域的星际传送阵，压榨边缘弱小生命世界。" }
        ],
        sellingPoints: [
          { name: "智商碾压，绝对理性杀伐果断", description: "主角心智如妖，布局深远，不圣母不拖泥带水。爽点在于敌人以为自己占尽上风，实则一步步落入主角的连环死套中。" },
          { name: "平推暴爽，一剑破万法", description: "主角资质旷古绝今，悟性逆天，任何剑招神通一学即会、一会即精。爽点在于极致的无敌感，越级打脸，强敌皆为踏脚石。" },
          { name: "低调幕后流，马甲傀儡遍天下", description: "主角身在暗处，操控各方傀儡化身，在幕后推动世界局势。爽点在于各方大佬被主角玩弄于股掌之中，却对主角背后的神秘势力极度敬畏。" }
        ],
        outlineFull: [
          { name: "凡人逆天破命，剑指九重天", description: "起：小家族庶子觉醒废柴灵根，得太古小鼎，打脸挑衅的世子；承：加入万仙盟圣地修行，剑试群雄夺得圣子之位；转：上界真仙降临欲剥夺主角神骨，主角率凡界修士以万仙阵逆天屠仙；合：踏碎天门打入九重天，重塑修真界天道法则，为唯一剑祖。" },
          { name: "魔道君王崛起，平推正道虚伪仙宗", description: "起：被正道师门污蔑叛徒，跌落深渊转修无上神魔魔功；承：收服深渊百族，建立不朽魔庭，以横扫之势反攻正道圣地；转：发现正道魁首其实是以众生为药田的幕后真凶，主角在飞升台当众撕下其伪善面具；合：平定八荒九界，主宰诸天生死，被尊为太古魔帝。" },
          { name: "太古剑仙，一剑斩断因果枷锁", description: "起：破败剑观小道士，每日拔剑十万次觉醒至高熟练度面板；承：出山历练，一剑破去大雷音寺不坏金身，名震天下；转：天劫降临，诸天大能欲血祭百亿凡人避劫，主角怒而拔剑，一剑斩断天道枷锁；合：逍遥世间，剑化虚无，身融大道，成就无上逍遥大罗金仙。" }
        ]
      },
      '女生言情': {
        powerSystem: [
          { name: "契约闪婚与豪门圈层段位", description: "不需要打怪升级，而是豪门内部的社会段位与情感关系链。例如：契约妻子、顾氏主母、顶级财阀掌门人、时尚圈话事人。" },
          { name: "重生女配打脸搞事业进阶", description: "搞事业段位。境界为：十八线龙套、国民小花、金牌制作人、华娱娱乐女皇。伴随着财富与名声的不断翻倍。" },
          { name: "种田神医古代发家致富", description: "古代生存与医学段位。境界为：农家小寡妇、县城回春堂首席、京城御医、一品诰命夫人。灵泉空间不断升级提供神药。" }
        ],
        goldFinger: [
          { name: "读心术与豪门预警系统", description: "主角能听到男主及反派的心声，提前避开所有豪门陷阱与绿茶婊的栽赃，并在男主面前装作善良小白花。" },
          { name: "随身满级淘宝灵泉空间", description: "主角随身附带一个可产出极品美容灵泉的空间，甚至能从空间中兑换现代高科技药物和稀有材料，在古代或现代风生水起。" },
          { name: "逆天改命气运夺取光环", description: "主角只要完成搞事业或让男主心动的任务，就能夺取原书女主角的气运，并让周围的男配们好感度爆棚。" }
        ],
        coreConflict: [
          { name: "替嫁新娘与植物人老公的豪门暗战", description: "起因：主角被家族逼迫替继妹嫁给残废植物人顾爷。冲突：顾爷突然醒来，主角一方面要在顾家各房争斗中存活，一方面要与偏执敏感的顾爷斗智斗勇。" },
          { name: "恶毒女配重生虐渣搞事业", description: "起因：惨死重生，发现自己只是一本书里的恶毒女配。冲突：主角果断踹掉渣男主，自己投资电影公司，与渣男及其绿茶女主展开惨烈的商业博弈。" },
          { name: "真假千金错位人生与家族偏见", description: "起因：主角是被找回的农村真千金，父母偏爱养尊处优的假千金。冲突：面对豪门父母的嫌弃和假千金的陷害，主角掉出无数马甲反向碾压。" }
        ],
        factionsMap: [
          { name: "四大顶级世家与时尚财阀集团", description: "帝都由顾、沈、陆、墨四大世家只手遮天。此外还交织着时尚圈顶级VC资本与老牌传统实体财阀的利益纠葛。" },
          { name: "古代朝堂门阀与后宫势力", description: "朝廷之上，保皇党、外戚世家与手握兵权的王爷三方博弈。后宫之中，各妃嫔代表不同母族势力，斗争极其惨烈。" },
          { name: "华语娱乐圈三大巨头经纪公司", description: "娱乐圈由星皇娱乐、天艺传媒、盛世影业鼎足而立。艺人竞争资源，狗仔、公关团队与粉圈互相厮杀。" }
        ],
        sellingPoints: [
          { name: "极致双强，豪门智商天花板夫妻联手", description: "男女主皆是顶级聪明人，表面上互演小白花与残疾大佬，暗地里强强联手干掉所有反派。爽点在于掉马甲时的反差萌与默契配合。" },
          { name: "追妻虐渣，偏执大佬火葬场与高爽逆袭", description: "前期男主冷酷无情，主角果断搞事业并在离婚后大放异彩；后期男主卑微跪求。爽点在于主角对男主的无情拒绝与打脸反派。" },
          { name: "温馨救赎，治愈系甜宠种田流", description: "没有狗血误会，男女主双向奔赴。主角用灵泉治好男主的暗疾，男主宠妻无度。爽点在于日常发糖与平淡温馨的经商暴富节奏。" }
        ],
        outlineFull: [
          { name: "替嫁娇妻不装了，顾爷跪求别离婚", description: "起：主角替嫁给车祸瘫痪的顾爷，在豪门晚宴上被顾家二叔嘲讽，主角巧妙化解；承：主角用神医马甲暗中扎针治好顾爷双腿，并帮助顾爷重掌大权；转：误会爆发，主角误以为顾爷心中另有白月光，顾爷虐妻主角离婚搞事业成为行业女皇；合：顾爷全球追妻，跪在主角发布会后台，当众宣布此生唯她一人。" },
          { name: "闪婚顾爷的豪门驭夫手札", description: "起：为了挽救养父公司，主角答应与双腿瘫痪的顾氏总裁契约结婚；承：同居日常，帮顾爷压制体内的奇毒，展现神医手段；转：顾氏二叔勾结外敌做空顾氏，顾爷站起身掌控大局，宣布她是他的唯一；合：共同打理顾氏帝国，携手并肩立于世界之巅。" },
          { name: "恶毒女配搞事业后成了万人迷", description: "起：觉醒穿书，果断断绝与白眼狼原男主的利益；承：创建设计工作室，成为业内顶尖设计师，引来各大霸总投资；转：原男女主公司联手打压，主角在国际大赛上以完美作品反杀；合：接受一直默默守护主角的隐世墨少，成为时尚女皇。" }
        ]
      }
    };
    const defaultTemplate = {
      powerSystem: [
        { name: "太古超凡神体境界体系", description: "境界划分为：青铜、白银、黄金、传奇、半神、真神。神体觉醒度是实力的核心判定指标。" },
        { name: "万法元素魔能体系", description: "境界划分为：魔法学徒、正式法师、大魔法师、魔导士、大魔导师、法神. 通过冥想和法术阵法战斗。" },
        { name: "诸天维度超凡进化", description: "通过打破基因锁链进行维度升级。境界为：低维生命、超凡体、星宿生命、高维造物主。实力取决于掌控的宇宙维度数量。" }
      ],
      goldFinger: [
        { name: "天道垂青作弊系统", description: "主角能看到所有物品、功法、甚至是法则的进化路径，一键升级，没有上限。" },
        { name: "造化吞噬神符", description: "可以将敌人的修为、血脉、天赋彻底吞噬，并有一定几率提取对方的最高等级法则归为己用。" },
        { name: "诸天跨维度信箱", description: "主角能跨越时间与空间收到来自未来或其它高等宇宙自己写来的信，提前知晓一切布局和绝密知识。" }
      ],
      coreConflict: [
        { name: "世家联姻压迫与帝国崛起", description: "主角是没落贵族继承人，面临未婚妻退婚和周围列强世家的领地蚕食，决定推翻旧世家，建立新帝国。" },
        { name: "天道崩塌与旧神神位争夺", description: "古老的神明纷纷陨落，神格遗落人间。各大教廷和异族疯抢神格，主角被卷入神格争夺的漩涡中。" },
        { name: "气运争夺与主角猎杀者对抗", description: "世界存在其他拥有系统的掠夺者。主角在低调发育的同时，必须反向猎杀那些欲夺走自己气运的敌人。" }
      ],
      factionsMap: [
        { name: "三大帝国与万神圣殿", description: "人类的光明帝国、兽人的图腾帝国与精灵的自然圣地三足鼎立，上空悬浮着万神圣殿，统治信仰。" },
        { name: "大千道盟与深渊魔渊", description: "由无数修行宗门组成的大千道盟，与来自无尽深渊之下的魔神大军在边境长城厮杀长达万年。" },
        { name: "星海联盟与高维帝国", description: "由上百个星系文明组成的星海联盟，在宇宙边缘探索着未知星域，与掠夺性高维帝国交界。" }
      ],
      sellingPoints: [
        { name: "绝对理性，杀伐果断", description: "主角行事只看利益，绝无多余同情心。做事布局深远，环环相扣，爽点在于智商碾压和极速反杀。" },
        { name: "平推暴爽，一剑破万法", description: "主角资质逆天，一路无敌横推，任何强敌出面皆是送经验。剧情节奏极快，反转打脸酣畅淋漓。" },
        { name: "低调幕后流，马甲分身无数", description: "主角在幕后默默发展势力，操控各路傀儡与大国博弈。爽点在于揭露真相时世人的震撼与懵逼。" }
      ],
      outlineFull: [
        { name: "凡人觉醒证道封神之路", description: "起：觉醒废柴神体，获得金手指，击败挑衅的家族世子；承：加入圣殿修行，横扫同代天骄，在帝国大比中惊艳全场；转：旧神入侵，帝国防线崩溃，主角临危受命力斩邪魔；合：踏上诸神之路，重塑天道法则，封号为唯一真神。" },
        { name: "横推诸天万界的魔道君王", description: "起：被逐出宗门，转修太古禁忌魔功；承：建立无上魔庭，以无敌实力横扫各大正道圣地，收服四方大能；转：上界天尊欲炼化此界为长生药，主角率领万魔逆天屠神；合：踏碎仙界大门，主宰诸天生死，被尊为诸天魔帝。" },
        { name: "大千世界的幕后黑手演义", description: "起：小家族弃子在破败神庙低调觉醒，收服第一个手下；承：扶持傀儡，渗透帝国权力核心，暗中挑起两大帝国战争；转：隐藏大能发觉异常追查主角，主角在幕后连环设局，兵不血刃将大能坑杀；合：建立统治世界的隐世道盟，主角成为万族命运的幕后棋手。" }
      ]
    };
    const selected = templates[mappedCategory] || defaultTemplate;
    return selected;
  }
};

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
   * AI 推演网络小说核心设定 (6 大内核维度，各 3 套备选推荐)
   */
  async generateKernelSettings(projectTitle: string, genre: string, tone: string, apiKey?: string, modelName?: string): Promise<any> {
    const systemInstruction = `你是一个专业的顶级网络小说总策划和架构师。你的任务是根据给定的书名、题材和文风，把这部网络小说的内核拆解为5大核心设定维度（1.力量体系与境界 2.核心金手指 3.核心矛盾与冲突线 4.势力分布与地理 5.核心爽点与卖点）以及（6.完整故事大纲）。
对于每一个维度，你必须推演并提供恰好 3 套风格迥异、极具网文爽点与创意的备选方案。
请以 JSON 格式输出，格式如下：
{
  "powerSystem": [
    {"name": "方案A名称", "description": "方案A境界划分与体系描述"},
    {"name": "方案B名称", "description": "方案B境界划分与体系描述"},
    {"name": "方案C名称", "description": "方案C境界划分与体系描述"}
  ],
  "goldFinger": [
    {"name": "方案A名称", "description": "方案A金手指功能及代价描述"},
    {"name": "方案B名称", "description": "..."},
    {"name": "方案C名称", "description": "..."}
  ],
  "coreConflict": [
    {"name": "方案A", "description": "..."},
    {"name": "方案B", "description": "..."},
    {"name": "方案C", "description": "..."}
  ],
  "factionsMap": [
    {"name": "方案A", "description": "..."},
    {"name": "方案B", "description": "..."},
    {"name": "方案C", "description": "..."}
  ],
  "sellingPoints": [
    {"name": "方案A", "description": "..."},
    {"name": "方案B", "description": "..."},
    {"name": "方案C", "description": "..."}
  ],
  "outlineFull": [
    {"name": "方案A", "description": "...起承转合详细大纲"},
    {"name": "方案B", "description": "..."},
    {"name": "方案C", "description": "..."}
  ]
}`;
    const prompt = `小说的名字是：《${projectTitle}》
题材是：${genre}
文风是：${tone}
请根据以上信息推演出这 6 个维度的 3 套高品质备选设定方案，务必符合当前题材且具备商业网文的流行爽感。`;

    if (hasUsableKey(apiKey)) {
      const jsonStr = await callModelApi(apiKey!, modelName || 'gemini-2.5-flash', systemInstruction, prompt, true);
      return safeParseJSON(jsonStr);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    return mockEngine.generateKernelSettings(projectTitle, genre, tone);
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
    return mockEngine.chat(query, memory.contextText);
  },

  /**
   * AI 自动写小说章节正文
   */
  async autoWriteChapter(projectId: string, chapterTitle: string, apiKey?: string, modelName?: string, instruction?: string): Promise<string> {
    const memory = await searchMemory(projectId, chapterTitle);
    
    // 获取当前项目的反 AI 规则配置
    const project = await db.getProject(projectId);
    let antiAiInstructions = '';
    if (project?.antiAiStyleRules && project.antiAiStyleRules.length > 0) {
      const activeRules = DEFAULT_ANTI_AI_RULES.filter(r => project.antiAiStyleRules?.includes(r.key));
      if (activeRules.length > 0) {
        antiAiInstructions = `\n请务必严格遵守以下文风控制与反AI写作控制规则（极其重要）：\n` + 
          activeRules.map((r, i) => `${i + 1}. [${r.name}] ${r.promptInstruction}`).join('\n');
      }
    }

    const systemInstruction = `你是一个网络小说全职写手，擅长撰写情节跌宕起伏、伏笔连贯、人物塑造深刻的网络小说。
你的任务是根据提供的小说设定、相关人物卡、前文回顾等上下文，接着作者给出的正文继续往下续写。
要求：
1. 章节标题是：“${chapterTitle}”。
2. 字数在 1000 字左右，结构必须包含：起（环境烘托与引子）、承（角色互动与对话）、转（核心冲突与博弈）、合（悬念留白与下章伏笔）。
3. 必须绝对遵循人物卡的性格描述、关系背景以及“写作禁忌”。
4. 行文文风必须与小说项目的文风一致。${antiAiInstructions}
5. 仅输出章节的正文内容，不要包含任何多余的引言、前言或总结。`;

    const prompt = `【小说设定与长期记忆】:\n${memory.contextText}\n\n【本章写作指令/特殊要求】: ${instruction || '根据前文剧情自然过渡，重点刻画人物内心的试探与拉扯'}\n\n请自动生成章节“${chapterTitle}”的完整正文：`;

    if (hasUsableKey(apiKey)) {
      return await callModelApi(apiKey!, modelName || 'gemini-2.5-flash', systemInstruction, prompt, false);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
    return mockEngine.autoWriteChapter(chapterTitle, memory.contextText);
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

    if (hasUsableKey(apiKey)) {
      const jsonStr = await callModelApi(apiKey!, modelName || 'gemini-2.5-flash', systemInstruction, prompt, true);
      return safeParseJSON(jsonStr);
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
    return mockEngine.autoPlanBook(genre, tone, tags);
  },

  /**
   * AI 正文续写
   */
  async continueWriting(projectId: string, currentText: string, instruction?: string, apiKey?: string, modelName?: string): Promise<string> {
    const memory = await searchMemory(projectId, instruction || currentText);
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

    if (hasUsableKey(apiKey)) {
      return await callModelApi(apiKey!, modelName || 'gemini-2.5-flash', systemInstruction, prompt, false);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    return mockEngine.polish(currentText, instruction);
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
    return mockEngine.generateOutline(projectTitle, projectDesc, charsList, rulesList, numChapters, inferredGenre);
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

    if (hasUsableKey(apiKey)) {
      const jsonStr = await callModelApi(apiKey!, modelName || 'gemini-2.5-flash', systemInstruction, prompt, true);
      return safeParseJSON<AISummaryResult>(jsonStr);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    return mockEngine.summarize(currentText);
    }
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

const titleTemplates: Record<string, { prefixes: string[], cores: string[], suffixes: string[] }> = {
  '玄幻奇幻': {
    prefixes: ['万古', '造化', '荒天', '九极', '神魔', '太荒', '至尊', '混沌', '天尊', '吞噬'],
    cores: ['武帝', '龙皇', '圣祖', '神王', '主宰', '魔尊', '天骄', '吞噬者', '不朽', '纪元'],
    suffixes: ['传', '录', '之巅', '王座', '神话', '觉醒', '纪元']
  },
  '仙侠武侠': {
    prefixes: ['太虚', '紫霄', '长生', '一剑', '凡人', '逍遥', '大道', '问仙', '九幽', '青云'],
    cores: ['剑仙', '道君', '魔祖', '老祖', '修仙传', '因果录', '登仙路', '侠客', '神兵'],
    suffixes: ['劫', '图', '行', '诀', '志', '仙途', '九天']
  },
  '都市青春': {
    prefixes: ['神豪', '极品', '隐世', '红尘', '超级', '王牌', '天师', '重生', '开局', '都市'],
    cores: ['邪医', '狂枭', '主事', '神眼', '大亨', '继承人', '至尊', '天医', '宗师'],
    suffixes: ['崛起', '归来', '风云', '生活', '巅峰', '日常']
  },
  '历史军事': {
    prefixes: ['锦绣', '大唐', '大明', '三国', '铁血', '重回', '家国', '烽火', '乱世', '权谋', '架空'],
    cores: ['第一臣', '逍遥王', '兵王', '谋士', '天子', '督军', '猛将', '大帝', '布衣'],
    suffixes: ['江山', '天下', '霸业', '风云', '崛起', '春秋']
  },
  '科幻末世': {
    prefixes: ['星河', '赛博', '量子', '末日', '废土', '星际', '降临', '机械', '维度', '纳米'],
    cores: ['舰长', '天灾', '使徒', '霸主', '漫游者', '进化体', '收容物', '战警', 'AI'],
    suffixes: ['指南', '法则', '战纪', '防线', '警告', '回响']
  },
  '悬疑惊悚': {
    prefixes: ['迷雾', '诡异', '深渊', '规则', '怪谈', '死亡', '禁区', '民俗', '不可名状', '幽冥'],
    cores: ['调查员', '怪谈', '迷局', '死档', '梦魇', '守夜人', '收容物', '侧写师', '判官'],
    suffixes: ['见闻', '手记', '档案', '实录', '拼图', '禁书']
  },
  '游戏体育': {
    prefixes: ['全职', '网游', '神级', '电竞', '不败', '黑马', '禁忌', '巅峰', '荣耀', '致命'],
    cores: ['刺客', '法神', '操盘手', '路人王', '教练', '野王', '辅助', '打金人', '挂逼'],
    suffixes: ['之路', '传说', '时刻', '神话', '圣经', '风暴']
  },
  '轻小说': {
    prefixes: ['转生', '萌娘', '契约', '悠闲', '日常', '幻想', '勇者', '魔王', '吐槽'],
    cores: ['大冒险', '生活', '小店', '眷族', '美少女', '召唤物', '守护灵', '店长', '社畜'],
    suffixes: ['物语', '日常', '纪事', '幻想乡', '协奏曲', '生存指南']
  },
  '女生言情': {
    prefixes: ['豪门', '重回', '娇妻', '隐婚', '顶流', '暖婚', '余生', '星光', '璀璨', '独家'],
    cores: ['千金', '白月光', '掌心宠', '继承人', '小祖宗', '影后', '大佬', '初恋'],
    suffixes: ['手札', '情书', '余生', '私有物', '进行时', '回响']
  },
  '电子竞技': {
    prefixes: ['英雄联盟：', 'LOL：', '退役后：', '决赛前夕：', '夺冠那年：', '联盟：'],
    cores: ['绝地反击', '带飞全场', '传奇教头', '天才中单', '世界第一', '大魔王'],
    suffixes: ['重铸荣光', '王朝诞生', '手速拉满', '冠军之心', '封神时刻']
  },
  '规则怪谈': {
    prefixes: ['怪谈降临：', '规则怪谈：', '违反守则：', '逃离怪谈：'],
    cores: ['我有十倍理智', '我的提示有亿点多', '诡异求生', '扮演诡异'],
    suffixes: ['苟到最后', '全员通关', 'SSS级评价']
  },
  '商战职场': {
    prefixes: ['商海浮沉：', '金融巨头：', '投资大佬：', '风投狂飙：'],
    cores: ['财富自由', '空手套白狼', '垄断巨头', '行业破局者', '操盘手'],
    suffixes: ['神级投资', '暴富人生', '逆势翻盘']
  },
  '娱乐明星': {
    prefixes: ['娱乐：', '华娱：', '文娱帝国：', '导演：', '歌神：'],
    cores: ['从配角开始', '金牌制作人', '艺术大师', '文艺复兴', '顶流崛起'],
    suffixes: ['震撼世界', '巨星闪耀', '票房神话']
  },
  '种田经商': {
    prefixes: ['种田经商：', '农门悍妇：', '带个系统去种田：', '农家发家致富：'],
    cores: ['农家小娘子', '良田万顷', '小媳妇翻身', '经商大佬', '富甲一方'],
    suffixes: ['红火日子', '富贵逼人', '细水长流']
  }
};

const worldSettings: Record<string, string> = {
  '电子竞技': "这是一个电子竞技成为全球第一运动的黄金时代。各大电竞豪门俱乐部在联赛中争夺象征至高荣誉的召唤师奖杯。战队战术、个人手速、赛前博弈以及团队默契被推到了极致。主角以退役老将或新星天才的身份，誓要重回巅峰。",
  '规则怪谈': "规则怪谈污染全球，世界各地随时会降临无法逃脱的‘怪谈空间’。每一个怪谈空间都有其绝对必须遵守的‘求生守则’，哪怕错一步都是深渊。只有保持绝对理智、洞察规则漏洞的人，才能在这场全民诡异求生中活到最后。",
  '商战职场': "这是一个波诡云谲的现代金融与实体产业博弈帝国。巨头垄断、风投博弈、做空爆仓与行业重组随时在发生。主角在商界最底层起步，凭借过人的市场直觉与狠辣的操盘手腕，在这个由资本堆砌的修罗场中步步为营，登顶首富。",
  '娱乐明星': "这是一个文娱产业极其繁荣、群星璀璨的平行世界。娱乐圈充满明争暗斗、剧组博弈、番位之争和资源拉扯。主角凭借对前世经典文娱作品的记忆与独特的艺术造诣，在导演、编剧或歌手领域掀起华娱狂澜，打造自己的全球文娱帝国。",
  '种田经商': "这是一个充满泥土芬芳与市井烟火的古代种田时空。主角白手起家，从荒野一亩良田开始，通过改良农作物、开办商铺酒楼、设计现代商品，逐步在古代社会建立起庞大的商业版图，带领全村发家致富，过上红火富贵的生活。",
  '仙侠武侠': "这是一个灵气日渐稀薄、天道崩盘的末法修真界。境界划分为：炼气、筑基、结丹、元婴、化神、炼虚。修真资源被古老的宗门与世家彻底垄断，天道规则冷酷，布满因果锁链，修士们逆天求活，明争暗斗。",
  '科幻末世': "这是一个跨越星系的未来科幻时代，包含纳米义体植入、量子光脑与折叠空间技术。然而宇宙深处存在暗物质天灾，高维异兽蠢蠢欲动，星际联邦与反叛军在星门防线上长期对峙，文明正面临终极进化或灭亡的节点。",
  '悬疑惊悚': "这是一个笼罩在不可名状恐惧与怪诞规则下的诡秘世界。‘理智度’与‘异常解析率’是核心指标，不可直视深渊，普通人触碰未知禁忌将瞬间异化。世界上存在神秘的收容组织，在黑暗中默默守护脆弱的现实。",
  '都市青春': "这是一个隐世超凡力量与繁华现代都市并存的世界。力量划分为：觉醒者、掌控者、领域级、极道。存在着神秘的‘超能监察局’来维护世俗秩序，严禁任何人在凡人面前展现超自然能力，然而暗流已经汹涌。",
  '历史军事': "这是一段波澜壮阔、铁血权谋的乱世历史时空。列国割据，生灵涂炭。除了冷兵器的沙场交锋外，这世间还隐秘流传着诸子百家的绝学与古代遗落的奇门遁甲，限制极其严格，英雄好汉在此谱写着江山霸业的壮丽史诗。",
  '游戏体育': "以跨时代全息网游《神魔》或全球顶尖电竞/体育职业联赛为背景。世界被数字化，包含严密的职业技能、装备评分、等级体系与战术博弈。主角将作为顶级选手/NPC，在这个被数据与激情统治的领域中创造神话。",
  '轻小说': "这是一个轻松幽默、反套路的轻小说幻想世界。既有剑与魔法、勇者与魔王的奇妙对决，也有街角小店、校园日常的温馨发糖。吐槽与玩梗是这个世界的底色，充满个性鲜明的美少女、守护灵和轻松愉快的日常冒险。",
  '女生言情': "这是一个充满情感交织、门阀暗斗的世界。社会名流、豪门门阀或古代王侯掌握着绝对的话语权。世界线受制于商业联姻、嫡庶之争与权力制衡的隐秘规则。爱恨情仇在此上演，每个人都在命运的漩涡中挣扎求生。",
  '玄幻奇幻': "这是一个辽阔宏大、万族林立的奇幻大千世界。强者飞天遁地，弱者如蝼蚁。力量体系以血脉觉醒和天地奥术为主，划分为：青铜、白银、黄金、传奇、半神、真神。古老的神灵高悬星空，俯瞰着尘世帝国的攻伐更迭。"
};