// 工具调用"用途"推断器单元测试
// 运行：npx tsx scripts/test_tool_purpose.ts
import { getToolPurpose } from '../app/lib/toolPurpose';

function assertEqual(actual: string, expected: string, label: string) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}`);
    console.error(`  expected: ${expected}`);
    console.error(`  actual:   ${actual}`);
    process.exit(1);
  }
  console.log(`PASS: ${label}`);
}

function runTests() {
  console.log('开始执行 getToolPurpose 单元测试...\n');

  // ─── update_project_field ───
  assertEqual(
    getToolPurpose('update_project_field', { projectId: 'p', field: 'title', value: '我在异世界当贤者' }),
    '更新书名',
    'update_project_field title → 更新书名',
  );
  assertEqual(
    getToolPurpose('update_project_field', { projectId: 'p', field: 'description', value: '...' }),
    '更新作品简介',
    'update_project_field description → 更新作品简介',
  );
  assertEqual(
    getToolPurpose('update_project_field', { field: 'worldSetting' }),
    '更新世界设定',
    'update_project_field worldSetting → 更新世界设定',
  );
  assertEqual(
    getToolPurpose('update_project_field', { field: 'powerSystem' }),
    '更新力量体系',
    'update_project_field powerSystem → 更新力量体系',
  );
  assertEqual(
    getToolPurpose('update_project_field', { field: 'factionsMap' }),
    '更新势力地图',
    'update_project_field factionsMap → 更新势力地图',
  );
  assertEqual(
    getToolPurpose('update_project_field', { field: 'coreConflict' }),
    '更新核心冲突',
    'update_project_field coreConflict → 更新核心冲突',
  );
  assertEqual(
    getToolPurpose('update_project_field', { field: 'goldFinger' }),
    '更新金手指',
    'update_project_field goldFinger → 更新金手指',
  );
  assertEqual(
    getToolPurpose('update_project_field', { field: 'sellingPoints' }),
    '更新卖点',
    'update_project_field sellingPoints → 更新卖点',
  );
  assertEqual(
    getToolPurpose('update_project_field', { field: 'unknownField' }),
    '更新unknownField',
    'update_project_field 未知字段 → 原样显示',
  );
  assertEqual(
    getToolPurpose('update_project_field', {}),
    '更新项目全局设定字段',
    'update_project_field 缺 field → 通用兜底',
  );

  // ─── get_project_field ───
  assertEqual(
    getToolPurpose('get_project_field', { field: 'title' }),
    '查看书名',
    'get_project_field title → 查看书名',
  );
  assertEqual(
    getToolPurpose('get_project_field', { field: 'worldSetting' }),
    '查看世界设定',
    'get_project_field worldSetting → 查看世界设定',
  );

  // ─── 章节类操作 ───
  assertEqual(
    getToolPurpose('save_chapter', { chapterId: 'ch_003', content: '...' }),
    '保存第 3 章正文',
    'save_chapter ch_003 → 保存第 3 章正文',
  );
  assertEqual(
    getToolPurpose('save_chapter', { chapter: 'chapter-5' }),
    '保存第 5 章正文',
    'save_chapter chapter-5 → 保存第 5 章正文',
  );
  assertEqual(
    getToolPurpose('save_chapter', { chapterId: '7' }),
    '保存第 7 章正文',
    'save_chapter 纯数字 id → 保存第 7 章正文',
  );
  assertEqual(
    getToolPurpose('update_chapter', { chapterId: 'ch_002' }),
    '更新第 2 章正文',
    'update_chapter ch_002 → 更新第 2 章正文',
  );
  assertEqual(
    getToolPurpose('get_chapter', { chapterId: 'ch_010' }),
    '查看第 10 章内容',
    'get_chapter ch_010 → 查看第 10 章内容',
  );
  assertEqual(
    getToolPurpose('save_chapter', {}),
    '保存章节正文',
    'save_chapter 无 chapterId → 保存章节正文',
  );

  // ─── 大纲 ───
  assertEqual(
    getToolPurpose('save_outline', { chapterId: 'ch_004' }),
    '保存第 4 章大纲',
    'save_outline ch_004 → 保存第 4 章大纲',
  );
  assertEqual(
    getToolPurpose('update_outline', { chapterId: 'ch_001' }),
    '更新第 1 章大纲',
    'update_outline ch_001 → 更新第 1 章大纲',
  );
  assertEqual(
    getToolPurpose('generate_outline', { chapterId: 'ch_006' }),
    '生成第 6 章大纲',
    'generate_outline ch_006 → 生成第 6 章大纲',
  );
  assertEqual(
    getToolPurpose('save_outline', {}),
    '保存大纲',
    'save_outline 无 chapterId → 保存大纲',
  );

  // ─── 角色 ───
  assertEqual(
    getToolPurpose('create_character', { name: '林远' }),
    '创建角色：林远',
    'create_character name=林远 → 创建角色：林远',
  );
  assertEqual(
    getToolPurpose('create_character', { characterName: '苏晚' }),
    '创建角色：苏晚',
    'create_character characterName=苏晚 → 创建角色：苏晚',
  );
  assertEqual(
    getToolPurpose('create_character', {}),
    '创建角色',
    'create_character 无 name → 创建角色',
  );
  assertEqual(
    getToolPurpose('update_character', { characterId: 'char_1' }),
    '更新角色：char_1',
    'update_character characterId → 更新角色：char_1',
  );

  // ─── 世界观条目 ───
  assertEqual(
    getToolPurpose('add_world_entry', { category: 'faction' }),
    '新增势力条目',
    'add_world_entry category=faction → 新增势力条目',
  );
  assertEqual(
    getToolPurpose('add_world_entry', { category: 'location' }),
    '新增地点条目',
    'add_world_entry category=location → 新增地点条目',
  );
  assertEqual(
    getToolPurpose('update_world_entry', { category: 'item' }),
    '更新物品条目',
    'update_world_entry category=item → 更新物品条目',
  );
  assertEqual(
    getToolPurpose('add_world_entry', { category: 'unknown' }),
    '新增世界条目',
    'add_world_entry 未知 category → 新增世界条目',
  );
  assertEqual(
    getToolPurpose('add_world_entry', {}),
    '新增世界条目',
    'add_world_entry 缺 category → 新增世界条目',
  );

  // ─── 连续性官 ───
  assertEqual(
    getToolPurpose('update_rolling_synopsis', {}),
    '更新滚动剧情概要',
    'update_rolling_synopsis → 更新滚动剧情概要',
  );
  assertEqual(
    getToolPurpose('update_world_state', {}),
    '同步世界状态台账',
    'update_world_state → 同步世界状态台账',
  );
  assertEqual(
    getToolPurpose('get_chapter_constraints', { chapterId: 'ch_003' }),
    '生成第 3 章写作约束',
    'get_chapter_constraints ch_003 → 生成第 3 章写作约束',
  );

  // ─── Fallback：未注册的 tool 走通用描述 ───
  // get_project_overview 在通用描述中
  assertEqual(
    getToolPurpose('get_project_overview', {}),
    '拉取项目当前完整概览',
    'get_project_overview → 通用描述',
  );
  // 完全未注册的 tool
  assertEqual(
    getToolPurpose('some_unknown_tool', {}),
    '调用 some_unknown_tool',
    '完全未注册的 tool → 调用 some_unknown_tool',
  );
  // 缺工具名
  assertEqual(
    getToolPurpose(undefined, {}),
    '执行专家工具',
    'toolName 缺失 → 执行专家工具',
  );

  // ─── Langchain 包装形态兼容 ───
  // 形态 1: 字符串 JSON（罕见，但 langchain 0.1+ 在某些链路上会传 string）
  assertEqual(
    getToolPurpose('update_project_field', '{"projectId":"p","field":"title","value":"x"}'),
    '更新书名',
    'update_project_field 字符串 JSON → 更新书名',
  );
  assertEqual(
    getToolPurpose('save_chapter', '{"chapterId":"ch_009","content":"..."}'),
    '保存第 9 章正文',
    'save_chapter 字符串 JSON → 保存第 9 章正文',
  );
  // 形态 2: 包装对象 { input: '<json string>' }（langchain on_tool_start 实际形态）
  assertEqual(
    getToolPurpose('update_project_field', {
      input: '{"projectId":"proj_3ae","field":"title","value":"我在异世界当贤者"}',
    }),
    '更新书名',
    'update_project_field { input: "<json>" } → 更新书名',
  );
  assertEqual(
    getToolPurpose('update_project_field', {
      input: '{"projectId":"proj_3ae","field":"worldSetting","value":"魔法世界..."}',
    }),
    '更新世界设定',
    'update_project_field { input: "<json>" } field=worldSetting → 更新世界设定',
  );
  // 形态 3: 包装对象 { input: { ... } }（langchain 直接传对象时）
  assertEqual(
    getToolPurpose('save_chapter', { input: { chapterId: 'ch_011', content: '...' } }),
    '保存第 11 章正文',
    'save_chapter { input: {...} } → 保存第 11 章正文',
  );
  // 形态 4: 包装对象但不是 JSON 字符串（容错——保持原包装）
  assertEqual(
    getToolPurpose('update_project_field', { input: 'raw text' }),
    '更新项目全局设定字段',
    'update_project_field { input: 非 JSON 字符串 } → 通用 fallback',
  );
  // 形态 5: 工具 schema 真的有一个 `input` 字段（多字段时不 unwrap）
  assertEqual(
    getToolPurpose('save_chapter', { input: 'ch_012', content: '...' }),
    '保存第 12 章正文',
    'save_chapter 真有 input 字段（多字段，不 unwrap）→ 保存第 12 章正文',
  );

  console.log('\n所有测试通过 ✓');
}

runTests();
