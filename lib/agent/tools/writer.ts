import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { db, type Chapter } from '../../db';
import { ai } from '../../ai';
import { syncChapterMemoryAfterWrite } from '../../chapterMemorySync';
import { getAgentConfig, getAgentModelName, agentHasKey } from '../config';

// ─── 9. 新建章节 ──────────────────────────────────────────────────────────────
export const createChapterTool = tool(
  async ({ projectId, title }) => {
    const chapter = await db.createChapter({
      projectId,
      title,
      content: '',
      summary: '',
      characterChanges: [],
      newForeshadowing: [],
      resolvedForeshadowing: [],
      timelineEvents: [],
    });
    return `章节「${title}」已创建，ID: ${chapter.id}`;
  },
  {
    name: 'create_chapter',
    description: '在当前小说中新建一个章节（只创建标题，不填写内容）。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
      title: z.string().describe('章节标题，如：第一章 初入修真界'),
    }),
  }
);

// ─── 10. 自动写作章节内容 ────────────────────────────────────────────────────
export const autoWriteChapterTool = tool(
  async ({ projectId, chapterTitle, chapterId, instruction }, config) => {
    const apiConfig = config.configurable?.apiConfig || '';
    const defaultModel = config.configurable?.modelName;
    const configStr = getAgentConfig('writer', apiConfig);
    const modelName = getAgentModelName('writer', apiConfig, defaultModel);
    const text = await ai.autoWriteChapter(
      projectId, chapterTitle, configStr, modelName, instruction || ''
    );

    // 定位目标章节：优先 chapterId，其次按标题匹配，最后新建；确保正文真正落库
    let target: Chapter | undefined;
    if (chapterId) {
      target = await db.getChapter(chapterId);
    }
    if (!target) {
      const chapters = await db.getChapters(projectId);
      target = chapters.find(c => c.title === chapterTitle);
    }
    if (target) {
      await db.updateChapter(target.id, { content: text });
    } else {
      target = await db.createChapter({
        projectId,
        title: chapterTitle,
        content: text,
        summary: '',
        characterChanges: [],
        newForeshadowing: [],
        resolvedForeshadowing: [],
        timelineEvents: [],
      });
    }

    // 写入记忆：自动提取摘要、人物状态、伏笔与时间线（仅在配置了真实 Key 时，
    // 避免用 mock 摘要污染长期记忆）。摘要失败不影响正文已保存的事实。
    let memoryNote = '';
    if (agentHasKey('writer', apiConfig)) {
      try {
        const memory = await syncChapterMemoryAfterWrite({
          projectId,
          chapterId: target.id,
          text,
          apiKey: configStr,
          modelName,
        });
        const partialWarning = memory.warnings.length > 0 ? `（${memory.warnings.join('；')}）` : '';
        memoryNote = `，并已同步更新章节摘要、角色状态与长期记忆${partialWarning}`;
      } catch (error) {
        console.warn('[agent] sync chapter memory failed:', error);
        memoryNote = '（注意：摘要生成失败，仅保存了正文）';
      }
    }

    return `章节「${chapterTitle}」正文已生成并保存（共 ${text.length} 字，章节ID: ${target.id}）${memoryNote}。\n\n正文预览：\n${text.slice(0, 400)}${text.length > 400 ? '\n\n...(完整正文已写入该章节，请在编辑器查看)' : ''}`;
  },
  {
    name: 'auto_write_chapter',
    description: '根据项目设定和章节标题，自动生成章节正文并保存到该章节（不存在则新建），同时自动提取摘要写入长期记忆。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
      chapterTitle: z.string().describe('要写作的章节标题'),
      chapterId: z.string().optional().describe('目标章节ID；已存在章节时传入以更新指定章节，不传则按标题匹配或新建'),
      instruction: z.string().optional().describe('具体写作指令，如特定情节要求、情绪基调等'),
    }),
  }
);

// ─── 13. 章节复盘：摘要与状态写入记忆 ─────────────────────────────────────────
export const summarizeChapterTool = tool(
  async ({ projectId, chapterId, text }, config) => {
    void projectId;
    const apiConfig = config.configurable?.apiConfig || '';
    const modelName = config.configurable?.modelName;
    let content = text || '';
    let target: Chapter | undefined;
    if (chapterId) {
      target = await db.getChapter(chapterId);
      if (target && !content) content = target.content;
    }
    if (!content || !content.trim()) {
      return '没有可供摘要的正文内容（请提供 text，或提供含正文的有效 chapterId）。';
    }
    const configStr = getAgentConfig('editor', apiConfig);
    const s = await ai.summarizeChapter(content, configStr, getAgentModelName('editor', apiConfig, modelName));
    if (target) {
      await db.updateChapter(target.id, {
        summary: s.summary,
        characterChanges: s.characterChanges,
        newForeshadowing: s.newForeshadowing,
        resolvedForeshadowing: s.resolvedForeshadowing,
        timelineEvents: s.timelineEvents,
      });
    }
    return `章节摘要已生成${target ? '并写入该章节的长期记忆' : ''}：\n\n${JSON.stringify(s, null, 2)}`;
  },
  {
    name: 'summarize_chapter',
    description: '提取章节正文的摘要、人物状态变化、伏笔与时间线，并写入该章节的长期记忆（对应复盘/记忆更新步骤）。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
      chapterId: z.string().optional().describe('章节ID；传入则把摘要结果写回该章节'),
      text: z.string().optional().describe('要摘要的正文；不传则使用 chapterId 对应章节的正文'),
    }),
  }
);
