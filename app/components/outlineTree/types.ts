import type { MutableRefObject } from 'react';
import type { OutlineChapter, OutlineVolume } from '@/lib/outlineParser';
import type { AiUndoEntry } from '../../hooks/useAiUndoStack';
import type { OutlineSubTab } from '../../hooks/useMaterialTabs';
import type { WorkspaceContextValue } from '../../workspace-context';

export interface OutlineTreeController {
  // 视图
  outlineSubTab: OutlineSubTab;
  setOutlineSubTab: (v: OutlineSubTab) => void;
  handleSelectMaterial: (id: string) => void;

  // 状态
  localSections: OutlineVolume[];
  setLocalSections: (v: OutlineVolume[]) => void;
  tempOutlineFull: string;
  setTempOutlineFull: (v: string) => void;

  // 编辑
  editingVolumeIdx: number | null;
  setEditingVolumeIdx: (v: number | null) => void;
  editVolumeForm: OutlineVolume | null;
  setEditVolumeForm: (v: OutlineVolume | null) => void;
  editingChapterPath: { volIdx: number; chapIdx: number } | null;
  setEditingChapterPath: (v: { volIdx: number; chapIdx: number } | null) => void;
  editChapterForm: OutlineChapter | null;
  setEditChapterForm: (v: OutlineChapter | null) => void;

  // 折叠/搜索/筛选
  collapsedVolumes: Record<number, boolean>;
  setCollapsedVolumes: (v: Record<number, boolean>) => void;
  outlineSearchQuery: string;
  setOutlineSearchQuery: (v: string) => void;
  selectedVolumeIdx: number | null;
  setSelectedVolumeIdx: (v: number | null) => void;
  selectedChar: string | null;
  setSelectedChar: (v: string | null) => void;
  hoveredPoint: number | null;
  setHoveredPoint: (v: number | null) => void;

  // AI 推演
  regeningIndex: number | null;
  regeningVolumeIdx: number | null;
  regeningField: string | null;
  aiAbortRef: MutableRefObject<AbortController | null>;
  aiPromptVolIdx: number | null;
  setAiPromptVolIdx: (v: number | null) => void;
  aiPromptText: string;
  setAiPromptText: (v: string) => void;
  cancelAiRegen: () => void;

  // 撤销栈
  aiUndoStack: AiUndoEntry[];
  undoLastAiRegen: () => void;
  clearAiUndo: () => void;

  // 处理函数
  handleInsertVolume: (volIdx: number) => void;
  handleDeleteVolume: (volIdx: number) => void;
  handleMoveVolume: (volIdx: number, direction: 'up' | 'down') => void;
  toggleLockVolume: (volIdx: number) => void;
  saveVolumeEditing: () => void;

  handleInsertChapter: (volIdx: number, chapIdx: number) => void;
  handleDeleteChapter: (volIdx: number, chapIdx: number) => void;
  handleMoveChapter: (volIdx: number, chapIdx: number, direction: 'up' | 'down') => void;
  toggleLockChapter: (volIdx: number, chapIdx: number) => void;
  saveChapterEditing: () => void;

  handleAiRegenChapter: (volIdx: number, chapIdx: number) => void;
  handleAiRegenVolume: (volIdx: number, userHint?: string) => void;

  // 统计
  totalChapters: number;
  completionRate: number;
  flatChapters: (OutlineChapter & { volIdx: number; chapIdx: number })[];
  allCharacters: string[];

  // Store
  store: WorkspaceContextValue['store'];
  // 大纲保存到项目
  handleSaveOutlineToProject: () => Promise<void>;
}
