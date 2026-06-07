import { useCallback } from 'react';
import { useNovelStore } from '@/lib/store';

export type CallAIApi = (bodyParams: Record<string, any>, signal?: AbortSignal) => Promise<Response>;

// 统一的 AI 接口调用：根据 action 映射到对应职能智能体，并解析其绑定模型与微调参数
export function useAiClient(): CallAIApi {
  const store = useNovelStore();

  const callAIApi: CallAIApi = useCallback(async (bodyParams, signal) => {
    const action = bodyParams.action;

    // 动作与智能体职能角色的映射
    const AGENT_ROLE_MAP: Record<string, string> = {
      autoPlanBook: 'planner',
      outline: 'planner',
      generateKernel: 'planner',
      chat: 'planner',
      generateInspirations: 'lore_builder',
      autoWrite: 'writer',
      continue: 'writer',
      polish: 'editor',
      selfCheck: 'editor',
      summarize: 'editor',
      foldSynopsis: 'editor',
    };
    const agentRole = AGENT_ROLE_MAP[action] || 'orchestrator';

    const modelId = store.agentModelBindings[agentRole] || store.models[0]?.id;
    const model = store.models.find(m => m.id === modelId) || store.models[0];

    // 组装多模型配置：优先使用 agent 绑定模型，否则回退到顶层默认
    let apiKeyParam: string;
    let modelNameParam: string;

    if (model) {
      const overrides = store.agentOverrides[agentRole] || {};
      apiKeyParam = JSON.stringify({
        apiKey: model.apiKey,
        apiProvider: model.provider,
        apiBaseUrl: model.apiBaseUrl,
        temperature: overrides.temperature !== undefined ? overrides.temperature : model.temperature,
        maxTokens: overrides.maxTokens !== undefined ? overrides.maxTokens : model.maxTokens,
        systemInstruction: store.systemInstruction,
        reasoningEnabled: model.reasoningEnabled === true
      });
      modelNameParam = model.name;
    } else {
      apiKeyParam = JSON.stringify({
        apiKey: store.apiKey,
        apiProvider: store.apiProvider,
        apiBaseUrl: store.apiBaseUrl,
        temperature: store.temperature,
        maxTokens: store.maxTokens,
        systemInstruction: store.systemInstruction,
        reasoningEnabled: store.reasoningEnabled === true
      });
      modelNameParam = store.modelName;
    }

    return await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: apiKeyParam,
        modelName: modelNameParam,
        ...bodyParams,
      }),
      signal,
    });
  }, [store]);

  return callAIApi;
}
