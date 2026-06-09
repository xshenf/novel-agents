// 极简写作模式：只生成分卷大纲，然后逐章写作，滑动窗口管理上下文
// 上下文 = 大纲 + 最近 N 章正文；上下文快满时，最远的章节替换为其大纲条目

import { callModelApi } from './modelApi';
import { db } from './db';
import { parseStructureOutline, generateMarkdownFromSections, type OutlineVolume } from './outlineParser';
import { hasUsableKey } from './agent/config';
import { formatAntiAiInstructions } from './rules';

// ── 上下文窗口常量 ──────────────────────────────────────────────────────────
// 估算 token 数：中文约 1.5 字/token，英文约 4 字符/token
const CHARS_PER_TOKEN = 1.5;
// 上下文窗口上限（token 数），留出 system prompt + 生成空间
const CONTEXT_WINDOW_TOKENS = 60_000;
// 保留给 system prompt + 生成输出的 token 余量
const RESERVED_TOKENS = 8_000;
// 可用于上下文注入的最大 token 数
const AVAILABLE_TOKENS = CONTEXT_WINDOW_TOKENS - RESERVED_TOKENS;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// ── 1. 生成分卷大纲 ─────────────────────────────────────────────────────────
export async function generateMinimalOutline(
  projectId: string,
  numVolumes: number,
  apiKey?: string,
  modelName?: string,
  signal?: AbortSignal,
): Promise<string> {
  const project = await db.getProject(projectId);
  if (!project) throw new Error('未找到该项目');

  const styleBlock = (project.styleSetting || '').trim()
    ? `\n本书文风：${project.styleSetting}` : '';
  const worldBlock = (project.worldSetting || '').trim()
    ? `\n世界观：${project.worldSetting}` : '';
  const conflictBlock = (project.coreConflict || '').trim()
    ? `\n核心冲突：${project.coreConflict}` : '';
  const goldBlock = (project.goldFinger || '').trim()
    ? `\n金手指：${project.goldFinger}` : '';

  const systemInstruction = `你是一位资深网络小说架构师。你的任务是根据小说的基本设定，生成一份精炼的分卷大纲。
要求：
1. 只生成分卷级别的概要，每卷包含：卷名、本卷核心事件（2-3句）、本卷结尾钩子。
2. 不要展开到章节级别。
3. 输出格式为 Markdown，每个分卷用一级标题 # 开头，卷名后跟概要段落。
4. 简洁克制，每卷概要不超过 100 字。`;

  const prompt = `【书名】：${project.title}
【简介】：${project.description}${styleBlock}${worldBlock}${conflictBlock}${goldBlock}

请为这部小说生成 ${numVolumes} 个分卷的大纲概要。`;

  if (!hasUsableKey(apiKey)) {
    throw new Error('请先配置 API Key 后再使用极简写作');
  }

  const outline = await callModelApi(apiKey!, modelName || '', systemInstruction, prompt, false, signal);

  // 持久化到项目大纲字段
  await db.updateProject(projectId, { outlineFull: outline });

  return outline;
}

