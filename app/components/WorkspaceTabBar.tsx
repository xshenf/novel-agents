'use client';

import { Loader2, Sparkles, Clock } from 'lucide-react';
import { useWorkspace } from '../workspace-context';

export function WorkspaceTabBar() {
  const { store, routing, kernel } = useWorkspace();
  const { router, activeWorkspaceTab, setActiveWorkspaceTab, buildWorkspaceUrl } = routing;
  const { isKernelLoading, fetchKernelOptions, isOutlineMissing, isSettingsMissing } = kernel;

  return (
    <div style={{ display: 'flex', gap: '8px', padding: '16px 30px', borderBottom: '1px solid var(--border-light)', background: 'rgba(255, 255, 255, 0.02)', alignItems: 'center', flexShrink: 0 }}>
      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '20px', display: 'flex', gap: '4px' }}>
        <button
          className={`btn ${activeWorkspaceTab === 'write' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setActiveWorkspaceTab('write'); router.push(buildWorkspaceUrl(store.currentProject!.id, 'write', store.currentChapter?.id)); }}
          style={{ borderRadius: '16px', padding: '6px 16px', fontSize: '12px', border: 'none', background: activeWorkspaceTab === 'write' ? 'var(--accent)' : 'transparent', color: activeWorkspaceTab === 'write' ? '#fff' : 'var(--text-muted)' }}
        >
          连载写作
        </button>
        <button
          className={`btn ${activeWorkspaceTab === 'outline' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setActiveWorkspaceTab('outline'); router.push(buildWorkspaceUrl(store.currentProject!.id, 'outline')); }}
          style={{ position: 'relative', borderRadius: '16px', padding: '6px 16px', fontSize: '12px', border: 'none', background: activeWorkspaceTab === 'outline' ? 'var(--accent)' : 'transparent', color: activeWorkspaceTab === 'outline' ? '#fff' : 'var(--text-muted)' }}
        >
          大纲与设定
          {(isOutlineMissing || isSettingsMissing) && (
            <span style={{ position: 'absolute', top: '4px', right: '4px', width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
          )}
        </button>
        <button
          className={`btn ${activeWorkspaceTab === 'versions' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setActiveWorkspaceTab('versions'); router.push(buildWorkspaceUrl(store.currentProject!.id, 'versions')); }}
          style={{ borderRadius: '16px', padding: '6px 16px', fontSize: '12px', border: 'none', background: activeWorkspaceTab === 'versions' ? 'var(--accent)' : 'transparent', color: activeWorkspaceTab === 'versions' ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <Clock size={12} />
          历史版本
        </button>
      </div>

      {activeWorkspaceTab !== 'write' && (
        <button
          className="btn btn-secondary"
          onClick={fetchKernelOptions}
          disabled={isKernelLoading}
          style={{ marginLeft: 'auto', fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          {isKernelLoading ? <Loader2 className="animate-spin" size={13} /> : <Sparkles size={13} style={{ color: 'var(--accent)' }} />}
          <span>重新推演设定与大纲</span>
        </button>
      )}
    </div>
  );
}
