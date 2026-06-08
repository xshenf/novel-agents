// 工具输入/输出形状兼容：langchain 的 on_tool_start / on_tool_end 事件里
// data.input 常见形式：
//   1) 直接是对象 { projectId, field, value, ... }
//   2) 字符串 JSON '"{...}"'（需要 parse）
//   3) langchain 包装对象 { input: '<json string>' } 或 { input: { ... } }
// data.output 常见形式：
//   1) 工具返回的纯文本字符串
//   2) langchain ToolMessage 完整对象 JSON dump（带 lc/type/id/kwargs.content）
// 把这些兼容逻辑集中到一处，前端所有用到 toolInput / toolResult 的地方都先过一遍。

/**
 * 把 toolInput 标准化为"实际的 schema 对象"（让 inferrer / 渲染都能直接 .field / .value）。
 * 兼容三种 langchain 形态：对象 / 字符串 / 包装对象。
 */
export function coerceToolInput(input: unknown): unknown {
  if (input === undefined || input === null) return input;
  // 形态 1：字符串 → 尝试 parse
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return input;
    if (s[0] === '{' || s[0] === '[') {
      try {
        return JSON.parse(s);
      } catch {
        return input;
      }
    }
    return input;
  }
  // 形态 2：包装对象 { input: '<json string>' } 或 { input: { ... } }
  if (typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    // 只在只有一个 'input' 字段、且没有其他 schema 字段时，unwrap
    // 否则认为是 schema 本身（避免误判 schema 真的有个 input 字段的工具）
    const keys = Object.keys(obj);
    if (keys.length === 1 && 'input' in obj) {
      const inner = obj.input;
      if (typeof inner === 'string') {
        try {
          const parsed = JSON.parse(inner);
          if (parsed && typeof parsed === 'object') return parsed;
        } catch {
          // 保持原样
        }
      } else if (inner && typeof inner === 'object') {
        return inner;
      }
    }
    return obj;
  }
  return input;
}

/**
 * 从 toolResult 文本里提取"内容"。
 * langchain 0.1+ 的 on_tool_end 在某些链路上 data.output 是 ToolMessage 完整对象的
 * JSON 序列化（包含 lc / type / id / kwargs.content 等），直接渲染会让用户看到
 * 一坨内部结构。这里尝试从这类字符串里挑出真正的 content 文本。
 */
export function extractToolMessageContent(raw: string | undefined | null): string {
  if (!raw) return '';
  const s = String(raw);
  if (!looksLikeLangchainDump(s)) return s;
  // 1) kwargs.content
  const m = s.match(/"kwargs"\s*:\s*\{[\s\S]*?"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (m) {
    try {
      return JSON.parse('"' + m[1] + '"');
    } catch {
      return m[1];
    }
  }
  // 2) 顶层 content
  const m2 = s.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (m2) {
    try {
      return JSON.parse('"' + m2[1] + '"');
    } catch {
      return m2[1];
    }
  }
  return s;
}

function looksLikeLangchainDump(s: string): boolean {
  return s.length > 80 && (s.includes('"lc"') || s.includes('langchain_core') || s.includes('"kwargs"') || (s.includes('ToolMessage') && s.includes('"id"')));
}