// ── 2. 为指定分卷展开章节大纲 ───────────────────────────────────────────────
export async function expandVolumeOutline(
  projectId: string,
  volumeIndex: number,
  numChapters: number,
  apiKey?: string,
  modelName?: string,
  signal?: AbortSignal,
): Promise<string> {
  const project = await db.getProject(projectId);
  if (!project) throw new Error('未找到该项目');

  const volumes = parseStructureOutline(project.outlineFull || '');
  if (volumeIndex < 0 || volumeIndex >= volumes.length) {
    throw new Error(`分卷索引 ${volumeIndex} 越界`);
  }

  const targetVolume = volumes[volumeIndex];
  const otherVolumesSummary = volumes
    .filter((_, i) => i !== volumeIndex)
    .map(v => `- ${v.title}：${v.content || '暂无概要'}`)
    .join('\n');

  const styleBlock = (project.styleSetting || '').trim()
    ? `\n本书文风：${project.styleSetting}` : '';

  const systemInstruction = `你是一位资深网络小说架构师。你的任务是为指定分卷展开章节大纲。
要求：
1. 每章用二级标题 ## 开头，后跟章节标题。
2. 每章包含 2-3 句概要，说明核心事件、冲突与章末钩子。
3. 章节之间有节奏感，张弛交替。
4. 只输出章节大纲，不要输出其他内容。`;

  const prompt = `【书名】：${project.title}
【其他分卷概览】：
${otherVolumesSummary}

【当前分卷】：${targetVolume.title}
【本卷概要】：${targetVolume.content || '暂无'}${styleBlock}

请为本卷展开 ${numChapters} 个章节的大纲。`;

  if (!hasUsableKey(apiKey)) {
    throw new Error('请先配置 API Key 后再使用极简写作');
  }

  const chapterOutline = await callModelApi(apiKey!, modelName || '', systemInstruction, prompt, false, signal);

  // 将展开的章节合并回大纲
  const parsedNewChapters = parseStructureOutline(chapterOutline);
  const newChapters = parsedNewChapters.flatMap(v => v.chapters);
  volumes[volumeIndex] = {
    ...targetVolume,
    chapters: [...targetVolume.chapters, ...newChapters],
  };
  const md = generateMarkdownFromSections(volumes);
  await db.updateProject(projectId, { outlineFull: md });

  return md;
}

// ── 3. 构建滑动窗口上下文 ───────────────────────────────────────────────────
// 上下文 = 分卷大纲 + 最近 N 章正文（远的章节替换为其大纲条目）
export async function buildMinimalContext(
  projectId: string,
  currentChapterTitle: string,
): Promise<string> {
  const project = await db.getProject(projectId);
  if (!project) return '';

  const chapters = await db.getChapters(projectId);
  const volumes = parseStructureOutline(project.outlineFull || '');

  // 找到当前章节所在分卷的大纲
  let currentVolumeOutline = '';
  let currentChapterOutline = '';
  for (const vol of volumes) {
    for (const ch of vol.chapters) {
      if (titlesMatch(ch.title, currentChapterTitle)) {
        currentVolumeOutline = formatVolumeOutline(vol);
        currentChapterOutline = formatChapterOutline(ch);
        break;
      }
    }
    if (currentChapterOutline) break;
  }

  const parts: string[] = [];

  // 1. 项目核心设定（极简）
  const kernel = buildKernelSummary(project);
  if (kernel) parts.push(kernel);

  // 2. 全部分卷大纲概要
  const outlineSummary = volumes.map(v =>
    `${v.title}：${v.content || '暂无概要'}`
  ).join('\n');
  parts.push(`【分卷大纲】：\n${outlineSummary}`);

  // 3. 当前分卷的详细大纲
  if (currentVolumeOutline) {
    parts.push(`【当前分卷大纲】：\n${currentVolumeOutline}`);
  }

  // 4. 当前章节大纲
  if (currentChapterOutline) {
    parts.push(`【本章大纲（务必围绕此大纲撰写正文）】：\n${currentChapterOutline}`);
  }

  // 5. 已写章节：滑动窗口（近的放正文，远的放大纲条目）
  const writtenChapters = chapters.filter(c => c.content && c.content.trim());
  if (writtenChapters.length > 0) {
    const { context: chapterContext } = buildSlidingWindow(writtenChapters, volumes);
    parts.push(chapterContext);
  }

  return parts.join('\n\n');
}

