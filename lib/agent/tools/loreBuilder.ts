import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { db } from '../../db';
import { ai } from '../../ai';
import { getAgentConfig, getAgentModelName } from '../config';
import { SETTING_LENGTH_GUIDE } from '../../constants';

// ─── 6. 创建角色卡 ────────────────────────────────────────────────────────────
export const createCharacterTool = tool(
  async ({ projectId, name, role, age, identity, personality, goals, forbidden, currentState, relationships }) => {
    const char = await db.createCharacter({
      projectId,
      name,
      role,
      age: String(age || ''),
      identity: identity || '',
      personality: personality || [],
      goals: goals || [],
      relationships: relationships || [],
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
      relationships: z.array(z.object({
        target: z.string().describe('对方姓名'),
        type: z.string().describe('关系类型，如：师徒、故交、仇敌'),
      })).optional().describe('与其他角色的关系列表'),
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
      description: z.string().describe(`设定描述，按类型控制篇幅（${SETTING_LENGTH_GUIDE}），突出与主线的关联`),
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

// ─── 更新角色卡 ────────────────────────────────────────────────────────────
export const updateCharacterTool = tool(
  async ({ characterId, name, role, age, identity, personality, goals, forbidden, currentState, relationships }) => {
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    if (age !== undefined) updates.age = String(age);
    if (identity !== undefined) updates.identity = identity;
    if (personality !== undefined) updates.personality = personality;
    if (goals !== undefined) updates.goals = goals;
    if (forbidden !== undefined) updates.forbidden = forbidden;
    if (currentState !== undefined) updates.currentState = currentState;
    if (relationships !== undefined) updates.relationships = relationships;
    const updated = await db.updateCharacter(characterId, updates as any);
    if (!updated) return '未找到该角色。';
    return `角色卡「${updated.name}」已更新。`;
  },
  {
    name: 'update_character',
    description: '修改已有角色卡的任意字段（姓名、定位、性格、目标、关系等）。只需传入要修改的字段，未传入的保持不变。',
    schema: z.object({
      characterId: z.string().describe('要修改的角色ID'),
      name: z.string().optional().describe('角色姓名'),
      role: z.string().optional().describe('角色定位'),
      age: z.union([z.string(), z.number()]).optional().describe('年龄'),
      identity: z.string().optional().describe('身份背景'),
      personality: z.array(z.string()).optional().describe('性格特点列表'),
      goals: z.array(z.string()).optional().describe('角色目标列表'),
      forbidden: z.array(z.string()).optional().describe('写作禁忌'),
      currentState: z.string().optional().describe('当前状态描述'),
      relationships: z.array(z.object({
        target: z.string(),
        type: z.string(),
      })).optional().describe('与其他角色的关系列表'),
    }),
  }
);

// ─── 删除角色卡 ────────────────────────────────────────────────────────────
export const deleteCharacterTool = tool(
  async ({ characterId }) => {
    const ok = await db.deleteCharacter(characterId);
    return ok ? '角色已删除。' : '未找到该角色。';
  },
  {
    name: 'delete_character',
    description: '删除指定角色卡。操作不可恢复。',
    schema: z.object({
      characterId: z.string().describe('要删除的角色ID'),
    }),
  }
);

// ─── 更新世界观设定 ─────────────────────────────────────────────────────────
export const updateWorldRuleTool = tool(
  async ({ ruleId, name, type, description }) => {
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (type !== undefined) updates.type = type;
    if (description !== undefined) updates.description = description;
    const updated = await db.updateWorldRule(ruleId, updates as any);
    if (!updated) return '未找到该设定。';
    return `世界观设定「${updated.name}」已更新。`;
  },
  {
    name: 'update_world_rule',
    description: '修改已有世界观设定的名称、类型或描述。只需传入要修改的字段。',
    schema: z.object({
      ruleId: z.string().describe('要修改的世界观设定ID'),
      name: z.string().optional().describe('设定名称'),
      type: z.enum(['location', 'faction', 'rule', 'item', 'other']).optional().describe('设定类型'),
      description: z.string().optional().describe(`设定描述，按类型控制篇幅（${SETTING_LENGTH_GUIDE}）`),
    }),
  }
);

// ─── 删除世界观设定 ─────────────────────────────────────────────────────────
export const deleteWorldRuleTool = tool(
  async ({ ruleId }) => {
    const ok = await db.deleteWorldRule(ruleId);
    return ok ? '世界观设定已删除。' : '未找到该设定。';
  },
  {
    name: 'delete_world_rule',
    description: '删除指定世界观设定。操作不可恢复。',
    schema: z.object({
      ruleId: z.string().describe('要删除的世界观设定ID'),
    }),
  }
);
