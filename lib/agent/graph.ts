import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import { BaseMessage, SystemMessage, AIMessage, HumanMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

// 持久化 Checkpointer：落盘到 data/agent-checkpoints.db，进程重启/热重载后对话与断点状态仍可恢复。
// 用全局单例复用同一个 better-sqlite3 连接，避免开发环境热重载反复打开文件句柄。
const globalForAgent = globalThis as unknown as {
  agentCheckpointer: SqliteSaver | undefined;
};

export const checkpointer = globalForAgent.agentCheckpointer ?? SqliteSaver.fromConnString('./data/agent-checkpoints.db');
globalForAgent.agentCheckpointer = checkpointer;


import {
  PLANNER_TOOLS,
  LORE_BUILDER_TOOLS,
  WRITER_TOOLS,
  EDITOR_TOOLS,
  queryMemoryTool,
  getProjectOverviewTool,
} from './tools';
import { AGENT_PROMPTS, AgentRole } from './prompts';
import { db } from '../db';
import { buildStyleContext } from './promptContext';

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
  // 当前专家的工具调用次数：每次工具执行后 +1，进入新专家时重置为 0
  // 注意：当前架构下专家是串行执行的，此计数器不存在并发竞争；若未来改为并行需修改 reducer
  specialistToolCalls: Annotation<number>({
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
  reasoningEnabled?: boolean;
}) {
  const provider = config.provider || 'gemini';
  const model = config.name || 'gemini-2.5-flash';
  const temperature = config.temperature ?? 0.7;
  const maxTokens = config.maxTokens ?? 3000;

  let baseUrl = 'https://api.openai.com/v1';
  if (provider === 'gemini') {
    baseUrl = config.apiBaseUrl || 'https://generativelanguage.googleapis.com/v1beta/openai';
  } else if (provider === 'deepseek') {
    baseUrl = 'https://api.deepseek.com/v1';
  } else if (config.apiBaseUrl) {
    baseUrl = config.apiBaseUrl;
  }

  return new ChatOpenAI({
    apiKey: config.apiKey,
    model,
    temperature,
    maxTokens,
    configuration: { baseURL: baseUrl },
  });
}

function buildLLM(apiConfig: string, modelName: string) {
  const config = {
    apiKey: apiConfig,
    provider: 'gemini',
    name: 'gemini-2.5-flash',
    apiBaseUrl: '',
    temperature: 0.7,
    maxTokens: 4000,
    reasoningEnabled: false,
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
      config.reasoningEnabled = parsed.reasoningEnabled === true;
    } catch (e) { console.warn('[agent] apiConfig JSON 解析失败:', e); }
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
// 单个专家的工具调用次数上限：超过后强制结束该专家，回到 orchestrator 汇总
const MAX_SPECIALIST_TOOL_CALLS = 10;

// ─── 创建 Agent 节点 ──────────────────────────────────────────────────────────
// ─── 消息过滤辅助函数（用于优化历史对话处理与消息隔离） ─────────────────────────
export function filterSpecialistMessages(role: string, messages: BaseMessage[]): BaseMessage[] {
  const filteredMessages: BaseMessage[] = [];
  let delegateIndex = -1;
  const delegatePattern = new RegExp(`^\\[DELEGATE:${role}\\]`);

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg._getType() === 'tool') {
      const content = typeof msg.content === 'string' ? msg.content : '';
      if (delegatePattern.test(content)) {
        delegateIndex = i;
        break;
      }
    }
  }

  // 从历史消息中查找最新获取的 get_project_overview 概览信息，避免专家角色再次重复调用拉取
  let latestOverview = '';
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg._getType() === 'tool' && (msg as any).name === 'get_project_overview') {
      latestOverview = typeof msg.content === 'string' ? msg.content : '';
      break;
    }
  }

  if (delegateIndex !== -1) {
    const delegateMsg = messages[delegateIndex];
    const delegateContent = typeof delegateMsg.content === 'string' ? delegateMsg.content : '';
    const taskContent = delegateContent.replace(delegatePattern, '').trim();

    let taskInstruction = '';
    if (latestOverview) {
      taskInstruction = `当前项目的最新概览信息如下：\n${latestOverview}\n\n请执行编导委派给你的任务，且已掌握上述项目背景，无需再次调用 get_project_overview 进行拉取：\n${taskContent}`;
    } else {
      taskInstruction = `请执行编导委派给你的任务：\n${taskContent}`;
    }

    filteredMessages.push(new HumanMessage(taskInstruction));

    // 追加该委托之后的消息（专家在这一轮内部交互产生的 tool / ai 消息）
    for (let i = delegateIndex + 1; i < messages.length; i++) {
      filteredMessages.push(messages[i]);
    }
  } else {
    // 降级防御：如果由于某种原因未找到委托标记，则保留原本的消息历史
    filteredMessages.push(...messages);
  }

  return filteredMessages;
}

