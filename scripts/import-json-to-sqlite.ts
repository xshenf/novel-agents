import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const jsonDbPath = path.join(process.cwd(), 'data', 'db.json');

async function main() {
  console.log('开始从 JSON 导入数据到 SQLite...');

  if (!fs.existsSync(jsonDbPath)) {
    console.log('未找到 data/db.json 文件，跳过导入。');
    return;
  }

  const fileData = fs.readFileSync(jsonDbPath, 'utf-8');
  let data: any;
  try {
    data = JSON.parse(fileData);
  } catch (err) {
    console.error('解析 data/db.json 失败:', err);
    return;
  }

  // 预查询已存在的项目 ID 集合，用于过滤孤立记录
  const existingProjectIds = new Set(
    (await prisma.novelProject.findMany({ select: { id: true } })).map(p => p.id)
  );

  // 1. 导入 NovelProject（批量）
  if (data.projects && Array.isArray(data.projects)) {
    console.log(`正在导入 ${data.projects.length} 个小说项目...`);
    const existingIds = new Set(
      (await prisma.novelProject.findMany({
        where: { id: { in: data.projects.map((p: any) => p.id) } },
        select: { id: true },
      })).map(p => p.id)
    );

    const newProjects = data.projects
      .filter((p: any) => !existingIds.has(p.id))
      .map((proj: any) => ({
        id: proj.id,
        userId: proj.userId || 'default_user',
        title: proj.title || '',
        description: proj.description || '',
        styleSetting: proj.styleSetting || '',
        worldSetting: proj.worldSetting || '',
        powerSystem: proj.powerSystem || '',
        goldFinger: proj.goldFinger || '',
        coreConflict: proj.coreConflict || '',
        factionsMap: proj.factionsMap || '',
        sellingPoints: proj.sellingPoints || '',
        outlineFull: proj.outlineFull || '',
        antiAiStyleRules: JSON.stringify(proj.antiAiStyleRules || []),
        createdAt: new Date(proj.createdAt || Date.now()),
        updatedAt: new Date(proj.updatedAt || Date.now()),
      }));

    if (newProjects.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.novelProject.createMany({ data: newProjects });
      });
      newProjects.forEach((p: any) => existingProjectIds.add(p.id));
    }
    console.log(`项目导入完成: 新增 ${newProjects.length} 条，跳过 ${data.projects.length - newProjects.length} 条已存在。`);
  }

  // 2. 导入 Character（批量）
  if (data.characters && Array.isArray(data.characters)) {
    console.log(`正在导入 ${data.characters.length} 个角色卡...`);
    const existingIds = new Set(
      (await prisma.character.findMany({
        where: { id: { in: data.characters.map((c: any) => c.id) } },
        select: { id: true },
      })).map(c => c.id)
    );

    const newChars = data.characters
      .filter((c: any) => !existingIds.has(c.id) && existingProjectIds.has(c.projectId))
      .map((char: any) => ({
        id: char.id,
        projectId: char.projectId,
        name: char.name || '',
        role: char.role || '',
        age: String(char.age || ''),
        identity: char.identity || '',
        personality: JSON.stringify(char.personality || []),
        goals: JSON.stringify(char.goals || []),
        relationships: JSON.stringify(char.relationships || []),
        currentState: char.currentState || '',
        forbidden: JSON.stringify(char.forbidden || []),
      }));

    const skipped = data.characters.length - newChars.length;
    if (newChars.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.character.createMany({ data: newChars });
      });
    }
    console.log(`角色卡导入完成: 新增 ${newChars.length} 条，跳过 ${skipped} 条。`);
  }

  // 3. 导入 WorldRule（批量）
  if (data.worldRules && Array.isArray(data.worldRules)) {
    console.log(`正在导入 ${data.worldRules.length} 个世界观设定...`);
    const existingIds = new Set(
      (await prisma.worldRule.findMany({
        where: { id: { in: data.worldRules.map((r: any) => r.id) } },
        select: { id: true },
      })).map(r => r.id)
    );

    const newRules = data.worldRules
      .filter((r: any) => !existingIds.has(r.id) && existingProjectIds.has(r.projectId))
      .map((rule: any) => ({
        id: rule.id,
        projectId: rule.projectId,
        type: rule.type || 'other',
        name: rule.name || '',
        description: rule.description || '',
      }));

    const skipped = data.worldRules.length - newRules.length;
    if (newRules.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.worldRule.createMany({ data: newRules });
      });
    }
    console.log(`世界观设定导入完成: 新增 ${newRules.length} 条，跳过 ${skipped} 条。`);
  }

  // 4. 导入 Chapter（批量）
  if (data.chapters && Array.isArray(data.chapters)) {
    console.log(`正在导入 ${data.chapters.length} 个章节...`);
    const existingIds = new Set(
      (await prisma.chapter.findMany({
        where: { id: { in: data.chapters.map((c: any) => c.id) } },
        select: { id: true },
      })).map(c => c.id)
    );

    const newChapters = data.chapters
      .filter((c: any) => !existingIds.has(c.id) && existingProjectIds.has(c.projectId))
      .map((chap: any) => ({
        id: chap.id,
        projectId: chap.projectId,
        title: chap.title || '',
        content: chap.content || '',
        summary: chap.summary || '',
        characterChanges: JSON.stringify(chap.characterChanges || []),
        newForeshadowing: JSON.stringify(chap.newForeshadowing || []),
        resolvedForeshadowing: JSON.stringify(chap.resolvedForeshadowing || []),
        timelineEvents: JSON.stringify(chap.timelineEvents || []),
        createdAt: new Date(chap.createdAt || Date.now()),
        updatedAt: new Date(chap.updatedAt || Date.now()),
      }));

    const skipped = data.chapters.length - newChapters.length;
    if (newChapters.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.chapter.createMany({ data: newChapters });
      });
    }
    console.log(`章节导入完成: 新增 ${newChapters.length} 条，跳过 ${skipped} 条。`);
  }

  // 5. 导入 AgentMessage（批量）
  if (data.agentMessages && Array.isArray(data.agentMessages)) {
    console.log(`正在导入 ${data.agentMessages.length} 条智能体对话历史...`);
    const existingIds = new Set(
      (await prisma.agentMessage.findMany({
        where: { id: { in: data.agentMessages.map((m: any) => m.id) } },
        select: { id: true },
      })).map(m => m.id)
    );

    const newMsgs = data.agentMessages
      .filter((m: any) => !existingIds.has(m.id) && existingProjectIds.has(m.projectId))
      .map((msg: any) => ({
        id: msg.id,
        projectId: msg.projectId,
        userId: msg.userId || 'default_user',
        type: msg.type || '',
        agent: msg.agent,
        label: msg.label,
        content: msg.content || '',
        toolName: msg.toolName,
        toolInput: msg.toolInput ? JSON.stringify(msg.toolInput) : null,
        from: msg.from,
        fromLabel: msg.fromLabel,
        to: msg.to,
        toLabel: msg.toLabel,
        createdAt: new Date(msg.createdAt || Date.now()),
      }));

    const skipped = data.agentMessages.length - newMsgs.length;
    if (newMsgs.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.agentMessage.createMany({ data: newMsgs });
      });
    }
    console.log(`智能体对话历史导入完成: 新增 ${newMsgs.length} 条，跳过 ${skipped} 条。`);
  }

  console.log('所有数据均已无损迁移至 SQLite 数据库！');
}

main()
  .catch((e) => {
    console.error('导入数据出错:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
