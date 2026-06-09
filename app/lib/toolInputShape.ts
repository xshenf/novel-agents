// 工具输入/输出形状归一化层。
// langchain 的 tool input 可能被包装成 { input: '<json>' } 或直接是对象/字符串，
// tool result（ToolMessage）可能是 langchain 序列化格式 { lc, type, kwargs: { content } }。
// 本模块提供统一的解包函数，让上层业务代码不必关心底层序列化差异。

/**
 * 将 langchain 可能包装的 tool input 归一化为原生 JS 对象或 null。
 *
 * 常见形态：
 *   1. 直接是对象：{ projectId: '...', numChapters: 10 }
 *   2. langchain 包装：{ input: '{"projectId":"...","numChapters":10}' }
 *   3. 字符串形式的 JSON：'{"projectId":"..."}'
 *   4. null / undefined
 */
export function coerceToolInput(raw: unknown): Record<string, unknown> | null {
  if (raw === undefined || raw === null) return null;

  // 字符串：尝试 JSON 解析
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return { input: trimmed };
    } catch {
      return { input: trimmed };
    }
  }

  // 对象
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;

    // langchain 包装：{ input: '<json-string>' }
    if (obj.input !== undefined && Object.keys(obj).length <= 2) {
      const inner = obj.input;
      if (typeof inner === 'string') {
        try {
          const parsed = JSON.parse(inner);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
          }
        } catch {
          // input 不是 JSON，直接返回原对象
        }
      }
    }

    return obj;
  }

  // 数组或其他类型：包装为 { input }
  return { input: raw };
}

/**
 * 从 langchain ToolMessage 的 content 中提取纯文本。
 *
 * 常见形态：
 *   1. 纯文本：'章节已保存'
 *   2. langchain 序列化：'{"lc":1,"type":"constructor","id":[...],"kwargs":{"content":"已更新","status":"success",...}}'
 *   3. 顶层 content JSON：'{"content":"文本","type":"result"}'
 *   4. null / undefined / 空字符串
 */
export function extractToolMessageContent(raw: unknown): string {
  if (raw === undefined || raw === null) return '';
  if (typeof raw !== 'string') return '';

  const text = raw.trim();
  if (!text) return '';

  // 尝试作为 JSON 解析
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);

      // langchain 序列化格式：{ kwargs: { content: '...' } }
      if (parsed.kwargs && typeof parsed.kwargs === 'object') {
        const kc = (parsed.kwargs as Record<string, unknown>).content;
        if (typeof kc === 'string') return kc;
      }

      // 顶层 content 字段
      if (typeof parsed.content === 'string') return parsed.content;

      // 无法提取，返回原始文本
    } catch {
      // 不是合法 JSON，返回原始文本
    }
  }

  // 纯文本或无法解析的 JSON，原样返回
  return text;
}
