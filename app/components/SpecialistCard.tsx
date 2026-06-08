'use client';

import { Loader2, ChevronDown, ChevronRight, Brain, Wrench, Terminal } from 'lucide-react';
import { useState } from 'react';
import type { AgentMessage } from '../hooks/useAgentChat';
import { Markdown } from './Markdown';
import { getAgentLabel } from '@/lib/agent/labels';
import { getToolPurpose } from '../lib/toolPurpose';
import { pairToolMessages } from '../lib/messagePairing';
import { extractToolMessageContent } from '../lib/toolInputShape';
import { ToolPairBubble } from './ToolPairBubble';

interface SpecialistCardProps {
  agent: string;
  label: string;
  messages: AgentMessage[];
  isStreaming?: boolean;
  expandedThinking: Set<string>;
  setExpandedThinking: React.Dispatch<React.SetStateAction<Set<string>>>;
  expandedToolCalls: Set<string>;
  setExpandedToolCalls: React.Dispatch<React.SetStateAction<Set<string>>>;
  expandedToolResults: Set<string>;
  setExpandedToolResults: React.Dispatch<React.SetStateAction<Set<string>>>;
  expandedToolPairs: Set<string>;
  setExpandedToolPairs: React.Dispatch<React.SetStateAction<Set<string>>>;
}

