import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { interrupt } from '@langchain/langgraph';
import { db } from '../../db';
import { searchMemory } from '../../memory';
import { GENRE_CATEGORIES, TONES } from '../../constants';

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

// 当项目未配置风格基调且用户未在对话中指定时，弹出选项让用户选择题材和文风。
// 使用 LangGraph interrupt 暂停图，等待前端用户选择后 resume。
export function requestStyleInput(projectId: string): { genre: string; tone: string } {
  const allGenres = GENRE_CATEGORIES.flatMap(c => c.genres.map(g => g.name));
  const allTones = TONES.map(t => t.name);
  const response = interrupt({
    type: 'request_style',
    genres: allGenres.slice(0, 12),  // 取前 12 个常用题材
    tones: allTones,
    projectId,
  }) as unknown;
  if (response && typeof response === 'object' && (response as any).genre && (response as any).tone) {
    return response as { genre: string; tone: string };
  }
  // 用户取消 → 返回空，调用方应处理
  return { genre: '', tone: '' };
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
    // 使用轻量查询，只拉取 title/summary，不查正文 content，避免长篇小说性能问题
    const chapterSummaries = await db.getChapterSummaries(projectId);
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
      chapterCount: chapterSummaries.length,
      worldRuleCount: worldRules.length,
      characters: characters.map(c => ({ name: c.name, role: c.role })),
      recentChapters: chapterSummaries.slice(-3).map(c => ({ title: c.title, summary: c.summary })),
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

// ─── 3. 请求用户选择风格基调 ───────────────────────────────────────────────────
export const requestUserStyleTool = tool(
  async ({ projectId }) => {
    const result = requestStyleInput(projectId);
    if (!result.genre || !result.tone) {
      return '用户取消了风格选择，请询问用户想要的题材和文风后再继续。';
    }
    // 保存到项目
    await db.updateProject(projectId, {
      description: result.genre,
      styleSetting: result.tone,
    });
    return `用户选择了题材「${result.genre}」和文风「${result.tone}」，已保存到项目设定。请据此继续生成世界设定。`;
  },
  {
    name: 'request_user_style',
    description: '当项目缺少题材（description）和文风（styleSetting），且用户未在对话中明确指定时，弹出选项交互让用户选择。只有确认缺少风格基调时才调用此工具。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
    }),
  }
);
