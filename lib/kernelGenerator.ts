import { hasUsableKey } from './agent/config';
import { callModelApi } from './modelApi';
import { safeParseJSON } from './safeParseJSON';
import { settingLengthHint } from './constants';

/**
 * AI 推演网络小说核心设定 (10 大维度，各 1 套方案直接落库)
 * 串行执行：每个维度推演时携带前面所有已完成的设定，确保设定统一
 * 推演顺序：世界观 -> 力量体系 -> 功法体系 -> 金手指 -> 核心冲突 -> 爽点卖点 -> 地理地图 -> 势力阵营 -> 货币体系 -> 关键物品
 * onProgress 回调在每完成一个维度时触发，参数为 (dimKey, dimLabel, index, total, dimOptions)
 */
export async function generateKernelSettings(
  projectTitle: string, genre: string, tone: string,
  apiKey?: string, modelName?: string,
  onProgress?: (dimKey: string, dimLabel: string, index: number, total: number, dimOptions?: Array<{ name: string; description: string }>) => void,
  _concurrency?: number, // 保留参数兼容性，但不再使用并发
  forbiddenSetting?: string // 禁止出现的设定/桥段
): Promise<any> {
  // 推演顺序：从基础到衍生，确保每个维度都能参考前面所有已完成的设定
  const dimensions = [
    { key: 'worldSetting', label: '世界观设定', desc: '小说主舞台的大陆疆域、宏观规则、历史背景与社会法则' },
    { key: 'powerSystem', label: '力量体系', desc: '修炼境界、超自然等级与晋升逻辑' },
    { key: 'skillSystem', label: '功法体系', desc: '核心功法、武技、法术的分类与层级' },
    { key: 'goldFinger', label: '金手指', desc: '主角的特殊外挂、系统、随身宝物或独占机缘' },
    { key: 'coreConflict', label: '核心冲突', desc: '推动主线发展的主要矛盾，主角面临的终极敌对势力或危机' },
    { key: 'sellingPoints', label: '爽点卖点', desc: '网文吸引读者的商业爽点，如打脸、越级挑战、幕后黑手等节奏设计' },
    { key: 'location', label: '地理地图', desc: '核心地域、重要场景与地理格局' },
    { key: 'faction', label: '势力阵营', desc: '主要势力、宗门、组织及其关系' },
    { key: 'currency', label: '货币体系', desc: '世界中的交易媒介、资源体系与价值尺度' },
    { key: 'item', label: '关键物品', desc: '推动剧情的重要道具、神器、宝物' },
  ];

  if (!hasUsableKey(apiKey)) {
    throw new Error("请先配置 API Key 后再使用 AI 功能");
  }

  // 已完成的设定，用于构建上下文
  const completedSettings: Record<string, { label: string; content: string }> = {};
  const finalResult: Record<string, any> = {};

  // 串行执行每个维度
  for (let i = 0; i < dimensions.length; i++) {
    const dim = dimensions[i];

    // 构建已有设定上下文
    const existingContext = Object.entries(completedSettings).length > 0
      ? '\n\n【已确定的设定】（必须与这些设定保持一致和呼应）：\n' +
        Object.entries(completedSettings)
          .map(([, v]) => `- ${v.label}：${v.content}`)
          .join('\n')
      : '';

    // 构建禁止设定约束
    const forbiddenBlock = forbiddenSetting?.trim()
      ? `\n5. 严禁出现以下设定、桥段或情节（极其重要，绝对不能违背）：\n${forbiddenSetting.trim()}`
      : '';

    const systemInstruction = `你是一个专业的顶级网络小说总策划和架构师。你的任务是根据给定的书名、题材和文风，为小说的「${dim.label}」维度推演一套最契合、最具网文爽点与创意的方案，直接作为最终设定落库。

维度说明：${dim.desc}

要求：
1. description 必须在 ${settingLengthHint(dim.key)} 字之间，内容详实、有画面感、有具体细节，不能泛泛而谈。
2. 方案必须精准匹配「${genre}」题材和「${tone}」文风。
3. 必须与已确定的其他维度设定保持高度一致，不能矛盾，要互相呼应和补充。${forbiddenBlock}

请以纯 JSON 格式输出（不要 markdown 标记），结构如下：
{
  "options": [
    {"name": "方案名称（10字以内）", "description": "详细描述，${settingLengthHint(dim.key)}字"}
  ]
}`;

    const prompt = `小说的名字是：《${projectTitle}》
题材是：${genre}
文风是：${tone}${existingContext}

请为「${dim.label}」维度推演一套高品质方案，直接作为最终设定。注意：方案必须与已有设定保持一致和统一。`;

    try {
      const jsonStr = await callModelApi(apiKey!, modelName || 'gemini-2.5-flash', systemInstruction, prompt, true);
      const parsed = safeParseJSON<{ options: Array<{ name: string; description: string }> }>(jsonStr, { options: [] });
      const options = parsed.options || [];
      finalResult[dim.key] = options;

      // 取第一个方案作为已确定的设定，供后续维度参考
      if (options.length > 0 && options[0].description) {
        completedSettings[dim.key] = { label: dim.label, content: options[0].description };
      }

      // 通知进度
      if (onProgress) {
        onProgress(dim.key, dim.label, i + 1, dimensions.length, options);
      }
    } catch (err) {
      console.error(`Failed to generate dimension ${dim.key}:`, err);
      finalResult[dim.key] = [];
    }
  }

  return finalResult;
}
