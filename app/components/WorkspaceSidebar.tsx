'use client';

import { ChevronRight, Plus, FileText, ChevronLeft, Trash2, ChevronDown, BookOpen, Lock, FolderOpen, Folder, MoreHorizontal, Sparkles, Pencil } from 'lucide-react';
import { useState } from 'react';
import { useWorkspace } from '../workspace-context';

export function WorkspaceSidebar() {
  const { store, routing, modals, layout, outlineTree, volumeActions } = useWorkspace();
  const { router, setActiveWorkspaceTab, buildWorkspaceUrl } = routing;
  const { setShowNewChapModal } = modals;
  const { sidebarWidth, setSidebarWidth, sidebarCollapsed, setSidebarCollapsed } = layout;
  const { localSections, selectedVolumeIdx, setSelectedVolumeIdx, selectedChapterIdx, setSelectedChapterIdx, collapsedVolumes, setCollapsedVolumes } = outlineTree;
  const { isAiOutlineLoading, handleAiGenerateVolumeChapters, handleAddChapter, handleDeleteVolume } = volumeActions;
  const [hoveredMenuKey, setHoveredMenuKey] = useState<string | null>(null);
  const [openVolumeMenu, setOpenVolumeMenu] = useState<number | null>(null);

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

  const menuItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 8px',
    fontSize: '12px',
    color: 'var(--text-primary, #e2e8f0)',
    background: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
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
                  <button className="btn-icon" onClick={() => setShowNewChapModal(true)} title="新建章节">
                    <Plus size={16} />
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
                        <button
                          className="btn-icon"
                          onClick={(e) => { e.stopPropagation(); setOpenVolumeMenu(openVolumeMenu === vIdx ? null : vIdx); }}
                          style={{ padding: '2px', opacity: openVolumeMenu === vIdx ? 1 : 0.6 }}
                          title="分卷操作"
                        >
                          <MoreHorizontal size={12} />
                        </button>
                      </div>

                      {/* 分卷操作菜单 */}
                      {openVolumeMenu === vIdx && (
                        <>
                          <div
                            onClick={() => setOpenVolumeMenu(null)}
                            style={{ position: 'fixed', inset: 0, zIndex: 9 }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              right: '8px',
                              marginTop: '-2px',
                              minWidth: '170px',
                              zIndex: 10,
                              background: 'var(--bg-card, #1a1f2e)',
                              border: '1px solid var(--border-light)',
                              borderRadius: '8px',
                              padding: '4px',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div style={{ padding: '4px 8px', fontSize: '10px', color: 'var(--text-muted)' }}>分卷操作</div>
                            <button
                              className="sidebar-menu-item"
                              disabled={isAiOutlineLoading}
                              onClick={() => { setOpenVolumeMenu(null); handleAiGenerateVolumeChapters(vIdx, 3); }}
                              style={menuItemStyle}
                            >
                              <Sparkles size={12} style={{ color: '#a5b4fc' }} />
                              <span>AI 生成 3 章大纲</span>
                            </button>
                            <button
                              className="sidebar-menu-item"
                              disabled={isAiOutlineLoading}
                              onClick={() => { setOpenVolumeMenu(null); handleAiGenerateVolumeChapters(vIdx, 5); }}
                              style={menuItemStyle}
                            >
                              <Sparkles size={12} style={{ color: '#a5b4fc' }} />
                              <span>AI 生成 5 章大纲</span>
                            </button>
                            <div style={{ height: '1px', background: 'var(--border-light)', margin: '2px 0' }} />
                            <button
                              className="sidebar-menu-item"
                              onClick={() => { setOpenVolumeMenu(null); handleAddChapter(vIdx); }}
                              style={menuItemStyle}
                            >
                              <FileText size={12} />
                              <span>新建空白章节</span>
                            </button>
                            <button
                              className="sidebar-menu-item"
                              onClick={() => {
                                setOpenVolumeMenu(null);
                                setActiveWorkspaceTab('outline');
                              }}
                              style={menuItemStyle}
                            >
                              <Pencil size={12} />
                              <span>编辑本卷大纲</span>
                            </button>
                            <div style={{ height: '1px', background: 'var(--border-light)', margin: '2px 0' }} />
                            <button
                              className="sidebar-menu-item"
                              onClick={() => { setOpenVolumeMenu(null); handleDeleteVolume(vIdx); }}
                              style={{ ...menuItemStyle, color: '#f87171' }}
                            >
                              <Trash2 size={12} />
                              <span>删除分卷</span>
                            </button>
                          </div>
                        </>
                      )}

                      {!isCollapsed && vol.chapters.map((chap, cIdx) => {
                        const isActive = selectedVolumeIdx === vIdx && selectedChapterIdx === cIdx;
                        const writtenMatch = store.chapters.find(c => c.title === chap.title || c.title === chap.title.replace(/^第.+(?:章|节)[：: ]\s*/, ''));
                        return (
                          <div
                            key={`chap-${vIdx}-${cIdx}`}
                            className={`sidebar-item ${isActive ? 'active' : ''}`}
                            onClick={() => { handleSelectChapter(vIdx, cIdx); handleEnterWriting(writtenMatch?.id ?? null); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '24px', cursor: 'pointer' }}
                          >
                            <FileText size={12} style={{ flexShrink: 0, opacity: 0.7 }} />
                            <span style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '12px' }}>{chap.title || `第 ${cIdx + 1} 章`}</span>
                            {chap.isLocked && <Lock size={9} style={{ flexShrink: 0, opacity: 0.5 }} />}
                            {writtenMatch && writtenMatch.content.trim() !== '' && <span style={{ fontSize: '10px', color: 'var(--accent-success)' }}>已</span>}
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

                {/* 已写章节（与目录合并：未匹配到大纲的"自由章节"显示在底部"自由章节"分卷下） */}
                {(() => {
                  const matchedWrittenIds = new Set<string>();
                  localSections.forEach(vol => vol.chapters.forEach(chap => {
                    const m = store.chapters.find(c => c.title === chap.title || c.title === chap.title.replace(/^第.+(?:章|节)[：: ]\s*/, ''));
                    if (m) matchedWrittenIds.add(m.id);
                  }));
                  const orphans = store.chapters.filter(c => !matchedWrittenIds.has(c.id));
                  if (orphans.length === 0) return null;
                  return (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px 4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <BookOpen size={11} />
                        <span>未编入大纲</span>
                      </div>
                      {orphans.map((chap) => (
                        <div
                          key={chap.id}
                          className={`sidebar-item ${store.currentChapter?.id === chap.id && selectedVolumeIdx === null ? 'active' : ''}`}
                          onClick={() => { setSelectedVolumeIdx(null); setSelectedChapterIdx(null); store.setCurrentChapter(chap); handleEnterWriting(chap.id); }}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '24px', cursor: 'pointer' }}
                          onMouseEnter={() => setHoveredMenuKey(chap.id)}
                          onMouseLeave={() => setHoveredMenuKey(null)}
                        >
                          <FileText size={12} style={{ flexShrink: 0, opacity: 0.7 }} />
                          <span style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '12px' }}>{chap.title}</span>
                          {chap.content.trim() !== '' && <span style={{ fontSize: '10px', color: 'var(--accent-success)' }}>已</span>}
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
                      ))}
                    </div>
                  );
                })()}

                {localSections.length === 0 && store.chapters.length === 0 && (
                  <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                    暂无章节，请在大纲与设定中创建
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
