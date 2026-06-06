'use client';

import { BookOpen, CheckCircle2, Sparkles, Download, Save, Plus } from 'lucide-react';
import { useWorkspace } from '../workspace-context';
import { WriteOutlinePreview } from './WriteOutlinePreview';
import { WriteOutlineActions } from './WriteOutlineActions';

export function WriteTab() {
  const { store, editor, autoWriter, assist, modals, kernel } = useWorkspace();
  const {
    editorTitle, setEditorTitle, editorContent, setEditorContent,
    saveStatus, handleEditorChange, handleTitleChange,
    forceSave, exportFile,
  } = editor;
  // 自动写作状态保留以维持禁用态一致性，但 UI 入口（顶部 panel 与按钮）已移除
  const { isAutoWriting } = autoWriter;
  const { handleConsistencyCheck, handleAutoSummarize } = assist;
  const { setShowNewChapModal } = modals;
  const { handleOpenEditProject } = kernel;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflowY: 'auto' }}>
      {/* 选中分卷/章节时，顶部显示大纲预览 */}
      <WriteOutlinePreview />

      {/* 大纲操作工具栏：放在连载写作页面内，分卷级与全局操作 */}
      <WriteOutlineActions />

      {/* 新书完善设定 Banner */}
      {store.currentProject && store.currentProject.title === '未命名故事' && (
        <div className="glass-card animate-fade-in" style={{ margin: '15px 30px 5px', padding: '16px 20px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff', marginBottom: '2px' }}>新书已直接建立！</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>当前使用默认模板。您可以前往左侧"设定库"慢慢添加人物与世界观，或点击右侧按钮完善核心世界观、题材与文风。</div>
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleOpenEditProject} style={{ fontSize: '12px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, background: 'linear-gradient(135deg, var(--accent) 0%, #a5b4fc 100%)', border: 'none' }}>
            <Save size={13} />
            完善新书设定
          </button>
        </div>
      )}

      {store.currentChapter ? (
        <>
          <div className="editor-header">
            <input
              type="text"
              className="editor-title-input"
              value={editorTitle}
              onChange={handleTitleChange}
              placeholder="请输入章节标题..."
              disabled={isAutoWriting}
            />
            <div className="editor-toolbar">
              <button className="btn btn-secondary" onClick={handleConsistencyCheck} style={{ padding: '8px 12px' }} disabled={isAutoWriting}>
                <CheckCircle2 size={14} style={{ color: 'var(--accent)' }} />
                <span>逻辑一致性检测</span>
              </button>
              <button className="btn btn-secondary" onClick={handleAutoSummarize} style={{ padding: '8px 12px' }} disabled={isAutoWriting}>
                <Sparkles size={14} style={{ color: 'var(--accent-success)' }} />
                <span>章节摘要复盘</span>
              </button>
              <button className="btn btn-secondary" onClick={() => exportFile('md')} style={{ padding: '8px 8px' }} title="导出为 Markdown">
                <Download size={14} />
              </button>
              <button className="btn btn-primary" onClick={forceSave} style={{ padding: '8px 12px' }} disabled={isAutoWriting}>
                <Save size={14} />
                <span>保存</span>
              </button>
            </div>
          </div>

          <div className="editor-body">
            <textarea
              className="editor-textarea"
              placeholder="在此倾泻你的笔墨，AI 将在一旁静心等候..."
              value={editorContent}
              onChange={handleEditorChange}
              disabled={isAutoWriting}
            />
          </div>

          <div className="editor-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="pulse-dot" style={{ background: isAutoWriting ? 'var(--accent-success)' : 'var(--accent-warning)' }}></span>
              <span>
                {isAutoWriting && 'AI 正在全力写作并保存至数据库...'}
                {!isAutoWriting && saveStatus === 'saved' && '草稿已自动保存至本地'}
                {!isAutoWriting && saveStatus === 'saving' && '正在自动保存到云端数据库...'}
                {!isAutoWriting && saveStatus === 'dirty' && '草稿已被修改'}
              </span>
            </div>
            <div>字数统计: {editorContent.length} 字</div>
          </div>
        </>
      ) : (
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-dark)', gap: '15px' }}>
          <BookOpen size={48} style={{ opacity: 0.3 }} />
          <span>请在左侧侧边栏创建或选择一个章节进行创作</span>
        </div>
      )}
    </div>
  );
}
