// 清洗并安全解析 LLM 返回的 JSON 字符串。
// LLM 经常返回带 markdown 代码块标记、尾部注释或其它非法 JSON，直接 JSON.parse 会崩溃。
export function safeParseJSON<T = any>(raw: string, fallback?: T): T {
  // 1. 先直接尝试
  try {
    return JSON.parse(raw);
  } catch { /* continue */ }

  // 2. 剥离 markdown 代码块标记（```json ... ```）
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  try {
    return JSON.parse(cleaned);
  } catch { /* continue */ }

  // 3. 尝试提取第一个完整的 JSON 对象或数组
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch { /* continue */ }
  }
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      return JSON.parse(arrMatch[0]);
    } catch { /* continue */ }
  }

  // 4. 全部失败：抛出或返回 fallback
  if (fallback !== undefined) return fallback;
  throw new Error(`Failed to parse JSON from LLM response: ${raw.slice(0, 200)}...`);
}
