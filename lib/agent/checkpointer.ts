import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';

// 持久化 Checkpointer：落盘到 data/agent-checkpoints.db，进程重启/热重载后对话与断点状态仍可恢复。
// 用全局单例复用同一个 better-sqlite3 连接，避免开发环境热重载反复打开文件句柄。
const globalForAgent = globalThis as unknown as {
  agentCheckpointer: SqliteSaver | undefined;
};

export const checkpointer = globalForAgent.agentCheckpointer ?? SqliteSaver.fromConnString('./data/agent-checkpoints.db');
globalForAgent.agentCheckpointer = checkpointer;
