import { HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { filterSpecialistMessages, filterOrchestratorMessages } from '../lib/agent/graph';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`测试失败: ${message}`);
  }
  console.log(`PASS: ${message}`);
}

function runTests() {
  console.log('开始执行消息过滤逻辑单元测试...');

  // ─── 1. 测试 Specialist 消息过滤 (filterSpecialistMessages) ───
  console.log('\n--- 测试 Specialist 消息裁剪 ---');

  // 场景 1.1: 只有编导的委派，专家尚未开始交互
  const messages1 = [
    new HumanMessage('你好'),
    new AIMessage('你好，有什么可以帮您？'),
    new HumanMessage('请写第一章'),
    new AIMessage({
      content: '好的，我让写手来做。',
      tool_calls: [{ id: 'tc_delegate_1', name: 'delegate_to_writer', args: { task: '写第一章：起飞' } }]
    }),
    new ToolMessage({
      content: '[DELEGATE:writer] 写第一章：起飞',
      name: 'delegate_to_writer',
      tool_call_id: 'tc_delegate_1'
    })
  ];

  const filtered1 = filterSpecialistMessages('writer', messages1);
  assert(filtered1.length === 1, '没有交互时，过滤后的消息长度应为 1');
  assert(filtered1[0]._getType() === 'human', '消息类型应为 human');
  assert(
    filtered1[0].content === '请执行编导委派给你的任务：\n写第一章：起飞',
    '应该能正确提取任务内容'
  );

  // 场景 1.2: 专家正在交互中（已经执行了一些内部工具）
  const messages2 = [
    ...messages1,
    new AIMessage({
      content: '我需要查询前文背景。',
      tool_calls: [{ id: 'tc_internal_1', name: 'read_lore', args: {} }]
    }),
    new ToolMessage({
      content: '设定：主角是个魔法学徒。',
      name: 'read_lore',
      tool_call_id: 'tc_internal_1'
    })
  ];

  const filtered2 = filterSpecialistMessages('writer', messages2);
  assert(filtered2.length === 3, '包含内部工具调用时，过滤后的消息长度应为 3');
  assert(filtered2[0].content === '请执行编导委派给你的任务：\n写第一章：起飞', '第 1 条消息应为任务详情');
  assert(filtered2[1]._getType() === 'ai', '第 2 条消息应为写手的中间思考');
  assert(filtered2[2]._getType() === 'tool', '第 3 条消息应为写手内部工具结果');

  // ─── 2. 测试 Orchestrator 消息过滤 (filterOrchestratorMessages) ───
  console.log('\n--- 测试 Orchestrator 消息过滤 ---');

  // 场景 2.1: 过滤掉专家的中间工具调用，但保留最终回答和编导工具
  const messages3 = [
    new HumanMessage('写第一章'),
    new AIMessage({
      content: '开始委派',
      tool_calls: [{ id: 'tc_delegate_2', name: 'delegate_to_writer', args: { task: '写第一章' } }]
    }),
    new ToolMessage({
      content: '[DELEGATE:writer] 写第一章',
      name: 'delegate_to_writer',
      tool_call_id: 'tc_delegate_2'
    }),
    // 以下为写手内部的工具交互，应该被过滤
    new AIMessage({
      content: '写手正在查询项目信息',
      tool_calls: [{ id: 'tc_writer_query', name: 'query_project_info', args: {} }]
    }),
    new ToolMessage({
      content: '大纲：第一章起飞',
      name: 'query_project_info',
      tool_call_id: 'tc_writer_query'
    }),
    // 写手的最终回答，没有 tool_calls，应该保留
    new AIMessage('这是写好的第一章正文内容。')
  ];

  const filtered3 = filterOrchestratorMessages(messages3);
  assert(filtered3.length === 4, '编导过滤后，消息数应为 4（用户提问 + 编导决策 + 编导委托结果 + 写手最终成果）');

  // 校验具体保留的消息
  assert(filtered3[0].content === '写第一章', '应保留用户原提问');
  assert((filtered3[1] as any).tool_calls?.[0]?.name === 'delegate_to_writer', '应保留编导的 delegate 动作');
  assert((filtered3[2] as any).name === 'delegate_to_writer', '应保留 delegate 的 ToolMessage 结果');
  assert(filtered3[3].content === '这是写好的第一章正文内容。', '应保留写手最终交付的 AIMessage');

  // 场景 2.2: 专家的成果型工具结果应转为独立成果消息保留给编导（防"失忆"）
  const messages4 = [
    new HumanMessage('写第一章'),
    new AIMessage({
      content: '',
      tool_calls: [{ id: 'tc_delegate_3', name: 'delegate_to_writer', args: { task: '写第一章' } }]
    }),
    new ToolMessage({ content: '[DELEGATE:writer] 写第一章', name: 'delegate_to_writer', tool_call_id: 'tc_delegate_3' }),
    // 写手调用成果型写入工具 auto_write_chapter（中间 AIMessage 含 specialist tool，应被过滤）
    new AIMessage({
      content: '',
      tool_calls: [{ id: 'tc_aw', name: 'auto_write_chapter', args: { projectId: 'p', chapterTitle: '第一章' } }]
    }),
    new ToolMessage({ content: '章节「第一章」正文已生成并保存（共 2669 字，章节ID: c1）。', name: 'auto_write_chapter', tool_call_id: 'tc_aw' }),
    // 写手最终回复（推理模型常为空内容）
    new AIMessage(''),
  ];
  const filtered4 = filterOrchestratorMessages(messages4);
  const resultMsg = filtered4.find(m => typeof m.content === 'string' && m.content.includes('auto_write_chapter'));
  assert(!!resultMsg, '成果型工具 auto_write_chapter 的结果应被转成独立成果消息保留');
  assert((resultMsg!.content as string).includes('2669 字'), '成果消息应携带工具结果实质内容（字数等）');
  // 不应残留 name=auto_write_chapter 的孤儿 ToolMessage
  assert(!filtered4.some(m => (m as any).name === 'auto_write_chapter'), '不应残留 auto_write_chapter 的孤儿 ToolMessage');

  console.log('\n所有消息过滤逻辑测试用例均验证通过！\n');
}

runTests();
