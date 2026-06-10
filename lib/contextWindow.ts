// 共享的上下文 token 预算工具：正文滑动窗口选择
// 供标准链路（lib/memory.ts 正文窗口层）与极简链路（lib/minimalWriter.ts 滑动窗口）共用

// 估算 token 数：中文约 1.5 字/token，英文约 4 字符/token
export const CHARS_PER_TOKEN = 1.5;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export interface RecentContentWindow {
  text: string;
  includedIds: string[];
}

// 从最近往前按 token 预算装章节正文，装不下即停。
// chapters 按章节自然顺序（升序）传入，输出保持升序。
// 最近一章单章超预算时退而截取其末尾——衔接情节末梢的价值最高。
export function selectRecentContentWindow(
  chapters: { id: string; title: string; content: string }[],
  budgetTokens: number,
): RecentContentWindow {
  if (budgetTokens <= 0 || chapters.length === 0) return { text: '', includedIds: [] };

  const picked: { id: string; block: string }[] = [];
  let used = 0;
  for (let i = chapters.length - 1; i >= 0; i--) {
    const c = chapters[i];
    const block = `【${c.title}】\n${c.content}`;
    const tokens = estimateTokens(block);
    if (used + tokens > budgetTokens) break;
    picked.unshift({ id: c.id, block });
    used += tokens;
  }

  if (picked.length === 0) {
    const last = chapters[chapters.length - 1];
    const maxChars = Math.floor(budgetTokens * CHARS_PER_TOKEN);
    const tail = last.content.slice(-maxChars);
    return {
      text: `【${last.title}】（正文过长，以下为本章末尾部分）\n……${tail}`,
      includedIds: [last.id],
    };
  }

  return {
    text: picked.map(p => p.block).join('\n\n'),
    includedIds: picked.map(p => p.id),
  };
}
