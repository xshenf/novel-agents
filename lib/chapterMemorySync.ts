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
  const consistencyCheck = await runConsistencyCheck(projectId, text, apiKey, modelName, warnings);

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

// 写后跨章一致性校验：比对新章正文与人物卡/世界观/时间线/伏笔，发现矛盾随结果返回。
// 在记忆同步之后执行，校验用的上下文已是最新状态；失败只记 warning，不阻塞写作主流程。
async function runConsistencyCheck(
  projectId: string,
  text: string,
  apiKey: string | undefined,
  modelName: string | undefined,
  warnings: string[],
): Promise<AICheckResult | undefined> {
  try {
    return await ai.checkConsistency(projectId, text, apiKey, modelName);
  } catch (error) {
    warnings.push(`跨章一致性校验失败：${formatWarning(error)}`);
    return undefined;
  }
}

function formatWarning(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