export function filterOrchestratorMessages(messages: BaseMessage[]): BaseMessage[] {
  const orchestratorToolNames = [
    'query_memory',
    'get_project_overview',
    'delegate_to_planner',
    'delegate_to_lore_builder',
    'delegate_to_writer',
    'delegate_to_editor'
  ];

  const filteredMessages: BaseMessage[] = [];
  for (const msg of messages) {
    if (msg._getType() === 'tool') {
      const toolMsg = msg as any;
      const toolName = toolMsg.name || '';
      if (orchestratorToolNames.includes(toolName)) {
        filteredMessages.push(msg);
      }
    } else if (msg._getType() === 'ai') {
      const aiMsg = msg as any;
      if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
        // 如果包含任何非编导拥有的工具调用，说明是专家的中间思考过程，予以过滤
        const hasSpecialistTool = aiMsg.tool_calls.some(
          (tc: any) => !orchestratorToolNames.includes(tc.name)
        );
        if (!hasSpecialistTool) {
          filteredMessages.push(aiMsg);
        }
      } else {
        // 无工具调用的 AIMessage 是专家的最终回答或编导自己的总结，必须保留
        filteredMessages.push(msg);
      }
    } else {
      // HumanMessage (用户提问、对话历史) 和 SystemMessage 必须保留
      filteredMessages.push(msg);
    }
  }

  return filteredMessages;
}

// ─── 创建 Agent 节点 ──────────────────────────────────────────────────────────
// 委托目标专家集合（与 delegate_to_* 工具一一对应）
export const SPECIALISTS = ['planner', 'lore_builder', 'writer', 'editor'] as const;

// 从消息尾部连续的工具结果中解析委托目标专家。
// 编导调用 delegate_to_X 工具后，ToolNode 产出形如 "[DELEGATE:role] task" 的结果，
// 这里回溯末尾连续的 ToolMessage 提取目标；无委托信号返回 null（普通工具调用，应回 orchestrator）。
// 抽成单一纯函数供 orchestrator_tools 与 reset_specialist 两条路由复用，避免正则逻辑重复。
export function resolveDelegateTarget(messages: BaseMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m._getType() !== 'tool') break; // 只检查末尾连续的工具结果
    const content = typeof m.content === 'string' ? m.content : '';
    const match = content.match(/^\[DELEGATE:(\w+)\]/);
    if (match && (SPECIALISTS as readonly string[]).includes(match[1])) return match[1];
  }
  return null;
}

function createAgentNode(role: AgentRole, tools: any[], llm: any, projectId: string, globalSystemInstruction: string, injectStyleContext = false) {
  const bound = llm.bindTools(tools);
  const systemPrompt = AGENT_PROMPTS[role];

  return async (state: typeof AgentState.State) => {
    const contextNote = `\n\n当前项目ID: ${projectId}（调用工具时必须传入此ID）`;
    let finalPrompt = systemPrompt + contextNote;
    // 写作类角色（writer/editor）注入文风契约与反 AI 规则，使产出在生成阶段即贴合全书风格
    if (injectStyleContext) {
      const project = await db.getProject(projectId);
      if (project) {
        const styleCtx = buildStyleContext(project);
        if (styleCtx) finalPrompt += `\n\n${styleCtx}`;
      }
    }
    if (globalSystemInstruction && globalSystemInstruction.trim()) {
      finalPrompt += `\n\n用户全局系统指令（你必须严格遵守）：\n${globalSystemInstruction}`;
    }
    const sysMsg = new SystemMessage(finalPrompt);

    const filteredMessages = filterSpecialistMessages(role, state.messages);

    const response = await bound.invoke([sysMsg, ...filteredMessages]);
    return { messages: [response], currentAgent: role };
  };
}

