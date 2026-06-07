import { useEffect, useRef } from 'react';
import { createVersionSnapshot } from '@/lib/versionSnapshot';

interface UseOutlineAutoSaveParams {
  projectId: string | undefined;
  tempOutlineFull: string;
  macro: {
    tempStyleSetting: string;
    tempWorldSetting: string;
    tempPowerSystem: string;
    tempGoldFinger: string;
    tempCoreConflict: string;
    tempFactionsMap: string;
    tempSellingPoints: string;
  };
  updateProject: (id: string, patch: Record<string, any>) => Promise<unknown>;
  delay?: number;
}

// 监听大纲全文与宏观设定的变化，debounce 后落库并写入版本快照
// 与现有 useAutoSave 不同：这里一次监听多个字段并产生 snapshot，不是单个值
export function useOutlineAutoSave({
  projectId,
  tempOutlineFull,
  macro,
  updateProject,
  delay = 2000,
}: UseOutlineAutoSaveParams) {
  // 大纲全文自动保存
  const outlineTimer = useRef<NodeJS.Timeout | null>(null);
  const prevOutlineRef = useRef(tempOutlineFull);
  useEffect(() => {
    if (tempOutlineFull === prevOutlineRef.current) return;
    prevOutlineRef.current = tempOutlineFull;
    if (!projectId) return;
    if (outlineTimer.current) clearTimeout(outlineTimer.current);
    outlineTimer.current = setTimeout(async () => {
      try {
        await updateProject(projectId, { outlineFull: tempOutlineFull });
        createVersionSnapshot({
          projectId,
          type: 'outline',
          key: 'outlineFull',
          label: '分卷主线大纲',
          data: tempOutlineFull,
          source: 'auto',
        });
      } catch (e) { console.warn('自动保存失败:', e); }
    }, delay);
    return () => { if (outlineTimer.current) clearTimeout(outlineTimer.current); };
  }, [tempOutlineFull, projectId, updateProject, delay]);

  // 宏观设定自动保存（任一字段变化）
  const macroTimer = useRef<NodeJS.Timeout | null>(null);
  const prevMacroRef = useRef(macro);
  useEffect(() => {
    const prev = prevMacroRef.current;
    const keys = Object.keys(macro) as (keyof typeof macro)[];
    const changed = keys.some(k => prev[k] !== macro[k]);
    if (!changed) return;
    prevMacroRef.current = macro;
    if (!projectId) return;
    if (macroTimer.current) clearTimeout(macroTimer.current);
    macroTimer.current = setTimeout(async () => {
      try {
        await updateProject(projectId, {
          styleSetting: macro.tempStyleSetting,
          worldSetting: macro.tempWorldSetting,
          powerSystem: macro.tempPowerSystem,
          goldFinger: macro.tempGoldFinger,
          coreConflict: macro.tempCoreConflict,
          factionsMap: macro.tempFactionsMap,
          sellingPoints: macro.tempSellingPoints,
        });
        createVersionSnapshot({
          projectId,
          type: 'macro',
          key: 'macro',
          label: '核心设定',
          data: { ...macro },
          source: 'auto',
        });
      } catch (e) { console.warn('自动保存失败:', e); }
    }, delay);
    return () => { if (macroTimer.current) clearTimeout(macroTimer.current); };
  }, [macro, projectId, updateProject, delay]);
}
