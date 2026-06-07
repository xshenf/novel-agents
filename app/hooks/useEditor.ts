import { useState, useRef, useEffect, useCallback, type ChangeEvent } from 'react';
import type { NovelStore } from '@/lib/store';
import { createVersionSnapshot } from '@/lib/versionSnapshot';

export type EditorApi = ReturnType<typeof useEditor>;

export function useEditor(store: NovelStore) {
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [localDraft, setLocalDraft] = useState<{ content: string; updatedAt: number } | null>(null);
  const contentTimerRef = useRef<NodeJS.Timeout | null>(null);
  const titleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastChapterIdRef = useRef<string | undefined>(undefined);

  // 保持 store 引用稳定，使用 ref 避免 Zustand 状态变化导致 effect/callback 重复触发
  const storeRef = useRef(store);
  storeRef.current = store;

  // 响应式读取（用于判断何时触发 effect）
  const currentChapterId = store.currentChapter?.id;
  const currentChapterContent = store.currentChapter?.content;
  const currentProjectId = store.currentProject?.id;

  // 当选择新章节时，同步更新编辑器内容
  useEffect(() => {
    const s = storeRef.current;
    if (s.currentChapter) {
      const isChapterSwitched = s.currentChapter.id !== lastChapterIdRef.current;
      
      if (isChapterSwitched) {
        lastChapterIdRef.current = s.currentChapter.id;
        setEditorTitle(s.currentChapter.title);
        setEditorContent(s.currentChapter.content);
        setSaveStatus('saved');

        // 检测是否存在更新的本地草稿
        if (typeof window !== 'undefined') {
          const localKey = `novel_draft_${s.currentProject?.id}_${s.currentChapter.id}`;
          const saved = localStorage.getItem(localKey);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              // 只有当本地草稿和数据库里的正文内容不一致时，才需要提示恢复
              if (parsed && parsed.content && parsed.content.trim() !== s.currentChapter.content.trim()) {
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
      }
    } else {
      lastChapterIdRef.current = undefined;
      setEditorTitle('');
      setEditorContent('');
      setLocalDraft(null);
    }
  }, [currentChapterId, currentProjectId]);

  // 卸载时清理待执行的自动保存 timer，避免对已切走的旧章节误写
  useEffect(() => {
    return () => {
      if (contentTimerRef.current) {
        clearTimeout(contentTimerRef.current);
        contentTimerRef.current = null;
      }
      if (titleTimerRef.current) {
        clearTimeout(titleTimerRef.current);
        titleTimerRef.current = null;
      }
    };
  }, []);

  // 监听正文内容变化，自动同步缓存到 localStorage 或在保存成功时清除
  useEffect(() => {
    const s = storeRef.current;
    if (!s.currentChapter || typeof window === 'undefined') return;

    // 如果是刚刚切入章节，且编辑器内容刚好等于云端内容，先不进行任何写入或删除操作
    // 只有当章节 ID 匹配我们当前处理的 lastChapterId 时，才执行本地草稿机制
    if (s.currentChapter.id !== lastChapterIdRef.current) return;

    const localKey = `novel_draft_${s.currentProject?.id}_${s.currentChapter.id}`;

    if (editorContent !== s.currentChapter.content) {
      localStorage.setItem(localKey, JSON.stringify({
        content: editorContent,
        updatedAt: Date.now()
      }));
      // 一旦产生新改动，则放弃并自动隐藏之前的旧草稿恢复提示
      if (localDraft !== null) {
        setLocalDraft(null);
      }
    } else {
      // 只有在没有等待恢复的草稿，且编辑器内容和云端完全一致时，才清理本地草稿
      if (localDraft === null) {
        localStorage.removeItem(localKey);
      }
    }
  }, [editorContent, currentChapterContent, currentChapterId, currentProjectId, localDraft]);

  // 编辑器自动保存机制 (Debounce 1.5s)
  const handleEditorChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setEditorContent(newVal);
    setSaveStatus('dirty');

    if (contentTimerRef.current) clearTimeout(contentTimerRef.current);

    // 捕获当前章节 ID，避免闭包捕获过时的 store.currentChapter
    const s = storeRef.current;
    const chapterId = s.currentChapter?.id;

    contentTimerRef.current = setTimeout(() => {
      // 校验章节是否仍然是同一个，防止快速切换后写入错误章节
      if (chapterId && s.currentChapter?.id === chapterId) {
        setSaveStatus('saving');
        s.updateChapter(chapterId, { content: newVal }).then(() => {
          setSaveStatus('saved');
          createVersionSnapshot({
            projectId: s.currentProject!.id,
            type: 'chapter',
            key: chapterId,
            label: s.currentChapter!.title,
            data: { content: newVal },
            source: 'auto',
          });
        }).catch(() => {
          setSaveStatus('dirty');
        });
      }
    }, 1500);
  }, []);

  const handleTitleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setEditorTitle(e.target.value);
    setSaveStatus('dirty');

    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);

    // 捕获当前章节 ID，避免闭包捕获过时的 store.currentChapter
    const s = storeRef.current;
    const chapterId = s.currentChapter?.id;
    const newTitle = e.target.value;

    titleTimerRef.current = setTimeout(() => {
      // 校验章节是否仍然是同一个
      if (chapterId && s.currentChapter?.id === chapterId) {
        setSaveStatus('saving');
        s.updateChapter(chapterId, { title: newTitle }).then(() => {
          setSaveStatus('saved');
        }).catch(() => {
          setSaveStatus('dirty');
        });
      }
    }, 1500);
  }, []);

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
      }).catch(() => {
        setSaveStatus('dirty');
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
