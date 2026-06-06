import { 
  PrismaClient, 
  NovelProject as PrismaProject, 
  Character as PrismaCharacter, 
  Chapter as PrismaChapter, 
  AgentMessage as PrismaMessage 
} from '@prisma/client';

const prismaClientSingleton = () => {
  return new PrismaClient();
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// 定义接口类型
export interface NovelProject {
  id: string;
  userId?: string;
  title: string;
  description: string;
  styleSetting: string;
  worldSetting: string;
  powerSystem?: string;
  goldFinger?: string;
  coreConflict?: string;
  factionsMap?: string;
  sellingPoints?: string;
  outlineFull?: string;
  antiAiStyleRules?: string[];
  modelsConfig?: any[];
  agentBindings?: Record<string, string>;
  agentOverrides?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterRelationship {
  target: string;
  type: string;
}

export interface Character {
  id: string;
  projectId: string;
  name: string;
  role: string;
  age: string;
  identity: string;
  personality: string[];
  goals: string[];
  relationships: CharacterRelationship[];
  currentState: string;
  forbidden: string[];
}

export interface WorldRule {
  id: string;
  projectId: string;
  type: 'location' | 'faction' | 'rule' | 'item' | 'other';
  name: string;
  description: string;
}

export interface CharacterChange {
  character: string;
  change: string;
}

export interface Chapter {
  id: string;
  projectId: string;
  title: string;
  content: string;
  summary: string;
  characterChanges: CharacterChange[];
  newForeshadowing: string[];
  resolvedForeshadowing: string[];
  timelineEvents: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentMessage {
  id: string;
  projectId: string;
  userId: string;
  type: string;
  agent?: string;
  label?: string;
  content: string;
  toolName?: string;
  toolInput?: unknown;
  from?: string;
  fromLabel?: string;
  to?: string;
  toLabel?: string;
  createdAt: string;
}

// 辅助序列化/反序列化格式化函数
function formatProject(p: PrismaProject): NovelProject {
  return {
    ...p,
    antiAiStyleRules: p.antiAiStyleRules ? JSON.parse(p.antiAiStyleRules) as string[] : [],
    modelsConfig: (p as any).modelsConfig ? JSON.parse((p as any).modelsConfig) as any[] : [],
    agentBindings: (p as any).agentBindings ? JSON.parse((p as any).agentBindings) as Record<string, string> : {},
    agentOverrides: (p as any).agentOverrides ? JSON.parse((p as any).agentOverrides) as Record<string, any> : {},
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function formatCharacter(c: PrismaCharacter): Character {
  return {
    ...c,
    personality: c.personality ? JSON.parse(c.personality) as string[] : [],
    goals: c.goals ? JSON.parse(c.goals) as string[] : [],
    forbidden: c.forbidden ? JSON.parse(c.forbidden) as string[] : [],
    relationships: c.relationships ? JSON.parse(c.relationships) as CharacterRelationship[] : [],
  };
}

function formatChapter(ch: PrismaChapter): Chapter {
  return {
    ...ch,
    characterChanges: ch.characterChanges ? JSON.parse(ch.characterChanges) as CharacterChange[] : [],
    newForeshadowing: ch.newForeshadowing ? JSON.parse(ch.newForeshadowing) as string[] : [],
    resolvedForeshadowing: ch.resolvedForeshadowing ? JSON.parse(ch.resolvedForeshadowing) as string[] : [],
    timelineEvents: ch.timelineEvents ? JSON.parse(ch.timelineEvents) as string[] : [],
    createdAt: ch.createdAt.toISOString(),
    updatedAt: ch.updatedAt.toISOString(),
  };
}

function formatAgentMessage(m: PrismaMessage): AgentMessage {
  return {
    ...m,
    agent: m.agent ?? undefined,
    label: m.label ?? undefined,
    toolName: m.toolName ?? undefined,
    toolInput: m.toolInput ? JSON.parse(m.toolInput) : undefined,
    from: m.from ?? undefined,
    fromLabel: m.fromLabel ?? undefined,
    to: m.to ?? undefined,
    toLabel: m.toLabel ?? undefined,
    createdAt: m.createdAt.toISOString(),
  };
}

// 数据库操作类 (全部转为 async/await 异步操作)
export const db = {
  // --- 项目 (NovelProject) ---
  async getProjects(): Promise<NovelProject[]> {
    const list = await prisma.novelProject.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return list.map(formatProject);
  },

  async getProject(id: string): Promise<NovelProject | undefined> {
    const item = await prisma.novelProject.findUnique({ where: { id } });
    return item ? formatProject(item) : undefined;
  },

  async createProject(project: Omit<NovelProject, 'id' | 'createdAt' | 'updatedAt'>): Promise<NovelProject> {
    const id = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const created = await prisma.novelProject.create({
      data: {
        id,
        userId: 'default_user',
        title: project.title,
        description: project.description,
        styleSetting: project.styleSetting,
        worldSetting: project.worldSetting,
        powerSystem: project.powerSystem || '',
        goldFinger: project.goldFinger || '',
        coreConflict: project.coreConflict || '',
        factionsMap: project.factionsMap || '',
        sellingPoints: project.sellingPoints || '',
        outlineFull: project.outlineFull || '',
        antiAiStyleRules: JSON.stringify(project.antiAiStyleRules || []),
        modelsConfig: JSON.stringify(project.modelsConfig || []),
        agentBindings: JSON.stringify(project.agentBindings || {}),
        agentOverrides: JSON.stringify(project.agentOverrides || {}),
      } as any,
    });
    return formatProject(created);
  },

  async updateProject(id: string, updates: Partial<Omit<NovelProject, 'id' | 'createdAt'>>): Promise<NovelProject | undefined> {
    const data: Record<string, unknown> = { ...updates };
    if (updates.antiAiStyleRules !== undefined) {
      data.antiAiStyleRules = JSON.stringify(updates.antiAiStyleRules);
    }
    if (updates.modelsConfig !== undefined) {
      data.modelsConfig = JSON.stringify(updates.modelsConfig);
    }
    if (updates.agentBindings !== undefined) {
      data.agentBindings = JSON.stringify(updates.agentBindings);
    }
    if (updates.agentOverrides !== undefined) {
      data.agentOverrides = JSON.stringify(updates.agentOverrides);
    }
    const updated = await prisma.novelProject.update({
      where: { id },
      data: data as any,
    });
    return updated ? formatProject(updated) : undefined;
  },

  async deleteProject(id: string): Promise<boolean> {
    try {
      await prisma.novelProject.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },

  // --- 章节 (Chapter) ---
  async getChapters(projectId: string): Promise<Chapter[]> {
    const list = await prisma.chapter.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    return list.map(formatChapter);
  },

  async getChapter(id: string): Promise<Chapter | undefined> {
    const item = await prisma.chapter.findUnique({ where: { id } });
    return item ? formatChapter(item) : undefined;
  },

  async createChapter(chapter: Omit<Chapter, 'id' | 'createdAt' | 'updatedAt'>): Promise<Chapter> {
    const id = `chap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const created = await prisma.chapter.create({
      data: {
        id,
        projectId: chapter.projectId,
        title: chapter.title,
        content: chapter.content || '',
        summary: chapter.summary || '',
        characterChanges: JSON.stringify(chapter.characterChanges || []),
        newForeshadowing: JSON.stringify(chapter.newForeshadowing || []),
        resolvedForeshadowing: JSON.stringify(chapter.resolvedForeshadowing || []),
        timelineEvents: JSON.stringify(chapter.timelineEvents || []),
      },
    });
    return formatChapter(created);
  },

  async updateChapter(id: string, updates: Partial<Omit<Chapter, 'id' | 'projectId' | 'createdAt'>>): Promise<Chapter | undefined> {
    const data: Record<string, unknown> = { ...updates };
    if (updates.characterChanges !== undefined) {
      data.characterChanges = JSON.stringify(updates.characterChanges);
    }
    if (updates.newForeshadowing !== undefined) {
      data.newForeshadowing = JSON.stringify(updates.newForeshadowing);
    }
    if (updates.resolvedForeshadowing !== undefined) {
      data.resolvedForeshadowing = JSON.stringify(updates.resolvedForeshadowing);
    }
    if (updates.timelineEvents !== undefined) {
      data.timelineEvents = JSON.stringify(updates.timelineEvents);
    }
    const updated = await prisma.chapter.update({
      where: { id },
      data,
    });
    return updated ? formatChapter(updated) : undefined;
  },

  async deleteChapter(id: string): Promise<boolean> {
    try {
      await prisma.chapter.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },

  // --- 角色 (Character) ---
  async getCharacters(projectId: string): Promise<Character[]> {
    const list = await prisma.character.findMany({
      where: { projectId },
    });
    return list.map(formatCharacter);
  },

  async getCharacter(id: string): Promise<Character | undefined> {
    const item = await prisma.character.findUnique({ where: { id } });
    return item ? formatCharacter(item) : undefined;
  },

  async createCharacter(character: Omit<Character, 'id'>): Promise<Character> {
    const id = `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const created = await prisma.character.create({
      data: {
        id,
        projectId: character.projectId,
        name: character.name,
        role: character.role,
        age: character.age,
        identity: character.identity,
        personality: JSON.stringify(character.personality || []),
        goals: JSON.stringify(character.goals || []),
        relationships: JSON.stringify(character.relationships || []),
        currentState: character.currentState,
        forbidden: JSON.stringify(character.forbidden || []),
      },
    });
    return formatCharacter(created);
  },

  async updateCharacter(id: string, updates: Partial<Omit<Character, 'id' | 'projectId'>>): Promise<Character | undefined> {
    const data: Record<string, unknown> = { ...updates };
    if (updates.personality !== undefined) {
      data.personality = JSON.stringify(updates.personality);
    }
    if (updates.goals !== undefined) {
      data.goals = JSON.stringify(updates.goals);
    }
    if (updates.relationships !== undefined) {
      data.relationships = JSON.stringify(updates.relationships);
    }
    if (updates.forbidden !== undefined) {
      data.forbidden = JSON.stringify(updates.forbidden);
    }
    const updated = await prisma.character.update({
      where: { id },
      data,
    });
    return updated ? formatCharacter(updated) : undefined;
  },

  async deleteCharacter(id: string): Promise<boolean> {
    try {
      await prisma.character.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },

  // --- 世界观设定 (WorldRule) ---
  async getWorldRules(projectId: string): Promise<WorldRule[]> {
    const list = await prisma.worldRule.findMany({
      where: { projectId },
    });
    return list.map(r => ({
      ...r,
      type: r.type as 'location' | 'faction' | 'rule' | 'item' | 'other',
    }));
  },

  async getWorldRule(id: string): Promise<WorldRule | undefined> {
    const item = await prisma.worldRule.findUnique({ where: { id } });
    return item ? { ...item, type: item.type as 'location' | 'faction' | 'rule' | 'item' | 'other' } : undefined;
  },

  async createWorldRule(rule: Omit<WorldRule, 'id'>): Promise<WorldRule> {
    const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const created = await prisma.worldRule.create({
      data: {
        id,
        projectId: rule.projectId,
        type: rule.type,
        name: rule.name,
        description: rule.description,
      },
    });
    return { ...created, type: created.type as 'location' | 'faction' | 'rule' | 'item' | 'other' };
  },

  async updateWorldRule(id: string, updates: Partial<Omit<WorldRule, 'id' | 'projectId'>>): Promise<WorldRule | undefined> {
    const updated = await prisma.worldRule.update({
      where: { id },
      data: updates,
    });
    return updated ? { ...updated, type: updated.type as 'location' | 'faction' | 'rule' | 'item' | 'other' } : undefined;
  },

  async deleteWorldRule(id: string): Promise<boolean> {
    try {
      await prisma.worldRule.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },

  // --- 对话历史 (AgentMessage) ---
  async getAgentMessages(projectId: string): Promise<AgentMessage[]> {
    const list = await prisma.agentMessage.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    return list.map(formatAgentMessage);
  },

  async appendAgentMessage(projectId: string, msg: Omit<AgentMessage, 'projectId' | 'userId' | 'createdAt'>): Promise<AgentMessage> {
    const created = await prisma.agentMessage.create({
      data: {
        id: msg.id,
        projectId,
        userId: 'default_user',
        type: msg.type,
        agent: msg.agent,
        label: msg.label,
        content: msg.content,
        toolName: msg.toolName,
        toolInput: msg.toolInput ? JSON.stringify(msg.toolInput) : null,
        from: msg.from,
        fromLabel: msg.fromLabel,
        to: msg.to,
        toLabel: msg.toLabel,
      },
    });
    return formatAgentMessage(created);
  },

  async saveAgentMessages(projectId: string, messages: Omit<AgentMessage, 'projectId' | 'userId' | 'createdAt'>[]): Promise<AgentMessage[]> {
    // 过滤并删除旧历史对话
    await prisma.agentMessage.deleteMany({ where: { projectId } });

    const createdList = [];
    for (const msg of messages) {
      const created = await prisma.agentMessage.create({
        data: {
          id: msg.id,
          projectId,
          userId: 'default_user',
          type: msg.type,
          agent: msg.agent,
          label: msg.label,
          content: msg.content,
          toolName: msg.toolName,
          toolInput: msg.toolInput ? JSON.stringify(msg.toolInput) : null,
          from: msg.from,
          fromLabel: msg.fromLabel,
          to: msg.to,
          toLabel: msg.toLabel,
        },
      });
      createdList.push(formatAgentMessage(created));
    }
    return createdList;
  },

  async clearAgentMessages(projectId: string): Promise<boolean> {
    try {
      await prisma.agentMessage.deleteMany({ where: { projectId } });
      return true;
    } catch {
      return false;
    }
  },
};
