'use client';

import { Save, Loader2 } from 'lucide-react';
import { useWorkspace } from '../workspace-context';

export function OutlineTab() {
  const { store, kernel } = useWorkspace();
  const {
    tempOutlineFull, setTempOutlineFull,
    kernelOptions, isKernelLoading,
  } = kernel;

  return (
    <div style={{ display: 'flex', flex: '1', minHeight: 0, padding: '30px', gap: '30px', overflowY: 'auto' }}>
      {/* 左栏：当前完整故事大纲 */}
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            完整故事大纲
          </h3>
          <button
            className="btn btn-primary"
            onClick={async () => {
              if (!store.currentProject) return;
              try {
                await store.updateProject(store.currentProject.id, { outlineFull: tempOutlineFull });
                alert('大纲保存成功！');
              } catch (e) { alert('大纲保存失败'); }
            }}
            style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Save size={13} />
            <span>保存大纲修改</span>
          </button>
        </div>
        <textarea
          className="textarea"
          placeholder="在此起草或微调本书的起承转合、主线任务及结局走向..."
          value={tempOutlineFull}
          onChange={e => setTempOutlineFull(e.target.value)}
          style={{ flexGrow: 1, minHeight: '400px', fontSize: '13px', lineHeight: '1.7', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '10px' }}
        />
      </div>

      {/* 右栏：AI 推演的 3 套备选方案卡片 */}
      <div style={{ width: '420px', display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0 }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)', margin: 0 }}>
          AI 大纲备选推荐（点击一键选用）
        </h3>

        {isKernelLoading ? (
          <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', gap: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px' }}>
            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>正在利用 AI 深度推演 3 套故事大纲...</span>
          </div>
        ) : kernelOptions?.outlineFull ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {kernelOptions.outlineFull.map((opt: any, idx: number) => (
              <div
                key={idx}
                className="glass-card animate-fade-in"
                style={{ padding: '16px', border: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.015)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <strong style={{ color: 'var(--accent)', fontSize: '13px' }}>{opt.name}</strong>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={async () => {
                      const val = opt.name + '：' + opt.description;
                      setTempOutlineFull(val);
                      if (store.currentProject) {
                        try {
                          await store.updateProject(store.currentProject.id, { outlineFull: val });
                          alert(`已选用《${opt.name}》大纲并自动保存！`);
                        } catch (e) {}
                      }
                    }}
                    style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--accent)', border: 'none' }}
                  >
                    选用此大纲
                  </button>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6', whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto' }}>
                  {opt.description}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dark)', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', fontSize: '12px' }}>
            当前尚未生成方案，请点击顶部按钮发起 AI 推演！
          </div>
        )}
      </div>
    </div>
  );
}
