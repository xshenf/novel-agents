'use client';

import { ChevronRight, Plus, FileText, ChevronLeft, Trash2, ChevronDown, BookOpen, Lock, FolderOpen, Folder } from 'lucide-react';
import { useState } from 'react';
import { useWorkspace } from '../workspace-context';
import { findWritten, statusOf, chapterWordCount, collectOrphans, STATUS_LABEL, type ChapterStatus } from '@/lib/chapterLinking';

// 章节写作状态徽标颜色
const STATUS_COLOR: Record<ChapterStatus, string> = {
  unwritten: 'var(--text-dark)',
  draft: '#fbbf24',
  done: 'var(--accent-success)',
};

export function WorkspaceSidebar() {
  const { store, routing, modals, layout, outlineTree, volumeActions } = useWorkspace();
  const { router, setActiveWorkspaceTab, buildWorkspaceUrl } = routing;
  const { setShowNewChapModal } = modals;
  const { sidebarWidth, setSidebarWidth, sidebarCollapsed, setSidebarCollapsed } = layout;
  const { localSections, selectedVolumeIdx, setSelectedVolumeIdx, selectedChapterIdx, setSelectedChapterIdx, collapsedVolumes, setCollapsedVolumes } = outlineTree;
  const { handleAddChapter } = volumeActions;
  const [hoveredMenuKey, setHoveredMenuKey] = useState<string | null>(null);

  const handleSelectVolume = (vIdx: number) => {
    setSelectedVolumeIdx(vIdx);
    setSelectedChapterIdx(null);
  };

  const handleSelectChapter = (vIdx: number, cIdx: number) => {
    setSelectedVolumeIdx(vIdx);
    setSelectedChapterIdx(cIdx);
  };

  const handleEnterWriting = (chapterId: string | null) => {
    if (!store.currentProject) return;
    setActiveWorkspaceTab('write');
    router.push(buildWorkspaceUrl(store.currentProject.id, 'write', chapterId ?? undefined));
  };

  const toggleCollapsed = (vIdx: number) => {
    setCollapsedVolumes({ ...collapsedVolumes, [vIdx]: !collapsedVolumes[vIdx] });
  };

  return (
    <>
      {sidebarCollapsed ? (
        <div style={{ width: '40px', flexShrink: 0, background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '12px', gap: '8px' }}>
          <button className="btn-icon" onClick={() => setSidebarCollapsed(false)} title="展开章节列表">
            <ChevronRight size={16} />
          </button>
          <button className="btn-icon" onClick={() => setShowNewChapModal(true)} title="新建章节">
            <Plus size={16} />
          </button>
        </div>
      ) : (
        <div className="workspace-sidebar" style={{ width: sidebarWidth, minWidth: 180, maxWidth: 500, flexShrink: 0 }}>
          <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="sidebar-section" style={{ flexGrow: 1, overflowY: 'auto' }}>
              <div className="sidebar-header">
                <span>章节列表</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn-icon" onClick={() => setSidebarCollapsed(true)} title="收起章节列表">
                    <ChevronLeft size={16} />
                  </button>
                </div>
              </div>

              <div className="sidebar-list">
                {/* 大纲目录（分卷 → 章节） */}
                {localSections.map((vol, vIdx) => {
                  const isCollapsed = !!collapsedVolumes[vIdx];
                  const isVolSelected = selectedVolumeIdx === vIdx && selectedChapterIdx === null;
                  return (
                    <div key={`vol-${vIdx}`}>
                      <div
                        className={`sidebar-item ${isVolSelected ? 'active' : ''}`}
                        onClick={() => handleSelectVolume(vIdx)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', position: 'relative' }}
                      >
                        <button
                          className="btn-icon"
                          onClick={(e) => { e.stopPropagation(); toggleCollapsed(vIdx); }}
                          style={{ padding: 0, width: '16px', height: '16px' }}
                          title={isCollapsed ? '展开分卷' : '收起分卷'}
                        >
                          {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                        </button>
                        {isCollapsed ? <Folder size={13} style={{ flexShrink: 0 }} /> : <FolderOpen size={13} style={{ flexShrink: 0 }} />}
                        <span style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 500 }}>{vol.title || `第 ${vIdx + 1} 卷`}</span>
                        {vol.isLocked && <Lock size={10} style={{ flexShrink: 0, opacity: 0.6 }} />}
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{vol.chapters.length}</span>
                      </div>

                      {!isCollapsed && vol.chapters.map((chap, cIdx) => {
                        const isActive = selectedVolumeIdx === vIdx && selectedChapterIdx === cIdx;
                        const writtenMatch = findWritten(chap.title, store.chapters);
                        const status = statusOf(writtenMatch);
                        const words = chapterWordCount(writtenMatch);
                        return (
                          <div
                            key={`chap-${vIdx}-${cIdx}`}
                            className={`sidebar-item ${isActive ? 'active' : ''}`}
                            onClick={() => { handleSelectChapter(vIdx, cIdx); handleEnterWriting(writtenMatch?.id ?? null); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '24px', cursor: 'pointer' }}
                          >
                            <span
                              style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, background: STATUS_COLOR[status] }}
                              title={STATUS_LABEL[status]}
                            />
                            <FileText size={12} style={{ flexShrink: 0, opacity: 0.7 }} />
                            <span style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '12px' }}>{chap.title || `第 ${cIdx + 1} 章`}</span>
                            {chap.isLocked && <Lock size={9} style={{ flexShrink: 0, opacity: 0.5 }} />}
                            {words > 0 && <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>{words}字</span>}
                          </div>
                        );
                      })}

                      {/* 在分卷底部提供「+ 新建章节」快捷入口 */}
                      {!isCollapsed && isVolSelected && (
                        <button
                          className="btn-link"
                          onClick={() => handleAddChapter(vIdx)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            padding: '4px 10px 4px 26px',
                            fontSize: '11px', color: 'var(--text-muted)',
                            background: 'none', border: 'none', cursor: 'pointer',
                          }}
                          title="在本卷新增一个空白章节"
                        >
                          <Plus size={11} /> 新建章节
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* 未编入大纲的自由章节（按章号匹配后仍找不到的） */}
                {(() => {
                  const orphans = collectOrphans(localSections, store.chapters);
                  if (orphans.length === 0) return null;
                  return (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px 4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <BookOpen size={11} />
                        <span>未编入大纲</span>
                      </div>
                      {orphans.map((chap) => {
                        const status = statusOf(chap);
                        const words = chapterWordCount(chap);
                        return (
                        <div
                          key={chap.id}
                          className={`sidebar-item ${store.currentChapter?.id === chap.id && selectedVolumeIdx === null ? 'active' : ''}`}
                          onClick={() => { setSelectedVolumeIdx(null); setSelectedChapterIdx(null); store.setCurrentChapter(chap); handleEnterWriting(chap.id); }}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '24px', cursor: 'pointer' }}
                          onMouseEnter={() => setHoveredMenuKey(chap.id)}
                          onMouseLeave={() => setHoveredMenuKey(null)}
                        >
                          <span
                            style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, background: STATUS_COLOR[status] }}
                            title={STATUS_LABEL[status]}
                          />
                          <FileText size={12} style={{ flexShrink: 0, opacity: 0.7 }} />
                          <span style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '12px' }}>{chap.title}</span>
                          {words > 0 && hoveredMenuKey !== chap.id && <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>{words}字</span>}
                          {hoveredMenuKey === chap.id && (
                            <button
                              className="btn-icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`确定要删除章节"${chap.title}"吗？`)) {
                                  store.deleteChapter(chap.id);
                                }
                              }}
                              style={{ padding: '2px', opacity: 0.6 }}
                              title="删除章节"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {localSections.length === 0 && store.chapters.length === 0 && (
                  <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                    暂无章节，请在世界设定中创建
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 左侧拖拽条 */}
      {!sidebarCollapsed && (
        <div
          className="resize-handle"
          onMouseDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startWidth = sidebarWidth;
            const handle = e.currentTarget;
            handle.classList.add('active');
            document.body.style.userSelect = 'none';
            const onMove = (ev: MouseEvent) => {
              const delta = ev.clientX - startX;
              const newWidth = Math.max(180, Math.min(500, startWidth + delta));
              setSidebarWidth(newWidth);
              localStorage.setItem('layout_sidebar_width', String(newWidth));
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
      )}
    </>
  );
}
