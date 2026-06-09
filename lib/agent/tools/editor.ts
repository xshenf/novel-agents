import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ai } from '../../ai';
import { db } from '../../db';
import { formatAntiAiInstructions } from '../../rules';
import { getAgentConfig, getAgentModelName } from '../config';

// Re-export tools shared with other specialists (defined here in editor for convenience)
export { summarizeChapterTool } from './writer';
export { addAntiAiRuleTool } from './planner';

// ─── 11. 润色文本 ─────────────────────────────────────────────────────────────────
export const polishTextTool = tool(
  async ({ projectId, text, instruction }, config) => {
    const apiConfig = config.configurable?.apiConfig || '';
    const modelName = config.configurable?.modelName;
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
    const modelName = config.configurable?.modelName;
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