// Orchestrator 节点：根据已委托次数动态切换「调度模式 / 汇总模式」。
// 一旦有专家完成（delegationCount > 0），就引导其综合成果做最终汇报；
// 达到上限后绑定无 delegate 工具的工具集，从机制上强制收尾。
function createOrchestratorNode(llm: any, projectId: string, globalSystemInstruction: string) {
  const boundFull = llm.bindTools(ORCHESTRATOR_TOOLS);
  const boundSummary = llm.bindTools(ORCHESTRATOR_SUMMARY_TOOLS);
  const base = AGENT_PROMPTS['orchestrator'];

  return async (state: typeof AgentState.State) => {
    const force = state.delegationCount >= MAX_DELEGATIONS;
    const bound = force ? boundSummary : boundFull;
    let sys = base + `\n\n当前项目ID: ${projectId}（调用工具时必须传入此ID）`;
    if (globalSystemInstruction && globalSystemInstruction.trim()) {
      sys += `\n\n用户全局系统指令（你必须严格遵守）：\n${globalSystemInstruction}`;
    }
    if (state.delegationCount > 0) {
      sys += force
        ? '\n\n【收尾阶段】已多次委托专家，请立即综合现有所有成果，用简洁专业的语言给用户最终汇报，不要再委托任何任务。'
        : '\n\n【汇总阶段】专家已返回阶段性成果（见上文工具结果）。若任务已完成，请综合各专家成果向用户做最终汇报并给出下一步建议；只有确有必要时才继续委托其他专家。';
    }

    const filteredMessages = filterOrchestratorMessages(state.messages);

    const response = await bound.invoke([new SystemMessage(sys), ...filteredMessages]);
    return { messages: [response], currentAgent: 'orchestrator' };
  };
}

// 专家完成后经过此节点累加委托计数，并重置专家工具调用计数，再回到 orchestrator 汇总
const afterSpecialistNode = async (state: typeof AgentState.State) => ({
  delegationCount: state.delegationCount + 1,
  specialistToolCalls: 0,
});

// 专家执行工具后经过此节点累加工具调用计数
const afterSpecialistToolNode = async (state: typeof AgentState.State) => ({
  specialistToolCalls: state.specialistToolCalls + 1,
});