// ── 4. 极简模式写一章 ───────────────────────────────────────────────────────
export async function minimalWriteChapter(
  projectId: string,
  chapterTitle: string,
  chapterId: string,
  apiKey?: string,
  modelName?: string,
  instruction?: string,
  signal?: AbortSignal,
): Promise<string> {
  const project = await db.getProject(projectId);
  if (!project) throw new Error('未找到该项目');

  // 构建滑动窗口上下文
  const context = await buildMinimalContext(projectId, chapterTitle);

  // 文风与反 AI 规则
  const styleBlock = (project.styleSetting || '').trim()
    ? `\n本书文风（务必严格贴合）：${project.styleSetting}` : '';
  const antiAiLines = formatAntiAiInstructions(project.antiAiStyleRules);
  const antiAiBlock = antiAiLines
    ? `\n请严格遵守以下反AI写作规则：\n${antiAiLines}` : '';
  const forbiddenBlock = (project.forbiddenSetting || '').trim()
    ? `\n禁止出现的设定/情节：${project.forbiddenSetting}` : '';

  // few-shot：取最近一章正文片段
  const allChapters = await db.getChapters(projectId);
  let styleExemplar = '';
  for (let i = allChapters.length - 1; i >= 0; i--) {
    const c = (allChapters[i].content || '').trim();
    if (c.length >= 200) { styleExemplar = c.slice(0, 400); break; }
  }
  const exemplarBlock = styleExemplar
    ? `\n\n【本书已有正文片段（请模仿其笔触与节奏，不要照抄情节）】：\n${styleExemplar}`
    : '';

  const systemInstruction = `你是一个职业网文写手，正在逐章创作一部网络小说。
你的任务是根据提供的大纲和前文上下文，撰写当前章节的正文。

要求：
1. 章节标题是："${chapterTitle}"。
2. 字数在 1500 字左右，结构包含：起（环境烘托与引子）、承（角色互动与对话）、转（核心冲突与博弈）、合（悬念留白与下章伏笔）。
3. 严格遵循大纲中的剧情走向，不得偏离。
4. 行文文风必须与本书既定文风严格一致。${styleBlock}${antiAiBlock}${forbiddenBlock}
5. 仅输出正文，不要附加任何元叙述。`;

  const prompt = `${context}${exemplarBlock}

${instruction ? `【写作指令】：${instruction}\n\n` : ''}请撰写章节"${chapterTitle}"的完整正文：`;

  if (!hasUsableKey(apiKey)) {
    throw new Error('请先配置 API Key 后再使用极简写作');
  }

  const text = await callModelApi(apiKey!, modelName || '', systemInstruction, prompt, false, signal);

  // 保存到数据库
  await db.updateChapter(chapterId, { content: text });

  return text;
}

// ── 辅助函数 ─────────────────────────────────────────────────────────────────

function titlesMatch(outlineTitle: string, chapterTitle: string): boolean {
  const t1 = outlineTitle.trim();
  const t2 = chapterTitle.trim();
  if (t1 === t2) return true;
  // 去掉章节序号后比较
  const clean = (t: string) => t.replace(/^第[一二三四五六七八九十百\d]+章[：:\s\-]*/, '').trim();
  const c1 = clean(t1);
  const c2 = clean(t2);
  return c1.length > 0 && c2.length > 0 && (c1.includes(c2) || c2.includes(c1));
}

function formatVolumeOutline(vol: OutlineVolume): string {
  let text = `${vol.title}：${vol.content || '暂无概要'}`;
  if (vol.chapters.length > 0) {
    text += '\n' + vol.chapters.map(ch => {
      let line = `  - ${ch.title}`;
      if (ch.content) line += `：${ch.content}`;
      return line;
    }).join('\n');
  }
  return text;
}

function formatChapterOutline(ch: { title: string; content: string; details: { key: string; value: string }[] }): string {
  let text = `- ${ch.title}`;
  if (ch.content) text += `：${ch.content}`;
  if (ch.details?.length) {
    text += '\n' + ch.details.map(d => `  * ${d.key}：${d.value}`).join('\n');
  }
  return text;
}

