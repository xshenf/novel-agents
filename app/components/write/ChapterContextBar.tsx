'use client';

import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useWorkspace } from '../../workspace-context';
import { findDetail, parseEmotionValue } from '@/lib/outlineParser';
import { countChineseChars } from '@/lib/textStats';

// 写作页顶部的薄上下文条：卷/章 + 目标字数进度 + 可展开的本章细纲。
// 取代原先占大半屏的 WriteOutlinePreview 卡片。
export function ChapterContextBar() {
  const { store, editor, outlineTree } = useWorkspace();
  const { localSections, selectedVolumeIdx, selectedChapterIdx } = outlineTree;
  const [expanded, setExpanded] = useState(false);

  if (!store.currentChapter) return null;

  const vol = selectedVolumeIdx !== null ? localSections[selectedVolumeIdx] : null;
  const chap = vol && selectedChapterIdx !== null ? vol.chapters[selectedChapterIdx] : null;

  const current = countChineseChars(editor.editorContent);
  const targetStr = chap ? findDetail(chap.details, ['目标字数', '字数', '篇幅']) : null;
  const target = targetStr ? parseInt(targetStr.match(/\d+/)?.[0] ?? '0', 10) : 0;
  const ratio = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const emotion = chap ? parseEmotionValue(chap.details) : null;
  const emotionKnown = chap ? chap.details.some(d => d.key.includes('情绪') || d.key.includes('起伏') || d.key.includes('曲线')) : false;

  const volTitle = vol?.title || (selectedVolumeIdx !== null ? `第 ${selectedVolumeIdx + 1} 卷` : '');
  const chapTitle = chap?.title || store.currentChapter.title;
  const hasDetails = !!chap && chap.details.length > 0;

  return (
    <div style={{
      margin: '12px 30px 0', padding: '9px 16px',
      background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border-light)',
      borderRadius: '9px', display: 'flex', flexDirection: 'column', gap: expanded ? '10px' : 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <BookOpen size={13} style={{ color: '#a5b4fc', flexShrink: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
          {volTitle && <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{volTitle}</span>}
          {volTitle && <span style={{ color: 'var(--text-muted)' }}>/</span>}
          <span style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chapTitle}</span>
        </div>

        {/* 字数进度 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {target > 0 && (
            <div style={{ width: '80px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              <div style={{ width: `${ratio}%`, height: '100%', background: ratio >= 100 ? 'var(--accent-success)' : 'var(--accent)', transition: 'width 0.3s' }} />
            </div>
          )}
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {current}{target > 0 ? ` / ${target}` : ''} 字
          </span>
        </div>

        {hasDetails && (
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', flexShrink: 0 }}
            title={expanded ? '收起本章细纲' : '展开本章细纲'}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {expanded && chap && (
        <div style={{
          padding: '8px 10px', background: 'rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px',
          fontSize: '12px', lineHeight: '1.6', maxHeight: '220px', overflowY: 'auto',
        }}>
          {chap.details.map((d, i) => (
            <div key={i} style={{ marginBottom: '4px' }}>
              <span style={{ color: 'rgba(165, 180, 252, 0.85)' }}>{d.key}：</span>
              <span style={{ color: '#d1d5db', whiteSpace: 'pre-wrap' }}>{d.value}</span>
            </div>
          ))}
          {emotionKnown && emotion !== null && (
            <div style={{ marginTop: '2px' }}>
              <span style={{ color: 'rgba(165, 180, 252, 0.85)' }}>情绪指数：</span>
              <span style={{ color: emotion >= 70 ? 'var(--accent-success)' : emotion <= 30 ? '#ef4444' : '#fbbf24', fontWeight: 600 }}>{emotion}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
