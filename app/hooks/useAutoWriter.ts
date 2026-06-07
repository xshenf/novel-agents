import { useState, useRef } from 'react';
import { useNovelStore, type NovelStore } from '@/lib/store';
import type { CallAIApi } from './useAiClient';
import type { Chapter } from '@/lib/db';

type SaveStatus = 'saved' | 'saving' | 'dirty';

interface UseAutoWriterDeps {
  store: NovelStore;
  callAIApi: CallAIApi;
  setEditorContent: (value: string) => void;
  setSaveStatus: (status: SaveStatus) => void;
}

export type AutoWriterApi = ReturnType<typeof useAutoWriter>;

export function useAutoWriter({ store, callAIApi, setEditorContent, setSaveStatus }: UseAutoWriterDeps) {
  const [writeInstruction, setWriteInstruction] = useState('');
  const [isAutoWriting, setIsAutoWriting] = useState(false);
  const [autoWritingStatus, setAutoWritingStatus] = useState('准备自动写作...');
  const [targetChaptersCount, setTargetChaptersCount] = useState(3);
  const [finishedChaptersCount, setFinishedChaptersCount] = useState(0);
  const [autoWriteMode, setAutoWriteMode] = useState(true); // 默认开启AI自动写小说模式
  const [writeUntilEnd, setWriteUntilEnd] = useState(false);
  const autoWriteStopRef = useRef(false);

  // 带重试的 AI 调用封装：最多重试 maxAttempts 次，间隔 3 秒，
  // AbortError 和用户手动停止时立即抛出不重试。
  const callAIApiWithRetry = async (
    params: Parameters<CallAIApi>[0],
    label: string,
    maxAttempts = 3,
  ): ReturnType<CallAIApi> => {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await callAIApi(params);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
        if (autoWriteStopRef.current) throw err;
        lastError = err;
        if (attempt < maxAttempts) {
          setAutoWritingStatus(`正在重试 (${attempt}/${maxAttempts}): ${label}`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
    throw lastError ?? new Error(`${label}：所有重试均已耗尽`);
  };

  const startAutoWriting = async (opts?: { count?: number; untilEnd?: boolean; targetChapters?: Chapter[] }) => {
    if (!store.currentProject) return;

    // 允许调用方按需覆盖生成章数 / 是否写到结尾，避免 setState 竞态
    const count = opts?.count ?? targetChaptersCount;
    const untilEnd = opts?.untilEnd ?? writeUntilEnd;
    setTargetChaptersCount(count);
    setWriteUntilEnd(untilEnd);

    setIsAutoWriting(true);
    autoWriteStopRef.current = false;
    setFinishedChaptersCount(0);

    let activeChapters = opts?.targetChapters || [...store.chapters];

    // 如果指定了生成章节列表，跳过全局章节补全与大纲规划的逻辑
    if (!opts?.targetChapters) {
      // 1. 如果没有章节，一键自动生成大纲目录
      if (activeChapters.length === 0) {
        setAutoWritingStatus('正在智能规划小说章节大纲目录...');
        try {
          const res = await callAIApi({
            action: 'outline',
            projectId: store.currentProject.id,
            projectTitle: store.currentProject.title,
            projectDesc: store.currentProject.description,
            numChapters: count
          });
          const data = await res.json();

          // 自动建立章节
          const titles: string[] = [];
          if (data.outline) {
            const lines = data.outline.split('\n');
            const titleRegex = /^(?:##\s+)?(第[一二三四五六七八九十百\d]+章[：:\s\-]*[^\n]+)$/i;
            for (const line of lines) {
              const match = line.trim().match(titleRegex);
              if (match) {
                titles.push(match[1].trim());
              }
            }
          }

          // 降级防线：如果未成功提取出标题，使用默认命名建立相应数量的章节
          if (titles.length === 0) {
            const chineseNumbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '二十一', '二十二', '二十三', '二十四', '二十五', '二十六', '二十七', '二十八', '二十九', '三十', '三十一', '三十二', '三十三', '三十四', '三十五', '三十六', '三十七', '三十八', '三十九', '四十', '四十一', '四十二', '四十三', '四十四', '四十五', '四十六', '四十七', '四十八', '四十九', '五十'];
            for (let i = 1; i <= count; i++) {
              const indexStr = chineseNumbers[i - 1] || String(i);
              titles.push(`第${indexStr}章：新规划章节`);
            }
          }

          for (const title of titles) {
            await store.createChapter(store.currentProject!.id, title);
          }
          activeChapters = useNovelStore.getState().chapters;
        } catch {
          setAutoWritingStatus('大纲目录规划失败，请手动创建章节或重试');
          setIsAutoWriting(false);
          return;
        }
      }

      // 如果已经有章节，但是空白章节不足，并且设定中有大纲，我们可以自动补全大纲中未建立的章节
      if (activeChapters.length > 0 && store.currentProject.outlineFull) {
      const outlineTitles: string[] = [];
      const lines = store.currentProject.outlineFull.split('\n');
      const titleRegex = /^(?:##\s+)?(第[一二三四五六七八九十百\d]+章[：:\s\-]*[^\n]+)$/i;
      for (const line of lines) {
        const match = line.trim().match(titleRegex);
        if (match) {
          outlineTitles.push(match[1].trim());
        }
      }

      if (outlineTitles.length > 0) {
        let createdNew = false;
        for (const title of outlineTitles) {
          const exists = activeChapters.some(c => c.title === title);
          if (!exists) {
            await store.createChapter(store.currentProject.id, title);
            createdNew = true;
          }
        }
        if (createdNew) {
          activeChapters = useNovelStore.getState().chapters;
        }
      }
    }
    }

    // 2. 依次遍历章节执行自动写小说循环
    let completed = 0;
    for (let i = 0; i < activeChapters.length; i++) {
      if (autoWriteStopRef.current) {
        setAutoWritingStatus('自动写小说已暂停。');
        break;
      }

      const chap = activeChapters[i];

      // Re-check chapter still exists in the store (user may have deleted it)
      const freshChapter = useNovelStore.getState().chapters.find(c => c.id === chap.id);
      if (!freshChapter) {
        setAutoWritingStatus(`章节「${chap.title}」已被删除，跳过。`);
        continue;
      }

      // 跳过已有内容的章节（除非是当前选中的空白章节）
      if (freshChapter.content.trim() !== '' && store.currentChapter?.id !== freshChapter.id) {
        continue;
      }

      // 如果生成的章节数已达到设定上限，停止生成
      if (!untilEnd && completed >= count) {
        break;
      }

      // 切换当前章节为活动章节
      store.setCurrentChapter(freshChapter);
      setAutoWritingStatus(`正在自动写小说正文: ${freshChapter.title} ...`);

      try {
        // 调用 AI 自动写小说接口（最多重试 3 次）
        const writeRes = await callAIApiWithRetry({
          action: 'autoWrite',
          projectId: store.currentProject.id,
          chapterTitle: freshChapter.title,
          instruction: writeInstruction
        }, `自动写作: ${freshChapter.title}`);

        const writeData = await writeRes.json();

        if (autoWriteStopRef.current) break;

        if (writeData.text) {
          // 渲染至编辑器
          setEditorContent(writeData.text);
          setSaveStatus('dirty');

          // 更新数据库
          await store.updateChapter(freshChapter.id, { content: writeData.text });
          setSaveStatus('saved');

          // 自动进行章节复盘摘要与设定记忆更新
          setAutoWritingStatus(`正在自动复盘章节并更新小说记忆: ${freshChapter.title} ...`);

          const memoryRes = await callAIApiWithRetry({
            action: 'syncChapterMemory',
            projectId: store.currentProject.id,
            chapterId: freshChapter.id,
            currentText: writeData.text,
          }, `复盘摘要: ${freshChapter.title}`);
          const memoryData = await memoryRes.json();

          if (autoWriteStopRef.current) break;

          if (memoryData.summary?.summary) {
            await store.fetchChapters(store.currentProject.id);
            await store.fetchCharacters(store.currentProject.id);
            await store.fetchWorldStates(store.currentProject.id);
            await store.refreshProject(store.currentProject.id);
          }

          completed++;
          setFinishedChaptersCount(completed);

          // 简短休眠以呈现平滑的视觉转接
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } catch (error) {
        console.error('自动写作章节出错:', error);
        setAutoWritingStatus(`在自动写入 ${freshChapter.title} 时遇到问题。`);
        break;
      }
    }

    setIsAutoWriting(false);
    if (!autoWriteStopRef.current) {
      setAutoWritingStatus('恭喜！设定章节的 AI 自动小说创作已顺利完成！');
    }
  };

  const pauseAutoWriting = () => {
    autoWriteStopRef.current = true;
    setIsAutoWriting(false);
    setAutoWritingStatus('自动写小说暂停中。');
  };

  return {
    writeInstruction,
    setWriteInstruction,
    isAutoWriting,
    autoWritingStatus,
    targetChaptersCount,
    setTargetChaptersCount,
    finishedChaptersCount,
    autoWriteMode,
    setAutoWriteMode,
    startAutoWriting,
    pauseAutoWriting,
    writeUntilEnd,
    setWriteUntilEnd,
  };
}
