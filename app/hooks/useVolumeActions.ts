'use client';

import { useCallback, useState } from 'react';
import type { NovelStore } from '@/lib/store';
import { useAiClient, type CallAIApi } from './useAiClient';
import {
  generateMarkdownFromSections,
  parseStructureOutline,
  renumberVolumesAndChapters,
  type OutlineVolume,
} from '@/lib/outlineParser';

interface UseVolumeActionsParams {
  store: NovelStore;
  getLocalSections: () => OutlineVolume[];
  setOutlineFull: (next: string) => void;
}

export function useVolumeActions({ store, getLocalSections, setOutlineFull }: UseVolumeActionsParams) {
  const callAIApi = useAiClient();
  const [isAiOutlineLoading, setIsAiOutlineLoading] = useState(false);

  const persist = useCallback(
    (next: OutlineVolume[]) => {
      const renumbered = renumberVolumesAndChapters(next);
      setOutlineFull(generateMarkdownFromSections(renumbered));
    },
    [setOutlineFull]
  );

  // 通用：把 AI 生成的细纲 Markdown 文本追加到指定分卷
  const appendChaptersToVolume = useCallback(
    (volIdx: number, rawMarkdown: string): { addedCount: number; volTitle: string } | null => {
      const sections = getLocalSections();
      const target = sections[volIdx];
      if (!target) return null;
      // 解析 AI 文本
      const parsed = parseStructureOutline(rawMarkdown);
      const newChapters = parsed.flatMap(v => v.chapters);
      if (newChapters.length === 0) return { addedCount: 0, volTitle: target.title };

      const next = sections.map((vol, i) =>
        i === volIdx
          ? { ...vol, chapters: [...vol.chapters, ...newChapters] }
          : vol
      );
      persist(next);
      return { addedCount: newChapters.length, volTitle: target.title };
    },
    [getLocalSections, persist]
  );

  // AI 一键生成本卷的章节目录
  const handleAiGenerateVolumeChapters = useCallback(
    async (volIdx: number, numChapters: number = 3) => {
      if (!store.currentProject) return;
      const sections = getLocalSections();
      const target = sections[volIdx];
      if (!target) return;
      setIsAiOutlineLoading(true);
      try {
        const prompt = `你是一个资深网络小说大纲架构师。当前任务是为指定分卷生成若干章的细纲。
【小说名】: ${store.currentProject.title}
【小说简介】: ${store.currentProject.description || '无'}
【文风】: ${store.currentProject.styleSetting || '无'}
【世界观】: ${store.currentProject.worldSetting || '无'}
【力量体系】: ${store.currentProject.powerSystem || '无'}
【核心冲突】: ${store.currentProject.coreConflict || '无'}
【所属分卷】: ${target.title}
【分卷概要】: ${target.content || '无'}

请仅针对这一卷，规划生成 ${numChapters} 个章节的大纲。要求：
1. 章与章之间有清晰的递进/转折/伏笔。
2. 每章输出包含：核心冲突、信息释放、情绪曲线、相关人物、场景地点、目标字数（建议 2500~3500）。
3. 严格按以下 Markdown 格式输出，不要输出任何额外的引言/标题/Emoji：

## 第X章：<章名>
- **核心冲突**：...
- **信息释放**：...
- **情绪曲线**：...
- **相关人物**：...
- **场景地点**：...
- **目标字数**：...

直接开始输出 ${numChapters} 个章节，章号从 1 开始连续递增。`;

        const res = await callAIApi({
          action: 'chat',
          projectId: store.currentProject.id,
          query: prompt,
          systemInstruction: '你是一个网络小说细纲写作专家。直接输出 Markdown 大纲，不要带任何 Markdown 顶级标题或 Emoji 图标。',
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const reply: string = (data.reply || '').trim();
        if (!reply) throw new Error('AI 未返回内容');
        const result = appendChaptersToVolume(volIdx, reply);
        if (result) {
          alert(`已为分卷「${result.volTitle}」追加 ${result.addedCount} 个章节大纲`);
        }
      } catch (err: any) {
        alert('AI 生成分卷大纲失败: ' + (err?.message || String(err)));
      } finally {
        setIsAiOutlineLoading(false);
      }
    },
    [store, getLocalSections, callAIApi, appendChaptersToVolume]
  );

  // 手动新增一个空章节到指定分卷
  const handleAddChapter = useCallback(
    (volIdx: number) => {
      const sections = getLocalSections();
      if (volIdx < 0 || volIdx >= sections.length) return;
      const next = sections.map((vol, i) =>
        i === volIdx
          ? {
              ...vol,
              chapters: [
                ...vol.chapters,
                {
                  title: '',
                  content: '',
                  details: [],
                },
              ],
            }
          : vol
      );
      persist(next);
    },
    [getLocalSections, persist]
  );

  // 删除指定分卷
  const handleDeleteVolume = useCallback(
    (volIdx: number) => {
      const sections = getLocalSections();
      const target = sections[volIdx];
      if (!target) return;
      if (!confirm(`确定要删除分卷「${target.title || `第 ${volIdx + 1} 卷`}」及其全部章节大纲吗？`)) {
        return;
      }
      const next = sections.filter((_, i) => i !== volIdx);
      persist(next);
    },
    [getLocalSections, persist]
  );

  return {
    isAiOutlineLoading,
    handleAiGenerateVolumeChapters,
    handleAddChapter,
    handleDeleteVolume,
  };
}
