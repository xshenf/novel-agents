import { useState, useEffect, useRef, useCallback, useReducer, type FormEvent } from 'react';
import type { NovelStore } from '@/lib/store';
import type { CallAIApi } from './useAiClient';
import { settingLengthHint } from '@/lib/constants';
import { getMockDeductionOptions } from '@/lib/mockData';
import { showNotification } from '@/lib/utils';

type RuleFilter = 'all' | 'location' | 'faction' | 'rule' | 'item' | 'other';

interface UseProjectKernelDeps {
  store: NovelStore;
  callAIApi: CallAIApi;
}

export type ProjectKernelApi = ReturnType<typeof useProjectKernel>;

// ═══════════════════════════════════════════════════════════════════════════════
// Temp state reducer (consolidates 14 individual useState calls)
// ═══════════════════════════════════════════════════════════════════════════════

type TempState = {
  tempWorldSetting: string;
  tempStyleSetting: string;
  tempPowerSystem: string;
  tempGoldFinger: string;
  tempCoreConflict: string;
  tempFactionsMap: string;
  tempSellingPoints: string;
  tempOutlineFull: string;
  tempSkillSystem: string;
  tempLocation: string;
  tempFaction: string;
  tempCurrency: string;
  tempItem: string;
  tempForbiddenSetting: string;
};

const INITIAL_TEMP_STATE: TempState = {
  tempWorldSetting: '',
  tempStyleSetting: '',
  tempPowerSystem: '',
  tempGoldFinger: '',
  tempCoreConflict: '',
  tempFactionsMap: '',
  tempSellingPoints: '',
  tempOutlineFull: '',
  tempSkillSystem: '',
  tempLocation: '',
  tempFaction: '',
  tempCurrency: '',
  tempItem: '',
  tempForbiddenSetting: '',
};

/** Map from project field key to the corresponding temp state key. */
const TEMP_KEY_BY_PROJECT_FIELD: Record<string, keyof TempState> = {
  worldSetting: 'tempWorldSetting',
  styleSetting: 'tempStyleSetting',
  powerSystem: 'tempPowerSystem',
  goldFinger: 'tempGoldFinger',
  coreConflict: 'tempCoreConflict',
  factionsMap: 'tempFactionsMap',
  sellingPoints: 'tempSellingPoints',
  outlineFull: 'tempOutlineFull',
  skillSystem: 'tempSkillSystem',
  location: 'tempLocation',
  faction: 'tempFaction',
  currency: 'tempCurrency',
  item: 'tempItem',
  forbiddenSetting: 'tempForbiddenSetting',
};

type TempAction =
  | { type: 'SET_FIELD'; field: keyof TempState; value: string }
  | { type: 'RESET' }
  | { type: 'SET_ALL'; payload: Partial<TempState> };

function tempReducer(state: TempState, action: TempAction): TempState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'RESET':
      return INITIAL_TEMP_STATE;
    case 'SET_ALL':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// fetchKernelOptions helpers
// ═══════════════════════════════════════════════════════════════════════════════

/** Dispatch a dimension key's first option value into the temp reducer. */
function applyTempFieldUpdate(
  dispatch: React.Dispatch<TempAction>,
  dimKey: string,
  value: string,
): void {
  const tempKey = TEMP_KEY_BY_PROJECT_FIELD[dimKey];
  if (tempKey) {
    dispatch({ type: 'SET_FIELD', field: tempKey, value });
  }
}

