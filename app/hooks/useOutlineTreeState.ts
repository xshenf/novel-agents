import { useState, useMemo } from 'react';
import { parseStructureOutline, type OutlineVolume } from '@/lib/outlineParser';

interface UseOutlineTreeStateParams {
  tempOutlineFull: string;
}

// 共享"目录式大纲"状态：解析分卷-章节并维护最左侧章节列表的选中节点
// WorkspaceSidebar / WriteTab / OutlineTab 均复用同一份解析结果与选中态
export function useOutlineTreeState({ tempOutlineFull }: UseOutlineTreeStateParams) {
  const [selectedVolumeIdx, setSelectedVolumeIdx] = useState<number | null>(null);
  const [selectedChapterIdx, setSelectedChapterIdx] = useState<number | null>(null);
  const [collapsedVolumes, setCollapsedVolumes] = useState<Record<number, boolean>>({});

  const localSections = useMemo(() => parseStructureOutline(tempOutlineFull), [tempOutlineFull]);

  return {
    localSections,
    selectedVolumeIdx, setSelectedVolumeIdx,
    selectedChapterIdx, setSelectedChapterIdx,
    collapsedVolumes, setCollapsedVolumes,
  };
}
