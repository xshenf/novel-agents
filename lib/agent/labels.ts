// Agent 角色的展示标签与配色常量
// 与 prompts.ts 解耦，方便客户端组件轻量 import（避免把整套 prompt 模板打进前端 bundle）

export type AgentRole =
  | 'orchestrator'
  | 'planner'
  | 'lore_builder'
  | 'writer'
  | 'editor'
  | 'continuity_keeper';

export const AGENT_LABELS: Record<AgentRole, string> = {
  orchestrator: '编导',
  planner: '策划',
  lore_builder: '世界观师',
  writer: '写手',
  editor: '编辑',
  continuity_keeper: '连续性官',
};

export const AGENT_COLORS: Record<AgentRole, string> = {
  orchestrator: 'agent-orchestrator',
  planner: 'agent-planner',
  lore_builder: 'agent-lore',
  writer: 'agent-writer',
  editor: 'agent-editor',
  continuity_keeper: 'agent-continuity',
};

/**
 * 取得一个 agent 的中文展示名。
 * 任何来源（历史消息/旧版/手写英文）都会被规范化到当前最新的中文标签；
 * 未知 agent 兜底返回 agent 字符串本身。
 */
export function getAgentLabel(agent?: string | null, fallback?: string): string {
  if (!agent) return fallback || '';
  return (AGENT_LABELS as Record<string, string>)[agent] ?? fallback ?? agent;
}
