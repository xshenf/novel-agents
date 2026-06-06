import { create } from 'zustand';
import { NovelProject, Chapter, Character, WorldRule } from './db';

export interface ModelConfig {
  id: string;
  provider: string; // 'gemini' | 'openai' | 'deepseek' | 'claude' | 'custom'
  name: string;
  alias: string;
  apiKey: string;
  apiBaseUrl: string;
  temperature: number;
  maxTokens: number;
  reasoningEnabled: boolean;
}

interface NovelStore {
  projects: NovelProject[];
  currentProject: NovelProject | null;
  chapters: Chapter[];
  currentChapter: Chapter | null;
  characters: Character[];
  worldRules: WorldRule[];
  apiKey: string;
  modelName: string;
  apiProvider: string;
  apiBaseUrl: string;
  temperature: number;
  maxTokens: number;
  systemInstruction: string;
  reasoningEnabled: boolean;
  isLoading: boolean;
  error: string | null;

  // 多模型与智能体特异配置
  models: ModelConfig[];
  agentModelBindings: Record<string, string>;
  agentOverrides: Record<string, { temperature?: number; maxTokens?: number }>;

  setApiKey: (key: string) => void;
  setModelName: (model: string) => void;
  setApiProvider: (provider: string) => void;
  setApiBaseUrl: (url: string) => void;
  setTemperature: (temp: number) => void;
  setMaxTokens: (tokens: number) => void;
  setSystemInstruction: (inst: string) => void;
  setReasoningEnabled: (enabled: boolean) => void;

  addModel: (model: Omit<ModelConfig, 'id'>) => string;
  updateModel: (id: string, updates: Partial<ModelConfig>) => void;
  deleteModel: (id: string) => void;
  bindAgentModel: (agent: string, modelId: string) => void;
  updateAgentOverride: (agent: string, overrides: { temperature?: number; maxTokens?: number } | null) => void;
  
  fetchProjects: () => Promise<void>;
  createProject: (title: string, description: string, styleSetting?: string, worldSetting?: string) => Promise<NovelProject>;
  deleteProject: (id: string) => Promise<void>;
  updateProject: (id: string, updates: Partial<Omit<NovelProject, 'id' | 'createdAt'>>) => Promise<NovelProject>;
  setCurrentProject: (project: NovelProject | null) => void;

  fetchChapters: (projectId: string) => Promise<void>;
  createChapter: (projectId: string, title: string) => Promise<Chapter>;
  updateChapter: (id: string, updates: Partial<Omit<Chapter, 'id' | 'projectId' | 'createdAt'>>) => Promise<void>;
  deleteChapter: (id: string) => Promise<void>;
  setCurrentChapter: (chapter: Chapter | null) => void;

  fetchCharacters: (projectId: string) => Promise<void>;
  createCharacter: (char: Omit<Character, 'id'>) => Promise<Character>;
  updateCharacter: (id: string, updates: Partial<Omit<Character, 'id' | 'projectId'>>) => Promise<void>;
  deleteCharacter: (id: string) => Promise<void>;

  fetchWorldRules: (projectId: string) => Promise<void>;
  createWorldRule: (rule: Omit<WorldRule, 'id'>) => Promise<WorldRule>;
  updateWorldRule: (id: string, updates: Partial<Omit<WorldRule, 'id' | 'projectId'>>) => Promise<void>;
  deleteWorldRule: (id: string) => Promise<void>;
}

