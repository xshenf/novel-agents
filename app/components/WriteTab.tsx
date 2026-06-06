'use client';

import { BookOpen, CheckCircle2, Sparkles, Download, Save, Plus, Play, Pause, Loader2 } from 'lucide-react';
import { useWorkspace } from '../workspace-context';

export function WriteTab() {
  const { store, editor, autoWriter, assist, modals, kernel } = useWorkspace();
  const {
    editorTitle, setEditorTitle, editorContent, setEditorContent,
    saveStatus, handleEditorChange, handleTitleChange,
    forceSave, exportFile,
  } = editor;
  const {
    writeInstruction, setWriteInstruction, isAutoWriting, autoWritingStatus,
    targetChaptersCount, setTargetChaptersCount, finishedChaptersCount,
    autoWriteMode, setAutoWriteMode, startAutoWriting, pauseAutoWriting,
    writeUntilEnd, setWriteUntilEnd,
  } = autoWriter;
  const { handleConsistencyCheck, handleAutoSummarize } = assist;
  const { setShowNewChapModal } = modals;
  const { handleOpenEditProject } = kernel;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflowY: 'auto' }}>
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

      {/* AI 自动写小说引擎控制台 */}
      {autoWriteMode && (
        <div className="glass-card" style={{ margin: '15px 30px 0', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(99, 102, 241, 0.08)', borderColor: 'rgba(99, 102, 241, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="pulse-dot" style={{ background: isAutoWriting ? 'var(--accent-success)' : 'var(--text-dark)' }}></span>
              <strong style={{ fontSize: '14px' }}>AI 自动小说创作引擎</strong>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({autoWritingStatus})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {!isAutoWriting && (
                <>
                  <button
                    className="btn-link"
                    onClick={() => setAutoWriteMode(false)}
                    style={{ fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                    title="隐藏自动写作控制面板，进入纯粹手动编辑模式"
                  >
                    切换到纯编辑
                  </button>
                  <span style={{ width: '1px', height: '12px', background: 'var(--border-light)' }} />
                </>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>连写章数:</span>
                  <input
                    type="number"
                    className="input"
                    value={targetChaptersCount}
                    onChange={(e) => setTargetChaptersCount(Math.max(1, Number(e.target.value)))}
                    style={{ width: '50px', padding: '4px 6px', fontSize: '12px' }}
                    disabled={isAutoWriting || writeUntilEnd}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={writeUntilEnd}
                    onChange={(e) => setWriteUntilEnd(e.target.checked)}
                    disabled={isAutoWriting}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>写到结尾</span>
                </label>
              </div>
            </div>
          </div>

          {(() => {
            const totalChaptersToGenerate = writeUntilEnd
              ? Math.max(1, store.chapters.length)
              : targetChaptersCount;
            const progressPercent = Math.min(100, (finishedChaptersCount / totalChaptersToGenerate) * 100);

            return (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ flexGrow: 1, height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      background: 'var(--accent)',
                      width: `${progressPercent}%`,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  已生成 {finishedChaptersCount} / {writeUntilEnd ? '结尾' : targetChaptersCount} 章
                </span>
              </div>
            );
          })()}

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
            <input
              type="text"
              className="input"
              placeholder="可选：给自动生成的章节注入全局情节要求（例如：增加悬疑感，埋下关于玉佩身世的伏笔）"
              value={writeInstruction}
              onChange={e => setWriteInstruction(e.target.value)}
              style={{ fontSize: '12px', padding: '6px 10px' }}
              disabled={isAutoWriting}
            />
            {!isAutoWriting ? (
              <button className="btn btn-primary" onClick={startAutoWriting} style={{ padding: '6px 15px', fontSize: '12px' }}>
                <Play size={12} /> 一键自动写作
              </button>
            ) : (
              <button className="btn btn-danger" onClick={pauseAutoWriting} style={{ padding: '6px 15px', fontSize: '12px' }}>
                <Pause size={12} /> 暂停生成
              </button>
            )}
          </div>
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
              {!autoWriteMode && (
                <button
                  className="btn btn-secondary"
                  onClick={() => setAutoWriteMode(true)}
                  style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)', border: '1px dashed var(--border-light)' }}
                >
                  <span>开启 AI 自动面板</span>
                </button>
              )}
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
          <button className="btn btn-primary" onClick={() => setShowNewChapModal(true)}>
            <Plus size={16} /> 新建第一章
          </button>
        </div>
      )}
    </div>
  );
}
