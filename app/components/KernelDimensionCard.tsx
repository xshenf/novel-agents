'use client';

import { useEffect, useRef } from 'react';
import { Save, Loader2, ChevronUp, ChevronDown, Sparkles } from 'lucide-react';
import { useWorkspace } from '../workspace-context';
import { createVersionSnapshot } from '@/lib/versionSnapshot';

interface KernelDimensionCardProps {
  cardKey: string;
  title: string;
  subtitle: string;
  value: string;
  setValue: (val: string) => void;
  cardType: string;
  placeholder: string;
}

export function KernelDimensionCard({
  cardKey,
  title,
  subtitle,
  value,
  setValue,
  cardType,
  placeholder,
}: KernelDimensionCardProps) {
  const { store, kernel } = useWorkspace();
  const { expandedKernelCard, setExpandedKernelCard, isKernelLoading, kernelOptions } = kernel;
  const isExpanded = expandedKernelCard === cardKey;

  // 自动保存：value 变化时 debounce 2s 保存
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const prevValueRef = useRef(value);
  useEffect(() => {
    if (value === prevValueRef.current) return;
    prevValueRef.current = value;
    if (!store.currentProject) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await store.updateProject(store.currentProject!.id, { [cardType]: value });
        createVersionSnapshot({
          projectId: store.currentProject!.id,
          type: 'macro',
          key: cardType,
          label: title,
          data: value,
          source: 'auto',
        });
      } catch { /* ignore auto-save errors */ }
    }, 2000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [value]);

  const handleSave = async () => {
    if (!store.currentProject) return;
    try {
      await store.updateProject(store.currentProject.id, { [cardType]: value });
    } catch { /* ignore */ }
  };

  return (
    <div
      className="glass-card"
      style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border-light)',
        borderRadius: '12px',
        marginBottom: '16px',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* 卡片头部 */}
      <div
        onClick={() => setExpandedKernelCard(isExpanded ? null : cardKey)}
        style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          background: isExpanded ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
          transition: 'background 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <strong style={{ fontSize: '15px', color: '#fff' }}>{title}</strong>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{subtitle}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {value ? '已设定' : '待补充设定'}
          </span>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* 卡片展开内容 */}
      {isExpanded && (
        <div
          style={{
            padding: '20px',
            borderTop: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '260px',
          }}
        >
          {/* 微调及保存 */}
          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>当前设定与微调</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => kernel.handleAiDeduceField(cardType, title)}
                  style={{
                    fontSize: '12px',
                    color: '#38bdf8',
                    background: 'rgba(56,189,248,0.06)',
                    border: '1px solid rgba(56,189,248,0.15)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Sparkles size={12} />
                  <span>AI推演</span>
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Save size={13} />
                  <span>保存设定</span>
                </button>
              </div>
            </div>
            <textarea
              className="textarea"
              placeholder={placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              style={{
                flexGrow: 1,
                minHeight: '140px',
                fontSize: '13px',
                lineHeight: '1.6',
                padding: '12px',
                background: 'rgba(0,0,0,0.15)',
                border: '1px solid var(--border-light)',
                borderRadius: '8px',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
