import { ai, type AISummaryResult, type AICheckResult } from './ai';
import { db } from './db';

export interface ChapterMemorySyncResult {
  summary: AISummaryResult;
  updatedCharacterCount: number;
  rollingSynopsisUpdated: boolean;
  worldStateUpdated: boolean;
  consistencyCheck?: AICheckResult;
  warnings: string[];
}

interface SyncChapterMemoryParams {
  projectId: string;
  chapterId: string;
  text: string;
  apiKey?: string;
  modelName?: string;
}

export async function syncChapterMemoryAfterWrite({
  projectId,
  chapterId,
  text,
  apiKey,
  modelName,
}: SyncChapterMemoryParams): Promise<ChapterMemorySyncResult> {
  const warnings: string[] = [];
  const summary = await ai.summarizeChapter(text, apiKey, modelName);

  await db.updateChapter(chapterId, {
    summary: summary.summary,
    characterChanges: summary.characterChanges || [],
    newForeshadowing: summary.newForeshadowing || [],
    resolvedForeshadowing: summary.resolvedForeshadowing || [],
    timelineEvents: summary.timelineEvents || [],
  });

  const updatedCharacterCount = await applyCharacterChanges(projectId, summary.characterChanges || []);
  const rollingSynopsisUpdated = await updateRollingSynopsis(projectId, apiKey, modelName, warnings);
  const worldStateUpdated = await updateWorldState(projectId, apiKey, modelName, warnings);
  const consistencyCheck = await runConsistencyCheck(projectId, chapterId, text, apiKey, modelName, warnings);

  return {
    summary,
    updatedCharacterCount,
    rollingSynopsisUpdated,
    worldStateUpdated,
    consistencyCheck,
    warnings,
  };
}

async function applyCharacterChanges(
  projectId: string,
  characterChanges: AISummaryResult['characterChanges'],
): Promise<number> {
  if (!characterChanges.length) return 0;

  const characters = await db.getCharacters(projectId);
  let updatedCount = 0;
  for (const change of characterChanges) {
    const matched = characters.find(c => c.name === change.character);
    if (!matched) continue;
    await db.updateCharacter(matched.id, { currentState: change.change });
    updatedCount++;
  }
  return updatedCount;
}

async function updateRollingSynopsis(
  projectId: string,
  apiKey: string | undefined,
  modelName: string | undefined,
  warnings: string[],
): Promise<boolean> {
  try {
    const rollingSynopsis = await ai.updateRollingSynopsis(projectId, apiKey, modelName);
    await db.updateProject(projectId, { rollingSynopsis });
    return true;
  } catch (error) {
    warnings.push(`全书滚动概要更新失败：${formatWarning(error)}`);
    return false;
  }
}

async function updateWorldState(
  projectId: string,
  apiKey: string | undefined,
  modelName: string | undefined,
  warnings: string[],
): Promise<boolean> {
  try {
    const items = await ai.updateWorldState(projectId, apiKey, modelName);
    await db.replaceAutoWorldStates(projectId, items);
    return true;
  } catch (error) {
    warnings.push(`世界状态台账更新失败：${formatWarning(error)}`);
    return false;
  }
}

async function runConsistencyCheck(
  projectId: string,
  chapterId: string,
  text: string,
  apiKey: string | undefined,
  modelName: string | undefined,
  warnings: string[],
): Promise<AICheckResult | undefined> {
  try {
    // 第一章守卫：除本章外没有任何含正文的章节时，无前文可比对，跳过校验。
    // 否则空设定 + 无前文下模型会幻觉出不存在的"矛盾"（用户实测第一章误报 4 个问题）。
    const chapters = await db.getChapters(projectId);
    const priorWritten = chapters.filter(c => c.id !== chapterId && (c.content || '').trim());
    if (priorWritten.length === 0) return undefined;
    return await ai.checkConsistency(projectId, text, apiKey, modelName, undefined, chapterId);
  } catch (error) {
    warnings.push(`跨章一致性校验失败：${formatWarning(error)}`);
    return undefined;
  }
}

// 轻量记忆同步：仅提取章节摘要并写回 + 应用人物状态变化（1 次 LLM 调用）。
// 供极简写作链路使用——不跑滚动概要/世界状态/一致性校验，保持低成本。
export async function syncChapterSummaryLight(
  projectId: string,
  chapterId: string,
  text: string,
  apiKey?: string,
  modelName?: string,
): Promise<AISummaryResult> {
  const summary = await ai.summarizeChapter(text, apiKey, modelName);
  await db.updateChapter(chapterId, {
    summary: summary.summary,
    characterChanges: summary.characterChanges || [],
    newForeshadowing: summary.newForeshadowing || [],
    resolvedForeshadowing: summary.resolvedForeshadowing || [],
    timelineEvents: summary.timelineEvents || [],
  });
  await applyCharacterChanges(projectId, summary.characterChanges || []);
  return summary;
}

function formatWarning(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
