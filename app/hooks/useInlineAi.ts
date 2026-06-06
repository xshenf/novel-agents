import { useState } from 'react';
import type { NovelStore } from '@/lib/store';
import type { CallAIApi } from './useAiClient';

type SaveStatus = 'saved' | 'saving' | 'dirty';
export type InlineMode = 'continue' | 'polish' | 'expand' | 'rewrite';

interface Deps {
  store: NovelStore;
  callAIApi: CallAIApi;
  editorContent: string;
  setEditorContent: (v: string) => void;
  setSaveStatus: (s: SaveStatus) => void;
}

export type InlineAiApi = ReturnType<typeof useInlineAi>;

// 编辑器内联 AI：对选中文字做润色/扩写/改写，或在全文末尾续写。
// 复用服务端 continue / polish action（扩写/改写用 polish + 不同 instruction）。
export function useInlineAi({ store, callAIApi, editorContent, setEditorContent, setSaveStatus }: Deps) {
  const [busy, setBusy] = useState<InlineMode | null>(null);

  const persist = async (next: string) => {
    setEditorContent(next);
    setSaveStatus('dirty');
    if (store.currentChapter) {
      setSaveStatus('saving');
      await store.updateChapter(store.currentChapter.id, { content: next });
      setSaveStatus('saved');
    }
  };

  // 全文末尾续写
  const continueWriting = async () => {
    if (!store.currentProject || busy) return;
    setBusy('continue');
    try {
      const res = await callAIApi({
        action: 'continue',
        projectId: store.currentProject.id,
        chapterTitle: store.currentChapter?.title || '',
        currentText: editorContent,
        instruction: '',
      });
      const data = await res.json();
      if (data.text) {
        const sep = editorContent && !editorContent.endsWith('\n') ? '\n' : '';
        await persist(editorContent + sep + data.text);
      } else {
        alert(data.error || 'AI 续写失败');
      }
    } catch {
      alert('AI 续写失败');
    } finally {
      setBusy(null);
    }
  };

  // 对选区做 润色 / 扩写 / 改写，结果替换选区
  const transformSelection = async (mode: 'polish' | 'expand' | 'rewrite', selStart: number, selEnd: number) => {
    if (busy) return;
    const selected = editorContent.slice(selStart, selEnd);
    if (!selected.trim()) {
      alert('请先在正文中选中要处理的文字');
      return;
    }
    const instruction = mode === 'expand'
      ? '在保持剧情与文风一致的前提下，扩写这段文字，丰富细节、动作与感官描写，不要改变原意'
      : mode === 'rewrite'
        ? '在保持剧情含义不变的前提下，换一种表达方式改写这段文字，使其更生动'
        : '';
    setBusy(mode);
    try {
      const res = await callAIApi({ action: 'polish', currentText: selected, instruction });
      const data = await res.json();
      if (data.text) {
        await persist(editorContent.slice(0, selStart) + data.text + editorContent.slice(selEnd));
      } else {
        alert(data.error || 'AI 处理失败');
      }
    } catch {
      alert('AI 处理失败');
    } finally {
      setBusy(null);
    }
  };

  return { busy, continueWriting, transformSelection };
}
