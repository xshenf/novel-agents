'use client';

import { useRef, useState, useEffect } from 'react';
import { BookOpen, Download, Save, PenLine, Maximize2, Sparkles, RefreshCw, Loader2, ShieldCheck, MessageCircle } from 'lucide-react';
import { useWorkspace } from '../workspace-context';
import { countChineseChars } from '@/lib/textStats';
import { MemoryPanel } from './write/MemoryPanel';
import { DriftCheckPanel } from './write/DriftCheckPanel';
import { VolumeManagementView } from './write/VolumeManagementView';
import { ChapterOutlinePreview } from './write/ChapterOutlinePreview';
import { generateMarkdownFromSections } from '@/lib/outlineParser';

export function WriteTab() {
  const { store, editor, autoWriter, inlineAi, kernel, outlineTree, routing, assist, ui, wizard } = useWorkspace();
  const { router, buildWorkspaceUrl, urlChapterId } = routing;
  const { handleConsistencyCheck, handleAutoSummarize } = assist;
  const busy = ui.isAiLoading;
  const { selectedVolumeIdx, selectedChapterIdx } = outlineTree;
  const {
    editorTitle, editorContent,
    saveStatus, handleEditorChange, handleTitleChange, forceSave, exportFile,
  } = editor;
  const { isAutoWriting, startAutoWriting, pauseAutoWriting } = autoWriter;
  const { busy: inlineBusy, continueWriting, transformSelection } = inlineAi;
  const { handleOpenEditProject } = kernel;

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
      store.updateProject(store.currentProject.id, { outlineFull: md }).catch(e => {
        console.error('自动保存重命名后大纲失败:', e);
      });
    }
  };

  // 自动长高 textarea，以支持整体全页面滚动
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      const minHeight = 400;
      el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
    }
  }, [editorContent]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const locked = isAutoWriting || inlineBusy !== null;

  const runSelectionOp = (mode: 'expand' | 'polish' | 'rewrite') => {
    const el = textareaRef.current;
    if (!el) return;
    transformSelection(mode, el.selectionStart, el.selectionEnd);
  };

  const toolbarBtnBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    height: '32px',
    fontSize: '12px',
    borderRadius: '6px',
    boxSizing: 'border-box',
    whiteSpace: 'nowrap',
  };

  const inlineBtn: React.CSSProperties = {
    ...toolbarBtnBase,
    padding: '0 10px',
    background: 'rgba(99,102,241,0.08)',
    border: '1px solid rgba(99,102,241,0.22)',
    color: '#c7d2fe',
    cursor: locked ? 'not-allowed' : 'pointer',
    opacity: locked ? 0.5 : 1,
  };

  const exportBtn: React.CSSProperties = {
    ...toolbarBtnBase,
    padding: '0 8px',
  };

  const saveBtn: React.CSSProperties = {
    ...toolbarBtnBase,
    padding: '0 12px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', flexGrow: 1 }}>
      {/* 整体可滚动区域（含大纲、设定、正文） */}
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflowY: 'auto' }}>

        {/* 新书完善设定 Banner */}
        {store.currentProject && (() => {
          const p = store.currentProject;
          const desc = (p.description || '').trim();
          const tone = (p.styleSetting || '').trim();
          const needsSetup = !desc || desc.includes('补充') || !tone || tone === '待补充';
          return needsSetup;
        })() && (
          <div className="glass-card animate-fade-in" style={{ margin: '15px 30px 5px', padding: '16px 20px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>项目尚未完善设定</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>完善题材、文风与世界观后，AI 将为您推演完整的世界设定与大纲。</div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => { routing.setActiveWorkspaceTab('outline'); routing.router.push(routing.buildWorkspaceUrl(store.currentProject!.id, 'outline', undefined, undefined, 'styleSetting')); }} style={{ fontSize: '12px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, var(--accent) 0%, #a5b4fc 100%)', border: 'none' }}>
                <Sparkles size={13} />
                完善设定
              </button>
              <button className="btn" onClick={() => { const el = document.querySelector<HTMLInputElement>('.chat-input-area .input'); el?.focus(); }} style={{ fontSize: '12px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#a5b4fc' }}>
                <MessageCircle size={13} />
                对话生成设定
              </button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.6' }}>提示：点击"对话生成设定"后，在右侧对话框输入您的想法即可。例如："帮我生成一个仙侠修真题材的世界设定，主角是废材逆袭路线，文风偏热血爽文"，AI 将根据您的描述推演完整的世界观、功法体系和核心冲突。</div>
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
                    {/* 一致性检测 */}
                    <button className="btn btn-secondary" onClick={handleConsistencyCheck} style={inlineBtn} disabled={locked || busy} title="对照记忆检查人物/伏笔/世界观一致性">
                      {busy ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                      <span>一致性检测</span>
                    </button>
                    {/* 重算本章记忆 */}
                    <button className="btn btn-secondary" onClick={handleAutoSummarize} style={inlineBtn} disabled={locked || busy} title="重新复盘本章，更新记忆与摘要">
                      {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} style={{ color: '#34d399' }} />}
                      <span>重算本章记忆</span>
                    </button>
                    {/* AI生成本章 / 停止生成 */}
                    {isAutoWriting ? (
                      <button className="btn btn-secondary" onClick={pauseAutoWriting} style={{ ...inlineBtn, color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)' }} title="停止当前的 AI 正文写作">
                        <Loader2 size={13} className="animate-spin" />
                        <span>停止生成</span>
                      </button>
                    ) : (
                      <button className="btn btn-secondary" onClick={() => startAutoWriting({ count: 1 })} style={{ ...inlineBtn, background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8' }} disabled={locked || busy} title="让 AI 依据大纲走向一键生成本章完整正文">
                        <Sparkles size={13} style={{ color: '#38bdf8' }} />
                        <span>AI生成本章</span>
                      </button>
                    )}
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
                    <button className="btn btn-secondary" onClick={() => exportFile('md')} style={exportBtn} title="导出为 Markdown">
                      <Download size={14} />
                    </button>
                    <button className="btn btn-primary" onClick={forceSave} style={saveBtn} disabled={locked} title="立即手动保存正文草稿">
                      <Save size={14} />
                      <span>保存</span>
                    </button>
                  </div>
                </div>

                {/* 本地草稿恢复提示条 */}
                {editor.localDraft && (
                  <div className="animate-fade-in" style={{
                    margin: '5px 40px 10px',
                    padding: '10px 16px',
                    background: 'rgba(56, 189, 248, 0.08)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    fontSize: '12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c7d2fe' }}>
                      <span style={{ fontWeight: '600', color: '#38bdf8' }}>本地草稿提示：</span>
                      <span>检测到本章有未同步至云端的本地缓存草稿（保存于 {new Date(editor.localDraft.updatedAt).toLocaleString()}）。</span>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button 
                        onClick={editor.restoreLocalDraft} 
                        className="btn"
                        style={{
                          padding: '4px 10px',
                          height: '24px',
                          fontSize: '11px',
                          borderRadius: '4px',
                          background: 'var(--accent)',
                          color: '#fff',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                        title="载入浏览器本地保存的最新草稿内容"
                      >
                        恢复草稿
                      </button>
                      <button 
                        onClick={editor.clearLocalDraft}
                        className="btn"
                        style={{
                          padding: '4px 10px',
                          height: '24px',
                          fontSize: '11px',
                          borderRadius: '4px',
                          background: 'transparent',
                          border: '1px solid var(--border-light)',
                          color: 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                        title="放弃并删除此本地缓存"
                      >
                        忽略
                      </button>
                    </div>
                  </div>
                )}

                {/* AI 运行状态提示条 */}
                {(locked || busy) && (
                  <div className="animate-fade-in" style={{
                    margin: '5px 40px 10px',
                    padding: '10px 16px',
                    background: 'rgba(99, 102, 241, 0.06)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                  }}>
                    <Loader2 size={13} className="animate-spin" style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span style={{ fontWeight: '600', color: '#fff', whiteSpace: 'nowrap' }}>AI 状态提示：</span>
                    <span style={{ color: '#c7d2fe' }}>
                      {isAutoWriting && '正在提取大纲与上下文记忆，自动撰写当前章节正文...'}
                      {inlineBusy === 'continue' && '正在分析全文剧情，在末尾为您进行续写...'}
                      {inlineBusy === 'polish' && '正在润色精雕您选中的正文段落...'}
                      {inlineBusy === 'expand' && '正在丰富细节描写，为您扩写选中正文段落...'}
                      {inlineBusy === 'rewrite' && '正在对您选中的正文段落进行换法改写...'}
                      {busy && !isAutoWriting && '正在读取世界设定与人物卡记忆，进行逻辑一致性检测或重新复盘本章记忆...'}
                    </span>
                  </div>
                )}

                <div className="editor-body" style={{ flexGrow: 0, overflowY: 'visible', paddingBottom: '80px' }}>
                  <textarea
                    ref={textareaRef}
                    className="editor-textarea"
                    placeholder="此处可对 AI 生成的正文进行编辑修改；选中文字后可用上方「扩写 / 润色 / 改写」。"
                    value={editorContent}
                    onChange={handleEditorChange}
                    disabled={locked}
                    style={{ overflowY: 'hidden', height: 'auto', resize: 'none' }}
                  />
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

      {/* 固定在底部的页脚状态栏 */}
      {selectedVolumeIdx !== null && selectedChapterIdx !== null && store.currentChapter && (
        <div className="editor-footer" style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="pulse-dot" style={{ background: (locked || busy) ? 'var(--accent-success)' : 'var(--accent-warning)' }}></span>
            <span>
              {isAutoWriting && 'AI 正在全力写作并保存至数据库...'}
              {inlineBusy && !isAutoWriting && 'AI 内联处理中...'}
              {busy && !isAutoWriting && 'AI 正在分析记忆/校验逻辑...'}
              {!locked && !busy && saveStatus === 'saved' && '已保存到云端数据库'}
              {!locked && !busy && saveStatus === 'saving' && '正在保存到云端数据库...'}
              {!locked && !busy && saveStatus === 'dirty' && '草稿已被修改'}
            </span>
          </div>
          <div>字数统计: {countChineseChars(editorContent)} 字</div>
        </div>
      )}
    </div>
  );
}
