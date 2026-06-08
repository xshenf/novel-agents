import { HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { resolveDelegateTarget, SPECIALISTS } from '../lib/agent/graph';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`测试失败: ${message}`);
  }
  console.log(`PASS: ${message}`);
}

// 构造一条编导委托后的尾部工具结果（delegate_to_X 工具的产出）
function delegateTool(role: string, task = '任务') {
  return new ToolMessage({
    content: `[DELEGATE:${role}] ${task}`,
    name: `delegate_to_${role}`,
    tool_call_id: `tc_${role}`,
  });
}

function normalTool(name: string, content: string) {
  return new ToolMessage({ content, name, tool_call_id: `tc_${name}` });
}

function runTests() {
  console.log('开始执行委托路由解析单元测试...');

  // 场景 1: 尾部委托到各专家，应正确识别
  for (const role of SPECIALISTS) {
    const msgs = [new HumanMessage('做点事'), delegateTool(role)];
    assert(resolveDelegateTarget(msgs) === role, `尾部 [DELEGATE:${role}] 应解析为 ${role}`);
  }

  // 场景 2: 普通工具结果（非委托）应返回 null，路由回 orchestrator
  const m2 = [new HumanMessage('前文讲了什么'), normalTool('query_memory', '检索结果：主角叫沈砚')];
  assert(resolveDelegateTarget(m2) === null, '普通工具结果应返回 null');

  // 场景 3: 未知角色不在 SPECIALISTS 中，应返回 null（防止伪造信号路由到不存在的节点）
  const m3 = [new HumanMessage('x'), delegateTool('hacker')];
  assert(resolveDelegateTarget(m3) === null, '未知角色 [DELEGATE:hacker] 应返回 null');

  // 场景 4: 委托信号不在末尾（其后还有 AIMessage），应返回 null（只认末尾连续的工具结果）
  const m4 = [new HumanMessage('x'), delegateTool('writer'), new AIMessage('我已经写完了')];
  assert(resolveDelegateTarget(m4) === null, '委托信号非尾部时应返回 null');

  // 场景 5: 末尾有多条工具结果，其中一条是委托（编导同一轮调了 query_memory + delegate）
  const m5 = [new HumanMessage('x'), normalTool('query_memory', '背景资料'), delegateTool('editor')];
  assert(resolveDelegateTarget(m5) === 'editor', '末尾工具结果含委托时应解析出 editor');

  // 场景 6: 末尾多条工具结果，委托在前、普通在后，仍应扫描到委托
  const m6 = [new HumanMessage('x'), delegateTool('planner'), normalTool('get_project_overview', '概览')];
  assert(resolveDelegateTarget(m6) === 'planner', '回溯末尾连续工具结果应能找到靠前的委托信号');

  // 场景 7: 含下划线的角色名 lore_builder 应被正则正确捕获
  const m7 = [new HumanMessage('x'), delegateTool('lore_builder')];
  assert(resolveDelegateTarget(m7) === 'lore_builder', '含下划线的 lore_builder 应被正确解析');

  // 场景 8: 空消息数组应返回 null
  assert(resolveDelegateTarget([]) === null, '空数组应返回 null');

  // 场景 9: SPECIALISTS 集合健全性
  assert(SPECIALISTS.length === 5, 'SPECIALISTS 应包含 5 个专家');

  console.log('\n所有委托路由解析测试用例均验证通过！\n');
}

runTests();
