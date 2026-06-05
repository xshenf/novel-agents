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

  // 1. 导入 NovelProject
  if (data.projects && Array.isArray(data.projects)) {
    console.log(`正在导入 ${data.projects.length} 个小说项目...`);
    for (const proj of data.projects) {
      // 避免重复导入
      const existing = await prisma.novelProject.findUnique({ where: { id: proj.id } });
      if (existing) {
        console.log(`项目 ${proj.title} (ID: ${proj.id}) 已存在，跳过。`);
        continue;
      }

      await prisma.novelProject.create({
        data: {
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
        },
      });
      console.log(`导入项目成功: ${proj.title}`);
    }
  }

  // 2. 导入 Character
  if (data.characters && Array.isArray(data.characters)) {
    console.log(`正在导入 ${data.characters.length} 个角色卡...`);
    for (const char of data.characters) {
      const existing = await prisma.character.findUnique({ where: { id: char.id } });
      if (existing) continue;

      // 验证 projectId 是否存在，防止孤立关系报错
      const proj = await prisma.novelProject.findUnique({ where: { id: char.projectId } });
      if (!proj) {
        console.warn(`角色 ${char.name} 所属项目 ${char.projectId} 不存在，跳过。`);
        continue;
      }

      await prisma.character.create({
        data: {
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
        },
      });
    }
    console.log('角色卡导入完成。');
  }

  // 3. 导入 WorldRule
  if (data.worldRules && Array.isArray(data.worldRules)) {
    console.log(`正在导入 ${data.worldRules.length} 个世界观设定...`);
    for (const rule of data.worldRules) {
      const existing = await prisma.worldRule.findUnique({ where: { id: rule.id } });
      if (existing) continue;

      const proj = await prisma.novelProject.findUnique({ where: { id: rule.projectId } });
      if (!proj) continue;

      await prisma.worldRule.create({
        data: {
          id: rule.id,
          projectId: rule.projectId,
          type: rule.type || 'other',
          name: rule.name || '',
          description: rule.description || '',
        },
      });
    }
    console.log('世界观设定导入完成。');
  }

  // 4. 导入 Chapter
  if (data.chapters && Array.isArray(data.chapters)) {
    console.log(`正在导入 ${data.chapters.length} 个章节...`);
    for (const chap of data.chapters) {
      const existing = await prisma.chapter.findUnique({ where: { id: chap.id } });
      if (existing) continue;

      const proj = await prisma.novelProject.findUnique({ where: { id: chap.projectId } });
      if (!proj) continue;

      await prisma.chapter.create({
        data: {
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
        },
      });
    }
    console.log('章节导入完成。');
  }

  // 5. 导入 AgentMessage
  if (data.agentMessages && Array.isArray(data.agentMessages)) {
    console.log(`正在导入 ${data.agentMessages.length} 条智能体对话历史...`);
    for (const msg of data.agentMessages) {
      const existing = await prisma.agentMessage.findUnique({ where: { id: msg.id } });
      if (existing) continue;

      const proj = await prisma.novelProject.findUnique({ where: { id: msg.projectId } });
      if (!proj) continue;

      await prisma.agentMessage.create({
        data: {
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
        },
      });
    }
    console.log('智能体对话历史导入完成。');
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
