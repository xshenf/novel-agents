import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import type { NovelStore } from '@/lib/store';
import { createVersionSnapshot } from '@/lib/versionSnapshot';

export type EditorApi = ReturnType<typeof useEditor>;

export function useEditor(store: NovelStore) {
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  // 当选择新章节时，同步更新编辑器内容
  useEffect(() => {
    if (store.currentChapter) {
      setEditorTitle(store.currentChapter.title);
      setEditorContent(store.currentChapter.content);
      setSaveStatus('saved');
    } else {
      setEditorTitle('');
      setEditorContent('');
    }
  }, [store.currentChapter]);

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
    setEditorContent(e.target.value);
    setSaveStatus('dirty');

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(() => {
      if (store.currentChapter) {
        setSaveStatus('saving');
        store.updateChapter(store.currentChapter.id, { content: e.target.value }).then(() => {
          setSaveStatus('saved');
          createVersionSnapshot({
            projectId: store.currentProject!.id,
            type: 'chapter',
            key: store.currentChapter!.id,
            label: store.currentChapter!.title,
            data: { content: e.target.value },
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
      store.updateChapter(store.currentChapter.id, {
        title: editorTitle,
        content: editorContent
      }).then(() => {
        setSaveStatus('saved');
      });
    }
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
  };
}
