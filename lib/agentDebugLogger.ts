/**
 * Agent 调试日志模块
 *
 * 将 LLM 完整提示词、响应、工具调用等写入 .debug/logs/ 下的 JSONL 文件，
 * 同一对话（同一 projectId）的所有日志（含子 agent / 直接 API 调用）追加到同一个文件。
 *
 * 日志文件格式：{projectId}.jsonl
 * 每行一个 JSON 对象，包含 ts(时间戳)、event(事件类型)、agent(当前agent)、data(详细数据)。
 *
 * 通过环境变量 AGENT_DEBUG=true 启用（默认启用）。
 */

import { mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

const LOG_DIR = join(process.cwd(), '.debug', 'logs');

let dirReady = false;
function ensureDir() {
  if (dirReady) return;
  try { mkdirSync(LOG_DIR, { recursive: true }); } catch { /* 已存在 */ }
  dirReady = true;
}

function isEnabled(): boolean {
  return process.env.AGENT_DEBUG !== 'false';
}

export interface AgentDebugLogger {
  /** LLM 开始生成：记录完整输入消息（system prompt + 历史对话 + 用户消息） */
  logLLMStart(agent: string, messages: any[]): void;
  /** LLM 生成结束：记录完整输出（助手回复 / 工具调用请求） */
  logLLMEnd(agent: string, output: any): void;
  /** 工具调用开始 */
  logToolStart(toolName: string, input: any): void;
  /** 工具调用结束 */
  logToolEnd(toolName: string, output: string): void;
  /** 直接 API 调用（非 agent 路径） */
  logDirectCall(provider: string, model: string, systemPrompt: string, userPrompt: string, response: string): void;
  /** 自定义事件 */
  log(event: string, data?: any): void;
  /** 日志文件路径（供调试输出） */
  filePath: string;
}

// ── 全局 logger 注册表：同一 projectId 共享同一个 logger 实例，日志追加到同一文件 ──
const loggerRegistry = new Map<string, AgentDebugLogger>();

/**
 * 设置全局 logger（由 route.ts 在请求开始时调用，确保后续 modelApi 等子调用复用同一文件）。
 */
export function setGlobalDebugLogger(projectId: string, logger: AgentDebugLogger): void {
  loggerRegistry.set(projectId, logger);
}

/**
 * 获取全局 logger（modelApi 等非 agent 路径使用，复用同一对话的日志文件）。
 * 返回 null 表示当前无活跃的 agent 会话。
 */
export function getGlobalDebugLogger(projectId?: string): AgentDebugLogger | null {
  if (projectId) return loggerRegistry.get(projectId) || null;
  // 无指定 projectId 时返回任意一个活跃 logger（兜底）
  for (const v of loggerRegistry.values()) return v;
  return null;
}

/**
 * 清理全局 logger（agent 请求结束时调用）。
 */
export function clearGlobalDebugLogger(projectId: string): void {
  loggerRegistry.delete(projectId);
}

function writeToFile(filePath: string, entry: Record<string, any>) {
  try {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
    appendFileSync(filePath, line + '\n', 'utf-8');
  } catch { /* 写日志失败不应影响主流程 */ }
}

function serializeMessages(messages: any[]) {
  return messages.map((m: any) => {
    if (typeof m === 'string') return { role: 'raw', content: m };
    const role = m._getType?.() || m.role || m.type || 'unknown';
    let content = '';
    if (typeof m.content === 'string') {
      content = m.content;
    } else if (Array.isArray(m.content)) {
      content = m.content.map((c: any) =>
        typeof c === 'string' ? c : (c.text || JSON.stringify(c))
      ).join('\n');
    } else {
      content = JSON.stringify(m.content);
    }
    const toolCalls = m.tool_calls || m.additional_kwargs?.tool_calls;
    return { role, content, ...(toolCalls ? { tool_calls: toolCalls } : {}) };
  });
}

function createLoggerImpl(filePath: string): AgentDebugLogger {
  const write = (entry: Record<string, any>) => writeToFile(filePath, entry);

  return {
    filePath,

    logLLMStart(agent: string, messages: any[]) {
      write({ event: 'llm_start', agent, data: { messages: serializeMessages(messages) } });
    },

    logLLMEnd(agent: string, output: any) {
      let content = '';
      let toolCalls: any[] = [];
      if (typeof output === 'string') {
        content = output;
      } else if (output) {
        content = typeof output.content === 'string' ? output.content : JSON.stringify(output.content);
        toolCalls = output.tool_calls || output.additional_kwargs?.tool_calls || [];
      }
      write({ event: 'llm_end', agent, data: { content, tool_calls: toolCalls } });
    },

    logToolStart(toolName: string, input: any) {
      write({ event: 'tool_start', agent: '', data: { tool: toolName, input } });
    },

    logToolEnd(toolName: string, output: string) {
      write({ event: 'tool_end', agent: '', data: { tool: toolName, output: output.slice(0, 5000) } });
    },

    logDirectCall(provider: string, model: string, systemPrompt: string, userPrompt: string, response: string) {
      write({
        event: 'direct_call',
        agent: '',
        data: { provider, model, systemPrompt, userPrompt, response: response.slice(0, 10000) },
      });
    },

    log(event: string, data?: any) {
      write({ event, agent: '', data });
    },
  };
}

const noop: AgentDebugLogger = {
  logLLMStart() {}, logLLMEnd() {}, logToolStart() {}, logToolEnd() {},
  logDirectCall() {}, log() {}, filePath: '',
};

/**
 * 创建或复用 agent 调试日志器。
 * - 同一 projectId 始终返回同一个 logger 实例，所有日志追加到 {projectId}.jsonl
 * - 通过 setGlobalDebugLogger / getGlobalDebugLogger 让 modelApi 等子调用也能写入同一文件
 */
export function createAgentDebugLogger(projectId: string, _tag?: string): AgentDebugLogger {
  if (!isEnabled()) return noop;

  // 复用已有 logger
  const existing = loggerRegistry.get(projectId);
  if (existing) return existing;

  const shortId = projectId.slice(0, 12) || 'unknown';
  const fileName = `${shortId}.jsonl`;
  const filePath = join(LOG_DIR, fileName);

  ensureDir();

  const logger = createLoggerImpl(filePath);
  loggerRegistry.set(projectId, logger);
  return logger;
}
