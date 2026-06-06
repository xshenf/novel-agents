'use client';

import { BookOpen, ChevronDown, ChevronRight, Lock, Unlock, ArrowUp, ArrowDown, Sparkles, Edit3, Trash2, Plus, Loader2, Check, X } from 'lucide-react';
import type { OutlineVolume } from '@/lib/outlineParser';
import type { OutlineTreeController } from './types';
import { ChapterCard } from './ChapterCard';

interface VolumeCardProps {
  ctrl: OutlineTreeController;
  vol: OutlineVolume;
  vIdx: number;
  volStatus: '未开始' | '进行中' | '已完成';
  matchedChaps: { ch: any; cIdx: number; matches: boolean }[];
  isCollapsed: boolean;
  isVolRegening: boolean;
  isEditing: boolean;
  flatChapters: (any & { volIdx: number; chapIdx: number })[];
}

export function VolumeCard({
  ctrl,
  vol,
  vIdx,
  volStatus,
  matchedChaps,
  isCollapsed,
  isVolRegening,
  isEditing,
  flatChapters,
}: VolumeCardProps) {
  const {
    localSections,
    collapsedVolumes,
    setEditingVolumeIdx,
    setEditVolumeForm,
    editVolumeForm,
    saveVolumeEditing,
    setCollapsedVolumes,
    toggleLockVolume,
    handleMoveVolume,
    handleDeleteVolume,
    setAiPromptVolIdx,
    setAiPromptText,
    aiPromptVolIdx,
    aiPromptText,
    handleAiRegenVolume,
    cancelAiRegen,
    handleInsertChapter,
    editingChapterPath,
    setEditingChapterPath,
    setEditChapterForm,
    regeningIndex,
    store,
  } = ctrl;

  return (
    <div
      className="glass-card animate-fade-in"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.005) 100%)',
        border: isEditing
          ? '1px solid rgba(99,102,241,0.45)'
          : vol.isLocked
            ? '1px solid rgba(251,191,36,0.35)'
            : '1px solid rgba(255,255,255,0.04)',
        borderRadius: '12px',
        boxShadow: vol.isLocked
          ? '0 4px 24px rgba(251,191,36,0.05)'
          : '0 4px 20px rgba(0,0,0,0.12)',
        transition: 'all 0.25s ease',
        overflow: 'hidden',
        ...(isVolRegening && {
          border: '1px solid rgba(56,189,248,0.5)',
          boxShadow: '0 0 0 0 rgba(56,189,248,0.45), 0 4px 24px rgba(56,189,248,0.15)',
          animation: 'aiPulse 1.6s ease-in-out infinite',
          background: 'linear-gradient(135deg, rgba(56,189,248,0.04) 0%, rgba(56,189,248,0.01) 100%)'
        })
      }}
    >
      {isVolRegening && (
        <div style={{
          padding: '6px 12px',
          background: 'rgba(56,189,248,0.08)',
          borderBottom: '1px solid rgba(56,189,248,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Loader2 size={13} className="spin" color="#38bdf8" />
            <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '500' }}>AI 正在推演本卷剧情走向与看点...</span>
          </div>
          <button
            type="button"
            onClick={cancelAiRegen}
            style={{
              fontSize: '10px', color: 'var(--text-muted)',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '1px 8px', borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            取消
          </button>
        </div>
      )}

      {isEditing && editVolumeForm ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '600' }}>
              修改分卷大纲
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={saveVolumeEditing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  color: '#4ade80',
                  background: 'rgba(74,222,128,0.1)',
                  border: '1px solid rgba(74,222,128,0.2)',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                <Check size={11} />
                <span>保存</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingVolumeIdx(null);
                  setEditVolumeForm(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  color: '#f87171',
                  background: 'rgba(248,113,113,0.1)',
                  border: '1px solid rgba(248,113,113,0.2)',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                <X size={11} />
                <span>取消</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>分卷名称</label>
            <input
              type="text"
              className="input"
              value={editVolumeForm.title}
              onChange={e => setEditVolumeForm({ ...editVolumeForm, title: e.target.value })}
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>分卷剧情走向描述</label>
            <textarea
              className="textarea"
              rows={4}
              value={editVolumeForm.content}
              onChange={e => setEditVolumeForm({ ...editVolumeForm, content: e.target.value })}
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '13px', lineHeight: '1.6' }}
            />
          </div>
        </div>
      ) : (
        <div style={{ padding: '20px' }}>
          {/* 卷头部 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '10px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setCollapsedVolumes({ ...collapsedVolumes, [vIdx]: !isCollapsed })}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0
                }}
              >
                {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BookOpen size={14} color="#6366f1" />
                <h4 style={{ fontSize: '15px', fontWeight: '700', color: vol.isLocked ? '#fbbf24' : '#fff', margin: 0 }}>
                  {vol.title}
                </h4>

                <span style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: volStatus === '已完成' ? 'rgba(74, 222, 128, 0.1)' : volStatus === '进行中' ? 'rgba(249, 115, 22, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                  color: volStatus === '已完成' ? '#4ade80' : volStatus === '进行中' ? '#fb923c' : 'var(--text-muted)',
                  fontWeight: '600'
                }}>
                  {volStatus}
                </span>

                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {vol.chapters.length} 章
                </span>
              </div>
            </div>

            {/* 卷右侧控制按钮 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => toggleLockVolume(vIdx)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: vol.isLocked ? '#fbbf24' : 'rgba(255,255,255,0.25)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px',
                  transition: 'all 0.2s'
                }}
                title={vol.isLocked ? "已锁定（更新大纲时此卷剧情走向将受保护）" : "锁定此分卷"}
              >
                {vol.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
              </button>

              <button
                type="button"
                onClick={() => handleMoveVolume(vIdx, 'up')}
                disabled={vIdx === 0}
                style={{ border: 'none', background: 'transparent', color: vIdx === 0 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)', cursor: vIdx === 0 ? 'not-allowed' : 'pointer' }}
                title="上移卷"
              >
                <ArrowUp size={12} />
              </button>
              <button
                type="button"
                onClick={() => handleMoveVolume(vIdx, 'down')}
                disabled={vIdx === localSections.length - 1}
                style={{ border: 'none', background: 'transparent', color: vIdx === localSections.length - 1 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)', cursor: vIdx === 0 || vIdx === localSections.length - 1 ? 'not-allowed' : 'pointer' }}
                title="下移卷"
              >
                <ArrowDown size={12} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setAiPromptVolIdx(vIdx);
                  setAiPromptText('');
                }}
                style={{
                  fontSize: '11px',
                  color: '#38bdf8',
                  background: 'rgba(56,189,248,0.06)',
                  border: '1px solid rgba(56,189,248,0.15)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
                title="AI 智能为本卷生成/完善大纲剧情走向"
              >
                <Sparkles size={11} />
                <span>AI推演</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingVolumeIdx(vIdx);
                  setEditVolumeForm(JSON.parse(JSON.stringify(vol)));
                }}
                style={{ fontSize: '11px', color: 'var(--accent)', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
              >
                <Edit3 size={11} />
                <span>编辑</span>
              </button>

              <button
                type="button"
                onClick={() => handleDeleteVolume(vIdx)}
                style={{ fontSize: '11px', color: '#ef4444', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
              >
                <Trash2 size={11} />
                <span>删除</span>
              </button>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', margin: '0 0 14px 0', whiteSpace: 'pre-wrap' }}>
            {vol.content || '暂无此分卷的整体走向描述，点击编辑或AI推演来完善走向...'}
          </p>

          {aiPromptVolIdx === vIdx && (
            <div style={{ marginBottom: '14px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
              <input
                type="text"
                value={aiPromptText}
                onChange={e => setAiPromptText(e.target.value)}
                placeholder="输入推演要求（可选，如：加入主角在此击败魔尊）"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    setAiPromptVolIdx(null);
                    handleAiRegenVolume(vIdx, aiPromptText);
                  }
                }}
                style={{
                  flex: 1,
                  fontSize: '12px',
                  padding: '5px 8px',
                  borderRadius: '4px',
                  border: '1px solid rgba(56,189,248,0.3)',
                  background: 'rgba(56,189,248,0.05)',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  setAiPromptVolIdx(null);
                  handleAiRegenVolume(vIdx, aiPromptText);
                }}
                style={{
                  fontSize: '11px',
                  padding: '5px 10px',
                  borderRadius: '4px',
                  border: 'none',
                  background: '#38bdf8',
                  color: '#000',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                推演
              </button>
              <button
                type="button"
                onClick={() => setAiPromptVolIdx(null)}
                style={{
                  fontSize: '11px',
                  padding: '5px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-light)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                取消
              </button>
            </div>
          )}

          {!isCollapsed && (
            <div style={{
              background: 'rgba(0, 0, 0, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              padding: '16px',
              marginTop: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {vol.chapters.length === 0 ? (
                <div
                  onClick={() => handleInsertChapter(vIdx, -1)}
                  style={{
                    border: '1px dashed rgba(255,255,255,0.06)',
                    borderRadius: '6px',
                    padding: '24px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    background: 'rgba(255,255,255,0.005)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.02)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.005)';
                  }}
                >
                  <div style={{ fontSize: '13px', color: '#c0c0c0', fontWeight: '500', marginBottom: '4px' }}>暂无章节</div>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>点击在此分卷下添加首个章节</span>
                </div>
              ) : (
                matchedChaps.filter(c => c.ch).map(({ ch: sec, cIdx }) => {
                  const globalIdx = flatChapters.findIndex(ch => ch.volIdx === vIdx && ch.chapIdx === cIdx);
                  const isRegening: boolean = regeningIndex === globalIdx;
                  const isEditingChap: boolean = !!(editingChapterPath && editingChapterPath.volIdx === vIdx && editingChapterPath.chapIdx === cIdx);

                  const dbChap = store.chapters.find((dbc: any) => dbc.title.includes(sec.title) || sec.title.includes(dbc.title));
                  const isWritten: boolean = !!(dbChap && dbChap.content && dbChap.content.trim().length > 10);

                  return (
                    <ChapterCard
                      key={cIdx}
                      ctrl={ctrl}
                      sec={sec}
                      vIdx={vIdx}
                      cIdx={cIdx}
                      volLength={vol.chapters.length}
                      isRegening={isRegening}
                      isEditingChap={isEditingChap}
                      isWritten={isWritten}
                    />
                  );
                })
              )}

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.03)', paddingTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleInsertChapter(vIdx, vol.chapters.length - 1)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#a5b4fc',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#a5b4fc'; }}
                >
                  <Plus size={12} />
                  <span>添加章节</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
