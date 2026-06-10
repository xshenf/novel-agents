import { db, Chapter, Character, WorldRule, WorldState, NovelProject } from './db';
import { parseStructureOutline } from './outlineParser';
import { selectRecentContentWindow } from './contextWindow';

export interface MemorySearchResult {
  contextText: string;
  chapters: Chapter[];
  characters: Character[];
  worldRules: WorldRule[];
  worldStates: WorldState[];
}

export interface MemorySearchOptions {
  // 正文滑动窗口预算（token）：>0 时在上下文末尾注入最近章节的正文原文。
  // 摘要层保证"远程事实"，正文窗口保证"近程文风与情节末梢"，两层互补。
  recentContentBudgetTokens?: number;
  // 排除的章节 id：写后校验场景排除刚落库的本章，避免"自己和自己比对"。
  excludeChapterIds?: string[];
}

// 正文窗口默认预算：约 1.8 万字（≈最近 6-8 章），供写作与校验链路使用
export const RECENT_CONTENT_BUDGET_TOKENS = 12_000;
// 正文窗口候选章节数上限：限制 DB 拉取正文的数量
const RECENT_CONTENT_MAX_CHAPTERS = 8;

// 转义正则中的特殊字符，避免用 token 构造 RegExp 时报错
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const CJK = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;
// 中文高频虚词：仅在「单字」层面过滤以降噪，二元组不受影响
const STOPWORDS = new Set([
  '的', '了', '是', '在', '我', '你', '他', '她', '它', '们', '和', '与', '也',
  '不', '有', '个', '这', '那', '之', '就', '都', '而', '及', '或', '吗', '呢', '吧',
]);

/**
 * Number of most-recent chapters always injected into the "detail layer"
 * (key state changes such as character arcs, new/resolved foreshadowing, timeline events).
 *
 * Chosen as 3 because most story arcs span 2-4 chapters; injecting the latest 3
 * gives the LLM enough context to maintain continuity without bloating the prompt.
 * Increasing beyond 5 yields diminishing returns while noticeably raising token cost.
 */
const RECENT_DETAIL_N = 3;
/**
 * Number of additional keyword-relevant chapters selected via BM25-like scoring
 * and injected alongside the recent chapters.
 *
 * Chosen as 3 to complement RECENT_DETAIL_N: when the user query references older
 * plot threads (e.g. a character not seen for 10 chapters), the keyword search
 * retrieves up to 3 of the most relevant older chapters so the LLM can recall
 * those details. Values above 4 tend to introduce noise from tangentially related chapters.
 */
const RELEVANT_DETAIL_N = 3;

// 分词：英文按词切，中文按「单字 + 相邻二元组(bigram)」切，兼顾召回与精度。
function tokenize(text: string): string[] {
  if (!text) return [];
  const segments = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const tokens = new Set<string>();

  for (const seg of segments) {
    if (CJK.test(seg)) {
      const chars = Array.from(seg);
      for (let i = 0; i < chars.length; i++) {
        if (!STOPWORDS.has(chars[i])) tokens.add(chars[i]);
        if (i < chars.length - 1) tokens.add(chars[i] + chars[i + 1]);
      }
    } else if (seg.length >= 1) {
      tokens.add(seg);
    }
  }

  return Array.from(tokens);
}

// 计算「未回收伏笔台账」：所有 newForeshadowing 减去任意章节已 resolved 的
export function collectOpenForeshadowing(chapters: Chapter[]): string[] {
  const resolved = new Set<string>();
  chapters.forEach(c => (c.resolvedForeshadowing || []).forEach(f => resolved.add(f.trim())));
  const open: string[] = [];
  chapters.forEach(c => (c.newForeshadowing || []).forEach(f => {
    const t = f.trim();
    if (t && !resolved.has(t) && !open.includes(t)) open.push(t);
  }));
  return open;
}