/** Process an SSE (text/event-stream) response, updating UI progress and temp state. */
async function processSSEResponse(
  response: Response,
  controller: AbortController,
  store: NovelStore,
  dispatch: React.Dispatch<TempAction>,
  setKernelProgress: (v: string) => void,
): Promise<void> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    if (controller.signal.aborted) break;

    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let currentEvent = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        const dataStr = line.slice(6);
        try {
          const data = JSON.parse(dataStr);
          if (currentEvent === 'dimension_done') {
            setKernelProgress(
              `正在推演第 ${data.index}/${data.total} 维度：${data.dimLabel} - 已完成`,
            );
            if (data.dimKey && data.firstOption) {
              applyTempFieldUpdate(dispatch, data.dimKey, data.firstOption);
            }
          } else if (currentEvent === 'done') {
            if (store.currentProject) {
              try {
                await store.refreshProject(store.currentProject.id);
              } catch (e) {
                console.error('Failed to refresh project', e);
              }
            }
          } else if (currentEvent === 'error') {
            throw new Error(data.error || 'AI 操作执行失败');
          }
        } catch (e: any) {
          if (e.message && !e.message.includes('JSON')) throw e;
        }
        currentEvent = '';
      }
    }
  }
}

/** Process a plain JSON fallback response, auto-applying all dimensions. */
async function processJSONResponse(
  response: Response,
  store: NovelStore,
  dispatch: React.Dispatch<TempAction>,
): Promise<void> {
  const data = await response.json();
  if (data.error) throw new Error(data.error);

  const updates: Record<string, string> = {};
  for (const [dimKey, options] of Object.entries(data)) {
    const opts = options as Array<{ name: string; description: string }>;
    if (opts && opts.length > 0 && opts[0].description) {
      updates[dimKey] = opts[0].description;
    }
  }

  if (Object.keys(updates).length > 0 && store.currentProject) {
    try {
      await store.updateProject(store.currentProject.id, updates);
      for (const [key, val] of Object.entries(updates)) {
        applyTempFieldUpdate(dispatch, key, val);
      }
    } catch (e) {
      console.error('Failed to auto-apply kernel options', e);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════════════════════

export function useProjectKernel({ store, callAIApi }: UseProjectKernelDeps) {
  const [kernelOptions, setKernelOptions] = useState<any>(null);
  const [isKernelLoading, setIsKernelLoading] = useState(false);
  const [kernelProgress, setKernelProgress] = useState<string>('');
  const [expandedKernelCard, setExpandedKernelCard] = useState<string | null>('powerSystem');

  const [activeSettingsSubTab, setActiveSettingsSubTab] = useState<'kernel' | 'assets'>('kernel');
  const [ruleFilter, setRuleFilter] = useState<RuleFilter>('all');
  const [isAddingChar, setIsAddingChar] = useState(false);
  const [isAddingRule, setIsAddingRule] = useState(false);

  // ─── 临时设定编辑状态 (useReducer 统一管理) ────────────────────────────────

  const [tempState, tempDispatch] = useReducer(tempReducer, INITIAL_TEMP_STATE);

  // Backward-compatible individual setters (preserve return API shape)
  const setTempWorldSetting = useCallback(
    (v: string) => tempDispatch({ type: 'SET_FIELD', field: 'tempWorldSetting', value: v }),
    [],
  );
  const setTempStyleSetting = useCallback(
    (v: string) => tempDispatch({ type: 'SET_FIELD', field: 'tempStyleSetting', value: v }),
    [],
  );
  const setTempPowerSystem = useCallback(
    (v: string) => tempDispatch({ type: 'SET_FIELD', field: 'tempPowerSystem', value: v }),
    [],
  );
  const setTempGoldFinger = useCallback(
    (v: string) => tempDispatch({ type: 'SET_FIELD', field: 'tempGoldFinger', value: v }),
    [],
  );
  const setTempCoreConflict = useCallback(
    (v: string) => tempDispatch({ type: 'SET_FIELD', field: 'tempCoreConflict', value: v }),
    [],
  );
  const setTempFactionsMap = useCallback(
    (v: string) => tempDispatch({ type: 'SET_FIELD', field: 'tempFactionsMap', value: v }),
    [],
  );
  const setTempSellingPoints = useCallback(
    (v: string) => tempDispatch({ type: 'SET_FIELD', field: 'tempSellingPoints', value: v }),
    [],
  );
  const setTempOutlineFull = useCallback(
    (v: string) => tempDispatch({ type: 'SET_FIELD', field: 'tempOutlineFull', value: v }),
    [],
  );
  const setTempSkillSystem = useCallback(
    (v: string) => tempDispatch({ type: 'SET_FIELD', field: 'tempSkillSystem', value: v }),
    [],
  );
  const setTempLocation = useCallback(
    (v: string) => tempDispatch({ type: 'SET_FIELD', field: 'tempLocation', value: v }),
    [],
  );
  const setTempFaction = useCallback(
    (v: string) => tempDispatch({ type: 'SET_FIELD', field: 'tempFaction', value: v }),
    [],
  );
  const setTempCurrency = useCallback(
    (v: string) => tempDispatch({ type: 'SET_FIELD', field: 'tempCurrency', value: v }),
    [],
  );
  const setTempItem = useCallback(
    (v: string) => tempDispatch({ type: 'SET_FIELD', field: 'tempItem', value: v }),
    [],
  );
  const setTempForbiddenSetting = useCallback(
    (v: string) => tempDispatch({ type: 'SET_FIELD', field: 'tempForbiddenSetting', value: v }),
    [],
  );

  // ─── 完善新书设定 Modal ────────────────────────────────────────────────────

  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editProjTitle, setEditProjTitle] = useState('');
  const [editProjStyle, setEditProjStyle] = useState('');
  const [editProjWorld, setEditProjWorld] = useState('');
  const [editProjDesc, setEditProjDesc] = useState('');
  const [isEditProjectAiLoading, setIsEditProjectAiLoading] = useState(false);

  // ─── AI 推演单项设定字段（3个备选）状态 ────────────────────────────────────

  const [deductingField, setDeductingField] = useState<string | null>(null);
  const [deductingFieldLabel, setDeductingFieldLabel] = useState<string>('');
  const [deductionOptions, setDeductionOptions] = useState<{ title: string; content: string }[]>([]);
  const [isDeducting, setIsDeducting] = useState(false);
  const [isMockFallback, setIsMockFallback] = useState(false);

  // ─── Refs ────────────────────────────────────────────────────────────────

  const prevProjectIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const projectId = store.currentProject?.id ?? null;

  // 组件卸载时中止正在进行的 SSE 请求
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // 切换项目时同步设定状态（仅在项目 ID 变化时重置）
  useEffect(() => {
    if (projectId === prevProjectIdRef.current) return;
    prevProjectIdRef.current = projectId;

    const project = store.currentProject;
    if (project) {
      // Build partial payload from project fields → temp state keys
      const payload: Partial<TempState> = {};
      for (const [projField, tempKey] of Object.entries(TEMP_KEY_BY_PROJECT_FIELD)) {
        const value = (project as unknown as Record<string, unknown>)[projField];
        if (typeof value === 'string') {
          payload[tempKey] = value;
        }
      }
      tempDispatch({ type: 'SET_ALL', payload });

      // 切换新项目时清空旧 AI 推荐，且重置次级 Tab
      setKernelOptions(null);
      setActiveSettingsSubTab('kernel');
      setIsAddingChar(false);
      setIsAddingRule(false);
    }
  }, [projectId, store.currentProject]);

  // ─── AI 设定与大纲推演请求（SSE 流式进度）──────────────────────────────────

  const fetchKernelOptions = useCallback(async (): Promise<boolean | string> => {
    if (!store.currentProject) return false;

    // 风格基调未设置时，提示用户先配置
    const styleSetting = (store.currentProject.styleSetting || '').trim();
    if (!styleSetting) {
      return 'needStyle';
    }

    setIsKernelLoading(true);
    setKernelProgress('正在准备推演...');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // 获取当前绑定模型的并发配置
      const boundModelId = store.agentModelBindings['orchestrator'] || store.models[0]?.id;
      const boundModel = store.models.find((m) => m.id === boundModelId);
      const concurrency = boundModel?.concurrency || 3;

      const response = await callAIApi(
        {
          action: 'generateKernel',
          projectTitle: store.currentProject.title,
          genre: store.currentProject.description || '',
          tone: store.currentProject.styleSetting || '',
          concurrency,
          projectId: store.currentProject.id,
          forbiddenSetting: store.currentProject.forbiddenSetting || '',
        },
        controller.signal,
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: '请求失败' }));
        throw new Error(errData.error || '请求失败');
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream')) {
        await processSSEResponse(response, controller, store, tempDispatch, setKernelProgress);
      } else {
        await processJSONResponse(response, store, tempDispatch);
      }
    } catch (err: any) {
      showNotification('AI 设定推演失败: ' + err.message, 'error');
    } finally {
      setIsKernelLoading(false);
      setKernelProgress('');
    }
    return false;
  }, [store, callAIApi, tempDispatch]);

  // ─── 项目设定 Modal 操作 ───────────────────────────────────────────────────

  const handleOpenEditProject = () => {
    if (store.currentProject) {
      setEditProjTitle(store.currentProject.title);
      setEditProjStyle(store.currentProject.styleSetting || '');
      setEditProjWorld(store.currentProject.worldSetting || '');
      setEditProjDesc(store.currentProject.description || '');
      setShowEditProjectModal(true);
    }
  };

  const handleSaveProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!store.currentProject) return;
    try {
      await store.updateProject(store.currentProject.id, {
        title: editProjTitle,
        styleSetting: editProjStyle,
        worldSetting: editProjWorld,
        description: editProjDesc,
      });
      setShowEditProjectModal(false);
    } catch {
      showNotification('保存项目设定失败', 'error');
    }
  };

  const handleEditProjectAiPlan = async () => {
    setIsEditProjectAiLoading(true);
    try {
      const res = await callAIApi({
        action: 'autoPlan',
        genre: editProjTitle ? '基于' + editProjTitle : '',
        tone: editProjStyle || '',
        tags: [],
      });
      if (!res.ok) throw new Error('AI推演失败');
      const data = await res.json();
      if (data) {
        setEditProjDesc(data.description || '');
        setEditProjWorld(data.worldSetting || '');
        if (data.styleSetting && !editProjStyle) {
          setEditProjStyle(data.styleSetting);
        }
      }
    } catch {
      showNotification('AI 推演失败，请检查网络或稍后再试', 'error');
    } finally {
      setIsEditProjectAiLoading(false);
    }
  };

  // ─── 世界规则筛选 ────────────────────────────────────────────────────────

  const filteredRules = store.worldRules
    ? store.worldRules.filter((rule) => {
        if (ruleFilter === 'all') return true;
        return rule.type === ruleFilter;
      })
    : [];

  const isOutlineMissing = !!(
    store.currentProject &&
    (!store.currentProject.outlineFull || !store.currentProject.outlineFull.trim())
  );
  const isSettingsMissing = !!(
    store.currentProject &&
    (!store.currentProject.worldSetting || !store.currentProject.worldSetting.trim() ||
      !store.currentProject.powerSystem || !store.currentProject.powerSystem.trim() ||
      !store.currentProject.goldFinger || !store.currentProject.goldFinger.trim() ||
      !store.currentProject.coreConflict || !store.currentProject.coreConflict.trim())
  );

  // ─── AI 推演单项设定 ─────────────────────────────────────────────────────

  const handleAiDeduceField = async (fieldKey: string, fieldLabel: string) => {
    if (!store.currentProject) return;
    setIsDeducting(true);
    setIsMockFallback(false);
    setDeductingField(fieldKey);
    setDeductingFieldLabel(fieldLabel);
    setDeductionOptions([]);

    try {
      const prompt = `你是一个专业的网络小说金牌策划和商业企划大师。请为我的小说《${store.currentProject.title}》推演和重新设计 3 套风格迥异、极具网文爽点与创意的【${fieldLabel}】备选方案。
【当前书本基础信息】:
- 书名: ${store.currentProject.title}
- 简介: ${store.currentProject.description || '暂无描述'}
- 当前世界观: ${tempState.tempWorldSetting || store.currentProject.worldSetting || '暂无'}
- 当前文风和背景语调: ${tempState.tempStyleSetting || store.currentProject.styleSetting || '暂无'}

Please output in Chinese. 请推演出这 3 套备选方案。
为了方便解析，请务必严格按照以下 JSON 格式输出，不要输出任何多余的引言、前言、解释、markdown 标记或任何 JSON 格式之外的字符：
{
  "options": [
    {
      "title": "方案1名称（如：快节奏神豪爽文）",
      "content": "方案1具体设定描述，字数在 ${settingLengthHint(fieldKey)} 字左右，符合当前题材且具备商业网文的流行爽感"
    },
    {
      "title": "方案2名称（如：传统正剧沉浸式）",
      "content": "方案2具体设定描述..."
    },
    {
      "title": "方案3名称（如：轻喜吐槽爆笑流）",
      "content": "方案3具体设定描述..."
    }
  ]
}`;

      const res = await callAIApi({
        action: 'chat',
        projectId: store.currentProject.id,
        query: prompt,
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const reply = data.reply.trim();
      let cleaned = reply;
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      }
      const parsed = JSON.parse(cleaned);
      if (parsed.options && Array.isArray(parsed.options)) {
        setDeductionOptions(parsed.options);
      } else {
        throw new Error('格式不符合预期');
      }
    } catch (err: any) {
      console.error(err);
      const mockOpts = getMockDeductionOptions(fieldKey);
      setDeductionOptions(mockOpts);
    } finally {
      setIsDeducting(false);
    }
  };

  return {
    kernelOptions,
    setKernelOptions,
    isKernelLoading,
    kernelProgress,
    fetchKernelOptions,
    expandedKernelCard,
    setExpandedKernelCard,
    activeSettingsSubTab,
    setActiveSettingsSubTab,
    ruleFilter,
    setRuleFilter,
    isAddingChar,
    setIsAddingChar,
    isAddingRule,
    setIsAddingRule,
    isMockFallback,
    tempPowerSystem: tempState.tempPowerSystem,
    setTempPowerSystem,
    tempGoldFinger: tempState.tempGoldFinger,
    setTempGoldFinger,
    tempCoreConflict: tempState.tempCoreConflict,
    setTempCoreConflict,
    tempFactionsMap: tempState.tempFactionsMap,
    setTempFactionsMap,
    tempSellingPoints: tempState.tempSellingPoints,
    setTempSellingPoints,
    tempOutlineFull: tempState.tempOutlineFull,
    setTempOutlineFull,
    tempStyleSetting: tempState.tempStyleSetting,
    setTempStyleSetting,
    tempWorldSetting: tempState.tempWorldSetting,
    setTempWorldSetting,
    tempSkillSystem: tempState.tempSkillSystem,
    setTempSkillSystem,
    tempLocation: tempState.tempLocation,
    setTempLocation,
    tempFaction: tempState.tempFaction,
    setTempFaction,
    tempCurrency: tempState.tempCurrency,
    setTempCurrency,
    tempItem: tempState.tempItem,
    setTempItem,
    tempForbiddenSetting: tempState.tempForbiddenSetting,
    setTempForbiddenSetting,
    showEditProjectModal,
    setShowEditProjectModal,
    editProjTitle,
    setEditProjTitle,
    editProjStyle,
    setEditProjStyle,
    editProjWorld,
    setEditProjWorld,
    editProjDesc,
    setEditProjDesc,
    isEditProjectAiLoading,
    handleOpenEditProject,
    handleSaveProject,
    handleEditProjectAiPlan,
    filteredRules,
    isOutlineMissing,
    isSettingsMissing,
    deductingField,
    setDeductingField,
    deductingFieldLabel,
    deductionOptions,
    setDeductionOptions,
    isDeducting,
    handleAiDeduceField,
  };
}
