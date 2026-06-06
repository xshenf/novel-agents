'use client';

import { Lock, Unlock, ArrowUp, ArrowDown, Sparkles, Edit3, Trash2, Loader2 } from 'lucide-react';
import type { OutlineChapter } from '@/lib/outlineParser';
import type { OutlineTreeController } from './types';

interface ChapterCardProps {
  ctrl: OutlineTreeController;
  sec: OutlineChapter;
  vIdx: number;
  cIdx: number;
  volLength: number;
  isRegening: boolean;
  isEditingChap: boolean;
  isWritten: boolean;
}

export function ChapterCard({
  ctrl,
  sec,
  vIdx,
  cIdx,
  volLength,
  isRegening,
  isEditingChap,
  isWritten,
}: ChapterCardProps) {
  const {
    editChapterForm,
    setEditChapterForm,
    setEditingChapterPath,
    saveChapterEditing,
    toggleLockChapter,
    handleMoveChapter,
    handleAiRegenChapter,
    handleDeleteChapter,
  } = ctrl;

  return (
    <div
      style={{
        border: isEditingChap ? '1px solid rgba(99,102,241,0.35)' : '1px solid rgba(255,255,255,0.03)',
        background: isEditingChap ? 'rgba(99,102,241,0.02)' : 'rgba(255,255,255,0.01)',
        borderRadius: '6px',
        padding: '12px 14px',
        transition: 'all 0.2s',
        position: 'relative'
      }}
    >
      {isRegening && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15,15,25,0.85)', borderRadius: '6px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', zIndex: 10
        }}>
          <Loader2 size={13} className="spin" color="#38bdf8" />
          <span style={{ fontSize: '11px', color: '#38bdf8' }}>AI 正在推演本章细纲...</span>
        </div>
      )}

      {isEditingChap && editChapterForm ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '600' }}>编辑章节大纲</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={saveChapterEditing}
                style={{ fontSize: '10px', color: '#4ade80', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingChapterPath(null);
                  setEditChapterForm(null);
                }}
                style={{ fontSize: '10px', color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
              >
                取消
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>章节名</label>
            <input
              type="text"
              className="input"
              value={editChapterForm.title}
              onChange={e => setEditChapterForm({ ...editChapterForm, title: e.target.value })}
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '6px', color: '#fff', fontSize: '12px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>本章剧情简述与推进</label>
            <textarea
              className="textarea"
              rows={3}
              value={editChapterForm.content}
              onChange={e => setEditChapterForm({ ...editChapterForm, content: e.target.value })}
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '6px', color: '#fff', fontSize: '12px', lineHeight: '1.5' }}
            />
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                fontSize: '12px',
                fontWeight: '600',
                color: sec.isLocked ? '#fbbf24' : '#fff'
              }}>
                {sec.title}
              </span>

              <span style={{
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '8px',
                background: isWritten ? 'rgba(74, 222, 128, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                color: isWritten ? '#4ade80' : 'var(--text-dark)',
                fontWeight: '500'
              }}>
                {isWritten ? '已写正文' : '未开始'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => toggleLockChapter(vIdx, cIdx)}
                style={{ border: 'none', background: 'transparent', color: sec.isLocked ? '#fbbf24' : 'rgba(255,255,255,0.2)', cursor: 'pointer', padding: '2px' }}
                title={sec.isLocked ? "章节已锁定（推演时大纲不被覆盖）" : "锁定章节大纲"}
              >
                {sec.isLocked ? <Lock size={11} /> : <Unlock size={11} />}
              </button>

              <button
                type="button"
                onClick={() => handleMoveChapter(vIdx, cIdx, 'up')}
                disabled={cIdx === 0}
                style={{ border: 'none', background: 'transparent', color: cIdx === 0 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)', cursor: cIdx === 0 ? 'not-allowed' : 'pointer', padding: '2px' }}
              >
                <ArrowUp size={11} />
              </button>

              <button
                type="button"
                onClick={() => handleMoveChapter(vIdx, cIdx, 'down')}
                disabled={cIdx === volLength - 1}
                style={{ border: 'none', background: 'transparent', color: cIdx === volLength - 1 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)', cursor: cIdx === volLength - 1 ? 'not-allowed' : 'pointer', padding: '2px' }}
              >
                <ArrowDown size={11} />
              </button>

              <button
                type="button"
                onClick={() => handleAiRegenChapter(vIdx, cIdx)}
                style={{ fontSize: '10px', color: '#38bdf8', background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.12)', padding: '1px 6px', borderRadius: '3px', cursor: 'pointer' }}
                title="AI 智能推演重写本章细纲"
              >
                <Sparkles size={9} style={{ marginRight: '2px', display: 'inline-block', verticalAlign: 'middle' }} />
                <span style={{ verticalAlign: 'middle' }}>AI推演</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingChapterPath({ volIdx: vIdx, chapIdx: cIdx });
                  setEditChapterForm(JSON.parse(JSON.stringify(sec)));
                }}
                style={{ fontSize: '10px', color: 'var(--accent)', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)', padding: '1px 6px', borderRadius: '3px', cursor: 'pointer' }}
              >
                <Edit3 size={9} style={{ marginRight: '2px', display: 'inline-block', verticalAlign: 'middle' }} />
                <span style={{ verticalAlign: 'middle' }}>编辑</span>
              </button>

              <button
                type="button"
                onClick={() => handleDeleteChapter(vIdx, cIdx)}
                style={{ fontSize: '10px', color: '#ef4444', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)', padding: '1px 6px', borderRadius: '3px', cursor: 'pointer' }}
              >
                <Trash2 size={9} style={{ marginRight: '2px', display: 'inline-block', verticalAlign: 'middle' }} />
                <span style={{ verticalAlign: 'middle' }}>删除</span>
              </button>
            </div>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 6px 0', whiteSpace: 'pre-wrap' }}>
            {sec.content || '暂无详细的大纲推进说明，点击编辑或AI推演来完善剧情内容...'}
          </p>

          {sec.details.length > 0 && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              marginTop: '4px',
              borderTop: '1px solid rgba(255,255,255,0.02)',
              paddingTop: '6px'
            }}>
              {sec.details.map((det, dIdx) => (
                <div
                  key={dIdx}
                  style={{
                    fontSize: '10.5px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    color: 'var(--text-dark)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <strong style={{ color: 'rgba(255,255,255,0.45)' }}>{det.key}:</strong>
                  <span>{det.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
