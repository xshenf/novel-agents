import { tool } from '@langchain/core/tools';
import { RunnableConfig } from '@langchain/core/runnables';
import { z } from 'zod';
import { db } from '../../db';
import { ai } from '../../ai';
import { SETTING_LENGTH_GUIDE } from '../../constants';
import { getAgentConfig, getAgentModelName } from '../config';
import {
  confirmLockedAction,
  parseStructureOutline,
  generateMarkdownFromSections,
  type OutlineVolume,
  type OutlineChapter,
} from './shared';

// ─── 3. 生成章节大纲 ──────────────────────────────────────────────────────────
export const generateOutlineTool = tool(
  async ({ projectId, numChapters }, config) => {
    const apiConfig = config.configurable?.apiConfig || '';
    const modelName = config.configurable?.modelName || 'gemini-2.5-flash';
    const project = await db.getProject(projectId);
    if (!project) return '未找到该项目。';
    const configStr = getAgentConfig('planner', apiConfig);
    const outline = await ai.generateOutline(
      projectId, project.title, project.description, numChapters, configStr, getAgentModelName('planner', apiConfig, modelName)
    );
    // 持久化到项目大纲字段，避免「只生成不保存」
    await db.updateProject(projectId, { outlineFull: outline });
    return `已生成并保存接下来 ${numChapters} 章的大纲到项目大纲（outlineFull）：\n\n${outline}`;
  },
  {
    name: 'generate_outline',
    description: '根据小说设定，为故事生成详细的章节大纲。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
      numChapters: z.number().int().min(1).max(50).default(10).describe('要生成的章节数量'),
    }),
  }
);

// ─── 4. 一键规划书籍核心设定 ──────────────────────────────────────────────────
export const autoPlanBookTool = tool(
  async ({ projectId, genre, tone, tags }, config) => {
    const apiConfig = config.configurable?.apiConfig || '';
    const modelName = config.configurable?.modelName || 'gemini-2.5-flash';
    const configStr = getAgentConfig('planner', apiConfig);
    const result = await ai.autoPlanBook(genre, tone, tags, configStr, getAgentModelName('planner', apiConfig, modelName));
    // 同时更新项目设定
    if (projectId && result) {
      const r = result as Record<string, unknown>;
      const updates: Record<string, unknown> = {};
      if (r.title) updates.title = r.title;
      if (r.description) updates.description = r.description;
      if (r.styleSetting) updates.styleSetting = r.styleSetting;
      if (r.worldSetting) updates.worldSetting = r.worldSetting;
      if (r.powerSystem) updates.powerSystem = r.powerSystem;
      if (r.coreConflict) updates.coreConflict = r.coreConflict;
      if (r.sellingPoints) updates.sellingPoints = r.sellingPoints;
      if (Object.keys(updates).length > 0) {
        await db.updateProject(projectId, updates);
      }
    }
    return `书籍核心设定已生成并保存：\n\n${JSON.stringify(result, null, 2)}`;
  },
  {
    name: 'auto_plan_book',
    description: '根据体裁、风格和标签，一键自动规划并生成完整的书籍核心设定（书名、简介、世界观、能力体系、核心冲突、卖点），并保存到项目中。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
      genre: z.string().describe('小说体裁，例如：都市、玄幻、仙侠、科幻、历史'),
      tone: z.string().describe('写作风格，例如：热血爽文、轻松幽默、黑暗沉重、浪漫唯美'),
      tags: z.array(z.string()).default([]).describe('额外标签，例如：["系统流", "穿越", "重生"]'),
    }),
  }
);

