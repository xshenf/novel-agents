import { useState, useMemo, useEffect } from 'react';
import { parseStructureOutline, type OutlineVolume } from '@/lib/outlineParser';

interface UseOutlineTreeStateParams {
  tempOutlineFull: string;
  currentChapter: any;
}

// 共享"目录式大纲"状态：解析分卷-章节并维护最左侧章节列表的选中节点
// WorkspaceSidebar / WriteTab / OutlineTab 均复用同一份解析结果与选中态
export function useOutlineTreeState({ tempOutlineFull, currentChapter }: UseOutlineTreeStateParams) {
  const [selectedVolumeIdx, setSelectedVolumeIdx] = useState<number | null>(null);
  const [selectedChapterIdx, setSelectedChapterIdx] = useState<number | null>(null);
  const [collapsedVolumes, setCollapsedVolumes] = useState<Record<number, boolean>>({});

  const localSections = useMemo(() => parseStructureOutline(tempOutlineFull), [tempOutlineFull]);

  // 当当前章节存在且大纲加载成功时，自动反向匹配定位并高亮对应大纲章节
  useEffect(() => {
    if (!currentChapter || localSections.length === 0) return;

    for (let vIdx = 0; vIdx < localSections.length; vIdx++) {
      const vol = localSections[vIdx];
      for (let cIdx = 0; cIdx < vol.chapters.length; cIdx++) {
        const chap = vol.chapters[cIdx];
        
        // 模糊匹配算法，支持去掉前缀匹配和数字匹配
        const isMatched = (() => {
          const t1 = (chap.title || '').trim();
          const t2 = (currentChapter.title || '').trim();
          if (!t1 || !t2) return false;
          if (t1 === t2) return true;

          const clean = (t: string) => t.replace(/^第.+(?:章|节|回|折)[：: ]\s*/, '');
          if (clean(t1) === clean(t2)) return true;

          const extractNum = (t: string) => {
            const m = t.match(/第\s*(\d+)\s*(?:章|节|回|折)/);
            return m ? parseInt(m[1], 10) : null;
          };
          const n1 = extractNum(t1);
          const n2 = extractNum(t2);
          if (n1 !== null && n1 === n2) return true;

          return false;
        })();

        if (isMatched) {
          if (selectedVolumeIdx !== vIdx || selectedChapterIdx !== cIdx) {
            setSelectedVolumeIdx(vIdx);
            setSelectedChapterIdx(cIdx);
          }
          return;
        }
      }
    }
  }, [currentChapter, localSections, selectedVolumeIdx, selectedChapterIdx]);

  return {
    localSections,
    selectedVolumeIdx, setSelectedVolumeIdx,
    selectedChapterIdx, setSelectedChapterIdx,
    collapsedVolumes, setCollapsedVolumes,
  };
}
