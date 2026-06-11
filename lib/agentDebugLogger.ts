/**
 * Agent 调试日志模块
 *
 * 将 LLM 完整提示词、响应、工具调用等写入 .debug/logs/ 下的 JSONL 文件，
 * 每次请求一个独立文件，方便事后分析。
 *
 * 日志文件格式：{timestamp}_{projectId}.jsonl
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

/**
 * 创建一次 agent 请求的调试日志器。
 * @param projectId 项目 ID
 * @param tag 可选标签（如 "agent" 或 "direct"），用于区分文件
 */
export function createAgentDebugLogger(projectId: string, tag?: string): AgentDebugLogger {
  const noop: AgentDebugLogger = {
    logLLMStart() {}, logLLMEnd() {}, logToolStart() {}, logToolEnd() {},
    logDirectCall() {}, log() {}, filePath: '',
  };

  if (!isEnabled()) return noop;

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const shortId = projectId.slice(0, 12) || 'unknown';
  const suffix = tag ? `_${tag}` : '';
  const fileName = `${ts}_${shortId}${suffix}.jsonl`;
  const filePath = join(LOG_DIR, fileName);

  ensureDir();

  function write(entry: Record<string, any>) {
    try {
      const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
      appendFileSync(filePath, line + '\n', 'utf-8');
    } catch { /* 写日志失败不应影响主流程 */ }
  }

  return {
    filePath,

    logLLMStart(agent: string, messages: any[]) {
      // messages 是 langchain BaseMessage[] 或 OpenAI 格式的消息数组
      // 序列化为可读格式
      const serialized = messages.map((m: any) => {
        if (typeof m === 'string') return { role: 'raw', content: m };
        // langchain 消息
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
        // 提取 tool_calls
        const toolCalls = m.tool_calls || m.additional_kwargs?.tool_calls;
        return { role, content, ...(toolCalls ? { tool_calls: toolCalls } : {}) };
      });
      write({ event: 'llm_start', agent, data: { messages: serialized } });
    },

    logLLMEnd(agent: string, output: any) {
      let content = '';
      let toolCalls: any[] = [];
      if (typeof output === 'string') {
        content = output;
      } else if (output) {
        // langchain AIMessage
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
