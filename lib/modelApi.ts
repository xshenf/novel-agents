// 辅助方法：直接调用大语言模型 API（兼容 OpenAI 协议的各种服务商，同时保留 Gemini 原生协议支持）
import { DEFAULT_API_PROVIDER, DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS, REASONING_MIN_MAX_TOKENS } from './constants';
import { createAgentDebugLogger } from './agentDebugLogger';

export async function callModelApi(apiKey: string, modelName: string, systemInstruction: string, prompt: string, isJson: boolean = false, signal?: AbortSignal): Promise<string> {
  let config = {
    apiKey, apiProvider: DEFAULT_API_PROVIDER, apiBaseUrl: '',
    temperature: DEFAULT_TEMPERATURE, maxTokens: DEFAULT_MAX_TOKENS,
    systemInstruction: '', reasoningEnabled: false,
  };

  // 尝试解析 JSON 打包配置
  if (apiKey?.trim().startsWith('{')) {
    try { config = { ...config, ...JSON.parse(apiKey) }; } catch { /* 视为裸 key */ }
  }

  if (!modelName?.trim()) {
    throw new Error('请先在设置中配置模型名称（Model Name）后再使用 AI 功能');
  }

  const temp = config.temperature ?? DEFAULT_TEMPERATURE;
  // 推理模型兜底：thinking 会先吃掉输出额度，过低会导致正文被截空（与 graph.ts buildLLMFromConfig 同策略）
  let tokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  if (config.reasoningEnabled) {
    tokens = Math.max(tokens, REASONING_MIN_MAX_TOKENS);
  }
  const finalSystemInstruction = [config.systemInstruction, systemInstruction]
    .map(s => s?.trim() || '').filter(Boolean).join('\n');

  const internalTimeout = AbortSignal.timeout(120_000);
  const combinedSignal = signal ? AbortSignal.any([internalTimeout, signal]) : internalTimeout;

  const dbg = createAgentDebugLogger('direct', config.apiProvider);

  // ── Gemini 原生协议（仅当用户显式选择 gemini 时走此分支） ──────────────
  if (config.apiProvider === 'gemini') {
    const rawBase = (config.apiBaseUrl?.trim() || 'https://generativelanguage.googleapis.com')
      .replace(/\/$/, '').replace(/\/v1beta$/, '');
    const url = `${rawBase}/v1beta/models/${modelName}:generateContent`;

    const body: any = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: temp, maxOutputTokens: tokens },
    };
    if (config.reasoningEnabled) body.thinkingConfig = { thinkingBudget: 2048 };
    if (finalSystemInstruction) body.systemInstruction = { parts: [{ text: finalSystemInstruction }] };
    if (isJson) body.generationConfig.responseMimeType = 'application/json';

    dbg.log('gemini_request', { model: modelName, body });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
      body: JSON.stringify(body), signal: combinedSignal,
    });
    if (!response.ok) throw new Error(`Gemini API error (${response.status}): ${await response.text()}`);

    const result = await response.json();
    const parts = result?.candidates?.[0]?.content?.parts || [];
    const text = (parts.find((p: any) => p.thought !== true && typeof p.text === 'string') || parts[0])?.text;
    if (!text) throw new Error('Empty response from Gemini API');

    dbg.logDirectCall('gemini', modelName, finalSystemInstruction, prompt, text);
    return text;
  }

  // ── OpenAI 兼容协议（OpenAI / DeepSeek / Claude / Custom 等） ───────────
  let rawBaseUrl = config.apiBaseUrl?.trim() || 'https://api.openai.com/v1';
  if (!config.apiBaseUrl && config.apiProvider === 'deepseek') rawBaseUrl = 'https://api.deepseek.com/v1';
  const baseUrl = rawBaseUrl.replace(/\/$/, '');
  const url = `${baseUrl}/chat/completions`;

  const messages: any[] = [];
  if (finalSystemInstruction) messages.push({ role: 'system', content: finalSystemInstruction });
  messages.push({ role: 'user', content: prompt });

  const body: any = { model: modelName, messages, temperature: temp, max_tokens: tokens };
  if (isJson) body.response_format = { type: 'json_object' };

  // reasoning 参数：与 graph.ts buildLLMFromConfig 保持一致
  if (config.reasoningEnabled) {
    if (config.apiProvider === 'deepseek') {
      body.reasoning = { enabled: true };
    } else {
      body.thinking = { type: 'enabled', budget_tokens: 2048 };
    }
  }

  dbg.log('openai_request', { url, body });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify(body), signal: combinedSignal,
  });
  if (!response.ok) throw new Error(`${config.apiProvider} API error (${response.status}): ${await response.text()}`);

  const result = await response.json();
  const text = result?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Empty response from ${config.apiProvider} API`);

  dbg.logDirectCall(config.apiProvider, modelName, finalSystemInstruction, prompt, text);
  return text;
}

/**
 * 动态获取当前服务商的可用模型列表
 */
export async function fetchModels(apiKey: string, apiProvider: string, apiBaseUrl?: string): Promise<string[]> {
  if (!apiKey) throw new Error('获取模型列表需要提供 API Key');

  try {
    if (apiProvider === 'gemini') {
      const rawBase = (apiBaseUrl?.trim() || 'https://generativelanguage.googleapis.com')
        .replace(/\/$/, '').replace(/\/v1beta$/, '');
      const res = await fetch(`${rawBase}/v1beta/models`, { headers: { 'x-goog-api-key': apiKey } });
      if (!res.ok) throw new Error(`Gemini API returned status ${res.status}`);
      const data = await res.json();
      return (data.models || [])
        .map((m: any) => (m.name || '').replace(/^models\//, ''))
        .filter(Boolean);
    }

    // OpenAI 兼容接口
    let rawBaseUrl = apiBaseUrl?.trim() || 'https://api.openai.com/v1';
    if (!apiBaseUrl && apiProvider === 'deepseek') rawBaseUrl = 'https://api.deepseek.com/v1';
    const baseUrl = rawBaseUrl.replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`${apiProvider} API returned status ${res.status}`);
    const data = await res.json();
    return (data.data || []).map((m: any) => m.id || '').filter(Boolean);
  } catch (error: any) {
    console.error('Fetch models error:', error);
    throw new Error(`获取模型列表失败: ${error.message || '未知错误'}`);
  }
}
