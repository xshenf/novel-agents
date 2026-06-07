'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useWorkspace } from '../workspace-context';

export function Dashboard() {
  const { store, routing } = useWorkspace();
  const { router, buildWorkspaceUrl } = routing;

  const handleCreateProject = async () => {
    try {
      const newProj = await store.createProject(
        "未命名故事",
        "点击完善设定补充简介与背景设定",
        "传统正剧",
        "待补充世界观"
      );
      store.setCurrentProject(newProj);
      router.push(buildWorkspaceUrl(newProj.id, 'write'));
    } catch {
      alert('创建项目失败');
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>我的创作空间</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>选择一部小说开始写作，或者创造一个新的故事灵感项目。</p>
        </div>
        <button className="btn btn-primary" onClick={handleCreateProject}>
          <Plus size={18} />
          <span>新建小说项目</span>
        </button>
      </div>

      <div className="project-grid">
        {store.projects.map((project) => (
          <div key={project.id} className="project-card glass-card" onClick={() => { store.setCurrentProject(project); router.push(buildWorkspaceUrl(project.id, 'write')); }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="project-title">{project.title}</div>
              <button
                className="btn-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  store.showConfirm(`确认要彻底删除小说《${project.title}》吗？这将无法恢复。`, () => {
                    store.deleteProject(project.id);
                  });
                }}
                style={{ color: 'rgba(239, 68, 68, 0.6)' }}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="project-desc">{project.description || '暂无作品简介...'}</div>
            <div className="project-meta">
              <div style={{ display: 'flex', gap: '6px' }}>
                <span className="tag-badge">AI 记忆分层</span>
                <span className="tag-badge">全自动创作</span>
              </div>
              <span>更新于 {new Date(project.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}

        <div className="project-card glass-card" style={{ borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', opacity: '0.7' }} onClick={handleCreateProject}>
          <Plus size={32} style={{ color: 'var(--text-dark)', marginBottom: '10px' }} />
          <div style={{ fontWeight: '500', color: 'var(--text-muted)' }}>开启你的奇幻新章</div>
        </div>
      </div>
    </div>
  );
}
