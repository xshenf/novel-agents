import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { interrupt } from '@langchain/langgraph';
import { db } from '../../db';
import { searchMemory } from '../../memory';

// Re-export outline parser types used by other tool files
export type { OutlineVolume, OutlineChapter } from '../../outlineParser';
export { parseStructureOutline, generateMarkdownFromSections } from '../../outlineParser';

// 锁定项的破坏性操作：用 LangGraph interrupt 暂停整张图，等待用户经 Command({resume}) 回传决定。
// resume 传 true / 'confirm' / 'yes' 视为确认继续，其它（含 false / 取消）一律视为取消。
// 关键：必须在真正写库的副作用之前调用——resume 会让工具从头重跑，确认后写库只执行一次。
export function confirmLockedAction(action: string, target: string): boolean {
  const decision = interrupt({ type: 'confirm_locked', action, target }) as unknown;
  return decision === true || decision === 'confirm' || decision === 'yes';
}

// ─── 1. 查询记忆 ─────────────────────────────────────────────────────────────
export const queryMemoryTool = tool(
  async ({ projectId, query }) => {
    const result = await searchMemory(projectId, query);
    return result.contextText || '未找到相关记忆内容。';
  },
  {
    name: 'query_memory',
    description: '检索小说前文记忆，包括章节摘要、人物状态和世界观设定，用于回答关于前文内容的问题。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
      query: z.string().describe('要检索的问题或关键词'),
    }),
  }
);

// ─── 2. 获取项目概览 ──────────────────────────────────────────────────────────
export const getProjectOverviewTool = tool(
  async ({ projectId }) => {
    const project = await db.getProject(projectId);
    if (!project) return '未找到该项目。';
    const characters = await db.getCharacters(projectId);
    const chapters = await db.getChapters(projectId);
    const worldRules = await db.getWorldRules(projectId);

    return JSON.stringify({
      title: project.title,
      description: project.description,
      styleSetting: project.styleSetting,
      worldSetting: project.worldSetting,
      powerSystem: project.powerSystem || '',
      coreConflict: project.coreConflict || '',
      sellingPoints: project.sellingPoints || '',
      characterCount: characters.length,
      chapterCount: chapters.length,
      worldRuleCount: worldRules.length,
      characters: characters.map(c => ({ name: c.name, role: c.role })),
      recentChapters: chapters.slice(-3).map(c => ({ title: c.title, summary: c.summary })),
    }, null, 2);
  },
  {
    name: 'get_project_overview',
    description: '获取当前小说项目的完整概览，包括设定、人物列表、章节数等基本信息。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
    }),
  }
);
