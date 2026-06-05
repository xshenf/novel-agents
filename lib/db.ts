import fs from 'fs';
import path from 'path';

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

export interface DatabaseSchema {
  projects: NovelProject[];
  characters: Character[];
  worldRules: WorldRule[];
  chapters: Chapter[];
  agentMessages: AgentMessage[];
}

const DB_FILE_PATH = path.join(process.cwd(), 'data', 'db.json');

// 默认空数据库结构
const initialData: DatabaseSchema = {
  projects: [],
  characters: [],
  worldRules: [],
  chapters: [],
  agentMessages: [],
};

// 确保目录和文件存在，并读取数据
function readDb(): DatabaseSchema {
  try {
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE_PATH)) {
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
      return initialData;
    }
    const dataStr = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(dataStr) as DatabaseSchema;
    if (!parsed.agentMessages) {
      parsed.agentMessages = [];
    }
    return parsed;
  } catch (error) {
    console.error('Error reading database file, using fallback initial data:', error);
    return initialData;
  }
}

// 写入数据到文件
function writeDb(data: DatabaseSchema): void {
  try {
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to write database file:', error);
  }
}

// 数据库操作类
export const db = {
  // --- 项目 (NovelProject) ---
  getProjects(): NovelProject[] {
    return readDb().projects;
  },

  getProject(id: string): NovelProject | undefined {
    return readDb().projects.find(p => p.id === id);
  },

  createProject(project: Omit<NovelProject, 'id' | 'createdAt' | 'updatedAt'>): NovelProject {
    const database = readDb();
    const now = new Date().toISOString();
    const newProject: NovelProject = {
      ...project,
      id: `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: 'default_user',
      createdAt: now,
      updatedAt: now,
    };
    database.projects.push(newProject);
    writeDb(database);
    return newProject;
  },

  updateProject(id: string, updates: Partial<Omit<NovelProject, 'id' | 'createdAt'>>): NovelProject | undefined {
    const database = readDb();
    const index = database.projects.findIndex(p => p.id === id);
    if (index === -1) return undefined;

    const updated = {
      ...database.projects[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    database.projects[index] = updated;
    writeDb(database);
    return updated;
  },

  deleteProject(id: string): boolean {
    const database = readDb();
    const originalLength = database.projects.length;
    database.projects = database.projects.filter(p => p.id !== id);
    // 级联删除关联的章节、角色、设定及对话历史
    database.chapters = database.chapters.filter(c => c.projectId !== id);
    database.characters = database.characters.filter(c => c.projectId !== id);
    database.worldRules = database.worldRules.filter(w => w.projectId !== id);
    database.agentMessages = database.agentMessages.filter(m => m.projectId !== id);
    writeDb(database);
    return database.projects.length < originalLength;
  },

  // --- 章节 (Chapter) ---
  getChapters(projectId: string): Chapter[] {
    return readDb().chapters.filter(c => c.projectId === projectId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  getChapter(id: string): Chapter | undefined {
    return readDb().chapters.find(c => c.id === id);
  },

  createChapter(chapter: Omit<Chapter, 'id' | 'createdAt' | 'updatedAt'>): Chapter {
    const database = readDb();
    const now = new Date().toISOString();
    const newChapter: Chapter = {
      ...chapter,
      id: `chap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
    };
    database.chapters.push(newChapter);
    writeDb(database);
    return newChapter;
  },

  updateChapter(id: string, updates: Partial<Omit<Chapter, 'id' | 'projectId' | 'createdAt'>>): Chapter | undefined {
    const database = readDb();
    const index = database.chapters.findIndex(c => c.id === id);
    if (index === -1) return undefined;

    const updated = {
      ...database.chapters[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    database.chapters[index] = updated;
    writeDb(database);
    return updated;
  },

  deleteChapter(id: string): boolean {
    const database = readDb();
    const originalLength = database.chapters.length;
    database.chapters = database.chapters.filter(c => c.id !== id);
    writeDb(database);
    return database.chapters.length < originalLength;
  },

  // --- 角色 (Character) ---
  getCharacters(projectId: string): Character[] {
    return readDb().characters.filter(c => c.projectId === projectId);
  },

  getCharacter(id: string): Character | undefined {
    return readDb().characters.find(c => c.id === id);
  },

  createCharacter(character: Omit<Character, 'id'>): Character {
    const database = readDb();
    const newCharacter: Character = {
      ...character,
      id: `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    database.characters.push(newCharacter);
    writeDb(database);
    return newCharacter;
  },

  updateCharacter(id: string, updates: Partial<Omit<Character, 'id' | 'projectId'>>): Character | undefined {
    const database = readDb();
    const index = database.characters.findIndex(c => c.id === id);
    if (index === -1) return undefined;

    const updated = {
      ...database.characters[index],
      ...updates,
    };
    database.characters[index] = updated;
    writeDb(database);
    return updated;
  },

  deleteCharacter(id: string): boolean {
    const database = readDb();
    const originalLength = database.characters.length;
    database.characters = database.characters.filter(c => c.id !== id);
    writeDb(database);
    return database.characters.length < originalLength;
  },

  // --- 世界观设定 (WorldRule) ---
  getWorldRules(projectId: string): WorldRule[] {
    return readDb().worldRules.filter(w => w.projectId === projectId);
  },

  getWorldRule(id: string): WorldRule | undefined {
    return readDb().worldRules.find(w => w.id === id);
  },

  createWorldRule(rule: Omit<WorldRule, 'id'>): WorldRule {
    const database = readDb();
    const newRule: WorldRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    database.worldRules.push(newRule);
    writeDb(database);
    return newRule;
  },

  updateWorldRule(id: string, updates: Partial<Omit<WorldRule, 'id' | 'projectId'>>): WorldRule | undefined {
    const database = readDb();
    const index = database.worldRules.findIndex(w => w.id === id);
    if (index === -1) return undefined;

    const updated = {
      ...database.worldRules[index],
      ...updates,
    };
    database.worldRules[index] = updated;
    writeDb(database);
    return updated;
  },

  deleteWorldRule(id: string): boolean {
    const database = readDb();
    const originalLength = database.worldRules.length;
    database.worldRules = database.worldRules.filter(w => w.id !== id);
    writeDb(database);
    return database.worldRules.length < originalLength;
  },

  // --- 对话历史 (AgentMessage) ---
  getAgentMessages(projectId: string): AgentMessage[] {
    return readDb().agentMessages.filter(m => m.projectId === projectId);
  },

  saveAgentMessages(projectId: string, messages: Omit<AgentMessage, 'projectId' | 'userId' | 'createdAt'>[]): AgentMessage[] {
    const database = readDb();
    const now = new Date().toISOString();
    // 过滤掉当前项目的旧对话，然后再存入新的对话
    const filteredMessages = database.agentMessages.filter(m => m.projectId !== projectId);
    
    const newMessages: AgentMessage[] = messages.map(msg => ({
      ...msg,
      projectId,
      userId: 'default_user',
      createdAt: now
    }));

    database.agentMessages = [...filteredMessages, ...newMessages];
    writeDb(database);
    return newMessages;
  },

  clearAgentMessages(projectId: string): boolean {
    const database = readDb();
    const originalLength = database.agentMessages.length;
    database.agentMessages = database.agentMessages.filter(m => m.projectId !== projectId);
    writeDb(database);
    return database.agentMessages.length < originalLength;
  },
};
