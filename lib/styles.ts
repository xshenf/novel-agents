import type { CSSProperties } from 'react';

/**
 * 项目通用按钮内联样式常量。
 * 用于替代分散在各组件中的重复 style 对象。
 */

/** 工具栏按钮（带图标，分栏/操作区底部） */
export const BTN_TOOLBAR: CSSProperties = {
  flex: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  padding: '6px 8px',
  fontSize: '11px',
  borderRadius: '6px',
  background: 'rgba(99,102,241,0.08)',
  border: '1px solid rgba(99,102,241,0.22)',
  color: '#c7d2fe',
  cursor: 'pointer',
};

/** 小号内联按钮（保存、取消等） */
export const BTN_INLINE: CSSProperties = {
  padding: '4px 10px',
  fontSize: '11px',
  border: 'none',
};

/** 透明背景按钮（锁定、上移/下移等工具按钮） */
export const BTN_GHOST: CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  color: 'var(--text-muted)',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

/** 危险操作按钮（删除） */
export const BTN_DANGER: CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(239, 68, 68, 0.2)',
  color: '#ef4444',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

/** 高亮/强调按钮（AI 推演、功能入口） */
export const BTN_ACCENT: CSSProperties = {
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
};

/** 汇总导出，方便按需取用 */
export const BTN_STYLES = {
  toolbar: BTN_TOOLBAR,
  inline: BTN_INLINE,
  ghost: BTN_GHOST,
  danger: BTN_DANGER,
  accent: BTN_ACCENT,
} as const;
