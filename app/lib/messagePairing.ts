// 工具调用与结果配对：把相邻的 tool_call + tool_result 合并为一项，
// 让前端在 SpecialistCard / AgentPanel 内只渲染一张"合并卡"，
// 减少视觉噪音与重复 header。
// 配对规则：相邻 (工具名相同) 才配对；不匹配的 result / 单独的 call 各自走单卡分支。

import type { AgentMessage } from '../hooks/useAgentChat';

export type RenderItem =
  | { kind: 'message'; msg: AgentMessage; key: string }
  | {
      kind: 'tool_pair';
      callId: string;
      toolName: string;
      toolInput: unknown;
      toolResult: string;
      key: string;
    }
  | { kind: 'tool_call'; msg: AgentMessage; key: string }
  | { kind: 'tool_result'; msg: AgentMessage; key: string };

/**
 * 把 messages 数组变换为 RenderItem 列表：相邻的 tool_call + tool_result
 * 配对成一个 tool_pair，单独存在的 tool_call / tool_result 各自走单分支。
 */
export function pairToolMessages(messages: AgentMessage[]): RenderItem[] {
  const items: RenderItem[] = [];
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i];
    if (msg.type === 'tool_call') {
      const next = messages[i + 1];
      if (
        next
        && next.type === 'tool_result'
        && (next.toolName ?? '') === (msg.toolName ?? '')
      ) {
        items.push({
          kind: 'tool_pair',
          callId: msg.id,
          toolName: msg.toolName || '',
          toolInput: msg.toolInput,
          toolResult: next.content || '',
          key: msg.id,
        });
        i += 2;
        continue;
      }
      // 流式过程中 tool_result 还没到，单独渲染 tool_call
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
