// 大纲节点（分卷×章节）与正文章节（store.chapters）的统一对账。
// 原先散落在 WorkspaceSidebar 的 extractChapterNumber/titlesMatch 集中到此，
// 供侧栏与生成控制复用，消除重复匹配逻辑。
//
// 注意：当前仍是「标题模糊匹配」，非稳定 ID 关联（稳定 ID 留待后续阶段）。
import type { Chapter } from './db';
import type { OutlineVolume } from './outlineParser';
import { countChineseChars } from './textStats';

export type ChapterStatus = 'unwritten' | 'draft' | 'done';

// 从章节标题中抽取「第N章/节/回」中的序号，未命中则返回 null
export function extractChapterNumber(title: string): number | null {
  const m = title.match(/第\s*(\d+)\s*(?:章|节|回|折|卷)/);
  return m ? parseInt(m[1], 10) : null;
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
  const matched = new Set<string>();
  sections.forEach(vol => vol.chapters.forEach(chap => {
    const m = findWritten(chap.title, chapters);
    if (m) matched.add(m.id);
  }));
  return chapters.filter(c => !matched.has(c.id));
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
  for (let v = 0; v < sections.length; v++) {
    const vol = sections[v];
    for (let c = 0; c < vol.chapters.length; c++) {
      const chap = vol.chapters[c];
      const written = findWritten(chap.title, chapters);
      if (statusOf(written) === 'unwritten') {
        return { volIdx: v, chapIdx: c, title: chap.title || `第 ${c + 1} 章`, written };
      }
    }
  }
  return null;
}
