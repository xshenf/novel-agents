'use client';

import { useRef, useState, useEffect } from 'react';
import { BookOpen, Download, Save, PenLine, Maximize2, Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { useWorkspace } from '../workspace-context';
import { countChineseChars } from '@/lib/textStats';
import { MemoryPanel } from './write/MemoryPanel';
import { DriftCheckPanel } from './write/DriftCheckPanel';
import { VolumeManagementView } from './write/VolumeManagementView';
import { ChapterOutlinePreview } from './write/ChapterOutlinePreview';
import { generateMarkdownFromSections } from '@/lib/outlineParser';

export function WriteTab() {
  const { store, editor, autoWriter, inlineAi, kernel, outlineTree, routing } = useWorkspace();
  const { router, buildWorkspaceUrl } = routing;
  const { selectedVolumeIdx, selectedChapterIdx } = outlineTree;
  const {
    editorTitle, editorContent,
    saveStatus, handleEditorChange, handleTitleChange, forceSave, exportFile,
  } = editor;
  const { isAutoWriting } = autoWriter;
  const { busy: inlineBusy, continueWriting, transformSelection } = inlineAi;
  const { handleOpenEditProject } = kernel;

  useEffect(() => {
    const createEmptyChapterIfNeeded = async () => {
      if (selectedVolumeIdx !== null && selectedChapterIdx !== null && !store.currentChapter && store.currentProject) {
        const sec = outlineTree.localSections[selectedVolumeIdx]?.chapters[selectedChapterIdx];
        if (sec) {
          const title = sec.title || '新章节';
          const newChap = await store.createChapter(store.currentProject.id, title);
          store.setCurrentChapter(newChap);
          router.push(buildWorkspaceUrl(store.currentProject.id, 'write', newChap.id));
        }
      }
    };
    createEmptyChapterIfNeeded();
  }, [selectedVolumeIdx, selectedChapterIdx, store.currentChapter, store.currentProject, outlineTree.localSections, router, buildWorkspaceUrl, store]);

  const handleRenameChapter = (newTitle: string) => {
    editor.handleTitleChange({ target: { value: newTitle } } as any);
    
    if (selectedVolumeIdx !== null && selectedChapterIdx !== null && store.currentProject) {
      const newSections = outlineTree.localSections.map((vol, vIdx) => {
        if (vIdx !== selectedVolumeIdx) return vol;
        const newChapters = vol.chapters.map((chap, cIdx) =>
          cIdx === selectedChapterIdx ? { ...chap, title: newTitle } : chap
        );
        return { ...vol, chapters: newChapters };
      });
      const md = generateMarkdownFromSections(newSections);
      kernel.setTempOutlineFull(md);
    }
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const locked = isAutoWriting || inlineBusy !== null;

  const runSelectionOp = (mode: 'expand' | 'polish' | 'rewrite') => {
    const el = textareaRef.current;
    if (!el) return;
    transformSelection(mode, el.selectionStart, el.selectionEnd);
  };

  const inlineBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '8px 10px', fontSize: '12px', borderRadius: '6px',
    background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.22)',
    color: '#c7d2fe', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.5 : 1,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflowY: 'auto' }}>

      {/* 新书完善设定 Banner */}
      {store.currentProject && store.currentProject.title === '未命名故事' && (
        <div className="glass-card animate-fade-in" style={{ margin: '15px 30px 5px', padding: '16px 20px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff', marginBottom: '2px' }}>新书已直接建立！</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>当前使用默认模板。您可以前往左侧「设定库」慢慢添加人物与世界观，或点击右侧按钮完善核心世界观、题材与文风。</div>
          </div>
          <button className="btn btn-primary" onClick={handleOpenEditProject} style={{ fontSize: '12px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, background: 'linear-gradient(135deg, var(--accent) 0%, #a5b4fc 100%)', border: 'none' }}>
            <Save size={13} />
            完善新书设定
          </button>
        </div>
      )}

      {selectedVolumeIdx !== null && selectedChapterIdx === null ? (
        <VolumeManagementView vIdx={selectedVolumeIdx} />
      ) : (selectedVolumeIdx !== null && selectedChapterIdx !== null) ? (
        <>
          {/* 顶部直接显示本章大纲 */}
          <ChapterOutlinePreview onRenameChapter={handleRenameChapter} />

          {store.currentChapter ? (
            <>
              <MemoryPanel />
              <DriftCheckPanel />

              <div className="editor-header" style={{ justifyContent: 'flex-end' }}>
                <div className="editor-toolbar">
                  {/* 内联 AI：仅做编辑/修改辅助，正文以 AI 生成为主 */}
                  <button className="btn btn-secondary" onClick={continueWriting} style={inlineBtn} disabled={locked} title="在全文末尾续写">
                    {inlineBusy === 'continue' ? <Loader2 size={13} className="animate-spin" /> : <PenLine size={13} />}
                    <span>续写</span>
                  </button>
                  <button className="btn btn-secondary" onClick={() => runSelectionOp('expand')} style={inlineBtn} disabled={locked} title="扩写选中文字">
                    {inlineBusy === 'expand' ? <Loader2 size={13} className="animate-spin" /> : <Maximize2 size={13} />}
                    <span>扩写</span>
                  </button>
                  <button className="btn btn-secondary" onClick={() => runSelectionOp('polish')} style={inlineBtn} disabled={locked} title="润色选中文字">
                    {inlineBusy === 'polish' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    <span>润色</span>
                  </button>
                  <button className="btn btn-secondary" onClick={() => runSelectionOp('rewrite')} style={inlineBtn} disabled={locked} title="改写选中文字">
                    {inlineBusy === 'rewrite' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    <span>改写</span>
                  </button>
                  <button className="btn btn-secondary" onClick={() => exportFile('md')} style={{ padding: '8px 8px' }} title="导出为 Markdown">
                    <Download size={14} />
                  </button>
                  <button className="btn btn-primary" onClick={forceSave} style={{ padding: '8px 12px' }} disabled={locked}>
                    <Save size={14} />
                    <span>保存</span>
                  </button>
                </div>
              </div>

              <div className="editor-body">
                <textarea
                  ref={textareaRef}
                  className="editor-textarea"
                  placeholder="此处可对 AI 生成的正文进行编辑修改；选中文字后可用上方「扩写 / 润色 / 改写」。"
                  value={editorContent}
                  onChange={handleEditorChange}
                  disabled={locked}
                />
              </div>

              <div className="editor-footer">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="pulse-dot" style={{ background: locked ? 'var(--accent-success)' : 'var(--accent-warning)' }}></span>
                  <span>
                    {isAutoWriting && 'AI 正在全力写作并保存至数据库...'}
                    {inlineBusy && !isAutoWriting && 'AI 内联处理中...'}
                    {!locked && saveStatus === 'saved' && '已保存到云端数据库'}
                    {!locked && saveStatus === 'saving' && '正在保存到云端数据库...'}
                    {!locked && saveStatus === 'dirty' && '草稿已被修改'}
                  </span>
                </div>
                <div>字数统计: {countChineseChars(editorContent)} 字</div>
              </div>
            </>
          ) : (
            <div style={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
              <Loader2 className="animate-spin" style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>正在为您加载/创建正文草稿...</span>
            </div>
          )}
        </>
      ) : (
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-dark)', gap: '15px' }}>
          <BookOpen size={48} style={{ opacity: 0.3 }} />
          <span>请在左侧选择章节开始创作</span>
        </div>
      )}
    </div>
  );
}
