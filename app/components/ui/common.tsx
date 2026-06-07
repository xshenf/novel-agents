'use client';

import type { ReactNode, CSSProperties, MouseEvent } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

// ---------------------------------------------------------------------------
// GlassCard — 带玻璃拟态边框的容器
// ---------------------------------------------------------------------------

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
}

const GLASS_CARD_BASE: CSSProperties = {
  background: 'rgba(255, 255, 255, 0.02)',
  border: '1px solid var(--border-light)',
  borderRadius: '12px',
  overflow: 'hidden',
  flexShrink: 0,
};

export function GlassCard({ children, className, style, onClick }: GlassCardProps) {
  return (
    <div
      className={className ? `glass-card ${className}` : 'glass-card'}
      style={{ ...GLASS_CARD_BASE, ...style }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptyState — 空状态占位提示
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  message: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
}

const EMPTY_STATE_BASE: CSSProperties = {
  padding: '40px',
  textAlign: 'center',
  background: 'rgba(255, 255, 255, 0.01)',
  border: '1px dashed rgba(255, 255, 255, 0.04)',
  borderRadius: '12px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '16px',
  margin: '20px 0',
};

export function EmptyState({ message, children, style }: EmptyStateProps) {
  return (
    <div style={{ ...EMPTY_STATE_BASE, ...style }}>
      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{message}</div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionHeader — 可折叠区块标题栏（带上下箭头）
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  isExpanded: boolean;
  onToggle?: () => void;
  extra?: ReactNode;
  cursor?: 'pointer' | 'default';
  style?: CSSProperties;
}

export function SectionHeader({
  title,
  subtitle,
  isExpanded,
  onToggle,
  extra,
  cursor = 'pointer',
  style,
}: SectionHeaderProps) {
  return (
    <div
      onClick={onToggle}
      style={{
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor,
        background: isExpanded ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
        transition: 'background 0.2s ease',
        ...style,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <strong style={{ fontSize: '15px', color: '#fff' }}>{title}</strong>
        {subtitle && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{subtitle}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {extra}
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>
    </div>
  );
}
