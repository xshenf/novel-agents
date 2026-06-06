'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Save, Loader2, Eye, Edit3, Plus, Trash2, ArrowUp, ArrowDown, User, Activity, Key, BookOpen, Check, X, Tag, Lock, Unlock, Sparkles, Compass, Flame, Zap, Award, Trophy, CheckCircle2, ChevronUp, ChevronDown, ChevronRight, Search, Undo2, Redo2 } from 'lucide-react';
import { useWorkspace } from '../workspace-context';
import { useAiClient } from '../hooks/useAiClient';
import { createVersionSnapshot } from '@/lib/versionSnapshot';
import { KernelDimensionCard } from './KernelDimensionCard';
import { CharacterCard, AddCharacterCard, WorldRuleCard, AddWorldRuleCard } from './AssetCards';
import { DEFAULT_ANTI_AI_RULES } from '@/lib/rules';
import {
  parseStructureOutline,
  generateMarkdownFromSections,
  renumberVolumesAndChapters,
  parseCharacters,
  parseEmotionValue,
  type OutlineChapter,
  type OutlineVolume,
} from '@/lib/outlineParser';
import { useAiUndoStack, type AiUndoEntry } from '../hooks/useAiUndoStack';
import { useAiRegen } from '../hooks/useAiRegen';
import { useMaterialTabs, MATERIALS_LIST } from '../hooks/useMaterialTabs';
import { useOutlineSections } from '../hooks/useOutlineSections';
import { useOutlineAutoSave } from '../hooks/useOutlineAutoSave';
import { useOutlineHandlers } from '../hooks/useOutlineHandlers';
import { OutlineSidebar } from './OutlineSidebar';
import { KernelDimensionsPanel } from './KernelDimensionsPanel';
import { OutlineTreePanel } from './outlineTree/OutlineTreePanel';
import { CharacterManagementView } from './CharacterManagementView';

