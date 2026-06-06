import { useState, useEffect, useRef } from 'react';
import { parseStructureOutline, type OutlineVolume } from '@/lib/outlineParser';

interface UseOutlineSectionsParams {
  tempOutlineFull: string;
  editingVolumeIdx: number | null;
  editingChapterPath: { volIdx: number; chapIdx: number } | null;
  onResetUndoStack?: () => void;
}

// 维护分卷-章节的本地可编辑状态，与 tempOutlineFull 双向同步
// 当用户处于行内编辑态时不覆盖本地状态，避免输入时被反序列化吞掉
export function useOutlineSections({
  tempOutlineFull,
  editingVolumeIdx,
  editingChapterPath,
  onResetUndoStack,
}: UseOutlineSectionsParams) {
  const [localSections, setLocalSections] = useState<OutlineVolume[]>([]);
  const prevEditingVolRef = useRef<number | null>(null);
  const prevEditingPathRef = useRef<typeof editingChapterPath>(null);

  useEffect(() => {
    const wasEditing = prevEditingVolRef.current !== null || prevEditingPathRef.current !== null;
    const isEditing = editingVolumeIdx !== null || editingChapterPath !== null;

    // 退出编辑（wasEditing=true, isEditing=false）时同步一次最新 markdown
    // 未在编辑时，tempOutlineFull 变化（来自 store 同步或外部）时也重新解析
    if (!isEditing) {
      setLocalSections(parseStructureOutline(tempOutlineFull));
      onResetUndoStack?.();
    } else if (!wasEditing && isEditing) {
      // 进入编辑态时也清空一次 undo，避免陈旧历史
      onResetUndoStack?.();
    }

    prevEditingVolRef.current = editingVolumeIdx;
    prevEditingPathRef.current = editingChapterPath;
  }, [tempOutlineFull, editingVolumeIdx, editingChapterPath, onResetUndoStack]);

  return { localSections, setLocalSections };
}
