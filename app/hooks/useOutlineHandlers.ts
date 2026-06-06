'use client';

import { useCallback, useMemo } from 'react';
import type { MutableRefObject } from 'react';
import type { CallAIApi } from './useAiClient';
import {
  parseStructureOutline,
  generateMarkdownFromSections,
  renumberVolumesAndChapters,
  type OutlineChapter,
  type OutlineVolume,
} from '@/lib/outlineParser';
import type { AiUndoEntry } from '../hooks/useAiUndoStack';
import type { WorkspaceContextValue } from '../workspace-context';

interface OutlineHandlersParams {
  store: WorkspaceContextValue['store'];
  callAIApi: CallAIApi;
  localSections: OutlineVolume[];
  setLocalSections: (v: OutlineVolume[]) => void;
  setTempOutlineFull: (v: string) => void;
  editingVolumeIdx: number | null;
  setEditingVolumeIdx: (v: number | null) => void;
  editVolumeForm: OutlineVolume | null;
  setEditVolumeForm: (v: OutlineVolume | null) => void;
  editingChapterPath: { volIdx: number; chapIdx: number } | null;
  setEditingChapterPath: (v: { volIdx: number; chapIdx: number } | null) => void;
  editChapterForm: OutlineChapter | null;
  setEditChapterForm: (v: OutlineChapter | null) => void;
  aiAbortRef: MutableRefObject<AbortController | null>;
  setRegeningIndex: (v: number | null) => void;
  setRegeningVolumeIdx: (v: number | null) => void;
  pushAiUndo: (entry: Omit<AiUndoEntry, 'id' | 'timestamp'>) => void;
  flatChapters: (OutlineChapter & { volIdx: number; chapIdx: number })[];
  tempWorldSetting: string;
  tempCoreConflict: string;
  tempPowerSystem: string;
}

export interface OutlineHandlers {
  handleInsertVolume: (volIdx: number) => void;
  handleDeleteVolume: (volIdx: number) => void;
  handleMoveVolume: (volIdx: number, direction: 'up' | 'down') => void;
  handleInsertChapter: (volIdx: number, chapIdx: number) => void;
  handleDeleteChapter: (volIdx: number, chapIdx: number) => void;
  handleMoveChapter: (volIdx: number, chapIdx: number, direction: 'up' | 'down') => void;
  handleSelectRecommendedOutline: (opt: { description?: string }) => Promise<void>;
  handleAiRegenChapter: (volIdx: number, chapIdx: number) => Promise<void>;
  handleAiRegenVolume: (volIdx: number, userHint?: string) => Promise<void>;
  toggleLockVolume: (volIdx: number) => void;
  toggleLockChapter: (volIdx: number, chapIdx: number) => void;
  saveVolumeEditing: () => void;
  saveChapterEditing: () => void;
  totalChapters: number;
  completionRate: number;
  getFilteredRules: (material: string) => any[];
}

