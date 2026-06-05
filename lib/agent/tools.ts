import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { db } from '../db';
import { searchMemory } from '../memory';
import { ai } from '../ai';

// ─── 构建 callAIApi 参数（从 agent 环境变量注入） ────────────────────────────
let _apiConfig: string = '';
let _modelName: string = 'gemini-2.5-flash';

export function setAgentApiConfig(packed: string, model: string) {
  _apiConfig = packed;
  _modelName = model;
}

// ─── 1. 查询记忆 ─────────────────────────────────────────────────────────────
export const queryMemoryTool = tool(
  async ({ projectId, query }) => {
    const result = searchMemory(projectId, query);
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
    const project = db.getProject(projectId);
    if (!project) return '未找到该项目。';
    const characters = db.getCharacters(projectId);
    const chapters = db.getChapters(projectId);
    const worldRules = db.getWorldRules(projectId);

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

// ─── 3. 生成章节大纲 ──────────────────────────────────────────────────────────
export const generateOutlineTool = tool(
  async ({ projectId, numChapters }) => {
    const project = db.getProject(projectId);
    if (!project) return '未找到该项目。';
    const outline = await ai.generateOutline(
      projectId, project.title, project.description, numChapters, _apiConfig, _modelName
    );
    return outline;
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
  async ({ projectId, genre, tone, tags }) => {
    const result = await ai.autoPlanBook(genre, tone, tags, _apiConfig, _modelName);
    // 同时更新项目设定
    if (projectId && result) {
      const r = result as any;
      const updates: Record<string, any> = {};
      if (r.title) updates.title = r.title;
      if (r.description) updates.description = r.description;
      if (r.styleSetting) updates.styleSetting = r.styleSetting;
      if (r.worldSetting) updates.worldSetting = r.worldSetting;
      if (r.powerSystem) updates.powerSystem = r.powerSystem;
      if (r.coreConflict) updates.coreConflict = r.coreConflict;
      if (r.sellingPoints) updates.sellingPoints = r.sellingPoints;
      if (Object.keys(updates).length > 0) {
        db.updateProject(projectId, updates);
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
  async ({ projectId, genre, tone }) => {
    const project = db.getProject(projectId);
    if (!project) return '未找到该项目。';
    const result = await ai.generateKernelSettings(project.title, genre, tone, _apiConfig, _modelName);
    // 保存到项目
    const updates: Record<string, any> = {};
    if (result.powerSystem) updates.powerSystem = result.powerSystem;
    if (result.goldFinger) updates.goldFinger = result.goldFinger;
    if (result.coreConflict) updates.coreConflict = result.coreConflict;
    if (result.factionsMap) updates.factionsMap = result.factionsMap;
    if (result.sellingPoints) updates.sellingPoints = result.sellingPoints;
    if (Object.keys(updates).length > 0) {
      db.updateProject(projectId, updates);
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

// ─── 6. 创建角色卡 ────────────────────────────────────────────────────────────
export const createCharacterTool = tool(
  async ({ projectId, name, role, age, identity, personality, goals, forbidden, currentState }) => {
    const char = db.createCharacter({
      projectId,
      name,
      role,
      age: String(age || ''),
      identity: identity || '',
      personality: personality || [],
      goals: goals || [],
      relationships: [],
      currentState: currentState || '',
      forbidden: forbidden || [],
    });
    return `角色卡「${name}」已创建，ID: ${char.id}`;
  },
  {
    name: 'create_character',
    description: '新建一个小说角色卡，记录角色的基本信息、性格、目标和写作禁忌。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
      name: z.string().describe('角色姓名'),
      role: z.string().describe('角色定位，如：男主、女主、反派、配角'),
      age: z.union([z.string(), z.number()]).optional().describe('年龄'),
      identity: z.string().optional().describe('身份背景，如：落魄公子、修真天才'),
      personality: z.array(z.string()).optional().describe('性格特点列表，如：["冷静", "腹黑", "护短"]'),
      goals: z.array(z.string()).optional().describe('角色目标列表'),
      forbidden: z.array(z.string()).optional().describe('写作禁忌（该角色绝对不能做的事）'),
      currentState: z.string().optional().describe('当前状态描述'),
    }),
  }
);

// ─── 7. 创建世界观设定 ────────────────────────────────────────────────────────
export const createWorldRuleTool = tool(
  async ({ projectId, name, type, description }) => {
    const rule = db.createWorldRule({ projectId, name, type, description });
    return `世界观设定「${name}」已创建，ID: ${rule.id}`;
  },
  {
    name: 'create_world_rule',
    description: '新建一条世界观设定，包括地点、势力、法则/规则、物品等。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
      name: z.string().describe('设定名称'),
      type: z.enum(['location', 'faction', 'rule', 'item', 'other']).describe('设定类型：location=地点, faction=势力, rule=法则, item=物品, other=其他'),
      description: z.string().describe('设定的详细描述'),
    }),
  }
);

// ─── 8. 更新项目设定字段 ──────────────────────────────────────────────────────
export const updateProjectFieldTool = tool(
  async ({ projectId, field, value }) => {
    const allowedFields = [
      'title', 'description', 'styleSetting', 'worldSetting',
      'powerSystem', 'goldFinger', 'coreConflict', 'factionsMap',
      'sellingPoints', 'outlineFull'
    ];
    if (!allowedFields.includes(field)) {
      return `不允许修改字段 "${field}"，可用字段：${allowedFields.join(', ')}`;
    }
    db.updateProject(projectId, { [field]: value });
    return `项目设定「${field}」已更新。`;
  },
  {
    name: 'update_project_field',
    description: '更新小说项目的某个具体设定字段，如写作风格、世界观描述、能力体系等。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
      field: z.string().describe('要更新的字段名，可选：title, description, styleSetting, worldSetting, powerSystem, goldFinger, coreConflict, factionsMap, sellingPoints, outlineFull'),
      value: z.string().describe('新的字段值'),
    }),
  }
);

// ─── 9. 新建章节 ──────────────────────────────────────────────────────────────
export const createChapterTool = tool(
  async ({ projectId, title }) => {
    const chapter = db.createChapter({
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
  async ({ projectId, chapterTitle, instruction }) => {
    const text = await ai.autoWriteChapter(
      projectId, chapterTitle, _apiConfig, _modelName, instruction || ''
    );
    return `【章节内容已生成，共 ${text.length} 字】\n\n${text.slice(0, 500)}${text.length > 500 ? '\n\n...(内容已生成，请在编辑器查看)' : ''}`;
  },
  {
    name: 'auto_write_chapter',
    description: '根据项目设定和章节标题，自动生成章节的正文内容。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
      chapterTitle: z.string().describe('要写作的章节标题'),
      instruction: z.string().optional().describe('具体写作指令，如特定情节要求、情绪基调等'),
    }),
  }
);

// ─── 11. 润色文本 ─────────────────────────────────────────────────────────────
export const polishTextTool = tool(
  async ({ text, instruction }) => {
    const result = await ai.polish(text, instruction || '', _apiConfig, _modelName);
    return result;
  },
  {
    name: 'polish_text',
    description: '对提供的文本进行润色修改，可指定润色方向（如：加强环境描写、改为古风文笔、增加节奏感等）。',
    schema: z.object({
      text: z.string().describe('需要润色的原文'),
      instruction: z.string().optional().describe('润色方向和要求'),
    }),
  }
);

// ─── 12. 逻辑自检 ────────────────────────────────────────────────────────────
export const checkConsistencyTool = tool(
  async ({ projectId, text }) => {
    const result = await ai.checkConsistency(projectId, text, _apiConfig, _modelName);
    return JSON.stringify(result, null, 2);
  },
  {
    name: 'check_consistency',
    description: '对章节内容进行逻辑自检，检查人物行为、世界观、时间线是否与前文一致。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
      text: z.string().describe('要检查的章节文本'),
    }),
  }
);

// ─── 13. 添加反 AI 写作规则 ───────────────────────────────────────────────────
export const addAntiAiRuleTool = tool(
  async ({ projectId, rule }) => {
    const project = db.getProject(projectId);
    if (!project) return '未找到该项目。';
    const currentRules = project.antiAiStyleRules || [];
    if (currentRules.includes(rule)) {
      return `规则「${rule}」已存在，无需重复添加。`;
    }
    db.updateProject(projectId, { antiAiStyleRules: [...currentRules, rule] });
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

// ─── 14. 生成角色/设定灵感 ────────────────────────────────────────────────────
export const generateInspirationsTool = tool(
  async ({ projectId }) => {
    const data = await ai.generateInspirations(projectId, _apiConfig, _modelName);
    return JSON.stringify(data, null, 2);
  },
  {
    name: 'generate_inspirations',
    description: '根据当前小说设定，AI 自动推荐新的角色和世界观设定灵感，供用户参考采纳。',
    schema: z.object({
      projectId: z.string().describe('小说项目ID'),
    }),
  }
);

// ─── 工具集合（按角色分组） ────────────────────────────────────────────────────
export const PLANNER_TOOLS = [
  getProjectOverviewTool,
  autoPlanBookTool,
  generateOutlineTool,
  generateKernelTool,
  updateProjectFieldTool,
  addAntiAiRuleTool,
];

export const LORE_BUILDER_TOOLS = [
  getProjectOverviewTool,
  createCharacterTool,
  createWorldRuleTool,
  updateProjectFieldTool,
  generateInspirationsTool,
  queryMemoryTool,
];

export const WRITER_TOOLS = [
  queryMemoryTool,
  getProjectOverviewTool,
  createChapterTool,
  autoWriteChapterTool,
];

export const EDITOR_TOOLS = [
  queryMemoryTool,
  getProjectOverviewTool,
  polishTextTool,
  checkConsistencyTool,
  addAntiAiRuleTool,
];

export const ALL_TOOLS = [
  ...new Set([
    ...PLANNER_TOOLS,
    ...LORE_BUILDER_TOOLS,
    ...WRITER_TOOLS,
    ...EDITOR_TOOLS,
  ])
];
