'use client';

import { BookOpen, ChevronDown, ChevronUp, Target, MapPin } from 'lucide-react';
import { useState } from 'react';
import { useWorkspace } from '../workspace-context';
import { parseEmotionValue } from '@/lib/outlineParser';

interface WriteOutlinePreviewProps {
  variant?: 'inline' | 'card';
}

// 从 details 卡片中按关键字查找字段
function findDetail(details: { key: string; value: string }[], includes: string[]): string | null {
  const hit = details.find(d => includes.some(kw => d.key.includes(kw)));
  return hit ? hit.value.trim() : null;
}

export function WriteOutlinePreview({ variant = 'card' }: WriteOutlinePreviewProps) {
  const { outlineTree } = useWorkspace();
  const { localSections, selectedVolumeIdx, selectedChapterIdx } = outlineTree;
  const [collapsed, setCollapsed] = useState(false);

  // 无选中或大纲为空：不渲染
  if (selectedVolumeIdx === null || localSections.length === 0) return null;
  const vol = localSections[selectedVolumeIdx];
  if (!vol) return null;

  const chap = selectedChapterIdx !== null ? vol.chapters[selectedChapterIdx] : null;

  // 解析章节关键字段（取自 details 卡片）
  const targetWordsStr = chap ? findDetail(chap.details, ['目标字数', '字数', '篇幅']) : null;
  const targetWords = targetWordsStr ? parseInt(targetWordsStr.match(/\d+/)?.[0] ?? '0', 10) : 0;
  const location = chap ? findDetail(chap.details, ['地点', '场景', '地理位置']) : null;
  const emotion = chap ? parseEmotionValue(chap.details) : null;
  const emotionKnown = chap ? chap.details.some(d => d.key.includes('情绪') || d.key.includes('起伏') || d.key.includes('曲线')) : false;

  const containerStyle: React.CSSProperties = variant === 'card' ? {
    margin: '15px 30px 0',
    padding: '14px 18px',
    background: 'rgba(99, 102, 241, 0.06)',
    border: '1px solid rgba(99, 102, 241, 0.18)',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  } : {
    padding: '10px 0',
  };

  return (
    <div className="glass-card animate-fade-in" style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          <div style={{
            width: '28px', height: '28px',
            borderRadius: '6px',
            background: 'rgba(99, 102, 241, 0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <BookOpen size={14} color="#a5b4fc" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px' }}>
              当前大纲节点
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{vol.title || `第 ${selectedVolumeIdx + 1} 卷`}</span>
              {chap && <>
                <span style={{ color: 'var(--text-muted)' }}>/</span>
                <span style={{ fontSize: '13px', color: '#a5b4fc' }}>{chap.title || `第 ${selectedChapterIdx! + 1} 章`}</span>
              </>}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="btn-icon"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? '展开大纲详情' : '收起大纲详情'}
          style={{ flexShrink: 0 }}
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
          {vol.content && (
            <div>
              <span style={{ color: 'rgba(165, 180, 252, 0.85)' }}>分卷概要：</span>
              <span style={{ color: '#d1d5db' }}>{vol.content}</span>
            </div>
          )}
          {chap && (
            <>
              {targetWords > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Target size={11} color="#a5b4fc" />
                  <span>目标字数：</span>
                  <span style={{ color: '#fff' }}>{targetWords}</span>
                </div>
              )}
              {location && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={11} color="#a5b4fc" />
                  <span>场景地点：</span>
                  <span style={{ color: '#fff' }}>{location}</span>
                </div>
              )}
              {chap.details && chap.details.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ color: 'rgba(165, 180, 252, 0.85)' }}>章节细纲：</span>
                  <div style={{
                    padding: '8px 10px',
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    borderRadius: '6px',
                    color: '#e0e0e0', fontSize: '12px', lineHeight: '1.6',
                    maxHeight: '220px', overflowY: 'auto',
                  }}>
                    {chap.details.map((d, i) => (
                      <div key={i} style={{ marginBottom: '4px' }}>
                        <span style={{ color: 'rgba(165, 180, 252, 0.85)' }}>{d.key}：</span>
                        <span style={{ color: '#d1d5db', whiteSpace: 'pre-wrap' }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {emotionKnown && emotion !== null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>情绪指数：</span>
                  <span style={{
                    color: emotion >= 70 ? 'var(--accent-success)' : emotion <= 30 ? '#ef4444' : '#fbbf24',
                    fontWeight: 600,
                  }}>{emotion}</span>
                </div>
              )}
            </>
          )}
          {chap && chap.details.length === 0 && !location && !targetWords && (
            <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
              尚未填写章节细纲，可前往"大纲与设定"补充
            </div>
          )}
        </div>
      )}
    </div>
  );
}
