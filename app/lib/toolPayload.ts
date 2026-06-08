// 工具调用载荷统一标准化层。
// 各工具的入参字段名五花八门（content / value / bio / description / numChapters / chapterId ...），
// 前端不应该再针对每个工具单独推断"哪个字段是内容"、"哪个是名号"——
// 全部在 route.ts / 前端 fallback 路径中过本层，输出统一结构。
//
// 归一化输出：
//   purpose         精准用途文案（"更新书名"、"生成整本大纲（共 10 章）" 等）
//   verb            行为动词（write / update / delete），无意义时 null
//   writtenLength   本次工具调用"变化了多少字"，拿不到时 null
//   nameField       工具 schema 里的"主名号"字段名（name / title / ...）
//   nameText        主名号字段的实际值（去引号 / 截断到 32 字）
//   contentField    工具 schema 里的"主要内容"字段名（content / value / bio / ...）
//   contentText     主要内容字段的实际值（去引号 / 截断到 80 字）
//   contentLength   主要内容字段字符数（与 writtenLength 同源，但精确）
//   filteredInput   过滤掉内部字段（projectId / id / type / numChapters ...）后的入参对象
//   resultText      从 langchain ToolMessage 内部提取出的纯文本 result
//
// 渲染端只需读 purpose / writtenLength / filteredInput / resultText 即可，不再调 inferrer / extract。

import { coerceToolInput, extractToolMessageContent } from './toolInputShape';
import { getActionVerb, getWrittenLength } from './toolSummary';
import { getToolPurpose } from './toolPurpose';

export type ToolVerb = 'write' | 'update' | 'delete' | null;

export interface ToolPayload {
  purpose: string;
  verb: ToolVerb;
  writtenLength: number | null;
  nameField: string | null;
  nameText: string | null;
  contentField: string | null;
  contentText: string | null;
  contentLength: number | null;
  filteredInput: Record<string, unknown> | null;
  resultText: string;
}

// 内部字段（langchain / 工具调用链路上自动注入，对用户无意义）
const INTERNAL_INPUT_KEYS = new Set([
  'projectId', 'volumeId', 'characterId', 'chapterId', 'id', 'type',
  'numChapters', 'field', 'category', 'role', 'label',
]);

// 名号字段候选（按出现概率排序）
const NAME_FIELD_CANDIDATES = ['name', 'title', 'label', 'characterName', 'entryName'];

// 内容字段候选（按出现概率排序）
const CONTENT_FIELD_CANDIDATES = [
  'content', 'value', 'text', 'body', 'summary', 'synopsis',
  'description', 'bio', 'backstory', 'background',
  'data', 'task', 'message', 'prompt',
];

/** 在对象中找第一个匹配的字段名 + 值（按候选顺序） */
function pickField(obj: Record<string, unknown>, candidates: string[]): { key: string | null; value: unknown } {
  for (const k of candidates) {
    if (k in obj && obj[k] !== undefined && obj[k] !== null) {
      return { key: k, value: obj[k] };
    }
  }
  return { key: null, value: null };
}

/** 安全截断 + 去引号（用于在卡片里显示"主要内容"摘要） */
function previewText(v: unknown, maxLen = 80): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') {
    return v.length > maxLen ? v.slice(0, maxLen) + '…' : v;
  }
  if (typeof v === 'object') {
    try {
      const s = JSON.stringify(v);
      return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
    } catch {
      return null;
    }
  }
  return String(v);
}

/** 过滤内部字段，保留对用户有意义的入参 */
function filterInternal(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (INTERNAL_INPUT_KEYS.has(k)) continue;
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

/** 把任意形态的 tool result 归一成字符串：
 *  - 字符串：原样返回
 *  - ToolMessage（{ content } / { kwargs: { content } }）：提 content
 *  - 数组：递归取首个非空元素
 *  - 其它对象：JSON.stringify（仍要避免 [object Object]）
 *  - null / undefined：返回空串
 * 与 route.ts 的 extractToolOutputContent 等价，这里再独立实现一次以
 * 让 normalizeToolPayload 自给自足（defense in depth）。
 */
function coerceToolResult(raw: unknown): string {
  if (raw === undefined || raw === null) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw !== 'object') return String(raw);
  const obj = raw as Record<string, unknown>;
  // ToolMessage.content
  if (typeof obj.content === 'string') return obj.content;
  // ToolMessage.kwargs.content（langchain 序列化链路）
  if (obj.kwargs && typeof obj.kwargs === 'object') {
    const kc = (obj.kwargs as Record<string, unknown>).content;
    if (typeof kc === 'string') return kc;
  }
  // 数组（部分链路是 [ToolMessage]）
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const c = coerceToolResult(item);
      if (c) return c;
    }
    return '';
  }
  // 兜底：JSON 化，仍避免 [object Object]
  try {
    return JSON.stringify(raw);
  } catch {
    return '';
  }
}

/**
 * 把任意 tool 调用 / 结果归一化为 ToolPayload。
 * 这是渲染端与 SSE / DB 的"契约字段"——所有展示都从这里读，不再各自推断。
 */
export function normalizeToolPayload(
  toolName: string | undefined | null,
  rawInput: unknown,
  rawOutput: unknown,
): ToolPayload {
  const normInput = coerceToolInput(rawInput);
  const inputObj = (normInput && typeof normInput === 'object')
    ? normInput as Record<string, unknown>
    : {};
  // rawOutput 可能是字符串 / ToolMessage 对象 / 其它任意值 —— 全部安全归一
  // 成"纯文本"再走 extractToolMessageContent，保证 resultText 永远不出现
  // "[object Object]" 这种 langchain 内部 JSON dump。
  const resultText = extractToolMessageContent(coerceToolResult(rawOutput));
  // result 转 string 用于传给 getWrittenLength
  const resultStr = resultText || (typeof rawOutput === 'string' ? rawOutput : '');

  const verb: ToolVerb = getActionVerb(toolName);
  const purpose = getToolPurpose(toolName ?? undefined, normInput);
  const safeToolName = toolName ?? '';
  const writtenLength = getWrittenLength(safeToolName, normInput, resultStr);
  const namePick = pickField(inputObj, NAME_FIELD_CANDIDATES);
  const contentPick = pickField(inputObj, CONTENT_FIELD_CANDIDATES);

  return {
    purpose,
    verb,
    writtenLength,
    nameField: namePick.key,
    nameText: namePick.key ? previewText(namePick.value, 32) : null,
    contentField: contentPick.key,
    contentText: contentPick.key ? previewText(contentPick.value, 80) : null,
    contentLength: typeof contentPick.value === 'string' ? contentPick.value.length : null,
    filteredInput: filterInternal(inputObj),
    resultText,
  };
}
