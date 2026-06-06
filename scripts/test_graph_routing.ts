import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { buildNovelAgentGraph } from '../lib/agent/graph';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`测试失败: ${message}`);
  console.log(`PASS: ${message}`);
}

const PID = 'test_routing_proj_nonexistent';

// 桩 LLM：bindTools 返回自身，invoke 按队列依次弹出脚本化的 AIMessage。
// 队列耗尽时返回无 tool_calls 的收尾消息，避免脚本不足导致挂死。
class StubModel {
  private queue: any[];
  constructor(responses: any[]) { this.queue = [...responses]; }
  bindTools(_tools: any) { return this; }
  async invoke(_messages: any) {
    return this.queue.length ? this.queue.shift() : new AIMessage('（stub 收尾）');
  }
}

let seq = 0;
const delegateMsg = (role: string, task = '任务') =>
  new AIMessage({ content: '', tool_calls: [{ id: `d${seq++}`, name: `delegate_to_${role}`, args: { task } }] });
const toolCallMsg = (name: string, args: any) =>
  new AIMessage({ content: '', tool_calls: [{ id: `t${seq++}`, name, args }] });
const finalMsg = (text: string) => new AIMessage(text);

function makeGraph(stubs: Record<string, StubModel>) {
  const factory = (role: string) => stubs[role] || new StubModel([finalMsg('（未脚本化角色收尾）')]);
  return buildNovelAgentGraph('{}', 'stub', PID, factory);
}

function lastAI(messages: any[]): any {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?._getType?.() === 'ai') return messages[i];
  }
  return undefined;
}

async function run() {
  console.log('开始执行图路由（桩 LLM）端到端测试...');

  // ── 场景 1：正常委派 orchestrator -> writer -> orchestrator ──
  {
    const stubs = {
      orchestrator: new StubModel([delegateMsg('writer', '写第一章'), finalMsg('已综合写手成果完成汇报。')]),
      writer: new StubModel([finalMsg('这是写手交付的第一章正文。')]),
    };
    const graph = makeGraph(stubs);
    const res: any = await graph.invoke(
      { messages: [new HumanMessage('帮我写第一章')], projectId: PID },
      { recursionLimit: 50, configurable: { thread_id: 'route_s1_' + Date.now() } }
    );
    const msgs = res.messages;
    const hasDelegate = msgs.some((m: any) => m._getType?.() === 'tool' && typeof m.content === 'string' && m.content.startsWith('[DELEGATE:writer]'));
    const hasWriterOutput = msgs.some((m: any) => m._getType?.() === 'ai' && m.content === '这是写手交付的第一章正文。');
    assert(hasDelegate, '场景1：产生了 [DELEGATE:writer] 委派信号');
    assert(hasWriterOutput, '场景1：写手的最终产出进入了消息流');
    assert(lastAI(msgs)?.content === '已综合写手成果完成汇报。', '场景1：最终回到 orchestrator 汇总');
    assert(res.delegationCount === 1, '场景1：delegationCount 累加为 1');
  }

  // ── 场景 2：orchestrator 直接回答（无委派）即结束 ──
  {
    const stubs = {
      orchestrator: new StubModel([finalMsg('这个问题我直接回答即可。')]),
    };
    const graph = makeGraph(stubs);
    const res: any = await graph.invoke(
      { messages: [new HumanMessage('你好')], projectId: PID },
      { recursionLimit: 50, configurable: { thread_id: 'route_s2_' + Date.now() } }
    );
    assert(lastAI(res.messages)?.content === '这个问题我直接回答即可。', '场景2：无 tool_calls 时 orchestrator 直接结束');
    assert(res.delegationCount === 0, '场景2：未发生委派，delegationCount 为 0');
  }

  // ── 场景 3：专家工具调用上限失控保护（MAX_SPECIALIST_TOOL_CALLS=10）──
  {
    const writerLoop = Array.from({ length: 14 }, () => toolCallMsg('query_memory', { projectId: PID, query: 'x' }));
    const stubs = {
      orchestrator: new StubModel([delegateMsg('writer', '一直查记忆'), finalMsg('已强制收尾。')]),
      writer: new StubModel(writerLoop),
    };
    const graph = makeGraph(stubs);
    const res: any = await graph.invoke(
      { messages: [new HumanMessage('反复查询')], projectId: PID },
      { recursionLimit: 50, configurable: { thread_id: 'route_s3_' + Date.now() } }
    );
    const queryResults = res.messages.filter((m: any) => m._getType?.() === 'tool' && (m as any).name === 'query_memory').length;
    assert(queryResults <= 10, `场景3：专家工具调用被上限保护截断（实际 ${queryResults} 次 <= 10）`);
    assert(res.delegationCount === 1, '场景3：超限后经 after_specialist 回到 orchestrator');
    assert(lastAI(res.messages)?.content === '已强制收尾。', '场景3：最终由 orchestrator 收尾，未触发 recursionLimit');
  }

  console.log('\n所有图路由（桩 LLM）测试用例均验证通过！\n');
}

run().then(() => process.exit(0)).catch(e => { console.error('ERR', e?.message || e); process.exit(1); });
