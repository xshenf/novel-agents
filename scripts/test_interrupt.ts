import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { Command } from '@langchain/langgraph';
import { buildNovelAgentGraph } from '../lib/agent/graph';
import { db } from '../lib/db';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`测试失败: ${message}`);
  console.log(`PASS: ${message}`);
}

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

async function makeLockedProject(): Promise<string> {
  const proj = await db.createProject({
    title: '【临时】interrupt测试',
    description: '验证锁定项 interrupt 确认的临时项目，跑完即删。',
    styleSetting: '',
    worldSetting: '',
    outlineFull: '# 第一卷：起源 <!-- LOCKED -->\n这是锁定分卷的概要\n\n## 第一章 开端\n章节内容',
  } as any);
  return proj.id;
}

// NOTE: This script uses the real database (same as the app). Ideally it should
// use an in-memory SQLite instance (Prisma with `url: "file::memory:"`) to
// avoid any risk of polluting the development database.

// 一个场景：编导委派 planner，planner 调 delete_volume 删除锁定分卷 → 应在 interrupt 暂停 → resume 决定结果
// 注意：resume 用真值字符串（'confirm'/'cancel'），不能用 false——langgraph 会把 falsy 的 Command 当成空输入报错。
async function scenario(decision: 'confirm' | 'cancel') {
  const confirmed = decision === 'confirm';
  const pid = await makeLockedProject();
  try {
    const stubs: Record<string, StubModel> = {
      orchestrator: new StubModel([delegateMsg('planner', '删除第一卷'), finalMsg('已处理用户请求。')]),
      planner: new StubModel([toolCallMsg('delete_volume', { projectId: pid, volumeIndex: 0 }), finalMsg('分卷操作已完成。')]),
    };
    const graph = buildNovelAgentGraph('{}', 'stub', pid, (r: string) => stubs[r] || new StubModel([finalMsg('x')]));
    const config = { recursionLimit: 50, configurable: { thread_id: `intr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` } };

    // 第一次运行：应在锁定分卷删除处中断
    await graph.invoke({ messages: [new HumanMessage('把第一卷删了')], projectId: pid }, config as any);
    const snap: any = await graph.getState(config as any);
    const interrupts = (snap?.tasks || []).flatMap((t: any) => t.interrupts || []);
    assert(interrupts.length > 0, `[${decision}] 删除锁定分卷时图在 interrupt 处暂停`);
    assert(interrupts[0]?.value?.type === 'confirm_locked', `[${decision}] interrupt 载荷为 confirm_locked`);
    assert(interrupts[0]?.value?.target === '第一卷：起源', `[${decision}] interrupt 载荷含正确的目标标题`);

    // 恢复：传入用户决定（真值字符串）
    await graph.invoke(new Command({ resume: decision }), config as any);

    const proj = await db.getProject(pid);
    const stillHas = (proj?.outlineFull || '').includes('第一卷：起源');
    if (confirmed) {
      assert(!stillHas, '[confirm] 用户确认后，锁定分卷被删除');
    } else {
      assert(stillHas, '[cancel] 用户取消后，锁定分卷保留');
    }
  } finally {
    await db.deleteProject(pid);
  }
}

async function run() {
  console.log('开始执行锁定项 interrupt 人工确认测试...');
  const errors: string[] = [];
  try {
    try {
      await scenario('cancel');  // 取消
    } catch (e: any) {
      errors.push(`[cancel] ${e?.message || e}`);
    }
    try {
      await scenario('confirm'); // 确认
    } catch (e: any) {
      errors.push(`[confirm] ${e?.message || e}`);
    }
  } finally {
    if (errors.length > 0) {
      console.error('\n以下场景失败:\n' + errors.join('\n'));
      throw new Error(`${errors.length} scenario(s) failed`);
    }
  }
  console.log('\n所有 interrupt 人工确认测试用例均验证通过！\n');
}

run()
  .then(() => process.exit(0))
  .catch(e => { console.error('ERR', e?.message || e); process.exit(1); });
