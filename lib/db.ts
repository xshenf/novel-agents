import { 
  PrismaClient, 
  NovelProject as PrismaProject, 
  Character as PrismaCharacter, 
  Chapter as PrismaChapter, 
  AgentMessage as PrismaMessage,
  WorldState as PrismaWorldState
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
  skillSystem?: string;
  location?: string;
  faction?: string;
  currency?: string;
  item?: string;
  outlineFull?: string;
  rollingSynopsis?: string;
  antiAiStyleRules?: string[];
  forbiddenSetting?: string;
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

export interface WorldState {
  id: string;
  projectId: string;
  category: string;
  name: string;
  content: string;
  pinned: boolean;
  source: 'ai' | 'manual';
  updatedAtChapter: string;
  updatedAt: string;
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
  const rawModels = (p as any).modelsConfig ? JSON.parse((p as any).modelsConfig) as any[] : [];
  // API Key 脱敏：返回给前端时隐藏真实密钥
  const maskedModels = rawModels.map(m => ({
    ...m,
    apiKey: m.apiKey ? '***' + String(m.apiKey).slice(-4) : '',
  }));
  return {
    ...p,
    antiAiStyleRules: p.antiAiStyleRules ? JSON.parse(p.antiAiStyleRules) as string[] : [],
    modelsConfig: maskedModels,
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
    const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
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
        forbiddenSetting: project.forbiddenSetting || '',
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

  // 轻量章节查询：仅返回 id/title/summary，不含 content 等大字段，
  // 供 getProjectOverviewTool 等只需概览信息的场景使用，避免长篇小说拉取数百 KB 正文。
  async getChapterSummaries(projectId: string): Promise<Pick<Chapter, 'id' | 'title' | 'summary' | 'createdAt'>[]> {
    const list = await prisma.chapter.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true, summary: true, createdAt: true },
    });
    return list.map(c => ({ id: c.id, title: c.title, summary: c.summary || '', createdAt: c.createdAt.toISOString() }));
  },

  async getChapter(id: string): Promise<Chapter | undefined> {
    const item = await prisma.chapter.findUnique({ where: { id } });
    return item ? formatChapter(item) : undefined;
  },

  async createChapter(chapter: Omit<Chapter, 'id' | 'createdAt' | 'updatedAt'>): Promise<Chapter> {
    const id = `chap_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
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
    const id = `char_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
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
    const id = `rule_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
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

  // --- 世界状态 (WorldState) ---
  async getWorldStates(projectId: string): Promise<WorldState[]> {
    const list = await prisma.worldState.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
    });
    return list.map(s => ({
      ...s,
      source: s.source as 'ai' | 'manual',
      updatedAt: s.updatedAt.toISOString(),
    }));
  },

  async getWorldState(id: string): Promise<WorldState | undefined> {
    const item = await prisma.worldState.findUnique({ where: { id } });
    return item ? { ...item, source: item.source as 'ai' | 'manual', updatedAt: item.updatedAt.toISOString() } : undefined;
  },

  async createWorldState(state: Omit<WorldState, 'id' | 'updatedAt'>): Promise<WorldState> {
    const id = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const created = await prisma.worldState.create({
      data: {
        id,
        projectId: state.projectId,
        category: state.category,
        name: state.name,
        content: state.content,
        pinned: state.pinned ?? false,
        source: state.source || 'ai',
        updatedAtChapter: state.updatedAtChapter || '',
      },
    });
    return { ...created, source: created.source as 'ai' | 'manual', updatedAt: created.updatedAt.toISOString() };
  },

  async updateWorldState(id: string, updates: Partial<Omit<WorldState, 'id' | 'projectId'>>): Promise<WorldState | undefined> {
    const updated = await prisma.worldState.update({
      where: { id },
      data: updates,
    });
    return updated ? { ...updated, source: updated.source as 'ai' | 'manual', updatedAt: updated.updatedAt.toISOString() } : undefined;
  },

  async deleteWorldState(id: string): Promise<boolean> {
    try {
      await prisma.worldState.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },

  async replaceAutoWorldStates(projectId: string, items: Array<{ category: string; name: string; content: string; updatedAtChapter?: string }>): Promise<void> {
    if (!items || items.length === 0) return; // 防止 AI 返回空数组时清空数据
    await prisma.$transaction(async (tx) => {
      // 删除该项目所有非锁定且来源为 ai 的条目
      await tx.worldState.deleteMany({
        where: { projectId, pinned: false, source: 'ai' },
      });
      // 批量插入 AI 输出的新条目
      for (const item of items) {
        const id = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        await tx.worldState.create({
          data: {
            id,
            projectId,
            category: item.category,
            name: item.name,
            content: item.content,
            pinned: false,
            source: 'ai',
            updatedAtChapter: item.updatedAtChapter || '',
          },
        });
      }
    });
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
    const createdList = await prisma.$transaction(async (tx) => {
      await tx.agentMessage.deleteMany({ where: { projectId } });
      const results = [];
      for (const msg of messages) {
        const created = await tx.agentMessage.create({
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
        results.push(created);
      }
      return results;
    });
    return createdList.map(formatAgentMessage);
  },

  async clearAgentMessages(projectId: string): Promise<boolean> {
    try {
      await prisma.agentMessage.deleteMany({ where: { projectId } });
      return true;
    } catch {
      return false;
    }
  },

  // --- 版本快照 (VersionSnapshot) ---
  async getVersionSnapshots(projectId: string, type?: string): Promise<any[]> {
    const where: any = { projectId };
    if (type) where.type = type;
    const list = await prisma.versionSnapshot.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return list;
  },

  async createVersionSnapshot(params: { projectId: string; type: string; key: string; label: string; data: string; source: string }): Promise<any> {
    return prisma.versionSnapshot.create({ data: params });
  },

  async deleteVersionSnapshot(id: string): Promise<boolean> {
    try {
      await prisma.versionSnapshot.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },

  async findRecentVersionSnapshot(projectId: string, key: string, source: string, since: Date): Promise<any | null> {
    return prisma.versionSnapshot.findFirst({
      where: { projectId, key, source, createdAt: { gte: since } },
    });
  },
};
