import { useNovelStore } from '@/lib/store';

export type CallAIApi = (bodyParams: Record<string, any>) => Promise<Response>;

// 统一的 AI 接口调用：根据 action 映射到对应职能智能体，并解析其绑定模型与微调参数
export function useAiClient(): CallAIApi {
  const store = useNovelStore();

  const callAIApi: CallAIApi = async (bodyParams) => {
    const action = bodyParams.action;

    // 动作与智能体职能角色的映射
    let agentRole = 'orchestrator';
    if (action === 'autoPlanBook' || action === 'outline' || action === 'generateKernel') {
      agentRole = 'planner';
    } else if (action === 'generateInspirations') {
      agentRole = 'lore_builder';
    } else if (action === 'autoWrite' || action === 'continue') {
      agentRole = 'writer';
    } else if (action === 'polish' || action === 'selfCheck' || action === 'summarize') {
      agentRole = 'editor';
    }

    const modelId = store.agentModelBindings[agentRole] || store.models[0]?.id;
    const model = store.models.find(m => m.id === modelId) || store.models[0];

    let apiKeyParam = '';
    let modelNameParam = '';

    if (model) {
      modelNameParam = model.name;
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
    } else {
      apiKeyParam = store.apiKey;
      if (store.apiKey && store.apiProvider) {
        apiKeyParam = JSON.stringify({
          apiKey: store.apiKey,
          apiProvider: store.apiProvider,
          apiBaseUrl: store.apiBaseUrl,
          temperature: store.temperature,
          maxTokens: store.maxTokens,
          systemInstruction: store.systemInstruction,
          reasoningEnabled: store.reasoningEnabled === true
        });
      }
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
    });
  };

  return callAIApi;
}
