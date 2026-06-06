'use client';

import { createContext, useContext, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import type { NovelStore } from '@/lib/store';
import type { useWorkspaceRouting } from './hooks/useWorkspaceRouting';
import type { useEditor } from './hooks/useEditor';
import type { useModelSettings } from './hooks/useModelSettings';
import type { useAutoWriter } from './hooks/useAutoWriter';
import type { useAgentChat } from './hooks/useAgentChat';
import type { useAiAssist } from './hooks/useAiAssist';
import type { useWizard } from './hooks/useWizard';
import type { useProjectKernel } from './hooks/useProjectKernel';
import type { useCreationModals } from './hooks/useCreationModals';
import type { useResizablePanels } from './hooks/useResizablePanels';

// 命名空间化的工作台 Context：各 hook 输出按功能分组，避免大平铺
export type WorkspaceContextValue = {
  store: NovelStore;
  ui: {
    isAiLoading: boolean;
    setIsAiLoading: Dispatch<SetStateAction<boolean>>;
  };
  routing: ReturnType<typeof useWorkspaceRouting>;
  editor: ReturnType<typeof useEditor>;
  models: ReturnType<typeof useModelSettings>;
  autoWriter: ReturnType<typeof useAutoWriter>;
  agent: ReturnType<typeof useAgentChat>;
  assist: ReturnType<typeof useAiAssist>;
  wizard: ReturnType<typeof useWizard>;
  kernel: ReturnType<typeof useProjectKernel>;
  modals: ReturnType<typeof useCreationModals>;
  layout: ReturnType<typeof useResizablePanels>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ value, children }: { value: WorkspaceContextValue; children: ReactNode }) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace 必须在 WorkspaceProvider 内部使用');
  }
  return ctx;
}