const toggleSet = (prev: Set<string>, id: string) => {
  const next = new Set(prev);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

/** 统计卡片内工具调用数，显示在标题行 */
function countToolCalls(msgs: AgentMessage[]): number {
  return msgs.filter(m => m.type === 'tool_call').length;
}

export function SpecialistCard({
  agent, label, messages, isStreaming,
  expandedThinking, setExpandedThinking,
  expandedToolCalls, setExpandedToolCalls,
  expandedToolResults, setExpandedToolResults,
  expandedToolPairs, setExpandedToolPairs,
}: SpecialistCardProps) {
  // 卡片整体折叠：默认展开，用户可手动收起查看上下文
  const [collapsed, setCollapsed] = useState(false);

  const toolCount = countToolCalls(messages);
  const hasAnswer = messages.some(m => m.type === 'final_answer');
  // 折叠态行末预览：取首条 thinking 去掉换行后的前 80 字，让用户一眼看到卡片大致内容
  const firstThinking = messages.find(m => m.type === 'thinking' && (m.content || '').length > 0);
  const previewText = firstThinking
    ? (firstThinking.content || '').replace(/\s+/g, ' ').trim().slice(0, 80)
    : '';
  const colorVar = agent === 'lore_builder' ? 'var(--agent-lore)' : `var(--agent-${agent})`;

  return (
    <div className="specialist-card" style={{ '--card-accent': colorVar } as React.CSSProperties}>
      {/* 卡片头部 */}
      <div
        className={`specialist-card-header ${isStreaming ? 'is-streaming' : ''}`}
        onClick={() => setCollapsed(prev => !prev)}
      >
        <span className={`agent-role-tag agent-${agent}`}>{getAgentLabel(agent, label)}</span>
        {toolCount > 0 && (
          <span className="specialist-card-meta">
            {toolCount} 次工具调用
          </span>
        )}
        {hasAnswer && !isStreaming && (
          <span className="specialist-card-done">已完成</span>
        )}
        {isStreaming && (
          <Loader2 className="animate-spin" size={12} style={{ marginLeft: 'auto' }} />
        )}
        {!isStreaming && collapsed && previewText && (
          <span
            className="specialist-card-preview"
            style={{ marginLeft: hasAnswer ? '8px' : 'auto' }}
            title={previewText}
          >
            {previewText}
            {(firstThinking?.content || '').length > 80 ? '…' : ''}
          </span>
        )}
        <span className="specialist-card-chevron">
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>

      {/* 卡片内容体 */}
      {!collapsed && (
        <div className="specialist-card-body">
          {pairToolMessages(messages).map(item => {
            if (item.kind === 'tool_pair') {
              return (
                <ToolPairBubble
                  key={item.key}
                  toolName={item.toolName}
                  toolInput={item.toolInput}
                  toolResult={item.toolResult}
                  isExpanded={expandedToolPairs.has(item.callId)}
                  onToggle={() => setExpandedToolPairs(prev => toggleSet(prev, item.callId))}
                  normalized={item.normalized}
                />
              );
            }
            // 未配对的 tool_call / tool_result / 其他消息：仍走 SpecialistMessage
            const msg = item.kind === 'message' ? item.msg
              : item.kind === 'tool_call' ? item.msg
              : item.msg;
            return (
              <SpecialistMessage key={item.key} msg={msg}
                expandedThinking={expandedThinking}
                setExpandedThinking={setExpandedThinking}
                expandedToolCalls={expandedToolCalls}
                setExpandedToolCalls={setExpandedToolCalls}
                expandedToolResults={expandedToolResults}
                setExpandedToolResults={setExpandedToolResults}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/** 卡片内单条消息渲染 */
function SpecialistMessage({
  msg,
  expandedThinking, setExpandedThinking,
  expandedToolCalls, setExpandedToolCalls,
  expandedToolResults, setExpandedToolResults,
}: {
  msg: AgentMessage;
  expandedThinking: Set<string>;
  setExpandedThinking: React.Dispatch<React.SetStateAction<Set<string>>>;
  expandedToolCalls: Set<string>;
  setExpandedToolCalls: React.Dispatch<React.SetStateAction<Set<string>>>;
  expandedToolResults: Set<string>;
  setExpandedToolResults: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  switch (msg.type) {
    case 'thinking': {
      const hasReasoning = (msg.content || '').length > 0;
      const isExpanded = expandedThinking.has(msg.id);
      const previewText = hasReasoning
        ? msg.content.replace(/\s+/g, ' ').trim().slice(0, 60)
        : '';
      const toggle = () => {
        if (!hasReasoning) return;
        setExpandedThinking(prev => toggleSet(prev, msg.id));
      };
      return (
        <div
          className={`agent-bubble agent-bubble-thinking ${isExpanded ? 'is-expanded' : ''}`}
          style={{ cursor: hasReasoning ? 'pointer' : 'default' }}
          onClick={toggle}
        >
          <div className="agent-thinking-header">
            {hasReasoning ? (
              isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
            ) : (
              <Loader2 className="animate-spin" size={12} />
            )}
            <Brain size={12} style={{ opacity: 0.5 }} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {hasReasoning ? `思考过程（${msg.content.length}字）` : '思考中...'}
            </span>
            {hasReasoning && !isExpanded && previewText && (
              <span className="agent-thinking-preview" title={previewText}>
                {previewText}{msg.content.length > 60 ? '…' : ''}
              </span>
            )}
          </div>
          {hasReasoning && isExpanded && (
            <div className="agent-thinking-detail">{msg.content}</div>
          )}
        </div>
      );
    }

    case 'tool_call': {
      const isExpanded = expandedToolCalls.has(msg.id);
      const hasParams = msg.toolInput && typeof msg.toolInput === 'object' && Object.keys(msg.toolInput).length > 0;
      return (
        <div className="agent-bubble agent-bubble-tool-call">
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            onClick={() => setExpandedToolCalls(prev => toggleSet(prev, msg.id))}
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Wrench size={12} style={{ opacity: 0.6 }} />
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>调用工具</span>
            <span className="agent-tool-name">{msg.toolName}</span>
          </div>
          <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-dark)', lineHeight: 1.5 }}>
            用途：{getToolPurpose(msg.toolName, msg.toolInput)}
          </div>
          {hasParams && isExpanded && (
            <div className="agent-tool-params">
              {Object.entries(msg.toolInput).map(([k, v]) => (
                <div key={k} className="agent-tool-param">
                  <em>{k}:</em> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    case 'tool_result': {
      const isExpanded = expandedToolResults.has(msg.id);
      // 提取 langchain ToolMessage 内部 content（避免把 lc/type/id/kwargs 整坨显示出来）
      const resultText = extractToolMessageContent(msg.content || '');
      const preview = resultText.length > 120 ? resultText.slice(0, 120) + '…' : resultText;
      return (
        <div className="agent-bubble agent-bubble-tool-result">
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            onClick={() => setExpandedToolResults(prev => toggleSet(prev, msg.id))}
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Terminal size={12} style={{ opacity: 0.6 }} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>工具执行结果</span>
            {msg.toolName && <span className="agent-tool-name">{msg.toolName}</span>}
          </div>
          {!isExpanded && preview && (
            <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-dark)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {preview}
            </div>
          )}
          {isExpanded && (
            <pre style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto', fontSize: '11px', fontFamily: 'monospace' }}>
              {resultText}
            </pre>
          )}
        </div>
      );
    }

    case 'final_answer':
      return (
        <div className={`agent-bubble agent-bubble-answer ${msg.streaming ? 'streaming' : ''}`}>
          <div style={{ lineHeight: '1.6' }}>
            <Markdown content={msg.content} />
          </div>
        </div>
      );

    case 'confirm':
      return (
        <div className="agent-bubble" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: 'var(--accent-warning)', fontSize: '12px', lineHeight: 1.5 }}>
          {msg.content}
        </div>
      );

    case 'error':
      return (
        <div className="agent-bubble agent-bubble-error">{msg.content}</div>
      );

    default:
      return (
        <div className="agent-bubble agent-bubble-answer">
          <Markdown content={msg.content} />
        </div>
      );
  }
}
