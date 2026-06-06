'use client';

import { ChevronRight, Plus, FileText, ChevronLeft, Trash2 } from 'lucide-react';
import { useWorkspace } from '../workspace-context';

export function WorkspaceSidebar() {
  const { store, routing, modals, layout } = useWorkspace();
  const { router, activeWorkspaceTab, buildWorkspaceUrl } = routing;
  const { setShowNewChapModal } = modals;
  const { sidebarWidth, setSidebarWidth, sidebarCollapsed, setSidebarCollapsed } = layout;

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
        <div className="workspace-sidebar" style={{ width: sidebarWidth, minWidth: 160, maxWidth: 500, flexShrink: 0 }}>
          <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="sidebar-section" style={{ flexGrow: 1, overflowY: 'auto' }}>
              <div className="sidebar-header">
                <span>章节列表</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn-icon" onClick={() => setSidebarCollapsed(true)} title="收起章节列表">
                    <ChevronLeft size={16} />
                  </button>
                  <button className="btn-icon" onClick={() => setShowNewChapModal(true)}>
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              <div className="sidebar-list">
                {store.chapters.map((chap) => (
                  <div
                    key={chap.id}
                    className={`sidebar-item ${store.currentChapter?.id === chap.id ? 'active' : ''}`}
                    onClick={() => { store.setCurrentChapter(chap); router.push(buildWorkspaceUrl(store.currentProject!.id, activeWorkspaceTab, chap.id)); }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <FileText size={14} style={{ flexShrink: 0 }} />
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{chap.title}</span>
                      {chap.content.trim() !== '' && <span style={{ fontSize: '10px', color: 'var(--accent-success)' }}>(已生成)</span>}
                    </div>
                    <button
                      className="btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`确定要删除章节“${chap.title}”吗？`)) {
                          store.deleteChapter(chap.id);
                        }
                      }}
                      style={{ padding: '2px', opacity: 0.5 }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
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
              const newWidth = Math.max(160, Math.min(500, startWidth + delta));
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
