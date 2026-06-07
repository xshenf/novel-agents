'use client';

/**
 * useVolumeCore — 分卷核心操作共享 Hook
 * 提取分卷级别的通用操作（锁定、移位、删除、信息更新），
 * 供 useOutlineHandlers 和 useVolumeActions 共用，避免逻辑重复。
 */

import { useCallback } from 'react';
import type { NovelStore } from '@/lib/store';
import type { OutlineVolume, OutlineChapter } from '@/lib/outlineParser';

interface UseVolumeCoreParams {
  store: NovelStore;
  localSections: OutlineVolume[];
  onSectionsChange: (sections: OutlineVolume[]) => void;
}

export function useVolumeCore({ store, localSections, onSectionsChange }: UseVolumeCoreParams) {
  // ─── 分卷锁定 ──────────────────────────────────────────────────────────────

  /** 切换分卷的锁定标记 */
  const toggleLockVolume = useCallback(
    (volIdx: number) => {
      const next = localSections.map((vol, i) =>
        i === volIdx ? { ...vol, isLocked: !vol.isLocked } : vol,
      );
      onSectionsChange(next);
    },
    [localSections, onSectionsChange],
  );

  /** 切换章节锁定标记 */
  const toggleLockChapter = useCallback(
    (volIdx: number, chapIdx: number) => {
      const next = localSections.map((vol, vIdx) => {
        if (vIdx !== volIdx) return vol;
        const newChapters = vol.chapters.map((ch, cIdx) =>
          cIdx === chapIdx ? { ...ch, isLocked: !ch.isLocked } : ch,
        );
        return { ...vol, chapters: newChapters };
      });
      onSectionsChange(next);
    },
    [localSections, onSectionsChange],
  );

  // ─── 分卷移位 ──────────────────────────────────────────────────────────────

  /** 分卷位置上下移位 */
  const handleMoveVolume = useCallback(
    (volIdx: number, direction: 'up' | 'down') => {
      if (direction === 'up' && volIdx === 0) return;
      if (direction === 'down' && volIdx === localSections.length - 1) return;

      const targetIdx = direction === 'up' ? volIdx - 1 : volIdx + 1;
      const next = [...localSections];
      const temp = next[volIdx];
      next[volIdx] = next[targetIdx];
      next[targetIdx] = temp;
      onSectionsChange(next);
    },
    [localSections, onSectionsChange],
  );

  // ─── 分卷删除 ──────────────────────────────────────────────────────────────

  /** 删除分卷（含确认弹窗） */
  const handleDeleteVolume = useCallback(
    (volIdx: number) => {
      const target = localSections[volIdx];
      if (!target) return;
      store.showConfirm(
        `确定要删除分卷「${target.title || `第 ${volIdx + 1} 卷`}」及其全部章节大纲吗？`,
        () => {
          const next = localSections.filter((_, i) => i !== volIdx);
          onSectionsChange(next);
        },
      );
    },
    [localSections, onSectionsChange, store],
  );

  // ─── 分卷信息更新 ────────────────────────────────────────────────────────────

  /** 更新分卷标题与概要 */
  const updateVolumeInfo = useCallback(
    (volIdx: number, title: string, content: string) => {
      if (volIdx < 0 || volIdx >= localSections.length) return;
      const next = localSections.map((vol, i) =>
        i === volIdx ? { ...vol, title: title.trim(), content: content.trim() } : vol,
      );
      onSectionsChange(next);
    },
    [localSections, onSectionsChange],
  );

  // ─── 章节增删 ──────────────────────────────────────────────────────────────

  /** 添加空章节到指定分卷 */
  const handleAddChapter = useCallback(
    (volIdx: number) => {
      if (volIdx < 0 || volIdx >= localSections.length) return;
      const emptyChapter: OutlineChapter = { title: '', content: '', details: [] };
      const next = localSections.map((vol, i) =>
        i === volIdx ? { ...vol, chapters: [...vol.chapters, emptyChapter] } : vol,
      );
      onSectionsChange(next);
    },
    [localSections, onSectionsChange],
  );

  return {
    toggleLockVolume,
    toggleLockChapter,
    handleMoveVolume,
    handleDeleteVolume,
    updateVolumeInfo,
    handleAddChapter,
  };
}
