'use client';

import { useState, useRef, useEffect } from 'react';
import { BookOpen, Settings, ChevronLeft, Pencil } from 'lucide-react';
import { useWorkspace } from '../workspace-context';

export function TopNav() {
  const { store, routing, models } = useWorkspace();
  const { router } = routing;
  const { setShowSettings } = models;

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const projectTitle = store.currentProject?.title || '';

  const startEdit = () => {
    setNameInput(projectTitle);
    setEditingName(true);
  };

  const confirmEdit = async () => {
    setEditingName(false);
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== projectTitle && store.currentProject) {
      await store.updateProject(store.currentProject.id, { title: trimmed });
    }
  };

  useEffect(() => {
    if (editingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingName]);

  return (
    <nav className="navbar">
      <div className="nav-brand" style={{ cursor: 'pointer' }} onClick={() => { store.setCurrentProject(null); router.push('/'); }}>
        <BookOpen size={20} style={{ color: 'var(--accent)' }} />
        <span>小说智能体创作台 <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--text-dark)' }}>MVP v1.1</span></span>
      </div>

      {store.currentProject && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          {editingName ? (
            <input
              ref={inputRef}
              type="text"
              className="input"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={confirmEdit}
              onKeyDown={e => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') setEditingName(false); }}
              style={{ fontSize: '14px', fontWeight: '600', padding: '2px 8px', width: '200px', color: '#fff', textAlign: 'center' }}
            />
          ) : (
            <>
              <span style={{ fontSize: '15px', fontWeight: '600', color: '#fff', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{projectTitle}</span>
              <button
                type="button"
                onClick={startEdit}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', opacity: 0.4, transition: 'opacity 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
              >
                <Pencil size={12} style={{ color: 'var(--text-muted)' }} />
              </button>
            </>
          )}
        </div>
      )}

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
