// AgentMessage 标准化工具：统一历史消息中的 agent 标签
// 注意：历史上 db 中 thinking 消息的 content 一直保留 "正在思考..." 占位符
// （流式推理内容仅通过 SSE 推到前端，从未回写 db），由后端在 LLM 结束后
// 显式回写真实内容或清空占位符；前端不再做无依据的清空，避免把后端已落库的
// 真实内容误清。

import { getAgentLabel } from '@/lib/agent/labels';

export interface AgentMessage {
  id: string;
  type: string;
  agent?: string;
  label?: string;
  content: string;
  toolName?: string;
  toolInput?: unknown;
  from?: string;
  fromLabel?: string;
  to?: string;
  toLabel?: string;
  streaming?: boolean;
  pending?: boolean;
}

/**
 * 清洗单条 AgentMessage：
 * 1. label 始终以 AGENT_LABELS 为准（未知 agent 保留原值兜底）
 * 2. fromLabel / toLabel 同样规范化
 * 3. 清除瞬态标记 streaming / pending —— 恢复的历史必然已结束，
 *    残留 true 会导致打字机光标 / 工具转圈永久显示（localStorage 降级路径会存到这些字段）
 */
export function normalizeAgentMessage<T extends AgentMessage>(msg: T): T {
  const next: AgentMessage = { ...msg };

  // label
  if (next.agent || next.label) {
    next.label = getAgentLabel(next.agent, next.label);
  }

  // fromLabel / toLabel（delegate 消息）
  if (next.from || next.fromLabel) {
    next.fromLabel = getAgentLabel(next.from, next.fromLabel);
  }
  if (next.to || next.toLabel) {
    next.toLabel = getAgentLabel(next.to, next.toLabel);
  }

  if (next.streaming) next.streaming = false;
  if (next.pending) next.pending = false;

  return next as T;
}

export function normalizeAgentMessages<T extends AgentMessage>(messages: T[]): T[] {
  if (!Array.isArray(messages) || messages.length === 0) return messages;
  return messages.map(normalizeAgentMessage);
}