export function useOutlineHandlers(params: OutlineHandlersParams): OutlineHandlers {
  const {
    store,
    callAIApi,
    localSections, setLocalSections,
    setTempOutlineFull,
    editingVolumeIdx, setEditingVolumeIdx, editVolumeForm, setEditVolumeForm,
    editingChapterPath, setEditingChapterPath, editChapterForm, setEditChapterForm,
    aiAbortRef, setRegeningIndex, setRegeningVolumeIdx,
    pushAiUndo, flatChapters,
    tempWorldSetting, tempCoreConflict, tempPowerSystem,
  } = params;

  // 增删移位卷/章节后通用：重排序号并同步 markdown
  const syncSections = useCallback((sections: OutlineVolume[]) => {
    const renumbered = renumberVolumesAndChapters(sections);
    setLocalSections(renumbered);
    setTempOutlineFull(generateMarkdownFromSections(renumbered));
  }, [setLocalSections, setTempOutlineFull]);

  // 添加新分卷
  const handleInsertVolume = useCallback((volIdx: number) => {
    const newVol: OutlineVolume = {
      title: '新分卷',
      content: '规划本分卷的剧烈矛盾、转折爆发与核心高潮走向...',
      chapters: []
    };
    const newSections = [...localSections];
    newSections.splice(volIdx + 1, 0, newVol);
    syncSections(newSections);
  }, [localSections, syncSections]);

  // 删除分卷
  const handleDeleteVolume = useCallback((volIdx: number) => {
    store.showConfirm('确定要删除该分卷吗？删除分卷会连同删除该分卷下的所有章节！', () => {
      const newSections = [...localSections];
      newSections.splice(volIdx, 1);
      syncSections(newSections);
      if (editingVolumeIdx === volIdx) {
        setEditingVolumeIdx(null);
        setEditVolumeForm(null);
      }
    });
  }, [localSections, syncSections, editingVolumeIdx, setEditingVolumeIdx, setEditVolumeForm, store]);

  // 分卷位置上下移位
  const handleMoveVolume = useCallback((volIdx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && volIdx === 0) return;
    if (direction === 'down' && volIdx === localSections.length - 1) return;

    const targetIdx = direction === 'up' ? volIdx - 1 : volIdx + 1;
    const newSections = [...localSections];
    const temp = newSections[volIdx];
    newSections[volIdx] = newSections[targetIdx];
    newSections[targetIdx] = temp;
    syncSections(newSections);
  }, [localSections, syncSections]);

  // 插入章节细纲
  const handleInsertChapter = useCallback((volIdx: number, chapIdx: number) => {
    const newSec: OutlineChapter = {
      title: '新章节',
      content: '本章具体发生的剧情细节交代，核心博弈走向...',
      details: [
        { key: '核心冲突', value: '本章的具体纠葛' },
        { key: '信息释放', value: '揭示的内容或埋藏伏笔' },
        { key: '情绪曲线', value: '铺垫(45%)' },
        { key: '相关人物', value: '主角' }
      ]
    };
    const insertIdx = chapIdx < 0 ? localSections[volIdx].chapters.length : chapIdx + 1;
    const newSections = localSections.map((vol, vIdx) => {
      if (vIdx !== volIdx) return vol;
      const newChapters = [...vol.chapters];
      newChapters.splice(insertIdx, 0, newSec);
      return { ...vol, chapters: newChapters };
    });
    syncSections(newSections);
  }, [localSections, syncSections]);

  // 删除某章细纲
  const handleDeleteChapter = useCallback((volIdx: number, chapIdx: number) => {
    store.showConfirm('确定要删除本章节大纲吗？此后序号会自动全书重新递增。', () => {
      const newSections = localSections.map((vol, vIdx) => {
        if (vIdx !== volIdx) return vol;
        const newChapters = [...vol.chapters];
        newChapters.splice(chapIdx, 1);
        return { ...vol, chapters: newChapters };
      });
      syncSections(newSections);
      if (editingChapterPath && editingChapterPath.volIdx === volIdx && editingChapterPath.chapIdx === chapIdx) {
        setEditingChapterPath(null);
        setEditChapterForm(null);
      }
    });
  }, [localSections, syncSections, editingChapterPath, setEditingChapterPath, setEditChapterForm, store]);

  // 章节位置上下移位
  const handleMoveChapter = useCallback((volIdx: number, chapIdx: number, direction: 'up' | 'down') => {
    const chapters = localSections[volIdx].chapters;
    if (direction === 'up' && chapIdx === 0) return;
    if (direction === 'down' && chapIdx === chapters.length - 1) return;

    const targetIdx = direction === 'up' ? chapIdx - 1 : chapIdx + 1;
    const newSections = localSections.map((vol, vIdx) => {
      if (vIdx !== volIdx) return vol;
      const newChapters = [...vol.chapters];
      const temp = newChapters[chapIdx];
      newChapters[chapIdx] = newChapters[targetIdx];
      newChapters[targetIdx] = temp;
      return { ...vol, chapters: newChapters };
    });
    syncSections(newSections);
  }, [localSections, syncSections]);

  // 选用推荐大纲时执行层次化智能合并
  const handleSelectRecommendedOutline = useCallback(async (opt: { description?: string }) => {
    const optDesc = opt.description || '';
    const newSections = parseStructureOutline(optDesc);
    const oldSections = localSections;

    // 智能锁定合并：打平旧大纲包含的所有章节，保留锁定态与其归属卷索引
    const oldFlat: (OutlineChapter & { volIdx: number })[] = [];
    oldSections.forEach((vol, vIdx) => {
      vol.chapters.forEach(ch => {
        oldFlat.push({ ...ch, volIdx: vIdx });
      });
    });

    const newFlat: OutlineChapter[] = [];
    newSections.forEach(vol => {
      vol.chapters.forEach(ch => {
        newFlat.push(ch);
      });
    });

    // 交叉合并
    const mergedFlat: (OutlineChapter & { volIdx?: number })[] = newFlat.map((newCh, idx) => {
      const oldCh = oldFlat[idx];
      if (oldCh && oldCh.isLocked) {
        return oldCh;
      }
      return newCh;
    });

    // 追加保留多余章节里已被锁定的
    if (oldFlat.length > newFlat.length) {
      for (let i = newFlat.length; i < oldFlat.length; i++) {
        if (oldFlat[i].isLocked) {
          mergedFlat.push(oldFlat[i]);
        }
      }
    }

    // 恢复树状层级：清空旧大纲章节并回填
    const mergedVolumes: OutlineVolume[] = oldSections.map(vol => ({
      ...vol,
      chapters: []
    }));

    mergedFlat.forEach(ch => {
      let targetVolIdx = ch.volIdx !== undefined ? ch.volIdx : mergedVolumes.length - 1;
      while (targetVolIdx >= mergedVolumes.length) {
        mergedVolumes.push({
          title: '新分卷',
          content: '',
          chapters: []
        });
      }
      if (targetVolIdx < 0) {
        targetVolIdx = 0;
      }
      mergedVolumes[targetVolIdx].chapters.push({
        title: ch.title,
        content: ch.content,
        details: ch.details,
        isLocked: ch.isLocked
      });
    });

    syncSections(mergedVolumes);

    if (store.currentProject) {
      try {
        const md = generateMarkdownFromSections(renumberVolumesAndChapters(mergedVolumes));
        await store.updateProject(store.currentProject.id, { outlineFull: md });
        alert('已选用新推荐大纲并完成层次合并，锁定的章节和大纲卷归属已完好保留！');
      } catch (e) {
        alert('推荐大纲合并保存失败');
      }
    }
  }, [localSections, store, syncSections]);

  // AI 智能重写单章 Beat
  const handleAiRegenChapter = useCallback(async (volIdx: number, chapIdx: number) => {
    if (!store.currentProject) return;
    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;
    const globalIdx = flatChapters.findIndex(ch => ch.volIdx === volIdx && ch.chapIdx === chapIdx);
    setRegeningIndex(globalIdx);
    try {
      const sec = localSections[volIdx].chapters[chapIdx];
      const prompt = `你是一个资深网络小说剧情策划。请为我的小说《${store.currentProject.title}》重新规划设计【${sec.title}】的详细章节细纲。

【当前小说设定】:
- 书名: ${store.currentProject.title}
- 简介: ${tempWorldSetting || store.currentProject.worldSetting || '暂无'}
- 题材/核心冲突: ${tempCoreConflict || store.currentProject.coreConflict || '暂无'}

【其他相邻章节的上下文大纲】:
${flatChapters.map((s, sIdx) => sIdx !== globalIdx ? `- ${s.title}: ${s.content}` : '').filter(Boolean).slice(Math.max(0, globalIdx - 2), globalIdx + 3).join('\n')}

请详细为本章设计新的剧情细纲。必须以如下格式直接输出，不要输出任何多余的引言、前言或分析解释：
## ${sec.title}
本章剧情推进：在此处写一小段对本章核心故事情节的叙述，约100字。
- **核心冲突**：本章内具体的矛盾博弈或突发争执。
- **信息释放**：本章中交代泄漏的新伏笔或解开的旧秘密。
- **情绪曲线**：从压抑到爽快的情绪过渡比，如：高潮(85%)。
- **相关人物**：本章出场的角色名。`;

      const res = await callAIApi({
        action: 'chat',
        projectId: store.currentProject.id,
        query: prompt
      }, controller.signal);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const reply = data.reply;
      const parsedRegen = parseStructureOutline(reply);
      let newCh: OutlineChapter | null = null;
      for (const vol of parsedRegen) {
        if (vol.chapters.length > 0) {
          newCh = vol.chapters[0];
          break;
        }
      }
      if (newCh) {
        const mergedCh = {
          ...newCh,
          title: sec.title,
          isLocked: sec.isLocked
        };
        const newSections = localSections.map((vol, vIdx) => {
          if (vIdx !== volIdx) return vol;
          const newChapters = [...vol.chapters];
          newChapters[chapIdx] = mergedCh;
          return { ...vol, chapters: newChapters };
        });

        const md = generateMarkdownFromSections(newSections);
        setLocalSections(newSections);
        setTempOutlineFull(md);
        pushAiUndo({
          type: 'chapter',
          label: sec.title,
          restore: () => {
            const prevSections = localSections.map((vol, vIdx) => {
              if (vIdx !== volIdx) return vol;
              const prevChapters = [...vol.chapters];
              prevChapters[chapIdx] = sec;
              return { ...vol, chapters: prevChapters };
            });
            setLocalSections(prevSections);
            setTempOutlineFull(generateMarkdownFromSections(prevSections));
          }
        });
      } else {
        throw new Error('AI 生成的章节大纲格式有误，未能成功解析');
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        alert('AI 单章重写失败: ' + e.message);
      }
    } finally {
      if (aiAbortRef.current === controller) {
        aiAbortRef.current = null;
        setRegeningIndex(null);
      }
    }
  }, [store, callAIApi, aiAbortRef, flatChapters, localSections, setLocalSections, setTempOutlineFull, setRegeningIndex, pushAiUndo, tempWorldSetting, tempCoreConflict]);

  // AI 推演分卷走向大纲
  const handleAiRegenVolume = useCallback(async (volIdx: number, userHint?: string) => {
    if (!store.currentProject) return;
    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;
    setRegeningVolumeIdx(volIdx);
    try {
      const vol = localSections[volIdx];
      const userHintSection = userHint?.trim()
        ? `\n\n【用户对本卷的推演要求】：\n${userHint.trim()}\n请在推演时充分考虑以上要求。`
        : '';
      const prompt = `你是一个网络小说金牌策划和商业剧情架构大师。请为我的小说《${store.currentProject.title}》推演和重新设计【${vol.title}】的整体剧情大纲走向与本卷核心看点。

【当前小说设定】:
- 书名: ${store.currentProject.title}
- 核心冲突: ${tempCoreConflict || store.currentProject.coreConflict || '暂无描述'}
- 世界观: ${tempWorldSetting || store.currentProject.worldSetting || '暂无'}
- 境界体系: ${tempPowerSystem || store.currentProject.powerSystem || '暂无'}

【其他分卷的上下文大纲】:
${localSections.map((v, vIdx) => vIdx !== volIdx ? `- ${v.title}: ${v.content}` : '').filter(Boolean).join('\n')}
${userHintSection}
请直接输出推荐的【${vol.title}】的卷概要走向描述（字数在150字到250字之间），不需要输出任何标题、多余的说明前言或分析，直接给出描述即可。`;

      const res = await callAIApi({
        action: 'chat',
        projectId: store.currentProject.id,
        query: prompt
      }, controller.signal);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const reply = data.reply.trim();
      if (reply) {
        const newSections = localSections.map((v, vIdx) =>
          vIdx === volIdx ? { ...v, content: reply } : v
        );
        setLocalSections(newSections);
        const md = generateMarkdownFromSections(newSections);
        setTempOutlineFull(md);
        pushAiUndo({
          type: 'volume',
          label: vol.title,
          restore: () => {
            const prevSections = localSections.map((v, vIdx) =>
              vIdx === volIdx ? { ...v, content: vol.content } : v
            );
            setLocalSections(prevSections);
            setTempOutlineFull(generateMarkdownFromSections(prevSections));
          }
        });
      } else {
        throw new Error('AI 未能返回有效的生成数据');
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        alert(`AI 推演分卷走向失败: ` + e.message);
      }
    } finally {
      if (aiAbortRef.current === controller) {
        aiAbortRef.current = null;
        setRegeningVolumeIdx(null);
      }
    }
  }, [store, callAIApi, aiAbortRef, localSections, setLocalSections, setTempOutlineFull, setRegeningVolumeIdx, pushAiUndo, tempWorldSetting, tempCoreConflict, tempPowerSystem]);

  // 切换分卷的锁定标记
  const toggleLockVolume = useCallback((volIdx: number) => {
    const newSections = localSections.map((vol, vIdx) =>
      vIdx === volIdx ? { ...vol, isLocked: !vol.isLocked } : vol
    );
    syncSections(newSections);
  }, [localSections, syncSections]);

  // 切换章节锁定标记
  const toggleLockChapter = useCallback((volIdx: number, chapIdx: number) => {
    const newSections = localSections.map((vol, vIdx) => {
      if (vIdx !== volIdx) return vol;
      const newChapters = vol.chapters.map((ch, cIdx) =>
        cIdx === chapIdx ? { ...ch, isLocked: !ch.isLocked } : ch
      );
      return { ...vol, chapters: newChapters };
    });
    syncSections(newSections);
  }, [localSections, syncSections]);

  // 保存分卷大纲修改
  const saveVolumeEditing = useCallback(() => {
    if (editingVolumeIdx === null || !editVolumeForm) return;
    const newSections = [...localSections];
    newSections[editingVolumeIdx] = editVolumeForm;
    syncSections(newSections);
    setEditingVolumeIdx(null);
    setEditVolumeForm(null);
  }, [editingVolumeIdx, editVolumeForm, localSections, syncSections, setEditingVolumeIdx, setEditVolumeForm]);

  // 保存章节大纲修改
  const saveChapterEditing = useCallback(() => {
    if (editingChapterPath === null || !editChapterForm) return;
    const { volIdx, chapIdx } = editingChapterPath;
    const newSections = localSections.map((vol, vIdx) => {
      if (vIdx !== volIdx) return vol;
      const newChapters = [...vol.chapters];
      newChapters[chapIdx] = editChapterForm;
      return { ...vol, chapters: newChapters };
    });
    syncSections(newSections);
    setEditingChapterPath(null);
    setEditChapterForm(null);
  }, [editingChapterPath, editChapterForm, localSections, syncSections, setEditingChapterPath, setEditChapterForm]);

  // 统计
  const totalChapters = useMemo(
    () => localSections.reduce((sum, vol) => sum + (vol.chapters ? vol.chapters.length : 0), 0),
    [localSections]
  );
  const lockedChapters = useMemo(
    () => localSections.reduce((sum, vol) => sum + (vol.chapters ? vol.chapters.filter(ch => ch.isLocked).length : 0), 0),
    [localSections]
  );
  const completionRate = totalChapters > 0 ? Math.round((lockedChapters / totalChapters) * 100) : 0;

  // 世界规则筛选映射
  const getFilteredRules = useCallback((material: string) => {
    if (!store.worldRules) return [];

    if (material === 'location') return store.worldRules.filter((r: any) => r.type === 'location');
    if (material === 'faction') return store.worldRules.filter((r: any) => r.type === 'faction');
    if (material === 'item') return store.worldRules.filter((r: any) => r.type === 'item');

    if (material === 'currency') return store.worldRules.filter((r: any) => r.type === 'rule' && r.name.includes('货币'));
    if (material === 'skillSystem') return store.worldRules.filter((r: any) => r.type === 'rule' && (r.name.includes('功法') || r.name.includes('技能') || r.name.includes('修炼') || r.name.includes('体系')));
    if (material === 'timeline') return store.worldRules.filter((r: any) => r.type === 'rule' && r.name.includes('时间线'));

    if (material === 'foreshadow') return store.worldRules.filter((r: any) => r.type === 'other' && r.name.includes('伏笔'));
    if (material === 'plot') return store.worldRules.filter((r: any) => r.type === 'other' && (r.name.includes('情节') || r.name.includes('脉络')));
    if (material === 'subPlot') return store.worldRules.filter((r: any) => r.type === 'other' && r.name.includes('支线'));
    if (material === 'events') return store.worldRules.filter((r: any) => r.type === 'other' && r.name.includes('事件'));
    if (material === 'relation') return store.worldRules.filter((r: any) => r.type === 'other' && r.name.includes('关系'));

    return store.worldRules;
  }, [store.worldRules]);

  return {
    handleInsertVolume,
    handleDeleteVolume,
    handleMoveVolume,
    handleInsertChapter,
    handleDeleteChapter,
    handleMoveChapter,
    handleSelectRecommendedOutline,
    handleAiRegenChapter,
    handleAiRegenVolume,
    toggleLockVolume,
    toggleLockChapter,
    saveVolumeEditing,
    saveChapterEditing,
    totalChapters,
    completionRate,
    getFilteredRules,
  };
}
