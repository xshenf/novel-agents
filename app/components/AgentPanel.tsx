'use client';

import { Loader2, HelpCircle } from 'lucide-react';
import { useWorkspace } from '../workspace-context';
import { Markdown } from './Markdown';

export function AgentPanel() {
  const { store, agent, layout } = useWorkspace();
  const { aiPanelWidth, setAiPanelWidth } = layout;
  const {
    chatInput, setChatInput, agentMessages, setAgentMessages,
    isAgentLoading, agentBottomRef, handleSendAgentMessage,
    pendingConfirm, resolveConfirm,
  } = agent;

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
          const onMove = (ev: MouseEvent) => {
            const delta = startX - ev.clientX;
            const newWidth = Math.max(240, Math.min(600, startWidth + delta));
            setAiPanelWidth(newWidth);
            localStorage.setItem('layout_ai_panel_width', String(newWidth));
          };
          const onUp = () => {
            handle.classList.remove('active');
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
          };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        }}
      />

      <div className="workspace-ai-panel" style={{ width: aiPanelWidth, minWidth: 240, maxWidth: 600, flexShrink: 0 }}>
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.01)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dark)' }}>协同创作模式：5位智能体在线</span>
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

          <div className="agent-chat-history">
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
              agentMessages.map((msg) => {
                switch (msg.type) {
                  case 'user':
                    return (
                      <div key={msg.id} className="agent-bubble agent-bubble-user">
                        {msg.content}
                      </div>
                    );
                  case 'thinking':
                    return (
                      <div key={msg.id} className="agent-bubble agent-bubble-thinking">
                        <Loader2 className="animate-spin" size={12} style={{ marginRight: '6px' }} />
                        <span>{msg.label || msg.agent} 正在思考中...</span>
                      </div>
                    );
                  case 'tool_call':
                    return (
                      <div key={msg.id} className="agent-bubble agent-bubble-tool-call">
                        <div className="agent-tool-header">
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>智能体调用了工具</span>
                          <span className="agent-tool-name">{msg.toolName}</span>
                        </div>
                        {msg.toolInput && typeof msg.toolInput === 'object' && Object.keys(msg.toolInput).length > 0 && (
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
                  case 'tool_result':
                    return (
                      <div key={msg.id} className="agent-bubble agent-bubble-tool-result">
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>工具执行结果:</div>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto', fontSize: '11px', fontFamily: 'monospace' }}>
                          {msg.content}
                        </pre>
                      </div>
                    );
                  case 'delegate':
                    return (
                      <div key={msg.id} className="agent-bubble agent-bubble-delegate">
                        <span className={`agent-role-tag agent-${msg.from || 'orchestrator'}`} style={{ marginRight: '6px' }}>{msg.fromLabel || '编导'}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginRight: '6px' }}>── 任务委派 ──►</span>
                        <span className={`agent-role-tag agent-${msg.to || 'planner'}`}>{msg.toLabel || '专家'}</span>
                      </div>
                    );
                  case 'final_answer':
                    return (
                      <div key={msg.id} className={`agent-bubble agent-bubble-answer ${msg.streaming ? 'streaming' : ''}`}>
                        <div className="agent-answer-header">
                          <span className={`agent-role-tag agent-${msg.agent || 'orchestrator'}`} style={{ marginBottom: '6px' }}>
                            {msg.label || '智能体'}
                          </span>
                        </div>
                        <div style={{ lineHeight: '1.6' }}>
                          <Markdown content={msg.content} />
                        </div>
                      </div>
                    );
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
          </div>

          {!store.apiKey && (
            <div style={{ margin: '0 12px 8px', padding: '8px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '6px', fontSize: '11px', color: 'var(--accent-warning)' }}>
              提示：当前为模拟对话，点击右上角「AI 模型设置」填入 API Key 即可进行真实协作创作。
            </div>
          )}

          {pendingConfirm && (
            <div style={{ margin: '0 12px 8px', padding: '10px 12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: 'var(--accent-warning)', marginBottom: '8px', lineHeight: 1.5 }}>
                {pendingConfirm.payload.action || '操作'}「{pendingConfirm.payload.target || ''}」属于已锁定项，确认要继续吗？
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                  disabled={isAgentLoading}
                  onClick={() => resolveConfirm('confirm')}
                >
                  确认继续
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
            <button type="submit" className="btn btn-primary" style={{ padding: '10px' }} disabled={isAgentLoading || !!pendingConfirm}>
              {isAgentLoading ? <Loader2 className="animate-spin" size={14} /> : '发送'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