// ─── 5. 生成内核设定 ──────────────────────────────────────────────────────────
export const generateKernelTool = tool(
  async ({ projectId, genre, tone }, config) => {
    const apiConfig = config.configurable?.apiConfig || '';
    const modelName = config.configurable?.modelName || 'gemini-2.5-flash';
    const project = await db.getProject(projectId);
    if (!project) return '未找到该项目。';
    const configStr = getAgentConfig('planner', apiConfig);
    const result = await ai.generateKernelSettings(project.title, genre, tone, configStr, getAgentModelName('planner', apiConfig, modelName));
    // 保存到项目
    const updates: Record<string, unknown> = {};
    if (result.powerSystem) updates.powerSystem = result.powerSystem;
    if (result.goldFinger) updates.goldFinger = result.goldFinger;
    if (result.coreConflict) updates.coreConflict = result.coreConflict;
    if (result.factionsMap) updates.factionsMap = result.factionsMap;
    if (result.sellingPoints) updates.sellingPoints = result.sellingPoints;
    if (Object.keys(updates).length > 0) {
      await db.updateProject(projectId, updates);
    }
    return `内核设定已生成并保存：\n\n${JSON.stringify(result, null, 2)}`;
  },
  {
    name: 'generate_kernel',
    description: '为小说生成核心内核设定，包括金手指、能力体系、核心冲突、势力图、卖点。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
      genre: z.string().describe('小说体裁'),
      tone: z.string().describe('写作风格'),
    }),
  }
);

// ─── 8. 更新项目设定字段 ──────────────────────────────────────────────────────
export const updateProjectFieldTool = tool(
  async ({ projectId, field, value }) => {
    const allowedFields = [
      'title', 'description', 'styleSetting', 'worldSetting',
      'powerSystem', 'goldFinger', 'coreConflict', 'factionsMap',
      'sellingPoints', 'forbiddenSetting'
    ];
    if (!allowedFields.includes(field)) {
      return `不允许修改字段 "${field}"，可用字段：${allowedFields.join(', ')}`;
    }
    await db.updateProject(projectId, { [field]: value });
    return `项目设定「${field}」已更新。`;
  },
  {
    name: 'update_project_field',
    description: '更新小说项目的全局核心设定字段。注意：此处仅用于宏观全局的框架设定，如果需要添加具体的微观设定要素（如具体的门派详情、地名历史、法宝细节），请使用 create_world_rule 工具，不要污染此处的全局宏观字段。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
      field: z.string().describe('要更新的字段名，可选：title, description, styleSetting, worldSetting, powerSystem, goldFinger, coreConflict, factionsMap, sellingPoints, forbiddenSetting'),
      value: z.string().describe(`新的字段值，按设定维度控制篇幅（${SETTING_LENGTH_GUIDE}）`),
    }),
  }
);

// ─── 14. 添加反 AI 写作规则 ───────────────────────────────────────────────────
export const addAntiAiRuleTool = tool(
  async ({ projectId, rule }) => {
    const project = await db.getProject(projectId);
    if (!project) return '未找到该项目。';
    const currentRules = project.antiAiStyleRules || [];
    if (currentRules.includes(rule)) {
      return `规则「${rule}」已存在，无需重复添加。`;
    }
    await db.updateProject(projectId, { antiAiStyleRules: [...currentRules, rule] });
    return `反 AI 写作规则「${rule}」已添加，当前共 ${currentRules.length + 1} 条规则。`;
  },
  {
    name: 'add_anti_ai_rule',
    description: '添加一条写作风格规则，用于防止 AI 生成内容出现机械化模式（如：禁止"时光荏苒"等滥用词汇）。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
      rule: z.string().describe('要添加的反 AI 写作规则'),
    }),
  }
);

// ─── 16. 获取大纲结构 ────────────────────────────────────────────────────────
export const getOutlineStructureTool = tool(
  async ({ projectId }) => {
    const project = await db.getProject(projectId);
    if (!project) return '未找到该项目。';
    const outlineFull = project.outlineFull || '';
    if (!outlineFull.trim()) return '当前项目还没有大纲。';

    const volumes = parseStructureOutline(outlineFull);
    if (volumes.length === 0) return '当前项目还没有大纲。';

    const result = volumes.map((vol, vi) => {
      const chapters = vol.chapters.map((ch, ci) => {
        const details = ch.details.map(d => `${d.key}: ${d.value}`).join('; ');
        return `  章节${ci + 1}: ${ch.title}${ch.isLocked ? ' [已锁定]' : ''}${ch.content ? ' - ' + ch.content.slice(0, 80) : ''}${details ? ' | ' + details : ''}`;
      }).join('\n');
      return `分卷${vi + 1}: ${vol.title}${vol.isLocked ? ' [已锁定]' : ''}${vol.content ? '\n  概要: ' + vol.content.slice(0, 120) : ''}${chapters ? '\n' + chapters : ''}`;
    }).join('\n\n');

    return result;
  },
  {
    name: 'get_outline_structure',
    description: '获取当前小说项目的结构化大纲，以分卷-章节树形结构返回，包含标题、概要、锁定状态等。用于了解当前大纲全貌后再做增删改操作。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
    }),
  }
);

