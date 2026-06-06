import { useRef, useCallback, useEffect, useState } from 'react';

type SaveStatus = 'saved' | 'saving' | 'dirty';

/**
 * 通用自动保存 hook
 * @param saveFn 实际保存函数（异步）
 * @param delay 防抖延迟（毫秒），默认 2000
 */
export function useAutoSave<T>(
  saveFn: (value: T) => Promise<void>,
  delay: number = 2000
) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const latestValueRef = useRef<T | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  // 清理 timer
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const triggerSave = useCallback((value: T) => {
    latestValueRef.current = value;
    setSaveStatus('dirty');

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await saveFn(latestValueRef.current as T);
        setSaveStatus('saved');
      } catch {
        setSaveStatus('dirty');
      }
    }, delay);
  }, [saveFn, delay]);

  // 立即保存当前脏数据
  const forceSave = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (latestValueRef.current !== null) {
      setSaveStatus('saving');
      try {
        await saveFn(latestValueRef.current);
        setSaveStatus('saved');
      } catch {
        setSaveStatus('dirty');
      }
    }
  }, [saveFn]);

  return { saveStatus, triggerSave, forceSave };
}
