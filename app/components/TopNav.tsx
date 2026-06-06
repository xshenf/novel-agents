'use client';

import { BookOpen, Settings, ChevronLeft } from 'lucide-react';
import { useWorkspace } from '../workspace-context';

export function TopNav() {
  const { store, routing, models } = useWorkspace();
  const { router } = routing;
  const { setShowSettings } = models;

  return (
    <nav className="navbar">
      <div className="nav-brand" style={{ cursor: 'pointer' }} onClick={() => { store.setCurrentProject(null); router.push('/'); }}>
        <BookOpen size={20} style={{ color: 'var(--accent)' }} />
        <span>小说智能体创作台 <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--text-dark)' }}>MVP v1.1</span></span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {store.currentProject && (
          <button className="btn btn-secondary" onClick={() => { store.setCurrentProject(null); router.push('/'); }} style={{ padding: '6px 12px', fontSize: '12px' }}>
            <ChevronLeft size={16} /> 返回项目大厅
          </button>
        )}
        <button className="btn btn-secondary" onClick={() => setShowSettings(true)}>
          <Settings size={16} />
          <span>AI 模型设置</span>
        </button>
      </div>
    </nav>
  );
}
