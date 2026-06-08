// 工具调用与结果配对：把相邻的 tool_call + tool_result 合并为一项，
// 让前端在 SpecialistCard / AgentPanel 内只渲染一张"合并卡"，
// 减少视觉噪音与重复 header。
// 配对规则：相邻 (工具名相同) 才配对；不匹配的 result / 单独的 call 各自走单卡分支。
// 归一化字段（purpose / writtenLength / verb / filteredInput / resultText）：
//   tool_result 上若有顶层归一化字段，merge 进 tool_pair（更准，因为 result 完整）；
//   tool_call 上若有，merge 时优先用 tool_result 的，缺失时回退到 tool_call 的。

import type { AgentMessage } from '../hooks/useAgentChat';

export type RenderItem =
  | { kind: 'message', msg: AgentMessage; key: string }
  | {
      kind: 'tool_pair';
      callId: string;
      toolName: string;
      toolInput: unknown;
      toolResult: string;
      key: string;
      // pending=true：call 收到但 result 还没到，前端用此显示转圈
      // synthetic=true：result 是后端兜底合成的"超时/失败"文案（非真实工具返回）
      pending?: boolean;
      synthetic?: boolean;
      normalized?: {
        purpose?: string;
        writtenLength?: number | null;
        verb?: 'write' | 'update' | 'delete' | null;
        filteredInput?: Record<string, unknown> | null;
        resultText?: string;
      };
    }
  | { kind: 'tool_call', msg: AgentMessage; key: string }
  | { kind: 'tool_result'; msg: AgentMessage; key: string };

/**
 * 把 messages 数组变换为 RenderItem 列表：相邻的 tool_call + tool_result
 * 配对成一个 tool_pair，单独存在的 tool_call / tool_result 各自走单分支。
 *
 * 配对规则优先级：
 *  1. 优先用 callId 精确匹配（后端在 tool_result SSE 里带 callId）
 *  2. fallback 用"相邻 + 工具名相等"
 *  3. 不匹配的 result / 单独的 call 各自走单卡分支
 */
export function pairToolMessages(messages: AgentMessage[]): RenderItem[] {
  const items: RenderItem[] = [];
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i];
    if (msg.type === 'tool_call') {
      // 优先 callId 配对：向后扫到第一条 result.callId === msg.id 的
      let pairIdx = -1;
      for (let j = i + 1; j < messages.length; j += 1) {
        const m = messages[j];
        if (m.type === 'tool_result') {
          // 1) 精确 callId 匹配
          if (m.callId === msg.id) {
            pairIdx = j;
            break;
          }
          // 2) fallback：相邻 + 工具名相等
          if (j === i + 1 && (m.toolName ?? '') === (msg.toolName ?? '')) {
            pairIdx = j;
            break;
          }
        }
        // 跨过 tool_call / tool_result 之外的类型就停，避免越过其他消息
        if (m.type !== 'tool_call' && m.type !== 'tool_result') break;
      }
      if (pairIdx !== -1) {
        const next = messages[pairIdx];
        // merge 归一化字段：tool_result 优先，缺失时回退到 tool_call
        const normalized = {
          purpose: next.purpose || msg.purpose,
          writtenLength: next.writtenLength != null ? next.writtenLength : msg.writtenLength,
          verb: next.verb ?? msg.verb,
          filteredInput: next.filteredInput || msg.filteredInput,
          resultText: next.resultText || next.content,
        };
        items.push({
          kind: 'tool_pair',
          callId: msg.id,
          toolName: msg.toolName || '',
          toolInput: msg.toolInput,
          toolResult: next.content || '',
          key: msg.id,
          pending: false,
          synthetic: !!next.synthetic,
          normalized,
        });
        i = pairIdx + 1;
        continue;
      }
      // 流式过程中 tool_result 还没到，单独渲染 tool_call，pending 透传
      items.push({ kind: 'tool_call', msg, key: msg.id });
      i += 1;
      continue;
    }
    if (msg.type === 'tool_result') {
      // 孤儿 result：上一条不是配对的 call
      items.push({ kind: 'tool_result', msg, key: msg.id });
      i += 1;
      continue;
    }
    items.push({ kind: 'message', msg, key: msg.id });
    i += 1;
  }
  return items;
}
