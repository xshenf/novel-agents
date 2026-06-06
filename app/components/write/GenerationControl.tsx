'use client';

import { Sparkles, Loader2, Pause, ChevronRight, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { useWorkspace } from '../../workspace-context';
import { nextUnwritten } from '@/lib/chapterLinking';

const BATCH_NUMS = [3, 5, 8] as const;

// 写作页顶部「AI 生成」控制区：续写下一章 / 批量 N 章 / 写到结尾 + 进度与暂停。
// 复用 useAutoWriter（此前已实现但无 UI 入口）。
export function GenerationControl() {
  const { store, autoWriter, outlineTree } = useWorkspace();
  const {
    isAutoWriting, autoWritingStatus, finishedChaptersCount,
    targetChaptersCount, writeUntilEnd, startAutoWriting, pauseAutoWriting,
  } = autoWriter;
  const { localSections } = outlineTree;
  const [batch, setBatch] = useState<number>(3);
  const [showBatch, setShowBatch] = useState(false);

  const next = nextUnwritten(localSections, store.chapters);

  const card: React.CSSProperties = {
    margin: '12px 30px 0', padding: '14px 18px',
    background: 'rgba(99, 102, 241, 0.06)',
    border: '1px solid rgba(99, 102, 241, 0.2)',
    borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px',
  };
  const primaryBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '7px 14px', fontSize: '13px', fontWeight: 600,
    background: 'linear-gradient(135deg, var(--accent) 0%, #a5b4fc 100%)',
    border: 'none', color: '#fff', borderRadius: '7px', cursor: 'pointer',
  };
  const ghostBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '7px 12px', fontSize: '12px',
    background: 'rgba(99, 102, 241, 0.08)',
    border: '1px solid rgba(99, 102, 241, 0.25)',
    color: 'var(--text-primary, #e2e8f0)', borderRadius: '7px', cursor: 'pointer',
  };
  const disabled: React.CSSProperties = { opacity: 0.5, cursor: 'not-allowed' };

  return (
    <div className="glass-card animate-fade-in" style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Sparkles size={14} style={{ color: '#a5b4fc' }} />
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>AI 生成</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>
          {next ? `下一待写：${next.title}` : '大纲章节已全部写完'}
        </span>
      </div>

      {isAutoWriting ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Loader2 size={14} className="animate-spin" style={{ color: '#a5b4fc' }} />
          <span style={{ flex: 1, fontSize: '12px', color: '#d1d5db' }}>
            {autoWritingStatus}
            <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
              已完成 {finishedChaptersCount} 章{writeUntilEnd ? '（持续生成）' : ` / 共 ${targetChaptersCount} 章`}
            </span>
          </span>
          <button onClick={pauseAutoWriting} style={{ ...ghostBtn, border: '1px solid rgba(251, 191, 36, 0.4)', color: '#fbbf24' }}>
            <Pause size={12} /> 暂停
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <button
            onClick={() => startAutoWriting({ count: 1, untilEnd: false })}
            style={next ? primaryBtn : { ...primaryBtn, ...disabled }}
            disabled={!next}
            title="让 AI 生成下一个待写章节，并自动复盘更新记忆"
          >
            <Wand2 size={13} /> 续写下一章
          </button>

          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowBatch(s => !s)} style={ghostBtn} title="一次生成多章">
              <Sparkles size={12} style={{ color: '#a5b4fc' }} />
              批量 {batch} 章
              <ChevronRight size={10} style={{ transform: showBatch ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>
            {showBatch && (
              <>
                <div onClick={() => setShowBatch(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                <div style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 10,
                  background: 'var(--bg-card, #1a1f2e)', border: '1px solid var(--border-light)',
                  borderRadius: '6px', padding: '4px', minWidth: '130px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  display: 'flex', flexDirection: 'column',
                }}>
                  {BATCH_NUMS.map(n => (
                    <button
                      key={n}
                      onClick={() => { setBatch(n); setShowBatch(false); startAutoWriting({ count: n, untilEnd: false }); }}
                      style={{ ...ghostBtn, width: '100%', justifyContent: 'flex-start', border: 'none', background: n === batch ? 'rgba(99,102,241,0.18)' : 'transparent' }}
                    >
                      连续生成 {n} 章
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => startAutoWriting({ untilEnd: true })}
            style={ghostBtn}
            title="持续生成，直到所有待写章节完成"
          >
            <Sparkles size={12} /> 写到结尾
          </button>
        </div>
      )}
    </div>
  );
}
