import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { db } from '../../db';
import { ai } from '../../ai';
import { getAgentConfig, getAgentModelName } from '../config';
import { SETTING_LENGTH_GUIDE } from '../../constants';

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