// ─── 构建 Graph ────────────────────────────────────────────────────────────────
// llmFactory 为可选的测试注入点：传入时用它按角色构造 LLM（桩模型），
// 不传则走正常的 apiConfig 解析逻辑。生产调用无需传入，行为不变。
export function buildNovelAgentGraph(apiConfig: string, modelName: string, projectId: string, llmFactory?: (role: string) => any) {
  let models: any[] = [];
  let bindings: Record<string, string> = {};
  let overrides: Record<string, any> = {};
  let isMultiModel = false;
  let globalSystemInstruction = '';

  if (apiConfig && apiConfig.trim().startsWith('{') && apiConfig.trim().endsWith('}')) {
    try {
      const parsed = JSON.parse(apiConfig);
      globalSystemInstruction = parsed.systemInstruction || '';
      if (Array.isArray(parsed.models) && parsed.agentModelBindings) {
        models = parsed.models;
        bindings = parsed.agentModelBindings;
        overrides = parsed.agentOverrides || {};
        isMultiModel = true;
      }
    } catch (e) { console.warn('[agent] apiConfig JSON 解析失败:', e); }
  }

  const getLLMForAgent = (agentRole: string) => {
    if (llmFactory) return llmFactory(agentRole);
    if (isMultiModel) {
      const modelId = bindings[agentRole];
      const modelConfig = models.find(m => m.id === modelId) || models[0];
      if (modelConfig) {
        const agentOverride = overrides[agentRole] || {};
        const mergedConfig = {
          apiKey: modelConfig.apiKey,
          provider: modelConfig.provider,
          name: modelConfig.name,
          apiBaseUrl: modelConfig.baseUrl || modelConfig.apiBaseUrl || '',
          temperature: agentOverride.temperature !== undefined ? agentOverride.temperature : modelConfig.temperature,
          maxTokens: agentOverride.maxTokens !== undefined ? agentOverride.maxTokens : modelConfig.maxTokens,
          reasoningEnabled: modelConfig.reasoningEnabled === true,
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

  const orchestratorNode = createOrchestratorNode(orchestratorLlm, projectId, globalSystemInstruction);
  const plannerNode      = createAgentNode('planner',      PLANNER_TOOLS,      plannerLlm, projectId, globalSystemInstruction);
  const loreBuilderNode  = createAgentNode('lore_builder', LORE_BUILDER_TOOLS, loreBuilderLlm, projectId, globalSystemInstruction);
  const writerNode       = createAgentNode('writer',       WRITER_TOOLS,       writerLlm, projectId, globalSystemInstruction, true);
  const editorNode       = createAgentNode('editor',       EDITOR_TOOLS,       editorLlm, projectId, globalSystemInstruction, true);

  const orchestratorToolNode  = new ToolNode(ORCHESTRATOR_TOOLS);
  const plannerToolNode       = new ToolNode(PLANNER_TOOLS);
  const loreBuilderToolNode   = new ToolNode(LORE_BUILDER_TOOLS);
  const writerToolNode        = new ToolNode(WRITER_TOOLS);
  const editorToolNode        = new ToolNode(EDITOR_TOOLS);

  // ── 路由函数 ─────────────────────────────────────────────────────────────
  // 专家完成（无 tool_calls）或工具调用超限后回到 orchestrator 汇总
  const routeAfterAgent = (nextToolsNode: string) =>
    (state: typeof AgentState.State) => {
      // 超过工具调用上限时强制结束该专家
      if (state.specialistToolCalls >= MAX_SPECIALIST_TOOL_CALLS) {
        return 'after_specialist';
      }
      const last = state.messages[state.messages.length - 1] as AIMessage;
      return (last.tool_calls && last.tool_calls.length > 0) ? nextToolsNode : 'after_specialist';
    };

  // Orchestrator 产出后：只要有 tool_calls 一律先执行工具（含 delegate_*），
  // 避免出现「有 tool_call 却无对应 ToolMessage」的悬空调用导致后续 LLM 报错
  const routeAfterOrchestrator = (state: typeof AgentState.State) => {
    const last = state.messages[state.messages.length - 1] as AIMessage;
    return (last.tool_calls && last.tool_calls.length > 0) ? 'orchestrator_tools' : END;
  };

  // 进入专家前重置工具调用计数
  const resetSpecialistCountNode = async () => ({
    specialistToolCalls: 0,
  });

  const graph = new StateGraph(AgentState)
    .addNode('orchestrator',       orchestratorNode)
    .addNode('orchestrator_tools', orchestratorToolNode)
    .addNode('after_specialist',   afterSpecialistNode)
    .addNode('reset_specialist',   resetSpecialistCountNode)
    .addNode('planner',            plannerNode)
    .addNode('planner_tools',      plannerToolNode)
    .addNode('planner_tool_count', afterSpecialistToolNode)
    .addNode('lore_builder',       loreBuilderNode)
    .addNode('lore_builder_tools', loreBuilderToolNode)
    .addNode('lore_builder_tool_count', afterSpecialistToolNode)
    .addNode('writer',             writerNode)
    .addNode('writer_tools',       writerToolNode)
    .addNode('writer_tool_count',  afterSpecialistToolNode)
    .addNode('editor',             editorNode)
    .addNode('editor_tools',       editorToolNode)
    .addNode('editor_tool_count',  afterSpecialistToolNode)

    .addEdge(START, 'orchestrator')

    // Orchestrator 根据 tool_call 路由：有工具调用 -> 执行工具；否则结束
    .addConditionalEdges('orchestrator', routeAfterOrchestrator)
    // 工具执行后：有 delegate 信号则去 reset_specialist（重置计数后进入专家），否则回 orchestrator
    .addConditionalEdges('orchestrator_tools', (state: typeof AgentState.State) =>
      resolveDelegateTarget(state.messages) ? 'reset_specialist' : 'orchestrator'
    )

    // 重置计数后按委托信号路由到对应专家节点
    .addConditionalEdges('reset_specialist', (state: typeof AgentState.State) =>
      resolveDelegateTarget(state.messages) ?? 'orchestrator'
    )

    // 专家完成后统一经 after_specialist 累加计数再回 orchestrator 汇总
    .addEdge('after_specialist', 'orchestrator')

    // Specialist agents：有 tool_calls 就用工具（经计数节点），没有或超限则回到 after_specialist
    .addConditionalEdges('planner',      routeAfterAgent('planner_tools'))
    .addEdge('planner_tools', 'planner_tool_count')
    .addEdge('planner_tool_count', 'planner')

    .addConditionalEdges('lore_builder', routeAfterAgent('lore_builder_tools'))
    .addEdge('lore_builder_tools', 'lore_builder_tool_count')
    .addEdge('lore_builder_tool_count', 'lore_builder')

    .addConditionalEdges('writer',       routeAfterAgent('writer_tools'))
    .addEdge('writer_tools', 'writer_tool_count')
    .addEdge('writer_tool_count', 'writer')

    .addConditionalEdges('editor',       routeAfterAgent('editor_tools'))
    .addEdge('editor_tools', 'editor_tool_count')
    .addEdge('editor_tool_count', 'editor');

  return graph.compile({ checkpointer });
}