// ─── 17. 添加分卷 ────────────────────────────────────────────────────────────
export const addVolumeTool = tool(
  async ({ projectId, title, content, position }) => {
    const project = await db.getProject(projectId);
    if (!project) return '未找到该项目。';
    const volumes = parseStructureOutline(project.outlineFull || '');
    const newVol: OutlineVolume = { title, content: content || '', chapters: [], isLocked: false };
    if (position !== undefined && position >= 0 && position <= volumes.length) {
      volumes.splice(position, 0, newVol);
    } else {
      volumes.push(newVol);
    }
    const md = generateMarkdownFromSections(volumes);
    await db.updateProject(projectId, { outlineFull: md });
    return `分卷「${title}」已添加${position !== undefined ? `到第${position + 1}位` : '到末尾'}，当前共${volumes.length}个分卷。`;
  },
  {
    name: 'add_volume',
    description: '在大纲中添加一个新的分卷。可指定插入位置，不指定则添加到末尾。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
      title: z.string().describe('分卷标题，如：第二卷：风云际会'),
      content: z.string().optional().describe('分卷概要描述'),
      position: z.number().int().optional().describe('插入位置（从0开始），不指定则添加到末尾'),
    }),
  }
);

// ─── 18. 删除分卷 ────────────────────────────────────────────────────────────
export const deleteVolumeTool = tool(
  async ({ projectId, volumeIndex }) => {
    const project = await db.getProject(projectId);
    if (!project) return '未找到该项目。';
    const volumes = parseStructureOutline(project.outlineFull || '');
    if (volumeIndex < 0 || volumeIndex >= volumes.length) {
      return `分卷索引${volumeIndex}越界，当前共${volumes.length}个分卷（索引0~${volumes.length - 1}）。`;
    }
    if (volumes[volumeIndex].isLocked && !confirmLockedAction('删除分卷', volumes[volumeIndex].title)) {
      return `已取消删除锁定分卷「${volumes[volumeIndex].title}」。`;
    }
    const removed = volumes.splice(volumeIndex, 1)[0];
    const md = generateMarkdownFromSections(volumes);
    await db.updateProject(projectId, { outlineFull: md });
    return `分卷「${removed.title}」已删除${removed.isLocked ? '（锁定项，已确认）' : ''}，剩余${volumes.length}个分卷。`;
  },
  {
    name: 'delete_volume',
    description: '删除大纲中的指定分卷（及其下所有章节）。若分卷已锁定，系统会自动暂停并请用户确认，无需也不要传任何额外的确认参数。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
      volumeIndex: z.number().int().describe('要删除的分卷索引（从0开始），可先用 get_outline_structure 查看'),
    }),
  }
);

// ─── 19. 更新分卷 ────────────────────────────────────────────────────────────
export const updateVolumeTool = tool(
  async ({ projectId, volumeIndex, title, content }) => {
    const project = await db.getProject(projectId);
    if (!project) return '未找到该项目。';
    const volumes = parseStructureOutline(project.outlineFull || '');
    if (volumeIndex < 0 || volumeIndex >= volumes.length) {
      return `分卷索引${volumeIndex}越界，当前共${volumes.length}个分卷。`;
    }
    if (volumes[volumeIndex].isLocked && !confirmLockedAction('修改分卷', volumes[volumeIndex].title)) {
      return `已取消修改锁定分卷「${volumes[volumeIndex].title}」。`;
    }
    if (title !== undefined) volumes[volumeIndex].title = title;
    if (content !== undefined) volumes[volumeIndex].content = content;
    const md = generateMarkdownFromSections(volumes);
    await db.updateProject(projectId, { outlineFull: md });
    return `分卷「${volumes[volumeIndex].title}」已更新${volumes[volumeIndex].isLocked ? '（锁定项，已确认）' : ''}。`;
  },
  {
    name: 'update_volume',
    description: '修改指定分卷的标题或概要内容。若分卷已锁定，系统会自动暂停并请用户确认，无需也不要传任何额外的确认参数。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
      volumeIndex: z.number().int().describe('分卷索引（从0开始）'),
      title: z.string().optional().describe('新的分卷标题'),
      content: z.string().optional().describe('新的分卷概要描述'),
    }),
  }
);

