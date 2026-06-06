import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

import {
  PLANNER_TOOLS,
  LORE_BUILDER_TOOLS,
  WRITER_TOOLS,
  EDITOR_TOOLS,
  queryMemoryTool,
  getProjectOverviewTool,
  setAgentApiConfig,
} from './tools';
import { AGENT_PROMPTS, AgentRole } from './prompts';

// ─── 全局状态 ─────────────────────────────────────────────────────────────────
export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  currentAgent: Annotation<string>({
    reducer: (_, y) => y,
    default: () => 'orchestrator',
  }),
  projectId: Annotation<string>({
    reducer: (_, y) => y,
    default: () => '',
  }),
  // 已完成的委托次数：每个 specialist 完成后 +1，用于在 orchestrator 汇总阶段封顶，防止无限委托
  delegationCount: Annotation<number>({
    reducer: (_, y) => y,
    default: () => 0,
  }),
});

// ─── LLM 工厂 ─────────────────────────────────────────────────────────────────
function buildLLMFromConfig(config: {
  apiKey: string;
  provider: string;
  name: string;
  apiBaseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}) {
  const provider = config.provider || 'gemini';
  const model = config.name || 'gemini-2.5-flash';
  const temperature = config.temperature ?? 0.7;
  const maxTokens = config.maxTokens ?? 3000;

  if (provider === 'gemini') {
    return new ChatGoogleGenerativeAI({
      apiKey: config.apiKey,
      model,
      temperature,
      maxOutputTokens: maxTokens,
      ...(config.apiBaseUrl ? { baseUrl: config.apiBaseUrl } : {}),
    });
  }

  let baseUrl = 'https://api.openai.com/v1';
  if (provider === 'deepseek') baseUrl = 'https://api.deepseek.com/v1';
  else if (config.apiBaseUrl) baseUrl = config.apiBaseUrl;

  return new ChatOpenAI({
    apiKey: config.apiKey,
    model,
    temperature,
    maxTokens,
    configuration: { baseURL: baseUrl },
  });
}

function buildLLM(apiConfig: string, modelName: string) {
  let config = {
    apiKey: apiConfig,
    provider: 'gemini',
    name: 'gemini-2.5-flash',
    apiBaseUrl: '',
    temperature: 0.7,
    maxTokens: 4000,
  };

  if (apiConfig && apiConfig.trim().startsWith('{') && apiConfig.trim().endsWith('}')) {
    try {
      const parsed = JSON.parse(apiConfig);
      // 兼容老版本的字段名 apiProvider -> provider 等
      config.apiKey = parsed.apiKey || config.apiKey;
      config.provider = parsed.apiProvider || parsed.provider || config.provider;
      config.name = parsed.modelName || parsed.name || modelName || config.name;
      config.apiBaseUrl = parsed.apiBaseUrl || config.apiBaseUrl;
      config.temperature = parsed.temperature !== undefined ? parsed.temperature : config.temperature;
      config.maxTokens = parsed.maxTokens !== undefined ? parsed.maxTokens : config.maxTokens;
    } catch (_) { /* ignore */ }
  }

  return buildLLMFromConfig(config);
}

// ─── Delegate 工具（让 Orchestrator 能路由到 specialist）────────────────────
const delegateToPlannerTool = tool(
  async ({ task }) => `[DELEGATE:planner] ${task}`,
  {
    name: 'delegate_to_planner',
    description: '将故事规划、大纲生成、核心设定框架、卖点设计等任务委托给策划（Planner）来完成。',
    schema: z.object({ task: z.string().describe('交给策划的具体任务') }),
  }
);

const delegateToLoreBuilderTool = tool(
  async ({ task }) => `[DELEGATE:lore_builder] ${task}`,
  {
    name: 'delegate_to_lore_builder',
    description: '将角色卡创建、世界观设定、势力设计、人物关系构建等任务委托给世界观师（Lore Builder）来完成。',
    schema: z.object({ task: z.string().describe('交给世界观师的具体任务') }),
  }
);

const delegateToWriterTool = tool(
  async ({ task }) => `[DELEGATE:writer] ${task}`,
  {
    name: 'delegate_to_writer',
    description: '将章节正文写作、续写、内容生成等任务委托给写手（Writer）来完成。',
    schema: z.object({ task: z.string().describe('交给写手的具体任务') }),
  }
);

const delegateToEditorTool = tool(
  async ({ task }) => `[DELEGATE:editor] ${task}`,
  {
    name: 'delegate_to_editor',
    description: '将文本润色、逻辑自检、内容修改、风格把关等任务委托给编辑（Editor）来完成。',
    schema: z.object({ task: z.string().describe('交给编辑的具体任务') }),
  }
);