export function OutlineTab() {
  const { store, kernel } = useWorkspace();
  const {
    tempOutlineFull, setTempOutlineFull,
    tempStyleSetting, setTempStyleSetting,
    tempWorldSetting, setTempWorldSetting,
    tempPowerSystem, setTempPowerSystem,
    tempGoldFinger, setTempGoldFinger,
    tempCoreConflict, setTempCoreConflict,
    tempFactionsMap, setTempFactionsMap,
    tempSellingPoints, setTempSellingPoints,
    kernelOptions, isKernelLoading,
    isAddingChar, setIsAddingChar,
    isAddingRule, setIsAddingRule,
    ruleFilter, setRuleFilter,
    filteredRules,
    expandedKernelCard, setExpandedKernelCard,
  } = kernel;

  const callAIApi = useAiClient();

  // 视图模式（保留：未来结构/编辑双视图切换）
  const [viewMode, setViewMode] = useState<'structure' | 'editor'>('structure');

  // 素材磁贴 / 大纲子 Tab 状态
  const {
    outlineSubTab, setOutlineSubTab,
    activeMaterial, setActiveMaterial,
    collapsedVolumes, setCollapsedVolumes,
    outlineSearchQuery, setOutlineSearchQuery,
    handleSelectMaterial,
  } = useMaterialTabs();

  // AI 推演撤销历史栈
  const {
    stack: aiUndoStack,
    push: pushAiUndo,
    undo: undoLastAiRegen,
    dismiss: dismissLastAiUndo,
    clear: clearAiUndo,
  } = useAiUndoStack();

  // 行内编辑控制
  const [editingVolumeIdx, setEditingVolumeIdx] = useState<number | null>(null);
  const [editVolumeForm, setEditVolumeForm] = useState<OutlineVolume | null>(null);
  const [editingChapterPath, setEditingChapterPath] = useState<{ volIdx: number; chapIdx: number } | null>(null);
  const [editChapterForm, setEditChapterForm] = useState<OutlineChapter | null>(null);

  // AI 推演 / 重写任务的 controller 与定位状态
  const {
    abortRef: aiAbortRef,
    regenIndex: regeningIndex, setRegenIndex: setRegeningIndex,
    regenVolumeIdx: regeningVolumeIdx, setRegenVolumeIdx: setRegeningVolumeIdx,
    regenField: regeningField, setRegenField: setRegeningField,
    cancel: cancelAiRegen,
  } = useAiRegen();

  // 树状大纲本地编辑态（与 tempOutlineFull 自动同步）
  const { localSections, setLocalSections } = useOutlineSections({
    tempOutlineFull,
    editingVolumeIdx,
    editingChapterPath,
    onResetUndoStack: clearAiUndo,
  });

  // 大纲全文与宏观设定自动保存
  useOutlineAutoSave({
    projectId: store.currentProject?.id,
    tempOutlineFull,
    macro: {
      tempStyleSetting, tempWorldSetting, tempPowerSystem, tempGoldFinger,
      tempCoreConflict, tempFactionsMap, tempSellingPoints,
    },
    updateProject: store.updateProject,
  });

  // AI 推演用户输入状态
  const [aiPromptVolIdx, setAiPromptVolIdx] = useState<number | null>(null);
  const [aiPromptText, setAiPromptText] = useState('');


  

  const [initingMaterial, setInitingMaterial] = useState<string | null>(null);

  const handleInitMaterialWithAi = async (materialId: string, label: string) => {
    if (!store.currentProject) return;
    setInitingMaterial(materialId);
    try {
      const prompt = `根据当前小说项目的信息，为小说设计一个专属的【${label}】。项目名：《${store.currentProject.title}》，简介：${store.currentProject.description || '无'}，文风：${store.currentProject.styleSetting || '无'}，世界观：${store.currentProject.worldSetting || '无'}，力量体系：${store.currentProject.powerSystem || '无'}。请详细编写其具体的设定，包含层级、规则、注意事项或具体示例。不要包含任何 Emoji 图标。直接输出设定正文，字数在 500 字以上。`;
      
      const controller = new AbortController();
      const res = await callAIApi({
        action: 'chat',
        projectId: store.currentProject.id,
        query: prompt,
        systemInstruction: '你是一个网络小说设定专家，擅长推演合理、严密的世界观和设定元素。直接输出文本设定，不要带任何 Markdown 标题或 Emoji 图标。'
      }, controller.signal);

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (data && data.reply) {
        let type: 'location' | 'faction' | 'rule' | 'item' | 'other' = 'rule';
        if (['currency', 'skillSystem', 'timeline'].includes(materialId)) type = 'rule';
        else if (['foreshadow', 'plot', 'subPlot', 'events'].includes(materialId)) type = 'other';
        else if (materialId === 'relation') type = 'other';

        await store.createWorldRule({
          projectId: store.currentProject.id,
          name: `${label}设定`,
          type,
          description: data.reply
        });
        
        createVersionSnapshot({
          projectId: store.currentProject.id,
          type: 'worldRule',
          key: 'init_' + materialId,
          label: `${label}初始化设定`,
          data: { name: `${label}设定`, type, description: data.reply },
          source: 'ai'
        });
      } else {
        alert('AI 推演未返回有效结果');
      }
    } catch (e: any) {
      alert(`AI 一键推演【${label}】失败: ` + e.message);
    } finally {
      setInitingMaterial(null);
    }
  };

  
  


  
  // UI 关联性交互状态
  const [selectedChar, setSelectedChar] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [selectedVolumeIdx, setSelectedVolumeIdx] = useState<number | null>(null);


  // 全书所有章节拍平后的扁平章节映射表，用以挂载折线图和角色池（支持分卷过滤）
  const flatChapters = localSections
    .map((vol, volIdx) =>
      vol.chapters.map((chap, chapIdx) => ({
        ...chap,
        volIdx,
        chapIdx
      }))
    )
    .flatMap((chaps, volIdx) => {
      if (selectedVolumeIdx !== null && selectedVolumeIdx !== volIdx) {
        return [];
      }
      return chaps;
    });

  // 提取全部登场角色
  const allCharacters = Array.from(
    new Set(
      flatChapters.flatMap(sec => parseCharacters(sec.details))
    )
  );
  // 抽出所有大纲相关 CRUD 与 AI 推演 handler
  const {
    handleInsertVolume, handleDeleteVolume, handleMoveVolume,
    handleInsertChapter, handleDeleteChapter, handleMoveChapter,
    handleSelectRecommendedOutline,
    handleAiRegenChapter, handleAiRegenVolume,
    toggleLockVolume, toggleLockChapter,
    saveVolumeEditing, saveChapterEditing,
    totalChapters, completionRate,
    getFilteredRules,
  } = useOutlineHandlers({
    store, callAIApi,
    localSections, setLocalSections, setTempOutlineFull,
    editingVolumeIdx, setEditingVolumeIdx, editVolumeForm, setEditVolumeForm,
    editingChapterPath, setEditingChapterPath, editChapterForm, setEditChapterForm,
    aiAbortRef, setRegeningIndex, setRegeningVolumeIdx,
    pushAiUndo, flatChapters,
    tempWorldSetting, tempCoreConflict, tempPowerSystem,
  });

  // 将大纲全文保存到当前项目
  const handleSaveOutlineToProject = async () => {
    if (!store.currentProject) return;
    try {
      await store.updateProject(store.currentProject.id, { outlineFull: tempOutlineFull });
      alert('小说大纲已成功保存至项目！');
    } catch (e) {
      alert('大纲保存失败');
    }
  };

  // 大纲树视图的 controller（透传给 OutlineTreePanel / 子视图）
  const outlineTreeCtrl: import('./outlineTree/types').OutlineTreeController = {
    outlineSubTab: outlineSubTab as 'volume' | 'chapter',
    setOutlineSubTab: (v) => setOutlineSubTab(v as typeof outlineSubTab),
    handleSelectMaterial,

    localSections, setLocalSections,
    tempOutlineFull, setTempOutlineFull,

    editingVolumeIdx, setEditingVolumeIdx,
    editVolumeForm, setEditVolumeForm,
    editingChapterPath, setEditingChapterPath,
    editChapterForm, setEditChapterForm,

    collapsedVolumes, setCollapsedVolumes,
    outlineSearchQuery, setOutlineSearchQuery,
    selectedVolumeIdx, setSelectedVolumeIdx,
    selectedChar, setSelectedChar,
    hoveredPoint, setHoveredPoint,

    regeningIndex, regeningVolumeIdx, regeningField,
    aiAbortRef,
    aiPromptVolIdx, setAiPromptVolIdx,
    aiPromptText, setAiPromptText,
    cancelAiRegen,

    aiUndoStack, undoLastAiRegen, clearAiUndo,

    handleInsertVolume, handleDeleteVolume, handleMoveVolume,
    toggleLockVolume, saveVolumeEditing,
    handleInsertChapter, handleDeleteChapter, handleMoveChapter,
    toggleLockChapter, saveChapterEditing,
    handleAiRegenChapter, handleAiRegenVolume,

    totalChapters, completionRate,
    flatChapters, allCharacters,

    store,
    handleSaveOutlineToProject,
  };

  return (
    <div style={{ display: 'flex', flex: '1', minHeight: 0, overflow: 'hidden', position: 'relative' }}>
      <OutlineSidebar
        activeMaterial={activeMaterial}
        onSelectMaterial={handleSelectMaterial}
      />

      {/* 右侧动态主面板 */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: 'rgba(10, 10, 15, 0.2)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {['worldSetting', 'coreConflict', 'powerSystem', 'specialSetting'].includes(activeMaterial) && (
          <KernelDimensionsPanel
            activeMaterial={activeMaterial}
            tempWorldSetting={tempWorldSetting}
            setTempWorldSetting={setTempWorldSetting}
            tempCoreConflict={tempCoreConflict}
            setTempCoreConflict={setTempCoreConflict}
            tempPowerSystem={tempPowerSystem}
            setTempPowerSystem={setTempPowerSystem}
            tempGoldFinger={tempGoldFinger}
            setTempGoldFinger={setTempGoldFinger}
            tempStyleSetting={tempStyleSetting}
            setTempStyleSetting={setTempStyleSetting}
            tempSellingPoints={tempSellingPoints}
            setTempSellingPoints={setTempSellingPoints}
            expandedKernelCard={expandedKernelCard}
            setExpandedKernelCard={setExpandedKernelCard}
            currentProject={store.currentProject}
            updateProject={store.updateProject}
          />
        )}

        {/* 2. 大纲设定视图 (outline) */}
        {activeMaterial === 'outline' && (
          <OutlineTreePanel ctrl={outlineTreeCtrl} />
        )}

        {/* 4. 角色管理视图 (character) */}
        {activeMaterial === 'character' && (
          <CharacterManagementView store={store} isAddingChar={isAddingChar} setIsAddingChar={setIsAddingChar} createVersionSnapshot={createVersionSnapshot} />
        )}

        {/* 5. 扩展设定与世界设定资产库 (location, faction, item, currency, skillSystem, relation, foreshadow, plot, subPlot, timeline, events) */}
        {['location', 'faction', 'item', 'currency', 'skillSystem', 'timeline', 'foreshadow', 'plot', 'subPlot', 'events', 'relation'].includes(activeMaterial) && (
          (() => {
            const currentRules = getFilteredRules(activeMaterial);
            const materialLabel = MATERIALS_LIST.find(m => m.id === activeMaterial)?.label || '';
            const materialColor = MATERIALS_LIST.find(m => m.id === activeMaterial)?.color || 'var(--accent)';

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '30px', minHeight: 0, overflowY: 'auto', flexGrow: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: 0 }}>
                      {materialLabel}资产库 ({currentRules.length})
                    </h4>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      管理本小说的{materialLabel}，可在写作推演中被随时引用与核对
                    </span>
                  </div>
                  
                  {!isAddingRule && store.currentProject && (
                    <button
                      className="btn btn-primary"
                      onClick={() => setIsAddingRule(true)}
                      style={{ fontSize: '11px', padding: '6px 12px', background: 'var(--accent)', border: 'none' }}
                    >
                      新建设定项
                    </button>
                  )}
                </div>

                {isAddingRule && store.currentProject && (
                  <AddWorldRuleCard
                    projectId={store.currentProject.id}
                    onAdd={async (rule) => {
                      let targetType: 'location' | 'faction' | 'rule' | 'item' | 'other' = 'other';
                      if (activeMaterial === 'location') targetType = 'location';
                      else if (activeMaterial === 'faction') targetType = 'faction';
                      else if (activeMaterial === 'item') targetType = 'item';
                      else if (['currency', 'skillSystem', 'timeline'].includes(activeMaterial)) targetType = 'rule';
                      
                      await store.createWorldRule({
                        ...rule,
                        type: targetType,
                        name: rule.name.includes(materialLabel) ? rule.name : `${materialLabel}：${rule.name}`
                      });
                      setIsAddingRule(false);
                    }}
                    onCancel={() => setIsAddingRule(false)}
                  />
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1 }}>
                  {currentRules.length === 0 && !isAddingRule ? (
                    <div style={{
                      padding: '40px',
                      textAlign: 'center',
                      background: 'rgba(255, 255, 255, 0.01)',
                      border: '1px dashed rgba(255, 255, 255, 0.04)',
                      borderRadius: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '16px',
                      margin: '20px 0'
                    }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        当前尚未有【{materialLabel}】相关的数据资产
                      </div>
                      
                      <button
                        type="button"
                        disabled={initingMaterial === activeMaterial}
                        onClick={() => handleInitMaterialWithAi(activeMaterial, materialLabel)}
                        style={{
                          fontSize: '12px',
                          padding: '8px 16px',
                          background: `${materialColor}20`,
                          border: `1px solid ${materialColor}50`,
                          color: materialColor,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s',
                        }}
                      >
                        {initingMaterial === activeMaterial ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>AI 推演生成中...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={13} />
                            <span>一键 AI 智能推演初始化</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    currentRules.map((rule) => (
                      <WorldRuleCard
                        key={rule.id}
                        rule={rule}
                        onSave={async (id, updates) => {
                          await store.updateWorldRule(id, updates);
                          createVersionSnapshot({
                            projectId: store.currentProject!.id,
                            type: 'worldRule',
                            key: id,
                            label: `${updates.name || rule.name}`,
                            data: updates,
                            source: 'auto',
                          });
                        }}
                        onDelete={async (id) => {
                          await store.deleteWorldRule(id);
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })()
        )}
    </div>
  </div>
);
}
