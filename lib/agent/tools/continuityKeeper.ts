import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ai } from '../../ai';
import { db } from '../../db';
import { getAgentConfig, getAgentModelName } from '../config';

// ─── 章节摘要与状态提取 ─────────────────────────────────────────────────────────────
export const summarizeChapterTool = tool(
  async ({ projectId, chapterId, text }, config) => {
    const apiConfig = config.configurable?.apiConfig || '';
    const modelName = config.configurable?.modelName || 'gemini-2.5-flash';
    const configStr = getAgentConfig('continuity_keeper', apiConfig);
    const result = await ai.summarizeChapter(text, configStr, getAgentModelName('continuity_keeper', apiConfig, modelName));

    // 将摘要结果写入章节
    if (chapterId) {
      await db.updateChapter(chapterId, {
        summary: result.summary,
        characterChanges: result.characterChanges,
        newForeshadowing: result.newForeshadowing,
        resolvedForeshadowing: result.resolvedForeshadowing,
        timelineEvents: result.timelineEvents,
      });
    }

    return JSON.stringify(result, null, 2);
  },
  {
    name: 'summarize_chapter',
    description: '分析章节正文，提取摘要、人物状态变化、新伏笔、已回收伏笔、时间线事件。如果提供了 chapterId，会自动将结果保存到数据库。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
      chapterId: z.string().optional().describe('章节ID，提供时会自动保存结果到数据库'),
      text: z.string().describe('要分析的章节正文'),
    }),
  }
);

// ─── 逻辑一致性检查 ─────────────────────────────────────────────────────────────────
export const checkConsistencyTool = tool(
  async ({ projectId, text }, config) => {
    const apiConfig = config.configurable?.apiConfig || '';
    const modelName = config.configurable?.modelName || 'gemini-2.5-flash';
    const configStr = getAgentConfig('continuity_keeper', apiConfig);
    const result = await ai.checkConsistency(projectId, text, configStr, getAgentModelName('continuity_keeper', apiConfig, modelName));
    return JSON.stringify(result, null, 2);
  },
  {
    name: 'check_consistency',
    description: '对章节内容进行逻辑自检，检查人物行为、世界观、时间线、伏笔是否与前文一致。返回 { passed, issues, suggestions }。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
      text: z.string().describe('要检查的章节文本'),
    }),
  }
);

// ─── 更新滚动概要 ─────────────────────────────────────────────────────────────────
export const updateRollingSynopsisTool = tool(
  async ({ projectId }, config) => {
    const apiConfig = config.configurable?.apiConfig || '';
    const modelName = config.configurable?.modelName || 'gemini-2.5-flash';
    const configStr = getAgentConfig('continuity_keeper', apiConfig);
    const rollingSynopsis = await ai.updateRollingSynopsis(projectId, configStr, getAgentModelName('continuity_keeper', apiConfig, modelName));
    await db.updateProject(projectId, { rollingSynopsis });
    return `滚动概要已更新，当前长度: ${rollingSynopsis.length} 字`;
  },
  {
    name: 'update_rolling_synopsis',
    description: '更新全书滚动剧情概要。会在已有概要基础上折叠最新章节摘要，保证 LLM 输入有界。结果自动保存到项目。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
    }),
  }
);

// ─── 更新世界状态台账 ─────────────────────────────────────────────────────────────
export const updateWorldStateTool = tool(
  async ({ projectId }, config) => {
    const apiConfig = config.configurable?.apiConfig || '';
    const modelName = config.configurable?.modelName || 'gemini-2.5-flash';
    const configStr = getAgentConfig('continuity_keeper', apiConfig);
    const items = await ai.updateWorldState(projectId, configStr, getAgentModelName('continuity_keeper', apiConfig, modelName));
    await db.replaceAutoWorldStates(projectId, items);
    return `世界状态台账已更新，共 ${items.length} 条条目`;
  },
  {
    name: 'update_world_state',
    description: '更新世界状态台账：基于滚动概要和最近章节摘要，让 AI 输出更新后的非锁定条目（势力格局、主角境界、当前所在地、时间进度等）。结果自动保存到数据库。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
    }),
  }
);

// ─── 获取章节写作约束 ─────────────────────────────────────────────────────────────
export const getChapterConstraintsTool = tool(
  async ({ projectId, chapterTitle }, config) => {
    const [project, chapters, worldStates, characters] = await Promise.all([
      db.getProject(projectId),
      db.getChapters(projectId),
      db.getWorldStates(projectId),
      db.getCharacters(projectId),
    ]);

    const constraints: string[] = [];

    // 1. 未兑现伏笔
    const allForeshadowing = chapters.flatMap(c => c.newForeshadowing || []);
    const resolvedForeshadowing = chapters.flatMap(c => c.resolvedForeshadowing || []);
    const unresolved = allForeshadowing.filter(f => !resolvedForeshadowing.some(r => r.includes(f) || f.includes(r)));
    if (unresolved.length > 0) {
      constraints.push(`【未兑现伏笔】（共 ${unresolved.length} 条，请注意在合适时机回收）：\n${unresolved.slice(-10).map(f => `- ${f}`).join('\n')}`);
    }

    // 2. 最近章节时间线
    const recentChapters = chapters.slice(-5);
    const recentTimeline = recentChapters.flatMap(c => c.timelineEvents || []);
    if (recentTimeline.length > 0) {
      constraints.push(`【最近时间线】：\n${recentTimeline.map(t => `- ${t}`).join('\n')}`);
    }

    // 3. 关键角色当前状态
    const activeChars = characters.filter(c => c.currentState && c.currentState.trim());
    if (activeChars.length > 0) {
      constraints.push(`【关键角色状态】：\n${activeChars.slice(0, 8).map(c => `- ${c.name}：${c.currentState}`).join('\n')}`);
    }

    // 4. 锁定的世界状态
    const pinnedStates = worldStates.filter(s => s.pinned);
    if (pinnedStates.length > 0) {
      constraints.push(`【已锁定世界设定（不可违背）】：\n${pinnedStates.map(s => `- [${s.category}] ${s.name}：${s.content}`).join('\n')}`);
    }

    // 5. 滚动概要（最新剧情走向）
    const rolling = (project?.rollingSynopsis || '').trim();
    if (rolling) {
      constraints.push(`【全书剧情脉络】：\n${rolling.slice(-600)}`);
    }

    const header = `=== 「${chapterTitle || '下一章'}」写作约束清单 ===`;
    return constraints.length > 0
      ? `${header}\n\n${constraints.join('\n\n')}`
      : `${header}\n\n暂无特殊约束，请基于大纲和设定自由发挥。`;
  },
  {
    name: 'get_chapter_constraints',
    description: '获取指定章节的「不可违背事项」清单，包括：未兑现伏笔、最近时间线、角色当前状态、锁定世界设定、全书剧情脉络。写作前应调用此工具。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
      chapterTitle: z.string().optional().describe('即将写作的章节标题'),
    }),
  }
);
