'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useNovelStore } from '@/lib/store';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // 从 URL 路径中提取项目 ID
  const urlProjectId = pathname.startsWith('/project/') ? pathname.split('/project/')[1] : null;
  const urlTab = searchParams.get('tab') as 'write' | 'outline' | 'settings' | null;
  const urlChapterId = searchParams.get('chapter');

  // 构建工作区 URL
  const buildWorkspaceUrl = useCallback((projectId: string, tab?: string, chapterId?: string) => {
    const url = `/project/${projectId}`;
    const params = new URLSearchParams();
    if (tab) params.set('tab', tab);
    if (chapterId) params.set('chapter', chapterId);
    const qs = params.toString();
    return qs ? `${url}?${qs}` : url;
  }, []);
  
  const callAIApi = async (bodyParams: Record<string, any>) => {
    let apiKeyParam = store.apiKey;
    if (store.apiKey && store.apiProvider) {
      apiKeyParam = JSON.stringify({
        apiKey: store.apiKey,
        apiProvider: store.apiProvider,
        apiBaseUrl: store.apiBaseUrl,
        temperature: store.temperature,
        maxTokens: store.maxTokens,
        systemInstruction: store.systemInstruction,
        reasoningEnabled: store.reasoningEnabled
      });
    }

    return await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: apiKeyParam,
        modelName: store.modelName,
        ...bodyParams,
      }),
    });
  };

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('正在尝试连接服务商并探测可用模型...');
    try {
      const res = await callAIApi({
        action: 'chat',
        projectId: store.currentProject?.id || 'test_project_id',
        query: '你好，这是一次 API 连通性测试。请用极其简短的内容回复（例如“测试成功”），不要多说任何废话。'
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

  const handleFetchModels = async () => {
    if (!store.apiKey) {
      alert('请先输入 API 密钥 (API Key)');
      return;
    }
    setFetchingModels(true);
    setFetchModelsError('');
    try {
      const res = await callAIApi({
        action: 'fetchModels'
      });
      const data = await res.json();
      if (data.models && Array.isArray(data.models)) {
        setFetchedModels(data.models);
        if (data.models.length > 0) {
          store.setModelName(data.models[0]);
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

  const [activeTab, setActiveTab] = useState<'chapters' | 'settings'>('chapters');

  
  // 模态弹窗与设置状态
  const [showSettings, setShowSettings] = useState(false);
  const [showNewProjModal, setShowNewProjModal] = useState(false);
  const [isWizardMode, setIsWizardMode] = useState(false);
  const [selectedGenreCategory, setSelectedGenreCategory] = useState('xuanhuan');
  const [customGenreInput, setCustomGenreInput] = useState('');
  const [customToneInput, setCustomToneInput] = useState('');
  const [showNewCharModal, setShowNewCharModal] = useState(false);
  const [showNewRuleModal, setShowNewRuleModal] = useState(false);
  const [showNewChapModal, setShowNewChapModal] = useState(false);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editProjTitle, setEditProjTitle] = useState('');
  const [editProjStyle, setEditProjStyle] = useState('');
  const [editProjWorld, setEditProjWorld] = useState('');
  const [editProjDesc, setEditProjDesc] = useState('');
  const [isEditProjectAiLoading, setIsEditProjectAiLoading] = useState(false);
  
  // 表单状态
  const [newProjTitle, setNewProjTitle] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [newProjStyle, setNewProjStyle] = useState('');
  const [newProjWorld, setNewProjWorld] = useState('');
  
  const [newCharName, setNewCharName] = useState('');
  const [newCharRole, setNewCharRole] = useState('配角');
  const [newCharAge, setNewCharAge] = useState('');
  const [newCharIdentity, setNewCharIdentity] = useState('');
  const [newCharPersonality, setNewCharPersonality] = useState('');
  const [newCharGoals, setNewCharGoals] = useState('');
  const [newCharState, setNewCharState] = useState('');
  const [newCharForbidden, setNewCharForbidden] = useState('');
  
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleType, setNewRuleType] = useState<'location' | 'faction' | 'rule' | 'item' | 'other'>('location');
  const [newRuleDesc, setNewRuleDesc] = useState('');
  
  const [newChapTitle, setNewChapTitle] = useState('');
  
  // AI 交互状态
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'model'; content: string }>>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // ======= 多 Agent 智能体状态 =======
  type AgentMsgType = 'user' | 'thinking' | 'tool_call' | 'tool_result' | 'final_answer' | 'delegate' | 'system' | 'error';
  interface AgentMessage {
    id: string;
    type: AgentMsgType;
    agent?: string;
    label?: string;
    content: string;
    toolName?: string;
    toolInput?: any;
    from?: string;
    fromLabel?: string;
    to?: string;
    toLabel?: string;
    streaming?: boolean;
  }
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const saveAndSetAgentMessages = (val: AgentMessage[] | ((prev: AgentMessage[]) => AgentMessage[])) => {
    setAgentMessages(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      if (typeof window !== 'undefined' && store.currentProject) {
        localStorage.setItem(`agent_messages_${store.currentProject.id}`, JSON.stringify(next));
      }
      return next;
    });
  };

  // 切换项目或初始化时从后台数据库读取对话历史，若失败或无数据则降级使用 localStorage
  useEffect(() => {
    let active = true;
    if (store.currentProject) {
      fetch(`/api/agent/history?projectId=${store.currentProject.id}`)
        .then(res => {
          if (!res.ok) throw new Error('Network response error');
          return res.json();
        })
        .then(data => {
          if (!active) return;
          if (Array.isArray(data) && data.length > 0) {
            setAgentMessages(data);
          } else {
            const saved = localStorage.getItem(`agent_messages_${store.currentProject!.id}`);
            if (saved) {
              try {
                setAgentMessages(JSON.parse(saved));
              } catch (_) {
                setAgentMessages([]);
              }
            } else {
              setAgentMessages([]);
            }
          }
          setTimeout(() => {
            if (agentBottomRef.current) {
              agentBottomRef.current.scrollIntoView({ behavior: 'auto' });
            }
          }, 100);
        })
        .catch(() => {
          if (!active) return;
          const saved = localStorage.getItem(`agent_messages_${store.currentProject!.id}`);
          if (saved) {
            try {
              setAgentMessages(JSON.parse(saved));
            } catch (_) {
              setAgentMessages([]);
            }
          } else {
            setAgentMessages([]);
          }
          setTimeout(() => {
            if (agentBottomRef.current) {
              agentBottomRef.current.scrollIntoView({ behavior: 'auto' });
            }
          }, 100);
        });
    } else {
      setAgentMessages([]);
    }
    return () => {
      active = false;
    };
  }, [store.currentProject?.id]);

  // 对话历史变动时，防抖并过滤流式状态后保存到后台数据库
  useEffect(() => {
    if (!store.currentProject || agentMessages.length === 0) return;
    
    // 如果有消息在流式传输中，不进行同步，等传输完毕再同步
    if (agentMessages.some(m => m.streaming)) {
      return;
    }

    const projectId = store.currentProject.id;
    const timer = setTimeout(() => {
      const messagesToSave = agentMessages.map(m => ({
        id: m.id,
        type: m.type,
        agent: m.agent,
        label: m.label,
        content: m.content,
        toolName: m.toolName,
        toolInput: m.toolInput,
        from: m.from,
        fromLabel: m.fromLabel,
        to: m.to,
        toLabel: m.toLabel,
      }));

      fetch('/api/agent/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, messages: messagesToSave }),
      }).catch(err => {
        console.error('Failed to sync agent messages to backend:', err);
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [agentMessages, store.currentProject?.id]);

  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const agentBottomRef = useRef<HTMLDivElement | null>(null);
  
  const [writeInstruction, setWriteInstruction] = useState('');
  const [polishInstruction, setPolishInstruction] = useState('提升文学美感，加强环境烘托与心理描写');
  const [outlineChapters, setOutlineChapters] = useState(3);
  const [outlineResult, setOutlineResult] = useState('');
  
  const [checkResult, setCheckResult] = useState<{ passed?: boolean; issues: string[]; suggestions: string[] } | null>(null);
  
  // 编辑器状态
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // ======= AI 自动写小说引擎状态 =======
  const [isAutoWriting, setIsAutoWriting] = useState(false);
  const [autoWritingStatus, setAutoWritingStatus] = useState('准备自动写作...');
  const [targetChaptersCount, setTargetChaptersCount] = useState(3);
  const [finishedChaptersCount, setFinishedChaptersCount] = useState(0);
  const [autoWriteMode, setAutoWriteMode] = useState(true); // 默认开启AI自动写小说模式
  const autoWriteStopRef = useRef(false);

  // ======= AI 多维度灵感生成状态 =======
  const [showInspirationsModal, setShowInspirationsModal] = useState(false);
  const [isInspirationLoading, setIsInspirationLoading] = useState(false);
  const [inspCharacters, setInspCharacters] = useState<Array<{
    id: string;
    checked: boolean;
    name: string;
    role: string;
    age: string;
    identity: string;
    personality: string;
    goals: string;
    currentState: string;
    forbidden: string;
  }>>([]);
  const [inspRules, setInspRules] = useState<Array<{
    id: string;
    checked: boolean;
    name: string;
    type: 'location' | 'faction' | 'rule' | 'item' | 'other';
    description: string;
  }>>([]);
  const [activeInspTab, setActiveInspTab] = useState<'char' | 'rule'>('char');

  // ======= 向导式新书生成器状态 =======
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedGenre, setSelectedGenre] = useState('仙侠修真');
  const [selectedTone, setSelectedTone] = useState('传统正剧');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardResult, setWizardResult] = useState<{
    title: string;
    description: string;
    styleSetting: string;
    worldSetting: string;
  } | null>(null);
  const [customTagInput, setCustomTagInput] = useState('');
  const [loadingTip, setLoadingTip] = useState('正在推演天机...');

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('layout_sidebar_width');
      return saved ? Number(saved) : 260;
    }
    return 260;
  });
  const [aiPanelWidth, setAiPanelWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('layout_ai_panel_width');
      return saved ? Number(saved) : 340;
    }
    return 340;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ======= 核心设定与故事大纲平铺工作区状态 =======
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'write' | 'outline' | 'settings'>('write');
  const [kernelOptions, setKernelOptions] = useState<any>(null);
  const [isKernelLoading, setIsKernelLoading] = useState(false);
  const [expandedKernelCard, setExpandedKernelCard] = useState<string | null>('powerSystem');

  // 故事资产管理状态
  const [activeSettingsSubTab, setActiveSettingsSubTab] = useState<'kernel' | 'assets'>('kernel');
  const [ruleFilter, setRuleFilter] = useState<'all' | 'location' | 'faction' | 'rule' | 'item' | 'other'>('all');
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

  useEffect(() => {
    if (!wizardLoading) return;
    const tips = ['正在推演天机...', '正在架构宏大世界观...', '正在雕琢惊艳书名...', '正在推导主线剧情...', '正在谱写命途因果...'];
    let idx = 0;
    const timer = setInterval(() => {
      idx = (idx + 1) % tips.length;
      setLoadingTip(tips[idx]);
    }, 1200);
    return () => clearInterval(timer);
  }, [wizardLoading]);

  // 初始化获取项目
  useEffect(() => {
    store.fetchProjects().then(() => {
      const currentProjects = useNovelStore.getState().projects;
      if (currentProjects.length === 0) {
        seedDemoData();
      } else if (urlProjectId && !useNovelStore.getState().currentProject) {
        // 从 URL 恢复项目
        const project = currentProjects.find((p: any) => p.id === urlProjectId);
        if (project) {
          useNovelStore.getState().setCurrentProject(project);
        }
      }
    });
  }, []);

  // 从 URL 恢复 tab 和 chapter 选中状态
  useEffect(() => {
    if (!store.currentProject) return;
    if (urlTab && ['write', 'outline', 'settings'].includes(urlTab)) {
      setActiveWorkspaceTab(urlTab as 'write' | 'outline' | 'settings');
    }
    if (urlChapterId && store.chapters.length > 0) {
      const chapter = store.chapters.find(c => c.id === urlChapterId);
      if (chapter) {
        store.setCurrentChapter(chapter);
      }
    }
  }, [store.currentProject?.id, store.chapters.length]);

  // 滚动聊天到底部
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // 当选择新章节时，同步更新编辑器内容
  useEffect(() => {
    if (store.currentChapter) {
      setEditorTitle(store.currentChapter.title);
      setEditorContent(store.currentChapter.content);
      setSaveStatus('saved');
    } else {
      setEditorTitle('');
      setEditorContent('');
    }
  }, [store.currentChapter]);

  // 编辑器自动保存机制 (Debounce 1.5s)
  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditorContent(e.target.value);
    setSaveStatus('dirty');

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    
    autoSaveTimer.current = setTimeout(() => {
      if (store.currentChapter) {
        setSaveStatus('saving');
        store.updateChapter(store.currentChapter.id, { content: e.target.value }).then(() => {
          setSaveStatus('saved');
        });
      }
    }, 1500);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditorTitle(e.target.value);
    setSaveStatus('dirty');

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    
    autoSaveTimer.current = setTimeout(() => {
      if (store.currentChapter) {
        setSaveStatus('saving');
        store.updateChapter(store.currentChapter.id, { title: e.target.value }).then(() => {
          setSaveStatus('saved');
        });
      }
    }, 1500);
  };

  // 手动保存章节
  const forceSave = () => {
    if (store.currentChapter) {
      setSaveStatus('saving');
      store.updateChapter(store.currentChapter.id, {
        title: editorTitle,
        content: editorContent
      }).then(() => {
        setSaveStatus('saved');
      });
    }
  };

  // 预设种子演示小说数据，提升初次体验
  const seedDemoData = async () => {
    try {
      const demoProj = await store.createProject(
        '仙途密信',
        '一封前朝密信，打破了偏远小镇上的平静。陆家藏书阁女史陆青禾与随身佩戴神秘玉佩的失忆公子沈砚被迫卷入仙盟博弈与前朝复辟的洪流中。',
        '传统修真悬疑，文笔清丽细腻，注重人物心理博弈与细腻的情感描写。',
        '凡尘之上有三大修真豪门（陆、苏、王）以及统一天下的仙盟。暗地里，被消灭的前朝皇室死士组织“九幽阁”蠢幽动。'
      );

      // 选择此项目
      store.setCurrentProject(demoProj);
      router.push(buildWorkspaceUrl(demoProj.id, 'write'));

      // 创建角色卡
      await store.createCharacter({
        projectId: demoProj.id,
        name: '沈砚',
        role: '男主',
        age: '23',
        identity: '前朝大皇子，在皇宫政变中重伤失忆，流落民间',
        personality: ['冷静克制', '眼神锐利', '内心极度护短'],
        goals: ['寻回遗失记忆', '查明生母死因', '暗中保护陆青禾'],
        relationships: [{ target: '陆青禾', type: '同盟 / 暗生情愫' }],
        currentState: '在藏书阁发现了蛛丝马迹，已警觉有人在调查自己',
        forbidden: ['言行不能流于轻浮猥琐', '遇到危机时不能自乱阵脚']
      });

      await store.createCharacter({
        projectId: demoProj.id,
        name: '陆青禾',
        role: '女主',
        age: '20',
        identity: '修真豪门陆家分支的藏书阁管卷女史，负责古籍整理',
        personality: ['聪慧机智', '洞察力极强', '外柔内刚'],
        goals: ['保全弟弟性命', '通过家族旧卷查明祖父被仙盟治罪真相'],
        relationships: [{ target: '沈砚', type: '怀疑身份 / 利益盟友' }],
        currentState: '在密室意外查阅到残破印章密信，开始怀疑沈砚身世',
        forbidden: ['不可恋爱脑', '不可盲目相信他人']
      });

      // 创建设定卡
      await store.createWorldRule({
        projectId: demoProj.id,
        name: '九幽阁',
        type: 'faction',
        description: '前朝大周皇室的核心死士亲军，擅长夜袭、隐匿与影杀术。旗帜印记为残破盘龙纹。'
      });

      await store.createWorldRule({
        projectId: demoProj.id,
        name: '盘龙玉佩',
        type: 'item',
        description: '沈砚贴身之物，品质温润的极品玄玉。其边缘雕刻有细密的皇家特有盘龙暗纹，但有明显火烧磨损痕迹。'
      });

      // 创建初始章节
      const ch12 = await store.createChapter(demoProj.id, '第十二章：藏书阁夜读');
      await store.updateChapter(ch12.id, {
        content: `窗外夜雨淅淅沥沥，冷风吹得老旧的铜锁发出刺耳的撞击声。
陆青禾侧身护着手里那盏昏黄的灯笼，轻手轻脚地推开了藏书阁最底层的铁木重门。这里的架上全是被仙盟列为“存疑”的世家旧档，纸张泛着陈旧的霉味。
她耐着性子，纤细的手指在一排排泛黄的卷宗间划过，最终在角落一个落了锁的小暗格底端，抽出了那封信。
信封一角盖着红斑斑驳的盘龙火漆，虽残破不全，但那盘卷的长龙之角，却猛地让陆青禾倒吸了一口凉气。
“这印记……明明和沈公子的那枚玉佩……”她低语，捂住了自己狂跳的心口。`,
        summary: '陆青禾在藏书阁底的密室发现了一封盖着盘龙火漆的密信，这火漆上的残破盘龙印记与沈砚随身玉佩上的纹路如出一辙，陆青禾大为震惊。',
        characterChanges: [{ character: '陆青禾', change: '发现关键证据，对沈砚的来历产生极大怀疑' }],
        newForeshadowing: ['盘龙火漆密信', '沈砚玉佩上的残缺龙角'],
        resolvedForeshadowing: [],
        timelineEvents: ['细雨之夜，陆青禾私入藏书阁禁区，查获前朝密信']
      });

      const ch13 = await store.createChapter(demoProj.id, '第十三章：深夜茶香的试探');
      // 未写正文，以留空供AI自动写作体验
      await store.updateChapter(ch13.id, {
        content: ``,
        summary: '',
        characterChanges: [],
        newForeshadowing: [],
        resolvedForeshadowing: [],
        timelineEvents: []
      });

      // 默认选中第十三章
      store.setCurrentChapter(ch13);
    } catch (e) {
      console.error('Failed to seed demo data', e);
    }
  };

  // ======= 向导式新书生成器处理器 =======
  const handleOpenWizard = () => {
    setWizardStep(1);
    setSelectedGenre('仙侠修真');
    setSelectedTone('传统正剧');
    setSelectedTags([]);
    setWizardResult(null);
    setWizardLoading(false);
    setCustomGenreInput('');
    setCustomToneInput('');
    setIsWizardMode(true);
  };

  const handleSkipWizard = async () => {
    setIsAiLoading(true);
    try {
      const newProj = await store.createProject(
        "未命名故事",
        "点击左侧‘设定库’或‘项目设置’补充简介与背景设定...",
        "传统正剧",
        "待补充世界观"
      );
      
      // 默认空目录
      await store.createChapter(newProj.id, '第一章：启程');
      await store.createChapter(newProj.id, '第二章：变局');
      await store.createChapter(newProj.id, '第三章：抉择');

      setIsWizardMode(false);
      store.setCurrentProject(newProj);
      router.push(buildWorkspaceUrl(newProj.id, 'write'));
      alert("已跳过向导！已为您创建一个初始项目《未命名故事》，并在左侧生成了前三章的初始目录，您可以在左侧设定库中慢慢补充各种故事背景设定。");
    } catch (err) {
      alert("直接建书失败");
    } finally {
      setIsAiLoading(false);
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

  const handleSaveProject = async (e: React.FormEvent) => {
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

  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleWizardGenerate = async () => {
    setWizardLoading(true);
    setWizardResult(null);
    try {
      const res = await callAIApi({
        action: 'autoPlanBook',
        genre: selectedGenre,
        tone: selectedTone,
        tags: selectedTags
      });
      const data = await res.json();
      if (data.title) {
        setWizardResult({
          title: data.title,
          description: data.description || '',
          styleSetting: data.styleSetting || '',
          worldSetting: data.worldSetting || ''
        });
        setWizardStep(4);
      } else {
        alert('推演新书规划失败，请稍后重试。');
      }
    } catch (e) {
      alert('推演超时，请检查网络设置。');
    } finally {
      setWizardLoading(false);
    }
  };

  const handleWizardCreateProject = async () => {
    if (!wizardResult) return;
    setIsAiLoading(true);
    try {
      const newProj = await store.createProject(
        wizardResult.title,
        wizardResult.description,
        wizardResult.styleSetting,
        wizardResult.worldSetting
      );

      // 根据题材自动设置不同的前三章标题（更完整、贴切！）
      let ch1 = '第一章：深夜古卷的惊变';
      let ch2 = '第二章：试探与杀机';
      let ch3 = '第三章：因果暗局';
      
      if (selectedGenre === '悬疑惊悚') {
        ch1 = '第一章：雨夜里的失魂人';
        ch2 = '第二章：死档阁的红漆印';
        ch3 = '第三章：步步追命的规则';
      } else if (selectedGenre === '科幻未来') {
        ch1 = '第一章：深空舱室的冷苏醒';
        ch2 = '第二章：指令异常与逃逸';
        ch3 = '第三章：宇宙边缘的未知警告';
      } else if (selectedGenre === '现代言情' || selectedGenre === '古代言情') {
        ch1 = '第一章：死局重生的契机';
        ch2 = '第二章：豪门门阀的刁难';
        ch3 = '第三章：针锋相对的交手';
      } else if (selectedGenre === '历史架空') {
        ch1 = '第一章：没落世子的破局策';
        ch2 = '第二章：朝堂对赌与杀机';
        ch3 = '第三章：收服旧部定乾坤';
      } else if (selectedGenre === '游戏竞技') {
        ch1 = '第一章：老将退役后的登录';
        ch2 = '第二章：神魔首测的越级杀';
        ch3 = '第三章：全服震动的首通记录';
      } else if (selectedGenre === '二次元幻想') {
        ch1 = '第一章：转生成为吐槽店长';
        ch2 = '第二章：美少女眷族的上门拜访';
        ch3 = '第三章：日常小店的鸡飞狗跳';
      }

      await store.createChapter(newProj.id, ch1);
      await store.createChapter(newProj.id, ch2);
      await store.createChapter(newProj.id, ch3);

      setIsWizardMode(false);
      store.setCurrentProject(newProj);
      router.push(buildWorkspaceUrl(newProj.id, 'write'));
      alert(`《${wizardResult.title}》项目建档成功！已自动初始化前三章大纲目录，您可以直接开启“AI自动写小说模式”进行智能连载！`);
    } catch (err) {
      alert('建档失败');
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- 项目操作 ---
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjTitle.trim()) return;
    try {
      const newProj = await store.createProject(
        newProjTitle,
        newProjDesc,
        newProjStyle,
        newProjWorld
      );
      setShowNewProjModal(false);
      setNewProjTitle('');
      setNewProjDesc('');
      setNewProjStyle('');
      setNewProjWorld('');
      store.setCurrentProject(newProj);
      router.push(buildWorkspaceUrl(newProj.id, 'write'));
    } catch (err) {}
  };
  const handleCreateChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store.currentProject || !newChapTitle.trim()) return;
    try {
      await store.createChapter(store.currentProject.id, newChapTitle);
      setShowNewChapModal(false);
      setNewChapTitle('');
    } catch (err) {}
  };

  // --- 角色卡操作 ---
  const handleCreateCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store.currentProject || !newCharName.trim()) return;
    try {
      await store.createCharacter({
        projectId: store.currentProject.id,
        name: newCharName,
        role: newCharRole,
        age: newCharAge,
        identity: newCharIdentity,
        personality: newCharPersonality.split(/[,，]/).map(p => p.trim()).filter(Boolean),
        goals: newCharGoals.split(/[,，]/).map(g => g.trim()).filter(Boolean),
        relationships: [],
        currentState: newCharState,
        forbidden: newCharForbidden.split(/[,，]/).map(f => f.trim()).filter(Boolean)
      });
      setShowNewCharModal(false);
      setNewCharName('');
      setNewCharRole('配角');
      setNewCharAge('');
      setNewCharIdentity('');
      setNewCharPersonality('');
      setNewCharGoals('');
      setNewCharState('');
      setNewCharForbidden('');
    } catch (err) {}
  };

  // --- 设定卡操作 ---
  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store.currentProject || !newRuleName.trim()) return;
    try {
      await store.createWorldRule({
        projectId: store.currentProject.id,
        name: newRuleName,
        type: newRuleType,
        description: newRuleDesc
      });
      setShowNewRuleModal(false);
      setNewRuleName('');
      setNewRuleType('location');
      setNewRuleDesc('');
    } catch (err) {}
  };

  // ================= AI 自动写小说控制引擎逻辑 =================
  const startAutoWriting = async () => {
    if (!store.currentProject) return;
    
    setIsAutoWriting(true);
    autoWriteStopRef.current = false;
    setFinishedChaptersCount(0);

    let activeChapters = [...store.chapters];

    // 1. 如果没有章节，一键自动生成大纲目录
    if (activeChapters.length === 0) {
      setAutoWritingStatus('正在智能规划小说章节大纲目录...');
      try {
        const res = await callAIApi({
          action: 'outline',
          projectId: store.currentProject.id,
          projectTitle: store.currentProject.title,
          projectDesc: store.currentProject.description,
          numChapters: targetChaptersCount
        });
        const data = await res.json();
        
        // 自动建立章节
        const titles = ['第十三章：深夜茶香的试探', '第十四章：藏书阁之约', '第十五章：同盟达成'];
        for (const title of titles) {
          await store.createChapter(store.currentProject!.id, title);
        }
        activeChapters = useNovelStore.getState().chapters;
      } catch (err) {
        setAutoWritingStatus('大纲目录规划失败，请手动创建章节或重试');
        setIsAutoWriting(false);
        return;
      }
    }

    // 2. 依次遍历章节执行自动写小说循环
    let completed = 0;
    for (let i = 0; i < activeChapters.length; i++) {
      if (autoWriteStopRef.current) {
        setAutoWritingStatus('自动写小说已暂停。');
        break;
      }

      const chap = activeChapters[i];
      
      // 跳过已有内容的章节（除非是当前选中的空白章节）
      if (chap.content.trim() !== '' && store.currentChapter?.id !== chap.id) {
        continue;
      }

      // 如果生成的章节数已达到设定上限，停止生成
      if (completed >= targetChaptersCount) {
        break;
      }

      // 切换当前章节为活动章节
      store.setCurrentChapter(chap);
      setAutoWritingStatus(`正在自动写小说正文: ${chap.title} ...`);

      try {
        // 调用 AI 自动写小说接口
        const writeRes = await callAIApi({
          action: 'autoWrite',
          projectId: store.currentProject.id,
          chapterTitle: chap.title,
          instruction: writeInstruction
        });
        const writeData = await writeRes.json();

        if (autoWriteStopRef.current) break;

        if (writeData.text) {
          // 渲染至编辑器
          setEditorContent(writeData.text);
          setSaveStatus('dirty');
          
          // 更新数据库
          await store.updateChapter(chap.id, { content: writeData.text });
          setSaveStatus('saved');

          // 自动进行章节复盘摘要与设定记忆更新
          setAutoWritingStatus(`正在自动复盘章节并更新小说记忆: ${chap.title} ...`);
          
          const sumRes = await callAIApi({
            action: 'summarize',
            currentText: writeData.text
          });
          const sumData = await sumRes.json();

          if (autoWriteStopRef.current) break;

          if (sumData.summary) {
            // 更新章节结构化摘要与伏笔
            await store.updateChapter(chap.id, {
              summary: sumData.summary,
              characterChanges: sumData.characterChanges || [],
              newForeshadowing: sumData.newForeshadowing || [],
              resolvedForeshadowing: sumData.resolvedForeshadowing || [],
              timelineEvents: sumData.timelineEvents || []
            });

            // 联动更新关联角色卡的 current_state
            if (sumData.characterChanges && sumData.characterChanges.length > 0) {
              for (const change of sumData.characterChanges) {
                const matchedChar = store.characters.find(c => c.name === change.character);
                if (matchedChar) {
                  await store.updateCharacter(matchedChar.id, {
                    currentState: change.change
                  });
                }
              }
              // 重新加载角色设定
              await store.fetchCharacters(store.currentProject.id);
            }
          }

          completed++;
          setFinishedChaptersCount(completed);
          
          // 简短休眠以呈现平滑的视觉转接
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } catch (error) {
        console.error('自动写作章节出错:', error);
        setAutoWritingStatus(`在自动写入 ${chap.title} 时遇到问题。`);
        break;
      }
    }

    setIsAutoWriting(false);
    if (!autoWriteStopRef.current) {
      setAutoWritingStatus('恭喜！设定章节的 AI 自动小说创作已顺利完成！');
    }
  };

  const pauseAutoWriting = () => {
    autoWriteStopRef.current = true;
    setIsAutoWriting(false);
    setAutoWritingStatus('自动写小说暂停中。');
  };

  // --- AI 助理聊天功能 ---
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !store.currentProject) return;

    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setIsAiLoading(true);

    try {
      const res = await callAIApi({
        action: 'chat',
        projectId: store.currentProject.id,
        query: userMsg
      });
      const data = await res.json();
      if (data.reply) {
        setChatMessages(prev => [...prev, { role: 'model', content: data.reply }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'model', content: `AI 助手接口异常: ${data.error || '未知错误'}` }]);
      }
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'model', content: '连接 AI 助手超时，请检查网络。' }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- 多 Agent 智能体：发送消息 ---
  const handleSendAgentMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !store.currentProject) return;

    const userMsg = chatInput;
    const msgId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    saveAndSetAgentMessages(prev => [...prev, {
      id: msgId(),
      type: 'user',
      content: userMsg,
    }]);
    setChatInput('');
    setIsAgentLoading(true);

    const chatHistory = agentMessages
      .filter(m => m.type === 'user' || (m.type === 'final_answer' && !m.streaming))
      .map(m => ({
        role: m.type === 'user' ? 'user' : 'assistant',
        content: m.content
      }));

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: store.currentProject.id,
          message: userMsg,
          history: chatHistory,
          apiKey: store.apiKey,
          modelName: store.modelName,
          apiProvider: store.apiProvider,
          apiBaseUrl: store.apiBaseUrl,
          temperature: store.temperature,
          maxTokens: store.maxTokens,
          systemInstruction: store.systemInstruction,
          reasoningEnabled: store.reasoningEnabled,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Agent 接口连接失败');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      // streaming token accumulator
      let streamingMsgId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const chunk of lines) {
          const eIdx = chunk.indexOf('\n');
          if (eIdx === -1 || !chunk.startsWith('event: ')) continue;
          const eventType = chunk.slice(7, eIdx);
          // 取 event 行之后的内容并剥离 "data:" 前缀（兼容有无空格，修正原先 +6 的偏移）
          const dataLine = chunk.slice(eIdx + 1);
          const dataStr = dataLine.startsWith('data:') ? dataLine.slice(5).trimStart() : '';
          if (!eventType || !dataStr) continue;
          let data: any = {};
          try { data = JSON.parse(dataStr); } catch { continue; }

          switch (eventType) {
            case 'thinking':
              if (streamingMsgId) {
                const sid = streamingMsgId;
                saveAndSetAgentMessages(prev => prev.map(m =>
                  m.id === sid ? { ...m, streaming: false } : m
                ));
                streamingMsgId = null;
              }
              saveAndSetAgentMessages(prev => [...prev, {
                id: msgId(),
                type: 'thinking',
                agent: data.agent,
                label: data.label,
                content: '正在思考...',
              }]);
              setTimeout(() => {
                if (agentBottomRef.current) {
                  agentBottomRef.current.scrollIntoView({ behavior: 'smooth' });
                }
              }, 50);
              break;

            case 'token':
              if (!streamingMsgId) {
                const newId = msgId();
                streamingMsgId = newId;
                saveAndSetAgentMessages(prev => [...prev, {
                  id: newId,
                  type: 'final_answer',
                  agent: data.agent,
                  label: data.label || data.agent,
                  content: data.content,
                  streaming: true,
                }]);
              } else {
                const sid = streamingMsgId;
                saveAndSetAgentMessages(prev => prev.map(m =>
                  m.id === sid ? { ...m, content: m.content + data.content } : m
                ));
              }
              setTimeout(() => {
                if (agentBottomRef.current) {
                  agentBottomRef.current.scrollIntoView({ behavior: 'auto' });
                }
              }, 20);
              break;

            case 'tool_call':
              if (streamingMsgId) {
                const sid = streamingMsgId;
                saveAndSetAgentMessages(prev => prev.map(m =>
                  m.id === sid ? { ...m, streaming: false } : m
                ));
                streamingMsgId = null;
              }
              saveAndSetAgentMessages(prev => [...prev, {
                id: msgId(),
                type: 'tool_call',
                agent: data.agent,
                label: data.label,
                toolName: data.toolName,
                toolInput: data.toolInput,
                content: `调用工具：${data.toolName}`,
              }]);
              setTimeout(() => {
                if (agentBottomRef.current) {
                  agentBottomRef.current.scrollIntoView({ behavior: 'smooth' });
                }
              }, 50);
              break;

            case 'tool_result':
              saveAndSetAgentMessages(prev => [...prev, {
                id: msgId(),
                type: 'tool_result',
                agent: data.agent,
                toolName: data.toolName,
                content: data.result,
              }]);
              setTimeout(() => {
                if (agentBottomRef.current) {
                  agentBottomRef.current.scrollIntoView({ behavior: 'smooth' });
                }
              }, 50);
              break;

            case 'delegate':
              if (streamingMsgId) {
                const sid = streamingMsgId;
                saveAndSetAgentMessages(prev => prev.map(m =>
                  m.id === sid ? { ...m, streaming: false } : m
                ));
                streamingMsgId = null;
              }
              saveAndSetAgentMessages(prev => [...prev, {
                id: msgId(),
                type: 'delegate',
                from: data.from,
                fromLabel: data.fromLabel,
                to: data.to,
                toLabel: data.toLabel,
                content: `编导将任务交给${data.toLabel}处理`,
              }]);
              setTimeout(() => {
                if (agentBottomRef.current) {
                  agentBottomRef.current.scrollIntoView({ behavior: 'smooth' });
                }
              }, 50);
              break;

            case 'final_answer':
              if (streamingMsgId) {
                const sid = streamingMsgId;
                streamingMsgId = null;
                saveAndSetAgentMessages(prev => prev.map(m =>
                  m.id === sid ? { ...m, content: data.content, streaming: false } : m
                ));
              } else {
                saveAndSetAgentMessages(prev => [...prev, {
                  id: msgId(),
                  type: 'final_answer',
                  agent: data.agent,
                  label: data.label,
                  content: data.content,
                  streaming: false,
                }]);
              }
              if (store.currentProject) {
                store.fetchCharacters(store.currentProject.id);
                store.fetchWorldRules(store.currentProject.id);
                store.fetchChapters(store.currentProject.id);
              }
              setTimeout(() => {
                if (agentBottomRef.current) {
                  agentBottomRef.current.scrollIntoView({ behavior: 'smooth' });
                }
              }, 50);
              break;

            case 'done':
              if (streamingMsgId) {
                const sid = streamingMsgId;
                saveAndSetAgentMessages(prev => prev.map(m =>
                  m.id === sid ? { ...m, streaming: false } : m
                ));
                streamingMsgId = null;
              }
              if (store.currentProject) {
                store.fetchCharacters(store.currentProject.id);
                store.fetchWorldRules(store.currentProject.id);
                store.fetchChapters(store.currentProject.id);
              }
              break;

            case 'error':
              if (streamingMsgId) {
                const sid = streamingMsgId;
                saveAndSetAgentMessages(prev => prev.map(m =>
                  m.id === sid ? { ...m, streaming: false } : m
                ));
                streamingMsgId = null;
              }
              saveAndSetAgentMessages(prev => [...prev, {
                id: msgId(),
                type: 'error',
                content: data.message || 'Agent 执行出错',
              }]);
              setTimeout(() => {
                if (agentBottomRef.current) {
                  agentBottomRef.current.scrollIntoView({ behavior: 'smooth' });
                }
              }, 50);
              break;
          }
        }
      }
    } catch (err: any) {
      saveAndSetAgentMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        type: 'error',
        content: err.message || '连接 Agent 失败，请检查网络和 API Key',
      }]);
    } finally {
      setIsAgentLoading(false);
      // scroll to bottom
      setTimeout(() => agentBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };


  // --- AI 写作辅助：润色 ---
  const handlePolishText = async () => {
    if (!editorContent.trim() || !store.currentChapter) return;
    setIsAiLoading(true);
    try {
      const res = await callAIApi({
        action: 'polish',
        currentText: editorContent,
        instruction: polishInstruction
      });
      const data = await res.json();
      if (data.text) {
        setOutlineResult(data.text);
      }
    } catch (err) {
      alert('润色失败');
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- AI 写作辅助：逻辑自检 ---
  const handleConsistencyCheck = async () => {
    if (!store.currentProject || !store.currentChapter) return;
    setIsAiLoading(true);
    setCheckResult(null);
    try {
      const res = await callAIApi({
        action: 'selfCheck',
        projectId: store.currentProject.id,
        currentText: editorContent
      });
      const data = await res.json();
      setCheckResult(data);
    } catch (err) {
      alert('逻辑自检执行失败');
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- AI 写作辅助：章节大纲生成 ---
  const handleGenerateOutline = async () => {
    if (!store.currentProject) return;
    setIsAiLoading(true);
    setOutlineResult('');
    try {
      const res = await callAIApi({
        action: 'outline',
        projectId: store.currentProject.id,
        projectTitle: store.currentProject.title,
        projectDesc: store.currentProject.description,
        numChapters: outlineChapters
      });
      const data = await res.json();
      if (data.outline) {
        setOutlineResult(data.outline);
      }
    } catch (err) {
      alert('生成大纲失败');
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- AI 写作辅助：自动提取摘要并更新章节状态 ---
  const handleAutoSummarize = async () => {
    if (!editorContent.trim() || !store.currentChapter) return;
    setIsAiLoading(true);
    try {
      const res = await callAIApi({
        action: 'summarize',
        currentText: editorContent
      });
      const data = await res.json();
      if (data.summary) {
        await store.updateChapter(store.currentChapter.id, {
          summary: data.summary,
          characterChanges: data.characterChanges || [],
          newForeshadowing: data.newForeshadowing || [],
          resolvedForeshadowing: data.resolvedForeshadowing || [],
          timelineEvents: data.timelineEvents || []
        });
        alert(`章节摘要自动提取成功！\n\n【本章摘要】：${data.summary}\n【时间线事件】：${data.timelineEvents?.join(', ') || '无'}`);
      }
    } catch (err) {
      alert('自动提取摘要失败');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleOpenInspirations = async () => {
    if (!store.currentProject) return;
    setShowInspirationsModal(true);
    setIsInspirationLoading(true);
    setInspCharacters([]);
    setInspRules([]);

    try {
      const res = await callAIApi({
        action: 'generateInspirations',
        projectId: store.currentProject.id
      });
      const data = await res.json();
      
      if (data.characters) {
        setInspCharacters(data.characters.map((c: any, index: number) => ({
          id: `insp_char_${index}`,
          checked: true,
          name: c.name || '',
          role: c.role || '配角',
          age: c.age || '',
          identity: c.identity || '',
          personality: Array.isArray(c.personality) ? c.personality.join(', ') : (c.personality || ''),
          goals: Array.isArray(c.goals) ? c.goals.join(', ') : (c.goals || ''),
          currentState: c.currentState || '',
          forbidden: Array.isArray(c.forbidden) ? c.forbidden.join(', ') : (c.forbidden || '')
        })));
      }
      
      if (data.worldRules) {
        setInspRules(data.worldRules.map((r: any, index: number) => ({
          id: `insp_rule_${index}`,
          checked: true,
          name: r.name || '',
          type: r.type || 'location',
          description: r.description || ''
        })));
      }
    } catch (error) {
      alert('生成设定灵感失败，请稍后重试。');
    } finally {
      setIsInspirationLoading(false);
    }
  };

  const handleImportInspirations = async () => {
    if (!store.currentProject) return;
    
    const charsToImport = inspCharacters.filter(c => c.checked);
    const rulesToImport = inspRules.filter(r => r.checked);
    
    if (charsToImport.length === 0 && rulesToImport.length === 0) {
      alert('您没有勾选任何设定灵感！');
      return;
    }

    setIsAiLoading(true);
    try {
      // 批量创建角色
      for (const char of charsToImport) {
        await store.createCharacter({
          projectId: store.currentProject.id,
          name: char.name,
          role: char.role,
          age: char.age,
          identity: char.identity,
          personality: char.personality.split(/[,，]/).map(p => p.trim()).filter(Boolean),
          goals: char.goals.split(/[,，]/).map(g => g.trim()).filter(Boolean),
          relationships: [],
          currentState: char.currentState,
          forbidden: char.forbidden.split(/[,，]/).map(f => f.trim()).filter(Boolean)
        });
      }

      // 批量创建设定项
      for (const rule of rulesToImport) {
        await store.createWorldRule({
          projectId: store.currentProject.id,
          name: rule.name,
          type: rule.type,
          description: rule.description
        });
      }

      // 刷新数据
      await store.fetchCharacters(store.currentProject.id);
      await store.fetchWorldRules(store.currentProject.id);
      
      setShowInspirationsModal(false);
      alert('灵感设定导入成功！');
    } catch (err) {
      alert('导入部分或全部设定时出错');
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- 文件导出功能 ---
  const exportFile = (type: 'md' | 'txt') => {
    if (!store.currentChapter) return;
    const title = editorTitle || '未命名章节';
    const content = editorContent;
    const filename = `${title}.${type}`;
    const blob = new Blob([`# ${title}\n\n${content}`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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
          onClick={() => setShowSettings(false)}
        />
        
        {/* 抽屉本体 */}
        <div className={`drawer-content ${showSettings ? 'active' : ''}`}>
          <div className="drawer-header">
            <div className="drawer-title">
              <Settings size={20} style={{ color: 'var(--accent)' }} />
              <span>AI 写作模型配置面板</span>
            </div>
            <button 
              type="button" 
              className="btn-icon" 
              onClick={() => setShowSettings(false)}
              style={{ fontSize: '20px', lineHeight: '1' }}
            >
              &times;
            </button>
          </div>

          <div className="drawer-body">
            {/* 1. API 厂商与接入信息 */}
            <div className="drawer-section">
              <div className="drawer-section-title">接口服务商配置</div>
              
              <div className="drawer-field">
                <label className="drawer-label">服务商 (Provider)</label>
                <select 
                  className="input"
                  value={store.apiProvider}
                  onChange={(e) => {
                    const prov = e.target.value;
                    store.setApiProvider(prov);
                    // 自动设置对应服务商的默认模型和 BaseURL 占位
                    if (prov === 'gemini') {
                      store.setModelName('gemini-2.5-flash');
                      store.setApiBaseUrl('');
                    } else if (prov === 'openai') {
                      store.setModelName('gpt-4o-mini');
                      store.setApiBaseUrl('https://api.openai.com/v1');
                    } else if (prov === 'deepseek') {
                      store.setModelName('deepseek-chat');
                      store.setApiBaseUrl('https://api.deepseek.com/v1');
                    } else if (prov === 'claude') {
                      store.setModelName('claude-3-5-sonnet-20241022');
                      store.setApiBaseUrl('');
                    } else {
                      store.setModelName('gpt-4o-mini');
                      store.setApiBaseUrl('');
                    }
                  }}
                  style={{ background: 'var(--bg-input)' }}
                >
                  <option value="gemini">Google Gemini (默认)</option>
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
                  placeholder="输入对应厂商的 API Key (留空使用本地 Mock)" 
                  value={store.apiKey}
                  onChange={(e) => store.setApiKey(e.target.value)}
                />
              </div>

              <div className="drawer-field">
                <label className="drawer-label">接口代理地址 (Base URL)</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder={
                    store.apiProvider === 'gemini' 
                      ? '默认: https://generativelanguage.googleapis.com' 
                      : store.apiProvider === 'deepseek'
                        ? '默认: https://api.deepseek.com/v1'
                        : store.apiProvider === 'openai'
                          ? '默认: https://api.openai.com/v1'
                          : '请输入自定义的 API 请求地址'
                  }
                  value={store.apiBaseUrl}
                  onChange={(e) => store.setApiBaseUrl(e.target.value)}
                />
              </div>
            </div>

            {/* 2. 模型与参数微调 */}
            <div className="drawer-section">
              <div className="drawer-section-title">模型与微调参数</div>

              <div className="drawer-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="drawer-label">推荐模型选择</label>
                  <button 
                    type="button"
                    onClick={handleFetchModels}
                    disabled={fetchingModels || !store.apiKey}
                    style={{ 
                      fontSize: '11px', 
                      background: 'none', 
                      border: 'none', 
                      color: store.apiKey ? 'var(--accent)' : 'var(--text-dark)', 
                      cursor: store.apiKey ? 'pointer' : 'default',
                      fontWeight: 500
                    }}
                  >
                    {fetchingModels ? '正在获取...' : '获取最新模型列表'}
                  </button>
                </div>
                {fetchModelsError && (
                  <div style={{ fontSize: '11px', color: 'var(--accent-danger)', marginTop: '2px' }}>
                    {fetchModelsError}
                  </div>
                )}
                <select 
                  className="input"
                  value={store.modelName}
                  onChange={(e) => store.setModelName(e.target.value)}
                  style={{ background: 'var(--bg-input)' }}
                >
                  {fetchedModels.length > 0 ? (
                    <>
                      {fetchedModels.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </>
                  ) : (
                    <>
                      {store.apiProvider === 'gemini' && (
                        <>
                          <option value="gemini-2.5-flash">Gemini 2.5 Flash (快速, 推荐)</option>
                          <option value="gemini-2.5-pro">Gemini 2.5 Pro (深度创意)</option>
                          <option value="gemini-1.5-flash">Gemini 1.5 Flash (轻量)</option>
                        </>
                      )}
                      {store.apiProvider === 'openai' && (
                        <>
                          <option value="gpt-4o-mini">gpt-4o-mini (经济快捷, 推荐)</option>
                          <option value="gpt-4o">gpt-4o (全能旗舰)</option>
                          <option value="o3-mini">o3-mini (高级推理)</option>
                        </>
                      )}
                      {store.apiProvider === 'deepseek' && (
                        <>
                          <option value="deepseek-chat">deepseek-chat (V3 API, 极高性价比)</option>
                          <option value="deepseek-reasoner">deepseek-reasoner (R1 深度推理思考)</option>
                        </>
                      )}
                      {store.apiProvider === 'claude' && (
                        <>
                          <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet (文学创作天花板)</option>
                          <option value="claude-3-5-haiku-20241022">claude-3-5-haiku (高速度高能)</option>
                        </>
                      )}
                    </>
                  )}
                  <option value={store.modelName}>当前选择: {store.modelName}</option>
                </select>
              </div>

              <div className="drawer-field">
                <label className="drawer-label">自定义模型名称 (覆盖上面选项)</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="手动输入任意模型名称, 如: gpt-4-turbo" 
                  value={store.modelName}
                  onChange={(e) => store.setModelName(e.target.value)}
                />
              </div>

              <div className="drawer-field">
                <label className="drawer-label">生成温度 (Temperature)</label>
                <div className="slider-container">
                  <input 
                    type="range" 
                    min="0" 
                    max="2.0" 
                    step="0.1"
                    className="slider-input" 
                    value={store.temperature}
                    onChange={(e) => store.setTemperature(Number(e.target.value))}
                  />
                  <span className="slider-value">{store.temperature.toFixed(1)}</span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-dark)' }}>
                  较低温度会让文本输出更稳定保守，较高温度能带来更多词汇创意。
                </span>
              </div>

              <div className="drawer-field">
                <label className="drawer-label">单次最大生成长度 (Max Tokens)</label>
                <input 
                  type="number" 
                  className="input" 
                  min="100"
                  max="16000"
                  step="100"
                  value={store.maxTokens}
                  onChange={(e) => store.setMaxTokens(Number(e.target.value))}
                />
              </div>
            </div>

            {/* 3. 系统指令与高级特性 */}
            <div className="drawer-section">
              <div className="drawer-section-title">高级指令与功能</div>

              <div className="drawer-field">
                <label className="drawer-label">全局系统提示词前缀 (注入小说大纲前)</label>
                <textarea 
                  className="textarea" 
                  placeholder="例如: 用华丽委婉的古风词藻描写环境; 严格遵循单女主设定等" 
                  value={store.systemInstruction}
                  onChange={(e) => store.setSystemInstruction(e.target.value)}
                  style={{ minHeight: '80px' }}
                />
              </div>

              <div className="drawer-field">
                <div className="switch-container">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '500', color: '#ffffff' }}>思考模型格式适配</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>针对 DeepSeek R1 等思考过程提供兼容输出</span>
                  </div>
                  <label className="switch-control">
                    <input 
                      type="checkbox" 
                      checked={store.reasoningEnabled}
                      onChange={(e) => store.setReasoningEnabled(e.target.checked)}
                    />
                    <span className="switch-slider"></span>
                  </label>
                </div>
              </div>
            </div>

            {/* 4. 连通性测试 */}
            <div className="drawer-section">
              <div className="drawer-section-title">连接状态探测</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button 
                  type="button"
                  className="btn btn-secondary" 
                  onClick={handleTestConnection}
                  disabled={testStatus === 'testing' || !store.apiKey}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {testStatus === 'testing' ? '正在探测中...' : '启动连接测试'}
                </button>
                {testStatus !== 'idle' && (
                  <div className={`test-result-box ${testStatus === 'success' ? 'success' : testStatus === 'error' ? 'error' : ''}`}>
                    {testMessage}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="drawer-footer">
            <button className="btn btn-primary" onClick={() => setShowSettings(false)}>保存并关闭</button>
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
