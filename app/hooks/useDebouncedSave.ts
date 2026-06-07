import { useRef, useEffect } from 'react';

/**
 * 通用 debounce 自动保存 hook。
 * 当 value 变化时延迟调用 saveFn；若组件卸载则立即丢弃定时器。
 *
 * @param value   要监听变化的值
 * @param saveFn  保存函数（异步）
 * @param delay   防抖延迟（毫秒），默认 2000
 */
export function useDebouncedSave<T>(
  value: T,
  saveFn: (value: T) => Promise<void>,
  delay: number = 2000
) {
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const timer = setTimeout(() => {
      saveFnRef.current(valueRef.current).catch(err =>
        console.warn('[useDebouncedSave] save failed:', err)
      );
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
}
