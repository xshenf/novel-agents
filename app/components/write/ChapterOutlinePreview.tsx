'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Sparkles, Loader2, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useWorkspace } from '../../workspace-context';
import { useAiClient } from '../../hooks/useAiClient';
import { parseStructureOutline, generateMarkdownFromSections } from '@/lib/outlineParser';

interface ChapterOutlinePreviewProps {
  onRenameChapter: (newTitle: string) => void;
}

export function ChapterOutlinePreview({ onRenameChapter }: ChapterOutlinePreviewProps) {
  const { store, kernel, outlineTree } = useWorkspace();
  const { localSections, selectedVolumeIdx, selectedChapterIdx } = outlineTree;
  const callAIApi = useAiClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 防御性获取
  const vol = selectedVolumeIdx !== null ? localSections[selectedVolumeIdx] : null;
  const sec = (selectedVolumeIdx !== null && selectedChapterIdx !== null)
    ? vol?.chapters[selectedChapterIdx]
    : null;

  // 章节标题本地修改状态
  const [localTitle, setLocalTitle] = useState('');

  useEffect(() => {
    if (sec) {
      setLocalTitle(sec.title || '');
    }
  }, [sec]);

  if (!sec || selectedVolumeIdx === null || selectedChapterIdx === null) {
    return null;
  }

  const handleTitleBlur = () => {
    if (localTitle.trim() && localTitle.trim() !== (sec.title || '').trim()) {
      onRenameChapter(localTitle.trim());
    }
  };

  const handleGenerateOutline = async () => {
    if (!store.currentProject) return;

    const flatChapters = localSections
      .map((v, vIdx) =>
        v.chapters.map((chap, cIdx) => ({
          ...chap,
          volIdx: vIdx,
          chapIdx: cIdx
        }))
      )
      .flat();

    const globalIdx = flatChapters.findIndex(ch => ch.volIdx === selectedVolumeIdx && ch.chapIdx === selectedChapterIdx);

    const contextChapters = flatChapters
      .map((s, sIdx) => sIdx !== globalIdx ? `- ${s.title}: ${s.content}` : '')
      .filter(Boolean)
      .slice(Math.max(0, globalIdx - 2), globalIdx + 3)
      .join('\n');

    const prompt = `你是一个资深网络小说剧情策划。请为我的小说《${store.currentProject.title}》重新规划设计【${sec.title}】的详细章节细纲。

【当前小说设定】:
- 书名: ${store.currentProject.title}
- 简介: ${kernel.tempWorldSetting || store.currentProject.worldSetting || '暂无'}
- 题材/核心冲突: ${kernel.tempCoreConflict || store.currentProject.coreConflict || '暂无'}

【其他相邻章节的上下文大纲】:
${contextChapters}

请详细为本章设计新的剧情细纲。必须以如下格式直接输出，不要输出任何多余的引言、前言或分析解释，也绝不能包含任何 Emoji 图标：
## ${sec.title}
本章剧情推进：在此处写一小段对本章核心故事情节的叙述，约100字。
- **核心冲突**：本章内具体的矛盾博弈或突发争执。
- **信息释放**：本章中交代泄漏的新伏笔或解开的旧秘密。
- **情绪曲线**：从压抑到爽快的情绪过渡比，如：高潮(85%)。
- **相关人物**：本章出场的角色名。`;

    setIsGenerating(true);
    try {
      const res = await callAIApi({
        action: 'chat',
        projectId: store.currentProject.id,
        query: prompt
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const reply = (data.reply || '').trim();
      if (!reply) throw new Error('AI 未返回任何结果');

      const parsedRegen = parseStructureOutline(reply);
      let newCh = null;
      for (const v of parsedRegen) {
        if (v.chapters.length > 0) {
          newCh = v.chapters[0];
          break;
        }
      }

      if (newCh) {
        const mergedCh = {
          ...newCh,
          title: sec.title,
          isLocked: sec.isLocked
        };
        const newSections = localSections.map((v, vIdx) => {
          if (vIdx !== selectedVolumeIdx) return v;
          const newChapters = [...v.chapters];
          newChapters[selectedChapterIdx] = mergedCh;
          return { ...v, chapters: newChapters };
        });

        const md = generateMarkdownFromSections(newSections);
        kernel.setTempOutlineFull(md);
      } else {
        throw new Error('AI 返回的内容无法解析为标准的章节大纲格式，请重试');
      }
    } catch (e: any) {
      alert('AI 章节大纲推演失败: ' + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{
      margin: '12px 30px 0',
      background: 'linear-gradient(135deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.005) 100%)',
      border: '1px solid rgba(255, 255, 255, 0.04)',
      borderRadius: '12px',
      padding: isCollapsed ? '10px 16px' : '16px 20px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      transition: 'all 0.25s ease'
    }}>
      {/* 头部：标题与状态控制 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '5px',
            background: 'rgba(99, 102, 241, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            flexShrink: 0
          }}>
            <FileText size={13} color="#6366f1" />
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', whiteSpace: 'nowrap' }}>
              第 {selectedVolumeIdx + 1} 卷 · 第 {selectedChapterIdx + 1} 章 大纲设定：
            </span>
            <input
              type="text"
              value={localTitle}
              onChange={e => setLocalTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={e => { if (e.key === 'Enter') handleTitleBlur(); }}
              placeholder="输入章节名称..."
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '13px',
                fontWeight: '700',
                outline: 'none',
                width: '100%',
                borderBottom: '1px dashed rgba(255,255,255,0.1)',
                padding: '2px 0'
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isCollapsed && (
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGenerateOutline}
              style={{
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                color: '#38bdf8',
                borderRadius: '5px',
                fontSize: '11px',
                padding: '3px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s'
              }}
            >
              {isGenerating ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
              <span>AI推演</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: 0
            }}
            title={isCollapsed ? "展开大纲设定" : "收起大纲设定"}
          >
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {/* 展开部分：剧情走向与 AI 推演 */}
      {!isCollapsed && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px', alignItems: 'start' }}>
          {/* 大纲正文推进 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>章节走向与剧情推进</span>
            <div style={{
              background: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: '8px',
              padding: '10px 12px',
              color: 'var(--text-primary, #e2e8f0)',
              fontSize: '12.5px',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
              minHeight: '80px',
              maxHeight: '150px',
              overflowY: 'auto'
            }}>
              {sec.content || '当前暂无走向细节，请在右侧点击“AI智能推演”或前往“世界设定”中进行规划。'}
            </div>
          </div>

          {/* 大纲核心细节与AI推演 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              maxHeight: '80px',
              overflowY: 'auto',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              paddingBottom: '8px'
            }}>
              {(sec.details && sec.details.length > 0) ? (
                sec.details.map((d, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    borderRadius: '4px',
                    padding: '3px 6px',
                    fontSize: '10.5px'
                  }}>
                    <span style={{ color: 'var(--text-muted)' }}>{d.key}: </span>
                    <span style={{ color: '#fff' }}>{d.value}</span>
                  </div>
                ))
              ) : (
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>暂无具体大纲细化指标</span>
              )}
            </div>

            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGenerateOutline}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                color: '#38bdf8',
                fontSize: '11px',
                fontWeight: '600',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={11} className="animate-spin" />
                  <span>AI 正在设计本章细纲...</span>
                </>
              ) : (
                <>
                  <Sparkles size={11} />
                  <span>AI 智能推演大纲</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