export const useNovelStore = create<NovelStore>((set, get) => {
  // 仅在客户端运行时读取 localStorage
  const initialApiKey = typeof window !== 'undefined' ? localStorage.getItem('novel_api_key') || '' : '';
  const initialModel = typeof window !== 'undefined' ? localStorage.getItem('novel_model_name') || 'gemini-2.5-flash' : 'gemini-2.5-flash';
  const initialProvider = typeof window !== 'undefined' ? localStorage.getItem('novel_api_provider') || 'gemini' : 'gemini';
  const initialBaseUrl = typeof window !== 'undefined' ? localStorage.getItem('novel_api_base_url') || '' : '';
  const initialTemp = typeof window !== 'undefined' ? Number(localStorage.getItem('novel_temperature') || '0.7') : 0.7;
  const initialTokens = typeof window !== 'undefined' ? Number(localStorage.getItem('novel_max_tokens') || '3000') : 3000;
  const initialSystemInst = typeof window !== 'undefined' ? localStorage.getItem('novel_system_instruction') || '' : '';
  const initialReasoning = typeof window !== 'undefined' ? localStorage.getItem('novel_reasoning_enabled') === 'true' : false;

  // 1. 初始化模型池与绑定数据
  let parsedModels: ModelConfig[] = [];
  let parsedBindings: Record<string, string> = {};
  let parsedOverrides: Record<string, { temperature?: number; maxTokens?: number }> = {};

  if (typeof window !== 'undefined') {
    try {
      const storedModels = localStorage.getItem('novel_models');
      if (storedModels) {
        parsedModels = JSON.parse(storedModels);
      }
      const storedBindings = localStorage.getItem('novel_agent_bindings');
      if (storedBindings) {
        parsedBindings = JSON.parse(storedBindings);
      }
      const storedOverrides = localStorage.getItem('novel_agent_overrides');
      if (storedOverrides) {
        parsedOverrides = JSON.parse(storedOverrides);
      }
    } catch (e) {
      console.error('Failed to parse multi-model config', e);
    }
  }

  // 2. 平滑升级：若没有配置新模型列表但有旧的配置，将其打包成默认模型
  if (parsedModels.length === 0) {
    const fallbackId = 'default-model-id';
    parsedModels = [
      {
        id: fallbackId,
        provider: initialProvider,
        name: initialModel,
        alias: '默认模型',
        apiKey: initialApiKey,
        apiBaseUrl: initialBaseUrl,
        temperature: initialTemp,
        maxTokens: initialTokens,
        reasoningEnabled: initialReasoning
      }
    ];
    parsedBindings = {
      orchestrator: fallbackId,
      planner: fallbackId,
      lore_builder: fallbackId,
      writer: fallbackId,
      editor: fallbackId
    };
  }

  return {
    projects: [],
    currentProject: null,
    chapters: [],
    currentChapter: null,
    characters: [],
    worldRules: [],
    apiKey: initialApiKey,
    modelName: initialModel,
    apiProvider: initialProvider,
    apiBaseUrl: initialBaseUrl,
    temperature: initialTemp,
    maxTokens: initialTokens,
    systemInstruction: initialSystemInst,
    reasoningEnabled: initialReasoning,
    isLoading: false,
    error: null,

    // 多模型配置状态
    models: parsedModels,
    agentModelBindings: parsedBindings,
    agentOverrides: parsedOverrides,

    setApiKey: (key: string) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('novel_api_key', key);
      }
      set({ apiKey: key });
      // 同步更新默认模型
      const defaultModel = get().models.find(m => m.id === 'default-model-id');
      if (defaultModel) {
        get().updateModel('default-model-id', { apiKey: key });
      }
    },

    setModelName: (model: string) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('novel_model_name', model);
      }
      set({ modelName: model });
      const defaultModel = get().models.find(m => m.id === 'default-model-id');
      if (defaultModel) {
        get().updateModel('default-model-id', { name: model });
      }
    },

    setApiProvider: (provider: string) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('novel_api_provider', provider);
      }
      set({ apiProvider: provider });
      const defaultModel = get().models.find(m => m.id === 'default-model-id');
      if (defaultModel) {
        get().updateModel('default-model-id', { provider });
      }
    },

    setApiBaseUrl: (url: string) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('novel_api_base_url', url);
      }
      set({ apiBaseUrl: url });
      const defaultModel = get().models.find(m => m.id === 'default-model-id');
      if (defaultModel) {
        get().updateModel('default-model-id', { apiBaseUrl: url });
      }
    },

    setTemperature: (temp: number) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('novel_temperature', String(temp));
      }
      set({ temperature: temp });
      const defaultModel = get().models.find(m => m.id === 'default-model-id');
      if (defaultModel) {
        get().updateModel('default-model-id', { temperature: temp });
      }
    },

    setMaxTokens: (tokens: number) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('novel_max_tokens', String(tokens));
      }
      set({ maxTokens: tokens });
      const defaultModel = get().models.find(m => m.id === 'default-model-id');
      if (defaultModel) {
        get().updateModel('default-model-id', { maxTokens: tokens });
      }
    },

    setSystemInstruction: (inst: string) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('novel_system_instruction', inst);
      }
      set({ systemInstruction: inst });
    },

    setReasoningEnabled: (enabled: boolean) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('novel_reasoning_enabled', String(enabled));
      }
      set({ reasoningEnabled: enabled });
      const defaultModel = get().models.find(m => m.id === 'default-model-id');
      if (defaultModel) {
        get().updateModel('default-model-id', { reasoningEnabled: enabled });
      }
    },

    addModel: (model) => {
      const newId = 'model_' + Math.random().toString(36).substring(2, 11);
      const newModel: ModelConfig = { ...model, id: newId };
      const nextModels = [...get().models, newModel];
      if (typeof window !== 'undefined') {
        localStorage.setItem('novel_models', JSON.stringify(nextModels));
      }
      set({ models: nextModels });
      return newId;
    },

    updateModel: (id, updates) => {
      const nextModels = get().models.map(m => m.id === id ? { ...m, ...updates } : m);
      if (typeof window !== 'undefined') {
        localStorage.setItem('novel_models', JSON.stringify(nextModels));
      }
      set({ models: nextModels });

      // 如果更新了与旧属性对应的绑定配置，也同步更新旧属性值以保证最大程度兼容
      const currentBinding = get().agentModelBindings['orchestrator'];
      if (currentBinding === id) {
        const updated = nextModels.find(m => m.id === id);
        if (updated) {
          set({
            apiKey: updated.apiKey,
            modelName: updated.name,
            apiProvider: updated.provider,
            apiBaseUrl: updated.apiBaseUrl,
            temperature: updated.temperature,
            maxTokens: updated.maxTokens,
            reasoningEnabled: updated.reasoningEnabled,
          });
          if (typeof window !== 'undefined') {
            localStorage.setItem('novel_api_key', updated.apiKey);
            localStorage.setItem('novel_model_name', updated.name);
            localStorage.setItem('novel_api_provider', updated.provider);
            localStorage.setItem('novel_api_base_url', updated.apiBaseUrl);
            localStorage.setItem('novel_temperature', String(updated.temperature));
            localStorage.setItem('novel_max_tokens', String(updated.maxTokens));
            localStorage.setItem('novel_reasoning_enabled', String(updated.reasoningEnabled));
          }
        }
      }
    },

    deleteModel: (id) => {
      if (get().models.length <= 1) return;
      const nextModels = get().models.filter(m => m.id !== id);
      const remainingId = nextModels[0].id;

      const nextBindings = { ...get().agentModelBindings };
      let changed = false;
      for (const agent in nextBindings) {
        if (nextBindings[agent] === id) {
          nextBindings[agent] = remainingId;
          changed = true;
        }
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('novel_models', JSON.stringify(nextModels));
        if (changed) {
          localStorage.setItem('novel_agent_bindings', JSON.stringify(nextBindings));
        }
      }
      set({ models: nextModels, agentModelBindings: nextBindings });
    },

    bindAgentModel: (agent, modelId) => {
      const nextBindings = { ...get().agentModelBindings, [agent]: modelId };
      if (typeof window !== 'undefined') {
        localStorage.setItem('novel_agent_bindings', JSON.stringify(nextBindings));
      }
      set({ agentModelBindings: nextBindings });

      if (agent === 'orchestrator') {
        const model = get().models.find(m => m.id === modelId);
        if (model) {
          set({
            apiKey: model.apiKey,
            modelName: model.name,
            apiProvider: model.provider,
            apiBaseUrl: model.apiBaseUrl,
            temperature: model.temperature,
            maxTokens: model.maxTokens,
            reasoningEnabled: model.reasoningEnabled,
          });
        }
      }
    },

    updateAgentOverride: (agent, overrides) => {
      const nextOverrides = { ...get().agentOverrides };
      if (overrides === null) {
        delete nextOverrides[agent];
      } else {
        nextOverrides[agent] = { ...nextOverrides[agent], ...overrides };
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('novel_agent_overrides', JSON.stringify(nextOverrides));
      }
      set({ agentOverrides: nextOverrides });
    },

    fetchProjects: async () => {
      set({ isLoading: true, error: null });
      try {
        const res = await fetch('/api/projects');
        if (!res.ok) throw new Error('获取项目失败');
        const data = await res.json();
        set({ projects: data, isLoading: false });
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
      }
    },

    createProject: async (title: string, description: string, styleSetting = '', worldSetting = '') => {
      set({ isLoading: true, error: null });
      try {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description, styleSetting, worldSetting }),
        });
        if (!res.ok) throw new Error('创建项目失败');
        const newProj = await res.json();
        set(state => ({
          projects: [...state.projects, newProj],
          isLoading: false
        }));
        return newProj;
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
        throw err;
      }
    },

    deleteProject: async (id: string) => {
      set({ isLoading: true, error: null });
      try {
        const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('删除项目失败');
        set(state => ({
          projects: state.projects.filter(p => p.id !== id),
          currentProject: state.currentProject?.id === id ? null : state.currentProject,
          chapters: state.currentProject?.id === id ? [] : state.chapters,
          currentChapter: state.currentProject?.id === id ? null : state.currentChapter,
          isLoading: false
        }));
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
      }
    },

    updateProject: async (id: string, updates: Partial<Omit<NovelProject, 'id' | 'createdAt'>>) => {
      set({ isLoading: true, error: null });
      try {
        const res = await fetch(`/api/projects/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error('更新项目失败');
        const updated = await res.json();
        set(state => ({
          projects: state.projects.map(p => p.id === id ? updated : p),
          currentProject: state.currentProject?.id === id ? updated : state.currentProject,
          isLoading: false
        }));
        return updated;
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
        throw err;
      }
    },

    setCurrentProject: (project) => {
      set({ currentProject: project, currentChapter: null });
      if (project) {
        get().fetchChapters(project.id);
        get().fetchCharacters(project.id);
        get().fetchWorldRules(project.id);
      }
    },

    fetchChapters: async (projectId: string) => {
      try {
        const res = await fetch(`/api/chapters?projectId=${projectId}`);
        if (!res.ok) throw new Error('获取章节失败');
        const data = await res.json();
        set({ chapters: data });
      } catch (err: any) {
        set({ error: err.message });
      }
    },

    createChapter: async (projectId: string, title: string) => {
      try {
        const res = await fetch('/api/chapters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, title, content: '' }),
        });
        if (!res.ok) throw new Error('创建章节失败');
        const newChap = await res.json();
        set(state => ({
          chapters: [...state.chapters, newChap],
          currentChapter: newChap
        }));
        return newChap;
      } catch (err: any) {
        set({ error: err.message });
        throw err;
      }
    },

    updateChapter: async (id: string, updates: Partial<Omit<Chapter, 'id' | 'projectId' | 'createdAt'>>) => {
      try {
        const res = await fetch(`/api/chapters/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error('更新章节失败');
        const updated = await res.json();
        set(state => ({
          chapters: state.chapters.map(c => c.id === id ? updated : c),
          currentChapter: state.currentChapter?.id === id ? updated : state.currentChapter,
        }));
      } catch (err: any) {
        set({ error: err.message });
      }
    },

    deleteChapter: async (id: string) => {
      try {
        const res = await fetch(`/api/chapters/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('删除章节失败');
        set(state => ({
          chapters: state.chapters.filter(c => c.id !== id),
          currentChapter: state.currentChapter?.id === id ? null : state.currentChapter
        }));
      } catch (err: any) {
        set({ error: err.message });
      }
    },

    setCurrentChapter: (chapter) => {
      set({ currentChapter: chapter });
    },

    fetchCharacters: async (projectId: string) => {
      try {
        const res = await fetch(`/api/characters?projectId=${projectId}`);
        if (!res.ok) throw new Error('获取角色卡失败');
        const data = await res.json();
        set({ characters: data });
      } catch (err: any) {
        set({ error: err.message });
      }
    },

    createCharacter: async (char: Omit<Character, 'id'>) => {
      try {
        const res = await fetch('/api/characters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(char),
        });
        if (!res.ok) throw new Error('创建角色卡失败');
        const newChar = await res.json();
        set(state => ({ characters: [...state.characters, newChar] }));
        return newChar;
      } catch (err: any) {
        set({ error: err.message });
        throw err;
      }
    },

    updateCharacter: async (id: string, updates: Partial<Omit<Character, 'id' | 'projectId'>>) => {
      try {
        const res = await fetch(`/api/characters/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error('更新角色卡失败');
        const updated = await res.json();
        set(state => ({
          characters: state.characters.map(c => c.id === id ? updated : c),
        }));
      } catch (err: any) {
        set({ error: err.message });
      }
    },

    deleteCharacter: async (id: string) => {
      try {
        const res = await fetch(`/api/characters/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('删除角色卡失败');
        set(state => ({ characters: state.characters.filter(c => c.id !== id) }));
      } catch (err: any) {
        set({ error: err.message });
      }
    },

    fetchWorldRules: async (projectId: string) => {
      try {
        const res = await fetch(`/api/world-rules?projectId=${projectId}`);
        if (!res.ok) throw new Error('获取设定失败');
        const data = await res.json();
        set({ worldRules: data });
      } catch (err: any) {
        set({ error: err.message });
      }
    },

    createWorldRule: async (rule: Omit<WorldRule, 'id'>) => {
      try {
        const res = await fetch('/api/world-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rule),
        });
        if (!res.ok) throw new Error('创建设定失败');
        const newRule = await res.json();
        set(state => ({ worldRules: [...state.worldRules, newRule] }));
        return newRule;
      } catch (err: any) {
        set({ error: err.message });
        throw err;
      }
    },

    updateWorldRule: async (id: string, updates: Partial<Omit<WorldRule, 'id' | 'projectId'>>) => {
      try {
        const res = await fetch(`/api/world-rules/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error('更新设定失败');
        const updated = await res.json();
        set(state => ({
          worldRules: state.worldRules.map(w => w.id === id ? updated : w),
        }));
      } catch (err: any) {
        set({ error: err.message });
      }
    },

    deleteWorldRule: async (id: string) => {
      try {
        const res = await fetch(`/api/world-rules/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('删除设定失败');
        set(state => ({ worldRules: state.worldRules.filter(w => w.id !== id) }));
      } catch (err: any) {
        set({ error: err.message });
      }
    },
  };
});
