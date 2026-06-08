// 工具执行摘要：根据 toolName + toolInput + toolResult 推断"这次调用到底写入了多少字"。
// 在配对卡折叠态显示变化量（已写入 / 已更新 / 已删除 N 字），避免展开后才看到结果预览。
// 设计目标：保守——能精确算就给精确值；算不出就返回 null（不强行估算）。

import { coerceToolInput, extractToolMessageContent } from './toolInputShape';

export type ActionVerb = 'write' | 'update' | 'delete';

/**
 * 工具 → 行为动词。
 * 写入类（create / save / generate）→ write
 * 原地修改类（update_*）→ update
 * 移除类（delete_*）→ delete
 * 不在表里的工具不在折叠态显示摘要
 */
const TOOL_VERB: Record<string, ActionVerb> = {
  save_chapter: 'write',
  save_outline: 'write',
  generate_outline: 'write',
  create_character: 'write',
  add_world_entry: 'write',
  update_project_field: 'update',
  update_chapter: 'update',
  update_outline: 'update',
  update_character: 'update',
  update_world_entry: 'update',
  update_rolling_synopsis: 'update',
  update_world_state: 'update',
  delete_character: 'delete',
  delete_world_entry: 'delete',
  delete_chapter: 'delete',
};

/** 写入字段候选（按出现概率排序） */
const WRITE_FIELDS = [
  'content',
  'text',
  'value',
  'body',
  'summary',
  'synopsis',
  'description',
  'bio',
  'backstory',
  'background',
  'data',
] as const;

/** 创建/保存对象的"名号"字段（不计入内容长度，只用来辅助推断是否真有内容） */
const NAME_LIKE_FIELDS = new Set(['name', 'title', 'label', 'characterName', 'category']);

/** 工具调用注入的内部字段（不参与"写入内容长度"统计） */
const INTERNAL_FIELDS = new Set([
  'projectId',
  'characterId',
  'chapterId',
  'volumeId',
  'id',
  'type',
  'name',
  'title',
  'label',
  'category',
  'numChapters',
  'field',
]);

/** 工具返回文本里"已写入/保存/更新/创建/删除 N 字"的正则 */
const RESULT_LENGTH_PATTERN = /已(?:保存|写入|更新|创建|生成|同步|删除|移除|去掉)[^\d]{0,8}(\d+)\s*字/;

/**
 * 取工具对应的行为动词；查询/拉取类工具返回 null。
 */
export function getActionVerb(toolName: string | undefined | null): ActionVerb | null {
  if (!toolName) return null;
  return TOOL_VERB[toolName] ?? null;
}

/**
 * 从 toolInput 中提取"主要写入内容"的字符数。
 * - 优先按候选字段顺序取 string（content / text / value / bio ...）
 * - 找不到候选字段时，把"非内部、非名号"的 string 字段长度累加（兜底通用 schema）
 * - 对非字符串字段做 JSON.stringify 后取长度
 * - 拿不到任何长度时返回 null
 */
function lengthFromInput(toolInput: unknown): number | null {
  if (!toolInput || typeof toolInput !== 'object') return null;
  const obj = toolInput as Record<string, unknown>;
  // 1) 候选字段优先
  for (const f of WRITE_FIELDS) {
    const v = obj[f];
    if (typeof v === 'string' && v.length > 0) return v.length;
  }
  // 2) 兜底：把"非内部、非名号字段"的 string / 非 string 字段都串起来算总长
  let total = 0;
  let hasContent = false;
  for (const [k, v] of Object.entries(obj)) {
    if (INTERNAL_FIELDS.has(k)) continue;
    if (NAME_LIKE_FIELDS.has(k)) continue;
    if (v === undefined || v === null) continue;
    if (typeof v === 'string') {
      if (v.length > 0) {
        total += v.length;
        hasContent = true;
      }
    } else {
      try {
        const s = JSON.stringify(v);
        if (s && s !== 'null') {
          total += s.length;
          hasContent = true;
        }
      } catch {
        // 忽略循环引用等异常
      }
    }
  }
  return hasContent ? total : null;
}

/**
 * 从 toolResult 文本里匹配"已保存/写入/更新/删除 N 字"等成功反馈。
 * 走兜底：万一 input 没拿到字数，但工具后端回了"已保存 N 字"，仍能展示。
 */
function lengthFromResult(toolResult: string | undefined | null): number | null {
  if (!toolResult) return null;
  const m = RESULT_LENGTH_PATTERN.exec(toolResult);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * 计算本次工具调用"变化了多少字"。
 * 返回 null 表示无法推断（不显示摘要），避免误导用户。
 * 对 write / update 来说"变化量"=写入或替换的内容长度；
 * 对 delete 来说"变化量"=从结果中匹配到的"已删除 N 字"。
 * 内部对 toolInput 先 coerce、toolResult 先提取 content（langchain 包装兼容）。
 */
export function getWrittenLength(
  toolName: string | undefined | null,
  toolInput: unknown,
  toolResult: string | undefined | null,
): number | null {
  const verb = getActionVerb(toolName);
  if (!verb) return null;
  const normInput = coerceToolInput(toolInput);
  const normResult = extractToolMessageContent(toolResult ?? null);
  if (verb === 'delete') {
    // 删除类主要从 result 拿字数；input 拿不到"原本多少字"故不参与
    return lengthFromResult(normResult);
  }
  return lengthFromInput(normInput) ?? lengthFromResult(normResult);
}

/**
 * 格式化"已写入/更新/删除 N 字"的展示文本。
 * - 传入 null → 返回 null（不展示）
 * - verb 缺省按 write 兜底（兼容历史调用方）
 */
export function formatWrittenLength(
  len: number | null,
  verb: ActionVerb | null = 'write',
): string | null {
  if (len === null) return null;
  // verb 缺省或 null 都按 write 兜底
  const v: ActionVerb = verb ?? 'write';
  const labelMap: Record<ActionVerb, string> = {
    write: '已写入',
    update: '已更新',
    delete: '已删除',
  };
  return `${labelMap[v]} ${len} 字`;
}
