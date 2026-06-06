import { tool } from '@langchain/core/tools';
import { RunnableConfig } from '@langchain/core/runnables';
import { z } from 'zod';
import { db, type Chapter } from '../db';
import { searchMemory } from '../memory';
import { ai } from '../ai';
import { formatAntiAiInstructions } from '../rules';
import { interrupt } from '@langchain/langgraph';

// 锁定项的破坏性操作：用 LangGraph interrupt 暂停整张图，等待用户经 Command({resume}) 回传决定。
// resume 传 true / 'confirm' / 'yes' 视为确认继续，其它（含 false / 取消）一律视为取消。
// 关键：必须在真正写库的副作用之前调用——resume 会让工具从头重跑，确认后写库只执行一次。
function confirmLockedAction(action: string, target: string): boolean {
  const decision = interrupt({ type: 'confirm_locked', action, target }) as unknown;
  return decision === true || decision === 'confirm' || decision === 'yes';
}

// ─── 构建 callAIApi 参数（从 agent 环境变量注入） ────────────────────────────

function getAgentConfig(agentRole: string, apiConfig: string): string {
  if (apiConfig && apiConfig.trim().startsWith('{') && apiConfig.trim().endsWith('}')) {
    try {
      const parsed = JSON.parse(apiConfig);
      if (Array.isArray(parsed.models) && parsed.agentModelBindings) {
        const modelId = parsed.agentModelBindings[agentRole];
        const model = parsed.models.find((m: any) => m.id === modelId) || parsed.models[0];
        if (model) {
          const overrides = (parsed.agentOverrides || {})[agentRole] || {};
          return JSON.stringify({
            apiKey: model.apiKey,
            apiProvider: model.provider,
            apiBaseUrl: model.baseUrl || model.apiBaseUrl || '',
            temperature: overrides.temperature !== undefined ? overrides.temperature : model.temperature,
            maxTokens: overrides.maxTokens !== undefined ? overrides.maxTokens : model.maxTokens,
            systemInstruction: parsed.systemInstruction || '',
            reasoningEnabled: model.reasoningEnabled === true
          });
        }
      }
    } catch (_) { /* ignore */ }
  }
  return apiConfig;
}

function getAgentModelName(agentRole: string, apiConfig: string, defaultModelName: string): string {
  if (apiConfig && apiConfig.trim().startsWith('{') && apiConfig.trim().endsWith('}')) {
    try {
      const parsed = JSON.parse(apiConfig);
      if (Array.isArray(parsed.models) && parsed.agentModelBindings) {
        const modelId = parsed.agentModelBindings[agentRole];
        const model = parsed.models.find((m: any) => m.id === modelId) || parsed.models[0];
        if (model) {
          return model.name;
        }
      }
    } catch (_) { /* ignore */ }
  }
  return defaultModelName;
}

