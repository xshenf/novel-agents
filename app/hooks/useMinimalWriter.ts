import { useState, useRef, useCallback } from 'react';
import { useNovelStore, type NovelStore } from '@/lib/store';
import type { CallAIApi } from './useAiClient';
import { parseStructureOutline } from '@/lib/outlineParser';

type SaveStatus = 'saved' | 'saving' | 'dirty';

interface UseMinimalWriterDeps {
  store: NovelStore;
  callAIApi: CallAIApi;
  setEditorContent: (value: string) => void;
  setSaveStatus: (status: SaveStatus) => void;
}

export type MinimalWriterApi = ReturnType<typeof useMinimalWriter>;

export function useMinimalWriter({ store, callAIApi, setEditorContent, setSaveStatus }: UseMinimalWriterDeps) {
  const [isMinimalMode, setIsMinimalMode] = useState(false);
  const [isMinimalWriting, setIsMinimalWriting] = useState(false);
  const [minimalStatus, setMinimalStatus] = useState('');
  const [minimalFinishedCount, setMinimalFinishedCount] = useState(0);
  const [minimalTotalCount, setMinimalTotalCount] = useState(0);
  const stopRef = useRef(false);

  // 带重试的 AI 调用
  const callWithRetry = async (
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
        if (stopRef.current) throw err;
        lastError = err;
        if (attempt < maxAttempts) {
          setMinimalStatus(`正在重试 (${attempt}/${maxAttempts}): ${label}`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
    throw lastError ?? new Error(`${label}：所有重试均已耗尽`);
  };

  // 极简写作主流程
  const startMinimalWriting = useCallback(async (opts?: { numVolumes?: number }) => {
    if (!store.currentProject) return;
    const projectId = store.currentProject.id;

    setIsMinimalWriting(true);
    stopRef.current = false;
    setMinimalFinishedCount(0);

    try {
      // ── 阶段 1：生成分卷大纲 ──
      const numVolumes = opts?.numVolumes || 3;
      setMinimalStatus(`正在生成分卷大纲（${numVolumes} 卷）...`);

      const outlineRes = await callWithRetry({
        action: 'minimalOutline',
        projectId,
        numVolumes,
      }, '生成分卷大纲');
      const outlineData = await outlineRes.json();

      if (stopRef.current) return;
      if (!outlineData.outline) {
        setMinimalStatus('分卷大纲生成失败，请重试');
        return;
      }

      // 刷新项目数据（大纲已落库）
      await store.refreshProject(projectId);

      // ── 阶段 2：逐卷展开章节大纲 ──
      const project = useNovelStore.getState().currentProject!;
      const volumes = parseStructureOutline(project.outlineFull || '');

      for (let vi = 0; vi < volumes.length; vi++) {
        if (stopRef.current) break;

        const vol = volumes[vi];
        // 如果该卷已有章节大纲，跳过展开
        if (vol.chapters.length > 0) continue;

        setMinimalStatus(`正在展开「${vol.title}」的章节大纲...`);
        const expandRes = await callWithRetry({
          action: 'minimalExpandVolume',
          projectId,
          volumeIndex: vi,
          numChapters: 10,
        }, `展开分卷 ${vi + 1}`);
        const expandData = await expandRes.json();

        if (stopRef.current) break;
        if (expandData.outline) {
          await store.refreshProject(projectId);
        }
      }

      // ── 阶段 3：逐章写作 ──
      // 重新获取最新的大纲和章节
      await store.fetchChapters(projectId);
      const freshProject = useNovelStore.getState().currentProject!;
      const freshVolumes = parseStructureOutline(freshProject.outlineFull || '');
      const freshChapters = useNovelStore.getState().chapters;

      // 收集所有需要写作的章节（按大纲顺序）
      const chaptersToWrite: { title: string; id: string }[] = [];
      for (const vol of freshVolumes) {
        for (const ch of vol.chapters) {
          // 检查是否已有正文
          const existing = freshChapters.find(c => titlesMatch(c.title, ch.title));
          if (existing) {
            if (!existing.content?.trim()) {
              chaptersToWrite.push({ title: ch.title, id: existing.id });
            }
          } else {
            // 大纲中有但数据库没有，先创建
            const created = await store.createChapter(projectId, ch.title);
            chaptersToWrite.push({ title: ch.title, id: created.id });
          }
        }
      }

      setMinimalTotalCount(chaptersToWrite.length);

      // 逐章写作
      let completed = 0;
      for (const chap of chaptersToWrite) {
        if (stopRef.current) {
          setMinimalStatus('极简写作已暂停。');
          break;
        }

        setMinimalStatus(`正在写作：${chap.title}（${completed + 1}/${chaptersToWrite.length}）...`);

        // 切换当前章节
        const freshChap = useNovelStore.getState().chapters.find(c => c.id === chap.id);
        if (freshChap) store.setCurrentChapter(freshChap);

        try {
          const writeRes = await callWithRetry({
            action: 'minimalWriteChapter',
            projectId,
            chapterTitle: chap.title,
            chapterId: chap.id,
          }, `写作 ${chap.title}`);

          if (stopRef.current) break;

          const writeData = await writeRes.json();
          if (writeData.text) {
            setEditorContent(writeData.text);
            setSaveStatus('dirty');
            await store.updateChapter(chap.id, { content: writeData.text });
            setSaveStatus('saved');
          }

          completed++;
          setMinimalFinishedCount(completed);

          // 短暂休眠
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (error) {
          console.error('极简写作章节出错:', error);
          setMinimalStatus(`写作 ${chap.title} 时出错，已暂停。`);
          break;
        }
      }

      if (!stopRef.current) {
        setMinimalStatus(`极简写作完成！共写 ${completed} 章。`);
      }
    } catch (error: any) {
      console.error('极简写作出错:', error);
      setMinimalStatus(`极简写作出错：${error.message || '未知错误'}`);
    } finally {
      setIsMinimalWriting(false);
    }
  }, [store, callAIApi, setEditorContent, setSaveStatus]);

  const pauseMinimalWriting = useCallback(() => {
    stopRef.current = true;
    setIsMinimalWriting(false);
    setMinimalStatus('极简写作暂停中。');
  }, []);

  return {
    isMinimalMode,
    setIsMinimalMode,
    isMinimalWriting,
    minimalStatus,
    minimalFinishedCount,
    minimalTotalCount,
    startMinimalWriting,
    pauseMinimalWriting,
  };
}

function titlesMatch(a: string, b: string): boolean {
  const t1 = a.trim();
  const t2 = b.trim();
  if (t1 === t2) return true;
  const clean = (t: string) => t.replace(/^第[一二三四五六七八九十百\d]+章[：:\s\-]*/, '').trim();
  const c1 = clean(t1);
  const c2 = clean(t2);
  return c1.length > 0 && c2.length > 0 && (c1.includes(c2) || c2.includes(c1));
}
