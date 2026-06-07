'use client';

// TODO: Migrate inline styles to CSS Modules or Tailwind CSS
// TODO: Extract hardcoded Chinese strings for i18n support

import { useState, useEffect } from 'react';
import { BookOpen, Lock, Unlock, ArrowUp, ArrowDown, Trash2, PenLine, Plus, Save } from 'lucide-react';
import { useWorkspace } from '../../workspace-context';
import { findWritten, statusOf, chapterWordCount, STATUS_LABEL, type ChapterStatus } from '@/lib/chapterLinking';
import { VolumeAiPanel } from './VolumeAiPanel';
import { BTN_GHOST, BTN_DANGER } from '@/lib/styles';

interface VolumeManagementViewProps {
  vIdx: number;
}

const STATUS_COLOR: Record<ChapterStatus, string> = {
  unwritten: 'var(--text-dark)',
  draft: '#fbbf24',
  done: 'var(--accent-success)',
};

export function VolumeManagementView({ vIdx }: VolumeManagementViewProps) {
  const { store, routing, outlineTree, volumeActions } = useWorkspace();
  const { router, buildWorkspaceUrl } = routing;
  const { localSections, setSelectedVolumeIdx, setSelectedChapterIdx } = outlineTree;
  const {
    handleAddChapter,
    handleDeleteVolume,
    toggleLockVolume,
    handleMoveVolume,
    updateVolumeInfo,
  } = volumeActions;

  const vol = localSections[vIdx];

  // 局部状态，用于输入框编辑
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaved, setIsSaved] = useState(true);

  // 当分卷变化时，同步局部状态
  useEffect(() => {
    if (vol) {
      setTitle(vol.title || '');
      setContent(vol.content || '');
      setIsSaved(true);
    }
  }, [vol, vIdx]);

  if (!vol) {
    return (
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-dark)', gap: '15px', padding: '40px' }}>
        <BookOpen size={48} style={{ opacity: 0.3 }} />
        <span>未找到该分卷信息</span>
      </div>
    );
  }

  // 自动保存触发
  const handleBlur = () => {
    if (title.trim() !== (vol.title || '').trim() || content.trim() !== (vol.content || '').trim()) {
      updateVolumeInfo(vIdx, title, content);
      setIsSaved(true);
    }
  };

  const handleChangeTitle = (val: string) => {
    setTitle(val);
    setIsSaved(false);
  };

  const handleChangeContent = (val: string) => {
    setContent(val);
    setIsSaved(false);
  };

  const handleEnterWriting = async (cIdx: number, chapterId: string | null) => {
    if (!store.currentProject) return;
    setSelectedVolumeIdx(vIdx);
    setSelectedChapterIdx(cIdx);
    
    let realId = chapterId;
    if (!realId) {
      const sec = vol.chapters[cIdx];
      const title = sec?.title || '新章节';
      try {
        const newChap = await store.createChapter(store.currentProject.id, title);
        realId = newChap.id;
        store.setCurrentChapter(newChap);
      } catch (e) {
        console.error('手动创建新章节失败:', e);
      }
    } else {
      const dbChap = store.chapters.find((c: { id: string }) => c.id === chapterId);
      store.setCurrentChapter(dbChap || null);
    }
    
    router.push(buildWorkspaceUrl(store.currentProject.id, 'write', realId ?? undefined));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '30px', minHeight: 0, overflowY: 'auto', flexGrow: 1 }}>
      {/* 头部导航与操作栏 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.04)',
        borderRadius: '12px',
        padding: '16px 20px',
        flexShrink: 0,
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            background: vol.isLocked ? 'rgba(251, 191, 36, 0.1)' : 'rgba(99, 102, 241, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: vol.isLocked ? '1px solid rgba(251, 191, 36, 0.2)' : '1px solid rgba(99, 102, 241, 0.2)',
            flexShrink: 0
          }}>
            <BookOpen size={16} color={vol.isLocked ? '#fbbf24' : '#6366f1'} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>第 {vIdx + 1} 卷</span>
              {!isSaved && (
                <span style={{ fontSize: '10px', color: 'var(--accent)', background: 'rgba(99, 102, 241, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                  未保存修改
                </span>
              )}
            </div>
            <input
              type="text"
              value={title}
              onChange={e => handleChangeTitle(e.target.value)}
              onBlur={handleBlur}
              placeholder="输入分卷名称..."
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '18px',
                fontWeight: '700',
                outline: 'none',
                width: '100%',
                padding: '2px 0'
              }}
            />
          </div>
        </div>

        {/* 顶部操作按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => toggleLockVolume(vIdx)}
            style={{
              ...BTN_GHOST,
              width: '32px',
              height: '32px',
              border: vol.isLocked ? '1px solid rgba(251, 191, 36, 0.3)' : BTN_GHOST.border,
              color: vol.isLocked ? '#fbbf24' : BTN_GHOST.color,
            }}
            title={vol.isLocked ? "分卷已锁定，AI 推演大纲时此卷走向受保护" : "锁定此分卷"}
          >
            {vol.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
          </button>

          <button
            type="button"
            onClick={() => {
              handleMoveVolume(vIdx, 'up');
              const nextIdx = Math.max(0, vIdx - 1);
              setSelectedVolumeIdx(nextIdx);
              if (store.currentProject) {
                router.push(buildWorkspaceUrl(store.currentProject.id, 'write', undefined, nextIdx));
              }
            }}
            disabled={vIdx === 0}
            style={{
              ...BTN_GHOST,
              width: '32px',
              height: '32px',
              color: vIdx === 0 ? 'rgba(255, 255, 255, 0.1)' : BTN_GHOST.color,
              cursor: vIdx === 0 ? 'not-allowed' : 'pointer',
            }}
            title="上移分卷"
          >
            <ArrowUp size={14} />
          </button>

          <button
            type="button"
            onClick={() => {
              handleMoveVolume(vIdx, 'down');
              const nextIdx = Math.min(localSections.length - 1, vIdx + 1);
              setSelectedVolumeIdx(nextIdx);
              if (store.currentProject) {
                router.push(buildWorkspaceUrl(store.currentProject.id, 'write', undefined, nextIdx));
              }
            }}
            disabled={vIdx === localSections.length - 1}
            style={{
              ...BTN_GHOST,
              width: '32px',
              height: '32px',
              color: vIdx === localSections.length - 1 ? 'rgba(255, 255, 255, 0.1)' : BTN_GHOST.color,
              cursor: vIdx === localSections.length - 1 ? 'not-allowed' : 'pointer',
            }}
            title="下移分卷"
          >
            <ArrowDown size={14} />
          </button>

          <button
            type="button"
            onClick={() => {
              handleDeleteVolume(vIdx);
              setSelectedVolumeIdx(null);
              if (store.currentProject) {
                router.push(buildWorkspaceUrl(store.currentProject.id, 'write'));
              }
            }}
            style={{
              ...BTN_DANGER,
              width: '32px',
              height: '32px',
            }}
            title="删除分卷"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start', flexGrow: 1 }}>
        {/* 左侧：剧情走向与章节列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 剧情大纲走向 */}
          <div className="glass-card" style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.005) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.04)',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
          }}>
            <h5 style={{ fontSize: '13px', fontWeight: '600', color: '#fff', margin: '0 0 12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>剧情走向与看点设定</span>
              {!isSaved && (
                <button
                  onClick={handleBlur}
                  style={{
                    fontSize: '11px',
                    color: '#4ade80',
                    background: 'rgba(74,222,128,0.1)',
                    border: '1px solid rgba(74,222,128,0.2)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Save size={11} />
                  <span>立即保存</span>
                </button>
              )}
            </h5>
            <textarea
              value={content}
              onChange={e => handleChangeContent(e.target.value)}
              onBlur={handleBlur}
              placeholder="概括本分卷的核心矛盾、阶段高潮与对全书的承接走向..."
              rows={6}
              style={{
                background: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '8px',
                width: '100%',
                padding: '12px 14px',
                color: '#fff',
                fontSize: '13px',
                lineHeight: '1.6',
                resize: 'none',
                outline: 'none',
                transition: 'border 0.2s'
              }}
            />
          </div>

          {/* 章节细纲与写作进度 */}
          <div className="glass-card" style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.005) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.04)',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h5 style={{ fontSize: '13px', fontWeight: '600', color: '#fff', margin: 0 }}>
                下属章节列表 ({vol.chapters.length} 章)
              </h5>
              <button
                type="button"
                onClick={() => handleAddChapter(vIdx)}
                style={{
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  color: '#a5b4fc',
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                <Plus size={12} />
                <span>新增章节</span>
              </button>
            </div>

            {vol.chapters.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', border: '1px dashed rgba(255, 255, 255, 0.05)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                本卷下暂无章节大纲，点击右上角“新增章节”或使用 AI 规划章节
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {vol.chapters.map((chap, cIdx) => {
                  const dbChap = findWritten(chap.title, store.chapters);
                  const status = statusOf(dbChap);
                  const words = chapterWordCount(dbChap);

                  return (
                    <div
                      key={chap.title || `chap-${cIdx}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        background: 'rgba(255, 255, 255, 0.01)',
                        border: '1px solid rgba(255, 255, 255, 0.03)',
                        borderRadius: '8px',
                        gap: '12px',
                        transition: 'background 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: STATUS_COLOR[status],
                            flexShrink: 0
                          }}
                          title={`状态：${STATUS_LABEL[status]}`}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {chap.title || `第 ${cIdx + 1} 章（未命名）`}
                          </div>
                          {chap.content && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {chap.content}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                        {words > 0 && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {words} 字
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleEnterWriting(cIdx, dbChap?.id ?? null)}
                          style={{
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: 'var(--text-primary)',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          <PenLine size={11} />
                          <span>去写作</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 右侧：AI 智能助手与规划 */}
        <VolumeAiPanel vIdx={vIdx} />
      </div>
    </div>
  );
}
