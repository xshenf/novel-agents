import { useState } from 'react';

export type ResizablePanelsApi = ReturnType<typeof useResizablePanels>;

export function useResizablePanels() {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('layout_sidebar_width');
      return saved ? Number(saved) : 260;
    }
    return 260;
  });
  const [aiPanelWidth, setAiPanelWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('layout_ai_panel_width');
      return saved ? Number(saved) : 340;
    }
    return 340;
  });
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