// ─── 20. 添加章节 ────────────────────────────────────────────────────────────
export const addChapterTool = tool(
  async ({ projectId, volumeIndex, title, content, details, position }) => {
    const project = await db.getProject(projectId);
    if (!project) return '未找到该项目。';
    const volumes = parseStructureOutline(project.outlineFull || '');
    if (volumeIndex < 0 || volumeIndex >= volumes.length) {
      return `分卷索引${volumeIndex}越界，当前共${volumes.length}个分卷。`;
    }
    const newChapter: OutlineChapter = {
      title,
      content: content || '',
      details: (details || []).map(d => ({ key: d.key, value: d.value })),
      isLocked: false,
    };
    const chapters = volumes[volumeIndex].chapters;
    if (position !== undefined && position >= 0 && position <= chapters.length) {
      chapters.splice(position, 0, newChapter);
    } else {
      chapters.push(newChapter);
    }
    const md = generateMarkdownFromSections(volumes);
    await db.updateProject(projectId, { outlineFull: md });
    return `章节「${title}」已添加到分卷「${volumes[volumeIndex].title}」${position !== undefined ? `第${position + 1}位` : '末尾'}，该分卷现有${chapters.length}个章节。`;
  },
  {
    name: 'add_chapter',
    description: '在指定分卷中添加一个新章节。可指定插入位置，不指定则添加到该分卷末尾。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
      volumeIndex: z.number().int().describe('目标分卷索引（从0开始）'),
      title: z.string().describe('章节标题，如：第一章 初入修真界'),
      content: z.string().optional().describe('章节概要描述'),
      details: z.array(z.object({ key: z.string(), value: z.string() })).optional().describe('章节细节键值对，如 [{key:"核心冲突",value:"主角遭遇背叛"}]'),
      position: z.number().int().optional().describe('插入位置（从0开始），不指定则添加到该分卷末尾'),
    }),
  }
);

// ─── 21. 删除章节 ────────────────────────────────────────────────────────────
export const deleteChapterTool = tool(
  async ({ projectId, volumeIndex, chapterIndex }) => {
    const project = await db.getProject(projectId);
    if (!project) return '未找到该项目。';
    const volumes = parseStructureOutline(project.outlineFull || '');
    if (volumeIndex < 0 || volumeIndex >= volumes.length) {
      return `分卷索引${volumeIndex}越界。`;
    }
    const chapters = volumes[volumeIndex].chapters;
    if (chapterIndex < 0 || chapterIndex >= chapters.length) {
      return `章节索引${chapterIndex}越界，该分卷共${chapters.length}个章节。`;
    }
    if (chapters[chapterIndex].isLocked && !confirmLockedAction('删除章节', chapters[chapterIndex].title)) {
      return `已取消删除锁定章节「${chapters[chapterIndex].title}」。`;
    }
    const removed = chapters.splice(chapterIndex, 1)[0];
    const md = generateMarkdownFromSections(volumes);
    await db.updateProject(projectId, { outlineFull: md });
    return `章节「${removed.title}」已从分卷「${volumes[volumeIndex].title}」中删除${removed.isLocked ? '（锁定项，已确认）' : ''}，剩余${chapters.length}个章节。`;
  },
  {
    name: 'delete_chapter',
    description: '删除指定分卷中的指定章节。若章节已锁定，系统会自动暂停并请用户确认，无需也不要传任何额外的确认参数。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
      volumeIndex: z.number().int().describe('分卷索引（从0开始）'),
      chapterIndex: z.number().int().describe('章节索引（从0开始）'),
    }),
  }
);

