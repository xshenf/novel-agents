import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { NovelStore } from '@/lib/store';
import type { Character, WorldState } from '@/lib/db';
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

  // ── 世界状态（动态快照）──
  const worldStatesByCategory = useMemo(() => {
    const grouped: Record<string, WorldState[]> = {};
    store.worldStates.forEach(s => {
      const cat = s.category || '其他';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(s);
    });
    return grouped;
  }, [store.worldStates]);

  const saveWorldState = useCallback(
    (id: string, content: string) => store.updateWorldState(id, { content }),
    [store],
  );
  const toggleWorldStatePinned = useCallback(
    (id: string, pinned: boolean) => store.updateWorldState(id, { pinned }),
    [store],
  );
  const addWorldState = useCallback(
    (item: Omit<WorldState, 'id' | 'updatedAt'>) => store.createWorldState(item),
    [store],
  );
  const removeWorldState = useCallback(
    (id: string) => store.deleteWorldState(id),
    [store],
  );
  const refreshWorldState = useCallback(async () => {
    if (!store.currentProject) return;
    try {
      await callAIApi({ action: 'foldWorldState', projectId: store.currentProject.id });
    } catch (e) { console.warn('refreshWorldState failed:', e); }
    await store.fetchWorldStates(store.currentProject.id);
  }, [store, callAIApi]);

  // ── AI 实际检索到的记忆上下文（忠实暴露 top-3 截断，作跑偏预警）──
  const [preview, setPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const fetchPreview = useCallback(async (query: string) => {
    if (!store.currentProject) return;
    setPreviewLoading(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      const res = await callAIApi({ action: 'memoryPreview', projectId: store.currentProject.id, query }, abortRef.current.signal);
      const data = await res.json();
      setPreview(data.contextText || '（无检索结果）');
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
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
    worldStatesByCategory,
    saveWorldState,
    toggleWorldStatePinned,
    addWorldState,
    removeWorldState,
    refreshWorldState,
    preview,
    previewLoading,
    fetchPreview,
  };
}
