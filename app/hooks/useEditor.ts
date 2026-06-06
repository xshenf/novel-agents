import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import type { NovelStore } from '@/lib/store';
import { createVersionSnapshot } from '@/lib/versionSnapshot';

export type EditorApi = ReturnType<typeof useEditor>;

export function useEditor(store: NovelStore) {
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [localDraft, setLocalDraft] = useState<{ content: string; updatedAt: number } | null>(null);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  // 当选择新章节时，同步更新编辑器内容
  useEffect(() => {
    if (store.currentChapter) {
      setEditorTitle(store.currentChapter.title);
      setEditorContent(store.currentChapter.content);
      setSaveStatus('saved');

      // 检测是否存在更新的本地草稿
      if (typeof window !== 'undefined') {
        const localKey = `novel_draft_${store.currentProject?.id}_${store.currentChapter.id}`;
        const saved = localStorage.getItem(localKey);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            // 只有当本地草稿和数据库里的正文内容不一致时，才需要提示恢复
            if (parsed && parsed.content && parsed.content.trim() !== store.currentChapter.content.trim()) {
              setLocalDraft(parsed);
            } else {
              localStorage.removeItem(localKey);
              setLocalDraft(null);
            }
          } catch {
            setLocalDraft(null);
          }
        } else {
          setLocalDraft(null);
        }
      }
    } else {
      setEditorTitle('');
      setEditorContent('');
      setLocalDraft(null);
    }
  }, [store.currentChapter, store.currentProject]);

  // 卸载时清理待执行的自动保存 timer，避免对已切走的旧章节误写
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = null;
      }
    };
  }, []);

  // 编辑器自动保存机制 (Debounce 1.5s)
  const handleEditorChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setEditorContent(newVal);
    setSaveStatus('dirty');

    // 实时写入 localStorage 作为紧急本地备份
    if (store.currentChapter && typeof window !== 'undefined') {
      const localKey = `novel_draft_${store.currentProject?.id}_${store.currentChapter.id}`;
      localStorage.setItem(localKey, JSON.stringify({
        content: newVal,
        updatedAt: Date.now()
      }));
    }

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(() => {
      if (store.currentChapter) {
        setSaveStatus('saving');
        store.updateChapter(store.currentChapter.id, { content: newVal }).then(() => {
          setSaveStatus('saved');
          // 云端保存成功，清除本地缓存
          if (typeof window !== 'undefined') {
            const localKey = `novel_draft_${store.currentProject?.id}_${store.currentChapter!.id}`;
            localStorage.removeItem(localKey);
            setLocalDraft(null);
          }
          createVersionSnapshot({
            projectId: store.currentProject!.id,
            type: 'chapter',
            key: store.currentChapter!.id,
            label: store.currentChapter!.title,
            data: { content: newVal },
            source: 'auto',
          });
        });
      }
    }, 1500);
  };

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEditorTitle(e.target.value);
    setSaveStatus('dirty');

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(() => {
      if (store.currentChapter) {
        setSaveStatus('saving');
        store.updateChapter(store.currentChapter.id, { title: e.target.value }).then(() => {
          setSaveStatus('saved');
        });
      }
    }, 1500);
  };

  // 手动保存章节
  const forceSave = () => {
    if (store.currentChapter) {
      setSaveStatus('saving');
      const contentToSave = editorContent;
      store.updateChapter(store.currentChapter.id, {
        title: editorTitle,
        content: contentToSave
      }).then(() => {
        setSaveStatus('saved');
        // 清除本地缓存
        if (typeof window !== 'undefined') {
          const localKey = `novel_draft_${store.currentProject?.id}_${store.currentChapter!.id}`;
          localStorage.removeItem(localKey);
          setLocalDraft(null);
        }
      });
    }
  };

  // 恢复本地草稿
  const restoreLocalDraft = () => {
    if (localDraft && store.currentChapter) {
      setEditorContent(localDraft.content);
      setSaveStatus('dirty');
      setLocalDraft(null);
    }
  };

  // 忽略并清除本地草稿
  const clearLocalDraft = () => {
    if (store.currentChapter && typeof window !== 'undefined') {
      const localKey = `novel_draft_${store.currentProject?.id}_${store.currentChapter!.id}`;
      localStorage.removeItem(localKey);
    }
    setLocalDraft(null);
  };

  // 文件导出功能
  const exportFile = (type: 'md' | 'txt') => {
    if (!store.currentChapter) return;
    const title = editorTitle || '未命名章节';
    const content = editorContent;
    const filename = `${title}.${type}`;
    const blob = new Blob([`# ${title}\n\n${content}`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    editorTitle,
    setEditorTitle,
    editorContent,
    setEditorContent,
    saveStatus,
    setSaveStatus,
    handleEditorChange,
    handleTitleChange,
    forceSave,
    exportFile,
    localDraft,
    restoreLocalDraft,
    clearLocalDraft,
  };
}
