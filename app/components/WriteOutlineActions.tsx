'use client';

import {
  BookOpen, Sparkles, Pencil, Trash2, FolderPlus, Plus,
  RefreshCw, Wand2, Loader2, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { useWorkspace } from '../workspace-context';

interface WriteOutlineActionsProps {
  variant?: 'inline' | 'card';
}

const AI_REFRESHABLE_NUMS = [3, 5, 8] as const;

export function WriteOutlineActions({ variant = 'card' }: WriteOutlineActionsProps) {
  const { routing, outlineTree, volumeActions } = useWorkspace();
  const { setActiveWorkspaceTab } = routing;
  const { localSections, selectedVolumeIdx } = outlineTree;
  const {
    isAiOutlineLoading,
    handleAiGenerateVolumeOutline,
    handleAiGenerateVolumeChapters,
    handleAiGenerateFullVolume,
    handleAiCreateNewVolume,
    handleAddChapter,
    handleAddVolume,
    handleDeleteVolume,
  } = volumeActions;

  const [showVolumePicker, setShowVolumePicker] = useState(false);
  const [chapterPlanNum, setChapterPlanNum] = useState<typeof AI_REFRESHABLE_NUMS[number]>(5);
  const [confirmAction, setConfirmAction] = useState<'rebuild' | 'delete' | null>(null);

  // 无大纲时仅显示「新建分卷」系列；选中分卷时显示分卷级操作
  const hasVolume = selectedVolumeIdx !== null && localSections[selectedVolumeIdx];
  const vol = hasVolume ? localSections[selectedVolumeIdx] : null;
  const volTitle = vol?.title || `第 ${(selectedVolumeIdx ?? 0) + 1} 卷`;
  const chapterCount = vol?.chapters.length ?? 0;

  // 容器样式
  const containerStyle: React.CSSProperties = variant === 'card' ? {
    margin: '12px 30px 0',
    padding: '14px 18px',
    background: 'rgba(15, 23, 42, 0.4)',
    border: '1px solid var(--border-light)',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  } : {
    padding: '10px 0',
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  // 通用按钮样式
  const baseBtn: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '5px 10px',
    fontSize: '12px',
    background: 'rgba(99, 102, 241, 0.08)',
    border: '1px solid rgba(99, 102, 241, 0.25)',
    color: 'var(--text-primary, #e2e8f0)',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s',
  };
  const ghostBtn: React.CSSProperties = {
    ...baseBtn,
    background: 'transparent',
    border: '1px solid var(--border-light)',
    color: 'var(--text-muted)',
  };
  const dangerBtn: React.CSSProperties = {
    ...baseBtn,
    background: 'transparent',
    border: '1px solid rgba(248, 113, 113, 0.4)',
    color: '#f87171',
  };
  const disabledBtn: React.CSSProperties = {
    ...baseBtn,
    opacity: 0.5,
    cursor: 'not-allowed',
  };

  return (
    <div className="glass-card animate-fade-in" style={containerStyle}>
      {/* 始终可见：分卷级创建 */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <span style={sectionLabelStyle}>
          <BookOpen size={11} style={{ marginRight: 4, verticalAlign: '-1px' }} />
          分卷管理
        </span>
        <button
          onClick={() => handleAddVolume()}
          style={baseBtn}
          title="追加一个空分卷"
        >
          <FolderPlus size={12} />
          新建空分卷
        </button>
        <button
          onClick={() => handleAiCreateNewVolume(5)}
          disabled={isAiOutlineLoading}
          style={isAiOutlineLoading ? disabledBtn : baseBtn}
          title="让 AI 在大纲末尾新增一个完整分卷（卷头 + 5 章）"
        >
          {isAiOutlineLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} style={{ color: '#a5b4fc' }} />}
          AI 新建分卷
        </button>
      </div>

      {/* 选中分卷时才显示分卷级操作 */}
      {hasVolume && vol && (
        <>
          <div style={{ height: '1px', background: 'var(--border-light)', margin: '0' }} />

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={sectionLabelStyle}>
              <Sparkles size={11} style={{ marginRight: 4, verticalAlign: '-1px', color: '#a5b4fc' }} />
              「{volTitle}」AI 规划
            </span>
            <button
              onClick={() => handleAiGenerateVolumeOutline(selectedVolumeIdx!)}
              disabled={isAiOutlineLoading}
              style={isAiOutlineLoading ? disabledBtn : baseBtn}
              title="仅生成本卷的标题与概要"
            >
              <Wand2 size={12} style={{ color: '#a5b4fc' }} />
              生成本卷大纲
            </button>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowVolumePicker(s => !s)}
                disabled={isAiOutlineLoading}
                style={isAiOutlineLoading ? disabledBtn : baseBtn}
                title={`AI 自动规划 ${chapterPlanNum} 个章节`}
              >
                <Sparkles size={12} style={{ color: '#a5b4fc' }} />
                自动规划 {chapterPlanNum} 章
                <ChevronRight size={10} style={{ transform: showVolumePicker ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }} />
              </button>
              {showVolumePicker && (
                <>
                  <div onClick={() => setShowVolumePicker(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: '4px',
                      background: 'var(--bg-card, #1a1f2e)',
                      border: '1px solid var(--border-light)',
                      borderRadius: '6px',
                      padding: '4px',
                      zIndex: 10,
                      minWidth: '140px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {AI_REFRESHABLE_NUMS.map(n => (
                      <button
                        key={n}
                        onClick={() => {
                          setChapterPlanNum(n);
                          setShowVolumePicker(false);
                          handleAiGenerateVolumeChapters(selectedVolumeIdx!, n);
                        }}
                        style={{
                          ...ghostBtn,
                          width: '100%',
                          justifyContent: 'flex-start',
                          background: n === chapterPlanNum ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
                        }}
                      >
                        规划 {n} 章
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setConfirmAction('rebuild')}
              disabled={isAiOutlineLoading}
              style={isAiOutlineLoading ? disabledBtn : { ...baseBtn, borderColor: 'rgba(251, 191, 36, 0.4)' }}
              title="重写本卷的标题 / 概要 / 全部章节细纲"
            >
              <RefreshCw size={12} style={{ color: '#fbbf24' }} />
              一键重建本卷
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={sectionLabelStyle}>
              <Pencil size={11} style={{ marginRight: 4, verticalAlign: '-1px' }} />
              手动操作
            </span>
            <button
              onClick={() => handleAddChapter(selectedVolumeIdx!)}
              style={baseBtn}
              title="在本卷尾部追加一个空白章节"
            >
              <Plus size={12} />
              新建空白章节
            </button>
            <button
              onClick={() => setActiveWorkspaceTab('outline')}
              style={ghostBtn}
              title="跳转到大纲编辑器（本卷 / 本章细纲）"
            >
              <Pencil size={12} />
              在大纲编辑器中打开
            </button>
            <button
              onClick={() => setConfirmAction('delete')}
              style={dangerBtn}
              title="删除本卷及其全部章节细纲"
            >
              <Trash2 size={12} />
              删除本卷
            </button>
          </div>
        </>
      )}

      {/* 二次确认条 */}
      {confirmAction === 'delete' && vol && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(248, 113, 113, 0.1)',
          border: '1px solid rgba(248, 113, 113, 0.3)',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#fca5a5',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <Trash2 size={12} />
          <span style={{ flex: 1 }}>
            确认删除分卷「{volTitle}」及其 {chapterCount} 个章节大纲？此操作不可恢复。
          </span>
          <button
            onClick={() => { handleDeleteVolume(selectedVolumeIdx!); setConfirmAction(null); }}
            style={{ ...dangerBtn, padding: '3px 10px' }}
          >
            确认删除
          </button>
          <button onClick={() => setConfirmAction(null)} style={ghostBtn}>
            取消
          </button>
        </div>
      )}
      {confirmAction === 'rebuild' && vol && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(251, 191, 36, 0.1)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#fde68a',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <RefreshCw size={12} />
          <span style={{ flex: 1 }}>
            AI 将重写「{volTitle}」的标题 / 概要 / 全部章节。{chapterCount > 0 ? `会清空现有 ${chapterCount} 章。` : ''}继续？
          </span>
          <button
            onClick={() => { handleAiGenerateFullVolume(selectedVolumeIdx!, 5); setConfirmAction(null); }}
            style={{ ...baseBtn, borderColor: 'rgba(251, 191, 36, 0.5)', background: 'rgba(251, 191, 36, 0.15)' }}
          >
            确认重建
          </button>
          <button onClick={() => setConfirmAction(null)} style={ghostBtn}>
            取消
          </button>
        </div>
      )}

      {!hasVolume && localSections.length === 0 && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          当前项目尚无大纲分卷，可点击上方按钮创建，或前往「世界设定」编辑。
        </div>
      )}
    </div>
  );
}
