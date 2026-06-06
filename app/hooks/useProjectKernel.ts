import { useState, useEffect, type FormEvent } from 'react';
import type { NovelStore } from '@/lib/store';
import type { CallAIApi } from './useAiClient';

type RuleFilter = 'all' | 'location' | 'faction' | 'rule' | 'item' | 'other';

interface UseProjectKernelDeps {
  store: NovelStore;
  callAIApi: CallAIApi;
}

export type ProjectKernelApi = ReturnType<typeof useProjectKernel>;

export function useProjectKernel({ store, callAIApi }: UseProjectKernelDeps) {
  const [kernelOptions, setKernelOptions] = useState<any>(null);
  const [isKernelLoading, setIsKernelLoading] = useState(false);
  const [expandedKernelCard, setExpandedKernelCard] = useState<string | null>('powerSystem');

  const [activeSettingsSubTab, setActiveSettingsSubTab] = useState<'kernel' | 'assets'>('kernel');
  const [ruleFilter, setRuleFilter] = useState<RuleFilter>('all');
  const [isAddingChar, setIsAddingChar] = useState(false);
  const [isAddingRule, setIsAddingRule] = useState(false);

  // 临时设定编辑状态
  const [tempPowerSystem, setTempPowerSystem] = useState('');
  const [tempGoldFinger, setTempGoldFinger] = useState('');
  const [tempCoreConflict, setTempCoreConflict] = useState('');
  const [tempFactionsMap, setTempFactionsMap] = useState('');
  const [tempSellingPoints, setTempSellingPoints] = useState('');
  const [tempOutlineFull, setTempOutlineFull] = useState('');
  const [tempStyleSetting, setTempStyleSetting] = useState('');
  const [tempWorldSetting, setTempWorldSetting] = useState('');

  // 完善新书设定 Modal
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editProjTitle, setEditProjTitle] = useState('');
  const [editProjStyle, setEditProjStyle] = useState('');
  const [editProjWorld, setEditProjWorld] = useState('');
  const [editProjDesc, setEditProjDesc] = useState('');
  const [isEditProjectAiLoading, setIsEditProjectAiLoading] = useState(false);

  // 切换项目时同步设定状态
  useEffect(() => {
    if (store.currentProject) {
      setTempPowerSystem(store.currentProject.powerSystem || '');
      setTempGoldFinger(store.currentProject.goldFinger || '');
      setTempCoreConflict(store.currentProject.coreConflict || '');
      setTempFactionsMap(store.currentProject.factionsMap || '');
      setTempSellingPoints(store.currentProject.sellingPoints || '');
      setTempOutlineFull(store.currentProject.outlineFull || '');
      setTempStyleSetting(store.currentProject.styleSetting || '');
      setTempWorldSetting(store.currentProject.worldSetting || '');

      // 切换新项目时清空旧的 AI 推荐，以便于触发新的推演，且重置次级 Tab
      setKernelOptions(null);
      setActiveSettingsSubTab('kernel');
      setIsAddingChar(false);
      setIsAddingRule(false);
    }
  }, [store.currentProject]);

  // AI 设定与大纲推演请求
  const fetchKernelOptions = async () => {
    if (!store.currentProject) return;
    setIsKernelLoading(true);
    try {
      const response = await callAIApi({
        action: 'generateKernel',
        projectTitle: store.currentProject.title,
        genre: store.currentProject.description || '仙侠修真',
        tone: store.currentProject.styleSetting || '传统正剧'
      });
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setKernelOptions(data);
    } catch (err: any) {
      alert('AI 设定推演失败: ' + err.message);
    } finally {
      setIsKernelLoading(false);
    }
  };

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
    } catch (err) {
      alert("保存项目设定失败");
    }
  };

  const handleEditProjectAiPlan = async () => {
    setIsEditProjectAiLoading(true);
    try {
      const res = await callAIApi({
        action: 'autoPlan',
        genre: editProjTitle ? '基于' + editProjTitle : '玄幻奇幻',
        tone: editProjStyle || '传统正剧',
        tags: []
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
    } catch (err) {
      alert("AI 推演失败，请检查网络或稍后再试");
    } finally {
      setIsEditProjectAiLoading(false);
    }
  };

  const filteredRules = store.worldRules ? store.worldRules.filter(rule => {
    if (ruleFilter === 'all') return true;
    return rule.type === ruleFilter;
  }) : [];

  const isOutlineMissing = !!(store.currentProject && (!store.currentProject.outlineFull || !store.currentProject.outlineFull.trim()));
  const isSettingsMissing = !!(store.currentProject && (
    !store.currentProject.styleSetting || !store.currentProject.styleSetting.trim() ||
    !store.currentProject.worldSetting || !store.currentProject.worldSetting.trim() ||
    !store.currentProject.powerSystem || !store.currentProject.powerSystem.trim() ||
    !store.currentProject.goldFinger || !store.currentProject.goldFinger.trim() ||
    !store.currentProject.coreConflict || !store.currentProject.coreConflict.trim()
  ));

  return {
    kernelOptions,
    setKernelOptions,
    isKernelLoading,
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
    tempPowerSystem,
    setTempPowerSystem,
    tempGoldFinger,
    setTempGoldFinger,
    tempCoreConflict,
    setTempCoreConflict,
    tempFactionsMap,
    setTempFactionsMap,
    tempSellingPoints,
    setTempSellingPoints,
    tempOutlineFull,
    setTempOutlineFull,
    tempStyleSetting,
    setTempStyleSetting,
    tempWorldSetting,
    setTempWorldSetting,
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
  };
}
