import { useState } from 'react';

export type ResizablePanelsApi = ReturnType<typeof useResizablePanels>;

function readSavedWidth(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  const saved = localStorage.getItem(key);
  return saved ? Number(saved) : fallback;
}

/**
 * 布局面板尺寸状态管理。
 *
 * 注意：localStorage 持久化由消费组件的拖拽 onMouseUp 回调负责，
 * 而非在每次 mousemove 中写入，以避免拖拽期间高频 I/O。
 * 参见 WorkspaceSidebar.tsx / AgentPanel.tsx 的 resize-handle 实现。
 */
export function useResizablePanels() {
  const [sidebarWidth, setSidebarWidth] = useState(() => readSavedWidth('layout_sidebar_width', 260));
  const [aiPanelWidth, setAiPanelWidth] = useState(() => readSavedWidth('layout_ai_panel_width', 340));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return {
    sidebarWidth,
    setSidebarWidth,
    aiPanelWidth,
    setAiPanelWidth,
    sidebarCollapsed,
    setSidebarCollapsed,
  };
}
