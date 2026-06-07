'use client';

import { useCallback, useState } from 'react';
import type { NovelStore } from '@/lib/store';
import { useAiClient, type CallAIApi } from './useAiClient';
import {
  generateMarkdownFromSections,
  parseStructureOutline,
  renumberVolumesAndChapters,
  type OutlineVolume,
} from '@/lib/outlineParser';

interface UseVolumeActionsParams {
  store: NovelStore;
  getLocalSections: () => OutlineVolume[];
  setOutlineFull: (next: string) => void;
}

export function useVolumeActions({ store, getLocalSections, setOutlineFull }: UseVolumeActionsParams) {
  const callAIApi = useAiClient();
  const [loadingCount, setLoadingCount] = useState(0);

  const persist = useCallback(
    async (next: OutlineVolume[]) => {
      const renumbered = renumberVolumesAndChapters(next);
      const md = generateMarkdownFromSections(renumbered);
      setOutlineFull(md);
      if (store.currentProject) {
        try {
          await store.updateProject(store.currentProject.id, { outlineFull: md });
        } catch (e) {
          console.error('自动保存大纲至数据库失败:', e);
        }
      }
    },
    [setOutlineFull, store]
  );

  // 通用：把 AI 生成的细纲 Markdown 文本追加到指定分卷
  const appendChaptersToVolume = useCallback(
    (volIdx: number, rawMarkdown: string): { addedCount: number; volTitle: string } | null => {
      const sections = getLocalSections();
      const target = sections[volIdx];
      if (!target) return null;
      // 解析 AI 文本（可能含分卷头，会被自动归属到第一个分卷下）
      const parsed = parseStructureOutline(rawMarkdown);
      const newChapters = parsed.flatMap(v => v.chapters);
      if (newChapters.length === 0) return { addedCount: 0, volTitle: target.title };

      const next = sections.map((vol, i) =>
        i === volIdx
          ? { ...vol, chapters: [...vol.chapters, ...newChapters] }
          : vol
      );
      persist(next);
      return { addedCount: newChapters.length, volTitle: target.title };
    },
    [getLocalSections, persist]
  );

  // 通用：把 AI 生成的单个分卷（标题+概要）合并回大纲
  const replaceVolumeHeader = useCallback(
    (volIdx: number, newTitle: string, newContent: string) => {
      const sections = getLocalSections();
      if (volIdx < 0 || volIdx >= sections.length) return;
      const next = sections.map((vol, i) =>
        i === volIdx
          ? { ...vol, title: newTitle.trim(), content: newContent.trim() }
          : vol
      );
      persist(next);
    },
    [getLocalSections, persist]
  );

  // 调用 AI 并返回 reply
  const callOutlineAssistant = useCallback(
    async (systemInstruction: string, prompt: string): Promise<string> => {
      const res = await callAIApi({
        action: 'chat',
        projectId: store.currentProject!.id,
        query: prompt,
        systemInstruction,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const reply: string = (data.reply || '').trim();
      if (!reply) throw new Error('AI 未返回内容');
      return reply;
    },
    [callAIApi, store]
  );

  // 抽取分卷头信息（取首条 # 第X卷 / # 第X部 / 仅返回单行标题）
  const extractVolumeHeader = (raw: string): { title: string; content: string } => {
    const m = raw.match(/^#\s*第[一二三四五六七八九十百\d]+\s*[卷部篇][：: \u3000]*([^\n#]*?)\n([\s\S]*?)(?=\n##?\s|第[一二三四五六七八九十百\d]+\s*[卷部篇]|$)/m);
    if (m) {
      return { title: m[1].trim(), content: m[2].trim() };
    }
    // 退化方案：取首行作为标题
    const firstLine = raw.split('\n').find(l => l.trim()) ?? '';
    const rest = raw.split('\n').slice(1).join('\n').trim();
    return { title: firstLine.replace(/^#+\s*/, '').trim(), content: rest };
  };

  // 构造小说上下文片段
  const buildContext = () => {
    if (!store.currentProject) return '';
    const p = store.currentProject;
    return [
      `【小说名】: ${p.title || '未命名'}`,
      `【小说简介】: ${p.description || '无'}`,
      `【文风】: ${p.styleSetting || '无'}`,
      `【世界观】: ${p.worldSetting || '无'}`,
      `【力量体系】: ${p.powerSystem || '无'}`,
      `【核心冲突】: ${p.coreConflict || '无'}`,
    ].join('\n');
  };

  // ① AI 独立生成本卷大纲（标题 + 概要），不动现有章节
  const handleAiGenerateVolumeOutline = useCallback(
    async (volIdx: number) => {
      if (!store.currentProject) return;
      const sections = getLocalSections();
      const target = sections[volIdx];
      if (!target) return;
      setLoadingCount(c => c + 1);
      try {
        const prompt = `${buildContext()}

【任务】请独立生成本卷的标题与概要。${target.content ? `（现有概要：「${target.content}」可作为参考）` : ''}
【要求】
1. 取一个具有吸引力的分卷名（4~10 字），避免 Emoji。
2. 概要 80~200 字，概括本卷的核心矛盾、主线推进、阶段高潮与对全书的承接作用。
3. 严格按以下 Markdown 格式输出（只输出一段，不要列其他分卷或章节）：

# 第${volIdx + 1}卷：<分卷名>
<概要内容>`;

        const reply = await callOutlineAssistant(
          '你是一个网络小说分卷命名与概要写作专家。直接输出 Markdown，不要带任何额外说明。',
          prompt
        );
        const { title, content } = extractVolumeHeader(reply);
        if (!title && !content) {
          throw new Error('AI 未返回有效的分卷内容');
        }
        replaceVolumeHeader(volIdx, title, content);
        alert(`已更新分卷「${title || target.title || `第 ${volIdx + 1} 卷`}」的标题与概要`);
      } catch (err: any) {
        alert('AI 生成分卷大纲失败: ' + (err?.message || String(err)));
      } finally {
        setLoadingCount(c => Math.max(0, c - 1));
      }
    },
    [store, getLocalSections, callOutlineAssistant, replaceVolumeHeader]
  );

  // ② AI 自动规划章节（仅追加新章节，不影响卷标题/概要）
  const handleAiGenerateVolumeChapters = useCallback(
    async (volIdx: number, numChapters: number = 3) => {
      if (!store.currentProject) return;
      const sections = getLocalSections();
      const target = sections[volIdx];
      if (!target) return;
      setLoadingCount(c => c + 1);
      try {
        const prompt = `${buildContext()}
【所属分卷】: ${target.title}
【分卷概要】: ${target.content || '无'}
【已存在章节数】: ${target.chapters.length}

【任务】请仅针对这一卷，规划生成 ${numChapters} 个章节的大纲。
【要求】
1. 章与章之间有清晰的递进 / 转折 / 伏笔。
2. 每章输出包含：核心冲突、信息释放、情绪曲线、相关人物、场景地点、目标字数（建议 2500~3500）。
3. 严格按以下 Markdown 格式输出，不要输出任何额外的引言 / 标题 / Emoji：

## 第X章：<章名>
- **核心冲突**：...
- **信息释放**：...
- **情绪曲线**：...
- **相关人物**：...
- **场景地点**：...
- **目标字数**：...

直接开始输出 ${numChapters} 个章节，章号从 ${target.chapters.length + 1} 开始连续递增。`;

        const reply = await callOutlineAssistant(
          '你是一个网络小说细纲写作专家。直接输出 Markdown 大纲，不要带任何 Markdown 顶级标题或 Emoji 图标。',
          prompt
        );
        const result = appendChaptersToVolume(volIdx, reply);
        if (result) {
          alert(`已为分卷「${result.volTitle}」追加 ${result.addedCount} 个章节大纲`);
        }
      } catch (err: any) {
        alert('AI 自动规划章节失败: ' + (err?.message || String(err)));
      } finally {
        setLoadingCount(c => Math.max(0, c - 1));
      }
    },
    [store, getLocalSections, callOutlineAssistant, appendChaptersToVolume]
  );

  // ③ AI 一键生成本卷：标题 + 概要 + 章节（彻底重写本卷）
  const handleAiGenerateFullVolume = useCallback(
    async (volIdx: number, numChapters: number = 5) => {
      if (!store.currentProject) return;
      const sections = getLocalSections();
      const target = sections[volIdx];
      if (!target) return;

      const run = async () => {
        setLoadingCount(c => c + 1);
        try {
          const prompt = `${buildContext()}

【任务】请为「第 ${volIdx + 1} 卷」一次性规划分卷的标题、概要与 ${numChapters} 个章节细纲。
${target.content ? `【原有概要参考】: ${target.content}` : ''}

【要求】
1. 分卷名 4~10 字，概要 80~200 字。
2. 章与章之间递进 / 转折 / 伏笔。
3. 每章输出：核心冲突、信息释放、情绪曲线、相关人物、场景地点、目标字数（建议 2500~3500）。
4. 严格按以下 Markdown 格式输出，不要输出任何额外引言 / Emoji：

# 第${volIdx + 1}卷：<分卷名>
<概要内容>

## 第1章：<章名>
- **核心冲突**：...
- **信息释放**：...
- **情绪曲线**：...
- **相关人物**：...
- **场景地点**：...
- **目标字数**：...

## 第2章：<章名>
...（依次给出 ${numChapters} 章）`;

        const reply = await callOutlineAssistant(
          '你是一个网络小说分卷与细纲一体规划专家。直接输出 Markdown，不要带任何额外说明。',
          prompt
        );
        const parsed = parseStructureOutline(reply);
        if (parsed.length === 0) {
          throw new Error('AI 返回内容无法解析为分卷大纲');
        }
        const newVol = parsed[0];
        const next = sections.map((vol, i) =>
          i === volIdx
            ? {
                ...vol,
                title: newVol.title || vol.title,
                content: newVol.content || vol.content,
                chapters: newVol.chapters,
              }
            : vol
        );
        persist(next);
          alert(`已重建分卷「${newVol.title || target.title}」，含 ${newVol.chapters.length} 章大纲`);
        } catch (err: any) {
          alert('AI 一键生成本卷失败: ' + (err?.message || String(err)));
        } finally {
          setLoadingCount(c => Math.max(0, c - 1));
        }
      };

      if (target.chapters.length > 0) {
        store.showConfirm(
          `分卷「${target.title || `第 ${volIdx + 1} 卷`}」已有 ${target.chapters.length} 个章节，AI 重建将清空这些章节细纲。是否继续？`,
          run
        );
      } else {
        run();
      }
    },
    [store, getLocalSections, callOutlineAssistant, persist]
  );

  // ④ AI 一次性创建新分卷（追加到末尾，含卷头 + 章节）
  const handleAiCreateNewVolume = useCallback(
    async (numChapters: number = 5) => {
      if (!store.currentProject) return;
      setLoadingCount(c => c + 1);
      try {
        const sections = getLocalSections();
        const newVolIdx = sections.length;
        const prompt = `${buildContext()}
【已存在分卷】: ${sections.map((v, i) => `第 ${i + 1} 卷：${v.title || '未命名'}`).join('；') || '无'}

【任务】请规划一个新的分卷（接续在已有分卷之后），包含分卷标题、概要与 ${numChapters} 个章节细纲。
【要求】
1. 与前序分卷衔接自然，不要重复。
2. 分卷名 4~10 字；概要 80~200 字。
3. 每章输出：核心冲突、信息释放、情绪曲线、相关人物、场景地点、目标字数。
4. 严格按以下 Markdown 格式输出：

# 第${newVolIdx + 1}卷：<分卷名>
<概要内容>

## 第1章：<章名>
- **核心冲突**：...
- **信息释放**：...
- **情绪曲线**：...
- **相关人物**：...
- **场景地点**：...
- **目标字数**：...

（依次输出 ${numChapters} 章）`;

        const reply = await callOutlineAssistant(
          '你是一个网络小说长篇分卷规划专家。直接输出 Markdown，不要带任何额外说明。',
          prompt
        );
        const parsed = parseStructureOutline(reply);
        if (parsed.length === 0) {
          throw new Error('AI 返回内容无法解析为分卷大纲');
        }
        const newVol = parsed[0];
        const next = [...sections, newVol];
        persist(next);
        alert(`已新增分卷「${newVol.title || `第 ${newVolIdx + 1} 卷`}」，含 ${newVol.chapters.length} 章大纲`);
      } catch (err: any) {
        alert('AI 新建分卷失败: ' + (err?.message || String(err)));
      } finally {
        setLoadingCount(c => Math.max(0, c - 1));
      }
    },
    [store, getLocalSections, callOutlineAssistant, persist]
  );

  // 手动新增一个空章节到指定分卷
  const handleAddChapter = useCallback(
    (volIdx: number) => {
      const sections = getLocalSections();
      if (volIdx < 0 || volIdx >= sections.length) return;
      const next = sections.map((vol, i) =>
        i === volIdx
          ? {
              ...vol,
              chapters: [
                ...vol.chapters,
                {
                  title: '',
                  content: '',
                  details: [],
                },
              ],
            }
          : vol
      );
      persist(next);
    },
    [getLocalSections, persist]
  );

  // 手动新增一个空分卷
  const handleAddVolume = useCallback(() => {
    const sections = getLocalSections();
    const next: OutlineVolume[] = [
      ...sections,
      { title: '', content: '', chapters: [] },
    ];
    persist(next);
  }, [getLocalSections, persist]);

  // 删除指定分卷
  const handleDeleteVolume = useCallback(
    (volIdx: number) => {
      const sections = getLocalSections();
      const target = sections[volIdx];
      if (!target) return;
      store.showConfirm(`确定要删除分卷「${target.title || `第 ${volIdx + 1} 卷`}」及其全部章节大纲吗？`, () => {
        const next = sections.filter((_, i) => i !== volIdx);
        persist(next);
      });
    },
    [getLocalSections, persist, store]
  );

  // 切换分卷锁定标记
  const toggleLockVolume = useCallback(
    (volIdx: number) => {
      const sections = getLocalSections();
      const next = sections.map((vol, i) =>
        i === volIdx ? { ...vol, isLocked: !vol.isLocked } : vol
      );
      persist(next);
    },
    [getLocalSections, persist]
  );

  // 移位分卷位置
  const handleMoveVolume = useCallback(
    (volIdx: number, direction: 'up' | 'down') => {
      const sections = getLocalSections();
      if (direction === 'up' && volIdx === 0) return;
      if (direction === 'down' && volIdx === sections.length - 1) return;

      const targetIdx = direction === 'up' ? volIdx - 1 : volIdx + 1;
      const next = [...sections];
      const temp = next[volIdx];
      next[volIdx] = next[targetIdx];
      next[targetIdx] = temp;
      persist(next);
    },
    [getLocalSections, persist]
  );

  // 更新分卷标题与概要
  const updateVolumeInfo = useCallback(
    (volIdx: number, title: string, content: string) => {
      const sections = getLocalSections();
      if (volIdx < 0 || volIdx >= sections.length) return;
      const next = sections.map((vol, i) =>
        i === volIdx
          ? { ...vol, title: title.trim(), content: content.trim() }
          : vol
      );
      persist(next);
    },
    [getLocalSections, persist]
  );

  return {
    isAiOutlineLoading: loadingCount > 0,
    handleAiGenerateVolumeOutline,
    handleAiGenerateVolumeChapters,
    handleAiGenerateFullVolume,
    handleAiCreateNewVolume,
    handleAddChapter,
    handleAddVolume,
    handleDeleteVolume,
    toggleLockVolume,
    handleMoveVolume,
    updateVolumeInfo,
  };
}