// ─── 22. 更新章节 ────────────────────────────────────────────────────────────
export const updateChapterTool = tool(
  async ({ projectId, volumeIndex, chapterIndex, title, content, details }) => {
    const project = await db.getProject(projectId);
    if (!project) return '未找到该项目。';
    const volumes = parseStructureOutline(project.outlineFull || '');
    if (volumeIndex < 0 || volumeIndex >= volumes.length) {
      return `分卷索引${volumeIndex}越界。`;
    }
    const chapters = volumes[volumeIndex].chapters;
    if (chapterIndex < 0 || chapterIndex >= chapters.length) {
      return `章节索引${chapterIndex}越界。`;
    }
    if (chapters[chapterIndex].isLocked && !confirmLockedAction('修改章节', chapters[chapterIndex].title)) {
      return `已取消修改锁定章节「${chapters[chapterIndex].title}」。`;
    }
    if (title !== undefined) chapters[chapterIndex].title = title;
    if (content !== undefined) chapters[chapterIndex].content = content;
    if (details !== undefined) {
      chapters[chapterIndex].details = details.map(d => ({ key: d.key, value: d.value }));
    }
    const md = generateMarkdownFromSections(volumes);
    await db.updateProject(projectId, { outlineFull: md });
    return `章节「${chapters[chapterIndex].title}」已更新${chapters[chapterIndex].isLocked ? '（锁定项，已确认）' : ''}。`;
  },
  {
    name: 'update_chapter',
    description: '修改指定章节的标题、概要内容或细节键值对。若章节已锁定，系统会自动暂停并请用户确认，无需也不要传任何额外的确认参数。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
      volumeIndex: z.number().int().describe('分卷索引（从0开始）'),
      chapterIndex: z.number().int().describe('章节索引（从0开始）'),
      title: z.string().optional().describe('新的章节标题'),
      content: z.string().optional().describe('新的章节概要描述'),
      details: z.array(z.object({ key: z.string(), value: z.string() })).optional().describe('新的章节细节键值对（会整体替换）'),
    }),
  }
);

// ─── 23. 移动分卷/章节顺序 ───────────────────────────────────────────────────
export const moveOutlineItemTool = tool(
  async ({ projectId, type, fromIndex, toIndex, volumeIndex }) => {
    const project = await db.getProject(projectId);
    if (!project) return '未找到该项目。';
    const volumes = parseStructureOutline(project.outlineFull || '');

    if (type === 'volume') {
      if (fromIndex < 0 || fromIndex >= volumes.length || toIndex < 0 || toIndex >= volumes.length) {
        return `索引越界，当前共${volumes.length}个分卷。`;
      }
      const [moved] = volumes.splice(fromIndex, 1);
      volumes.splice(toIndex, 0, moved);
    } else if (type === 'chapter') {
      if (volumeIndex === undefined || volumeIndex < 0 || volumeIndex >= volumes.length) {
        return `分卷索引越界。`;
      }
      const chapters = volumes[volumeIndex].chapters;
      if (fromIndex < 0 || fromIndex >= chapters.length || toIndex < 0 || toIndex >= chapters.length) {
        return `章节索引越界，该分卷共${chapters.length}个章节。`;
      }
      const [moved] = chapters.splice(fromIndex, 1);
      chapters.splice(toIndex, 0, moved);
    } else {
      return `type 必须是 "volume" 或 "chapter"。`;
    }

    const md = generateMarkdownFromSections(volumes);
    await db.updateProject(projectId, { outlineFull: md });
    return `${type === 'volume' ? '分卷' : '章节'}已从位置${fromIndex}移动到位置${toIndex}。`;
  },
  {
    name: 'move_outline_item',
    description: '调整分卷或章节的顺序。支持在同一层级内移动位置。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
      type: z.enum(['volume', 'chapter']).describe('移动类型：volume=分卷, chapter=章节'),
      fromIndex: z.number().int().describe('原位置索引（从0开始）'),
      toIndex: z.number().int().describe('目标位置索引（从0开始）'),
      volumeIndex: z.number().int().optional().describe('当type=chapter时，指定所在分卷索引（从0开始）'),
    }),
  }
);
