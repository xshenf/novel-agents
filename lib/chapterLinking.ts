// 大纲节点（分卷×章节）与正文章节（store.chapters）的统一对账。
// 原先散落在 WorkspaceSidebar 的 extractChapterNumber/titlesMatch 集中到此，
// 供侧栏与生成控制复用，消除重复匹配逻辑。
//
// 注意：当前仍是「标题模糊匹配」，非稳定 ID 关联（稳定 ID 留待后续阶段）。
import type { Chapter } from './db';
import type { OutlineVolume } from './outlineParser';
import { parseStructureOutline, generateMarkdownFromSections } from './outlineParser';
import { OUTLINE_DEFAULT_FIRST_VOLUME } from './constants';
import { countChineseChars } from './textStats';

export type ChapterStatus = 'unwritten' | 'draft' | 'done';

const CN_NUMS: Record<string, number> = {
  '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
  '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '百': 100,
};

/**
 * Convert a Chinese numeral string to an Arabic number.
 * Supports simple forms like 一, 十二, 二十三, 一百二十三.
 * Returns NaN for unrecognised input.
 */
function chineseToNumber(str: string): number {
  if (!str) return NaN;
  let result = 0;
  let current = 0;
  for (const ch of str) {
    const val = CN_NUMS[ch];
    if (val === undefined) return NaN;
    if (val === 100) {
      result += (current || 1) * 100;
      current = 0;
    } else if (val === 10) {
      result += (current || 1) * 10;
      current = 0;
    } else {
      current = val;
    }
  }
  return result + current;
}

// 从章节标题中抽取「第N章/节/回」中的序号（支持阿拉伯数字和中文数字），未命中则返回 null
export function extractChapterNumber(title: string): number | null {
  // Match Arabic numerals
  const arabicMatch = title.match(/第\s*(\d+)\s*(?:章|节|回|折|卷)/);
  if (arabicMatch) return parseInt(arabicMatch[1], 10);
  // Match Chinese numerals
  const cnMatch = title.match(/第\s*([零一两二三四五六七八九十百]+)\s*(?:章|节|回|折|卷)/);
  if (cnMatch) {
    const n = chineseToNumber(cnMatch[1]);
    return isNaN(n) ? null : n;
  }
  return null;
}

// 匹配规则（按优先级）：
// 1) 标题完全一致；
// 2) 去掉「第N章：」前缀后一致；
// 3) 任意一边能抽出章号且相等；
// 4) 大纲是占位标题（空 / 「新章节」/「新卷」）时，按章号匹配。
export function titlesMatch(outlineTitle: string, writtenTitle: string): boolean {
  if (!outlineTitle || !writtenTitle) return false;
  if (outlineTitle === writtenTitle) return true;
  const stripped = outlineTitle.replace(/^第.+(?:章|节|回|折)[：: ]\s*/, '');
  if (stripped && stripped === writtenTitle) return true;
  const num1 = extractChapterNumber(outlineTitle);
  const num2 = extractChapterNumber(writtenTitle);
  if (num1 !== null && num1 === num2) return true;
  const isPlaceholder = !outlineTitle.trim() || outlineTitle.trim() === '新章节' || outlineTitle.trim() === '新卷';
  if (isPlaceholder && num2 !== null) return true;
  return false;
}

// 在正文章节集合中找到与某大纲章节标题匹配的已写章节
export function findWritten(outlineTitle: string, chapters: Chapter[]): Chapter | null {
  return chapters.find(c => titlesMatch(outlineTitle, c.title)) ?? null;
}

// 预构建多维度索引，将 findWritten 的 O(m) 线性扫描降为 O(1) 哈希查找
function buildChapterIndex(chapters: Chapter[]): Map<string, Chapter> {
  const index = new Map<string, Chapter>();
  for (const c of chapters) {
    // 精确标题
    if (!index.has(`t:${c.title}`)) index.set(`t:${c.title}`, c);
    // 去掉「第N章/节/回」前缀后的标题
    const stripped = c.title.replace(/^第.+(?:章|节|回|折)[：: ]\s*/, '');
    if (stripped && !index.has(`s:${stripped}`)) index.set(`s:${stripped}`, c);
    // 章节序号
    const num = extractChapterNumber(c.title);
    if (num !== null && !index.has(`n:${num}`)) index.set(`n:${num}`, c);
  }
  return index;
}

