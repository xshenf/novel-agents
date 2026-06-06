'use client';

import { AlertTriangle, Lightbulb, CheckCircle2, X } from 'lucide-react';
import { useWorkspace } from '../../workspace-context';

// 写作页「跑偏校验」自检结果浮沉展示区（按钮已移入编辑器工具栏）
export function DriftCheckPanel() {
  const { store, assist } = useWorkspace();
  const { checkResult, setCheckResult, summarizeMsg, setSummarizeMsg } = assist;

  if (!store.currentChapter) return null;
  if (!summarizeMsg && !checkResult) return null;

  return (
    <div style={{ margin: '12px 30px 0', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {summarizeMsg && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '6px', fontSize: '12px', color: '#a7f3d0' }}>
          <CheckCircle2 size={13} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span style={{ flex: 1 }}>{summarizeMsg}</span>
          <button onClick={() => setSummarizeMsg(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={12} /></button>
        </div>
      )}

      {checkResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: checkResult.passed ? 'var(--accent-success)' : '#fbbf24', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
              {checkResult.passed ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
              {checkResult.passed ? '未发现明显跑偏' : `发现 ${checkResult.issues?.length || 0} 处疑似问题`}
            </span>
            <button onClick={() => setCheckResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={12} /></button>
          </div>
          {checkResult.issues && checkResult.issues.length > 0 && (
            <div style={{ padding: '8px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px' }}>
              {checkResult.issues.map((issue, i) => (
                <div key={i} style={{ display: 'flex', gap: '6px', color: '#fca5a5', marginBottom: '4px' }}>
                  <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{issue}</span>
                </div>
              ))}
            </div>
          )}
          {checkResult.suggestions && checkResult.suggestions.length > 0 && (
            <div style={{ padding: '8px 10px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '6px' }}>
              {checkResult.suggestions.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: '6px', color: '#c7d2fe', marginBottom: '4px' }}>
                  <Lightbulb size={12} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