function buildKernelSummary(project: {
  title: string;
  description?: string;
  worldSetting?: string;
  powerSystem?: string;
  goldFinger?: string;
  coreConflict?: string;
  factionsMap?: string;
  sellingPoints?: string;
}): string {
  const items: string[] = [];
  const push = (label: string, val?: string) => {
    if (val?.trim()) items.push(`- ${label}：${val.trim()}`);
  };
  push('世界观', project.worldSetting);
  push('力量体系', project.powerSystem);
  push('金手指', project.goldFinger);
  push('核心冲突', project.coreConflict);
  push('势力版图', project.factionsMap);
  push('卖点', project.sellingPoints);
  if (items.length === 0) return '';
  return `【核心设定】：\n${items.join('\n')}`;
}

interface SlidingWindowResult {
  context: string;
  replacedCount: number;
}

// 滑动窗口：近的章节放正文，远的章节替换为大纲条目
// 从最近的章节开始填充，直到达到 token 上限
function buildSlidingWindow(
  writtenChapters: { title: string; content: string; summary?: string }[],
  volumes: OutlineVolume[],
): SlidingWindowResult {
  if (writtenChapters.length === 0) return { context: '', replacedCount: 0 };

  const maxTokens = AVAILABLE_TOKENS;
  let usedTokens = 0;
  let replacedCount = 0;

  // 为每章准备两种表示：正文（长）和大纲条目（短）
  interface ChapterEntry {
    title: string;
    fullText: string;   // 正文
    outlineText: string; // 大纲条目（从大纲中提取，或用 summary）
    fullTokens: number;
    outlineTokens: number;
  }

  // 构建大纲标题->概要的映射
  const outlineMap = new Map<string, string>();
  for (const vol of volumes) {
    for (const ch of vol.chapters) {
      outlineMap.set(ch.title.trim(), ch.content || '');
    }
  }

  const entries: ChapterEntry[] = writtenChapters.map(ch => {
    const fullText = `【${ch.title}】\n${ch.content}`;
    const outlineContent = outlineMap.get(ch.title.trim()) || ch.summary || '';
    const outlineText = outlineContent
      ? `【${ch.title}】（大纲概要：${outlineContent}）`
      : `【${ch.title}】（已写，概要省略）`;
    return {
      title: ch.title,
      fullText,
      outlineText,
      fullTokens: estimateTokens(fullText),
      outlineTokens: estimateTokens(outlineText),
    };
  });

  // 从最近的章节开始，尽量放正文
  const result: string[] = [];
  // 先计算所有大纲条目的 token（保底必须能放下）
  const allOutlinesTokens = entries.reduce((sum, e) => sum + e.outlineTokens, 0);

  // 如果连所有大纲条目都放不下，只保留最近几章的大纲
  if (allOutlinesTokens > maxTokens) {
    let tokenCount = 0;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (tokenCount + entries[i].outlineTokens > maxTokens) break;
      result.unshift(entries[i].outlineText);
      tokenCount += entries[i].outlineTokens;
      replacedCount++;
    }
    return {
      context: `【已写章节（概要）】：\n${result.join('\n\n')}`,
      replacedCount,
    };
  }

  // 正常情况：从最近的章节开始放正文，远的放大纲
  // 先把所有大纲条目放入，然后从最近的章节开始，尝试将大纲替换为正文
  usedTokens = allOutlinesTokens;
  const isFull = new Array(entries.length).fill(false); // true = 正文, false = 大纲

  for (let i = entries.length - 1; i >= 0; i--) {
    const extraTokens = entries[i].fullTokens - entries[i].outlineTokens;
    if (usedTokens + extraTokens <= maxTokens) {
      isFull[i] = true;
      usedTokens += extraTokens;
    } else {
      break;
    }
  }

  for (let i = 0; i < entries.length; i++) {
    result.push(isFull[i] ? entries[i].fullText : entries[i].outlineText);
    if (!isFull[i]) replacedCount++;
  }

  const header = replacedCount > 0
    ? `【已写章节（${entries.length - replacedCount} 章正文 + ${replacedCount} 章概要）】：`
    : `【已写章节正文】：`;

  return {
    context: `${header}\n${result.join('\n\n')}`,
    replacedCount,
  };
}
