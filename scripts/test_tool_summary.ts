// 工具摘要单元测试
// 运行：npx tsx scripts/test_tool_summary.ts
import { getActionVerb, getWrittenLength, formatWrittenLength } from '../app/lib/toolSummary';

function assertEq<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}`);
    console.error(`  expected: ${JSON.stringify(expected)}`);
    console.error(`  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
  console.log(`PASS: ${label}`);
}

function runTests() {
  console.log('开始执行 toolSummary 单元测试...\n');

  // ─── getActionVerb ───
  assertEq(getActionVerb('save_chapter'), 'write', 'save_chapter → write');
  assertEq(getActionVerb('create_character'), 'write', 'create_character → write');
  assertEq(getActionVerb('add_world_entry'), 'write', 'add_world_entry → write');
  assertEq(getActionVerb('update_chapter'), 'update', 'update_chapter → update');
  assertEq(getActionVerb('update_outline'), 'update', 'update_outline → update');
  assertEq(getActionVerb('update_project_field'), 'update', 'update_project_field → update');
  assertEq(getActionVerb('update_rolling_synopsis'), 'update', 'update_rolling_synopsis → update');
  assertEq(getActionVerb('delete_character'), 'delete', 'delete_character → delete');
  assertEq(getActionVerb('delete_world_entry'), 'delete', 'delete_world_entry → delete');
  assertEq(getActionVerb('get_chapter'), null, 'get_chapter → null（查询类）');
  assertEq(getActionVerb('get_project_overview'), null, 'get_project_overview → null');
  assertEq(getActionVerb('request_user_choice'), null, 'request_user_choice → null');
  assertEq(getActionVerb(''), null, '空字符串 → null');
  assertEq(getActionVerb(undefined), null, 'undefined → null');
  assertEq(getActionVerb(null), null, 'null → null');

  // ─── getWrittenLength：从 input 提取 ───
  assertEq(
    getWrittenLength('save_chapter', { content: '这是章节正文', chapterId: 'ch_001' }, null),
    6,
    'save_chapter input.content → 6 字',
  );
  assertEq(
    getWrittenLength('save_chapter', { content: 'a'.repeat(3500) }, null),
    3500,
    'save_chapter 长正文 → 3500 字',
  );
  assertEq(
    getWrittenLength('create_character', { name: '林远', description: '主角' }, null),
    2,
    'create_character input.description → 2 字',
  );
  assertEq(
    getWrittenLength('add_world_entry', { name: 'X', summary: '势力' }, null),
    2,
    'add_world_entry input.summary → 2 字',
  );

  // 候选字段优先级：content 优先于 description
  assertEq(
    getWrittenLength('save_chapter', { content: '主', description: '次' }, null),
    1,
    'content 字段优先于 description',
  );
  // 没候选字段 → null
  assertEq(
    getWrittenLength('save_chapter', { chapterId: 'ch_001' }, null),
    null,
    '无写入字段 → null',
  );
  // 对象字段：JSON.stringify 后取长度
  assertEq(
    getWrittenLength('update_world_entry', { data: { x: 1, y: 'z' } }, null),
    JSON.stringify({ x: 1, y: 'z' }).length,
    '非 string 字段 → JSON.stringify 长度',
  );
  // input 缺 / 非对象
  assertEq(getWrittenLength('save_chapter', null, '已保存'), null, 'input 为 null → lengthFromInput 返 null');
  assertEq(getWrittenLength('save_chapter', 'str', '已保存'), null, 'input 非对象 → null');

  // ─── getWrittenLength：从 result 兜底 ───
  assertEq(
    getWrittenLength('save_chapter', null, '已保存 1234 字到 ch_001'),
    1234,
    'result 匹配「已保存 N 字」',
  );
  assertEq(
    getWrittenLength('save_chapter', null, '成功，已写入 800 字'),
    800,
    'result 匹配「已写入 N 字」',
  );
  assertEq(
    getWrittenLength('update_chapter', null, '已更新 256 字'),
    256,
    'result 匹配「已更新 N 字」',
  );
  assertEq(
    getWrittenLength('delete_character', null, '已删除 5 字'),
    5,
    'delete 走 result 路径：5 字',
  );
  assertEq(
    getWrittenLength('save_chapter', null, '随便的返回文本'),
    null,
    'result 模式不匹配 → null',
  );
  assertEq(
    getWrittenLength('save_chapter', null, ''),
    null,
    '空 result → null',
  );

  // ─── input 优先于 result ───
  // "6 字正文" 实际长度 = 5（数字 6、空格 1、字 1、正 1、文 1）
  assertEq(
    getWrittenLength('save_chapter', { content: '6 字正文' }, '已保存 999 字'),
    5,
    'input 命中时优先使用 input',
  );

  // ─── 查询类工具：永远 null ───
  assertEq(
    getWrittenLength('get_chapter', null, '已保存 100 字'),
    null,
    'get_chapter 即便 result 命中也不显示',
  );
  assertEq(
    getWrittenLength('get_project_field', { field: 'title' }, '我在异世界当贤者'),
    null,
    'get_project_field 不显示摘要',
  );

  // ─── formatWrittenLength ───
  assertEq(formatWrittenLength(6, 'write'), '已写入 6 字', 'write → 已写入');
  assertEq(formatWrittenLength(3500, 'update'), '已更新 3500 字', 'update → 已更新');
  assertEq(formatWrittenLength(120, 'delete'), '已删除 120 字', 'delete → 已删除');
  assertEq(formatWrittenLength(null, 'write'), null, 'null → null');
  assertEq(formatWrittenLength(0, 'write'), '已写入 0 字', '0 → 已写入 0 字（边界）');
  // verb 缺省 → 兜底 write
  assertEq(formatWrittenLength(10), '已写入 10 字', 'verb 缺省 → write');
  assertEq(formatWrittenLength(10, null), '已写入 10 字', 'verb=null → write');

  // ─── langchain 包装形态兼容 ───
  // 字符串 JSON input
  assertEq(
    getWrittenLength('update_project_field', '{"field":"title","value":"我在异世界当贤者"}', null),
    8,
    'update_project_field 字符串 JSON input（按 value 长度计）',
  );
  // 包装 { input: '<json>' }
  assertEq(
    getWrittenLength('update_project_field', { input: '{"field":"title","value":"我在异世界当贤者"}' }, null),
    8,
    'update_project_field { input: "<json>" } → 8 字',
  );
  // 包装 { input: { ... } }
  assertEq(
    getWrittenLength('update_project_field', { input: { field: 'description', value: '作品简介内容' } }, null),
    6,
    'update_project_field { input: { ... } } → 6 字',
  );
  // 多字段时若 schema 本身就有 input 字段（不 unwrap），仍能取到
  assertEq(
    getWrittenLength('save_chapter', { input: 'ch_009', content: '章节正文内容' }, null),
    6,
    'save_chapter 真有 input 字段（多字段不 unwrap）→ 6 字',
  );
  // langchain ToolMessage 完整 JSON 包裹 result：应能从 kwargs.content 提取"已保存 N 字"
  const lcDump = JSON.stringify({
    lc: 1, type: 'constructor', id: ['langchain_core', 'messages', 'ToolMessage'],
    kwargs: { status: 'success', content: '项目设定「title」已更新，已保存 256 字', name: 'update_project_field' },
  });
  assertEq(
    getWrittenLength('update_project_field', null, lcDump),
    256,
    'toolResult 是 langchain ToolMessage JSON dump → 提取 content 后匹配字数',
  );
  // 顶层 content 字段
  const topDump = '{"content":"已写入 1024 字","type":"result"}';
  assertEq(
    getWrittenLength('save_chapter', null, topDump),
    1024,
    'toolResult 顶层 content 字段 → 提取后匹配',
  );
  // 普通文本 result 不受影响
  assertEq(
    getWrittenLength('save_chapter', null, '已保存 50 字'),
    50,
    '普通文本 result → 50 字（兼容）',
  );

  console.log('\n所有测试通过 ✓');
}

runTests();
