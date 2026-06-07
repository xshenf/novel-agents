'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, RotateCcw, Trash2, ChevronDown, ChevronRight, FileText, BookOpen, Users, Globe, Layers } from 'lucide-react';
import { useWorkspace } from '../workspace-context';

interface Snapshot {
  id: string;
  projectId: string;
  type: string;
  key: string;
  label: string;
  data: string;
  source: string;
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  outline: { label: '大纲', icon: BookOpen, color: '#6366f1' },
  macro: { label: '核心设定', icon: Layers, color: '#8b5cf6' },
  chapter: { label: '章节', icon: FileText, color: '#06b6d4' },
  character: { label: '角色', icon: Users, color: '#f59e0b' },
  worldRule: { label: '世界观', icon: Globe, color: '#10b981' },
};

const SOURCE_LABEL: Record<string, string> = {
  manual: '手动',
  auto: '自动',
  ai: 'AI推演',
};

export function VersionHistoryTab() {
  const { store } = useWorkspace();
  const project = store.currentProject;

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(['outline', 'chapter']));
  const [previewSnapshot, setPreviewSnapshot] = useState<Snapshot | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  const fetchSnapshots = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/versions?projectId=${project.id}`);
      if (res.ok) {
        const data = await res.json();
        setSnapshots(data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [project?.id, project]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  const toggleType = (type: string) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const deleteSnapshot = async (id: string) => {
    try {
      const res = await fetch(`/api/versions?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSnapshots(prev => prev.filter(s => s.id !== id));
        if (previewSnapshot?.id === id) setPreviewSnapshot(null);
      }
    } catch { /* ignore */ }
  };

  const restoreSnapshot = async (snapshot: Snapshot) => {
    if (!project) return;
    setRestoring(snapshot.id);
    try {
      let data;
      try {
        data = JSON.parse(snapshot.data);
      } catch {
        data = snapshot.data;
      }

      if (snapshot.type === 'outline') {
        await store.updateProject(project.id, { outlineFull: typeof data === 'string' ? data : JSON.stringify(data) });
      } else if (snapshot.type === 'macro') {
        if (snapshot.key === 'macro') {
          let updates = {};
          if (typeof data === 'object' && data !== null) {
            updates = data;
          } else if (typeof data === 'string') {
            try {
              updates = JSON.parse(data);
            } catch {
              updates = {};
            }
          }
          await store.updateProject(project.id, updates);
        } else {
          await store.updateProject(project.id, { [snapshot.key]: typeof data === 'string' ? data : JSON.stringify(data) });
        }
      } else if (snapshot.type === 'chapter') {
        const chapterId = snapshot.key;
        if (typeof data === 'object' && data !== null) {
          await store.updateChapter(chapterId, data);
        } else if (typeof data === 'string') {
          await store.updateChapter(chapterId, { content: data });
        }
      } else if (snapshot.type === 'character') {
        const charId = snapshot.key;
        if (typeof data === 'object' && data !== null) {
          await store.updateCharacter(charId, data);
        }
      } else if (snapshot.type === 'worldRule') {
        const ruleId = snapshot.key;
        if (typeof data === 'object' && data !== null) {
          await store.updateWorldRule(ruleId, data);
        }
      }

      // Create a snapshot of current state before restoring (for undo)
      await fetch('/api/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          type: snapshot.type,
          key: snapshot.key,
          label: `${snapshot.label} (恢复前备份)`,
          data: snapshot.data,
          source: 'auto',
        }),
      });

      fetchSnapshots();
    } catch { /* ignore */ }
    setRestoring(null);
  };

  // Group snapshots by type
  const grouped = snapshots.reduce<Record<string, Snapshot[]>>((acc, s) => {
    if (!acc[s.type]) acc[s.type] = [];
    acc[s.type].push(s);
    return acc;
  }, {});

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}小时前`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}天前`;
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (!project) return null;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left: snapshot list */}
      <div style={{ flex: previewSnapshot ? '0 0 360px' : '1', display: 'flex', flexDirection: 'column', borderRight: previewSnapshot ? '1px solid var(--border-light)' : 'none', overflowY: 'auto' }}>
        <div style={{ padding: '20px 24px 12px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>历史版本</h3>
            <button
              onClick={fetchSnapshots}
              style={{ background: 'none', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              刷新
            </button>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '6px 0 0' }}>
            自动保存与AI推演的历史快照，可随时恢复
          </p>
        </div>

        {loading && snapshots.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            加载中...
          </div>
        ) : snapshots.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            暂无历史版本。编辑内容后，系统会自动创建快照。
          </div>
        ) : (
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {Object.entries(TYPE_CONFIG).map(([type, config]) => {
              const items = grouped[type] || [];
              const Icon = config.icon;
              const isExpanded = expandedTypes.has(type);
              return (
                <div key={type}>
                  <button
                    onClick={() => toggleType(type)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                      background: 'none', border: 'none', padding: '8px 8px',
                      cursor: 'pointer', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500,
                      borderRadius: '6px',
                    }}
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <Icon size={14} style={{ color: config.color }} />
                    <span>{config.label}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{items.length}</span>
                  </button>
                  {isExpanded && (
                    <div style={{ marginLeft: '22px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {items.length === 0 ? (
                        <div style={{ padding: '8px 8px', fontSize: '12px', color: 'var(--text-muted)' }}>暂无记录</div>
                      ) : (
                        items.map(snap => (
                          <div
                            key={snap.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              padding: '6px 8px', borderRadius: '6px',
                              background: previewSnapshot?.id === snap.id ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                              cursor: 'pointer', fontSize: '12px',
                            }}
                            onClick={() => setPreviewSnapshot(snap)}
                          >
                            <Clock size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                                {snap.label}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <span>{formatTime(snap.createdAt)}</span>
                                <span style={{
                                  padding: '0 4px', borderRadius: '3px', fontSize: '10px',
                                  background: snap.source === 'ai' ? 'rgba(139, 92, 246, 0.15)' : snap.source === 'auto' ? 'rgba(6, 182, 212, 0.1)' : 'rgba(255,255,255,0.05)',
                                  color: snap.source === 'ai' ? '#a78bfa' : snap.source === 'auto' ? '#22d3ee' : 'var(--text-muted)',
                                }}>
                                  {SOURCE_LABEL[snap.source] || snap.source}
                                </span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); restoreSnapshot(snap); }}
                                disabled={restoring === snap.id}
                                title="恢复此版本"
                                style={{
                                  background: 'none', border: 'none', padding: '4px', cursor: 'pointer',
                                  color: 'var(--text-muted)', borderRadius: '4px', display: 'flex', alignItems: 'center',
                                }}
                              >
                                <RotateCcw size={13} className={restoring === snap.id ? 'animate-spin' : ''} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteSnapshot(snap.id); }}
                                title="删除此快照"
                                style={{
                                  background: 'none', border: 'none', padding: '4px', cursor: 'pointer',
                                  color: 'var(--text-muted)', borderRadius: '4px', display: 'flex', alignItems: 'center',
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: preview panel */}
      {previewSnapshot && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{previewSnapshot.label}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {new Date(previewSnapshot.createdAt).toLocaleString('zh-CN')}
                <span style={{ marginLeft: '8px', padding: '0 4px', borderRadius: '3px', fontSize: '10px',
                  background: previewSnapshot.source === 'ai' ? 'rgba(139, 92, 246, 0.15)' : previewSnapshot.source === 'auto' ? 'rgba(6, 182, 212, 0.1)' : 'rgba(255,255,255,0.05)',
                  color: previewSnapshot.source === 'ai' ? '#a78bfa' : previewSnapshot.source === 'auto' ? '#22d3ee' : 'var(--text-muted)',
                }}>
                  {SOURCE_LABEL[previewSnapshot.source] || previewSnapshot.source}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setPreviewSnapshot(null)}
                style={{ background: 'none', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                关闭预览
              </button>
              <button
                onClick={() => restoreSnapshot(previewSnapshot)}
                disabled={restoring === previewSnapshot.id}
                style={{
                  background: 'var(--accent)', border: 'none', borderRadius: '6px', padding: '6px 12px',
                  fontSize: '12px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                <RotateCcw size={13} className={restoring === previewSnapshot.id ? 'animate-spin' : ''} />
                恢复此版本
              </button>
            </div>
          </div>
          <div style={{ padding: '20px', flex: 1 }}>
            <pre style={{
              fontSize: '13px', lineHeight: 1.7, color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px',
              margin: 0, maxHeight: 'calc(100vh - 240px)', overflowY: 'auto',
            }}>
              {(() => {
                try {
                  const parsed = JSON.parse(previewSnapshot.data);
                  if (typeof parsed === 'string') return parsed;
                  return JSON.stringify(parsed, null, 2);
                } catch {
                  return previewSnapshot.data;
                }
              })()}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
