import { useState } from 'react';

export type ResizablePanelsApi = ReturnType<typeof useResizablePanels>;

function readSavedWidth(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  const saved = localStorage.getItem(key);
  return saved ? Number(saved) : fallback;
}

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
