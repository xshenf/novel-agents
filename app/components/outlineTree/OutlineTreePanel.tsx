'use client';

import { Save, X, BookOpen, Search, Undo2 } from 'lucide-react';
import type { OutlineTreeController } from './types';
import { VolumeOutlineView } from './VolumeOutlineView';
import { ChapterOutlineView } from './ChapterOutlineView';

interface OutlineTreePanelProps {
  ctrl: OutlineTreeController;
}

export function OutlineTreePanel({ ctrl }: OutlineTreePanelProps) {
  const {
    outlineSubTab,
    setOutlineSubTab,
    totalChapters,
    completionRate,
    handleSaveOutlineToProject,
    handleSelectMaterial,
    outlineSearchQuery,
    setOutlineSearchQuery,
    aiUndoStack,
    undoLastAiRegen,
    clearAiUndo,
  } = ctrl;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '30px', minHeight: 0, overflowY: 'auto', flexGrow: 1 }}>
      {/* 顶部标题统计栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'rgba(99, 102, 241, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(99, 102, 241, 0.25)'
          }}>
            <BookOpen size={18} color="#6366f1" />
          </div>
          <div>
            <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', margin: 0 }}>大纲设定</h4>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {totalChapters} 章节 · {completionRate}% 完成
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={outlineSearchQuery}
              onChange={e => setOutlineSearchQuery(e.target.value)}
              placeholder="搜索分卷 / 章节..."
              style={{
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#fff',
                fontSize: '12px',
                padding: '6px 12px 6px 30px',
                borderRadius: '6px',
                width: '200px',
                outline: 'none'
              }}
            />
          </div>
          <button
            type="button"
            className="btn"
            onClick={handleSaveOutlineToProject}
            style={{
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: '#fff',
              fontSize: '12px',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
            }}
          >
            <Save size={14} />
            <span>保存</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMaterial('worldSetting')}
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: 'var(--text-muted)',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title="关闭大纲设定，返回世界观设定"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 子 Tab 切换栏：分卷大纲 / 章节细纲 */}
      <div style={{
        display: 'flex',
        gap: '4px',
        background: 'rgba(0,0,0,0.2)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '10px',
        padding: '4px',
        flexShrink: 0,
        alignSelf: 'flex-start'
      }}>
        {[
          { key: 'volume', label: '分卷大纲' },
          { key: 'chapter', label: '章节细纲' }
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setOutlineSubTab(tab.key as 'volume' | 'chapter')}
            style={{
              padding: '6px 18px',
              borderRadius: '7px',
              border: 'none',
              background: outlineSubTab === tab.key
                ? 'rgba(99,102,241,0.18)'
                : 'transparent',
              color: outlineSubTab === tab.key ? '#fff' : 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: outlineSubTab === tab.key ? '600' : 'normal',
              cursor: 'pointer',
              transition: 'all 0.18s',
              boxShadow: outlineSubTab === tab.key
                ? '0 0 0 1px rgba(99,102,241,0.35)'
                : 'none'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 视图路由 */}
      {outlineSubTab === 'volume' ? <VolumeOutlineView ctrl={ctrl} /> : <ChapterOutlineView ctrl={ctrl} />}

      {/* AI 推演撤销浮层 - 由父容器定位，此处仅占位 */}
      {aiUndoStack.length > 0 && (
        <div
          data-ai-undo-overlay
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            padding: '12px 20px',
            background: 'rgba(15, 15, 25, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            zIndex: 100,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '8px', height: '8px',
              borderRadius: '50%',
              background: '#38bdf8',
              boxShadow: '0 0 6px rgba(56,189,248,0.6)'
            }} />
            <span style={{ fontSize: '13px', color: '#e0e0e0' }}>
              {(() => {
                const last = aiUndoStack[aiUndoStack.length - 1];
                const typeLabel = last.type === 'volume' ? '分卷' : last.type === 'chapter' ? '章节' : '字段';
                return `【${last.label}】${typeLabel}已推演`;
              })()}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={undoLastAiRegen}
              style={{
                fontSize: '12px', padding: '4px 14px',
                background: 'rgba(56,189,248,0.15)',
                border: '1px solid rgba(56,189,248,0.4)',
                color: '#38bdf8', borderRadius: '4px',
                cursor: 'pointer', fontWeight: '500',
                display: 'flex', alignItems: 'center', gap: '4px'
              }}
            >
              <Undo2 size={11} />
              撤销
            </button>
            <button
              type="button"
              onClick={clearAiUndo}
              style={{
                fontSize: '11px', padding: '4px 8px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-muted)', borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              确认
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
