import { useState, useCallback } from 'react';

export type AiUndoType = 'volume' | 'chapter' | 'macro';

export interface AiUndoEntry {
  type: AiUndoType;
  label: string;
  restore: () => void;
}

// 管理 AI 推演/重写操作的撤销历史栈
// 每次 AI 推演完成后推入一个 restore 回调，撤销时按 LIFO 顺序回滚
export function useAiUndoStack() {
  const [stack, setStack] = useState<AiUndoEntry[]>([]);

  const push = useCallback((entry: AiUndoEntry) => {
    setStack(prev => [...prev, entry]);
  }, []);

  const undo = useCallback(() => {
    let toRestore: (() => void) | undefined;
    setStack(prev => {
      if (prev.length === 0) return prev;
      toRestore = prev[prev.length - 1].restore;
      return prev.slice(0, -1);
    });
    // 在 updater 外执行副作用
    queueMicrotask(() => toRestore?.());
  }, []);

  const dismiss = useCallback(() => {
    setStack(prev => prev.slice(0, -1));
  }, []);

  const clear = useCallback(() => {
    setStack([]);
  }, []);

  return { stack, push, undo, dismiss, clear };
}
