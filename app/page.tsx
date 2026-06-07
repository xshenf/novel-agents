'use client';

import { useState, useMemo } from 'react';
import { useNovelStore } from '@/lib/store';
import { useAiClient } from './hooks/useAiClient';
import { useWorkspaceRouting } from './hooks/useWorkspaceRouting';
import { useEditor } from './hooks/useEditor';
import { useModelSettings } from './hooks/useModelSettings';
import { useAutoWriter } from './hooks/useAutoWriter';
import { useAgentChat } from './hooks/useAgentChat';
import { useAiAssist } from './hooks/useAiAssist';
import { useWizard } from './hooks/useWizard';
import { useProjectKernel } from './hooks/useProjectKernel';
import { useCreationModals } from './hooks/useCreationModals';
import { useResizablePanels } from './hooks/useResizablePanels';
import { useOutlineTreeState } from './hooks/useOutlineTreeState';
import { useVolumeActions } from './hooks/useVolumeActions';
import { useChapterMemory } from './hooks/useChapterMemory';
import { useInlineAi } from './hooks/useInlineAi';
import { WorkspaceProvider, type WorkspaceContextValue } from './workspace-context';
import { TopNav } from './components/TopNav';
import { Dashboard } from './components/Dashboard';
import { WizardPanel } from './components/WizardPanel';
import { SettingsDrawer } from './components/SettingsDrawer';
import { InspirationsModal } from './components/InspirationsModal';
import { NewChapterModal, NewCharModal, NewRuleModal, EditProjectModal, GlobalPromptModal } from './components/Modals';
import { useEffect } from 'react';
import { WorkspaceSidebar } from './components/WorkspaceSidebar';
import { WorkspaceTabBar } from './components/WorkspaceTabBar';
import { WriteTab } from './components/WriteTab';
import { OutlineTab } from './components/OutlineTab';
import { VersionHistoryTab } from './components/VersionHistoryTab';
import { AgentPanel } from './components/AgentPanel';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function Home() {
  const store = useNovelStore();

  // 劫持浏览器默认的 alert 弹窗，替换为美观的主题提示模态框
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origAlert = window.alert;
      window.alert = (message: string) => {
        store.showAlert(message);
      };
      return () => { window.alert = origAlert; };
    }
  }, [store]);
  const callAIApi = useAiClient();
  const routing = useWorkspaceRouting(store);
  const { mounted, activeWorkspaceTab } = routing;
  const editor = useEditor(store);
  const models = useModelSettings(store);
  const autoWriter = useAutoWriter({ store, callAIApi, setEditorContent: editor.setEditorContent, setSaveStatus: editor.setSaveStatus });
  const [isAiLoading, setIsAiLoading] = useState(false);
  const assist = useAiAssist({ store, callAIApi, editorContent: editor.editorContent, setIsAiLoading });
  const kernel = useProjectKernel({ store, callAIApi });
  const wizard = useWizard({ store, router: routing.router, buildWorkspaceUrl: routing.buildWorkspaceUrl, setIsAiLoading, onExistingProjectComplete: () => { setTimeout(() => kernel.fetchKernelOptions(), 300); } });
  const modals = useCreationModals(store);
  const layout = useResizablePanels();
  const agent = useAgentChat(store);
  const outlineTree = useOutlineTreeState({ tempOutlineFull: kernel.tempOutlineFull, currentChapter: store.currentChapter, urlVolumeIdx: routing.urlVolumeIdx });
  const volumeActions = useVolumeActions({
    store,
    getLocalSections: () => outlineTree.localSections,
    setOutlineFull: kernel.setTempOutlineFull,
  });
  const chapterMemory = useChapterMemory({ store, callAIApi });
  const inlineAi = useInlineAi({
    store,
    callAIApi,
    editorContent: editor.editorContent,
    setEditorContent: editor.setEditorContent,
    setSaveStatus: editor.setSaveStatus,
  });

  const value: WorkspaceContextValue = useMemo(() => ({
    store,
    ui: { isAiLoading, setIsAiLoading },
    routing,
    editor,
    models,
    autoWriter,
    agent,
    assist,
    wizard,
    kernel,
    modals,
    layout,
    outlineTree,
    volumeActions,
    chapterMemory,
    inlineAi,
  }), [
    store, isAiLoading, setIsAiLoading, routing, editor, models, autoWriter,
    agent, assist, wizard, kernel, modals, layout, outlineTree, volumeActions,
    chapterMemory, inlineAi,
  ]);

  if (!mounted) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0b0f19', color: '#94a3b8' }}>
        加载中...
      </div>
    );
  }

  return (
    <WorkspaceProvider value={value}>
      <ErrorBoundary>
        <main>
          <TopNav />

          {/* 1. Dashboard 视图 */}
          {!store.currentProject ? (
            <Dashboard />
          ) : (
            /* 2. Workspace 写作工作台视图 */
            <div className="workspace-layout" style={{ display: 'flex' }}>
              <WorkspaceSidebar />

              {/* 中间：主章节编辑器 / 大纲 / 设定 工作区 */}
              <div className="workspace-main" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', flexGrow: 1, minWidth: 300 }}>
                <WorkspaceTabBar />

                {activeWorkspaceTab === 'write' ? (
                  <WriteTab />
                ) : activeWorkspaceTab === 'outline' ? (
                  <OutlineTab />
                ) : (
                  <VersionHistoryTab />
                )}
              </div>

              <AgentPanel />

              {/* workspace 内的向导弹窗（跳过向导后补全设定时使用） */}
              {wizard.isWizardMode && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#0b0f19', overflow: 'auto' }}>
                  <WizardPanel />
                </div>
              )}
            </div>
          )}

          {/* ======= Modals ======= */}
          <SettingsDrawer />
          <InspirationsModal />
          <NewChapterModal />
          <NewCharModal />
          <NewRuleModal />
          <EditProjectModal />
          <GlobalPromptModal />
        </main>
      </ErrorBoundary>
    </WorkspaceProvider>
  );
}
