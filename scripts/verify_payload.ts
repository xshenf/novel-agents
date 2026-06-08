// 综合验证：user 截图里的几种工具调用，模拟 langchain 数据流
// route.ts on_tool_start / on_tool_end → normalizeToolPayload → 渲染端契约字段
import { normalizeToolPayload } from '../app/lib/toolPayload';
import { extractToolMessageContent } from '../app/lib/toolInputShape';

function dump(name: string, input: any, output: any) {
  const p = normalizeToolPayload(name, input, output);
  console.log(`\n── ${name} ──`);
  console.log('  purpose        :', p.purpose);
  console.log('  verb           :', p.verb);
  console.log('  writtenLength  :', p.writtenLength);
  console.log('  nameField/Text :', p.nameField, '/', p.nameText);
  console.log('  contentField   :', p.contentField, 'len=', p.contentLength);
  console.log('  contentText    :', p.contentText);
  console.log('  filteredInput  :', p.filteredInput);
  console.log('  resultText     :', p.resultText);
}

// 1. update_project_field（user 截图里的真实场景）
const lcToolMessage = {
  lc: 1, type: 'constructor', id: ['langchain_core', 'messages', 'ToolMessage'],
  kwargs: { status: 'success', content: '项目设定「title」已更新。', name: 'update_project_field' },
};
dump(
  'update_project_field',
  { projectId: 'proj_3ae40c3f-993f-4c96-8a76-4be7c5c8f5c7', field: 'title', value: '我在异世界当贤者' },
  lcToolMessage,
);

// 2. generate_outline（user 截图）
dump(
  'generate_outline',
  { projectId: 'proj_3ae40c3f-993f-4c96-8a76-4be7c5c8f5c7', numChapters: 10 },
  { lc: 1, kwargs: { content: '已生成全书 10 章大纲：第 1 章「异世界降临」...第 10 章「贤者归位」' } },
);

// 3. create_character
dump(
  'create_character',
  { projectId: 'p', name: '林远', bio: '来自东方剑客，拥有神秘贤者之力，背负拯救苍生的使命。', role: '主角' },
  { content: '角色「林远」已创建，已保存 28 字' },
);

// 4. delegate_to_planner（user 反馈"只有结果没有调用"——验证归一化）
dump(
  'delegate_to_planner',
  { projectId: 'p', task: '请更新人设与世界观' },
  null,
);

// 5. save_chapter（章节写入）
dump(
  'save_chapter',
  { projectId: 'p', chapterId: 'ch_001', content: '第一章正文：' + '他踏上异世界的土地，'.repeat(100) },
  { content: '已保存 800 字' },
);

// 6. update_chapter
dump(
  'update_chapter',
  { projectId: 'p', chapterId: 'ch_002', content: '修订内容' + '。'.repeat(50) },
  { content: '已更新 50 字' },
);

// 7. delete_character
dump(
  'delete_character',
  { projectId: 'p', characterId: 'char_001' },
  { content: '角色「林远」已删除，已删除 28 字' },
);

// 8. 极端：output 是字符串（部分链路）
dump('add_world_entry',
  { projectId: 'p', category: 'faction', name: '贤者教团', description: '由七位贤者组成的隐秘组织，守护世界平衡。' },
  '已新增 25 字'
);

// 9. 验证 extractToolMessageContent 兼容
console.log('\n── extractToolMessageContent 验证 ──');
console.log('纯文本    :', extractToolMessageContent('已保存 50 字'));
console.log('kwargs    :', extractToolMessageContent(JSON.stringify(lcToolMessage)));
console.log('顶层content:', extractToolMessageContent('{"content":"顶层文本","type":"result"}'));
console.log('空        :', extractToolMessageContent(''));
