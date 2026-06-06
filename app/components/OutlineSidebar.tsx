'use client';

import { Plus } from 'lucide-react';
import { MATERIALS_LIST, MATERIAL_GROUPS } from '../hooks/useMaterialTabs';

interface OutlineSidebarProps {
  activeMaterial: string;
  onSelectMaterial: (id: string) => void;
}

/**
 * 大纲 Tab 左侧的 18 宫格世界素材磁贴栏。
 * 负责：素材磁贴的渲染、选中态高亮。
 */
export function OutlineSidebar({
  activeMaterial,
  onSelectMaterial,
}: OutlineSidebarProps) {
  return (
    <div style={{
      width: '260px',
      background: 'rgba(15, 15, 22, 0.4)',
      borderRight: '1px solid var(--border-light)',
      display: 'flex',
      flexDirection: 'column',
      padding: '14px',
      gap: '12px',
      flexShrink: 0,
      overflowY: 'auto'
    }}>


      {/* 按分组渲染磁贴网格 */}
      {MATERIAL_GROUPS.map(group => {
        const items = MATERIALS_LIST.filter(m => m.group === group.key);
        if (items.length === 0) return null;
        return (
          <div key={group.key}>
            <div style={{
              fontSize: '10px',
              fontWeight: 600,
              color: 'rgba(165, 180, 252, 0.7)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '6px',
              paddingLeft: '2px',
            }}>
              {group.label}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '6px',
            }}>
              {items.map(item => {
                const isSelected = activeMaterial === item.id;
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectMaterial(item.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      padding: '8px',
                      height: '58px',
                      background: isSelected ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                      border: isSelected ? `1px solid ${item.color}` : '1px solid rgba(255, 255, 255, 0.04)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? `0 0 12px ${item.color}25` : 'none',
                      outline: 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.04)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.01)';
                      }
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '22px',
                      height: '22px',
                      borderRadius: '5px',
                      background: `${item.color}15`,
                      color: item.color
                    }}>
                      <IconComponent size={13} />
                    </div>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: isSelected ? '600' : 'normal',
                      color: isSelected ? '#fff' : 'var(--text-muted)',
                      marginTop: '5px'
                    }}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
