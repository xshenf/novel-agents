// 辅助方法：直接调用大语言模型 API（支持 Gemini 及多种 OpenAI 兼容服务商）
export async function callModelApi(apiKey: string, modelName: string, systemInstruction: string, prompt: string, isJson: boolean = false): Promise<string> {
  // 默认配置
  let config = {
    apiKey: apiKey,
    apiProvider: 'gemini',
    apiBaseUrl: '',
    temperature: 0.7,
    maxTokens: 3000,
    systemInstruction: '',
    reasoningEnabled: false
  };

  // 尝试解析 JSON 包装的全面配置
  if (apiKey && apiKey.trim().startsWith('{') && apiKey.trim().endsWith('}')) {
    try {
      const parsed = JSON.parse(apiKey);
      config = { ...config, ...parsed };
    } catch (e) {
      // 解析失败则视其为普通的单个 apiKey
    }
  }

  const temp = config.temperature ?? 0.7;
  const tokens = config.maxTokens ?? 3000;
  
  // 合并系统提示词
  const finalSystemInstruction = [config.systemInstruction, systemInstruction]
    .map(s => s ? s.trim() : '')
    .filter(Boolean)
    .join('\n');

  // 1. 如果是 Gemini 服务商协议
  if (config.apiProvider === 'gemini') {
    const model = modelName || 'gemini-2.5-flash';
    const rawBaseUrl = config.apiBaseUrl ? config.apiBaseUrl.trim() : 'https://generativelanguage.googleapis.com';
    const baseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;
    const url = `${baseUrl}/v1beta/models/${model}:generateContent`;

    const body: any = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: temp,
        maxOutputTokens: tokens
      }
    };

    if (config.reasoningEnabled) {
      body.thinkingConfig = {
        thinkingBudget: 2048
      };
    }

    if (finalSystemInstruction) {
      body.systemInstruction = {
        parts: [{ text: finalSystemInstruction }]
      };
    }

    if (isJson) {
      body.generationConfig.responseMimeType = 'application/json';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errText}`);
    }

    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Empty response from Gemini API');
    }
    return text;
  }

  // 2. 如果是 OpenAI 或其他兼容的 API 协议（OpenAI, DeepSeek, Claude 中转, Custom 等）
  else {
    let rawBaseUrl = 'https://api.openai.com/v1';
    if (config.apiProvider === 'deepseek') {
      rawBaseUrl = 'https://api.deepseek.com/v1';
    } else if (config.apiBaseUrl) {
      rawBaseUrl = config.apiBaseUrl.trim();
    }
    const baseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;
    const url = `${baseUrl}/chat/completions`;

    // 确定模型名称
    let model = modelName;
    if (!model) {
      if (config.apiProvider === 'deepseek') {
        model = 'deepseek-chat';
      } else if (config.apiProvider === 'openai') {
        model = 'gpt-4o-mini';
      } else {
        model = 'gpt-4o-mini'; // 兜底
      }
    }

    const messages: any[] = [];
    if (finalSystemInstruction) {
      messages.push({
        role: 'system',
        content: finalSystemInstruction
      });
    }
    messages.push({
      role: 'user',
      content: prompt
    });

    const body: any = {
      model: model,
      messages: messages,
      temperature: temp,
      max_tokens: tokens
    };

    if (isJson) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`${config.apiProvider} API error (${response.status}): ${errText}`);
    }

    const result = await response.json();
    const text = result?.choices?.[0]?.message?.content;
    if (text === undefined || text === null) {
      throw new Error(`Empty response from ${config.apiProvider} API`);
    }
    return text;
  }
}
