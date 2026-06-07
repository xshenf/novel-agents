'use client';

import { Loader2, ChevronUp, ChevronDown, Sparkles } from 'lucide-react';
import { useWorkspace } from '../workspace-context';
import { createVersionSnapshot } from '@/lib/versionSnapshot';
import { GlassCard } from './ui/common';
import { useDebouncedSave } from '../hooks/useDebouncedSave';

interface KernelDimensionCardProps {
  cardKey: string;
  title: string;
  subtitle: string;
  value: string;
  setValue: (val: string) => void;
  cardType: string;
  placeholder: string;
  alwaysExpanded?: boolean;
  hideHeader?: boolean; // 隐藏卡片顶部标题栏（世界资产卡片已在外层显示标题）
}

export function KernelDimensionCard({
  cardKey,
  title,
  subtitle,
  value,
  setValue,
  cardType,
  placeholder,
  alwaysExpanded = false,
  hideHeader = false,
}: KernelDimensionCardProps) {
  const { store, kernel } = useWorkspace();
  const {
    expandedKernelCard,
    setExpandedKernelCard,
    deductingField,
    setDeductingField,
    deductionOptions,
    setDeductionOptions,
    isDeducting,
  } = kernel;
  const isExpanded = alwaysExpanded || expandedKernelCard === cardKey;

  // 自动保存：value 变化时使用 useDebouncedSave hook（2s 防抖）
  const doSave = async (val: string) => {
    if (!store.currentProject) return;
    try {
      await store.updateProject(store.currentProject!.id, { [cardType]: val });
      createVersionSnapshot({
        projectId: store.currentProject!.id,
        type: 'macro',
        key: cardType,
        label: title,
        data: val,
        source: 'auto',
      });
    } catch { /* ignore auto-save errors */ }
  };

  useDebouncedSave(value, doSave, 2000);

  const handleSelectOption = async (content: string) => {
    setValue(content);
    if (store.currentProject) {
      try {
        await store.updateProject(store.currentProject.id, { [cardType]: content });
        createVersionSnapshot({
          projectId: store.currentProject.id,
          type: 'macro',
          key: cardType,
          label: title,
          data: content,
          source: 'auto',
        });
      } catch (e) {
        console.error('Failed to auto-save selected deduction option', e);
      }
    }
    setDeductingField(null);
    setDeductionOptions([]);
  };

  return (
    <GlassCard style={{ marginBottom: '16px' }}>
      {/* 卡片头部（世界资产卡片在外层已显示标题，此处可隐藏） */}
      {!hideHeader && (
        <div
          onClick={() => {
            if (!alwaysExpanded) {
              setExpandedKernelCard(isExpanded ? null : cardKey);
            }
          }}
          style={{
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: alwaysExpanded ? 'default' : 'pointer',
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
            {!alwaysExpanded && (isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
          </div>
        </div>
      )}

      {/* 卡片展开内容 */}
      {isExpanded && (
        <div
          style={{
            padding: '20px',
            borderTop: hideHeader ? 'none' : '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '260px',
          }}
        >
          {/* 微调及保存 */}
          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>当前设定与微调</span>
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

            {/* AI 推演 Loading 状态展示 */}
            {deductingField === cardType && isDeducting && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', gap: '8px', background: 'rgba(0,0,0,0.12)', borderRadius: '8px', marginTop: '10px' }}>
                <Loader2 className="animate-spin" size={20} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>正在推演 3 个备选方案...</span>
              </div>
            )}

            {/* AI 推演 3 备选选项列表展示 */}
            {deductingField === cardType && !isDeducting && deductionOptions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px', padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px dashed var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent)' }}>AI 推演备选推荐 (一键选用)</span>
                  <button
                    type="button"
                    onClick={() => {
                      setDeductingField(null);
                      setDeductionOptions([]);
                    }}
                    style={{ fontSize: '10.5px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  >
                    收起
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {deductionOptions.map((opt: { name: string; description: string }, idx: number) => (
                    <div
                      key={opt.title || `${idx}-${opt.title}`}
                      style={{
                        padding: '10px 12px',
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#fff' }}>方案 {idx + 1}：{opt.title}</span>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleSelectOption(opt.content)}
                          style={{ fontSize: '10px', padding: '2px 8px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid var(--accent)' }}
                        >
                          选用
                        </button>
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                        {opt.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </GlassCard>
  );
}
