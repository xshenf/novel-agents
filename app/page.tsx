'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useNovelStore } from '@/lib/store';
import { 
  BookOpen, Plus, Trash2, Settings, ChevronLeft, 
  User, Globe, MessageSquare, Sparkles, CheckCircle2, 
  Save, Download, FileText, Loader2, HelpCircle, Eye, RefreshCw
} from 'lucide-react';
import { NovelProject, Chapter, Character, WorldRule } from '@/lib/db';

export default function Home() {
  const store = useNovelStore();
  const [activeTab, setActiveTab] = useState<'chapters' | 'settings'>('chapters');
  const [activeAITab, setActiveAITab] = useState<'chat' | 'actions'>('chat');
  
  // 模态弹窗与设置状态
  const [showSettings, setShowSettings] = useState(false);
  const [showNewProjModal, setShowNewProjModal] = useState(false);
  const [showNewCharModal, setShowNewCharModal] = useState(false);
  const [showNewRuleModal, setShowNewRuleModal] = useState(false);
  const [showNewChapModal, setShowNewChapModal] = useState(false);
  
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

  // 初始化获取项目
  useEffect(() => {
    store.fetchProjects().then(() => {
      // 自动种子数据预设 (如果项目列表为空)
      const currentProjects = useNovelStore.getState().projects;
      if (currentProjects.length === 0) {
        seedDemoData();
      }
    });
  }, []);

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
        '凡尘之上有三大修真豪门（陆、苏、王）以及统一天下的仙盟。暗地里，被消灭的前朝皇室死士组织“九幽阁”蠢蠢欲动。'
      );

      // 选择此项目
      store.setCurrentProject(demoProj);

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
        currentState: '已察觉有人在调查自己，但决定继续保持文弱书生伪装',
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
      await store.updateChapter(ch13.id, {
        content: `“雨势渐大，陆姑娘深夜方归，莫要着了凉。”
沈砚端坐在茶案旁，正用长勺轻轻拨弄着沸水中的白沫。茶香混合着屋外的雨气弥漫开来，带着一丝安抚人心的温度。
他神色一如往常般清淡出尘，白衣长袖，衬得身形有些单薄。若是旁人见了，只会觉得这是个手无缚鸡之力的落魄书生。
陆青禾悄然将那封密信塞入袖中，努力压下翻腾的呼吸，款款走过去坐下。
“沈公子今日倒是有雅兴，夜半挑灯，倒像是特意在等我？”她杏眼微弯，似是随口打趣，然而目光却牢牢锁在沈砚腰间挂着的那块青玉坠上。`,
        summary: '陆青禾藏起密信回到房中，发现沈砚正在等她。两人相对喝茶，陆青禾表面带笑，暗中将目光锁定在沈砚那块代表其皇家身世的玉佩上。',
        characterChanges: [{ character: '陆青禾', change: '表面克制，暗自通过语言与眼神观察沈砚的反应' }],
        newForeshadowing: ['茶壶散发的奇特药香'],
        resolvedForeshadowing: [],
        timelineEvents: ['同一天深夜，陆青禾回到住处，与守候的沈砚饮茶对峙']
      });

      // 默认选中第十三章
      store.setCurrentChapter(ch13);
    } catch (e) {
      console.error('Failed to seed demo data', e);
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
    } catch (err) {}
  };

  // --- 章节操作 ---
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

  // --- AI 助理聊天功能 ---
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !store.currentProject) return;

    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setIsAiLoading(true);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          projectId: store.currentProject.id,
          query: userMsg,
          apiKey: store.apiKey,
          modelName: store.modelName
        })
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

  // --- AI 写作辅助：续写 ---
  const handleContinueWriting = async () => {
    if (!store.currentProject || !store.currentChapter) return;
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'continue',
          projectId: store.currentProject.id,
          currentText: editorContent,
          instruction: writeInstruction,
          apiKey: store.apiKey,
          modelName: store.modelName
        })
      });
      const data = await res.json();
      if (data.text) {
        const separator = editorContent.trim().length > 0 ? '\n\n' : '';
        setEditorContent(prev => prev + separator + data.text);
        setSaveStatus('dirty');
        // 自动触发保存
        store.updateChapter(store.currentChapter.id, { content: editorContent + separator + data.text }).then(() => {
          setSaveStatus('saved');
        });
      }
    } catch (err) {
      alert('续写失败，请稍后重试');
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- AI 写作辅助：润色 ---
  const handlePolishText = async () => {
    if (!editorContent.trim() || !store.currentChapter) return;
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'polish',
          currentText: editorContent,
          instruction: polishInstruction,
          apiKey: store.apiKey,
          modelName: store.modelName
        })
      });
      const data = await res.json();
      if (data.text) {
        // 创建对比式，或者直接应用。为提升体验，我们直接在右侧面板或者编辑器上方显示对比，这里我们设计为弹窗/注入，直接将润色的文本输出到 outlineResult 或直接应用
        // 这里提供直接替换或在下方展示，展示在 outlineResult 中让作者复制是一个非常安全的做法
        setOutlineResult(data.text);
        setActiveAITab('actions');
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
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'selfCheck',
          projectId: store.currentProject.id,
          currentText: editorContent,
          apiKey: store.apiKey,
          modelName: store.modelName
        })
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
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'outline',
          projectId: store.currentProject.id,
          projectTitle: store.currentProject.title,
          projectDesc: store.currentProject.description,
          numChapters: outlineChapters,
          apiKey: store.apiKey,
          modelName: store.modelName
        })
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
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'summarize',
          currentText: editorContent,
          apiKey: store.apiKey,
          modelName: store.modelName
        })
      });
      const data = await res.json();
      if (data.summary) {
        // 更新章节摘要以及提取的人物变更和伏笔
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

  // 渲染设置面板 (弹出式 Modal)
  const renderSettingsModal = () => {
    if (!showSettings) return null;
    return (
      <div className="modal-overlay">
        <div className="modal-content glass-card">
          <div className="modal-title">AI 智能体配置设定</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Gemini API Key</label>
              <input 
                type="password" 
                className="input" 
                placeholder="输入以启用真实 AI, 留空使用内置 Mock 引擎" 
                value={store.apiKey}
                onChange={(e) => store.setApiKey(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>推荐模型选择</label>
              <select 
                className="input" 
                value={store.modelName}
                onChange={(e) => store.setModelName(e.target.value)}
                style={{ background: 'var(--bg-input)' }}
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (快速, 推荐)</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro (深度创意与逻辑推理)</option>
              </select>
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={() => setShowSettings(false)}>保存并关闭</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main>
      {/* 顶部通栏导航 */}
      <nav className="navbar">
        <div className="nav-brand" style={{ cursor: 'pointer' }} onClick={() => store.setCurrentProject(null)}>
          <BookOpen size={20} style={{ color: 'var(--accent)' }} />
          <span>小说智能体创作台 <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--text-dark)' }}>MVP v1.0</span></span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {store.currentProject && (
            <button className="btn btn-secondary" onClick={() => store.setCurrentProject(null)} style={{ padding: '6px 12px', fontSize: '12px' }}>
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
        <div className="dashboard-container">
          <div className="dashboard-header">
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>我的创作空间</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>选择一部小说开始写作，或者创造一个新的故事灵感项目。</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowNewProjModal(true)}>
              <Plus size={18} />
              <span>新建小说项目</span>
            </button>
          </div>

          <div className="project-grid">
            {store.projects.map((project) => (
              <div key={project.id} className="project-card glass-card" onClick={() => store.setCurrentProject(project)}>
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
                    <span className="tag-badge">长上下文</span>
                  </div>
                  <span>更新于 {new Date(project.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}

            <div className="project-card glass-card" style={{ borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', opacity: '0.7' }} onClick={() => setShowNewProjModal(true)}>
              <Plus size={32} style={{ color: 'var(--text-dark)', marginBottom: '10px' }} />
              <div style={{ fontWeight: '500', color: 'var(--text-muted)' }}>开启你的奇幻新章</div>
            </div>
          </div>
        </div>
      ) : (
        /* 2. Workspace 写作工作台视图 */
        <div className="workspace-layout">
          {/* 左侧侧边栏：章节与设定 */}
          <div className="workspace-sidebar">
            <div className="tab-container">
              <button className={`tab-btn ${activeTab === 'chapters' ? 'active' : ''}`} onClick={() => setActiveTab('chapters')}>
                章节列表 ({store.chapters.length})
              </button>
              <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
                设定库
              </button>
            </div>

            {activeTab === 'chapters' ? (
              <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div className="sidebar-section" style={{ flexGrow: 1, overflowY: 'auto' }}>
                  <div className="sidebar-header">
                    <span>小说目录</span>
                    <button className="btn-icon" onClick={() => setShowNewChapModal(true)}>
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="sidebar-list">
                    {store.chapters.map((chap) => (
                      <div 
                        key={chap.id} 
                        className={`sidebar-item ${store.currentChapter?.id === chap.id ? 'active' : ''}`}
                        onClick={() => store.setCurrentChapter(chap)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                          <FileText size={14} style={{ flexShrink: 0 }} />
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{chap.title}</span>
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

                <div className="sidebar-section" style={{ background: 'rgba(0,0,0,0.15)' }}>
                  <div className="sidebar-header">全局与项目记忆摘要</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <strong style={{ color: 'var(--text-main)' }}>文风偏好：</strong>
                      {store.currentProject.styleSetting || '未设定文风'}
                    </div>
                    <div>
                      <strong style={{ color: 'var(--text-main)' }}>核心设定：</strong>
                      {store.currentProject.worldSetting ? store.currentProject.worldSetting.substring(0, 50) + '...' : '未设定'}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* 设定库子项 */
              <div style={{ flexGrow: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* 角色卡列表 */}
                <div>
                  <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span>人物角色卡 ({store.characters.length})</span>
                    <button className="btn-icon" onClick={() => setShowNewCharModal(true)}>
                      <Plus size={14} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {store.characters.map((char) => (
                      <div key={char.id} className="glass-card" style={{ padding: '10px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <strong style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <User size={12} /> {char.name} ({char.role})
                          </strong>
                          <button className="btn-icon" onClick={() => store.deleteCharacter(char.id)} style={{ padding: '2px' }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>身份: {char.identity}</div>
                        <div style={{ color: 'var(--text-dark)', fontSize: '11px' }}>状态: {char.currentState}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 世界观设定卡 */}
                <div>
                  <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span>世界观规则/势力 ({store.worldRules.length})</span>
                    <button className="btn-icon" onClick={() => setShowNewRuleModal(true)}>
                      <Plus size={14} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {store.worldRules.map((rule) => (
                      <div key={rule.id} className="glass-card" style={{ padding: '10px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <strong style={{ color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Globe size={12} /> {rule.name}
                          </strong>
                          <button className="btn-icon" onClick={() => store.deleteWorldRule(rule.id)} style={{ padding: '2px' }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{rule.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 中间：主章节编辑器 */}
          <div className="workspace-main">
            {store.currentChapter ? (
              <>
                <div className="editor-header">
                  <input 
                    type="text" 
                    className="editor-title-input" 
                    value={editorTitle}
                    onChange={handleTitleChange}
                    placeholder="请输入章节标题..."
                  />
                  <div className="editor-toolbar">
                    <button className="btn btn-secondary" onClick={handleConsistencyCheck} style={{ padding: '8px 12px' }}>
                      <CheckCircle2 size={14} style={{ color: 'var(--accent)' }} />
                      <span>逻辑一致性检测</span>
                    </button>
                    <button className="btn btn-secondary" onClick={handleAutoSummarize} style={{ padding: '8px 12px' }}>
                      <Sparkles size={14} style={{ color: 'var(--accent-success)' }} />
                      <span>章节摘要复盘</span>
                    </button>
                    <button className="btn btn-secondary" onClick={() => exportFile('md')} style={{ padding: '8px 8px' }} title="导出为 Markdown">
                      <Download size={14} />
                    </button>
                    <button className="btn btn-primary" onClick={forceSave} style={{ padding: '8px 12px' }}>
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
                  />
                </div>

                <div className="editor-footer">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="pulse-dot"></span>
                    <span>
                      {saveStatus === 'saved' && '草稿已自动保存至本地'}
                      {saveStatus === 'saving' && '正在自动保存到云端数据库...'}
                      {saveStatus === 'dirty' && '草稿已被修改'}
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

          {/* 右侧：AI 面板 */}
          <div className="workspace-ai-panel">
            <div className="tab-container">
              <button className={`tab-btn ${activeAITab === 'chat' ? 'active' : ''}`} onClick={() => setActiveAITab('chat')}>
                <MessageSquare size={14} style={{ marginRight: '6px', display: 'inline' }} />
                小说设定记忆问答
              </button>
              <button className={`tab-btn ${activeAITab === 'actions' ? 'active' : ''}`} onClick={() => setActiveAITab('actions')}>
                <Sparkles size={14} style={{ marginRight: '6px', display: 'inline' }} />
                智能辅助写作
              </button>
            </div>

            {activeAITab === 'chat' ? (
              /* AI 记忆聊天 */
              <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div className="chat-history">
                  {chatMessages.length === 0 ? (
                    <div style={{ padding: '20px', color: 'var(--text-dark)', fontSize: '13px', textAlign: 'center', lineHeight: '1.6' }}>
                      <HelpCircle size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                      你可以向智能体询问任何关于本书的前文剧情、人物细节或世界观规则。
                      <br /><br />
                      <em>例：“上一章陆青禾发现了什么？”</em>
                      <br />
                      <em>例：“沈砚的真实身份和性格禁忌是什么？”</em>
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div key={i} className={`chat-bubble ${msg.role}`}>
                        {msg.content}
                      </div>
                    ))
                  )}
                  {isAiLoading && (
                    <div className="chat-bubble model" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Loader2 className="animate-spin" size={14} />
                      AI 正在深度思考并检索小说记忆...
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {!store.apiKey && (
                  <div style={{ margin: '0 16px', padding: '8px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '6px', fontSize: '11px', color: 'var(--accent-warning)' }}>
                    提示：当前为模拟对话，点击右上角「AI 模型设置」填入 API Key 即可进行真实长文本语义问答。
                  </div>
                )}

                <form onSubmit={handleSendChatMessage} className="chat-input-area">
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="向小说记忆系统提问..." 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '10px' }} disabled={isAiLoading}>
                    发送
                  </button>
                </form>
              </div>
            ) : (
              /* AI 写作操作辅助面板 */
              <div className="ai-actions-panel">
                {/* 1. AI 续写 */}
                <div className="action-section glass-card" style={{ padding: '14px' }}>
                  <div className="action-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} style={{ color: 'var(--accent)' }} /> AI 灵感续写
                  </div>
                  <textarea 
                    className="textarea" 
                    placeholder="可选：在此输入特定情节指示（例如：“描写两人微小的眼神对峙，带有暧昧气氛”）" 
                    value={writeInstruction}
                    onChange={(e) => setWriteInstruction(e.target.value)}
                    style={{ fontSize: '12px' }}
                  />
                  <button className="btn btn-primary" onClick={handleContinueWriting} disabled={isAiLoading} style={{ marginTop: '8px', width: '100%' }}>
                    {isAiLoading ? <Loader2 className="animate-spin" size={14} /> : '接着末尾续写章节'}
                  </button>
                </div>

                {/* 2. AI 润色 */}
                <div className="action-section glass-card" style={{ padding: '14px' }}>
                  <div className="action-title">AI 精英润色</div>
                  <input 
                    type="text" 
                    className="input" 
                    value={polishInstruction}
                    onChange={(e) => setPolishInstruction(e.target.value)}
                    placeholder="润色指令，如: 加强环境描写，改成古风文笔"
                    style={{ fontSize: '12px', marginBottom: '8px' }}
                  />
                  <button className="btn btn-secondary" onClick={handlePolishText} disabled={isAiLoading} style={{ width: '100%' }}>
                    润色整篇草稿
                  </button>
                </div>

                {/* 3. 逻辑自检报告 */}
                {checkResult && (
                  <div className={`check-result-box ${checkResult.passed ? 'success' : 'warning'}`}>
                    <div style={{ fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={14} />
                      {checkResult.passed ? '逻辑检验：符合设定要求' : '逻辑警告：发现设定冲突'}
                    </div>
                    {checkResult.issues.length > 0 && (
                      <ul style={{ paddingLeft: '16px', marginBottom: '8px' }}>
                        {checkResult.issues.map((iss, i) => <li key={i} className="check-item">{iss}</li>)}
                      </ul>
                    )}
                    {checkResult.suggestions.length > 0 && (
                      <div>
                        <strong style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>修正方案</strong>
                        <ul style={{ paddingLeft: '16px' }}>
                          {checkResult.suggestions.map((sug, i) => <li key={i} className="check-item">{sug}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. 章节大纲生成器 */}
                <div className="action-section glass-card" style={{ padding: '14px' }}>
                  <div className="action-title">自动章节细纲生成</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>生成后续章数:</span>
                    <input 
                      type="number" 
                      className="input" 
                      value={outlineChapters} 
                      onChange={(e) => setOutlineChapters(Number(e.target.value))}
                      style={{ width: '60px', padding: '6px' }}
                      min={1} 
                      max={5} 
                    />
                  </div>
                  <button className="btn btn-secondary" onClick={handleGenerateOutline} disabled={isAiLoading} style={{ width: '100%' }}>
                    生成后续故事细纲
                  </button>
                </div>

                {/* 大纲/润色结果显示框 */}
                {outlineResult && (
                  <div className="glass-card" style={{ padding: '14px', fontSize: '13px', maxHeight: '250px', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <span style={{ fontWeight: '600' }}>AI 生成结果</span>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => {
                          // 如果是润色结果，支持一键替换
                          if (confirm('是否将当前编辑器内容全部替换为该 AI 润色结果？')) {
                            setEditorContent(outlineResult);
                            setSaveStatus('dirty');
                            if (store.currentChapter) {
                              store.updateChapter(store.currentChapter.id, { content: outlineResult });
                            }
                          }
                        }}
                        style={{ padding: '2px 6px', fontSize: '11px' }}
                      >
                        应用到正文
                      </button>
                    </div>
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: '1.6' }}>{outlineResult}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======= Modals ======= */}
      {renderSettingsModal()}

      {/* 新建项目 Modal */}
      {showNewProjModal && (
        <div className="modal-overlay">
          <form className="modal-content glass-card" onSubmit={handleCreateProject}>
            <div className="modal-title">创建新小说项目</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>书名</label>
                <input required type="text" className="input" placeholder="输入小说书名..." value={newProjTitle} onChange={e => setNewProjTitle(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>作品简介</label>
                <textarea className="textarea" placeholder="两百字内阐述主线脑洞剧情..." value={newProjDesc} onChange={e => setNewProjDesc(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>文风偏好 (AI 创作模仿参考)</label>
                <input type="text" className="input" placeholder="例如：暗黑悬疑、快节奏爽文、轻小说等" value={newProjStyle} onChange={e => setNewProjStyle(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>世界观核心设定</label>
                <textarea className="textarea" placeholder="力量等级、地理面貌、核心法则..." value={newProjWorld} onChange={e => setNewProjWorld(e.target.value)} />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowNewProjModal(false)}>取消</button>
              <button type="submit" className="btn btn-primary">确定创建</button>
            </div>
          </form>
        </div>
      )}

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
    </main>
  );
}