// 判断当前是否注入了「可用」的 API Key（兼容原始字符串与打包 JSON）。
// 用于决定是否自动生成章节摘要——无 Key 时正文走 mock，不应再用 mock 摘要污染记忆。
function agentHasKey(agentRole: string, apiConfig: string): boolean {
  const configStr = getAgentConfig(agentRole, apiConfig);
  const t = (configStr || '').trim();
  if (!t) return false;
  if (t.startsWith('{') && t.endsWith('}')) {
    try {
      const o = JSON.parse(t);
      return !!(o.apiKey && String(o.apiKey).trim());
    } catch {
      return false;
    }
  }
  return true;
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

// ─── 6. 创建角色卡 ────────────────────────────────────────────────────────────
export const createCharacterTool = tool(
  async ({ projectId, name, role, age, identity, personality, goals, forbidden, currentState }) => {
    const char = await db.createCharacter({
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
    const rule = await db.createWorldRule({ projectId, name, type, description });
    return `世界观设定「${name}」已创建，ID: ${rule.id}`;
  },
  {
    name: 'create_world_rule',
    description: '新建一条具体的故事要素设定（如具体的地点、门派势力、法宝、局部的天道法则）。注意：如果涉及小说 7 大全局核心框架设定（文风题材、核心世界观整体大背景、境界与力量体系、金手指外挂、核心矛盾与终极危机、势力地理大板块、爽点卖点），请使用 update_project_field 工具修改，绝对不要在此创建重复的全局规则实体。',
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
    await db.updateProject(projectId, { [field]: value });
    return `项目设定「${field}」已更新。`;
  },
  {
    name: 'update_project_field',
    description: '更新小说项目的全局核心设定字段。注意：此处仅用于宏观全局的框架设定，如果需要添加具体的微观设定要素（如具体的门派详情、地名历史、法宝细节），请使用 create_world_rule 工具，不要污染此处的全局宏观字段。',
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
    const defaultModel = config.configurable?.modelName || 'gemini-2.5-flash';
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
        const s = await ai.summarizeChapter(text, configStr, modelName);
        await db.updateChapter(target.id, {
          summary: s.summary,
          characterChanges: s.characterChanges,
          newForeshadowing: s.newForeshadowing,
          resolvedForeshadowing: s.resolvedForeshadowing,
          timelineEvents: s.timelineEvents,
        });
        memoryNote = '，并已同步更新章节摘要与长期记忆';
      } catch {
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

// ─── 11. 润色文本 ─────────────────────────────────────────────────────────────────
export const polishTextTool = tool(
  async ({ projectId, text, instruction }, config) => {
    const apiConfig = config.configurable?.apiConfig || '';
    const modelName = config.configurable?.modelName || 'gemini-2.5-flash';
    const configStr = getAgentConfig('editor', apiConfig);

    // 读取项目的反 AI 写作规则，注入到润色指令中
    let antiAiNote = '';
    if (projectId) {
      const project = await db.getProject(projectId);
      const lines = formatAntiAiInstructions(project?.antiAiStyleRules);
      if (lines) antiAiNote = '\n' + lines;
    }

    const fullInstruction = (instruction || '') + antiAiNote;
    const result = await ai.polish(text, fullInstruction || '', configStr, getAgentModelName('editor', apiConfig, modelName));
    return result;
  },
  {
    name: 'polish_text',
    description: '对提供的文本进行润色修改，可指定润色方向（如：加强环境描写、改为古风文笔、增加节奏感等）。如果提供了 projectId，会自动应用项目的反 AI 写作规则。',
    schema: z.object({
      projectId: z.string().optional().describe('小说项目ID，可选；提供时会自动应用项目的反 AI 写作规则'),
      text: z.string().describe('需要润色的原文'),
      instruction: z.string().optional().describe('润色方向和要求'),
    }),
  }
);

// ─── 12. 逻辑自检 ────────────────────────────────────────────────────────────
export const checkConsistencyTool = tool(
  async ({ projectId, text }, config) => {
    const apiConfig = config.configurable?.apiConfig || '';
    const modelName = config.configurable?.modelName || 'gemini-2.5-flash';
    const configStr = getAgentConfig('editor', apiConfig);
    const result = await ai.checkConsistency(projectId, text, configStr, getAgentModelName('editor', apiConfig, modelName));
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

// ─── 13. 章节复盘：摘要与状态写入记忆 ─────────────────────────────────────────
export const summarizeChapterTool = tool(
  async ({ projectId, chapterId, text }, config) => {
    void projectId;
    const apiConfig = config.configurable?.apiConfig || '';
    const modelName = config.configurable?.modelName || 'gemini-2.5-flash';
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

// ─── 15. 生成角色/设定灵感 ────────────────────────────────────────────────────
export const generateInspirationsTool = tool(
  async ({ projectId }, config) => {
    const apiConfig = config.configurable?.apiConfig || '';
    const modelName = config.configurable?.modelName || 'gemini-2.5-flash';
    const configStr = getAgentConfig('lore_builder', apiConfig);
    const data = await ai.generateInspirations(projectId, configStr, getAgentModelName('lore_builder', apiConfig, modelName));
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

// ─── 16. 获取大纲结构 ────────────────────────────────────────────────────────
export const getOutlineStructureTool = tool(
  async ({ projectId }) => {
    const project = await db.getProject(projectId);
    if (!project) return '未找到该项目。';
    const outlineFull = project.outlineFull || '';
    if (!outlineFull.trim()) return '当前项目还没有大纲。';

    const volumes = parseOutlineMarkdown(outlineFull);
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
    const volumes = parseOutlineMarkdown(project.outlineFull || '');
    const newVol: OutlineVolume = { title, content: content || '', chapters: [], isLocked: false };
    if (position !== undefined && position >= 0 && position <= volumes.length) {
      volumes.splice(position, 0, newVol);
    } else {
      volumes.push(newVol);
    }
    const md = serializeOutlineMarkdown(volumes);
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
    const volumes = parseOutlineMarkdown(project.outlineFull || '');
    if (volumeIndex < 0 || volumeIndex >= volumes.length) {
      return `分卷索引${volumeIndex}越界，当前共${volumes.length}个分卷（索引0~${volumes.length - 1}）。`;
    }
    if (volumes[volumeIndex].isLocked && !confirmLockedAction('删除分卷', volumes[volumeIndex].title)) {
      return `已取消删除锁定分卷「${volumes[volumeIndex].title}」。`;
    }
    const removed = volumes.splice(volumeIndex, 1)[0];
    const md = serializeOutlineMarkdown(volumes);
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
    const volumes = parseOutlineMarkdown(project.outlineFull || '');
    if (volumeIndex < 0 || volumeIndex >= volumes.length) {
      return `分卷索引${volumeIndex}越界，当前共${volumes.length}个分卷。`;
    }
    if (volumes[volumeIndex].isLocked && !confirmLockedAction('修改分卷', volumes[volumeIndex].title)) {
      return `已取消修改锁定分卷「${volumes[volumeIndex].title}」。`;
    }
    if (title !== undefined) volumes[volumeIndex].title = title;
    if (content !== undefined) volumes[volumeIndex].content = content;
    const md = serializeOutlineMarkdown(volumes);
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
    const volumes = parseOutlineMarkdown(project.outlineFull || '');
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
    const md = serializeOutlineMarkdown(volumes);
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
    const volumes = parseOutlineMarkdown(project.outlineFull || '');
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
    const md = serializeOutlineMarkdown(volumes);
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
    const volumes = parseOutlineMarkdown(project.outlineFull || '');
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
    const md = serializeOutlineMarkdown(volumes);
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
    const volumes = parseOutlineMarkdown(project.outlineFull || '');

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

    const md = serializeOutlineMarkdown(volumes);
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

// ─── 大纲 Markdown 解析/序列化（与前端 OutlineTab 保持一致） ──────────────────
interface OutlineChapter {
  title: string;
  content: string;
  details: { key: string; value: string }[];
  isLocked?: boolean;
}

interface OutlineVolume {
  title: string;
  content: string;
  chapters: OutlineChapter[];
  isLocked?: boolean;
}

function parseOutlineMarkdown(text: string): OutlineVolume[] {
  if (!text) return [];
  const volumes: OutlineVolume[] = [];
  let currentVolume: OutlineVolume | null = null;
  let currentChapter: OutlineChapter | null = null;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^#[^#]/.test(trimmed)) {
      let titleText = trimmed.replace(/^#\s+/, '').trim();
      let isLocked = false;
      if (titleText.includes('<!-- LOCKED -->') || titleText.includes('[LOCKED]')) {
        isLocked = true;
        titleText = titleText.replace('<!-- LOCKED -->', '').replace('[LOCKED]', '').trim();
      }
      currentVolume = { title: titleText || '新分卷', content: '', chapters: [], isLocked };
      volumes.push(currentVolume);
      currentChapter = null;
    } else if (trimmed.startsWith('##')) {
      let titleText = trimmed.replace(/^##\s+/, '').trim();
      let isLocked = false;
      if (titleText.includes('<!-- LOCKED -->') || titleText.includes('[LOCKED]')) {
        isLocked = true;
        titleText = titleText.replace('<!-- LOCKED -->', '').replace('[LOCKED]', '').trim();
      }
      currentChapter = { title: titleText || '新章节', content: '', details: [], isLocked };
      if (!currentVolume) {
        currentVolume = { title: '第一卷：正文', content: '全局默认分卷', chapters: [] };
        volumes.push(currentVolume);
      }
      currentVolume.chapters.push(currentChapter);
    } else {
      if (currentChapter) {
        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          const kvMatch = trimmed.match(/^[\-\*]\s+(?:\*\*(.*?)\*\*|([^：:]+))[：:](.*)$/);
          if (kvMatch) {
            currentChapter.details.push({ key: (kvMatch[1] || kvMatch[2]).trim(), value: kvMatch[3].trim() });
          } else {
            currentChapter.content += (currentChapter.content ? '\n' : '') + trimmed.replace(/^[\-\*]\s+/, '');
          }
        } else {
          currentChapter.content += (currentChapter.content ? '\n' : '') + trimmed;
        }
      } else if (currentVolume) {
        currentVolume.content += (currentVolume.content ? '\n' : '') + trimmed;
      }
    }
  }

  if (volumes.length === 0) {
    volumes.push({ title: '第一卷：正文', content: '全局默认分卷', chapters: [] });
  }
  return volumes;
}

function serializeOutlineMarkdown(volumes: OutlineVolume[]): string {
  return volumes.map(vol => {
    let part = `# ${vol.title}${vol.isLocked ? ' <!-- LOCKED -->' : ''}\n`;
    if (vol.content && vol.content.trim()) {
      part += `${vol.content.trim()}\n`;
    }
    vol.chapters.forEach(sec => {
      part += `\n## ${sec.title}${sec.isLocked ? ' <!-- LOCKED -->' : ''}\n`;
      if (sec.content && sec.content.trim()) {
        part += `${sec.content.trim()}\n`;
      }
      sec.details.forEach(det => {
        if (det.key.trim() && det.value.trim()) {
          part += `- **${det.key.trim()}**：${det.value.trim()}\n`;
        }
      });
    });
    return part;
  }).join('\n\n');
}

// ─── 工具集合（按角色分组） ────────────────────────────────────────────────────
export const PLANNER_TOOLS = [
  getProjectOverviewTool,
  autoPlanBookTool,
  generateOutlineTool,
  generateKernelTool,
  updateProjectFieldTool,
  addAntiAiRuleTool,
  getOutlineStructureTool,
  addVolumeTool,
  deleteVolumeTool,
  updateVolumeTool,
  addChapterTool,
  deleteChapterTool,
  updateChapterTool,
  moveOutlineItemTool,
];

export const LORE_BUILDER_TOOLS = [
  getProjectOverviewTool,
  createCharacterTool,
  createWorldRuleTool,
  generateInspirationsTool,
  queryMemoryTool,
];

export const WRITER_TOOLS = [
  queryMemoryTool,
  getProjectOverviewTool,
  createChapterTool,
  autoWriteChapterTool,
  summarizeChapterTool,
];

export const EDITOR_TOOLS = [
  queryMemoryTool,
  getProjectOverviewTool,
  polishTextTool,
  checkConsistencyTool,
  summarizeChapterTool,
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
