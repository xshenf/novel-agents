import { useState } from 'react';
import { type NovelStore, ModelConfig } from '@/lib/store';

export interface EditModelForm {
  provider: string;
  name: string;
  alias: string;
  apiKey: string;
  apiBaseUrl: string;
  temperature: number;
  maxTokens: number;
  reasoningEnabled: boolean;
}

export type ModelSettingsApi = ReturnType<typeof useModelSettings>;

export const AGENTS_LIST = [
  { id: 'orchestrator', label: '总控调度智能体 (Orchestrator)', color: 'var(--agent-orchestrator)' },
  { id: 'planner', label: '大纲企划智能体 (Planner)', color: 'var(--agent-planner)' },
  { id: 'lore_builder', label: '设定构建智能体 (Lore Builder)', color: 'var(--agent-lore)' },
  { id: 'writer', label: '正文执笔智能体 (Writer)', color: 'var(--agent-writer)' },
  { id: 'editor', label: '一致性自检智能体 (Editor)', color: 'var(--agent-editor)' }
];

export function useModelSettings(store: NovelStore) {
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'models' | 'bindings' | 'prompts'>('models');
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editModelForm, setEditModelForm] = useState<EditModelForm>({
    provider: 'gemini',
    name: 'gemini-2.5-flash',
    alias: '我的 Gemini',
    apiKey: '',
    apiBaseUrl: '',
    temperature: 0.7,
    maxTokens: 3000,
    reasoningEnabled: false
  });

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const handleTestConnection = async (targetForm?: EditModelForm) => {
    setTestStatus('testing');
    setTestMessage('正在尝试连接服务商并探测可用模型...');
    try {
      let apiKeyParam = '';
      let modelNameParam = '';
      if (targetForm) {
        apiKeyParam = JSON.stringify({
          apiKey: targetForm.apiKey,
          apiProvider: targetForm.provider,
          apiBaseUrl: targetForm.apiBaseUrl,
          temperature: targetForm.temperature,
          maxTokens: targetForm.maxTokens,
          systemInstruction: '',
          reasoningEnabled: targetForm.reasoningEnabled === true
        });
        modelNameParam = targetForm.name;
      } else {
        const modelId = store.agentModelBindings['orchestrator'] || store.models[0]?.id;
        const model = store.models.find(m => m.id === modelId) || store.models[0];
        if (model) {
          apiKeyParam = JSON.stringify({
            apiKey: model.apiKey,
            apiProvider: model.provider,
            apiBaseUrl: model.apiBaseUrl,
            temperature: model.temperature,
            maxTokens: model.maxTokens,
            systemInstruction: '',
            reasoningEnabled: model.reasoningEnabled === true
          });
          modelNameParam = model.name;
        } else {
          // 降级使用 store 的旧全局属性
          apiKeyParam = JSON.stringify({
            apiKey: store.apiKey,
            apiProvider: store.apiProvider,
            apiBaseUrl: store.apiBaseUrl,
            temperature: store.temperature,
            maxTokens: store.maxTokens,
            systemInstruction: '',
            reasoningEnabled: store.reasoningEnabled === true
          });
          modelNameParam = store.modelName;
        }
      }

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          projectId: store.currentProject?.id || 'test_project_id',
          query: '你好，这是一次 API 连通性测试。请用极其简短的内容回复，不要多说任何废话。',
          apiKey: apiKeyParam,
          modelName: modelNameParam
        })
      });
      const data = await res.json();
      if (data.reply) {
        setTestStatus('success');
        setTestMessage(`连接正常。回复延迟正常，测试回复：${data.reply}`);
      } else {
        setTestStatus('error');
        setTestMessage(`连接失败: ${data.error || '接口未返回预期内容'}`);
      }
    } catch (e: any) {
      setTestStatus('error');
      setTestMessage(`网络请求异常: ${e.message || '未知错误'}`);
    }
  };

  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchModelsError, setFetchModelsError] = useState('');

  const handleFetchModels = async (targetForm?: EditModelForm) => {
    const keyToTest = targetForm ? targetForm.apiKey : store.apiKey;
    if (!keyToTest) {
      alert('请先输入 API 密钥 (API Key)');
      return;
    }
    setFetchingModels(true);
    setFetchModelsError('');
    try {
      let apiKeyParam = '';
      let modelNameParam = '';
      if (targetForm) {
        apiKeyParam = JSON.stringify({
          apiKey: targetForm.apiKey,
          apiProvider: targetForm.provider,
          apiBaseUrl: targetForm.apiBaseUrl,
          temperature: targetForm.temperature,
          maxTokens: targetForm.maxTokens,
          systemInstruction: '',
          reasoningEnabled: targetForm.reasoningEnabled === true
        });
        modelNameParam = targetForm.name;
      } else {
        const modelId = store.agentModelBindings['orchestrator'] || store.models[0]?.id;
        const model = store.models.find(m => m.id === modelId) || store.models[0];
        if (model) {
          apiKeyParam = JSON.stringify({
            apiKey: model.apiKey,
            apiProvider: model.provider,
            apiBaseUrl: model.apiBaseUrl,
            temperature: model.temperature,
            maxTokens: model.maxTokens,
            systemInstruction: '',
            reasoningEnabled: model.reasoningEnabled === true
          });
          modelNameParam = model.name;
        } else {
          apiKeyParam = JSON.stringify({
            apiKey: store.apiKey,
            apiProvider: store.apiProvider,
            apiBaseUrl: store.apiBaseUrl,
            temperature: store.temperature,
            maxTokens: store.maxTokens,
            systemInstruction: '',
            reasoningEnabled: store.reasoningEnabled === true
          });
          modelNameParam = store.modelName;
        }
      }

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fetchModels',
          apiKey: apiKeyParam,
          modelName: modelNameParam
        })
      });
      const data = await res.json();
      if (data.models && Array.isArray(data.models)) {
        setFetchedModels(data.models);
        if (data.models.length > 0) {
          if (targetForm) {
            setEditModelForm(prev => ({ ...prev, name: data.models[0] }));
          } else {
            store.setModelName(data.models[0]);
          }
        }
      } else {
        setFetchModelsError(data.error || '未获取到任何可用模型');
      }
    } catch (e: any) {
      setFetchModelsError(e.message || '获取模型列表时发生网络错误');
    } finally {
      setFetchingModels(false);
    }
  };

  const handleAddNewModel = () => {
    setEditingModelId('new');
    setEditModelForm({
      provider: 'gemini',
      name: 'gemini-2.5-flash',
      alias: '新大模型',
      apiKey: '',
      apiBaseUrl: '',
      temperature: 0.7,
      maxTokens: 3000,
      reasoningEnabled: false
    });
    setFetchedModels([]);
    setTestStatus('idle');
    setTestMessage('');
  };

  const handleEditModel = (model: ModelConfig) => {
    setEditingModelId(model.id);
    setEditModelForm({
      provider: model.provider,
      name: model.name,
      alias: model.alias,
      apiKey: model.apiKey,
      apiBaseUrl: model.apiBaseUrl,
      temperature: model.temperature,
      maxTokens: model.maxTokens,
      reasoningEnabled: model.reasoningEnabled === true
    });
    setFetchedModels([]);
    setTestStatus('idle');
    setTestMessage('');
  };

  const handleSaveModel = () => {
    if (!editModelForm.alias.trim()) {
      alert('请输入模型别名');
      return;
    }
    if (!editModelForm.name.trim()) {
      alert('请输入模型名称');
      return;
    }
    if (editingModelId === 'new') {
      const newId = store.addModel(editModelForm);
      // 如果是第一个模型，自动绑定为全局默认
      if (store.models.length === 0) {
        store.bindAgentModel('orchestrator', newId);
        store.bindAgentModel('planner', newId);
        store.bindAgentModel('lore_builder', newId);
        store.bindAgentModel('writer', newId);
        store.bindAgentModel('editor', newId);
      }
    } else if (editingModelId) {
      store.updateModel(editingModelId, editModelForm);
    }
    setEditingModelId(null);
  };

  return {
    showSettings,
    setShowSettings,
    settingsTab,
    setSettingsTab,
    editingModelId,
    setEditingModelId,
    editModelForm,
    setEditModelForm,
    testStatus,
    testMessage,
    handleTestConnection,
    fetchedModels,
    setFetchedModels,
    fetchingModels,
    fetchModelsError,
    handleFetchModels,
    handleAddNewModel,
    handleEditModel,
    handleSaveModel,
    agentsList: AGENTS_LIST,
  };
}
