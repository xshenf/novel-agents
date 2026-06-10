'use client';

import { ChevronRight, Plus, FileText, ChevronLeft, ChevronDown, Lock, FolderOpen, Folder, FolderPlus, Sparkles, Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useWorkspace } from '../workspace-context';
import { findWritten, statusOf, chapterWordCount, STATUS_LABEL, collectOrphans, type ChapterStatus } from '@/lib/chapterLinking';
import { BTN_TOOLBAR } from '@/lib/styles';

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
  const { handleAddChapter, handleAddVolume, handleAiCreateNewVolume, isAiOutlineLoading } = volumeActions;

  // 拖拽条事件监听器清理（防止组件卸载时监听器泄漏）
  const sidebarDragCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    return () => {
      sidebarDragCleanupRef.current?.();
    };
  }, []);

  // treeActionBtn 已抽取至 lib/styles.ts → BTN_TOOLBAR

  const handleSelectVolume = (vIdx: number) => {
    setSelectedVolumeIdx(vIdx);
    setSelectedChapterIdx(null);
    store.setCurrentChapter(null);
    setActiveWorkspaceTab('write');
    router.push(buildWorkspaceUrl(store.currentProject!.id, 'write', undefined, vIdx));
  };

  const handleSelectChapter = (vIdx: number, cIdx: number) => {
    setSelectedVolumeIdx(vIdx);
    setSelectedChapterIdx(cIdx);
  };

  const handleEnterWriting = async (vIdx: number, cIdx: number, chapterId: string | null) => {
    if (!store.currentProject) return;
    setActiveWorkspaceTab('write');
    let realId = chapterId;
    if (!realId) {
      const sec = localSections[vIdx]?.chapters[cIdx];
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

  const toggleCollapsed = (vIdx: number) => {
    setCollapsedVolumes({ ...collapsedVolumes, [vIdx]: !collapsedVolumes[vIdx] });
  };

  // 未被任何大纲条目匹配的"游离"正文章节：若不展示，用户会以为章节丢失
  const orphanChapters = collectOrphans(localSections, store.chapters);

  const handleOpenOrphan = (chapterId: string) => {
    const chap = store.chapters.find((c: { id: string }) => c.id === chapterId);
    if (!chap || !store.currentProject) return;
    store.setCurrentChapter(chap);
    setSelectedChapterIdx(null);
    setActiveWorkspaceTab('write');
    router.push(buildWorkspaceUrl(store.currentProject.id, 'write', chap.id));
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
                            onClick={() => { handleSelectChapter(vIdx, cIdx); handleEnterWriting(vIdx, cIdx, writtenMatch?.id ?? null); }}
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

                {/* 未关联章节：有正文但未匹配到任何大纲条目（兜底展示，避免"章节消失"） */}
                {orphanChapters.length > 0 && (
                  <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '6px' }}>
                    <div style={{ padding: '2px 10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      未关联章节（{orphanChapters.length}）
                    </div>
                    {orphanChapters.map(c => {
                      const status = statusOf(c);
                      const words = chapterWordCount(c);
                      return (
                        <div
                          key={`orphan-${c.id}`}
                          className="sidebar-item"
                          onClick={() => handleOpenOrphan(c.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '24px', cursor: 'pointer' }}
                          title="该章节未匹配到大纲条目，点击可直接编辑"
                        >
                          <span
                            style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, background: STATUS_COLOR[status] }}
                            title={STATUS_LABEL[status]}
                          />
                          <FileText size={12} style={{ flexShrink: 0, opacity: 0.7 }} />
                          <span style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '12px' }}>{c.title}</span>
                          {words > 0 && <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>{words}字</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {localSections.length === 0 && store.chapters.length === 0 && (
                  <div style={{ padding: '16px 12px 8px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                    暂无分卷，点击下方按钮创建第一卷
                  </div>
                )}

                {/* 分卷创建入口：直接在章节树里新建分卷 */}
                <div style={{ display: 'flex', gap: '6px', padding: '8px 4px 4px', marginTop: '4px', borderTop: localSections.length > 0 ? '1px solid var(--border-light)' : 'none' }}>
                  <button
                    onClick={() => {
                      handleAddVolume();
                      setSelectedVolumeIdx(localSections.length);
                      setSelectedChapterIdx(null);
                      store.setCurrentChapter(null);
                      setActiveWorkspaceTab('write');
                      router.push(buildWorkspaceUrl(store.currentProject!.id, 'write', undefined, localSections.length));
                    }}
                    style={BTN_TOOLBAR}
                    title="新建一个空分卷"
                  >
                    <FolderPlus size={12} /> 新建分卷
                  </button>
                  <button
                    onClick={async () => {
                      await handleAiCreateNewVolume(5);
                      setTimeout(() => {
                        setSelectedVolumeIdx(localSections.length);
                        setSelectedChapterIdx(null);
                        store.setCurrentChapter(null);
                        setActiveWorkspaceTab('write');
                        router.push(buildWorkspaceUrl(store.currentProject!.id, 'write', undefined, localSections.length));
                      }, 100);
                    }}
                    disabled={isAiOutlineLoading}
                    style={isAiOutlineLoading ? { ...BTN_TOOLBAR, opacity: 0.5, cursor: 'not-allowed' } : BTN_TOOLBAR}
                    title="让 AI 新增一个完整分卷（卷头 + 5 章）"
                  >
                    {isAiOutlineLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} style={{ color: '#a5b4fc' }} />} AI 新建分卷
                  </button>
                </div>
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
            const lastWidthRef = { current: startWidth };
            const onMove = (ev: MouseEvent) => {
              const delta = ev.clientX - startX;
              const newWidth = Math.max(180, Math.min(500, startWidth + delta));
              lastWidthRef.current = newWidth;
              setSidebarWidth(newWidth);
            };
            const onUp = () => {
              // localStorage 持久化仅在拖拽结束时写入，避免 mousemove 高频 I/O
              localStorage.setItem('layout_sidebar_width', String(lastWidthRef.current));
              handle.classList.remove('active');
              document.body.style.userSelect = '';
              document.removeEventListener('mousemove', onMove);
              document.removeEventListener('mouseup', onUp);
              sidebarDragCleanupRef.current = null;
            };
            sidebarDragCleanupRef.current = onUp;
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          }}
        />
      )}
    </>
  );
}
