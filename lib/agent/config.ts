// 统一的 API 配置解析模块
// 消除 graph.ts / tools.ts / ai.ts 三处各自解析 JSON 配置的重复逻辑，
// 所有"apiKey 是 JSON 还是裸字符串"的判断收口在此。

import { DEFAULT_MODEL_NAME, DEFAULT_API_PROVIDER, DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS } from '../constants';

export interface ResolvedModelConfig {
  apiKey: string;
  provider: string;
  name: string;
  apiBaseUrl: string;
  temperature: number;
  maxTokens: number;
  reasoningEnabled: boolean;
}

export interface ResolvedApiConfig {
  apiKey: string;
  provider: string;
  name: string;
  apiBaseUrl: string;
  temperature: number;
  maxTokens: number;
  reasoningEnabled: boolean;
  systemInstruction: string;
  isMultiModel: boolean;
  models: any[];
  bindings: Record<string, string>;
  overrides: Record<string, any>;
}

const DEFAULTS: ResolvedModelConfig = {
  apiKey: '',
  provider: DEFAULT_API_PROVIDER,
  name: DEFAULT_MODEL_NAME,
  apiBaseUrl: '',
  temperature: DEFAULT_TEMPERATURE,
  maxTokens: DEFAULT_MAX_TOKENS,
  reasoningEnabled: false,
};

// 尝试将原始字符串解析为 JSON 对象，失败返回 null。
function tryParseJson(raw: string): any | null {
  const t = raw.trim();
  if (!t.startsWith('{') || !t.endsWith('}')) return null;
  try {
    return JSON.parse(t);
  } catch (e) {
    if (typeof console !== 'undefined') {
      console.warn('[agent-config] JSON 解析失败，将视为普通 API Key:', e);
    }
    return null;
  }
}

// 判断调用方是否注入了「可用」的 API Key（兼容原始字符串与打包 JSON）。
export function hasUsableKey(apiKey?: string): boolean {
  if (!apiKey || !apiKey.trim()) return false;
  const parsed = tryParseJson(apiKey);
  if (parsed) {
    return !!(parsed.apiKey && String(parsed.apiKey).trim());
  }
  return true; // 非 JSON 格式的非空字符串视为裸 Key
}

// 从 apiConfig 中解析指定 agent 角色的模型配置。
// 多模型模式下按 agentModelBindings 查找绑定模型；否则回退到默认。
export function resolveAgentModelConfig(agentRole: string, apiConfig: string): ResolvedModelConfig {
  const parsed = apiConfig ? tryParseJson(apiConfig) : null;
  if (!parsed) return { ...DEFAULTS, apiKey: apiConfig || '' };

  // 多模型模式
  if (Array.isArray(parsed.models) && parsed.agentModelBindings) {
    const modelId = parsed.agentModelBindings[agentRole];
    const model = parsed.models.find((m: any) => m.id === modelId) || parsed.models[0];
    if (model) {
      const overrides = (parsed.agentOverrides || {})[agentRole] || {};
      return {
        apiKey: model.apiKey || '',
        provider: model.provider || DEFAULTS.provider,
        name: model.name || DEFAULTS.name,
        apiBaseUrl: model.baseUrl || model.apiBaseUrl || '',
        temperature: overrides.temperature !== undefined ? overrides.temperature : (model.temperature ?? DEFAULTS.temperature),
        maxTokens: overrides.maxTokens !== undefined ? overrides.maxTokens : (model.maxTokens ?? DEFAULTS.maxTokens),
        reasoningEnabled: model.reasoningEnabled === true,
      };
    }
  }

  // 单模型 / 兼容老格式
  return {
    apiKey: parsed.apiKey || apiConfig,
    provider: parsed.apiProvider || parsed.provider || DEFAULTS.provider,
    name: parsed.modelName || parsed.name || DEFAULTS.name,
    apiBaseUrl: parsed.apiBaseUrl || '',
    temperature: parsed.temperature !== undefined ? parsed.temperature : DEFAULTS.temperature,
    maxTokens: parsed.maxTokens !== undefined ? parsed.maxTokens : DEFAULTS.maxTokens,
    reasoningEnabled: parsed.reasoningEnabled === true,
  };
}

// 获取指定 agent 角色的打包配置字符串（供需要向下传递给 ai.ts 的场景使用）。
export function getAgentConfig(agentRole: string, apiConfig: string): string {
  const cfg = resolveAgentModelConfig(agentRole, apiConfig);
  const parsed = apiConfig ? tryParseJson(apiConfig) : null;
  return JSON.stringify({
    apiKey: cfg.apiKey,
    apiProvider: cfg.provider,
    apiBaseUrl: cfg.apiBaseUrl,
    temperature: cfg.temperature,
    maxTokens: cfg.maxTokens,
    systemInstruction: parsed?.systemInstruction || '',
    reasoningEnabled: cfg.reasoningEnabled,
  });
}

// 获取指定 agent 角色的模型名称。
export function getAgentModelName(agentRole: string, apiConfig: string, defaultModelName: string): string {
  return resolveAgentModelConfig(agentRole, apiConfig).name || defaultModelName;
}

// 判断指定 agent 角色是否配置了可用的 API Key。
export function agentHasKey(agentRole: string, apiConfig: string): boolean {
  return hasUsableKey(getAgentConfig(agentRole, apiConfig));
}

// 完整解析 apiConfig 字符串为 ResolvedApiConfig（供 graph.ts buildNovelAgentGraph 使用）。
export function resolveApiConfig(apiConfig: string, modelName?: string): ResolvedApiConfig {
  const parsed = apiConfig ? tryParseJson(apiConfig) : null;

  if (parsed && Array.isArray(parsed.models) && parsed.agentModelBindings) {
    return {
      apiKey: '',
      provider: '',
      name: modelName || DEFAULTS.name,
      apiBaseUrl: '',
      temperature: DEFAULTS.temperature,
      maxTokens: DEFAULTS.maxTokens,
      reasoningEnabled: false,
      systemInstruction: parsed.systemInstruction || '',
      isMultiModel: true,
      models: parsed.models,
      bindings: parsed.agentModelBindings,
      overrides: parsed.agentOverrides || {},
    };
  }

  const single = resolveAgentModelConfig('', apiConfig);
  return {
    ...single,
    name: modelName || single.name,
    systemInstruction: parsed?.systemInstruction || '',
    isMultiModel: false,
    models: [],
    bindings: {},
    overrides: {},
  };
}