// 关键词打分挑选与 query 最相关的旧章节，用于补充细节层（非主力，主力是全书逐章摘要）
function scoreRelevantChapters(chapters: Chapter[], queryTokens: string[]): Chapter[] {
  if (queryTokens.length === 0) return [];
  const scored = chapters.map((chap, index) => {
    let score = 0;
    const haystack = [
      chap.title,
      chap.summary,
      (chap.timelineEvents || []).join(' '),
      (chap.newForeshadowing || []).join(' '),
      (chap.resolvedForeshadowing || []).join(' '),
      (chap.characterChanges || []).map(c => `${c.character} ${c.change}`).join(' '),
    ].join(' ').toLowerCase();

    queryTokens.forEach(token => {
      if (haystack.includes(token)) {
        score += 10;
        const occurrences = (haystack.match(new RegExp(escapeRegExp(token), 'g')) || []).length;
        score += occurrences * 2;
      }
    });
    score += (index / Math.max(1, chapters.length)) * 5; // 轻微的近因权重
    return { item: chap, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);

  return scored.slice(0, RELEVANT_DETAIL_N).map(x => x.item);
}

// 检索小说记忆：始终注入「故事圣经 + 全书逐章摘要」，并补充最近/相关章节的关键状态变化。
// 这从根本上避免了「只给最近/命中的 top-3 章」导致的长篇跑偏。
export async function searchMemory(projectId: string, query: string, chapterTitle?: string, options?: MemorySearchOptions): Promise<MemorySearchResult> {
  const [chaptersAll, characters, worldRules, worldStates, project] = await Promise.all([
    db.getChapterMetadata(projectId),
    db.getCharacters(projectId),
    db.getWorldRules(projectId),
    db.getWorldStates(projectId),
    db.getProject(projectId),
  ]);

  // 排除章（写后校验场景排除刚落库的本章）：摘要/伏笔/细节各层一并排除，
  // 否则本章内容会被当作"前文事实"参与比对，导致校验漏报
  const excludeSet = new Set(options?.excludeChapterIds || []);
  const chapters = excludeSet.size ? chaptersAll.filter(c => !excludeSet.has(c.id)) : chaptersAll;

  // 查找匹配的章节大纲
  let currentChapterOutline = '';
  if (chapterTitle && project?.outlineFull) {
    try {
      const volumes = parseStructureOutline(project.outlineFull);
      const flatChapters = volumes.map(v => v.chapters || []).flat();
      const cleanTitle = (t: string) => t.replace(/^(第[一二三四五六七八九十百\d]+章[：:\s\-]*)/, '').trim();

      const matched = flatChapters.find(ch => {
        const t1 = ch.title.trim();
        const t2 = chapterTitle.trim();
        if (t1 === t2) return true;
        // 模糊匹配干净的标题
        const c1 = cleanTitle(t1);
        const c2 = cleanTitle(t2);
        return c1 && c2 && (c1.includes(c2) || c2.includes(c1));
      });
      
      if (matched) {
        let text = `【本章大纲走向（当前正在创作此章节，务必严格围绕此大纲剧情和冲突撰写，不得偏离）】：\n`;
        text += `- 章节标题：${matched.title}\n`;
        text += `- 剧情推进与走向：${matched.content || '暂无详细走向描述，请合理发挥'}\n`;
        if (matched.details && matched.details.length > 0) {
          text += `- 关键设计指标：\n`;
          matched.details.forEach(d => {
            text += `  * ${d.key}：${d.value}\n`;
          });
        }
        currentChapterOutline = text.trim();
      }
    } catch (e) {
      console.error('解析大纲放入提示词出错:', e);
    }
  }

  // 细节层 = 最近 N 章 ∪ 关键词相关旧章节（按章节自然顺序输出）
  const relevant = scoreRelevantChapters(chapters, tokenize(query));
  const recent = chapters.slice(-RECENT_DETAIL_N);
  const detailIds = new Set([...recent, ...relevant].map(c => c.id));
  const detailChapters = chapters.filter(c => detailIds.has(c.id));

  const contextText = formatContext(project, chapters, characters, worldRules, worldStates, detailChapters, currentChapterOutline);

  // 正文滑动窗口层（按需开启）：摘要有信息与文风损耗，最近章节注入原文保证近程连贯
  let finalContextText = contextText;
  const budget = options?.recentContentBudgetTokens || 0;
  if (budget > 0) {
    const recentFull = await db.getRecentChapters(projectId, RECENT_CONTENT_MAX_CHAPTERS);
    const candidates = recentFull
      .filter(c => !excludeSet.has(c.id) && (c.content || '').trim())
      .map(c => ({ id: c.id, title: c.title, content: c.content }));
    const win = selectRecentContentWindow(candidates, budget);
    if (win.text) {
      finalContextText += `\n\n【最近章节正文（原文，务必衔接其文风、情节末梢与细节）】：\n${win.text}`;
    }
  }

  return {
    contextText: finalContextText,
    chapters: detailChapters,
    characters,
    worldRules,
    worldStates,
  };
}

const RULE_TYPE_MAP: Record<string, string> = {
  location: '地点', faction: '势力', rule: '法则/设定', item: '物品', other: '其他',
};

// 组装分层的长期记忆上下文：故事圣经（始终） + 全书逐章摘要（始终） + 最近/相关章节细节
function formatContext(
  project: NovelProject | null | undefined,
  allChapters: Chapter[],
  characters: Character[],
  rules: WorldRule[],
  worldStates: WorldState[],
  detailChapters: Chapter[],
  currentChapterOutline?: string,
): string {
  const parts: string[] = [];

  // ── 1. 故事圣经：核心设定（始终注入，不走检索）──
  const kernel: string[] = [];
  const pushKernel = (label: string, val?: string) => {
    const v = (val || '').trim();
    if (v) kernel.push(`- ${label}：${v}`);
  };
  pushKernel('世界观', project?.worldSetting);
  pushKernel('力量体系', project?.powerSystem);
  pushKernel('金手指', project?.goldFinger);
  pushKernel('核心冲突', project?.coreConflict);
  pushKernel('势力版图', project?.factionsMap);
  pushKernel('卖点', project?.sellingPoints);

  let bible = `【小说项目】：${project?.title || ''}`;
  if (kernel.length > 0) bible += `\n\n【本书核心设定（贯穿全书，不得自相矛盾）】：\n${kernel.join('\n')}`;
  parts.push(bible);

  // ── 1.5. 当前章节大纲走向（如有） ──
  if (currentChapterOutline) {
    parts.push(currentChapterOutline);
  }

  // ── 2. 全部登场人物 · 当前状态（始终注入：人物状态最易跑偏）──
  if (characters.length > 0) {
    let charText = `【全部人物 · 当前状态（务必与此保持一致）】：`;
    characters.forEach(c => {
      charText += `\n- ${c.name}（${c.role}${c.age ? `，${c.age}` : ''}）`;
      if (c.identity) charText += `：${c.identity}`;
      if (c.currentState) charText += `\n  现状：${c.currentState}`;
      const traits: string[] = [];
      if (c.personality?.length) traits.push(`性格：${c.personality.join('、')}`);
      if (c.goals?.length) traits.push(`目标：${c.goals.join('、')}`);
      if (traits.length) charText += `\n  ${traits.join('｜')}`;
      if (c.relationships?.length) charText += `\n  关系：${c.relationships.map(r => `${r.target}(${r.type})`).join('、')}`;
      if (c.forbidden?.length) charText += `\n  写作禁忌：${c.forbidden.join('、')}`;
    });
    parts.push(charText);
  }

  // ── 3. 世界观设定（始终注入全部规则）──
  if (rules.length > 0) {
    let ruleText = `【世界观设定】：`;
    rules.forEach(r => {
      ruleText += `\n- [${RULE_TYPE_MAP[r.type] || r.type}] ${r.name}：${r.description}`;
    });
    parts.push(ruleText);
  }

  // ── 3.5. 世界当前状态（动态快照，随剧情演化）──
  if (worldStates.length > 0) {
    // 按 category 分组
    const grouped: Record<string, WorldState[]> = {};
    worldStates.forEach(s => {
      const cat = s.category || '其他';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(s);
    });
    let stateText = `【世界当前状态（随剧情演化，以下为最新快照，须以此为准；标注「已锁定」的条目绝对不可违背或擅自改动）】：`;
    for (const [cat, items] of Object.entries(grouped)) {
      items.forEach(s => {
        stateText += `\n- [${cat}]${s.pinned ? '【已锁定·不可违背】' : ''} ${s.name}：${s.content}`;
      });
    }
    parts.push(stateText);
  }

  // ── 4. 未回收伏笔台账（始终注入）──
  const openForeshadow = collectOpenForeshadowing(allChapters);
  if (openForeshadow.length > 0) {
    parts.push(`【尚未回收的伏笔（需推进或避免遗忘）】：\n${openForeshadow.map(f => `- ${f}`).join('\n')}`);
  }

  // ── 5. 全书剧情脉络：优先用 AI 维护的滚动概要（有界，适配长篇）；否则回退逐章全量摘要 ──
  const rolling = (project?.rollingSynopsis || '').trim();
  const withSummary = allChapters.filter(c => c.summary && c.summary.trim() !== '');
  if (rolling) {
    parts.push(`【全书剧情脉络（滚动概要）】：\n${rolling}`);
    const recentSummaries = withSummary.slice(-RECENT_DETAIL_N);
    if (recentSummaries.length > 0) {
      parts.push(`【最近章节摘要（精确）】：\n${recentSummaries.map(c => `- ${c.title}：${c.summary}`).join('\n')}`);
    }
  } else if (withSummary.length > 0) {
    parts.push(`【全书剧情脉络（按章节顺序的摘要，保持连续性）】：\n${withSummary.map(c => `- ${c.title}：${c.summary}`).join('\n')}`);
  }

  // ── 6. 最近 / 相关章节的关键状态变化（细节层）──
  if (detailChapters.length > 0) {
    let detailText = `【最近 / 相关章节的关键状态变化】：`;
    detailChapters.forEach(c => {
      detailText += `\n- ${c.title}`;
      if (c.characterChanges?.length) detailText += `\n  人物状态变更：${c.characterChanges.map(cc => `${cc.character} -> ${cc.change}`).join('；')}`;
      if (c.newForeshadowing?.length) detailText += `\n  新埋伏笔：${c.newForeshadowing.join('、')}`;
      if (c.resolvedForeshadowing?.length) detailText += `\n  收回伏笔：${c.resolvedForeshadowing.join('、')}`;
      if (c.timelineEvents?.length) detailText += `\n  关键时间线：${c.timelineEvents.join(' | ')}`;
    });
    parts.push(detailText);
  }

  return parts.join('\n\n').trim();
}
