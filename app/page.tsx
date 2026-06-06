'use client';

import { useState } from 'react';
import { useNovelStore } from '@/lib/store';
import { useAiClient } from './hooks/useAiClient';
import { useWorkspaceRouting } from './hooks/useWorkspaceRouting';
import { useEditor } from './hooks/useEditor';
import { useModelSettings } from './hooks/useModelSettings';
import { useAutoWriter } from './hooks/useAutoWriter';
import { useAgentChat } from './hooks/useAgentChat';
import { useAiAssist } from './hooks/useAiAssist';
import { useWizard } from './hooks/useWizard';
import { useProjectKernel } from './hooks/useProjectKernel';
import { useCreationModals } from './hooks/useCreationModals';
import { useResizablePanels } from './hooks/useResizablePanels';
import { 
  BookOpen, Plus, Trash2, Settings, ChevronLeft, ChevronRight,
  User, Globe, MessageSquare, Sparkles, CheckCircle2, 
  Save, Download, FileText, Loader2, HelpCircle, Eye, Play, Pause, RefreshCw,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { NovelProject } from '@/lib/db';
import { DEFAULT_ANTI_AI_RULES } from '@/lib/rules';
import { GENRE_CATEGORIES, TONES, PRESET_TAG_GROUPS } from '@/lib/constants';
import { CharacterCard, AddCharacterCard, WorldRuleCard, AddWorldRuleCard } from './components/AssetCards';
import { Markdown } from './components/Markdown';

export default function Home() {
  const store = useNovelStore();
  const callAIApi = useAiClient();
  const {
    router,
    urlProjectId,
    urlTab,
    urlChapterId,
    buildWorkspaceUrl,
    mounted,
    activeWorkspaceTab,
    setActiveWorkspaceTab,
  } = useWorkspaceRouting(store);
  const {
    editorTitle,
    setEditorTitle,
    editorContent,
    setEditorContent,
    saveStatus,
    setSaveStatus,
    handleEditorChange,
    handleTitleChange,
    forceSave,
    exportFile,
  } = useEditor(store);
  const {
    showSettings, setShowSettings, settingsTab, setSettingsTab,
    editingModelId, setEditingModelId, editModelForm, setEditModelForm,
    testStatus, testMessage, handleTestConnection,
    fetchedModels, setFetchedModels, fetchingModels, fetchModelsError, handleFetchModels,
    handleAddNewModel, handleEditModel, handleSaveModel, agentsList,
  } = useModelSettings(store);
  const {
    writeInstruction, setWriteInstruction, isAutoWriting, autoWritingStatus,
    targetChaptersCount, setTargetChaptersCount, finishedChaptersCount,
    autoWriteMode, setAutoWriteMode, startAutoWriting, pauseAutoWriting,
  } = useAutoWriter({ store, callAIApi, setEditorContent, setSaveStatus });
  const {
    chatInput, setChatInput, agentMessages, setAgentMessages,
    saveAndSetAgentMessages, isAgentLoading, agentBottomRef, handleSendAgentMessage,
  } = useAgentChat(store);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const {
    checkResult, setCheckResult, handleConsistencyCheck, handleAutoSummarize,
    showInspirationsModal, setShowInspirationsModal, isInspirationLoading,
    inspCharacters, setInspCharacters, inspRules, setInspRules,
    activeInspTab, setActiveInspTab, handleOpenInspirations, handleImportInspirations,
  } = useAiAssist({ store, callAIApi, editorContent, setIsAiLoading });
  const {
    isWizardMode, setIsWizardMode, selectedGenreCategory, setSelectedGenreCategory,
    customGenreInput, setCustomGenreInput, customToneInput, setCustomToneInput,
    wizardStep, setWizardStep, selectedGenre, setSelectedGenre, selectedTone, setSelectedTone,
    selectedTags, setSelectedTags, wizardLoading, wizardResult, setWizardResult,
    customTagInput, setCustomTagInput, loadingTip,
    handleOpenWizard, handleSkipWizard, handleToggleTag, handleWizardGenerate, handleWizardCreateProject,
  } = useWizard({ store, callAIApi, router, buildWorkspaceUrl, setIsAiLoading });
  const {
    kernelOptions, setKernelOptions, isKernelLoading, fetchKernelOptions,
    expandedKernelCard, setExpandedKernelCard,
    activeSettingsSubTab, setActiveSettingsSubTab, ruleFilter, setRuleFilter,
    isAddingChar, setIsAddingChar, isAddingRule, setIsAddingRule,
    tempPowerSystem, setTempPowerSystem, tempGoldFinger, setTempGoldFinger,
    tempCoreConflict, setTempCoreConflict, tempFactionsMap, setTempFactionsMap,
    tempSellingPoints, setTempSellingPoints, tempOutlineFull, setTempOutlineFull,
    tempStyleSetting, setTempStyleSetting, tempWorldSetting, setTempWorldSetting,
    showEditProjectModal, setShowEditProjectModal,
    editProjTitle, setEditProjTitle, editProjStyle, setEditProjStyle,
    editProjWorld, setEditProjWorld, editProjDesc, setEditProjDesc,
    isEditProjectAiLoading, handleOpenEditProject, handleSaveProject, handleEditProjectAiPlan,
    filteredRules, isOutlineMissing, isSettingsMissing,
  } = useProjectKernel({ store, callAIApi });
  const {
    showNewCharModal, setShowNewCharModal, showNewRuleModal, setShowNewRuleModal,
    showNewChapModal, setShowNewChapModal,
    newCharName, setNewCharName, newCharRole, setNewCharRole, newCharAge, setNewCharAge,
    newCharIdentity, setNewCharIdentity, newCharPersonality, setNewCharPersonality,
    newCharGoals, setNewCharGoals, newCharState, setNewCharState,
    newCharForbidden, setNewCharForbidden,
    newRuleName, setNewRuleName, newRuleType, setNewRuleType, newRuleDesc, setNewRuleDesc,
    newChapTitle, setNewChapTitle,
    handleCreateChapter, handleCreateCharacter, handleCreateRule,
  } = useCreationModals(store);
  const {
    sidebarWidth, setSidebarWidth, aiPanelWidth, setAiPanelWidth,
    sidebarCollapsed, setSidebarCollapsed,
  } = useResizablePanels();
  

  // 渲染大纲/设定卡片辅助方法
  const renderKernelDimensionCard = (
    key: string,
    title: string,
    subtitle: string,
    value: string,
    setValue: (val: string) => void,
    cardType: string,
    placeholder: string
  ) => {
    const isExpanded = expandedKernelCard === key;
    
    const handleSave = async () => {
      if (!store.currentProject) return;
      try {
        await store.updateProject(store.currentProject.id, { [cardType]: value });
        alert(`${title}已成功保存！`);
      } catch (e) {
        alert(`${title}保存失败`);
      }
    };

    return (
      <div 
        key={key} 
        className="glass-card" 
        style={{ 
          background: 'rgba(255, 255, 255, 0.02)', 
          border: '1px solid var(--border-light)', 
          borderRadius: '12px', 
          marginBottom: '16px',
          overflow: 'hidden',
          flexShrink: 0
        }}
      >
        {/* 卡片头部 */}
        <div 
          onClick={() => setExpandedKernelCard(isExpanded ? null : key)}
          style={{ 
            padding: '16px 20px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            cursor: 'pointer',
            background: isExpanded ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
            transition: 'background 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <strong style={{ fontSize: '15px', color: '#fff' }}>{title}</strong>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{subtitle}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {value ? '已设定' : '待补充设定'}
            </span>
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

        {/* 卡片展开内容 */}
        {isExpanded && (
          <div 
            style={{ 
              padding: '20px', 
              borderTop: '1px solid var(--border-light)', 
              display: 'flex', 
              gap: '24px', 
              minHeight: '260px' 
            }}
          >
            {/* 左侧：微调及保存 */}
            <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>当前设定与微调</span>
                <button 
                  className="btn btn-primary"
                  onClick={handleSave}
                  style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Save size={13} />
                  <span>保存设定</span>
                </button>
              </div>
              <textarea 
                className="textarea"
                placeholder={placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                style={{ 
                  flexGrow: 1, 
                  minHeight: '140px', 
                  fontSize: '13px', 
                  lineHeight: '1.6', 
                  padding: '12px', 
                  background: 'rgba(0,0,0,0.15)', 
                  border: '1px solid var(--border-light)', 
                  borderRadius: '8px' 
                }}
              />
            </div>

            {/* 右侧：AI 智能推荐方案 */}
            <div style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>
                AI 推荐备选方案 (一键选用)
              </div>
              
              {isKernelLoading ? (
                <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '20px' }}>
                  <Loader2 className="animate-spin" size={20} style={{ color: 'var(--accent)', marginBottom: '8px' }} />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>正在推演设定...</span>
                </div>
              ) : kernelOptions?.[cardType] ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                  {kernelOptions[cardType].map((opt: any, idx: number) => (
                    <div 
                      key={idx} 
                      style={{ 
                        padding: '10px 12px', 
                        background: 'rgba(255,255,255,0.01)', 
                        border: '1px solid var(--border-light)', 
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent)' }}>{opt.name}</span>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={async () => {
                            const val = opt.name + '：' + opt.description;
                            setValue(val);
                            if (store.currentProject) {
                              try {
                                await store.updateProject(store.currentProject.id, { [cardType]: val });
                                alert(`已选用《${opt.name}》方案并自动保存！`);
                              } catch (e) {}
                            }
                          }}
                          style={{ fontSize: '10px', padding: '2px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)' }}
                        >
                          选用
                        </button>
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5' }}>
                        {opt.description}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-light)', borderRadius: '8px', padding: '20px', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-dark)' }}>
                    暂无推荐，点击顶部「重新推演设定与大纲」生成方案
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };


  // 渲染大面积双栏开书向导
  const renderWizardPanel = () => {
    const stepTitles = ['题材分类', '文风调性', '故事看点', '新书企划'];
    
    return (
      <div style={{ maxWidth: '1200px', margin: '40px auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 'calc(100vh - 140px)' }}>
        
        {/* 顶部标题栏 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: '700', marginBottom: '6px', background: 'linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {wizardLoading ? 'AI 智能新书推演中...' : `智能新书向导: ${stepTitles[wizardStep - 1]}`}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              {wizardLoading ? '融合题材世界观与文风法则，推演主线与大纲...' : '通过多维度可视化推演，免去构思烦恼，一键生成您的专属小说企划。'}
            </p>
          </div>
          {!wizardLoading && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleSkipWizard} 
                disabled={isAiLoading}
                style={{ 
                  display: 'flex', 
                  gap: '6px', 
                  alignItems: 'center', 
                  borderColor: 'rgba(16, 185, 129, 0.4)', 
                  background: 'rgba(16, 185, 129, 0.05)',
                  color: '#34d399'
                }}
              >
                直接开书 (跳过向导)
              </button>
              <button className="btn btn-secondary" onClick={() => setIsWizardMode(false)} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <ChevronLeft size={16} /> 返回项目大厅
              </button>
            </div>
          )}
        </div>

        {/* 双栏布局 */}
        <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '30px', alignItems: 'stretch' }}>
          
          {/* 左栏：配置区 */}
          <div className="glass-card" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '24px', minHeight: '520px' }}>
            
            {/* 步骤指示器 */}
            {!wizardLoading && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', padding: '0 10px' }}>
                <div style={{ position: 'absolute', top: '50%', left: '24px', right: '24px', height: '2px', background: 'var(--border-light)', zIndex: 1, transform: 'translateY(-50%)' }}></div>
                <div style={{ position: 'absolute', top: '50%', left: '24px', width: `${((wizardStep - 1) / 3) * 91}%`, height: '2px', background: 'var(--accent)', zIndex: 1, transform: 'translateY(-50%)', transition: 'width 0.3s' }}></div>
                {[1, 2, 3, 4].map(step => (
                  <div key={step} style={{ 
                    width: '36px', 
                    height: '36px', 
                    borderRadius: '50%', 
                    background: wizardStep >= step ? 'var(--accent)' : 'var(--bg-input)', 
                    border: `2px solid ${wizardStep >= step ? 'var(--accent)' : 'var(--border-light)'}`,
                    color: wizardStep >= step ? '#fff' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: '600',
                    zIndex: 2,
                    transition: 'all 0.3s',
                    boxShadow: wizardStep === step ? '0 0 15px rgba(99, 102, 241, 0.4)' : 'none'
                  }}>
                    {step}
                  </div>
                ))}
              </div>
            )}

            {/* 核心选项区 */}
            {wizardLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '20px', flexGrow: 1 }}>
                <Loader2 className="animate-spin" style={{ width: '48px', height: '48px', color: 'var(--accent)' }} />
                <div style={{ fontSize: '18px', color: 'var(--text-main)', fontWeight: '600', letterSpacing: '0.05em' }}>{loadingTip}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '400px', lineHeight: '1.6' }}>
                  AI 正在融合题材、文风与核心看点，演算世界的物理法则、灵气浓度以及前三章命途走向...
                </div>
              </div>
            ) : (
              <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  {/* 第 1 步：题材选择 */}
                  {wizardStep === 1 && (
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '14px', color: '#fff' }}>请选择您小说的核心题材（九门主流大类，共计43个细分品类）</h3>
                      
                      {/* 横向滚动大类 Tab */}
                      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
                        {GENRE_CATEGORIES.map(category => {
                          const isCatSelected = selectedGenreCategory === category.id;
                          return (
                            <button
                              key={category.id}
                              type="button"
                              className={`btn ${isCatSelected ? 'btn-primary' : 'btn-secondary'}`}
                              onClick={() => setSelectedGenreCategory(category.id)}
                              style={{
                                padding: '6px 12px',
                                fontSize: '12px',
                                borderRadius: '20px',
                                border: isCatSelected ? 'none' : '1px solid var(--border-light)',
                                background: isCatSelected ? 'var(--accent)' : 'var(--bg-input)',
                                color: isCatSelected ? '#fff' : 'var(--text-muted)',
                                boxShadow: isCatSelected ? '0 0 10px rgba(99, 102, 241, 0.3)' : 'none'
                              }}
                            >
                              <span style={{ marginRight: '4px' }}>{category.icon}</span>
                              {category.title}
                            </button>
                          );
                        })}
                      </div>

                      {/* 细分卡片网格 */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
                        {GENRE_CATEGORIES.find(c => c.id === selectedGenreCategory)?.genres.map(genre => {
                          const isSelected = selectedGenre === genre.name;
                          return (
                            <div 
                              key={genre.name}
                              onClick={() => {
                                setSelectedGenre(genre.name);
                              }}
                              style={{
                                padding: '12px 14px',
                                borderRadius: '10px',
                                background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-input)',
                                border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border-light)'}`,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '10px',
                                boxShadow: isSelected ? '0 0 12px rgba(99, 102, 241, 0.15)' : 'none'
                              }}
                            >
                              <span style={{ fontSize: '20px' }}>{genre.icon}</span>
                              <div>
                                <div style={{ fontWeight: '600', fontSize: '13px', color: isSelected ? '#fff' : 'var(--text-main)', marginBottom: '2px' }}>{genre.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>{genre.desc}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* 自定义题材选择 */}
                      <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-light)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>️ 独创自定义题材（例如：赛博仙侠、中式蒸汽朋克）</div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input 
                            type="text" 
                            className="input" 
                            placeholder="输入您的独创题材..." 
                            value={customGenreInput} 
                            onChange={e => setCustomGenreInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const trimmed = customGenreInput.trim();
                                if (trimmed) {
                                  setSelectedGenre(trimmed);
                                }
                              }
                            }}
                            style={{ flexGrow: 1 }}
                          />
                          <button 
                            type="button" 
                            className="btn btn-secondary"
                            onClick={() => {
                              const trimmed = customGenreInput.trim();
                              if (trimmed) {
                                setSelectedGenre(trimmed);
                              }
                            }}
                          >
                            确定题材
                          </button>
                        </div>
                        {selectedGenre && !GENRE_CATEGORIES.some(c => c.genres.some(g => g.name === selectedGenre)) && (
                          <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '500' }}>
                            当前已选中自定义题材：【{selectedGenre}】
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 第 2 步：文风选择 */}
                  {wizardStep === 2 && (
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '14px', color: '#fff' }}>请确定小说的整体文风与行文节奏</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        {TONES.map(tone => {
                          const isSelected = selectedTone === tone.name;
                          return (
                            <div 
                              key={tone.name}
                              onClick={() => setSelectedTone(tone.name)}
                              style={{
                                padding: '14px 16px',
                                borderRadius: '10px',
                                background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-input)',
                                border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border-light)'}`,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '12px',
                                boxShadow: isSelected ? '0 0 15px rgba(99, 102, 241, 0.15)' : 'none'
                              }}
                            >
                              <span style={{ fontSize: '24px' }}>{tone.icon}</span>
                              <div>
                                <div style={{ fontWeight: '600', fontSize: '14px', color: isSelected ? '#fff' : 'var(--text-main)', marginBottom: '4px' }}>{tone.name}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>{tone.desc}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* 自定义文风选择 */}
                      <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-light)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>️ 自定义独特文风（例如：暗黑克苏鲁、赛博怪诞）</div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input 
                            type="text" 
                            className="input" 
                            placeholder="输入您的自定义文风偏好..." 
                            value={customToneInput} 
                            onChange={e => setCustomToneInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const trimmed = customToneInput.trim();
                                if (trimmed) {
                                  setSelectedTone(trimmed);
                                }
                              }
                            }}
                            style={{ flexGrow: 1 }}
                          />
                          <button 
                            type="button" 
                            className="btn btn-secondary"
                            onClick={() => {
                              const trimmed = customToneInput.trim();
                              if (trimmed) {
                                setSelectedTone(trimmed);
                              }
                            }}
                          >
                            确定文风
                          </button>
                        </div>
                        {selectedTone && !TONES.some(t => t.name === selectedTone) && (
                          <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '500' }}>
                            当前已选中自定义文风：【{selectedTone}】
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 第 3 步：故事看点 */}
                  {wizardStep === 3 && (
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '14px', color: '#fff' }}>请选择故事核心看点（可跨维度多选）</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        {PRESET_TAG_GROUPS.map(group => (
                          <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>{group.title}</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {group.tags.map(tag => {
                                const isSelected = selectedTags.includes(tag);
                                return (
                                  <div 
                                    key={tag}
                                    onClick={() => handleToggleTag(tag)}
                                    style={{
                                      padding: '6px 12px',
                                      borderRadius: '16px',
                                      background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-input)',
                                      border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-light)'}`,
                                      color: isSelected ? '#fff' : 'var(--text-muted)',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      fontWeight: isSelected ? '600' : '400',
                                      transition: 'all 0.15s'
                                    }}
                                  >
                                    {tag}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        {/* 自定义看点 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '14px', marginTop: '6px' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>独创脑洞自定义标签</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                            {selectedTags.filter(tag => !PRESET_TAG_GROUPS.some(g => g.tags.includes(tag))).map(tag => (
                              <div 
                                key={tag}
                                onClick={() => handleToggleTag(tag)}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '16px',
                                  background: 'rgba(99, 102, 241, 0.15)',
                                  border: '1px solid var(--accent)',
                                  color: '#fff',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                {tag}
                                <span style={{ fontSize: '10px', opacity: 0.7 }}></span>
                              </div>
                            ))}
                          </div>
                          
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input 
                              type="text" 
                              className="input" 
                              placeholder="输入您的独创灵感标签，按回车添加..." 
                              value={customTagInput} 
                              onChange={e => setCustomTagInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const trimmed = customTagInput.trim();
                                  if (trimmed && !selectedTags.includes(trimmed)) {
                                    setSelectedTags(prev => [...prev, trimmed]);
                                    setCustomTagInput('');
                                  }
                                }
                              }}
                              style={{ flexGrow: 1 }}
                            />
                            <button 
                              type="button" 
                              className="btn btn-secondary"
                              onClick={() => {
                                const trimmed = customTagInput.trim();
                                if (trimmed && !selectedTags.includes(trimmed)) {
                                  setSelectedTags(prev => [...prev, trimmed]);
                                  setCustomTagInput('');
                                }
                              }}
                            >
                              添加
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 第 4 步：最终预览编辑 */}
                  {wizardStep === 4 && wizardResult && (
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '14px', color: '#fff' }}>AI 推演企划书（您可以在框内直接进行微调与二次润色）</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '420px', overflowY: 'auto', paddingRight: '6px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>独创书名</label>
                          <input 
                            type="text" 
                            className="input" 
                            value={wizardResult.title} 
                            onChange={e => setWizardResult(prev => prev ? { ...prev, title: e.target.value } : null)} 
                            style={{ fontSize: '16px', fontWeight: '600', color: '#fff' }}
                            required
                          />
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>故事简介</label>
                          <textarea 
                            className="textarea" 
                            value={wizardResult.description} 
                            onChange={e => setWizardResult(prev => prev ? { ...prev, description: e.target.value } : null)} 
                            style={{ minHeight: '80px', lineHeight: '1.6' }}
                            required
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>创作风格</label>
                          <input 
                            type="text" 
                            className="input" 
                            value={wizardResult.styleSetting} 
                            onChange={e => setWizardResult(prev => prev ? { ...prev, styleSetting: e.target.value } : null)} 
                            required
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>世界观设定与境界划分</label>
                          <textarea 
                            className="textarea" 
                            value={wizardResult.worldSetting} 
                            onChange={e => setWizardResult(prev => prev ? { ...prev, worldSetting: e.target.value } : null)} 
                            style={{ minHeight: '110px', lineHeight: '1.6' }}
                            required
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 底部导航 */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-light)', paddingTop: '20px', marginTop: '20px' }}>
                  {wizardStep === 1 && (
                    <>
                      <button type="button" className="btn btn-secondary" onClick={() => setIsWizardMode(false)}>取消</button>
                      <button type="button" className="btn className='btn btn-primary'" onClick={() => setWizardStep(2)}>
                        下一步：确定文风
                      </button>
                    </>
                  )}
                  {wizardStep === 2 && (
                    <>
                      <button type="button" className="btn btn-secondary" onClick={() => setWizardStep(1)}>上一步</button>
                      <button type="button" className="btn className='btn btn-primary'" onClick={() => setWizardStep(3)}>
                        下一步：故事看点
                      </button>
                    </>
                  )}
                  {wizardStep === 3 && (
                    <>
                      <button type="button" className="btn btn-secondary" onClick={() => setWizardStep(2)}>上一步</button>
                      <button type="button" className="btn className='btn btn-primary'" onClick={handleWizardGenerate}>
                        一键推演新书企划
                      </button>
                    </>
                  )}
                  {wizardStep === 4 && (
                    <>
                      <button type="button" className="btn btn-secondary" onClick={() => setWizardStep(3)}>上一步</button>
                      <button type="button" className="btn btn-secondary" onClick={handleWizardGenerate} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <RefreshCw style={{ width: '14px', height: '14px' }} />
                        重新推演
                      </button>
                      <button type="button" className="btn className='btn btn-primary'" onClick={handleWizardCreateProject} disabled={isAiLoading}>
                        {isAiLoading ? '创建中...' : '确认创建并连载'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 右栏：实时企划封面看板 (实时灵感公式) */}
          <div className="glass-card" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '520px', background: 'rgba(17, 19, 34, 0.4)', justifyContent: 'space-between' }}>
            
            {/* 3D 拟真书脊卡片 */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
              <div style={{ 
                width: '180px', 
                height: '250px', 
                borderRadius: '8px 16px 16px 8px', 
                background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)',
                boxShadow: '0 15px 35px rgba(0,0,0,0.5), inset -3px 0 10px rgba(0,0,0,0.4), 0 0 30px var(--accent-glow)',
                border: '1px solid rgba(255,255,255,0.05)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '24px 16px',
                overflow: 'hidden'
              }}>
                {/* 装饰条纹 */}
                <div style={{ position: 'absolute', left: '0', top: '0', bottom: '0', width: '8px', background: 'rgba(255,255,255,0.03)', borderRight: '1px solid rgba(255,255,255,0.05)' }}></div>
                
                {/* 顶部小标 */}
                <div style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: '600', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={10} />
                  AI AUTO SYSTEM
                </div>

                {/* 书名 */}
                <div style={{ textAlign: 'center', margin: '20px 0' }}>
                  <div style={{ 
                    fontSize: wizardStep === 4 && wizardResult ? '14px' : '18px', 
                    fontWeight: '700', 
                    color: '#fff', 
                    lineHeight: '1.4', 
                    maxHeight: '80px', 
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {wizardStep === 4 && wizardResult ? wizardResult.title : '灵感之卷 '}
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-dark)', marginTop: '8px' }}>
                    {wizardStep === 4 && wizardResult ? '新书大纲已锁定' : '等待 AI 推演灵感...'}
                  </div>
                </div>

                {/* 底部题材标签点亮 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                  <div style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid var(--accent)', color: '#a5b4fc', fontWeight: '500' }}>
                    {selectedGenre}
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                    {selectedTone}
                  </div>
                </div>
              </div>
            </div>

            {/* 灵感公式摘要或前三章预告 */}
            {wizardStep === 4 && wizardResult ? (
              <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BookOpen size={14} />
                  前三章连载预告目录已锁定：
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: 'var(--text-main)' }}>
                  {/* 根据题材匹配的初始目录 */}
                  {selectedGenre === '悬疑惊悚' ? (
                    <>
                      <div>• 第一章：雨夜里的失魂人 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                      <div>• 第二章：死档阁的红漆印 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                      <div>• 第三章：步步追命的规则 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                    </>
                  ) : selectedGenre === '科幻未来' ? (
                    <>
                      <div>• 第一章：深空舱室的冷苏醒 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                      <div>• 第二章：指令异常与逃逸 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                      <div>• 第三章：宇宙边缘的未知警告 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                    </>
                  ) : (selectedGenre === '现代言情' || selectedGenre === '古代言情') ? (
                    <>
                      <div>• 第一章：死局重生的契机 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                      <div>• 第二章：豪门门阀的刁难 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                      <div>• 第三章：针锋相对的交手 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                    </>
                  ) : selectedGenre === '历史架空' ? (
                    <>
                      <div>• 第一章：没落世子的破局策 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                      <div>• 第二章：朝堂对赌与杀机 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                      <div>• 第三章：收服旧部定乾坤 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                    </>
                  ) : selectedGenre === '游戏竞技' ? (
                    <>
                      <div>• 第一章：老将退役后的登录 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                      <div>• 第二章：神魔首测的越级杀 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                      <div>• 第三章：全服震动的首通记录 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                    </>
                  ) : selectedGenre === '二次元幻想' ? (
                    <>
                      <div>• 第一章：转生成为吐槽店长 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                      <div>• 第二章：美少女眷族的上门拜访 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                      <div>• 第三章：日常小店的鸡飞狗跳 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                    </>
                  ) : (
                    <>
                      <div>• 第一章：深夜古卷的惊变 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                      <div>• 第二章：试探与杀机 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                      <div>• 第三章：因果暗局 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px dashed rgba(255,255,255,0.05)', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: '600', letterSpacing: '0.05em', marginBottom: '6px' }}>当前灵感构想公式</div>
                <div style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.6' }}>
                  这将会是一部以<span style={{ color: 'var(--accent)', fontWeight: '600', margin: '0 2px' }}>{selectedGenre}</span>为画布的<span style={{ color: '#fff', fontWeight: '600', margin: '0 2px' }}>{selectedTone}</span>故事。
                  {selectedTags.length > 0 && (
                    <>
                      它深度融入了包括
                      <span style={{ color: 'var(--accent-success)', fontWeight: '600', margin: '0 2px' }}>
                        {selectedTags.slice(0, 4).join('、')}
                      </span>等吸睛神级看点。
                    </>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dark)', marginTop: '12px' }}>
                  请点击「一键推演新书企划」，看 AI 如何将这一行公式编织成气吞长虹的惊世之卷！
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 渲染设置侧滑抽屉 (替代原本的 Modal)
  const renderSettingsDrawer = () => {

    return (
      <>
        {/* 遮罩层 */}
        <div 
          className={`drawer-overlay ${showSettings ? 'active' : ''}`}
          onClick={() => { setShowSettings(false); setEditingModelId(null); }}
        />
        
        {/* 抽屉本体 */}
        <div className={`drawer-content ${showSettings ? 'active' : ''}`}>
          <div className="drawer-header">
            <div className="drawer-title">
              <Settings size={20} style={{ color: 'var(--accent)' }} />
              <span>智能写作大模型控制台</span>
            </div>
            <button 
              type="button" 
              className="btn-icon" 
              onClick={() => { setShowSettings(false); setEditingModelId(null); }}
              style={{ fontSize: '20px', lineHeight: '1' }}
            >
              &times;
            </button>
          </div>

          {/* 抽屉 Tab 导航栏 */}
          <div className="drawer-tabs">
            <button 
              type="button" 
              className={`drawer-tab-btn ${settingsTab === 'models' ? 'active' : ''}`}
              onClick={() => { setSettingsTab('models'); setEditingModelId(null); }}
            >
              模型池管理
            </button>
            <button 
              type="button" 
              className={`drawer-tab-btn ${settingsTab === 'bindings' ? 'active' : ''}`}
              onClick={() => { setSettingsTab('bindings'); setEditingModelId(null); }}
            >
              智能体分配
            </button>
            <button 
              type="button" 
              className={`drawer-tab-btn ${settingsTab === 'prompts' ? 'active' : ''}`}
              onClick={() => { setSettingsTab('prompts'); setEditingModelId(null); }}
            >
              全局写作提示词
            </button>
          </div>

          <div className="drawer-body">
            {/* TAB 1: 模型池管理 */}
            {settingsTab === 'models' && (
              <>
                {editingModelId === null ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      配置您所拥有的多个 API 模型账号，之后可任意绑定给系统内的专业智能体。
                    </div>
                    <div className="model-grid">
                      {store.models.map((model) => {
                        const isDefault = store.agentModelBindings['orchestrator'] === model.id;
                        return (
                          <div 
                            key={model.id}
                            className={`model-card ${isDefault ? 'active' : ''}`}
                            onClick={() => handleEditModel(model)}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                              <div>
                                <div style={{ fontWeight: '600', color: '#fff', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                                  {model.alias}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase' }}>
                                  {model.provider} / {model.name}
                                </div>
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--text-dark)' }}>
                                Temp: {model.temperature} | Tokens: {model.maxTokens}
                              </div>
                            </div>
                            {isDefault && <span className="model-card-badge">总控默认</span>}
                            {store.models.length > 1 && (
                              <button 
                                type="button"
                                className="model-card-delete-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`确定要删除模型「${model.alias}」吗？`)) {
                                    store.deleteModel(model.id);
                                  }
                                }}
                              >
                                删除
                              </button>
                            )}
                          </div>
                        );
                      })}
                      <div className="model-card-add" onClick={handleAddNewModel}>
                        <span>+ 录入新模型</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 模型编辑与新建表单 */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
                        {editingModelId === 'new' ? '录入新模型配置' : `编辑模型: ${editModelForm.alias}`}
                      </span>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={() => setEditingModelId(null)}
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                      >
                        返回列表
                      </button>
                    </div>

                    <div className="drawer-field">
                      <label className="drawer-label">模型别名 (区分不同模型配置)</label>
                      <input 
                        type="text" 
                        className="input" 
                        value={editModelForm.alias}
                        onChange={(e) => setEditModelForm(prev => ({ ...prev, alias: e.target.value }))}
                        placeholder="例如: 智能大纲、备用 Gemini 等"
                      />
                    </div>

                    <div className="drawer-field">
                      <label className="drawer-label">接口服务商 (Provider)</label>
                      <select 
                        className="input"
                        value={editModelForm.provider}
                        onChange={(e) => {
                          const prov = e.target.value;
                          let defaultName = 'gemini-2.5-flash';
                          let defaultBase = '';
                          if (prov === 'gemini') {
                            defaultName = 'gemini-2.5-flash';
                          } else if (prov === 'openai') {
                            defaultName = 'gpt-4o-mini';
                            defaultBase = 'https://api.openai.com/v1';
                          } else if (prov === 'deepseek') {
                            defaultName = 'deepseek-chat';
                            defaultBase = 'https://api.deepseek.com/v1';
                          } else if (prov === 'claude') {
                            defaultName = 'claude-3-5-sonnet-20241022';
                          }
                          setEditModelForm(prev => ({ 
                            ...prev, 
                            provider: prov,
                            name: defaultName,
                            apiBaseUrl: defaultBase
                          }));
                          setFetchedModels([]);
                        }}
                        style={{ background: 'var(--bg-input)' }}
                      >
                        <option value="gemini">Google Gemini</option>
                        <option value="openai">OpenAI</option>
                        <option value="deepseek">DeepSeek (深度求索)</option>
                        <option value="claude">Anthropic Claude</option>
                        <option value="custom">Custom (OpenAI 兼容中转)</option>
                      </select>
                    </div>

                    <div className="drawer-field">
                      <label className="drawer-label">API 密钥 (API Key)</label>
                      <input 
                        type="password" 
                        className="input" 
                        value={editModelForm.apiKey}
                        onChange={(e) => setEditModelForm(prev => ({ ...prev, apiKey: e.target.value }))}
                        placeholder="输入 API 密钥 (留空则使用后端默认环境变量或本地 Mock)" 
                      />
                    </div>

                    <div className="drawer-field">
                      <label className="drawer-label">自定义代理地址 (Base URL)</label>
                      <input 
                        type="text" 
                        className="input" 
                        value={editModelForm.apiBaseUrl}
                        onChange={(e) => setEditModelForm(prev => ({ ...prev, apiBaseUrl: e.target.value }))}
                        placeholder="留空则使用各厂商默认请求网关" 
                      />
                    </div>

                    <div className="drawer-field">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label className="drawer-label">模型名称选择 (Model Name)</label>
                        <button 
                          type="button"
                          onClick={() => handleFetchModels(editModelForm)}
                          disabled={fetchingModels || !editModelForm.apiKey}
                          style={{ 
                            fontSize: '11px', 
                            background: 'none', 
                            border: 'none', 
                            color: editModelForm.apiKey ? 'var(--accent)' : 'var(--text-dark)', 
                            cursor: editModelForm.apiKey ? 'pointer' : 'default',
                            fontWeight: 500
                          }}
                        >
                          {fetchingModels ? '正在获取...' : '在线获取模型列表'}
                        </button>
                      </div>
                      {fetchModelsError && (
                        <div style={{ fontSize: '11px', color: 'var(--accent-danger)', marginTop: '2px' }}>
                          {fetchModelsError}
                        </div>
                      )}
                      <select 
                        className="input"
                        value={editModelForm.name}
                        onChange={(e) => setEditModelForm(prev => ({ ...prev, name: e.target.value }))}
                        style={{ background: 'var(--bg-input)' }}
                      >
                        {fetchedModels.length > 0 ? (
                          fetchedModels.map((model) => (
                            <option key={model} value={model}>{model}</option>
                          ))
                        ) : (
                          <>
                            {editModelForm.provider === 'gemini' && (
                              <>
                                <option value="gemini-2.5-flash">gemini-2.5-flash (快速, 推荐)</option>
                                <option value="gemini-2.5-pro">gemini-2.5-pro (深度创作)</option>
                                <option value="gemini-1.5-flash">gemini-1.5-flash (轻量)</option>
                              </>
                            )}
                            {editModelForm.provider === 'openai' && (
                              <>
                                <option value="gpt-4o-mini">gpt-4o-mini (经济极速, 推荐)</option>
                                <option value="gpt-4o">gpt-4o (全能旗舰)</option>
                                <option value="o3-mini">o3-mini (高级推理)</option>
                              </>
                            )}
                            {editModelForm.provider === 'deepseek' && (
                              <>
                                <option value="deepseek-chat">deepseek-chat (V3 极高性价比)</option>
                                <option value="deepseek-reasoner">deepseek-reasoner (R1 深度推理思考)</option>
                              </>
                            )}
                            {editModelForm.provider === 'claude' && (
                              <>
                                <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet (文学创作标杆)</option>
                                <option value="claude-3-5-haiku-20241022">claude-3-5-haiku (高速高能)</option>
                              </>
                            )}
                          </>
                        )}
                        <option value={editModelForm.name}>当前输入: {editModelForm.name}</option>
                      </select>
                    </div>

                    <div className="drawer-field">
                      <label className="drawer-label">手动输入其他模型名 (若下拉框中未列出)</label>
                      <input 
                        type="text" 
                        className="input" 
                        value={editModelForm.name}
                        onChange={(e) => setEditModelForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="请输入真实模型名称" 
                      />
                    </div>

                    <div className="drawer-field">
                      <label className="drawer-label">默认生成温度 (Temperature): {editModelForm.temperature.toFixed(1)}</label>
                      <div className="slider-container">
                        <input 
                          type="range" 
                          min="0" 
                          max="2.0" 
                          step="0.1"
                          className="slider-input" 
                          value={editModelForm.temperature}
                          onChange={(e) => setEditModelForm(prev => ({ ...prev, temperature: Number(e.target.value) }))}
                        />
                      </div>
                    </div>

                    <div className="drawer-field">
                      <label className="drawer-label">单次最大生成长度 (Max Tokens)</label>
                      <input 
                        type="number" 
                        className="input" 
                        min="100"
                        max="16000"
                        step="100"
                        value={editModelForm.maxTokens}
                        onChange={(e) => setEditModelForm(prev => ({ ...prev, maxTokens: Number(e.target.value) }))}
                      />
                    </div>

                    <div className="drawer-field">
                      <div className="switch-container">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '500', color: '#ffffff' }}>思考模型格式兼容</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>去除 R1 类似思考标记，优化输出格式</span>
                        </div>
                        <label className="switch-control">
                          <input 
                            type="checkbox" 
                            checked={editModelForm.reasoningEnabled}
                            onChange={(e) => setEditModelForm(prev => ({ ...prev, reasoningEnabled: e.target.checked }))}
                          />
                          <span className="switch-slider"></span>
                        </label>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>连接状态测试：</span>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                          type="button"
                          className="btn btn-secondary" 
                          onClick={() => handleTestConnection(editModelForm)}
                          disabled={testStatus === 'testing' || !editModelForm.apiKey}
                        >
                          {testStatus === 'testing' ? '连接探测中...' : '测试此配置连通性'}
                        </button>
                      </div>
                      {testStatus !== 'idle' && (
                        <div className={`test-result-box ${testStatus === 'success' ? 'success' : testStatus === 'error' ? 'error' : ''}`} style={{ fontSize: '11.5px' }}>
                          {testMessage}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid var(--border-light)', paddingTop: '14px' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setEditingModelId(null)}>取消</button>
                      <button type="button" className="btn btn-primary" onClick={handleSaveModel}>保存此模型</button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* TAB 2: 智能体模型绑定 */}
            {settingsTab === 'bindings' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  将系统内的 5 大核心专业智能体角色，分别绑定至模型池中不同的模型并个性化微调其生成参数。
                </div>
                {agentsList.map(agent => {
                  const boundModelId = store.agentModelBindings[agent.id] || store.models[0]?.id;
                  const isOverrideActive = store.agentOverrides[agent.id] !== undefined;
                  const overrideData = store.agentOverrides[agent.id] || {};
                  
                  return (
                    <div key={agent.id} className="agent-binding-card">
                      <div className="agent-binding-header">
                        <div className="agent-binding-title">
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: agent.color }}></span>
                          <span>{agent.label}</span>
                        </div>
                        <select 
                          className="input"
                          value={boundModelId}
                          onChange={(e) => store.bindAgentModel(agent.id, e.target.value)}
                          style={{ width: '180px', padding: '4px 8px', fontSize: '12px', background: 'var(--bg-input)' }}
                        >
                          {store.models.map(m => (
                            <option key={m.id} value={m.id}>{m.alias} ({m.provider})</option>
                          ))}
                        </select>
                      </div>

                      {/* 开启特异性参数配置 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <input 
                          type="checkbox"
                          id={`override-${agent.id}`}
                          checked={isOverrideActive}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const model = store.models.find(m => m.id === boundModelId) || store.models[0];
                              store.updateAgentOverride(agent.id, { 
                                temperature: model ? model.temperature : 0.7, 
                                maxTokens: model ? model.maxTokens : 3000 
                              });
                            } else {
                              store.updateAgentOverride(agent.id, null);
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        <label htmlFor={`override-${agent.id}`} style={{ cursor: 'pointer' }}>为该智能体启用独立参数覆盖</label>
                      </div>

                      {/* 展开特异性参数微调区域 */}
                      {isOverrideActive && (
                        <div className="agent-override-box">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                              <span style={{ color: 'var(--text-muted)' }}>专属生成温度 (Temperature)</span>
                              <span style={{ color: '#fff', fontWeight: '600' }}>{(overrideData.temperature ?? 0.7).toFixed(1)}</span>
                            </div>
                            <div className="slider-container">
                              <input 
                                type="range"
                                min="0"
                                max="2.0"
                                step="0.1"
                                className="slider-input"
                                value={overrideData.temperature ?? 0.7}
                                onChange={(e) => store.updateAgentOverride(agent.id, { temperature: Number(e.target.value) })}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                              <span style={{ color: 'var(--text-muted)' }}>专属最大生成长度 (Max Tokens)</span>
                              <span style={{ color: '#fff', fontWeight: '600' }}>{overrideData.maxTokens ?? 3000}</span>
                            </div>
                            <input 
                              type="number"
                              className="input"
                              min="100"
                              max="16000"
                              step="100"
                              value={overrideData.maxTokens ?? 3000}
                              onChange={(e) => store.updateAgentOverride(agent.id, { maxTokens: Number(e.target.value) })}
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 3: 全局创作提示词 */}
            {settingsTab === 'prompts' && (
              <div className="drawer-section" style={{ borderBottom: 'none' }}>
                <div className="drawer-field">
                  <label className="drawer-label">全局创作系统提示词前缀 (注入小说大纲前)</label>
                  <textarea 
                    className="textarea" 
                    placeholder="配置对全部 AI 生效的宏观提示，例如：要求行文古色古香、强调悬疑逻辑、人物内心戏细腻等" 
                    value={store.systemInstruction}
                    onChange={(e) => store.setSystemInstruction(e.target.value)}
                    style={{ minHeight: '180px', lineHeight: '1.6' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-dark)', marginTop: '4px' }}>
                    本提示词作为系统的全局基调，会自动附加在各智能体的任务提示之前，用以锁定小说整体文风。
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="drawer-footer">
            <button className="btn btn-primary" onClick={() => { setShowSettings(false); setEditingModelId(null); }}>保存配置并关闭</button>
          </div>
        </div>
      </>
    );
  };

  const renderInspirationsModal = () => {
    if (!showInspirationsModal) return null;

    const checkedCharsCount = inspCharacters.filter(c => c.checked).length;
    const checkedRulesCount = inspRules.filter(r => r.checked).length;
    const totalChecked = checkedCharsCount + checkedRulesCount;

    return (
      <div className="modal-overlay" style={{ zIndex: 1001 }}>
        <div className="modal-content glass-card" style={{ maxWidth: '850px', maxHeight: '90vh', width: '90%' }}>
          <div className="modal-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={20} style={{ color: 'var(--accent)' }} />
              AI 多维度设定灵感库
            </span>
            <button type="button" className="btn-icon" onClick={() => setShowInspirationsModal(false)} style={{ fontSize: '18px' }}>
              &times;
            </button>
          </div>

          {isInspirationLoading ? (
            <div style={{ padding: '60px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
              <Loader2 className="animate-spin" size={36} style={{ color: 'var(--accent)' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>AI 正在根据小说背景规划多维度人物与世界观设定...</span>
            </div>
          ) : (
            <>
              {/* 多维度 Tab */}
              <div className="tab-container" style={{ marginBottom: '15px' }}>
                <button 
                  type="button"
                  className={`tab-btn ${activeInspTab === 'char' ? 'active' : ''}`} 
                  onClick={() => setActiveInspTab('char')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <User size={14} />
                  <span>推荐人物设定 ({inspCharacters.length})</span>
                </button>
                <button 
                  type="button"
                  className={`tab-btn ${activeInspTab === 'rule' ? 'active' : ''}`} 
                  onClick={() => setActiveInspTab('rule')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Globe size={14} />
                  <span>推荐世界观与道具设定 ({inspRules.length})</span>
                </button>
              </div>

              {/* 灵感列表区 */}
              <div style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '55vh', paddingRight: '5px' }}>
                {activeInspTab === 'char' ? (
                  /* 人物卡片灵感 */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {inspCharacters.length === 0 ? (
                      <div style={{ padding: '20px', color: 'var(--text-dark)', textAlign: 'center' }}>无生成的人物设定</div>
                    ) : (
                      inspCharacters.map((char, index) => (
                        <div 
                          key={char.id} 
                          className="glass-card" 
                          style={{ 
                            padding: '16px', 
                            borderLeft: char.checked ? '4px solid var(--accent)' : '1px solid var(--border-light)',
                            background: char.checked ? 'rgba(99, 102, 241, 0.03)' : 'transparent'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <input 
                              type="checkbox" 
                              checked={char.checked} 
                              onChange={(e) => {
                                const newChars = [...inspCharacters];
                                newChars[index].checked = e.target.checked;
                                setInspCharacters(newChars);
                              }}
                              style={{ marginTop: '5px', cursor: 'pointer', width: '16px', height: '16px' }}
                            />
                            
                            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px' }}>
                                <input 
                                  type="text" 
                                  className="input" 
                                  value={char.name}
                                  onChange={(e) => {
                                    const newChars = [...inspCharacters];
                                    newChars[index].name = e.target.value;
                                    setInspCharacters(newChars);
                                  }}
                                  placeholder="角色名"
                                  style={{ padding: '6px 10px', fontSize: '13px' }}
                                />
                                <select 
                                  className="input" 
                                  value={char.role}
                                  onChange={(e) => {
                                    const newChars = [...inspCharacters];
                                    newChars[index].role = e.target.value;
                                    setInspCharacters(newChars);
                                  }}
                                  style={{ padding: '6px 10px', fontSize: '13px', background: 'var(--bg-input)' }}
                                >
                                  <option value="主角">主角</option>
                                  <option value="男主">男主</option>
                                  <option value="女主">女主</option>
                                  <option value="配角">配角</option>
                                  <option value="反派">反派</option>
                                </select>
                                <input 
                                  type="text" 
                                  className="input" 
                                  value={char.age}
                                  onChange={(e) => {
                                    const newChars = [...inspCharacters];
                                    newChars[index].age = e.target.value;
                                    setInspCharacters(newChars);
                                  }}
                                  placeholder="年龄"
                                  style={{ padding: '6px 10px', fontSize: '13px' }}
                                />
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '11px', color: 'var(--text-dark)' }}>身份背景</label>
                                <input 
                                  type="text" 
                                  className="input" 
                                  value={char.identity}
                                  onChange={(e) => {
                                    const newChars = [...inspCharacters];
                                    newChars[index].identity = e.target.value;
                                    setInspCharacters(newChars);
                                  }}
                                  placeholder="身份背景介绍..."
                                  style={{ padding: '6px 10px', fontSize: '13px' }}
                                />
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label style={{ fontSize: '11px', color: 'var(--text-dark)' }}>性格特征</label>
                                  <input 
                                    type="text" 
                                    className="input" 
                                    value={char.personality}
                                    onChange={(e) => {
                                      const newChars = [...inspCharacters];
                                      newChars[index].personality = e.target.value;
                                      setInspCharacters(newChars);
                                    }}
                                    placeholder="逗号隔开..."
                                    style={{ padding: '6px 10px', fontSize: '12px' }}
                                  />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label style={{ fontSize: '11px', color: 'var(--text-dark)' }}>行动目标</label>
                                  <input 
                                    type="text" 
                                    className="input" 
                                    value={char.goals}
                                    onChange={(e) => {
                                      const newChars = [...inspCharacters];
                                      newChars[index].goals = e.target.value;
                                      setInspCharacters(newChars);
                                    }}
                                    placeholder="逗号隔开..."
                                    style={{ padding: '6px 10px', fontSize: '12px' }}
                                  />
                                </div>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label style={{ fontSize: '11px', color: 'var(--text-dark)' }}>当前初始状态</label>
                                  <input 
                                    type="text" 
                                    className="input" 
                                    value={char.currentState}
                                    onChange={(e) => {
                                      const newChars = [...inspCharacters];
                                      newChars[index].currentState = e.target.value;
                                      setInspCharacters(newChars);
                                    }}
                                    placeholder="所处状态..."
                                    style={{ padding: '6px 10px', fontSize: '12px' }}
                                  />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label style={{ fontSize: '11px', color: 'var(--text-dark)' }}>写作禁忌</label>
                                  <input 
                                    type="text" 
                                    className="input" 
                                    value={char.forbidden}
                                    onChange={(e) => {
                                      const newChars = [...inspCharacters];
                                      newChars[index].forbidden = e.target.value;
                                      setInspCharacters(newChars);
                                    }}
                                    placeholder="逗号隔开..."
                                    style={{ padding: '6px 10px', fontSize: '12px' }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  /* 设定卡片灵感 (世界观/道具/法则) */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {inspRules.length === 0 ? (
                      <div style={{ padding: '20px', color: 'var(--text-dark)', textAlign: 'center' }}>无推荐的设定信息</div>
                    ) : (
                      inspRules.map((rule, index) => (
                        <div 
                          key={rule.id} 
                          className="glass-card" 
                          style={{ 
                            padding: '16px', 
                            borderLeft: rule.checked ? '4px solid var(--accent)' : '1px solid var(--border-light)',
                            background: rule.checked ? 'rgba(99, 102, 241, 0.03)' : 'transparent'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <input 
                              type="checkbox" 
                              checked={rule.checked} 
                              onChange={(e) => {
                                const newRules = [...inspRules];
                                newRules[index].checked = e.target.checked;
                                setInspRules(newRules);
                              }}
                              style={{ marginTop: '5px', cursor: 'pointer', width: '16px', height: '16px' }}
                            />
                            
                            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                                <input 
                                  type="text" 
                                  className="input" 
                                  value={rule.name}
                                  onChange={(e) => {
                                    const newRules = [...inspRules];
                                    newRules[index].name = e.target.value;
                                    setInspRules(newRules);
                                  }}
                                  placeholder="设定名称"
                                  style={{ padding: '6px 10px', fontSize: '13px' }}
                                />
                                <select 
                                  className="input" 
                                  value={rule.type}
                                  onChange={(e) => {
                                    const newRules = [...inspRules];
                                    newRules[index].type = e.target.value as any;
                                    setInspRules(newRules);
                                  }}
                                  style={{ padding: '6px 10px', fontSize: '13px', background: 'var(--bg-input)' }}
                                >
                                  <option value="faction">宗门势力/组织</option>
                                  <option value="location">地理位置/地点</option>
                                  <option value="item">法宝/神兵/道具</option>
                                  <option value="rule">天道法则/修炼等级</option>
                                  <option value="other">其他设定项</option>
                                </select>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '11px', color: 'var(--text-dark)' }}>设定描述</label>
                                <textarea 
                                  className="textarea" 
                                  value={rule.description}
                                  onChange={(e) => {
                                    const newRules = [...inspRules];
                                    newRules[index].description = e.target.value;
                                    setInspRules(newRules);
                                  }}
                                  placeholder="输入设定的背景介绍或功能详细描述..."
                                  style={{ padding: '6px 10px', fontSize: '13px', minHeight: '60px' }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* 弹窗底部操作 */}
              <div className="modal-actions" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '15px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={handleOpenInspirations} style={{ marginRight: 'auto' }}>
                  <RefreshCw size={14} /> 重新生成
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowInspirationsModal(false)}>
                  取消
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleImportInspirations}
                  disabled={totalChecked === 0 || isAiLoading}
                >
                  {isAiLoading ? <Loader2 className="animate-spin" size={14} /> : `导入勾选设定到本项目 (${totalChecked} 项)`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };


  if (!mounted) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0b0f19', color: '#94a3b8' }}>
        加载中...
      </div>
    );
  }

  return (
    <main>
      {/* 顶部通栏导航 */}
      <nav className="navbar">
        <div className="nav-brand" style={{ cursor: 'pointer' }} onClick={() => { store.setCurrentProject(null); router.push('/'); }}>
          <BookOpen size={20} style={{ color: 'var(--accent)' }} />
          <span>小说智能体创作台 <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--text-dark)' }}>MVP v1.1</span></span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {store.currentProject && (
            <button className="btn btn-secondary" onClick={() => { store.setCurrentProject(null); router.push('/'); }} style={{ padding: '6px 12px', fontSize: '12px' }}>
              <ChevronLeft size={16} /> 返回项目大厅
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setShowSettings(true)}>
            <Settings size={16} />
            <span>AI 模型设置</span>
          </button>
        </div>
      </nav>

      {/* 1. Dashboard 视图 */}
      {!store.currentProject ? (
        isWizardMode ? (
          renderWizardPanel()
        ) : (
          <div className="dashboard-container">
            <div className="dashboard-header">
              <div>
                <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>我的创作空间</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>选择一部小说开始写作，或者创造一个新的故事灵感项目。</p>
              </div>
              <button className="btn btn-primary" onClick={handleOpenWizard}>
                <Plus size={18} />
                <span>新建小说项目</span>
              </button>
            </div>

            <div className="project-grid">
              {store.projects.map((project) => (
                <div key={project.id} className="project-card glass-card" onClick={() => { store.setCurrentProject(project); router.push(buildWorkspaceUrl(project.id, 'write')); }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="project-title">{project.title}</div>
                    <button 
                      className="btn-icon" 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`确认要彻底删除小说《${project.title}》吗？这将无法恢复。`)) {
                          store.deleteProject(project.id);
                        }
                      }}
                      style={{ color: 'rgba(239, 68, 68, 0.6)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="project-desc">{project.description || '暂无作品简介...'}</div>
                  <div className="project-meta">
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span className="tag-badge">AI 记忆分层</span>
                      <span className="tag-badge">全自动创作</span>
                    </div>
                    <span>更新于 {new Date(project.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}

              <div className="project-card glass-card" style={{ borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', opacity: '0.7' }} onClick={handleOpenWizard}>
                <Plus size={32} style={{ color: 'var(--text-dark)', marginBottom: '10px' }} />
                <div style={{ fontWeight: '500', color: 'var(--text-muted)' }}>开启你的奇幻新章</div>
              </div>
            </div>
          </div>
        )
      ) : (
        /* 2. Workspace 写作工作台视图 */
        <div className="workspace-layout" style={{ display: 'flex' }}>
          {/* 左侧侧边栏：章节与设定 */}
          {sidebarCollapsed ? (
            <div style={{ width: '40px', flexShrink: 0, background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '12px', gap: '8px' }}>
              <button className="btn-icon" onClick={() => setSidebarCollapsed(false)} title="展开章节列表">
                <ChevronRight size={16} />
              </button>
              <button className="btn-icon" onClick={() => setShowNewChapModal(true)} title="新建章节">
                <Plus size={16} />
              </button>
            </div>
          ) : (
          <div className="workspace-sidebar" style={{ width: sidebarWidth, minWidth: 160, maxWidth: 500, flexShrink: 0 }}>
            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="sidebar-section" style={{ flexGrow: 1, overflowY: 'auto' }}>
                <div className="sidebar-header">
                  <span>章节列表</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn-icon" onClick={() => setSidebarCollapsed(true)} title="收起章节列表">
                      <ChevronLeft size={16} />
                    </button>
                    <button className="btn-icon" onClick={() => setShowNewChapModal(true)}>
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                <div className="sidebar-list">
                  {store.chapters.map((chap) => (
                    <div 
                      key={chap.id} 
                      className={`sidebar-item ${store.currentChapter?.id === chap.id ? 'active' : ''}`}
                      onClick={() => { store.setCurrentChapter(chap); router.push(buildWorkspaceUrl(store.currentProject!.id, activeWorkspaceTab, chap.id)); }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                        <FileText size={14} style={{ flexShrink: 0 }} />
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{chap.title}</span>
                        {chap.content.trim() !== '' && <span style={{ fontSize: '10px', color: 'var(--accent-success)' }}>(已生成)</span>}
                      </div>
                      <button 
                        className="btn-icon" 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`确定要删除章节“${chap.title}”吗？`)) {
                            store.deleteChapter(chap.id);
                          }
                        }}
                        style={{ padding: '2px', opacity: 0.5 }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          )}

          {/* 左侧拖拽条 */}
          {!sidebarCollapsed && (
          <div
            className="resize-handle"
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.clientX;
              const startWidth = sidebarWidth;
              const handle = e.currentTarget;
              handle.classList.add('active');
              document.body.style.userSelect = 'none';
              const onMove = (ev: MouseEvent) => {
                const delta = ev.clientX - startX;
                const newWidth = Math.max(160, Math.min(500, startWidth + delta));
                setSidebarWidth(newWidth);
                localStorage.setItem('layout_sidebar_width', String(newWidth));
              };
              const onUp = () => {
                handle.classList.remove('active');
                document.body.style.userSelect = '';
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
              };
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}
          />
          )}

          {/* 中间：主章节编辑器 / 大纲 / 设定 工作区 */}
          <div className="workspace-main" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', flexGrow: 1, minWidth: 300 }}>
            {/* 顶部的 3 Tab 切换导航 */}
            <div style={{ display: 'flex', gap: '8px', padding: '16px 30px', borderBottom: '1px solid var(--border-light)', background: 'rgba(255, 255, 255, 0.02)', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '20px', display: 'flex', gap: '4px' }}>
                <button 
                  className={`btn ${activeWorkspaceTab === 'write' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => { setActiveWorkspaceTab('write'); router.push(buildWorkspaceUrl(store.currentProject!.id, 'write', store.currentChapter?.id)); }}
                  style={{ borderRadius: '16px', padding: '6px 16px', fontSize: '12px', border: 'none', background: activeWorkspaceTab === 'write' ? 'var(--accent)' : 'transparent', color: activeWorkspaceTab === 'write' ? '#fff' : 'var(--text-muted)' }}
                >
                  连载写作
                </button>
                <button 
                  className={`btn ${activeWorkspaceTab === 'outline' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => { setActiveWorkspaceTab('outline'); router.push(buildWorkspaceUrl(store.currentProject!.id, 'outline')); }}
                  style={{ position: 'relative', borderRadius: '16px', padding: '6px 16px', fontSize: '12px', border: 'none', background: activeWorkspaceTab === 'outline' ? 'var(--accent)' : 'transparent', color: activeWorkspaceTab === 'outline' ? '#fff' : 'var(--text-muted)' }}
                >
                  核心大纲
                  {isOutlineMissing && (
                    <span style={{ position: 'absolute', top: '4px', right: '4px', width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
                  )}
                </button>
                <button 
                  className={`btn ${activeWorkspaceTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => { setActiveWorkspaceTab('settings'); router.push(buildWorkspaceUrl(store.currentProject!.id, 'settings')); }}
                  style={{ position: 'relative', borderRadius: '16px', padding: '6px 16px', fontSize: '12px', border: 'none', background: activeWorkspaceTab === 'settings' ? 'var(--accent)' : 'transparent', color: activeWorkspaceTab === 'settings' ? '#fff' : 'var(--text-muted)' }}
                >
                  核心设定
                  {isSettingsMissing && (
                    <span style={{ position: 'absolute', top: '4px', right: '4px', width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
                  )}
                </button>
              </div>
              
              {activeWorkspaceTab !== 'write' && (
                <button 
                  className="btn btn-secondary" 
                  onClick={fetchKernelOptions} 
                  disabled={isKernelLoading}
                  style={{ marginLeft: 'auto', fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {isKernelLoading ? <Loader2 className="animate-spin" size={13} /> : <Sparkles size={13} style={{ color: 'var(--accent)' }} />}
                  <span>重新推演设定与大纲</span>
                </button>
              )}
            </div>

            {/* TAB 分支渲染 */}
            {activeWorkspaceTab === 'write' ? (
              <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflowY: 'auto' }}>
                {/* 新书完善设定 Banner */}
                {store.currentProject && store.currentProject.title === '未命名故事' && (
                  <div className="glass-card animate-fade-in" style={{ margin: '15px 30px 5px', padding: '16px 20px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '24px' }}></span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff', marginBottom: '2px' }}>新书已直接建立！</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>当前使用默认模板。您可以前往左侧“设定库”慢慢添加人物与世界观，或点击右侧按钮完善核心世界观、题材与文风。</div>
                      </div>
                    </div>
                    <button className="btn btn-primary" onClick={handleOpenEditProject} style={{ fontSize: '12px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, background: 'linear-gradient(135deg, var(--accent) 0%, #a5b4fc 100%)', border: 'none' }}>
                      <Settings size={13} />
                      完善新书设定
                    </button>
                  </div>
                )}
                {/* AI 自动写小说引擎控制台 (仅在自动写小说模式下显示) */}
                {autoWriteMode && (
                  <div className="glass-card" style={{ margin: '15px 30px 0', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(99, 102, 241, 0.08)', borderColor: 'rgba(99, 102, 241, 0.3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="pulse-dot" style={{ background: isAutoWriting ? 'var(--accent-success)' : 'var(--text-dark)' }}></span>
                        <strong style={{ fontSize: '14px' }}>AI 自动小说创作引擎</strong>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({autoWritingStatus})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {!isAutoWriting && (
                          <>
                            <button 
                              className="btn-link"
                              onClick={() => setAutoWriteMode(false)}
                              style={{ fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                              title="隐藏自动写作控制面板，进入纯粹手动编辑模式"
                            >
                              切换到纯编辑
                            </button>
                            <span style={{ width: '1px', height: '12px', background: 'var(--border-light)' }} />
                          </>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>连写章数:</span>
                          <input 
                            type="number" 
                            className="input" 
                            value={targetChaptersCount} 
                            onChange={(e) => setTargetChaptersCount(Math.max(1, Number(e.target.value)))}
                            style={{ width: '50px', padding: '4px 6px', fontSize: '12px' }}
                            disabled={isAutoWriting}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      {/* 进度条 */}
                      <div style={{ flexGrow: 1, height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            height: '100%', 
                            background: 'var(--accent)', 
                            width: `${(finishedChaptersCount / targetChaptersCount) * 100}%`,
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        已生成 {finishedChaptersCount} / {targetChaptersCount} 章
                      </span>
                    </div>

                    {/* 写作额外全局指令，会注入到每一章生成中 */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
                      <input 
                        type="text" 
                        className="input" 
                        placeholder="可选：给自动生成的章节注入全局情节要求（例如：增加悬疑感，埋下关于玉佩身世的伏笔）" 
                        value={writeInstruction} 
                        onChange={e => setWriteInstruction(e.target.value)}
                        style={{ fontSize: '12px', padding: '6px 10px' }}
                        disabled={isAutoWriting}
                      />
                      {!isAutoWriting ? (
                        <button className="btn btn-primary" onClick={startAutoWriting} style={{ padding: '6px 15px', fontSize: '12px' }}>
                          <Play size={12} /> 一键自动写作
                        </button>
                      ) : (
                        <button className="btn btn-danger" onClick={pauseAutoWriting} style={{ padding: '6px 15px', fontSize: '12px' }}>
                          <Pause size={12} /> 暂停生成
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {store.currentChapter ? (
                  <>
                    <div className="editor-header">
                      <input 
                        type="text" 
                        className="editor-title-input" 
                        value={editorTitle}
                        onChange={handleTitleChange}
                        placeholder="请输入章节标题..."
                        disabled={isAutoWriting}
                      />
                      <div className="editor-toolbar">
                        {!autoWriteMode && (
                          <button 
                            className="btn btn-secondary" 
                            onClick={() => setAutoWriteMode(true)}
                            style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)', border: '1px dashed var(--border-light)' }}
                          >
                            <span>开启 AI 自动面板</span>
                          </button>
                        )}
                        <button className="btn btn-secondary" onClick={handleConsistencyCheck} style={{ padding: '8px 12px' }} disabled={isAutoWriting}>
                          <CheckCircle2 size={14} style={{ color: 'var(--accent)' }} />
                          <span>逻辑一致性检测</span>
                        </button>
                        <button className="btn btn-secondary" onClick={handleAutoSummarize} style={{ padding: '8px 12px' }} disabled={isAutoWriting}>
                          <Sparkles size={14} style={{ color: 'var(--accent-success)' }} />
                          <span>章节摘要复盘</span>
                        </button>
                        <button className="btn btn-secondary" onClick={() => exportFile('md')} style={{ padding: '8px 8px' }} title="导出为 Markdown">
                          <Download size={14} />
                        </button>
                        <button className="btn btn-primary" onClick={forceSave} style={{ padding: '8px 12px' }} disabled={isAutoWriting}>
                          <Save size={14} />
                          <span>保存</span>
                        </button>
                      </div>
                    </div>

                    <div className="editor-body">
                      <textarea 
                        className="editor-textarea" 
                        placeholder="在此倾泻你的笔墨，AI 将在一旁静心等候..." 
                        value={editorContent}
                        onChange={handleEditorChange}
                        disabled={isAutoWriting}
                      />
                    </div>

                    <div className="editor-footer">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="pulse-dot" style={{ background: isAutoWriting ? 'var(--accent-success)' : 'var(--accent-warning)' }}></span>
                        <span>
                          {isAutoWriting && 'AI 正在全力写作并保存至数据库...'}
                          {!isAutoWriting && saveStatus === 'saved' && '草稿已自动保存至本地'}
                          {!isAutoWriting && saveStatus === 'saving' && '正在自动保存到云端数据库...'}
                          {!isAutoWriting && saveStatus === 'dirty' && '草稿已被修改'}
                        </span>
                      </div>
                      <div>字数统计: {editorContent.length} 字</div>
                    </div>
                  </>
                ) : (
                  <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-dark)', gap: '15px' }}>
                    <BookOpen size={48} style={{ opacity: 0.3 }} />
                    <span>请在左侧侧边栏创建或选择一个章节进行创作</span>
                    <button className="btn btn-primary" onClick={() => setShowNewChapModal(true)}>
                      <Plus size={16} /> 新建第一章
                    </button>
                  </div>
                )}
              </div>
            ) : activeWorkspaceTab === 'outline' ? (
              <div style={{ display: 'flex', flex: '1', minHeight: 0, padding: '30px', gap: '30px', overflowY: 'auto' }}>
                {/* 左栏：当前完整故事大纲 */}
                <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span></span> 完整故事大纲
                    </h3>
                    <button 
                      className="btn btn-primary"
                      onClick={async () => {
                        if (!store.currentProject) return;
                        try {
                          await store.updateProject(store.currentProject.id, { outlineFull: tempOutlineFull });
                          alert('大纲保存成功！');
                        } catch(e) { alert('大纲保存失败'); }
                      }}
                      style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Save size={13} />
                      <span>保存大纲修改</span>
                    </button>
                  </div>
                  <textarea 
                    className="textarea" 
                    placeholder="在此起草或微调本书的起承转合、主线任务及结局走向..."
                    value={tempOutlineFull}
                    onChange={e => setTempOutlineFull(e.target.value)}
                    style={{ flexGrow: 1, minHeight: '400px', fontSize: '13px', lineHeight: '1.7', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '10px' }}
                  />
                </div>

                {/* 右栏：AI 推演的 3 套备选方案卡片 */}
                <div style={{ width: '420px', display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0 }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)', margin: 0 }}>
                    AI 大纲备选推荐（点击一键选用）
                  </h3>
                  
                  {isKernelLoading ? (
                    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', gap: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px' }}>
                      <Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent)' }} />
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>正在利用 AI 深度推演 3 套故事大纲...</span>
                    </div>
                  ) : kernelOptions?.outlineFull ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {kernelOptions.outlineFull.map((opt: any, idx: number) => (
                        <div 
                          key={idx} 
                          className="glass-card animate-fade-in" 
                          style={{ padding: '16px', border: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.015)' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <strong style={{ color: 'var(--accent)', fontSize: '13px' }}>{opt.name}</strong>
                            <button 
                              type="button"
                              className="btn btn-primary"
                              onClick={async () => {
                                const val = opt.name + '：' + opt.description;
                                setTempOutlineFull(val);
                                if (store.currentProject) {
                                  try {
                                    await store.updateProject(store.currentProject.id, { outlineFull: val });
                                    alert(`已选用《${opt.name}》大纲并自动保存！`);
                                  } catch(e) {}
                                }
                              }}
                              style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--accent)', border: 'none' }}
                            >
                              选用此大纲
                            </button>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6', whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto' }}>
                            {opt.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dark)', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', fontSize: '12px' }}>
                      当前尚未生成方案，请点击顶部按钮发起 AI 推演！
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* settings Tab: 核心设定与故事资产工作区 */
              <div style={{ display: 'flex', flexDirection: 'column', padding: '30px', gap: '20px', overflowY: 'auto', flexGrow: 1 }}>
                {/* 顶部的次级 Tab 切换 */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', gap: '16px', flexShrink: 0 }}>
                  <button 
                    onClick={() => setActiveSettingsSubTab('kernel')}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: activeSettingsSubTab === 'kernel' ? '#fff' : 'var(--text-muted)', 
                      fontSize: '14px', 
                      fontWeight: activeSettingsSubTab === 'kernel' ? '600' : 'normal', 
                      paddingBottom: '8px', 
                      borderBottom: activeSettingsSubTab === 'kernel' ? '2px solid var(--accent)' : '2px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    网文策划内核
                  </button>
                  <button 
                    onClick={() => setActiveSettingsSubTab('assets')}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: activeSettingsSubTab === 'assets' ? '#fff' : 'var(--text-muted)', 
                      fontSize: '14px', 
                      fontWeight: activeSettingsSubTab === 'assets' ? '600' : 'normal', 
                      paddingBottom: '8px', 
                      borderBottom: activeSettingsSubTab === 'assets' ? '2px solid var(--accent)' : '2px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    故事资产管理
                  </button>
                </div>

                {activeSettingsSubTab === 'kernel' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: 0 }}>核心设定矩阵</h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                        网络小说内核由 5 大设定维度共同支撑。您可以点击各展开项，微调具体内容，或一键选用 AI 为您推演的创意方案。
                      </p>
                    </div>
                    
                    {renderKernelDimensionCard(
                      'styleSetting', 
                      '小说文风与题材基调', 
                      '定义小说的体裁定位、情感色调与写作偏好（如：快节奏爽文、热血升级、幽默吐槽等）', 
                      tempStyleSetting, 
                      setTempStyleSetting, 
                      'styleSetting', 
                      '例如：都市超能体裁，快节奏神豪爽文，整体色调轻松幽默，节奏明快...'
                    )}
                    
                    {renderKernelDimensionCard(
                      'worldSetting', 
                      '核心世界观背景描述', 
                      '定义小说主舞台的大陆疆域、宏观规则、历史背景与微观社会法则', 
                      tempWorldSetting, 
                      setTempWorldSetting, 
                      'worldSetting', 
                      '例如：一个灵气衰退的仙侠世界，修行者寿元大减，凡人建立的机械帝国与修士宗门共存...'
                    )}
                    
                    {renderKernelDimensionCard(
                      'powerSystem', 
                      '境界与力量体系', 
                      '定义主角及世界的修炼境界、超自然等级与晋升逻辑', 
                      tempPowerSystem, 
                      setTempPowerSystem, 
                      'powerSystem', 
                      '例如：练气、筑基、金丹、元婴、化神...'
                    )}
                    
                    {renderKernelDimensionCard(
                      'goldFinger', 
                      '金手指设定', 
                      '主角的特殊外挂、系统、随身宝物或独占机缘', 
                      tempGoldFinger, 
                      setTempGoldFinger, 
                      'goldFinger', 
                      '例如：可以复制万物的神秘古镜，或者属性加点的诸天面板...'
                    )}
                    
                    {renderKernelDimensionCard(
                      'coreConflict', 
                      '核心矛盾与冲突线', 
                      '推动小说主线发展的主要矛盾，以及主角面临的终极敌对势力或危机', 
                      tempCoreConflict, 
                      setTempCoreConflict, 
                      'coreConflict', 
                      '例如：真仙下凡灭族之仇，或是主角身上的天劫诅咒，需不断打破封印...'
                    )}
                    
                    {renderKernelDimensionCard(
                      'factionsMap', 
                      '势力分布与地理', 
                      '故事发生的世界地理架构，以及各大宗门、家族、帝国的敌友关系', 
                      tempFactionsMap, 
                      setTempFactionsMap, 
                      'factionsMap', 
                      '例如：东荒三宗、西漠佛国、北海妖域，各方势力犬牙交错...'
                    )}
                    
                    {renderKernelDimensionCard(
                      'sellingPoints', 
                      '爽点与核心卖点', 
                      '网文吸引读者的商业爽点，如打脸、越级挑战、幕后黑手等节奏设计', 
                      tempSellingPoints, 
                      setTempSellingPoints, 
                      'sellingPoints', 
                      '例如：扮猪吃老虎，极限反杀，创建宗门幕后操控世界流派...'
                    )}
                    
                    {/* 反 AI 写作控制与文风微调卡片 */}
                    <div 
                      className="glass-card animate-fade-in" 
                      style={{ 
                        background: 'rgba(255, 255, 255, 0.02)', 
                        border: '1px solid var(--border-light)', 
                        borderRadius: '12px', 
                        marginBottom: '16px',
                        overflow: 'hidden',
                        flexShrink: 0
                      }}
                    >
                      <div 
                        onClick={() => setExpandedKernelCard(expandedKernelCard === 'antiAiStyleRules' ? null : 'antiAiStyleRules')}
                        style={{ 
                          padding: '16px 20px', 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          cursor: 'pointer',
                          background: expandedKernelCard === 'antiAiStyleRules' ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                          transition: 'background 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <strong style={{ fontSize: '15px', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span></span> 反 AI 写作控制与文风特征过滤器
                          </strong>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            绑定写作模型时的底层约束规则，彻底清除大模型生成文章中的“AI 鸡汤味”与“模板腔”
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {store.currentProject?.antiAiStyleRules?.length ? `已启用 ${store.currentProject.antiAiStyleRules.length} 项` : '未启用'}
                          </span>
                          {expandedKernelCard === 'antiAiStyleRules' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>

                      {expandedKernelCard === 'antiAiStyleRules' && (
                        <div 
                          style={{ 
                            padding: '20px', 
                            borderTop: '1px solid var(--border-light)',
                            background: 'rgba(0,0,0,0.1)'
                          }}
                        >
                          <div style={{ marginBottom: '16px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>点击以下文风特征药丸，一键启用或关闭（即时落库生效）：</span>
                            {store.currentProject?.antiAiStyleRules && store.currentProject.antiAiStyleRules.length > 0 && (
                              <button 
                                className="btn btn-secondary" 
                                onClick={async () => {
                                  if (!store.currentProject) return;
                                  if (confirm('是否清空所有已启用的反 AI 规则？')) {
                                    await store.updateProject(store.currentProject.id, { antiAiStyleRules: [] });
                                  }
                                }}
                                style={{ padding: '2px 8px', fontSize: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)' }}
                              >
                                重置全部
                              </button>
                            )}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
                            {DEFAULT_ANTI_AI_RULES.map((rule) => {
                              const isActive = store.currentProject?.antiAiStyleRules?.includes(rule.key) || false;
                              return (
                                <div 
                                  key={rule.key}
                                  onClick={async () => {
                                    if (!store.currentProject) return;
                                    const currentRules = store.currentProject.antiAiStyleRules || [];
                                    let nextRules: string[];
                                    if (currentRules.includes(rule.key)) {
                                      nextRules = currentRules.filter(k => k !== rule.key);
                                    } else {
                                      nextRules = [...currentRules, rule.key];
                                    }
                                    try {
                                      await store.updateProject(store.currentProject.id, { antiAiStyleRules: nextRules });
                                    } catch (e) {
                                      alert('更新反 AI 写作规则失败');
                                    }
                                  }}
                                  style={{ 
                                    padding: '12px 16px', 
                                    background: isActive ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.01)', 
                                    border: isActive ? '1px solid var(--accent)' : '1px solid var(--border-light)', 
                                    borderRadius: '10px', 
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px',
                                    transition: 'all 0.2s ease',
                                    boxShadow: isActive ? '0 0 10px rgba(99, 102, 241, 0.15)' : 'none'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <strong style={{ fontSize: '13px', color: isActive ? '#fff' : 'var(--text-muted)' }}>
                                      {rule.name}
                                    </strong>
                                    <span style={{ 
                                      width: '14px', 
                                      height: '14px', 
                                      borderRadius: '50%', 
                                      border: isActive ? 'none' : '1px solid var(--border-light)', 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'center',
                                      background: isActive ? 'var(--accent)' : 'transparent'
                                    }}>
                                      {isActive && <CheckCircle2 size={10} style={{ color: '#fff' }} />}
                                    </span>
                                  </div>
                                  <p style={{ fontSize: '11px', color: 'var(--text-dark)', margin: 0, lineHeight: '1.5' }}>
                                    {rule.promptInstruction}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '30px', flexGrow: 1, minHeight: 0 }}>
                    {/* 左侧：角色资产列表 */}
                    <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#fff', margin: 0 }}>
                          角色卡资产库 ({store.characters ? store.characters.length : 0})
                        </h4>
                        {!isAddingChar && store.currentProject && (
                          <button 
                            className="btn btn-primary" 
                            onClick={() => setIsAddingChar(true)}
                            style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--accent)', border: 'none' }}
                          >
                            添加角色
                          </button>
                        )}
                      </div>
                      {isAddingChar && store.currentProject && (
                        <AddCharacterCard 
                          projectId={store.currentProject.id} 
                          onAdd={async (char) => {
                            await store.createCharacter(char);
                          }} 
                          onCancel={() => setIsAddingChar(false)} 
                        />
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {!store.characters || (store.characters.length === 0 && !isAddingChar) ? (
                          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dark)', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', fontSize: '12px' }}>
                            当前尚未添加角色卡资产，点击右上角按钮创建！
                          </div>
                        ) : (
                          store.characters.map((char) => (
                            <CharacterCard 
                              key={char.id}
                              character={char} 
                              onSave={async (id, updates) => {
                                await store.updateCharacter(id, updates);
                              }} 
                              onDelete={async (id) => {
                                await store.deleteCharacter(id);
                              }} 
                            />
                          ))
                        )}
                      </div>
                    </div>

                    {/* 右侧：世界设定列表 */}
                    <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#fff', margin: 0 }}>
                          世界设定资产库 ({store.worldRules ? store.worldRules.length : 0})
                        </h4>
                        {!isAddingRule && store.currentProject && (
                          <button 
                            className="btn btn-primary" 
                            onClick={() => setIsAddingRule(true)}
                            style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--accent)', border: 'none' }}
                          >
                            新建设定项
                          </button>
                        )}
                      </div>

                      {/* 世界设定类型过滤器小药丸 */}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        {(['all', 'location', 'faction', 'rule', 'item', 'other'] as const).map((filterOpt) => {
                          const labels: Record<string, string> = {
                            all: '全部',
                            location: '地点',
                            faction: '势力',
                            rule: '法则',
                            item: '道具',
                            other: '其他'
                          };
                          const isActive = ruleFilter === filterOpt;
                          return (
                            <button
                              key={filterOpt}
                              onClick={() => setRuleFilter(filterOpt)}
                              style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                border: isActive ? '1px solid var(--accent)' : '1px solid var(--border-light)',
                                background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-input)',
                                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                                transition: 'all 0.2s'
                              }}
                            >
                              {labels[filterOpt]}
                            </button>
                          );
                        })}
                      </div>

                      {isAddingRule && store.currentProject && (
                        <AddWorldRuleCard 
                          projectId={store.currentProject.id} 
                          onAdd={async (rule) => {
                            await store.createWorldRule(rule);
                          }} 
                          onCancel={() => setIsAddingRule(false)} 
                        />
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {!filteredRules || (filteredRules.length === 0 && !isAddingRule) ? (
                          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dark)', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', fontSize: '12px' }}>
                            当前尚未添加该类型的设定项，点击右上角按钮创建！
                          </div>
                        ) : (
                          filteredRules.map((rule) => (
                            <WorldRuleCard 
                              key={rule.id}
                              rule={rule} 
                              onSave={async (id, updates) => {
                                await store.updateWorldRule(id, updates);
                              }} 
                              onDelete={async (id) => {
                                await store.deleteWorldRule(id);
                              }} 
                            />
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 右侧拖拽条 */}
          <div
            className="resize-handle"
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.clientX;
              const startWidth = aiPanelWidth;
              const handle = e.currentTarget;
              handle.classList.add('active');
              document.body.style.userSelect = 'none';
              const onMove = (ev: MouseEvent) => {
                const delta = startX - ev.clientX;
                const newWidth = Math.max(240, Math.min(600, startWidth + delta));
                setAiPanelWidth(newWidth);
                localStorage.setItem('layout_ai_panel_width', String(newWidth));
              };
              const onUp = () => {
                handle.classList.remove('active');
                document.body.style.userSelect = '';
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
              };
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}
          />

          {/* 右侧：AI 面板 */}
          <div className="workspace-ai-panel" style={{ width: aiPanelWidth, minWidth: 240, maxWidth: 600, flexShrink: 0 }}>
              {/* AI 多智能体协同创作聊天 */}
                <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.01)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-dark)' }}>协同创作模式：5位智能体在线</span>
                    {agentMessages.length > 0 && (
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={() => {
                          if (confirm('确定清除当前的协作对话历史吗？')) {
                            setAgentMessages([]);
                            if (store.currentProject) {
                              localStorage.removeItem(`agent_messages_${store.currentProject.id}`);
                              fetch(`/api/agent/history?projectId=${store.currentProject.id}`, {
                                method: 'DELETE',
                              }).catch(err => {
                                console.error('Failed to delete agent history from database:', err);
                              });
                            }
                          }
                        }}
                        style={{ padding: '2px 8px', fontSize: '10.5px', border: 'none', background: 'rgba(244,63,94,0.08)', color: '#fda4af', cursor: 'pointer' }}
                      >
                        清空历史
                      </button>
                    )}
                  </div>

                  <div className="agent-chat-history">
                    {agentMessages.length === 0 ? (
                      <div className="agent-empty-state">
                        <HelpCircle size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                        <div style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-muted)' }}>
                          我是您的智能创作助理。您可以向我下达任何小说创作指令，我会调度不同的专家来为您服务。
                        </div>
                        <div className="agent-example-grid">
                          <button 
                            type="button" 
                            className="agent-example-btn" 
                            onClick={() => setChatInput('帮我一键规划全书核心设定，体裁是科幻，风格是赛博朋克')}
                          >
                            <strong>设定推演</strong>
                            <span style={{ display: 'block', fontSize: '10.5px', marginTop: '2px', opacity: 0.8 }}>一键规划全书核心大纲与能力体系</span>
                          </button>
                          <button 
                            type="button" 
                            className="agent-example-btn" 
                            onClick={() => setChatInput('帮我在书中新增一个男二号角色，名字叫顾长生，身份背景是没落剑修')}
                          >
                            <strong>角色设定</strong>
                            <span style={{ display: 'block', fontSize: '10.5px', marginTop: '2px', opacity: 0.8 }}>在当前小说中新增一个设定好的角色资产</span>
                          </button>
                          <button 
                            type="button" 
                            className="agent-example-btn" 
                            onClick={() => setChatInput('帮我自动写作第一章正文，要求描写男女主初次见面的冲突场景')}
                          >
                            <strong>章节创作</strong>
                            <span style={{ display: 'block', fontSize: '10.5px', marginTop: '2px', opacity: 0.8 }}>根据已有的设定大纲，起草第一章内容</span>
                          </button>
                          <button 
                            type="button" 
                            className="agent-example-btn" 
                            onClick={() => setChatInput('帮我把当前编辑器的章节草稿进行润色，要求加强对话的交锋感和紧张氛围')}
                          >
                            <strong>文本润色与自检</strong>
                            <span style={{ display: 'block', fontSize: '10.5px', marginTop: '2px', opacity: 0.8 }}>对编辑器章节进行精细修改并做逻辑校验</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      agentMessages.map((msg) => {
                        switch (msg.type) {
                          case 'user':
                            return (
                              <div key={msg.id} className="agent-bubble agent-bubble-user">
                                {msg.content}
                              </div>
                            );
                          case 'thinking':
                            return (
                              <div key={msg.id} className="agent-bubble agent-bubble-thinking">
                                <Loader2 className="animate-spin" size={12} style={{ marginRight: '6px' }} />
                                <span>{msg.label || msg.agent} 正在思考中...</span>
                              </div>
                            );
                          case 'tool_call':
                            return (
                              <div key={msg.id} className="agent-bubble agent-bubble-tool-call">
                                <div className="agent-tool-header">
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>智能体调用了工具</span>
                                  <span className="agent-tool-name">{msg.toolName}</span>
                                </div>
                                {msg.toolInput && typeof msg.toolInput === 'object' && Object.keys(msg.toolInput).length > 0 && (
                                  <div className="agent-tool-params">
                                    {Object.entries(msg.toolInput).map(([k, v]) => (
                                      <div key={k} className="agent-tool-param">
                                        <em>{k}:</em> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          case 'tool_result':
                            return (
                              <div key={msg.id} className="agent-bubble agent-bubble-tool-result">
                                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>工具执行结果:</div>
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto', fontSize: '11px', fontFamily: 'monospace' }}>
                                  {msg.content}
                                </pre>
                              </div>
                            );
                          case 'delegate':
                            return (
                              <div key={msg.id} className="agent-bubble agent-bubble-delegate">
                                <span className={`agent-role-tag agent-${msg.from || 'orchestrator'}`} style={{ marginRight: '6px' }}>{msg.fromLabel || '编导'}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginRight: '6px' }}>── 任务委派 ──►</span>
                                <span className={`agent-role-tag agent-${msg.to || 'planner'}`}>{msg.toLabel || '专家'}</span>
                              </div>
                            );
                          case 'final_answer':
                            return (
                              <div key={msg.id} className={`agent-bubble agent-bubble-answer ${msg.streaming ? 'streaming' : ''}`}>
                                <div className="agent-answer-header">
                                  <span className={`agent-role-tag agent-${msg.agent || 'orchestrator'}`} style={{ marginBottom: '6px' }}>
                                    {msg.label || '智能体'}
                                  </span>
                                </div>
                                <div style={{ lineHeight: '1.6' }}>
                                  <Markdown content={msg.content} />
                                </div>
                              </div>
                            );
                          case 'error':
                            return (
                              <div key={msg.id} className="agent-bubble agent-bubble-error">
                                {msg.content}
                              </div>
                            );
                          default:
                            return (
                              <div key={msg.id} className="agent-bubble agent-bubble-answer">
                                <Markdown content={msg.content} />
                              </div>
                            );
                        }
                      })
                    )}
                    <div ref={agentBottomRef} />
                  </div>

                  {!store.apiKey && (
                    <div style={{ margin: '0 12px 8px', padding: '8px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '6px', fontSize: '11px', color: 'var(--accent-warning)' }}>
                      提示：当前为模拟对话，点击右上角「AI 模型设置」填入 API Key 即可进行真实协作创作。
                    </div>
                  )}

                  <form onSubmit={handleSendAgentMessage} className="chat-input-area">
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="向创作智能体下达指令..." 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={isAgentLoading}
                    />
                    <button type="submit" className="btn btn-primary" style={{ padding: '10px' }} disabled={isAgentLoading}>
                      {isAgentLoading ? <Loader2 className="animate-spin" size={14} /> : '发送'}
                    </button>
                  </form>
                </div>
            </div>
        </div>
      )}

      {/* ======= Modals ======= */}
      {renderSettingsDrawer()}
      {renderInspirationsModal()}



      {/* 新建章节 Modal */}
      {showNewChapModal && (
        <div className="modal-overlay">
          <form className="modal-content glass-card" onSubmit={handleCreateChapter}>
            <div className="modal-title">新建章节</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>章节名称</label>
              <input required type="text" className="input" placeholder="如：第一章 深夜古庙" value={newChapTitle} onChange={e => setNewChapTitle(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowNewChapModal(false)}>取消</button>
              <button type="submit" className="btn btn-primary">创建章节</button>
            </div>
          </form>
        </div>
      )}

      {/* 新建角色卡 Modal */}
      {showNewCharModal && (
        <div className="modal-overlay">
          <form className="modal-content glass-card" onSubmit={handleCreateCharacter} style={{ maxWidth: '550px' }}>
            <div className="modal-title">新增角色卡</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>角色姓名</label>
                <input required type="text" className="input" placeholder="姓名" value={newCharName} onChange={e => setNewCharName(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>角色定位</label>
                <select className="input" value={newCharRole} onChange={e => setNewCharRole(e.target.value)} style={{ background: 'var(--bg-input)' }}>
                  <option value="男主">男主</option>
                  <option value="女主">女主</option>
                  <option value="主角">主角</option>
                  <option value="配角">配角</option>
                  <option value="反派">反派</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>年龄</label>
                <input type="text" className="input" placeholder="如：23" value={newCharAge} onChange={e => setNewCharAge(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>性格特征 (以逗号隔开)</label>
                <input type="text" className="input" placeholder="如：冷静, 腹黑" value={newCharPersonality} onChange={e => setNewCharPersonality(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>身份背景</label>
                <input type="text" className="input" placeholder="如：前朝失忆皇子" value={newCharIdentity} onChange={e => setNewCharIdentity(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>行动目标</label>
                <input type="text" className="input" placeholder="如：寻找记忆, 保护女主" value={newCharGoals} onChange={e => setNewCharGoals(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>当前人物状态/心思</label>
                <input type="text" className="input" placeholder="如：开始怀疑女主意图" value={newCharState} onChange={e => setNewCharState(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>写作禁忌（即AI生成不可违背）</label>
                <input type="text" className="input" placeholder="如：不能变得轻佻油滑" value={newCharForbidden} onChange={e => setNewCharForbidden(e.target.value)} />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowNewCharModal(false)}>取消</button>
              <button type="submit" className="btn btn-primary">添加角色</button>
            </div>
          </form>
        </div>
      )}

      {/* 新建设定卡 Modal */}
      {showNewRuleModal && (
        <div className="modal-overlay">
          <form className="modal-content glass-card" onSubmit={handleCreateRule}>
            <div className="modal-title">新增世界观设定/势力</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>设定项名称</label>
                <input required type="text" className="input" placeholder="如：九幽阁" value={newRuleName} onChange={e => setNewRuleName(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>设定类型</label>
                <select className="input" value={newRuleType} onChange={e => setNewRuleType(e.target.value as any)} style={{ background: 'var(--bg-input)' }}>
                  <option value="location">地理位置/地点</option>
                  <option value="faction">宗门势力/组织</option>
                  <option value="rule">核心规则/境界设定</option>
                  <option value="item">法宝/神兵/核心物品</option>
                  <option value="other">其他设定</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>设定描述</label>
                <textarea required className="textarea" placeholder="描述此设定的核心属性、历史背景等..." value={newRuleDesc} onChange={e => setNewRuleDesc(e.target.value)} />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowNewRuleModal(false)}>取消</button>
              <button type="submit" className="btn btn-primary">添加设定</button>
            </div>
          </form>
        </div>
      )}

      {/* 修改项目设定 Modal */}
      {showEditProjectModal && (
        <div className="modal-overlay">
          <form className="modal-content glass-card" onSubmit={handleSaveProject} style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
              <div className="modal-title" style={{ margin: 0 }}>️ 完善新书设定</div>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleEditProjectAiPlan} 
                disabled={isEditProjectAiLoading}
                style={{ fontSize: '11px', padding: '6px 12px', background: 'linear-gradient(135deg, var(--accent) 0%, #a5b4fc 100%)', border: 'none', boxShadow: 'none' }}
              >
                {isEditProjectAiLoading ? (
                  <>
                    <Loader2 size={11} className="animate-spin" style={{ marginRight: '4px' }} />
                    <span>AI 推演中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={11} style={{ marginRight: '4px' }} />
                    <span>一键 AI 智能推演</span>
                  </>
                )}
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>小说书名</label>
                <input required type="text" className="input" placeholder="输入您小说的名字..." value={editProjTitle} onChange={e => setEditProjTitle(e.target.value)} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>文风设定（可自定义输入，如：暗黑克苏鲁、轻快吐槽）</label>
                <input type="text" className="input" placeholder="输入文风偏好（如：传统仙侠正剧，快节奏爽文）..." value={editProjStyle} onChange={e => setEditProjStyle(e.target.value)} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>故事简介</label>
                <textarea className="textarea" placeholder="填写一句话简介或故事看点，有助于 AI 写作时紧扣主题..." value={editProjDesc} onChange={e => setEditProjDesc(e.target.value)} style={{ minHeight: '80px' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>核心世界观/背景描述</label>
                <textarea className="textarea" placeholder="在此补充世界的物理规则、力量体系等级、地理背景等（如：凡人修真，境界分为练气、筑基、金丹等）..." value={editProjWorld} onChange={e => setEditProjWorld(e.target.value)} style={{ minHeight: '120px' }} />
              </div>
            </div>
            
            <div className="modal-actions" style={{ marginTop: '20px', borderTop: '1px solid var(--border-light)', paddingTop: '14px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowEditProjectModal(false)} disabled={isEditProjectAiLoading}>取消</button>
              <button type="submit" className="btn btn-primary" disabled={isEditProjectAiLoading}>保存设定</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
