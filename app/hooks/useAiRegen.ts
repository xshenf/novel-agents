import { useRef, useState, useCallback } from 'react';

// 管理 AI 推演/重写操作的 AbortController 与当前推演定位状态
// 同一时刻只允许一个推演任务，新的任务会 abort 上一个
export function useAiRegen() {
  const abortRef = useRef<AbortController | null>(null);
  const [regenIndex, setRegenIndex] = useState<number | null>(null);
  const [regenVolumeIdx, setRegenVolumeIdx] = useState<number | null>(null);
  const [regenField, setRegenField] = useState<string | null>(null);

  // 中止当前推演并清空所有 loading 状态
  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRegenIndex(null);
    setRegenVolumeIdx(null);
    setRegenField(null);
  }, []);

  // 开始新推演：abort 上一个 controller 并返回新的 controller
  const beginRegen = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    return controller;
  }, []);

  // 推演结束（成功/失败/被中止）时调用：仅当 controller 仍是当前活跃的，才清空状态
  const endRegen = useCallback((controller: AbortController) => {
    if (abortRef.current === controller) {
      abortRef.current = null;
      setRegenIndex(null);
      setRegenVolumeIdx(null);
      setRegenField(null);
    }
  }, []);

  return {
    abortRef,
    regenIndex, setRegenIndex,
    regenVolumeIdx, setRegenVolumeIdx,
    regenField, setRegenField,
    cancel, beginRegen, endRegen,
  };
}
