// 工具调用"用途"精准推断：根据工具名 + 调用参数推断该次调用的具体意图，
// 避免在 tool_call 卡片顶部笼统显示"更新项目全局设定字段"这种通用文案。
// 推断失败时 fallback 到通用工具描述（agentToolDescriptions.ts）。

import { getToolDescription } from '../components/agentToolDescriptions';
import { coerceToolInput } from './toolInputShape';

// ─── 项目全局核心设定字段 → 中文名 ───
const PROJECT_FIELD_LABELS: Record<string, string> = {
  title: '书名',
  description: '作品简介',
  styleSetting: '文风题材',
  worldSetting: '世界设定',
  powerSystem: '力量体系',
  skillSystem: '技能体系',
  goldFinger: '金手指',
  coreConflict: '核心冲突',
  factionsMap: '势力地图',
  sellingPoints: '卖点',
  forbiddenSetting: '写作禁忌',
};

// 章节 id（如 ch_001 / chapter-3 / 3） → "第 N 章"
function formatChapterRef(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const s = String(raw);
  const m = s.match(/(\d+)/);
  if (!m) return s; // 拿不到数字就原样返回
  return `第 ${Number(m[1])} 章`;
}

// 角色 id → "角色：{nameOrId}"
function formatCharacterRef(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return null;
  return `角色 ${String(raw)}`;
}

// 项目全局设定字段 → 字段中文名
function formatProjectFieldRef(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const s = String(raw);
  return PROJECT_FIELD_LABELS[s] ? `${PROJECT_FIELD_LABELS[s]}` : s;
}

// 工具专用的精准用途推断器；返回 null 表示该工具未做精准推断，
// 应回退到通用 getToolDescription。
type PurposeInfer = (input: unknown) => string | null;

const PURPOSE_INFERRERS: Record<string, PurposeInfer> = {
  // ── 编导/策划/世界观师：项目字段读写 ──
  update_project_field: (input) => {
    const obj = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
    const field = formatProjectFieldRef(obj.field);
    if (!field) return '更新项目全局设定字段';
    return `更新${field}`;
  },
  get_project_field: (input) => {
    const obj = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
    const field = formatProjectFieldRef(obj.field);
    if (!field) return getToolDescription('get_project_field');
    return `查看${field}`;
  },

  // ── 章节级操作 ──
  save_chapter: (input) => {
    const obj = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
    const ch = formatChapterRef(obj.chapterId ?? obj.chapter ?? obj.input);
    return ch ? `保存${ch}正文` : '保存章节正文';
  },
  update_chapter: (input) => {
    const obj = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
    const ch = formatChapterRef(obj.chapterId ?? obj.chapter ?? obj.input);
    return ch ? `更新${ch}正文` : '更新章节正文';
  },
  get_chapter: (input) => {
    const obj = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
    const ch = formatChapterRef(obj.chapterId ?? obj.chapter ?? obj.input);
    return ch ? `查看${ch}内容` : '查看章节内容';
  },
  save_outline: (input) => {
    const obj = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
    const ch = formatChapterRef(obj.chapterId ?? obj.chapter ?? obj.input);
    return ch ? `保存${ch}大纲` : '保存大纲';
  },
  update_outline: (input) => {
    const obj = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
    const ch = formatChapterRef(obj.chapterId ?? obj.chapter ?? obj.input);
    return ch ? `更新${ch}大纲` : '更新大纲';
  },
  generate_outline: (input) => {
    const obj = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
    const ch = formatChapterRef(obj.chapterId ?? obj.chapter ?? obj.input);
    return ch ? `生成${ch}大纲` : '生成大纲';
  },

  // ── 角色 ──
  create_character: (input) => {
    const obj = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
    const name = obj.name || obj.characterName;
    return name ? `创建角色：${name}` : '创建角色';
  },
  update_character: (input) => {
    const obj = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
    const ref = formatCharacterRef(obj.characterId ?? obj.id) ?? (obj.name as string | undefined);
    return ref ? `更新${typeof ref === 'string' && ref.startsWith('角色') ? ref.replace('角色 ', '角色：') : `角色 ${ref}`}` : '更新角色';
  },

  // ── 世界观/条目 ──
  add_world_entry: (input) => {
    const obj = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
    const cat = obj.category as string | undefined;
    const labelMap: Record<string, string> = {
      faction: '势力', location: '地点', item: '物品', lore: '传说',
    };
    return cat ? `新增${labelMap[cat] || '世界'}条目` : '新增世界条目';
  },
  update_world_entry: (input) => {
    const obj = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
    const cat = obj.category as string | undefined;
    const labelMap: Record<string, string> = {
      faction: '势力', location: '地点', item: '物品', lore: '传说',
    };
    return cat ? `更新${labelMap[cat] || '世界'}条目` : '更新世界条目';
  },

  // ── 连续性官 ──
  update_rolling_synopsis: () => '更新滚动剧情概要',
  update_world_state: () => '同步世界状态台账',
  get_chapter_constraints: (input) => {
    const obj = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
    const ch = formatChapterRef(obj.chapterId ?? obj.chapter);
    return ch ? `生成${ch}写作约束` : '生成写作约束';
  },
};

/**
 * 根据工具名 + 调用参数推断"用途"文案。
 * 推断失败时 fallback 到通用工具描述。
 * 在调 inferrer 前先把 toolInput 标准化（langchain 可能传 { input: '<json>' } 包装）。
 */
export function getToolPurpose(toolName: string | undefined, toolInput: unknown): string {
  if (!toolName) return '执行专家工具';
  const inferrer = PURPOSE_INFERRERS[toolName];
  if (inferrer) {
    const result: string | null = inferrer(coerceToolInput(toolInput));
    if (result) return result;
  }
  return getToolDescription(toolName);
}
