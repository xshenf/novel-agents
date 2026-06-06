'use client';

import { Save, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { useWorkspace } from '../workspace-context';

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

  const handleSave = async () => {
    if (!store.currentProject) return;
    try {
      await store.updateProject(store.currentProject.id, { [cardType]: value });
      alert(`${title}已成功保存！`);
    } catch (e) {
      alert(`${title}保存失败`);
    }
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
            gap: '24px',
            minHeight: '260px',
          }}
        >
          {/* 左侧：微调及保存 */}
          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>当前设定与微调</span>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Save size={13} />
                <span>保存设定</span>
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
          </div>

          {/* 右侧：AI 智能推荐方案 */}
          <div style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>
              AI 推荐备选方案 (一键选用)
            </div>

            {isKernelLoading ? (
              <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '20px' }}>
                <Loader2 className="animate-spin" size={20} style={{ color: 'var(--accent)', marginBottom: '8px' }} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>正在推演设定...</span>
              </div>
            ) : kernelOptions?.[cardType] ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                {kernelOptions[cardType].map((opt: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 12px',
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid var(--border-light)',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent)' }}>{opt.name}</span>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={async () => {
                          const val = opt.name + '：' + opt.description;
                          setValue(val);
                          if (store.currentProject) {
                            try {
                              await store.updateProject(store.currentProject.id, { [cardType]: val });
                              alert(`已选用《${opt.name}》方案并自动保存！`);
                            } catch (e) {}
                          }
                        }}
                        style={{ fontSize: '10px', padding: '2px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)' }}
                      >
                        选用
                      </button>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5' }}>
                      {opt.description}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-light)', borderRadius: '8px', padding: '20px', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-dark)' }}>
                  暂无推荐，点击顶部「重新推演设定与大纲」生成方案
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