const ORCHESTRATOR_TOOLS = [
  queryMemoryTool,
  getProjectOverviewTool,
  delegateToPlannerTool,
  delegateToLoreBuilderTool,
  delegateToWriterTool,
  delegateToEditorTool,
];

// 汇总阶段 orchestrator 可用的工具（去掉所有 delegate_* 工具），从机制上保证不会再次委托而停不下来
const ORCHESTRATOR_SUMMARY_TOOLS = [queryMemoryTool, getProjectOverviewTool];
// 委托次数上限：达到后强制进入汇总，配合 recursionLimit 作为双重保险
const MAX_DELEGATIONS = 5;

// ─── 创建 Agent 节点 ──────────────────────────────────────────────────────────
function createAgentNode(role: AgentRole, tools: any[], llm: any, projectId: string) {
  const bound = llm.bindTools(tools);
  const systemPrompt = AGENT_PROMPTS[role];

  return async (state: typeof AgentState.State) => {
    const contextNote = `\n\n当前项目ID: ${projectId}（调用工具时必须传入此ID）`;
    const sysMsg = new SystemMessage(systemPrompt + contextNote);
    const response = await bound.invoke([sysMsg, ...state.messages]);
    return { messages: [response], currentAgent: role };
  };
}

// Orchestrator 节点：根据已委托次数动态切换「调度模式 / 汇总模式」。
// 一旦有专家完成（delegationCount > 0），就引导其综合成果做最终汇报；
// 达到上限后绑定无 delegate 工具的工具集，从机制上强制收尾。
function createOrchestratorNode(llm: any, projectId: string) {
  const boundFull = llm.bindTools(ORCHESTRATOR_TOOLS);
  const boundSummary = llm.bindTools(ORCHESTRATOR_SUMMARY_TOOLS);
  const base = AGENT_PROMPTS['orchestrator'];

  return async (state: typeof AgentState.State) => {
    const force = state.delegationCount >= MAX_DELEGATIONS;
    const bound = force ? boundSummary : boundFull;
    let sys = base + `\n\n当前项目ID: ${projectId}（调用工具时必须传入此ID）`;
    if (state.delegationCount > 0) {
      sys += force
        ? '\n\n【收尾阶段】已多次委托专家，请立即综合现有所有成果，用简洁专业的语言给用户最终汇报，不要再委托任何任务。'
        : '\n\n【汇总阶段】专家已返回阶段性成果（见上文工具结果）。若任务已完成，请综合各专家成果向用户做最终汇报并给出下一步建议；只有确有必要时才继续委托其他专家。';
    }
    const response = await bound.invoke([new SystemMessage(sys), ...state.messages]);
    return { messages: [response], currentAgent: 'orchestrator' };
  };
}

// 专家完成后经过此节点累加委托计数，再回到 orchestrator 汇总
const afterSpecialistNode = async (state: typeof AgentState.State) => ({
  delegationCount: state.delegationCount + 1,
});

