'use client';

import { Plus } from 'lucide-react';
import { MATERIALS_LIST } from '../hooks/useMaterialTabs';

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
      width: '320px',
      background: 'rgba(15, 15, 22, 0.4)',
      borderRight: '1px solid var(--border-light)',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px',
      gap: '16px',
      flexShrink: 0,
      overflowY: 'auto'
    }}>


      {/* 18 宫格磁贴网格 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '10px',
        marginTop: '4px'
      }}>
        {MATERIALS_LIST.map(item => {
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
                padding: '12px',
                height: '80px',
                background: isSelected ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                border: isSelected ? `1px solid ${item.color}` : '1px solid rgba(255, 255, 255, 0.04)',
                borderRadius: '10px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                boxShadow: isSelected ? `0 0 12px ${item.color}25` : 'none',
                outline: 'none',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
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
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: `${item.color}15`,
                color: item.color
              }}>
                <IconComponent size={16} />
              </div>
              <span style={{
                fontSize: '12px',
                fontWeight: isSelected ? '600' : 'normal',
                color: isSelected ? '#fff' : 'var(--text-muted)',
                marginTop: '8px'
              }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
