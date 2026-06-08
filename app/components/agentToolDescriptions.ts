// 工具名 → 一句话中文说明。前端在工具调用卡片顶部展示，让用户知道 Agent 准备调用什么、做什么。
// 说明文字尽量控制在 30 字以内，聚焦"用途"，避免重复后端 tool description 中的细节。
const DESCRIPTIONS: Record<string, string> = {
  // 共享
  query_memory: '检索前文记忆内容',
  get_project_overview: '拉取项目当前完整概览',
  request_user_style: '请你选择题材与文风',

  // 编导
  generate_outline: '生成后续章节大纲',
  auto_plan_book: '一键规划全书核心设定',
  generate_kernel: '推演 10 大维度内核设定',
  update_project_field: '更新项目全局设定字段',
  add_anti_ai_rule: '添加反 AI 写作规则',
  get_outline_structure: '查看当前分卷-章节结构',
  add_volume: '在大纲中新增分卷',
  delete_volume: '删除分卷（含其下章节）',
  update_volume: '修改分卷标题或概要',
  add_chapter: '在分卷中新增章节',
  delete_chapter: '删除指定章节',
  update_chapter: '修改章节标题或概要',
  move_outline_item: '移动大纲条目顺序',

  // 设定专家
  create_character: '新建角色卡',
  create_world_rule: '新建具体世界观设定',
  generate_inspirations: '生成角色与设定灵感',

  // 写作专家
  create_chapter: '新建空章节',
  auto_write_chapter: '自动生成章节正文并保存',
  summarize_chapter: '提取摘要并写入长期记忆',

  // 编辑专家
  polish_text: '对文本进行润色修改',
  check_consistency: '对正文做逻辑自检',
};

export function getToolDescription(toolName?: string): string {
  if (!toolName) return '执行专家工具';
  return DESCRIPTIONS[toolName] || `调用 ${toolName}`;
}
