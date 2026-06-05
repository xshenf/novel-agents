import { db, Chapter, Character, WorldRule } from './db';

export interface MemorySearchResult {
  contextText: string;
  chapters: Chapter[];
  characters: Character[];
  worldRules: WorldRule[];
}

// 简单分词，去掉一些极短的无意义字符
function tokenize(text: string): string[] {
  const clean = text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'，。！？：；（）“”]/g, ' ');
  return clean.split(/\s+/).filter(word => word.length >= 1);
}

export async function searchMemory(projectId: string, query: string): Promise<MemorySearchResult> {
  const chapters = await db.getChapters(projectId);
  const characters = await db.getCharacters(projectId);
  const worldRules = await db.getWorldRules(projectId);
  const project = await db.getProject(projectId);

  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) {
    // 默认返回最近的章节和核心角色卡作为默认上下文
    const defaultChapters = chapters.slice(-3); // 最近3章
    const defaultCharacters = characters.filter(c => c.role === '男主' || c.role === '女主' || c.role === '主角');
    return {
      contextText: formatContext(project?.title || '', defaultChapters, defaultCharacters, worldRules.slice(0, 3)),
      chapters: defaultChapters,
      characters: defaultCharacters,
      worldRules: worldRules.slice(0, 3),
    };
  }

  // 评分匹配：计算各实体得分
  const scoredChapters = chapters.map((chap, index) => {
    let score = 0;
    const contentToSearch = [
      chap.title,
      chap.summary,
      chap.timelineEvents.join(' '),
      chap.newForeshadowing.join(' '),
      chap.resolvedForeshadowing.join(' '),
      chap.characterChanges.map(c => `${c.character} ${c.change}`).join(' '),
    ].join(' ').toLowerCase();

    queryTokens.forEach(token => {
      if (contentToSearch.includes(token)) {
        score += 10;
        // 匹配次数加分
        const occurrences = (contentToSearch.match(new RegExp(token, 'g')) || []).length;
        score += occurrences * 2;
      }
    });

    // 越接近当前章节（数组靠后），给予轻微的权重分，以维持短期记忆连贯性
    score += (index / chapters.length) * 5;

    return { item: chap, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);

  const scoredCharacters = characters.map(char => {
    let score = 0;
    const contentToSearch = [
      char.name,
      char.role,
      char.identity,
      char.currentState,
      char.personality.join(' '),
      char.goals.join(' '),
      char.relationships.map(r => `${r.target} ${r.type}`).join(' '),
      char.forbidden.join(' '),
    ].join(' ').toLowerCase();

    queryTokens.forEach(token => {
      // 人物名字精准匹配权重极大
      if (char.name.toLowerCase().includes(token)) {
        score += 30;
      }
      if (contentToSearch.includes(token)) {
        score += 8;
        const occurrences = (contentToSearch.match(new RegExp(token, 'g')) || []).length;
        score += occurrences * 1.5;
      }
    });

    return { item: char, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);

  const scoredRules = worldRules.map(rule => {
    let score = 0;
    const contentToSearch = [
      rule.name,
      rule.type,
      rule.description,
    ].join(' ').toLowerCase();

    queryTokens.forEach(token => {
      if (rule.name.toLowerCase().includes(token)) {
        score += 25;
      }
      if (contentToSearch.includes(token)) {
        score += 8;
      }
    });

    return { item: rule, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);

  // 截取前 N 个最相关的实体
  const topChapters = scoredChapters.slice(0, 3).map(x => x.item);
  const topCharacters = scoredCharacters.slice(0, 5).map(x => x.item);
  const topRules = scoredRules.slice(0, 4).map(x => x.item);

  // 如果检索结果过少，补充一些核心/最近设定
  if (topChapters.length === 0 && chapters.length > 0) {
    topChapters.push(chapters[chapters.length - 1]);
  }
  if (topCharacters.length === 0 && characters.length > 0) {
    const mainChars = characters.filter(c => c.role === '男主' || c.role === '女主' || c.role === '主角');
    topCharacters.push(...(mainChars.length > 0 ? mainChars : characters.slice(0, 2)));
  }

  const contextText = formatContext(project?.title || '', topChapters, topCharacters, topRules);

  return {
    contextText,
    chapters: topChapters,
    characters: topCharacters,
    worldRules: topRules,
  };
}

// 格式化上下文成 LLM 易读的 Prompt 文本
function formatContext(projectTitle: string, chapters: Chapter[], characters: Character[], rules: WorldRule[]): string {
  let contextText = `【小说项目】: ${projectTitle}\n\n`;

  if (characters.length > 0) {
    contextText += `【相关人物设定】:\n`;
    characters.forEach(c => {
      contextText += `- 姓名: ${c.name} (${c.role}, ${c.age}岁)\n`;
      contextText += `  身份: ${c.identity}\n`;
      contextText += `  性格: ${c.personality.join(', ')}\n`;
      contextText += `  目标: ${c.goals.join(', ')}\n`;
      if (c.relationships.length > 0) {
        contextText += `  人际关系: ${c.relationships.map(r => `${r.target}(${r.type})`).join(', ')}\n`;
      }
      contextText += `  当前状态: ${c.currentState}\n`;
      if (c.forbidden.length > 0) {
        contextText += `  写作禁忌: ${c.forbidden.join(', ')}\n`;
      }
      contextText += `\n`;
    });
  }

  if (rules.length > 0) {
    contextText += `【相关世界观设定】:\n`;
    rules.forEach(r => {
      const typeMap = { location: '地点', faction: '势力', rule: '法则/设定', item: '物品', other: '其他' };
      contextText += `- [${typeMap[r.type] || r.type}] ${r.name}: ${r.description}\n`;
    });
    contextText += `\n`;
  }

  if (chapters.length > 0) {
    contextText += `【前文章节回顾与状态】:\n`;
    chapters.forEach(c => {
      contextText += `- 章节: ${c.title}\n`;
      contextText += `  摘要: ${c.summary || '暂无摘要'}\n`;
      if (c.characterChanges && c.characterChanges.length > 0) {
        contextText += `  人物状态变更: ${c.characterChanges.map(cc => `${cc.character} -> ${cc.change}`).join('; ')}\n`;
      }
      if (c.newForeshadowing && c.newForeshadowing.length > 0) {
        contextText += `  新埋伏笔: ${c.newForeshadowing.join(', ')}\n`;
      }
      if (c.resolvedForeshadowing && c.resolvedForeshadowing.length > 0) {
        contextText += `  收回伏笔: ${c.resolvedForeshadowing.join(', ')}\n`;
      }
      if (c.timelineEvents && c.timelineEvents.length > 0) {
        contextText += `  关键事件时间线: ${c.timelineEvents.join(' | ')}\n`;
      }
      contextText += `\n`;
    });
  }

  return contextText.trim();
}
