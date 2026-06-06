import { useState, useMemo, useCallback } from 'react';
import type { NovelStore } from '@/lib/store';
import type { Character } from '@/lib/db';
import type { CallAIApi } from './useAiClient';

export interface SynopsisItem { id: string; title: string; summary: string; }
export interface LedgerItem { text: string; from: string; }

interface Deps {
  store: NovelStore;
  callAIApi: CallAIApi;
}

export type ChapterMemoryApi = ReturnType<typeof useChapterMemory>;

// 写作页「记忆面板」的视图模型：全部从 store 派生（进入项目时已 fetch 章节/人物/规则），
// 并封装人工校对的写回动作。改记忆（人物状态 / 章节摘要）比改正文更能阻断跑偏。
export function useChapterMemory({ store, callAIApi }: Deps) {
  // 全书滚动摘要：按章节顺序取已有摘要
  const synopsis = useMemo<SynopsisItem[]>(
    () => store.chapters
      .filter(c => c.summary && c.summary.trim() !== '')
      .map(c => ({ id: c.id, title: c.title, summary: c.summary })),
    [store.chapters],
  );

  // 本章登场人物：当前章正文/摘要中出现过名字的角色；未写则回退到主角
  const activeCharacters = useMemo<Character[]>(() => {
    const cur = store.currentChapter;
    const text = `${cur?.content || ''} ${cur?.summary || ''}`;
    if (text.trim()) {
      const appearing = store.characters.filter(c => c.name && text.includes(c.name));
      if (appearing.length > 0) return appearing;
    }
    const mains = store.characters.filter(c => ['男主', '女主', '主角'].includes(c.role));
    return mains.length > 0 ? mains : store.characters.slice(0, 3);
  }, [store.currentChapter, store.characters]);

  // 未回收伏笔台账：所有 newForeshadowing 减去任意章节已 resolved 的
  const openForeshadowing = useMemo<LedgerItem[]>(() => {
    const resolved = new Set<string>();
    store.chapters.forEach(c => (c.resolvedForeshadowing || []).forEach(f => resolved.add(f.trim())));
    const open: LedgerItem[] = [];
    store.chapters.forEach(c => (c.newForeshadowing || []).forEach(f => {
      const t = f.trim();
      if (t && !resolved.has(t) && !open.some(o => o.text === t)) open.push({ text: t, from: c.title });
    }));
    return open;
  }, [store.chapters]);

  // 时间线汇总
  const timeline = useMemo<LedgerItem[]>(() => {
    const items: LedgerItem[] = [];
    store.chapters.forEach(c => (c.timelineEvents || []).forEach(e => {
      if (e && e.trim()) items.push({ text: e, from: c.title });
    }));
    return items;
  }, [store.chapters]);

  // ── 人工校对写回 ──────────────────────────────────────────
  const saveCharacterState = useCallback(
    (id: string, currentState: string) => store.updateCharacter(id, { currentState }),
    [store],
  );
  const saveChapterSummary = useCallback(
    (id: string, summary: string) => store.updateChapter(id, { summary }),
    [store],
  );

  // ── AI 实际检索到的记忆上下文（忠实暴露 top-3 截断，作跑偏预警）──
  const [preview, setPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fetchPreview = useCallback(async (query: string) => {
    if (!store.currentProject) return;
    setPreviewLoading(true);
    try {
      const res = await callAIApi({ action: 'memoryPreview', projectId: store.currentProject.id, query });
      const data = await res.json();
      setPreview(data.contextText || '（无检索结果）');
    } catch {
      setPreview('记忆预览获取失败');
    } finally {
      setPreviewLoading(false);
    }
  }, [store, callAIApi]);

  return {
    synopsis,
    activeCharacters,
    openForeshadowing,
    timeline,
    saveCharacterState,
    saveChapterSummary,
    preview,
    previewLoading,
    fetchPreview,
  };
}
