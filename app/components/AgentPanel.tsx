'use client';

import { Loader2, HelpCircle, ChevronDown, ChevronRight, Brain, Wrench, Terminal, ArrowDown, Square } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace } from '../workspace-context';
import { Markdown } from './Markdown';
import { getToolPurpose } from '../lib/toolPurpose';
import { coerceToolInput, extractToolMessageContent } from '../lib/toolInputShape';
import { SpecialistCard } from './SpecialistCard';
import { ToolPairBubble } from './ToolPairBubble';
import type { AgentMessage } from '../hooks/useAgentChat';
import { getAgentLabel } from '@/lib/agent/labels';

export function AgentPanel() {
  const { store, agent, layout } = useWorkspace();
  const { aiPanelWidth, setAiPanelWidth } = layout;
  const {
    chatInput, setChatInput, agentMessages, setAgentMessages,
    isAgentLoading, agentBottomRef, setChatHistoryRef, isAtBottom, forceScrollToBottom,
    handleSendAgentMessage, pendingConfirm, resolveConfirm, cancelAgentRequest,
  } = agent;

  // 追踪展开的 thinking 消息 ID
  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set());

  // 编导的 final_answer 默认折叠（汇报文本常常很长），其他专家的 final_answer 仍直接展开
  const [expandedFinalAnswers, setExpandedFinalAnswers] = useState<Set<string>>(new Set());

  // 追踪展开的工具调用 / 工具结果 ID，默认全部收起，避免对话流被长参数/长结果撑爆
  const [expandedToolCalls, setExpandedToolCalls] = useState<Set<string>>(new Set());
  const [expandedToolResults, setExpandedToolResults] = useState<Set<string>>(new Set());
  // 工具调用+结果 配对卡 展开状态：默认折叠，header 单行显示
  const [expandedToolPairs, setExpandedToolPairs] = useState<Set<string>>(new Set());

  const toggleSet = (prev: Set<string>, id: string) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  // 风格基调选择状态（request_style 弹窗用）
  const [styleSelection, setStyleSelection] = useState<{ genre: string; tone: string }>({ genre: '', tone: '' });

  const agentDragCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => { return () => { agentDragCleanupRef.current?.(); }; }, []);

  // 消息分组：非编导的连续消息归入子智能体卡片，编导/用户/委派单独展示
  type RenderItem =
    | { kind: 'standalone', msg: AgentMessage }
    | { kind: 'specialist-group', groupId: string, agent: string, label: string, messages: AgentMessage[], isStreaming: boolean };

  const groupedItems = useMemo<RenderItem[]>(() => {
    const items: RenderItem[] = [];
    let currentGroup: RenderItem | null = null;

    const flushGroup = () => {
      if (currentGroup && currentGroup.kind === 'specialist-group') {
        items.push(currentGroup);
        currentGroup = null;
      }
    };

    for (const msg of agentMessages) {
      const isGroupable = ['thinking', 'tool_call', 'tool_result', 'final_answer', 'error'].includes(msg.type);
      const hasAgent = !!msg.agent;

      if (msg.type === 'user' || msg.type === 'delegate' || msg.type === 'confirm' || msg.type === 'system' || !hasAgent) {
        // 显式断点类型（用户/委派/确认/系统），或缺失 agent 字段的孤儿消息，单独展示并打断当前分组
        flushGroup();
        items.push({ kind: 'standalone', msg });
      } else if (isGroupable) {
        // 同一 agent 的连续消息（编导或子 agent）合并到一张卡片里
        if (currentGroup && currentGroup.kind === 'specialist-group' && currentGroup.agent === msg.agent) {
          currentGroup.messages.push(msg);
          currentGroup.isStreaming = currentGroup.isStreaming || !!msg.streaming;
        } else {
          flushGroup();
          currentGroup = {
            kind: 'specialist-group',
            groupId: `grp_${msg.agent}_${msg.id}`,
            agent: msg.agent!,
            label: msg.label || msg.agent!,
            messages: [msg],
            isStreaming: !!msg.streaming,
          };
        }
      } else {
        flushGroup();
        items.push({ kind: 'standalone', msg });
      }
    }
    flushGroup();
    return items;
  }, [agentMessages]);

  return (
    <>
      {/* 右侧拖拽条 */}
      <div
        className="resize-handle"
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startWidth = aiPanelWidth;
          const handle = e.currentTarget;
          handle.classList.add('active');
          document.body.style.userSelect = 'none';
          const lastWidthRef = { current: startWidth };
          const onMove = (ev: MouseEvent) => {
            const delta = startX - ev.clientX;
            const newWidth = Math.max(240, Math.min(600, startWidth + delta));
            lastWidthRef.current = newWidth;
            setAiPanelWidth(newWidth);
          };
          const onUp = () => {
            // localStorage 持久化仅在拖拽结束时写入，避免 mousemove 高频 I/O
            localStorage.setItem('layout_ai_panel_width', String(lastWidthRef.current));
            handle.classList.remove('active');
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            agentDragCleanupRef.current = null;
          };
          agentDragCleanupRef.current = onUp;
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        }}
      />

      <div className="workspace-ai-panel" style={{ width: aiPanelWidth, minWidth: 240, maxWidth: 600, flexShrink: 0 }}>
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.01)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dark)' }}>协同创作模式：编导 + 4位专家就绪</span>
            {agentMessages.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  store.showConfirm('确定清除当前的协作对话历史吗？', () => {
                    setAgentMessages([]);
                    if (store.currentProject) {
                      localStorage.removeItem(`agent_messages_${store.currentProject.id}`);
                      fetch(`/api/agent/history?projectId=${store.currentProject.id}`, {
                        method: 'DELETE',
                      }).catch(err => {
                        console.error('Failed to delete agent history from database:', err);
                      });
                    }
                  });
                }}
                style={{ padding: '2px 8px', fontSize: '10.5px', border: 'none', background: 'rgba(244,63,94,0.08)', color: '#fda4af', cursor: 'pointer' }}
              >
                清空历史
              </button>
            )}
          </div>

          <div className="agent-chat-history" ref={setChatHistoryRef}>
            {agentMessages.length === 0 ? (
              <div className="agent-empty-state">
                <HelpCircle size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                <div style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-muted)' }}>
                  我是您的智能创作助理。您可以向我下达任何小说创作指令，我会调度不同的专家来为您服务。
                </div>
                <div className="agent-example-grid">
                  <button
                    type="button"
                    className="agent-example-btn"
                    onClick={() => setChatInput('帮我一键规划全书核心设定，体裁是科幻，风格是赛博朋克')}
                  >
                    <strong>设定推演</strong>
                    <span style={{ display: 'block', fontSize: '10.5px', marginTop: '2px', opacity: 0.8 }}>一键规划全书核心大纲与能力体系</span>
                  </button>
                  <button
                    type="button"
                    className="agent-example-btn"
                    onClick={() => setChatInput('帮我在书中新增一个男二号角色，名字叫顾长生，身份背景是没落剑修')}
                  >
                    <strong>角色设定</strong>
                    <span style={{ display: 'block', fontSize: '10.5px', marginTop: '2px', opacity: 0.8 }}>在当前小说中新增一个设定好的角色资产</span>
                  </button>
                  <button
                    type="button"
                    className="agent-example-btn"
                    onClick={() => setChatInput('帮我自动写作第一章正文，要求描写男女主初次见面的冲突场景')}
                  >
                    <strong>章节创作</strong>
                    <span style={{ display: 'block', fontSize: '10.5px', marginTop: '2px', opacity: 0.8 }}>根据已有的设定大纲，起草第一章内容</span>
                  </button>
                  <button
                    type="button"
                    className="agent-example-btn"
                    onClick={() => setChatInput('帮我把当前编辑器的章节草稿进行润色，要求加强对话的交锋感和紧张氛围')}
                  >
                    <strong>文本润色与自检</strong>
                    <span style={{ display: 'block', fontSize: '10.5px', marginTop: '2px', opacity: 0.8 }}>对编辑器章节进行精细修改并做逻辑校验</span>
                  </button>
                </div>
              </div>
            ) : (
              groupedItems.map((item, idx, arr) => {
                // ── 子智能体分组卡片 ──
                if (item.kind === 'specialist-group') {
                  return (
                    <SpecialistCard
                      key={item.groupId}
                      agent={item.agent}
                      label={item.label}
                      messages={item.messages}
                      isStreaming={item.isStreaming}
                      expandedThinking={expandedThinking}
                      setExpandedThinking={setExpandedThinking}
                      expandedToolCalls={expandedToolCalls}
                      setExpandedToolCalls={setExpandedToolCalls}
                      expandedToolResults={expandedToolResults}
                      setExpandedToolResults={setExpandedToolResults}
                      expandedToolPairs={expandedToolPairs}
                      setExpandedToolPairs={setExpandedToolPairs}
                    />
                  );
                }

                // ── 独立消息：相邻 tool_call + tool_result 优先用 ToolPairBubble 合并渲染 ──
                if (item.kind === 'standalone' && item.msg.type === 'tool_call') {
                  const next = arr[idx + 1];
                  // callId 是后端在 SSE 透传的字段（tool_result.callId 对应 tool_call.id），
                  // 精确配对优先；历史数据没 callId 时回退到"相邻 + toolName 相等"
                  const nextCallId = next?.kind === 'standalone' ? next.msg.callId : undefined;
                  if (
                    next
                    && next.kind === 'standalone'
                    && next.msg.type === 'tool_result'
                    && ((nextCallId && nextCallId === item.msg.id) || (!nextCallId && (next.msg.toolName ?? '') === (item.msg.toolName ?? '')))
                  ) {
                    // merge 归一化字段
                    const merged = {
                      purpose: next.msg.purpose || item.msg.purpose,
                      writtenLength: next.msg.writtenLength != null ? next.msg.writtenLength : item.msg.writtenLength,
                      verb: next.msg.verb ?? item.msg.verb,
                      filteredInput: next.msg.filteredInput || item.msg.filteredInput,
                      resultText: next.msg.resultText || next.msg.content,
                    };
                    return (
                      <ToolPairBubble
                        key={`pair_${item.msg.id}`}
                        toolName={item.msg.toolName || ''}
                        toolInput={item.msg.toolInput}
                        toolResult={next.msg.content || ''}
                        isExpanded={expandedToolPairs.has(item.msg.id)}
                        onToggle={() => setExpandedToolPairs(prev => toggleSet(prev, item.msg.id))}
                        normalized={merged}
                        pending={!!item.msg.pending}  // 历史数据不显式 pending=false，传 false
                        synthetic={!!next.msg.synthetic}
                      />
                    );
                  }
                }

                // ── 独立消息 ──
                const msg = item.msg;
                switch (msg.type) {
                  case 'user':
                    return (
                      <div key={msg.id} className="agent-bubble agent-bubble-user">
                        {msg.content}
                      </div>
                    );
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
                        key={msg.id}
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
                            {getAgentLabel(msg.agent, msg.label)} {hasReasoning ? `思考过程（${msg.content.length}字）` : '思考中...'}
                          </span>
                          {hasReasoning && !isExpanded && previewText && (
                            <span className="agent-thinking-preview" title={previewText}>
                              {previewText}
                              {msg.content.length > 60 ? '…' : ''}
                            </span>
                          )}
                        </div>
                        {hasReasoning && isExpanded && (
                          <div className="agent-thinking-detail">
                            {msg.content}
                          </div>
                        )}
                      </div>
                    );
                  }
                  case 'tool_call': {
                    const isExpanded = expandedToolCalls.has(msg.id);
                    // 标准化 langchain 包装的 toolInput
                    const normInput = coerceToolInput(msg.toolInput);
                    const inputObj = (normInput && typeof normInput === 'object') ? normInput as Record<string, unknown> : null;
                    const hasParams = !!(inputObj && Object.keys(inputObj).length > 0);
                    const isPending = !!msg.pending;
                    return (
                      <div key={msg.id} className={`agent-bubble agent-bubble-tool-call ${isPending ? 'agent-tool-pending' : ''}`}>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                          onClick={() => setExpandedToolCalls(prev => toggleSet(prev, msg.id))}
                        >
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          {isPending
                            ? <Loader2 size={12} className="animate-spin" style={{ color: '#a5b4fc' }} />
                            : <Wrench size={12} style={{ opacity: 0.6 }} />
                          }
                          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                            {isPending ? '正在执行…' : '智能体调用了工具'}
                          </span>
                          <span className="agent-tool-name">{msg.toolName}</span>
                        </div>
                        <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-dark)', lineHeight: 1.5 }}>
                          用途：{getToolPurpose(msg.toolName, msg.toolInput)}
                        </div>
                        {hasParams && isExpanded && (
                          <div className="agent-tool-params">
                            {inputObj && Object.entries(inputObj).map(([k, v]) => {
                              const vStr: string = typeof v === 'object' && v !== null
                                ? JSON.stringify(v as Record<string, unknown>)
                                : String(v as string | number | boolean | bigint | symbol | null | undefined);
                              return (
                                <div key={k} className="agent-tool-param">
                                  <em>{k}:</em> {vStr}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }
                  case 'tool_result': {
                    const isExpanded = expandedToolResults.has(msg.id);
                    // 提取 langchain ToolMessage 内部 content
                    const resultText = extractToolMessageContent(msg.content || '');
                    const preview = resultText.length > 120 ? resultText.slice(0, 120) + '…' : resultText;
                    return (
                      <div key={msg.id} className="agent-bubble agent-bubble-tool-result">
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
                  case 'delegate':
                    return (
                      <div key={msg.id} className="agent-bubble agent-bubble-delegate">
                        <span className={`agent-role-tag agent-${msg.from || 'orchestrator'}`} style={{ marginRight: '6px' }}>{getAgentLabel(msg.from, msg.fromLabel) || '编导'}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginRight: '6px' }}>── 任务委派 ──►</span>
                        <span className={`agent-role-tag agent-${msg.to || 'planner'}`}>{getAgentLabel(msg.to, msg.toLabel) || '专家'}</span>
                      </div>
                    );
                  case 'final_answer': {
                    // 所有 final_answer 默认折叠，与子 agent 的输出行为一致；
                    // 流式中不折（避免内容持续追加时反复抖动）
                    const isCollapsible = !msg.streaming;
                    const isExpanded = expandedFinalAnswers.has(msg.id);
                    // 行尾预览：去掉 markdown 标记与多余空白后取首段，避免与展开后富文本混排时视觉打架
                    const previewText = (msg.content || '')
                      .replace(/[#*`>\-]+/g, ' ')
                      .replace(/\s+/g, ' ')
                      .trim()
                      .slice(0, 80);
                    const toggle = () => {
                      if (!isCollapsible) return;
                      setExpandedFinalAnswers(prev => toggleSet(prev, msg.id));
                    };
                    return (
                      <div
                        key={msg.id}
                        className={`agent-bubble agent-bubble-answer ${msg.streaming ? 'streaming' : ''}`}
                        onClick={isCollapsible ? toggle : undefined}
                        style={{ cursor: isCollapsible ? 'pointer' : 'default' }}
                      >
                        <div className="agent-answer-header">
                          <span className={`agent-role-tag agent-${msg.agent || 'orchestrator'}`} style={{ marginBottom: isCollapsible ? 0 : '6px' }}>
                            {msg.label || '智能体'}
                          </span>
                          {isCollapsible && (
                            isExpanded
                              ? <ChevronDown size={12} className="agent-collapse-chevron" />
                              : <ChevronRight size={12} className="agent-collapse-chevron" />
                          )}
                          {isCollapsible && !isExpanded && previewText && (
                            <span className="agent-final-answer-preview" title={previewText}>
                              {previewText}
                              {msg.content.length > 80 ? '…' : ''}
                            </span>
                          )}
                        </div>
                        {(!isCollapsible || isExpanded) && (
                          <div style={{ lineHeight: '1.6', marginTop: '6px' }}>
                            <Markdown content={msg.content} />
                          </div>
                        )}
                      </div>
                    );
                  }
                  case 'confirm':
                    return (
                      <div key={msg.id} className="agent-bubble" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: 'var(--accent-warning)', fontSize: '12px', lineHeight: 1.5 }}>
                        {msg.content}
                      </div>
                    );
                  case 'error':
                    return (
                      <div key={msg.id} className="agent-bubble agent-bubble-error">
                        {msg.content}
                      </div>
                    );
                  default:
                    return (
                      <div key={msg.id} className="agent-bubble agent-bubble-answer">
                        <Markdown content={msg.content} />
                      </div>
                    );
                }
              })
            )}
            <div ref={agentBottomRef} />
            {!isAtBottom && (
              <button
                type="button"
                className="agent-scroll-to-bottom"
                onClick={() => forceScrollToBottom('smooth')}
                aria-label="回到底部"
                title="回到底部"
              >
                <ArrowDown size={14} />
                <span>回到底部</span>
              </button>
            )}
          </div>

          {!store.apiKey && (
            <div style={{ margin: '0 12px 8px', padding: '8px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '6px', fontSize: '11px', color: 'var(--accent-warning)' }}>
              提示：当前为模拟对话，点击右上角「AI 模型设置」填入 API Key 即可进行真实协作创作。
            </div>
          )}

          {pendingConfirm && pendingConfirm.payload.type === 'request_style' ? (
            <div style={{ margin: '0 8px 8px', padding: '14px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '8px', maxHeight: '280px', overflowY: 'auto' }}>
              <div style={{ fontSize: '12px', color: '#a5b4fc', fontWeight: '600', marginBottom: '10px' }}>
                请选择题材和文风，Agent 将据此生成完整世界设定
              </div>
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>题材</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(pendingConfirm.payload.genres as string[] || []).map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setStyleSelection(prev => ({ ...prev, genre: prev.genre === g ? '' : g }))}
                      style={{
                        padding: '3px 10px', borderRadius: '14px', fontSize: '11px',
                        border: styleSelection.genre === g ? '1px solid var(--accent)' : '1px solid var(--border-light)',
                        background: styleSelection.genre === g ? 'rgba(99,102,241,0.15)' : 'transparent',
                        color: styleSelection.genre === g ? '#fff' : 'var(--text-muted)',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>文风</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(pendingConfirm.payload.tones as string[] || []).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setStyleSelection(prev => ({ ...prev, tone: prev.tone === t ? '' : t }))}
                      style={{
                        padding: '3px 10px', borderRadius: '14px', fontSize: '11px',
                        border: styleSelection.tone === t ? '1px solid var(--accent)' : '1px solid var(--border-light)',
                        background: styleSelection.tone === t ? 'rgba(99,102,241,0.15)' : 'transparent',
                        color: styleSelection.tone === t ? '#fff' : 'var(--text-muted)',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                  disabled={isAgentLoading || !styleSelection.genre || !styleSelection.tone}
                  onClick={() => resolveConfirm({ genre: styleSelection.genre, tone: styleSelection.tone })}
                >
                  确定并继续
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                  disabled={isAgentLoading}
                  onClick={() => resolveConfirm('cancel')}
                >
                  取消
                </button>
              </div>
            </div>
          ) : pendingConfirm && (
            <div style={{ margin: '0 12px 8px', padding: '10px 12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: 'var(--accent-warning)', marginBottom: '8px', lineHeight: 1.5 }}>
                {pendingConfirm.payload.action === 'continue_limit'
                  ? '执行轮次已达上限，已完成部分已保存。点击继续可从断点处接续执行。'
                  : `${pendingConfirm.payload.action || '操作'}「${pendingConfirm.payload.target || ''}」属于已锁定项，确认要继续吗？`}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                  disabled={isAgentLoading}
                  onClick={() => resolveConfirm(pendingConfirm.payload.action === 'continue_limit' ? 'continue_limit' : 'confirm')}
                >
                  {pendingConfirm.payload.action === 'continue_limit' ? '继续执行' : '确认继续'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                  disabled={isAgentLoading}
                  onClick={() => resolveConfirm('cancel')}
                >
                  取消
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSendAgentMessage} className="chat-input-area">
            <input
              type="text"
              className="input"
              placeholder="向创作智能体下达指令..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={isAgentLoading || !!pendingConfirm}
            />
            {isAgentLoading ? (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '10px', background: 'rgba(244,63,94,0.12)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.3)' }}
                onClick={cancelAgentRequest}
                title="停止生成"
              >
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button type="submit" className="btn btn-primary" style={{ padding: '10px' }} disabled={!!pendingConfirm}>
                发送
              </button>
            )}
          </form>
        </div>
      </div>
    </>
  );
}
