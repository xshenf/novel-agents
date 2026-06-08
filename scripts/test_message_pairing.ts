// 工具调用 / 结果配对器单元测试
// 运行：npx tsx scripts/test_message_pairing.ts
import { pairToolMessages } from '../app/lib/messagePairing';
import type { AgentMessage } from '../app/hooks/useAgentChat';

function assertEq<T>(actual: T, expected: T, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL: ${label}`);
    console.error(`  expected: ${e}`);
    console.error(`  actual:   ${a}`);
    process.exit(1);
  }
  console.log(`PASS: ${label}`);
}

const baseMsg = (overrides: Partial<AgentMessage>): AgentMessage => ({
  id: overrides.id || 'm_' + Math.random().toString(36).slice(2, 8),
  type: 'thinking',
  agent: 'planner',
  content: '',
  ...overrides,
} as AgentMessage);

function runTests() {
  console.log('开始执行 pairToolMessages 单元测试...\n');

  // ─── 1. 空数组 ───
  assertEq(pairToolMessages([]), [], '空数组 → 空');

  // ─── 2. 无 tool_call / tool_result ───
  const msgs1: AgentMessage[] = [
    baseMsg({ id: 'a1', type: 'thinking', content: '思考' }),
    baseMsg({ id: 'a2', type: 'final_answer', content: '回答' }),
  ];
  const r1 = pairToolMessages(msgs1);
  assertEq(r1.map(i => i.kind), ['message', 'message'], '普通消息全走 message 分支');

  // ─── 3. 基础配对：call + result 同名 ───
  const msgs2: AgentMessage[] = [
    baseMsg({ id: 'c1', type: 'tool_call', toolName: 'save_chapter', toolInput: { id: 'ch_001' } }),
    baseMsg({ id: 'r1', type: 'tool_result', toolName: 'save_chapter', content: 'OK' }),
  ];
  const r2 = pairToolMessages(msgs2);
  assertEq(r2.length, 1, '基础配对：长度 1');
  assertEq(r2[0].kind, 'tool_pair', '基础配对：kind=tool_pair');
  assertEq((r2[0] as any).toolName, 'save_chapter', '基础配对：toolName 正确');
  assertEq((r2[0] as any).toolResult, 'OK', '基础配对：result 正确');

  // ─── 4. 工具名不匹配 → 不配对，各自单渲染 ───
  const msgs3: AgentMessage[] = [
    baseMsg({ id: 'c1', type: 'tool_call', toolName: 'A' }),
    baseMsg({ id: 'r1', type: 'tool_result', toolName: 'B', content: 'X' }),
  ];
  const r3 = pairToolMessages(msgs3);
  assertEq(r3.length, 2, '工具名不匹配 → 不配对');
  assertEq(r3.map(i => i.kind), ['tool_call', 'tool_result'], '工具名不匹配 → 各自单分支');

  // ─── 5. 流式：只有 tool_call 没有 tool_result ───
  const msgs4: AgentMessage[] = [
    baseMsg({ id: 'c1', type: 'tool_call', toolName: 'A' }),
  ];
  const r4 = pairToolMessages(msgs4);
  assertEq(r4.length, 1, '孤立 call → 1 项');
  assertEq(r4[0].kind, 'tool_call', '孤立 call → tool_call 分支');

  // ─── 6. 孤儿 result：前一条不是同名 call ───
  const msgs5: AgentMessage[] = [
    baseMsg({ id: 'c1', type: 'tool_call', toolName: 'A' }),
    baseMsg({ id: 'r1', type: 'tool_result', toolName: 'B', content: 'X' }),
    baseMsg({ id: 'r2', type: 'tool_result', toolName: 'A', content: 'Y' }),
  ];
  const r5 = pairToolMessages(msgs5);
  // 配对规则：call 后第一个 result，工具名必须匹配才配对
  // c1 (A) → r1 (B) 不匹配 → c1 单; r1 单; r2 孤儿（无前序 pending call）单
  assertEq(r5.length, 3, '工具名不匹配 + 孤儿 result → 3 项');
  assertEq(r5.map(i => i.kind), ['tool_call', 'tool_result', 'tool_result'], '3 项分支');

  // ─── 7. 配对 + 周围消息 ───
  const msgs6: AgentMessage[] = [
    baseMsg({ id: 't1', type: 'thinking', content: 'A' }),
    baseMsg({ id: 'c1', type: 'tool_call', toolName: 'X' }),
    baseMsg({ id: 'r1', type: 'tool_result', toolName: 'X', content: 'OK' }),
    baseMsg({ id: 'a1', type: 'final_answer', content: 'B' }),
  ];
  const r6 = pairToolMessages(msgs6);
  assertEq(r6.map(i => i.kind), ['message', 'tool_pair', 'message'], '配对 + 周围消息：4 → 3');

  // ─── 8. 连续多组配对 ───
  const msgs7: AgentMessage[] = [
    baseMsg({ id: 'c1', type: 'tool_call', toolName: 'A' }),
    baseMsg({ id: 'r1', type: 'tool_result', toolName: 'A', content: 'X' }),
    baseMsg({ id: 'c2', type: 'tool_call', toolName: 'B' }),
    baseMsg({ id: 'r2', type: 'tool_result', toolName: 'B', content: 'Y' }),
  ];
  const r7 = pairToolMessages(msgs7);
  assertEq(r7.length, 2, '连续 2 组配对');
  assertEq(r7.every(i => i.kind === 'tool_pair'), true, '连续 2 组全部配对');

  // ─── 9. 混合：流中只出 call，再出 call（无 result），最后出两个 result 匹配各自 ───
  // 严格相邻配对：c1 紧邻 c2 (tool_call) 不算 result → c1 单; c2 紧邻 r1 但工具名不匹配 → c2 单
  const msgs8: AgentMessage[] = [
    baseMsg({ id: 'c1', type: 'tool_call', toolName: 'A' }),
    baseMsg({ id: 'c2', type: 'tool_call', toolName: 'B' }),
    baseMsg({ id: 'r1', type: 'tool_result', toolName: 'A', content: 'X' }),
    baseMsg({ id: 'r2', type: 'tool_result', toolName: 'B', content: 'Y' }),
  ];
  const r8 = pairToolMessages(msgs8);
  assertEq(r8.length, 4, '严格相邻：连续 call 不配对');
  assertEq(r8.map(i => i.kind), ['tool_call', 'tool_call', 'tool_result', 'tool_result'], '4 项分支');

  // ─── 9b. 相邻同名：交错 + 紧邻同名 都能配对 ───
  const msgs8b: AgentMessage[] = [
    baseMsg({ id: 'c1', type: 'tool_call', toolName: 'A' }),
    baseMsg({ id: 'r1', type: 'tool_result', toolName: 'A', content: 'X' }),
    baseMsg({ id: 'c2', type: 'tool_call', toolName: 'B' }),
    baseMsg({ id: 'r2', type: 'tool_result', toolName: 'B', content: 'Y' }),
  ];
  const r8b = pairToolMessages(msgs8b);
  assertEq(r8b.length, 2, '标准相邻同名：2 组配对');
  assertEq(r8b.every(i => i.kind === 'tool_pair'), true, '2 组都配对');

  // ─── 10. 配对 key 取 call.id（保证 React 列表稳定 key）───
  const msgs9: AgentMessage[] = [
    baseMsg({ id: 'CALL_42', type: 'tool_call', toolName: 'X' }),
    baseMsg({ id: 'RES_99', type: 'tool_result', toolName: 'X', content: 'OK' }),
  ];
  const r9 = pairToolMessages(msgs9);
  assertEq((r9[0] as any).key, 'CALL_42', '配对 key = call.id');

  console.log('\n所有测试通过 ✓');
}

runTests();
