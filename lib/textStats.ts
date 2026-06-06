// 中文正文字数统计：去除所有空白后按码点计数。
// 取代 editorContent.length（会把空格/换行/制表都算进字数）。
export function countChineseChars(text: string): number {
  if (!text) return 0;
  // Array.from 按码点切分，避免 emoji / 生僻字代理对被算成 2 个字。
  return Array.from(text.replace(/\s+/g, '')).length;
}
