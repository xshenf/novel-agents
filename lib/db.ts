import { randomUUID } from 'crypto';
import {
  PrismaClient,
  NovelProject as PrismaProject,
  Character as PrismaCharacter,
  Chapter as PrismaChapter,
  AgentMessage as PrismaMessage,
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
  order: number;
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

function getCurrentUserId(): string {
  // TODO: Replace with actual auth-based user ID
  return 'default_user';
}

// M4 修复：安全的 JSON.parse，解析失败时返回默认值而不是抛错
function safeJsonParse<T>(json: string | null | undefined, defaultValue: T): T {
  if (!json) return defaultValue;
  try {
    return JSON.parse(json) as T;
  } catch (e) {
    console.warn('[db] JSON.parse failed:', e, 'raw:', json?.slice(0, 100));
    return defaultValue;
  }
}

// 辅助序列化/反序列化格式化函数
function formatProject(p: PrismaProject): NovelProject {
  const rawModels = safeJsonParse<any[]>((p as any).modelsConfig, []);
  // API Key 脱敏：返回给前端时隐藏真实密钥
  const maskedModels = rawModels.map(m => ({
    ...m,
    apiKey: m.apiKey ? '***' + String(m.apiKey).slice(-4) : '',
  }));
  return {
    ...p,
    antiAiStyleRules: safeJsonParse<string[]>(p.antiAiStyleRules, []),
    modelsConfig: maskedModels,
    agentBindings: safeJsonParse<Record<string, string>>((p as any).agentBindings, {}),
    agentOverrides: safeJsonParse<Record<string, any>>((p as any).agentOverrides, {}),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function formatCharacter(c: PrismaCharacter): Character {
  return {
    ...c,
    personality: safeJsonParse<string[]>(c.personality, []),
    goals: safeJsonParse<string[]>(c.goals, []),
    forbidden: safeJsonParse<string[]>(c.forbidden, []),
    relationships: safeJsonParse<CharacterRelationship[]>(c.relationships, []),
  };
}

function formatChapter(ch: PrismaChapter): Chapter {
  return {
    ...ch,
    characterChanges: safeJsonParse<CharacterChange[]>(ch.characterChanges, []),
    newForeshadowing: safeJsonParse<string[]>(ch.newForeshadowing, []),
    resolvedForeshadowing: safeJsonParse<string[]>(ch.resolvedForeshadowing, []),
    timelineEvents: safeJsonParse<string[]>(ch.timelineEvents, []),
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

  async getProjectList(): Promise<Pick<NovelProject, 'id' | 'title' | 'description' | 'createdAt' | 'updatedAt'>[]> {
    const list = await prisma.novelProject.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, description: true, createdAt: true, updatedAt: true },
    });
    return list.map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  },

  async getProject(id: string): Promise<NovelProject | undefined> {
    const item = await prisma.novelProject.findUnique({ where: { id } });
    return item ? formatProject(item) : undefined;
  },

  async createProject(project: Omit<NovelProject, 'id' | 'createdAt' | 'updatedAt'>): Promise<NovelProject> {
    const id = `proj_${randomUUID()}`;
    const created = await prisma.novelProject.create({
      data: {
        id,
        userId: getCurrentUserId(),
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
      // 保护 API Key：若前端传来的 model apiKey 是脱敏值（*** 开头），
      // 则从数据库中读取原始值合并，避免脱敏 key 覆盖真实 key
      const incoming = updates.modelsConfig as any[];
      let final = incoming;
      if (incoming.some((m: any) => m.apiKey && String(m.apiKey).startsWith('***'))) {
        const existing = await prisma.novelProject.findUnique({ where: { id }, select: { modelsConfig: true } });
        const rawJson = (existing as any)?.modelsConfig as string | undefined;
        if (rawJson && rawJson.length > 2) {
          try {
            const existingModels = JSON.parse(rawJson) as any[];
            final = incoming.map((m: any) => {
              if (m.apiKey && String(m.apiKey).startsWith('***')) {
                const existingModel = existingModels.find((em: any) => em.id === m.id);
                if (existingModel?.apiKey && !String(existingModel.apiKey).startsWith('***')) {
                  return { ...m, apiKey: existingModel.apiKey };
                }
              }
              return m;
            });
          } catch { /* JSON 解析失败则按原样保存 */ }
        }
      }
      data.modelsConfig = JSON.stringify(final);
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
  // S3 修复：使用 order 字段排序，确保章节顺序稳定（不受 createdAt 影响）
  async getChapters(projectId: string): Promise<Chapter[]> {
    const list = await prisma.chapter.findMany({
      where: { projectId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    return list.map(formatChapter);
  },

  // 轻量章节查询：仅返回 id/title/summary，不含 content 等大字段，
  // 供 getProjectOverviewTool 等只需概览信息的场景使用，避免长篇小说拉取数百 KB 正文。
  async getChapterSummaries(projectId: string): Promise<Pick<Chapter, 'id' | 'title' | 'summary' | 'createdAt'>[]> {
    const list = await prisma.chapter.findMany({
      where: { projectId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, title: true, summary: true, createdAt: true },
    });
    return list.map(c => ({ id: c.id, title: c.title, summary: c.summary || '', createdAt: c.createdAt.toISOString() }));
  },

  // 元数据查询：排除 content 大字段，包含 summary + 伏笔/人物变更/时间线等结构化元数据，
  // 供 searchMemory 等只需章节元信息的场景使用，避免加载全部章节正文。
  async getChapterMetadata(projectId: string): Promise<Chapter[]> {
    const list = await prisma.chapter.findMany({
      where: { projectId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true, projectId: true, title: true, summary: true,
        characterChanges: true, newForeshadowing: true,
        resolvedForeshadowing: true, timelineEvents: true,
        order: true, createdAt: true, updatedAt: true,
      },
    });
    return list.map(ch => ({
      ...ch,
      content: '', // 不加载正文
      characterChanges: ch.characterChanges ? JSON.parse(ch.characterChanges) : [],
      newForeshadowing: ch.newForeshadowing ? JSON.parse(ch.newForeshadowing) : [],
      resolvedForeshadowing: ch.resolvedForeshadowing ? JSON.parse(ch.resolvedForeshadowing) : [],
      timelineEvents: ch.timelineEvents ? JSON.parse(ch.timelineEvents) : [],
      createdAt: ch.createdAt.toISOString(),
      updatedAt: ch.updatedAt.toISOString(),
    }));
  },

  async getChapter(id: string): Promise<Chapter | undefined> {
    const item = await prisma.chapter.findUnique({ where: { id } });
    return item ? formatChapter(item) : undefined;
  },

  async createChapter(chapter: Omit<Chapter, 'id' | 'createdAt' | 'updatedAt' | 'order'>): Promise<Chapter> {
    const id = `chap_${randomUUID()}`;
    // S3 修复：order 自动追加到该项目末尾（当前最大 order + 1，无章节时从 0 起），
    // 使排序有稳定区分度而非全为默认 0；后续如需重排章节只改 order 即可。
    const agg = await prisma.chapter.aggregate({
      where: { projectId: chapter.projectId },
      _max: { order: true },
    });
    const order = (agg._max.order ?? -1) + 1;
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
        order,
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
    const id = `char_${randomUUID()}`;
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
    const id = `rule_${randomUUID()}`;
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
    const id = `ws_${randomUUID()}`;
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
      // S2 修复：删除后剩余的同名条目只可能是 pinned（用户锁定）或 source=manual（手动维护）。
      // AI 不得覆盖或与之重复 —— 遇到同名直接跳过，既不覆盖锁定/手动内容，也不堆积重复条目。
      const remaining = await tx.worldState.findMany({
        where: { projectId },
        select: { name: true },
      });
      const seenNames = new Set(remaining.map(r => r.name));
      for (const item of items) {
        if (seenNames.has(item.name)) continue;
        seenNames.add(item.name); // 同时防止本批 items 内部出现同名重复
        const id = `ws_${randomUUID()}`;
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
        userId: getCurrentUserId(),
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
            userId: getCurrentUserId(),
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
