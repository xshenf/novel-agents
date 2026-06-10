import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { db, type Chapter } from '../../db';
import { ai } from '../../ai';
import { syncChapterMemoryAfterWrite } from '../../chapterMemorySync';
import { ensureChapterInOutline } from '../../chapterLinking';
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
    // 先定位目标章节（在昂贵的正文生成之前），用于防重复写防御
    let target: Chapter | undefined;
    if (chapterId) {
      target = await db.getChapter(chapterId);
    }
    if (!target) {
      const chapters = await db.getChapters(projectId);
      target = chapters.find(c => c.title === chapterTitle);
      // 防重复写：标题匹配到的章节已有正文、且调用方未显式传 chapterId 时，
      // 大概率是编导误判进度后的重复委托——拒绝覆盖，返回事实供编导汇报
      if (target && (target.content || '').trim()) {
        return `章节「${target.title}」已有正文（约 ${target.content.length} 字，章节ID: ${target.id}），本次未重复生成。该章已完成；如确需重写，请传入 chapterId 并说明重写要求；如要继续写后续章节，请使用新的章节标题。`;
      }
    }

    const apiConfig = config.configurable?.apiConfig || '';
    const defaultModel = config.configurable?.modelName;
    const configStr = getAgentConfig('writer', apiConfig);
    const modelName = getAgentModelName('writer', apiConfig, defaultModel);
    const text = await ai.autoWriteChapter(
      projectId, chapterTitle, configStr, modelName, instruction || ''
    );

    // 落库：已定位到章节则更新，否则新建
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

    // 大纲登记：前端侧栏与编导概览都按大纲结构判断章节，
    // 游离于大纲外的章节用户看不到、编导会误判"还没写"
    let outlineNote = '';
    const project = await db.getProject(projectId);
    const updatedOutline = ensureChapterInOutline(project?.outlineFull || '', chapterTitle);
    if (updatedOutline !== null) {
      await db.updateProject(projectId, { outlineFull: updatedOutline });
      outlineNote = '，并已登记进大纲';
    }

    // 写入记忆：自动提取摘要、人物状态、伏笔与时间线（仅在配置了真实 Key 时，
    // 避免用 mock 摘要污染长期记忆）。摘要失败不影响正文已保存的事实。
    let memoryNote = '';
    let consistencyNote = '';
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
        const check = memory.consistencyCheck;
        if (check) {
          if (check.passed) {
            consistencyNote = '\n\n一致性校验：通过，未发现与前文设定的矛盾。';
          } else {
            const issues = (check.issues || []).slice(0, 5).map(i => `- ${i}`).join('\n');
            const suggestions = (check.suggestions || []).slice(0, 5).map(s => `- ${s}`).join('\n');
            consistencyNote = `\n\n一致性校验：发现 ${(check.issues || []).length} 处与前文的潜在矛盾（汇报时务必向用户明确提示）：\n${issues}`;
            if (suggestions) consistencyNote += `\n修改建议：\n${suggestions}`;
          }
        }
      } catch (error) {
        console.warn('[agent] sync chapter memory failed:', error);
        memoryNote = '（注意：摘要生成失败，仅保存了正文）';
      }
    }

    return `章节「${chapterTitle}」正文已生成并保存（共 ${text.length} 字，章节ID: ${target.id}）${outlineNote}${memoryNote}。${consistencyNote}\n\n正文预览：\n${text.slice(0, 400)}${text.length > 400 ? '\n\n...(完整正文已写入该章节，请在编辑器查看)' : ''}`;
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
