'use client';

import { useState } from 'react';
import { Sparkles, Loader2, Play, Pause } from 'lucide-react';
import { useWorkspace } from '../../workspace-context';
import { useNovelStore } from '@/lib/store';

interface VolumeAiPanelProps {
  vIdx: number;
}

export function VolumeAiPanel({ vIdx }: VolumeAiPanelProps) {
  const { store, outlineTree, volumeActions, autoWriter } = useWorkspace();
  const { localSections } = outlineTree;
  const vol = localSections[vIdx];

  const {
    isAiOutlineLoading,
    handleAiGenerateVolumeOutline,
    handleAiGenerateVolumeChapters,
    handleAiGenerateFullVolume,
  } = volumeActions;

  const {
    isAutoWriting,
    autoWritingStatus,
    finishedChaptersCount,
    targetChaptersCount,
    startAutoWriting,
    pauseAutoWriting,
  } = autoWriter;

  const [numChapters, setNumChapters] = useState(3);
  const [generateCount, setGenerateCount] = useState<number | 'all'>(3);
  const [isGeneratingThisVolume, setIsGeneratingThisVolume] = useState(false);

  const handleGenerateChaptersText = async () => {
    if (!store.currentProject || !vol) return;
    setIsGeneratingThisVolume(true);

    try {
      // 1. 确保本卷大纲里的所有章节均已在数据库建立
      const updatedChaps = [];
      for (const chap of vol.chapters) {
        let dbChap = store.chapters.find((c: any) => c.title === chap.title);
        if (!dbChap) {
          dbChap = await store.createChapter(store.currentProject.id, chap.title);
        }
        updatedChaps.push(dbChap);
      }

      // 2. 从 store 重拿最新 chapters 列表
      const latestChapters = useNovelStore.getState().chapters;
      const volDbChaps = vol.chapters.map(chap =>
        latestChapters.find((c: any) => c.title === chap.title)
      ).filter((c): c is any => !!c);

      // 3. 过滤出没有正文的章节，或者若是当前编辑章节（且其为空或属于此卷）也可写入
      const toWriteChaps = volDbChaps.filter(chap =>
        chap.content.trim() === '' || store.currentChapter?.id === chap.id
      );

      if (toWriteChaps.length === 0) {
        alert('本卷所有章节已有正文，无需生成');
        setIsGeneratingThisVolume(false);
        return;
      }

      // 4. 计算实际需要生成的章节队列
      const actualToWrite = generateCount === 'all' ? toWriteChaps : toWriteChaps.slice(0, Number(generateCount));

      if (actualToWrite.length === 0) {
        alert('没有符合生成条件（空白）的章节');
        setIsGeneratingThisVolume(false);
        return;
      }

      // 5. 启动自动写作流程
      await startAutoWriting({
        targetChapters: actualToWrite,
        count: actualToWrite.length,
        untilEnd: generateCount === 'all'
      });
    } catch (e: any) {
      alert('批量生成章节正文失败: ' + e.message);
    } finally {
      setIsGeneratingThisVolume(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. AI 剧情大纲助手 */}
      <div className="glass-card" style={{
        background: 'linear-gradient(135deg, rgba(56,189,248,0.02) 0%, rgba(56,189,248,0.005) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.15)',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)'
      }}>
        <h5 style={{ fontSize: '13px', fontWeight: '700', color: '#38bdf8', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={14} />
          <span>AI 剧情大纲助手</span>
        </h5>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* ① 走向一键推演 */}
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '4px' }}>
              分卷走向推演
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.4' }}>
              让 AI 结合全书背景设定，智能重写或丰富本分卷的整体矛盾与高潮走向。
            </div>
            <button
              type="button"
              disabled={isAiOutlineLoading}
              onClick={() => handleAiGenerateVolumeOutline(vIdx)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                background: 'rgba(56, 189, 248, 0.1)',
                color: '#38bdf8',
                fontSize: '11px',
                fontWeight: '600',
                cursor: isAiOutlineLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              {isAiOutlineLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              <span>AI 推演分卷走向</span>
            </button>
          </div>

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />

          {/* ② 规划新章节 */}
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '4px' }}>
              AI 规划章节细纲
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.4' }}>
              仅在本卷末尾接续规划新的章节大纲，不影响现有分卷标题与概要。
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>规划数量：</span>
              <select
                value={numChapters}
                onChange={e => setNumChapters(Number(e.target.value))}
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '11px',
                  padding: '2px 8px',
                  outline: 'none'
                }}
              >
                {[2, 3, 5, 8, 10].map(n => (
                  <option key={n} value={n}>{n} 章</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={isAiOutlineLoading}
              onClick={() => handleAiGenerateVolumeChapters(vIdx, numChapters)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                background: 'rgba(255, 255, 255, 0.02)',
                color: '#e0e0e0',
                fontSize: '11px',
                cursor: isAiOutlineLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              {isAiOutlineLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              <span>规划新章节大纲</span>
            </button>
          </div>

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />

          {/* ③ 重置重建整卷 */}
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '4px' }}>
              AI 一键重建本卷
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.4' }}>
              重写本卷的标题、概要走向，并重新规划所含的章节。警告：这将清空该卷旧的章节细纲。
            </div>
            <button
              type="button"
              disabled={isAiOutlineLoading}
              onClick={() => handleAiGenerateFullVolume(vIdx, 5)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                background: 'rgba(239, 68, 68, 0.05)',
                color: '#f87171',
                fontSize: '11px',
                cursor: isAiOutlineLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              {isAiOutlineLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              <span>重建本卷大纲与章节</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. AI 章节正文助手 */}
      <div className="glass-card" style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.02) 0%, rgba(99,102,241,0.005) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.15)',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)'
      }}>
        <h5 style={{ fontSize: '13px', fontWeight: '700', color: '#818cf8', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={14} />
          <span>AI 章节正文助手</span>
        </h5>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.4' }}>
              一键为本卷中未写作（空白正文）的章节生成正文。系统将结合小说大纲、核心设定及前文记忆进行连贯创作。
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>生成范围：</span>
              <select
                value={generateCount}
                onChange={e => {
                  const val = e.target.value;
                  setGenerateCount(val === 'all' ? 'all' : Number(val));
                }}
                disabled={isAutoWriting}
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '11px',
                  padding: '2px 8px',
                  outline: 'none'
                }}
              >
                <option value={1}>本卷后 1 章</option>
                <option value={3}>本卷后 3 章</option>
                <option value={5}>本卷后 5 章</option>
                <option value="all">本卷全部未写章节</option>
              </select>
            </div>

            {isAutoWriting ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '11px', color: '#818cf8', fontWeight: '600' }}>
                  {autoWritingStatus}
                </div>
                {targetChaptersCount > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                      <span>写作进度</span>
                      <span>{finishedChaptersCount} / {targetChaptersCount} 章</span>
                    </div>
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${(finishedChaptersCount / targetChaptersCount) * 100}%`,
                        height: '100%',
                        background: 'var(--accent)',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={pauseAutoWriting}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Pause size={12} />
                  <span>暂停正文生成</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isGeneratingThisVolume}
                onClick={handleGenerateChaptersText}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: '#a5b4fc',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: isGeneratingThisVolume ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                {isGeneratingThisVolume ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>正在准备章节数据...</span>
                  </>
                ) : (
                  <>
                    <Play size={12} />
                    <span>开始生成本卷正文</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
