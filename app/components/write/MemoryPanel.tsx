'use client';

import { Brain, ChevronDown, ChevronUp, Pencil, Check, X, Users, Flag, Clock, Eye, Loader2, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { useWorkspace } from '../../workspace-context';

// 行内可编辑文本：点击进入编辑，保存写回。用于人工校对人物状态 / 章节摘要。
function EditableText({ value, onSave, placeholder }: { value: string; onSave: (v: string) => void | Promise<void>; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const startEdit = () => { setDraft(value); setEditing(true); };

  if (!editing) {
    return (
      <div
        onClick={startEdit}
        style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', cursor: 'text', color: value ? '#d1d5db' : 'var(--text-muted)' }}
        title="点击编辑"
      >
        <span style={{ flex: 1, whiteSpace: 'pre-wrap' }}>{value || placeholder || '（空）'}</span>
        <Pencil size={11} style={{ opacity: 0.5, flexShrink: 0, marginTop: '2px' }} />
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        autoFocus
        rows={2}
        style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '5px', color: '#fff', fontSize: '12px', padding: '6px 8px', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
      />
      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
        <button onClick={() => { setEditing(false); onSave(draft); }} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', padding: '3px 8px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: 'var(--accent-success)', borderRadius: '4px', cursor: 'pointer' }}>
          <Check size={11} /> 保存
        </button>
        <button onClick={() => { setEditing(false); setDraft(value); }} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', padding: '3px 8px', background: 'transparent', border: '1px solid var(--border-light)', color: 'var(--text-muted)', borderRadius: '4px', cursor: 'pointer' }}>
          <X size={11} /> 取消
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: 'rgba(165, 180, 252, 0.9)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
      {icon}{children}
    </div>
  );
}

const boxStyle: React.CSSProperties = {
  padding: '8px 10px', background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.04)',
  borderRadius: '6px', fontSize: '12px', lineHeight: 1.6, maxHeight: '180px', overflowY: 'auto',
};

// 写作页「AI 记忆」面板：让 AI 当前记得什么可见，并允许人工校对（改记忆比改正文更能阻断跑偏）。
export function MemoryPanel() {
  const { store, chapterMemory } = useWorkspace();
  const { synopsis, activeCharacters, openForeshadowing, timeline, saveCharacterState, saveChapterSummary, preview, previewLoading, fetchPreview } = chapterMemory;
  const [open, setOpen] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  if (!store.currentChapter) return null;

  return (
    <div className="glass-card" style={{ margin: '12px 30px 0', padding: '12px 16px', background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.18)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: open ? '12px' : 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <Brain size={14} style={{ color: '#34d399' }} />
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', flex: 1 }}>AI 记忆</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>校对此处可阻断跑偏</span>
        {open ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
      </div>

      {open && (
        <>
          {/* 登场人物当前状态（可编辑） */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <SectionLabel icon={<Users size={11} />}>本章登场人物 · 当前状态</SectionLabel>
            <div style={boxStyle}>
              {activeCharacters.length === 0 ? (
                <span style={{ color: 'var(--text-muted)' }}>暂无人物，请先在世界设定中创建</span>
              ) : activeCharacters.map(c => (
                <div key={c.id} style={{ marginBottom: '8px' }}>
                  <span style={{ color: '#a5b4fc', fontWeight: 600 }}>{c.name}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: '4px', fontSize: '11px' }}>{c.role}</span>
                  <EditableText value={c.currentState} placeholder="（未设定当前状态）" onSave={(v) => saveCharacterState(c.id, v)} />
                </div>
              ))}
            </div>
          </div>

          {/* 未回收伏笔台账 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <SectionLabel icon={<Flag size={11} />}>未回收伏笔（{openForeshadowing.length}）</SectionLabel>
            <div style={boxStyle}>
              {openForeshadowing.length === 0 ? (
                <span style={{ color: 'var(--text-muted)' }}>暂无未回收伏笔</span>
              ) : openForeshadowing.map((f, i) => (
                <div key={i} style={{ marginBottom: '4px', color: '#d1d5db' }}>
                  · {f.text}
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '6px' }}>（{f.from}）</span>
                </div>
              ))}
            </div>
          </div>

          {/* 全书滚动摘要（摘要可编辑） */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <SectionLabel icon={<ScrollText size={11} />}>全书摘要（{synopsis.length} 章）</SectionLabel>
            <div style={boxStyle}>
              {synopsis.length === 0 ? (
                <span style={{ color: 'var(--text-muted)' }}>暂无章节摘要，生成章节后会自动复盘</span>
              ) : synopsis.map(s => (
                <div key={s.id} style={{ marginBottom: '8px' }}>
                  <div style={{ color: '#a5b4fc', fontSize: '11px', marginBottom: '2px' }}>{s.title}</div>
                  <EditableText value={s.summary} onSave={(v) => saveChapterSummary(s.id, v)} />
                </div>
              ))}
            </div>
          </div>

          {/* 时间线 */}
          {timeline.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <SectionLabel icon={<Clock size={11} />}>关键时间线</SectionLabel>
              <div style={boxStyle}>
                {timeline.map((t, i) => (
                  <div key={i} style={{ marginBottom: '3px', color: '#d1d5db' }}>
                    · {t.text}
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '6px' }}>（{t.from}）</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI 实际检索到的记忆（忠实暴露 top-3 截断，作跑偏预警） */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              onClick={() => { setShowPreview(s => !s); if (!preview) fetchPreview(store.currentChapter?.title || ''); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start', fontSize: '12px', padding: '5px 10px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', color: '#c7d2fe', borderRadius: '6px', cursor: 'pointer' }}
              title="查看 AI 写作时实际会检索到的记忆上下文"
            >
              {previewLoading ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
              AI 实际检索到的记忆
            </button>
            {showPreview && (
              <div style={{ ...boxStyle, maxHeight: '240px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontStyle: 'italic' }}>
                  以下是 AI 本章实际会读到的记忆。若上面的人物状态 / 伏笔在这里没出现，说明可能被截断、有跑偏风险。
                </div>
                <pre style={{ whiteSpace: 'pre-wrap', color: '#d1d5db', margin: 0, fontFamily: 'inherit', fontSize: '12px' }}>
                  {previewLoading ? '检索中...' : (preview ?? '点击上方按钮加载')}
                </pre>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
