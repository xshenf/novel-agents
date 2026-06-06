'use client';

import { ShieldCheck, Sparkles, Loader2, AlertTriangle, Lightbulb, CheckCircle2, X } from 'lucide-react';
import { useWorkspace } from '../../workspace-context';

// 写作页「跑偏校验」面板：对照记忆做一致性自检（人物状态矛盾 / 伏笔遗漏 / 世界观违背），
// 并提供「重算本章记忆」。结果结构化展示，取代原先的 alert。
export function DriftCheckPanel() {
  const { store, assist, ui } = useWorkspace();
  const { checkResult, setCheckResult, summarizeMsg, setSummarizeMsg, handleConsistencyCheck, handleAutoSummarize } = assist;
  const busy = ui.isAiLoading;

  if (!store.currentChapter) return null;

  const btn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '7px 12px', fontSize: '12px', borderRadius: '7px', cursor: 'pointer',
    background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', color: '#c7d2fe',
  };
  const disabledBtn: React.CSSProperties = { ...btn, opacity: 0.5, cursor: 'not-allowed' };

  return (
    <div style={{ margin: '12px 30px 0', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <ShieldCheck size={14} style={{ color: '#a5b4fc' }} />
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginRight: '4px' }}>跑偏校验</span>
        <button onClick={handleConsistencyCheck} disabled={busy} style={busy ? disabledBtn : btn} title="对照记忆检查人物 / 伏笔 / 世界观一致性">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
          一致性检测
        </button>
        <button onClick={handleAutoSummarize} disabled={busy} style={busy ? disabledBtn : btn} title="重新复盘本章，更新摘要 / 人物状态 / 伏笔 / 时间线">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} style={{ color: '#34d399' }} />}
          重算本章记忆
        </button>
      </div>

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
