'use client';

import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import type { OutlineTreeController } from './types';
import { VolumeCard } from './VolumeCard';

interface VolumeOutlineViewProps {
  ctrl: OutlineTreeController;
}

export function VolumeOutlineView({ ctrl }: VolumeOutlineViewProps) {
  const {
    localSections,
    collapsedVolumes,
    setCollapsedVolumes,
    outlineSearchQuery,
    handleInsertVolume,
    regeningVolumeIdx,
    editingVolumeIdx,
    flatChapters,
    store,
  } = ctrl;

  return (
    <>
      {/* 功能操作工具行 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.04)',
        borderRadius: '10px',
        padding: '10px 16px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => handleInsertVolume(localSections.length)}
            style={{
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: '#a5b4fc',
              fontSize: '12px',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          >
            <Plus size={14} />
            <span>添加卷</span>
          </button>

          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.08)' }} />

          <button
            type="button"
            onClick={() => {
              const allCollapsed = localSections.every((_, idx) => collapsedVolumes[idx]);
              if (allCollapsed) {
                setCollapsedVolumes({});
              } else {
                const next: Record<number, boolean> = {};
                localSections.forEach((_, idx) => { next[idx] = true; });
                setCollapsedVolumes(next);
              }
            }}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--text-muted)',
              fontSize: '12px',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {localSections.every((_, idx) => collapsedVolumes[idx])
              ? <><ChevronRight size={14} /><span>展开全部</span></>
              : <><ChevronDown size={14} /><span>折叠全部</span></>}
          </button>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          搜索关键词：<strong style={{ color: 'var(--accent)' }}>{outlineSearchQuery || '（无）'}</strong>
        </div>
      </div>

      {/* 分卷大纲树状看板 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flexGrow: 1, paddingRight: '4px' }}>
        {(() => {
          // 执行搜索过滤
          const query = outlineSearchQuery.trim().toLowerCase();
          const matchedVols = localSections.map((vol, vIdx) => {
            if (!query) return { vol, vIdx, matches: true, matchedChaps: vol.chapters.map((ch, cIdx) => ({ ch, cIdx, matches: true })) };

            const volTitleMatches = vol.title.toLowerCase().includes(query);
            const volContentMatches = vol.content.toLowerCase().includes(query);

            const matchedChaps = vol.chapters.map((ch, cIdx) => {
              const chTitleMatches = ch.title.toLowerCase().includes(query);
              const chContentMatches = ch.content.toLowerCase().includes(query);
              return { ch, cIdx, matches: chTitleMatches || chContentMatches };
            });

            const anyChapMatches = matchedChaps.some(c => c.matches);

            return {
              vol,
              vIdx,
              matches: volTitleMatches || volContentMatches || anyChapMatches,
              matchedChaps
            };
          }).filter(item => item.matches);

          if (matchedVols.length === 0) {
            return (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                background: 'rgba(255,255,255,0.01)',
                border: '1px dashed rgba(255,255,255,0.04)',
                borderRadius: '12px',
                color: 'var(--text-muted)',
                fontSize: '13px'
              }}>
                未找到符合条件的大纲分卷或章节设定
              </div>
            );
          }

          return matchedVols.map(({ vol, vIdx, matchedChaps }) => {
            const isCollapsed = collapsedVolumes[vIdx] || false;
            const isVolRegening = ctrl.regeningVolumeIdx === vIdx;
            const isEditing = editingVolumeIdx === vIdx;

            // 计算卷状态
            let volStatus: '未开始' | '进行中' | '已完成' = '未开始';
            if (vol.chapters.length > 0) {
              const totalChaps = vol.chapters.length;
              const writtenChaps = vol.chapters.filter(ch => {
                const dbCh = store.chapters.find((dbc: any) => dbc.title.includes(ch.title) || ch.title.includes(dbc.title));
                return dbCh && dbCh.content && dbCh.content.trim().length > 10;
              }).length;
              if (writtenChaps === totalChaps) {
                volStatus = '已完成';
              } else if (writtenChaps > 0) {
                volStatus = '进行中';
              }
            }

            return (
              <VolumeCard
                key={vIdx}
                ctrl={ctrl}
                vol={vol}
                vIdx={vIdx}
                volStatus={volStatus}
                matchedChaps={matchedChaps}
                isCollapsed={isCollapsed}
                isVolRegening={isVolRegening}
                isEditing={isEditing}
                flatChapters={flatChapters}
              />
            );
          });
        })()}
      </div>
    </>
  );
}