// 使用预构建索引做 O(1) 查找，优先级与 titlesMatch 一致
function findWrittenIndexed(outlineTitle: string, index: Map<string, Chapter>): Chapter | null {
  if (!outlineTitle) return null;
  // 1) 精确匹配
  const exact = index.get(`t:${outlineTitle}`);
  if (exact) return exact;
  // 2) 去前缀匹配
  const stripped = outlineTitle.replace(/^第.+(?:章|节|回|折)[：: ]\s*/, '');
  if (stripped) {
    const m = index.get(`s:${stripped}`);
    if (m) return m;
  }
  // 3) 章节序号匹配
  const num = extractChapterNumber(outlineTitle);
  if (num !== null) {
    const m = index.get(`n:${num}`);
    if (m) return m;
  }
  // 4) 占位标题（空/「新章节」/「新卷」）——按序号已在步骤 3 处理
  return null;
}

// 章节写作状态：无正文/空 => 待写；有正文无摘要 => 草稿；有正文且有摘要 => 已完成
export function statusOf(written: Chapter | null): ChapterStatus {
  if (!written || written.content.trim() === '') return 'unwritten';
  if (!written.summary || written.summary.trim() === '') return 'draft';
  return 'done';
}

export const STATUS_LABEL: Record<ChapterStatus, string> = {
  unwritten: '待写',
  draft: '草稿',
  done: '已完成',
};

// 正文字数（去空白）；未写返回 0
export function chapterWordCount(written: Chapter | null): number {
  return written ? countChineseChars(written.content) : 0;
}

// 收集「未被任何大纲章节匹配」的自由正文章节
export function collectOrphans(sections: OutlineVolume[], chapters: Chapter[]): Chapter[] {
  const index = buildChapterIndex(chapters);
  const matched = new Set<string>();
  sections.forEach(vol => vol.chapters.forEach(chap => {
    const m = findWrittenIndexed(chap.title, index);
    if (m) matched.add(m.id);
  }));
  return chapters.filter(c => !matched.has(c.id));
}

// 确保某章节标题在大纲中有对应条目：没有则追加（大纲为空时先建默认第一卷）。
// 前端侧栏与编导的项目概览都按大纲结构渲染/判断进度——agent 直接写出的章节若不进大纲，
// 用户看不到、编导也会误判"还没写"。返回更新后的大纲 Markdown；已有匹配条目返回 null（无需变更）。
export function ensureChapterInOutline(outlineFull: string, chapterTitle: string): string | null {
  if (!chapterTitle.trim()) return null;
  const volumes = parseStructureOutline(outlineFull || '');
  for (const vol of volumes) {
    for (const ch of vol.chapters) {
      if (titlesMatch(ch.title, chapterTitle)) return null;
    }
  }
  const newChapter = { title: chapterTitle, content: '', details: [] as { key: string; value: string }[], isLocked: false };
  if (volumes.length === 0) {
    volumes.push({ title: OUTLINE_DEFAULT_FIRST_VOLUME, content: '', chapters: [newChapter], isLocked: false });
  } else {
    volumes[volumes.length - 1].chapters.push(newChapter);
  }
  return generateMarkdownFromSections(volumes);
}

export interface NextTarget {
  volIdx: number;
  chapIdx: number;
  title: string;
  written: Chapter | null;
}

// 找出「下一个待写章节」：大纲顺序中第一个匹配正文为空/缺失的章节。
// 用于生成控制展示「下一章是 X」。
export function nextUnwritten(sections: OutlineVolume[], chapters: Chapter[]): NextTarget | null {
  const index = buildChapterIndex(chapters);
  for (let v = 0; v < sections.length; v++) {
    const vol = sections[v];
    for (let c = 0; c < vol.chapters.length; c++) {
      const chap = vol.chapters[c];
      const written = findWrittenIndexed(chap.title, index);
      if (statusOf(written) === 'unwritten') {
        return { volIdx: v, chapIdx: c, title: chap.title || `第 ${c + 1} 章`, written };
      }
    }
  }
  return null;
}
