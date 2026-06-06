'use client';

import { useState } from 'react';
import { BookOpen, Sparkles, Loader2, PenLine, FileText } from 'lucide-react';
import { useWorkspace } from '../../workspace-context';
import { useAiClient } from '../../hooks/useAiClient';
import { parseStructureOutline, generateMarkdownFromSections } from '@/lib/outlineParser';

interface ChapterOutlinePreviewProps {
  onStartWriting: () => void;
}

export function ChapterOutlinePreview({ onStartWriting }: ChapterOutlinePreviewProps) {
  const { store, kernel, outlineTree } = useWorkspace();
  const { localSections, selectedVolumeIdx, selectedChapterIdx } = outlineTree;
  const callAIApi = useAiClient();
  const [isGenerating, setIsGenerating] = useState(false);

  // 防御性获取
  const vol = selectedVolumeIdx !== null ? localSections[selectedVolumeIdx] : null;
  const sec = (selectedVolumeIdx !== null && selectedChapterIdx !== null)
    ? vol?.chapters[selectedChapterIdx]
    : null;

  if (!sec || selectedVolumeIdx === null || selectedChapterIdx === null) {
    return (
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-dark)', gap: '15px', padding: '40px' }}>
        <BookOpen size={48} style={{ opacity: 0.3 }} />
        <span>未能在分卷大纲中找到本章的大纲定位。您可以直接开始写作。</span>
        <button
          type="button"
          onClick={onStartWriting}
          style={{
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            color: '#a5b4fc',
            fontSize: '12px',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <PenLine size={13} />
          <span>直接写正文</span>
        </button>
      </div>
    );
  }

  const handleGenerateOutline = async () => {
    if (!store.currentProject) return;

    // 拍平全书章节，用于构造上下文大纲
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', padding: '30px', minHeight: 0, overflowY: 'auto', flexGrow: 1 }}>
      {/* 头部信息 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.04)',
        borderRadius: '12px',
        padding: '16px 20px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            background: 'rgba(99, 102, 241, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(99, 102, 241, 0.25)'
          }}>
            <FileText size={16} color="#6366f1" />
          </div>
          <div>
            <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#fff', margin: 0 }}>
              {sec.title || '未命名章节'}
            </h4>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              第 {selectedVolumeIdx + 1} 卷 · 第 {selectedChapterIdx + 1} 章
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onStartWriting}
          style={{
            background: 'linear-gradient(135deg, var(--accent) 0%, #a5b4fc 100%)',
            border: 'none',
            color: '#fff',
            fontSize: '12px',
            fontWeight: '600',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
          }}
        >
          <PenLine size={13} />
          <span>进入正文写作</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', alignItems: 'start', flexGrow: 1 }}>
        {/* 左侧：走向走向与走向大纲 */}
        <div className="glass-card" style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.005) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.04)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}>
          <h5 style={{ fontSize: '13px', fontWeight: '600', color: '#fff', margin: 0 }}>
            剧情推进走向描述
          </h5>
          <div style={{
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: '14px 16px',
            color: 'var(--text-primary, #e2e8f0)',
            fontSize: '13px',
            lineHeight: '1.7',
            whiteSpace: 'pre-wrap',
            minHeight: '120px'
          }}>
            {sec.content || '当前尚无本章的具体走向描写。您可以使用右侧 AI 推演工具，或返回“世界设定 -> 大纲设定”中手动规划。'}
          </div>
        </div>

        {/* 右侧：细节与 AI 推演 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 大纲具体细节参数 */}
          <div className="glass-card" style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.01) 0%, rgba(255,255,255,0.005) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.04)',
            borderRadius: '12px',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <h5 style={{ fontSize: '12px', fontWeight: '600', color: '#fff', margin: 0 }}>
              大纲细节指标
            </h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(sec.details && sec.details.length > 0) ? (
                sec.details.map((detail, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid rgba(255,255,255,0.03)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '12px'
                    }}
                  >
                    <div style={{ color: 'var(--text-muted)', fontWeight: '600', marginBottom: '2px' }}>{detail.key}</div>
                    <div style={{ color: '#fff', lineHeight: '1.4' }}>{detail.value}</div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '12px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  暂无核心冲突、情绪曲线等具体细纲指标。
                </div>
              )}
            </div>
          </div>

          {/* AI 推演入口 */}
          <div className="glass-card" style={{
            background: 'linear-gradient(135deg, rgba(56,189,248,0.02) 0%, rgba(56,189,248,0.005) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.15)',
            borderRadius: '12px',
            padding: '18px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
          }}>
            <h5 style={{ fontSize: '12px', fontWeight: '700', color: '#38bdf8', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={13} />
              <span>AI 细纲策划</span>
            </h5>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', margin: '0 0 12px 0' }}>
              让 AI 结合世界观设定和前后两章大纲的剧情，自动为您推演本章走向与细化指标。
            </p>
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGenerateOutline}
              style={{
                width: '100%',
                padding: '8px 12px',
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
                  <Loader2 size={12} className="animate-spin" />
                  <span>AI 正在为您设计细纲...</span>
                </>
              ) : (
                <>
                  <Sparkles size={12} />
                  <span>AI 智能推演大纲</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
