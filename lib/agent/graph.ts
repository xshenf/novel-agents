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
});

// ─── LLM 工厂 ─────────────────────────────────────────────────────────────────
function buildLLM(apiConfig: string, modelName: string) {
  let config = {
    apiKey: apiConfig,
    apiProvider: 'gemini',
    apiBaseUrl: '',
    temperature: 0.7,
    maxTokens: 4000,
  };

  if (apiConfig && apiConfig.trim().startsWith('{') && apiConfig.trim().endsWith('}')) {
    try {
      Object.assign(config, JSON.parse(apiConfig));
    } catch (_) { /* ignore */ }
  }

  const model = modelName || 'gemini-2.5-flash';

  if (config.apiProvider === 'gemini') {
    return new ChatGoogleGenerativeAI({
      apiKey: config.apiKey,
      model,
      temperature: config.temperature,
      maxOutputTokens: config.maxTokens,
      ...(config.apiBaseUrl ? { baseUrl: config.apiBaseUrl } : {}),
    });
  }

  let baseUrl = 'https://api.openai.com/v1';
  if (config.apiProvider === 'deepseek') baseUrl = 'https://api.deepseek.com/v1';
  else if (config.apiBaseUrl) baseUrl = config.apiBaseUrl;

  return new ChatOpenAI({
    apiKey: config.apiKey,
    model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    configuration: { baseURL: baseUrl },
  });
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

// ─── 构建 Graph ────────────────────────────────────────────────────────────────
export function buildNovelAgentGraph(apiConfig: string, modelName: string, projectId: string) {
  setAgentApiConfig(apiConfig, modelName);
  const llm = buildLLM(apiConfig, modelName);

  const orchestratorNode = createAgentNode('orchestrator', ORCHESTRATOR_TOOLS, llm, projectId);
  const plannerNode      = createAgentNode('planner',      PLANNER_TOOLS,      llm, projectId);
  const loreBuilderNode  = createAgentNode('lore_builder', LORE_BUILDER_TOOLS, llm, projectId);
  const writerNode       = createAgentNode('writer',       WRITER_TOOLS,       llm, projectId);
  const editorNode       = createAgentNode('editor',       EDITOR_TOOLS,       llm, projectId);

  const orchestratorToolNode  = new ToolNode(ORCHESTRATOR_TOOLS);
  const plannerToolNode       = new ToolNode(PLANNER_TOOLS);
  const loreBuilderToolNode   = new ToolNode(LORE_BUILDER_TOOLS);
  const writerToolNode        = new ToolNode(WRITER_TOOLS);
  const editorToolNode        = new ToolNode(EDITOR_TOOLS);

  // ── 路由函数 ─────────────────────────────────────────────────────────────
  const routeAfterAgent = (nextToolsNode: string) =>
    (state: typeof AgentState.State) => {
      const last = state.messages[state.messages.length - 1] as AIMessage;
      return (last.tool_calls && last.tool_calls.length > 0) ? nextToolsNode : END;
    };

  const routeAfterOrchestrator = (state: typeof AgentState.State) => {
    const last = state.messages[state.messages.length - 1] as AIMessage;
    if (!last.tool_calls || last.tool_calls.length === 0) return END;
    const name = last.tool_calls[0].name;
    if (name === 'delegate_to_planner')      return 'planner';
    if (name === 'delegate_to_lore_builder') return 'lore_builder';
    if (name === 'delegate_to_writer')       return 'writer';
    if (name === 'delegate_to_editor')       return 'editor';
    return 'orchestrator_tools'; // query_memory / get_project_overview
  };

  // 工具执行后：决定回哪个 specialist 还是回 orchestrator
  const routeAfterOrchestratorTools = (state: typeof AgentState.State) => {
    // 找最后一条 ToolMessage，看其 content 是否是 DELEGATE 信号
    const msgs = state.messages;
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m._getType() === 'tool') {
        const content = typeof m.content === 'string' ? m.content : '';
        if (content.startsWith('[DELEGATE:planner]'))      return 'planner';
        if (content.startsWith('[DELEGATE:lore_builder]')) return 'lore_builder';
        if (content.startsWith('[DELEGATE:writer]'))       return 'writer';
        if (content.startsWith('[DELEGATE:editor]'))       return 'editor';
        break;
      }
    }
    return 'orchestrator'; // 普通工具调用后回 orchestrator 继续
  };

  const graph = new StateGraph(AgentState)
    .addNode('orchestrator',       orchestratorNode)
    .addNode('orchestrator_tools', orchestratorToolNode)
    .addNode('planner',            plannerNode)
    .addNode('planner_tools',      plannerToolNode)
    .addNode('lore_builder',       loreBuilderNode)
    .addNode('lore_builder_tools', loreBuilderToolNode)
    .addNode('writer',             writerNode)
    .addNode('writer_tools',       writerToolNode)
    .addNode('editor',             editorNode)
    .addNode('editor_tools',       editorToolNode)

    .addEdge(START, 'orchestrator')

    // Orchestrator 根据 tool_call 路由
    .addConditionalEdges('orchestrator', routeAfterOrchestrator)
    // Orchestrator 工具执行后：delegate 信号路由到 specialist，否则回 orchestrator
    .addConditionalEdges('orchestrator_tools', routeAfterOrchestratorTools)

    // Specialist agents：有 tool_calls 就用工具，没有就结束
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