// ─── 构建 Graph ────────────────────────────────────────────────────────────────
export function buildNovelAgentGraph(apiConfig: string, modelName: string, projectId: string) {
  setAgentApiConfig(apiConfig, modelName);

  let models: any[] = [];
  let bindings: Record<string, string> = {};
  let overrides: Record<string, any> = {};
  let isMultiModel = false;

  if (apiConfig && apiConfig.trim().startsWith('{') && apiConfig.trim().endsWith('}')) {
    try {
      const parsed = JSON.parse(apiConfig);
      if (Array.isArray(parsed.models) && parsed.agentModelBindings) {
        models = parsed.models;
        bindings = parsed.agentModelBindings;
        overrides = parsed.agentOverrides || {};
        isMultiModel = true;
      }
    } catch (_) { /* ignore */ }
  }

  const getLLMForAgent = (agentRole: string) => {
    if (isMultiModel) {
      const modelId = bindings[agentRole];
      const modelConfig = models.find(m => m.id === modelId) || models[0];
      if (modelConfig) {
        const agentOverride = overrides[agentRole] || {};
        const mergedConfig = {
          apiKey: modelConfig.apiKey,
          provider: modelConfig.provider,
          name: modelConfig.name,
          apiBaseUrl: modelConfig.baseUrl,
          temperature: agentOverride.temperature !== undefined ? agentOverride.temperature : modelConfig.temperature,
          maxTokens: agentOverride.maxTokens !== undefined ? agentOverride.maxTokens : modelConfig.maxTokens,
        };
        return buildLLMFromConfig(mergedConfig);
      }
    }
    return buildLLM(apiConfig, modelName);
  };

  const orchestratorLlm = getLLMForAgent('orchestrator');
  const plannerLlm      = getLLMForAgent('planner');
  const loreBuilderLlm  = getLLMForAgent('lore_builder');
  const writerLlm       = getLLMForAgent('writer');
  const editorLlm       = getLLMForAgent('editor');

  const orchestratorNode = createOrchestratorNode(orchestratorLlm, projectId);
  const plannerNode      = createAgentNode('planner',      PLANNER_TOOLS,      plannerLlm, projectId);
  const loreBuilderNode  = createAgentNode('lore_builder', LORE_BUILDER_TOOLS, loreBuilderLlm, projectId);
  const writerNode       = createAgentNode('writer',       WRITER_TOOLS,       writerLlm, projectId);
  const editorNode       = createAgentNode('editor',       EDITOR_TOOLS,       editorLlm, projectId);

  const orchestratorToolNode  = new ToolNode(ORCHESTRATOR_TOOLS);
  const plannerToolNode       = new ToolNode(PLANNER_TOOLS);
  const loreBuilderToolNode   = new ToolNode(LORE_BUILDER_TOOLS);
  const writerToolNode        = new ToolNode(WRITER_TOOLS);
  const editorToolNode        = new ToolNode(EDITOR_TOOLS);

  // ── 路由函数 ─────────────────────────────────────────────────────────────
  // 专家完成（无 tool_calls）后回到 orchestrator 汇总，而不是直接结束
  const routeAfterAgent = (nextToolsNode: string) =>
    (state: typeof AgentState.State) => {
      const last = state.messages[state.messages.length - 1] as AIMessage;
      return (last.tool_calls && last.tool_calls.length > 0) ? nextToolsNode : 'after_specialist';
    };

  // Orchestrator 产出后：只要有 tool_calls 一律先执行工具（含 delegate_*），
  // 避免出现「有 tool_call 却无对应 ToolMessage」的悬空调用导致后续 LLM 报错
  const routeAfterOrchestrator = (state: typeof AgentState.State) => {
    const last = state.messages[state.messages.length - 1] as AIMessage;
    return (last.tool_calls && last.tool_calls.length > 0) ? 'orchestrator_tools' : END;
  };

  const SPECIALISTS = ['planner', 'lore_builder', 'writer', 'editor'];

  // 工具执行后：扫描本轮新产生的 ToolMessage，若有 DELEGATE 信号则路由到对应专家，否则回 orchestrator
  const routeAfterOrchestratorTools = (state: typeof AgentState.State) => {
    const msgs = state.messages;
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m._getType() !== 'tool') break; // 只检查末尾连续的工具结果
      const content = typeof m.content === 'string' ? m.content : '';
      const match = content.match(/^\[DELEGATE:(\w+)\]/);
      if (match && SPECIALISTS.includes(match[1])) return match[1];
    }
    return 'orchestrator'; // 普通工具调用（query_memory / get_project_overview）后回 orchestrator 继续
  };

  const graph = new StateGraph(AgentState)
    .addNode('orchestrator',       orchestratorNode)
    .addNode('orchestrator_tools', orchestratorToolNode)
    .addNode('after_specialist',   afterSpecialistNode)
    .addNode('planner',            plannerNode)
    .addNode('planner_tools',      plannerToolNode)
    .addNode('lore_builder',       loreBuilderNode)
    .addNode('lore_builder_tools', loreBuilderToolNode)
    .addNode('writer',             writerNode)
    .addNode('writer_tools',       writerToolNode)
    .addNode('editor',             editorNode)
    .addNode('editor_tools',       editorToolNode)

    .addEdge(START, 'orchestrator')

    // Orchestrator 根据 tool_call 路由：有工具调用 -> 执行工具；否则结束
    .addConditionalEdges('orchestrator', routeAfterOrchestrator)
    // 工具执行后：delegate 信号路由到 specialist，否则回 orchestrator
    .addConditionalEdges('orchestrator_tools', routeAfterOrchestratorTools)

    // 专家完成后统一经 after_specialist 累加计数再回 orchestrator 汇总
    .addEdge('after_specialist', 'orchestrator')

    // Specialist agents：有 tool_calls 就用工具，没有就回到 after_specialist
    .addConditionalEdges('planner',      routeAfterAgent('planner_tools'))
    .addEdge('planner_tools', 'planner')

    .addConditionalEdges('lore_builder', routeAfterAgent('lore_builder_tools'))
    .addEdge('lore_builder_tools', 'lore_builder')

    .addConditionalEdges('writer',       routeAfterAgent('writer_tools'))
    .addEdge('writer_tools', 'writer')

    .addConditionalEdges('editor',       routeAfterAgent('editor_tools'))
    .addEdge('editor_tools', 'editor');

  return graph.compile();
}
