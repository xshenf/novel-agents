'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Save, Loader2, Eye, Edit3, Plus, Trash2, ArrowUp, ArrowDown, User, Activity, Key, BookOpen, Check, X, Tag, Lock, Unlock, Sparkles, Compass, Flame, Zap, Award, Trophy, CheckCircle2, ChevronUp, ChevronDown, ChevronRight, Search, Undo2, Redo2 } from 'lucide-react';
import { useWorkspace } from '../workspace-context';
import { useAiClient } from '../hooks/useAiClient';
import { createVersionSnapshot } from '@/lib/versionSnapshot';
import { KernelDimensionCard } from './KernelDimensionCard';
import { CharacterCard, AddCharacterCard, WorldRuleCard, AddWorldRuleCard } from './AssetCards';
import { DEFAULT_ANTI_AI_RULES } from '@/lib/rules';

interface OutlineChapter {
  title: string;
  content: string;
  details: { key: string; value: string }[];
  isLocked?: boolean;
}

interface OutlineVolume {
  title: string;
  content: string;
  chapters: OutlineChapter[];
  isLocked?: boolean;
}

// 智能大纲解析器，提取分卷（一级标题 # ）与章节（二级标题 ## ）和锁定状态标记
function parseStructureOutline(text: string): OutlineVolume[] {
  if (!text) return [];
  const volumes: OutlineVolume[] = [];
  let currentVolume: OutlineVolume | null = null;
  let currentChapter: OutlineChapter | null = null;

  const lines = text.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^#[^#]/.test(trimmed)) {
      // 匹配一级标题作为分卷
      let titleText = trimmed.replace(/^#\s+/, '').trim();
      let isLocked = false;
      if (titleText.includes('<!-- LOCKED -->') || titleText.includes('[LOCKED]')) {
        isLocked = true;
        titleText = titleText.replace('<!-- LOCKED -->', '').replace('[LOCKED]', '').trim();
      }
      currentVolume = {
        title: titleText || '新分卷',
        content: '',
        chapters: [],
        isLocked
      };
      volumes.push(currentVolume);
      currentChapter = null; // 切换分卷，清除上一章缓存
    } else if (trimmed.startsWith('##')) {
      // 匹配二级标题作为章节细纲
      let titleText = trimmed.replace(/^##\s+/, '').trim();
      let isLocked = false;
      if (titleText.includes('<!-- LOCKED -->') || titleText.includes('[LOCKED]')) {
        isLocked = true;
        titleText = titleText.replace('<!-- LOCKED -->', '').replace('[LOCKED]', '').trim();
      }
      currentChapter = {
        title: titleText || '新章节',
        content: '',
        details: [],
        isLocked
      };
      
      // 如果大纲一上来就是章节标题，隐式为其创建一个默认正文卷
      if (!currentVolume) {
        currentVolume = {
          title: '第一卷：正文',
          content: '全局默认分卷',
          chapters: []
        };
        volumes.push(currentVolume);
      }
      currentVolume.chapters.push(currentChapter);
    } else {
      // 解析非标题行
      if (currentChapter) {
        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          // 匹配卡片键值对，例如: "- **核心冲突**：xxx"
          const kvMatch = trimmed.match(/^[\-\*]\s+(?:\*\*(.*?)\*\*|([^：:]+))[：:](.*)$/);
          if (kvMatch) {
            const key = (kvMatch[1] || kvMatch[2]).trim();
            const value = kvMatch[3].trim();
            currentChapter.details.push({ key, value });
          } else {
            currentChapter.content += (currentChapter.content ? '\n' : '') + trimmed.replace(/^[\-\*]\s+/, '');
          }
        } else {
          currentChapter.content += (currentChapter.content ? '\n' : '') + trimmed;
        }
      } else if (currentVolume) {
        currentVolume.content += (currentVolume.content ? '\n' : '') + trimmed;
      }
    }
  }

  // 兜底保障：如果没有解析到任何分卷，尝试隐式补充一个正文卷
  if (volumes.length === 0) {
    volumes.push({
      title: '第一卷：正文',
      content: '全局默认分卷',
      chapters: []
    });
  }

  return volumes;
}

// 将树状的分卷-章节结构重新序列化编译成规整的 Markdown 文本，并携带锁定标记
function generateMarkdownFromSections(volumes: OutlineVolume[]): string {
  return volumes.map(vol => {
    let part = `# ${vol.title}${vol.isLocked ? ' <!-- LOCKED -->' : ''}\n`;
    if (vol.content && vol.content.trim()) {
      part += `${vol.content.trim()}\n`;
    }
    vol.chapters.forEach(sec => {
      part += `\n## ${sec.title}${sec.isLocked ? ' <!-- LOCKED -->' : ''}\n`;
      if (sec.content && sec.content.trim()) {
        part += `${sec.content.trim()}\n`;
      }
      sec.details.forEach(det => {
        if (det.key.trim() && det.value.trim()) {
          part += `- **${det.key.trim()}**：${det.value.trim()}\n`;
        }
      });
    });
    return part;
  }).join('\n\n');
}

// 将数字转换为中文章节/卷序号
function getChineseNumber(num: number): string {
  const chineseNumbers = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
  if (num <= 20) return chineseNumbers[num];
  if (num < 100) {
    const tens = Math.floor(num / 10);
    const units = num % 10;
    if (units === 0) return `${chineseNumbers[tens]}十`;
    return `${chineseNumbers[tens]}十${chineseNumbers[units]}`;
  }
  return String(num);
}

// 自动对卷名和章节标题做多级层级化自动重排
function renumberVolumesAndChapters(volumes: OutlineVolume[]): OutlineVolume[] {
  let volIdx = 1;
  let chapIdx = 1;
  
  return volumes.map((vol, vIdx) => {
    const currentVolTitle = vol.title;
    const volMatch = currentVolTitle.match(/^(?:第[一二三四五六七八九十百\d]+卷[：:\s\-]*)(.*)$/);
    const remainingVolTitle = volMatch ? volMatch[1].trim() : currentVolTitle;
    
    // 过滤导言类非正文卷
    const isIntro = vIdx === 0 && (remainingVolTitle.includes('导言') || remainingVolTitle.includes('前言') || remainingVolTitle.includes('简介') || remainingVolTitle === '正文');
    const volTitle = isIntro ? remainingVolTitle : `第${getChineseNumber(volIdx)}卷：${remainingVolTitle || '新分卷'}`;
    if (!isIntro) volIdx++;

    const newChapters = vol.chapters.map((sec) => {
      const currentTitle = sec.title;
      const titleMatch = currentTitle.match(/^(?:第[一二三四五六七八九十百\d]+章[：:\s\-]*)(.*)$/);
      const remainingTitle = titleMatch ? titleMatch[1].trim() : currentTitle;
      
      const chapNum = getChineseNumber(chapIdx);
      chapIdx++;
      return {
        ...sec,
        title: `第${chapNum}章：${remainingTitle || '新章节'}`
      };
    });

    return {
      ...vol,
      title: volTitle,
      chapters: newChapters
    };
  });
}

// 提取章节包含的登场角色列表
function parseCharacters(details: { key: string; value: string }[]): string[] {
  const charDetail = details.find(d => d.key.includes('人物') || d.key.includes('角色'));
  if (!charDetail) return [];
  return charDetail.value
    .split(/[,，、\/\\\s\+]+/)
    .map(c => c.trim())
    .filter(c => c.length > 0 && c !== '主角' && c !== '配角');
}

// 定量化章节情绪曲线值
function parseEmotionValue(details: { key: string; value: string }[]): number {
  const emoDetail = details.find(d => d.key.includes('情绪') || d.key.includes('起伏') || d.key.includes('曲线'));
  if (!emoDetail) return 50;
  const val = emoDetail.value;
  const match = val.match(/(\d+)%/);
  if (match) return parseInt(match[1], 10);
  
  if (val.includes('高潮') || val.includes('爽') || val.includes('燃') || val.includes('沸腾') || val.includes('爆发')) return 90;
  if (val.includes('逆袭') || val.includes('打脸') || val.includes('反击') || val.includes('爽快')) return 80;
  if (val.includes('冲突') || val.includes('危机') || val.includes('交锋') || val.includes('博弈')) return 70;
  if (val.includes('铺垫') || val.includes('悬念') || val.includes('伏笔')) return 60;
  if (val.includes('日常') || val.includes('平稳') || val.includes('轻松') || val.includes('温馨')) return 50;
  if (val.includes('压抑') || val.includes('绝境') || val.includes('低谷') || val.includes('困难')) return 25;
  return 50;
}

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

  const [viewMode, setViewMode] = useState<'structure' | 'editor'>('structure');
  
  // 核心切换 Tab：整合大纲与设定子页签
  const [outlineSubTab, setOutlineSubTab] = useState<'kernel' | 'volume' | 'chapter' | 'assets'>('kernel');
  const [activeMaterial, setActiveMaterial] = useState<string>('worldSetting');
  const [outlineSearchQuery, setOutlineSearchQuery] = useState('');
  const [collapsedVolumes, setCollapsedVolumes] = useState<Record<number, boolean>>({});

  // 当选择素材磁贴时的统一控制函数
  const handleSelectMaterial = (material: string) => {
    setActiveMaterial(material);
    if (material === 'outline') {
      setOutlineSubTab('volume');
    } else if (material === 'chapter') {
      setOutlineSubTab('chapter');
    } else if ([
      'character', 'location', 'faction', 'item', 'currency', 
      'skillSystem', 'relation', 'foreshadow', 'plot', 'subPlot', 
      'timeline', 'events'
    ].includes(material)) {
      setOutlineSubTab('assets');
    } else {
      setOutlineSubTab('kernel');
    }
  };

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

  const materialsList = [
    { id: 'worldSetting', label: '世界观设定', icon: Compass, color: '#38bdf8' },
    { id: 'coreConflict', label: '故事核心', icon: Activity, color: '#f43f5e' },
    { id: 'location', label: '地理地图', icon: BookOpen, color: '#10b981' },
    { id: 'faction', label: '势力阵营', icon: User, color: '#a855f7' },
    { id: 'currency', label: '货币体系', icon: Tag, color: '#eab308' },
    { id: 'item', label: '物品列表', icon: Zap, color: '#3b82f6' },
    { id: 'powerSystem', label: '力量体系', icon: Flame, color: '#f97316' },
    { id: 'skillSystem', label: '功法体系', icon: Award, color: '#ec4899' },
    { id: 'specialSetting', label: '特殊设定', icon: Lock, color: '#14b8a6' },
    { id: 'outline', label: '大纲设定', icon: BookOpen, color: '#6366f1' },
    { id: 'character', label: '角色管理', icon: User, color: '#06b6d4' },
    { id: 'relation', label: '人物关系图', icon: Activity, color: '#84cc16' },
    { id: 'foreshadow', label: '伏笔管理', icon: Key, color: '#f59e0b' },
    { id: 'plot', label: '情节脉络', icon: Trophy, color: '#ef4444' },
    { id: 'subPlot', label: '支线故事', icon: Compass, color: '#8b5cf6' },
    { id: 'timeline', label: '时间线', icon: Activity, color: '#06b6d4' },
    { id: 'chapter', label: '章节细纲', icon: BookOpen, color: '#10b981' },
    { id: 'events', label: '已经历事件', icon: CheckCircle2, color: '#22c55e' }
  ];
  
  // 树状大纲核心缓存状态
  const [localSections, setLocalSections] = useState<OutlineVolume[]>([]);
  
  // 分卷行内编辑控制
  const [editingVolumeIdx, setEditingVolumeIdx] = useState<number | null>(null);
  const [editVolumeForm, setEditVolumeForm] = useState<OutlineVolume | null>(null);
  
  // 章节行内编辑控制
  const [editingChapterPath, setEditingChapterPath] = useState<{ volIdx: number; chapIdx: number } | null>(null);
  const [editChapterForm, setEditChapterForm] = useState<OutlineChapter | null>(null);
  
  // AI 局部生成状态反馈
  const [regeningIndex, setRegeningIndex] = useState<number | null>(null);
  const [regeningVolumeIdx, setRegeningVolumeIdx] = useState<number | null>(null);
  const [regeningField, setRegeningField] = useState<string | null>(null);
  
  // AI 推演用户输入状态
  const [aiPromptVolIdx, setAiPromptVolIdx] = useState<number | null>(null);
  const [aiPromptText, setAiPromptText] = useState('');
  
  // AI 推演撤销历史栈（支持多次撤销）
  const [aiUndoStack, setAiUndoStack] = useState<{
    type: 'volume' | 'chapter' | 'macro';
    label: string;
    restore: () => void;
  }[]>([]);

  // 推入新的撤销记录（清空旧的"未来"）
  const pushAiUndo = (entry: { type: 'volume' | 'chapter' | 'macro'; label: string; restore: () => void }) => {
    setAiUndoStack(prev => [...prev, entry]);
  };

  // 撤销最近一次
  const undoLastAiRegen = () => {
    setAiUndoStack(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      last.restore();
      return prev.slice(0, -1);
    });
  };

  // 丢弃最近一次
  const dismissLastAiUndo = () => {
    setAiUndoStack(prev => prev.slice(0, -1));
  };

  // 清空所有
  const clearAiUndo = () => setAiUndoStack([]);

  // AI 推演 AbortController（用于取消）
  const aiAbortRef = useRef<AbortController | null>(null);
  const cancelAiRegen = () => {
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    setRegeningVolumeIdx(null);
    setRegeningIndex(null);
    setRegeningField(null);
  };
  
  // UI 关联性交互状态
  const [selectedChar, setSelectedChar] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [selectedVolumeIdx, setSelectedVolumeIdx] = useState<number | null>(null);

  // 初始化反序列化 Markdown 文本
  useEffect(() => {
    if (editingChapterPath === null && editingVolumeIdx === null) {
      setLocalSections(parseStructureOutline(tempOutlineFull));
      clearAiUndo();
    }
  }, [tempOutlineFull, editingChapterPath, editingVolumeIdx]);

  // 大纲自动保存：tempOutlineFull 变化时 debounce 2s 保存
  const outlineSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const prevOutlineRef = useRef(tempOutlineFull);
  useEffect(() => {
    // 跳过初始化和项目切换时的保存
    if (tempOutlineFull === prevOutlineRef.current) return;
    prevOutlineRef.current = tempOutlineFull;
    if (!store.currentProject) return;
    if (outlineSaveTimer.current) clearTimeout(outlineSaveTimer.current);
    outlineSaveTimer.current = setTimeout(async () => {
      try {
        await store.updateProject(store.currentProject!.id, { outlineFull: tempOutlineFull });
        createVersionSnapshot({
          projectId: store.currentProject!.id,
          type: 'outline',
          key: 'outlineFull',
          label: '分卷主线大纲',
          data: tempOutlineFull,
          source: 'auto',
        });
      } catch { /* ignore auto-save errors */ }
    }, 2000);
    return () => { if (outlineSaveTimer.current) clearTimeout(outlineSaveTimer.current); };
  }, [tempOutlineFull]);

  // 宏观设定自动保存：任一设定字段变化时 debounce 2s 保存
  const macroSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const prevMacroRef = useRef({ tempStyleSetting, tempWorldSetting, tempPowerSystem, tempGoldFinger, tempCoreConflict, tempFactionsMap, tempSellingPoints });
  useEffect(() => {
    const prev = prevMacroRef.current;
    const curr = { tempStyleSetting, tempWorldSetting, tempPowerSystem, tempGoldFinger, tempCoreConflict, tempFactionsMap, tempSellingPoints };
    if (JSON.stringify(prev) === JSON.stringify(curr)) return;
    prevMacroRef.current = curr;
    if (!store.currentProject) return;
    if (macroSaveTimer.current) clearTimeout(macroSaveTimer.current);
    macroSaveTimer.current = setTimeout(async () => {
      try {
        await store.updateProject(store.currentProject!.id, {
          styleSetting: tempStyleSetting,
          worldSetting: tempWorldSetting,
          powerSystem: tempPowerSystem,
          goldFinger: tempGoldFinger,
          coreConflict: tempCoreConflict,
          factionsMap: tempFactionsMap,
          sellingPoints: tempSellingPoints,
        });
        createVersionSnapshot({
          projectId: store.currentProject!.id,
          type: 'macro',
          key: 'macro',
          label: '核心设定',
          data: { styleSetting: tempStyleSetting, worldSetting: tempWorldSetting, powerSystem: tempPowerSystem, goldFinger: tempGoldFinger, coreConflict: tempCoreConflict, factionsMap: tempFactionsMap, sellingPoints: tempSellingPoints },
          source: 'auto',
        });
      } catch { /* ignore auto-save errors */ }
    }, 2000);
    return () => { if (macroSaveTimer.current) clearTimeout(macroSaveTimer.current); };
  }, [tempStyleSetting, tempWorldSetting, tempPowerSystem, tempGoldFinger, tempCoreConflict, tempFactionsMap, tempSellingPoints]);

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

  // 计算节奏折线图点位
  const points = flatChapters.map((sec, i) => {
    const val = parseEmotionValue(sec.details);
    const x = flatChapters.length > 1 ? 50 + (i / (flatChapters.length - 1)) * 700 : 400;
    const y = 80 - (val / 100) * 60;
    return { x, y, val, title: sec.title, idx: i, volIdx: sec.volIdx, chapIdx: sec.chapIdx };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x} 95 L ${points[0].x} 95 Z` 
    : '';

  // 添加新分卷
  const handleInsertVolume = (volIdx: number) => {
    const newVol: OutlineVolume = {
      title: '新分卷',
      content: '规划本分卷的剧烈矛盾、转折爆发与核心高潮走向...',
      chapters: []
    };
    const newSections = [...localSections];
    newSections.splice(volIdx + 1, 0, newVol);
    const renumbered = renumberVolumesAndChapters(newSections);
    setLocalSections(renumbered);
    const md = generateMarkdownFromSections(renumbered);
    setTempOutlineFull(md);
  };

  // 删除分卷
  const handleDeleteVolume = (volIdx: number) => {
    if (!confirm('确定要删除该分卷吗？删除分卷会连同删除该分卷下的所有章节！')) return;
    const newSections = [...localSections];
    newSections.splice(volIdx, 1);
    const renumbered = renumberVolumesAndChapters(newSections);
    setLocalSections(renumbered);
    const md = generateMarkdownFromSections(renumbered);
    setTempOutlineFull(md);
    if (editingVolumeIdx === volIdx) {
      setEditingVolumeIdx(null);
      setEditVolumeForm(null);
    }
  };

  // 分卷位置上下移位
  const handleMoveVolume = (volIdx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && volIdx === 0) return;
    if (direction === 'down' && volIdx === localSections.length - 1) return;
    
    const targetIdx = direction === 'up' ? volIdx - 1 : volIdx + 1;
    const newSections = [...localSections];
    const temp = newSections[volIdx];
    newSections[volIdx] = newSections[targetIdx];
    newSections[targetIdx] = temp;
    
    const renumbered = renumberVolumesAndChapters(newSections);
    setLocalSections(renumbered);
    const md = generateMarkdownFromSections(renumbered);
    setTempOutlineFull(md);
  };

  // 切换分卷的锁定标记
  const toggleLockVolume = (volIdx: number) => {
    const newSections = localSections.map((vol, vIdx) =>
      vIdx === volIdx ? { ...vol, isLocked: !vol.isLocked } : vol
    );
    setLocalSections(newSections);
    const md = generateMarkdownFromSections(newSections);
    setTempOutlineFull(md);
  };

  // 保存分卷大纲修改
  const saveVolumeEditing = () => {
    if (editingVolumeIdx === null || !editVolumeForm) return;
    const newSections = [...localSections];
    newSections[editingVolumeIdx] = editVolumeForm;
    
    const renumbered = renumberVolumesAndChapters(newSections);
    setLocalSections(renumbered);
    const md = generateMarkdownFromSections(renumbered);
    setTempOutlineFull(md);
    
    setEditingVolumeIdx(null);
    setEditVolumeForm(null);
  };

  // 插入章节细纲
  const handleInsertChapter = (volIdx: number, chapIdx: number) => {
    const newSec: OutlineChapter = {
      title: '新章节',
      content: '本章具体发生的剧情细节交代，核心博弈走向...',
      details: [
        { key: '核心冲突', value: '本章的具体纠葛' },
        { key: '信息释放', value: '揭示的内容或埋藏伏笔' },
        { key: '情绪曲线', value: '铺垫(45%)' },
        { key: '相关人物', value: '主角' }
      ]
    };
    const insertIdx = chapIdx < 0 ? localSections[volIdx].chapters.length : chapIdx + 1;
    const newSections = localSections.map((vol, vIdx) => {
      if (vIdx !== volIdx) return vol;
      const newChapters = [...vol.chapters];
      newChapters.splice(insertIdx, 0, newSec);
      return { ...vol, chapters: newChapters };
    });
    const renumbered = renumberVolumesAndChapters(newSections);
    setLocalSections(renumbered);
    const md = generateMarkdownFromSections(renumbered);
    setTempOutlineFull(md);
  };

  // 删除某章细纲
  const handleDeleteChapter = (volIdx: number, chapIdx: number) => {
    if (!confirm('确定要删除本章节大纲吗？此后序号会自动全书重新递增。')) return;
    const newSections = localSections.map((vol, vIdx) => {
      if (vIdx !== volIdx) return vol;
      const newChapters = [...vol.chapters];
      newChapters.splice(chapIdx, 1);
      return { ...vol, chapters: newChapters };
    });
    const renumbered = renumberVolumesAndChapters(newSections);
    setLocalSections(renumbered);
    const md = generateMarkdownFromSections(renumbered);
    setTempOutlineFull(md);
    if (editingChapterPath && editingChapterPath.volIdx === volIdx && editingChapterPath.chapIdx === chapIdx) {
      setEditingChapterPath(null);
      setEditChapterForm(null);
    }
  };

  // 章节位置上下移位
  const handleMoveChapter = (volIdx: number, chapIdx: number, direction: 'up' | 'down') => {
    const chapters = localSections[volIdx].chapters;
    if (direction === 'up' && chapIdx === 0) return;
    if (direction === 'down' && chapIdx === chapters.length - 1) return;
    
    const targetIdx = direction === 'up' ? chapIdx - 1 : chapIdx + 1;
    const newSections = localSections.map((vol, vIdx) => {
      if (vIdx !== volIdx) return vol;
      const newChapters = [...vol.chapters];
      const temp = newChapters[chapIdx];
      newChapters[chapIdx] = newChapters[targetIdx];
      newChapters[targetIdx] = temp;
      return { ...vol, chapters: newChapters };
    });
    
    const renumbered = renumberVolumesAndChapters(newSections);
    setLocalSections(renumbered);
    const md = generateMarkdownFromSections(renumbered);
    setTempOutlineFull(md);
  };

  // 切换章节锁定标记
  const toggleLockChapter = (volIdx: number, chapIdx: number) => {
    const newSections = localSections.map((vol, vIdx) => {
      if (vIdx !== volIdx) return vol;
      const newChapters = vol.chapters.map((ch, cIdx) =>
        cIdx === chapIdx ? { ...ch, isLocked: !ch.isLocked } : ch
      );
      return { ...vol, chapters: newChapters };
    });
    setLocalSections(newSections);
    const md = generateMarkdownFromSections(newSections);
    setTempOutlineFull(md);
  };

  // 保存章节大纲修改
  const saveChapterEditing = () => {
    if (editingChapterPath === null || !editChapterForm) return;
    const { volIdx, chapIdx } = editingChapterPath;
    const newSections = localSections.map((vol, vIdx) => {
      if (vIdx !== volIdx) return vol;
      const newChapters = [...vol.chapters];
      newChapters[chapIdx] = editChapterForm;
      return { ...vol, chapters: newChapters };
    });
    
    const renumbered = renumberVolumesAndChapters(newSections);
    setLocalSections(renumbered);
    const md = generateMarkdownFromSections(renumbered);
    setTempOutlineFull(md);
    
    setEditingChapterPath(null);
    setEditChapterForm(null);
  };

  // 选用推荐大纲时执行层次化智能合并
  const handleSelectRecommendedOutline = async (opt: any) => {
    const optDesc = opt.description || '';
    const newSections = parseStructureOutline(optDesc);
    const oldSections = localSections;

    // 智能锁定合并：打平旧大纲包含的所有章节，保留锁定态与其归属卷索引
    const oldFlat: (OutlineChapter & { volIdx: number })[] = [];
    oldSections.forEach((vol, vIdx) => {
      vol.chapters.forEach(ch => {
        oldFlat.push({ ...ch, volIdx: vIdx });
      });
    });

    const newFlat: OutlineChapter[] = [];
    newSections.forEach(vol => {
      vol.chapters.forEach(ch => {
        newFlat.push(ch);
      });
    });

    // 交叉合并
    const mergedFlat: (OutlineChapter & { volIdx?: number })[] = newFlat.map((newCh, idx) => {
      const oldCh = oldFlat[idx];
      if (oldCh && oldCh.isLocked) {
        return oldCh;
      }
      return newCh;
    });

    // 追加保留多余章节里已被锁定的
    if (oldFlat.length > newFlat.length) {
      for (let i = newFlat.length; i < oldFlat.length; i++) {
        if (oldFlat[i].isLocked) {
          mergedFlat.push(oldFlat[i]);
        }
      }
    }

    // 恢复树状层级：清空旧大纲章节并回填
    const mergedVolumes: OutlineVolume[] = oldSections.map(vol => ({
      ...vol,
      chapters: []
    }));

    mergedFlat.forEach(ch => {
      let targetVolIdx = ch.volIdx !== undefined ? ch.volIdx : mergedVolumes.length - 1;
      // 如果目标卷索引超出已有分卷范围，追加新分卷
      while (targetVolIdx >= mergedVolumes.length) {
        mergedVolumes.push({
          title: '新分卷',
          content: '',
          chapters: []
        });
      }
      if (targetVolIdx < 0) {
        targetVolIdx = 0;
      }
      mergedVolumes[targetVolIdx].chapters.push({
        title: ch.title,
        content: ch.content,
        details: ch.details,
        isLocked: ch.isLocked
      });
    });

    const renumbered = renumberVolumesAndChapters(mergedVolumes);
    setLocalSections(renumbered);
    const md = generateMarkdownFromSections(renumbered);
    setTempOutlineFull(md);

    if (store.currentProject) {
      try {
        await store.updateProject(store.currentProject.id, { outlineFull: md });
        alert('已选用新推荐大纲并完成层次合并，锁定的章节和大纲卷归属已完好保留！');
      } catch (e) {
        alert('推荐大纲合并保存失败');
      }
    }
  };

  // AI 智能重写单章 Beat
  const handleAiRegenChapter = async (volIdx: number, chapIdx: number) => {
    if (!store.currentProject) return;
    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;
    const globalIdx = flatChapters.findIndex(ch => ch.volIdx === volIdx && ch.chapIdx === chapIdx);
    setRegeningIndex(globalIdx);
    try {
      const sec = localSections[volIdx].chapters[chapIdx];
      const prompt = `你是一个资深网络小说剧情策划。请为我的小说《${store.currentProject.title}》重新规划设计【${sec.title}】的详细章节细纲。

【当前小说设定】:
- 书名: ${store.currentProject.title}
- 简介: ${tempWorldSetting || store.currentProject.worldSetting || '暂无'}
- 题材/核心冲突: ${tempCoreConflict || store.currentProject.coreConflict || '暂无'}

【其他相邻章节的上下文大纲】:
${flatChapters.map((s, sIdx) => sIdx !== globalIdx ? `- ${s.title}: ${s.content}` : '').filter(Boolean).slice(Math.max(0, globalIdx - 2), globalIdx + 3).join('\n')}

请详细为本章设计新的剧情细纲。必须以如下格式直接输出，不要输出任何多余的引言、前言或分析解释：
## ${sec.title}
本章剧情推进：在此处写一小段对本章核心故事情节的叙述，约100字。
- **核心冲突**：本章内具体的矛盾博弈或突发争执。
- **信息释放**：本章中交代泄漏的新伏笔或解开的旧秘密。
- **情绪曲线**：从压抑到爽快的情绪过渡比，如：高潮(85%)。
- **相关人物**：本章出场的角色名。`;

      const res = await callAIApi({
        action: 'chat',
        projectId: store.currentProject.id,
        query: prompt
      }, controller.signal);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const reply = data.reply;
      const parsedRegen = parseStructureOutline(reply);
      // 从解析结果中查找第一个章节（可能位于任意分卷中）
      let newCh: OutlineChapter | null = null;
      for (const vol of parsedRegen) {
        if (vol.chapters.length > 0) {
          newCh = vol.chapters[0];
          break;
        }
      }
      if (newCh) {
        const mergedCh = {
          ...newCh,
          title: sec.title,
          isLocked: sec.isLocked
        };
        const newSections = localSections.map((vol, vIdx) => {
          if (vIdx !== volIdx) return vol;
          const newChapters = [...vol.chapters];
          newChapters[chapIdx] = mergedCh;
          return { ...vol, chapters: newChapters };
        });

        const md = generateMarkdownFromSections(newSections);
        setLocalSections(newSections);
        setTempOutlineFull(md);
        pushAiUndo({
          type: 'chapter',
          label: sec.title,
          restore: () => {
            const prevSections = localSections.map((vol, vIdx) => {
              if (vIdx !== volIdx) return vol;
              const prevChapters = [...vol.chapters];
              prevChapters[chapIdx] = sec;
              return { ...vol, chapters: prevChapters };
            });
            setLocalSections(prevSections);
            setTempOutlineFull(generateMarkdownFromSections(prevSections));
          }
        });
      } else {
        throw new Error('AI 生成的章节大纲格式有误，未能成功解析');
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        alert('AI 单章重写失败: ' + e.message);
      }
    } finally {
      if (aiAbortRef.current === controller) {
        aiAbortRef.current = null;
        setRegeningIndex(null);
      }
    }
  };

  // AI 推演分卷走向大纲
  const handleAiRegenVolume = async (volIdx: number, userHint?: string) => {
    if (!store.currentProject) return;
    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;
    setRegeningVolumeIdx(volIdx);
    try {
      const vol = localSections[volIdx];
      const userHintSection = userHint?.trim()
        ? `\n\n【用户对本卷的推演要求】：\n${userHint.trim()}\n请在推演时充分考虑以上要求。`
        : '';
      const prompt = `你是一个网络小说金牌策划和商业剧情架构大师。请为我的小说《${store.currentProject.title}》推演和重新设计【${vol.title}】的整体剧情大纲走向与本卷核心看点。

【当前小说设定】:
- 书名: ${store.currentProject.title}
- 核心冲突: ${tempCoreConflict || store.currentProject.coreConflict || '暂无描述'}
- 世界观: ${tempWorldSetting || store.currentProject.worldSetting || '暂无'}
- 境界体系: ${tempPowerSystem || store.currentProject.powerSystem || '暂无'}

【其他分卷的上下文大纲】:
${localSections.map((v, vIdx) => vIdx !== volIdx ? `- ${v.title}: ${v.content}` : '').filter(Boolean).join('\n')}
${userHintSection}
请直接输出推荐的【${vol.title}】的卷概要走向描述（字数在150字到250字之间），不需要输出任何标题、多余的说明前言或分析，直接给出描述即可。`;

      const res = await callAIApi({
        action: 'chat',
        projectId: store.currentProject.id,
        query: prompt
      }, controller.signal);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const reply = data.reply.trim();
      if (reply) {
        const newSections = localSections.map((v, vIdx) =>
          vIdx === volIdx ? { ...v, content: reply } : v
        );
        setLocalSections(newSections);
        const md = generateMarkdownFromSections(newSections);
        setTempOutlineFull(md);
        pushAiUndo({
          type: 'volume',
          label: vol.title,
          restore: () => {
            const prevSections = localSections.map((v, vIdx) =>
              vIdx === volIdx ? { ...v, content: vol.content } : v
            );
            setLocalSections(prevSections);
            setTempOutlineFull(generateMarkdownFromSections(prevSections));
          }
        });
      } else {
        throw new Error('AI 未能返回有效的生成数据');
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        alert(`AI 推演分卷走向失败: ` + e.message);
      }
    } finally {
      if (aiAbortRef.current === controller) {
        aiAbortRef.current = null;
        setRegeningVolumeIdx(null);
      }
    }
  };

  // 计算大纲卷章统计
  const totalChapters = localSections.reduce((sum, vol) => sum + (vol.chapters ? vol.chapters.length : 0), 0);
  const lockedChapters = localSections.reduce((sum, vol) => sum + (vol.chapters ? vol.chapters.filter(ch => ch.isLocked).length : 0), 0);
  const completionRate = totalChapters > 0 ? Math.round((lockedChapters / totalChapters) * 100) : 0;

  const getFilteredRules = (material: string) => {
    if (!store.worldRules) return [];
    
    if (material === 'location') return store.worldRules.filter(r => r.type === 'location');
    if (material === 'faction') return store.worldRules.filter(r => r.type === 'faction');
    if (material === 'item') return store.worldRules.filter(r => r.type === 'item');
    
    if (material === 'currency') return store.worldRules.filter(r => r.type === 'rule' && r.name.includes('货币'));
    if (material === 'skillSystem') return store.worldRules.filter(r => r.type === 'rule' && (r.name.includes('功法') || r.name.includes('技能') || r.name.includes('修炼') || r.name.includes('体系')));
    if (material === 'timeline') return store.worldRules.filter(r => r.type === 'rule' && r.name.includes('时间线'));
    
    if (material === 'foreshadow') return store.worldRules.filter(r => r.type === 'other' && r.name.includes('伏笔'));
    if (material === 'plot') return store.worldRules.filter(r => r.type === 'other' && (r.name.includes('情节') || r.name.includes('脉络')));
    if (material === 'subPlot') return store.worldRules.filter(r => r.type === 'other' && r.name.includes('支线'));
    if (material === 'events') return store.worldRules.filter(r => r.type === 'other' && r.name.includes('事件'));
    if (material === 'relation') return store.worldRules.filter(r => r.type === 'other' && r.name.includes('关系'));
    
    return store.worldRules;
  };

  return (
    <div style={{ display: 'flex', flex: '1', minHeight: 0, overflow: 'hidden', position: 'relative' }}>
      {/* 左侧世界素材 18 宫格侧边栏 */}
      <div style={{
        width: '320px',
        background: 'rgba(15, 15, 22, 0.4)',
        borderRight: '1px solid var(--border-light)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        gap: '16px',
        flexShrink: 0,
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', margin: 0 }}>世界设定</h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>管理小说的世界观、角色关系和剧情时间线</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>世界素材</span>
          <button
            onClick={() => {
              if (['location', 'faction', 'item', 'currency', 'skillSystem', 'timeline', 'foreshadow', 'plot', 'subPlot', 'events', 'relation'].includes(activeMaterial)) {
                setIsAddingRule(true);
              } else if (activeMaterial === 'character') {
                setIsAddingChar(true);
              } else {
                handleSelectMaterial('character');
                setIsAddingChar(true);
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px'
            }}
          >
            <Plus size={16} />
          </button>
        </div>

        {/* 18宫格磁贴网格 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '10px',
          marginTop: '4px'
        }}>
          {materialsList.map(item => {
            const isSelected = activeMaterial === item.id;
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectMaterial(item.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '12px',
                  height: '80px',
                  background: isSelected ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                  border: isSelected ? `1px solid ${item.color}` : '1px solid rgba(255, 255, 255, 0.04)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? `0 0 12px ${item.color}25` : 'none',
                  outline: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.04)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.01)';
                  }
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  background: `${item.color}15`,
                  color: item.color
                }}>
                  <IconComponent size={16} />
                </div>
                <span style={{
                  fontSize: '12px',
                  fontWeight: isSelected ? '600' : 'normal',
                  color: isSelected ? '#fff' : 'var(--text-muted)',
                  marginTop: '8px'
                }}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

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
        {/* 1. 核心设定维度 (worldSetting, coreConflict, powerSystem, specialSetting) */}
        {['worldSetting', 'coreConflict', 'powerSystem', 'specialSetting'].includes(activeMaterial) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '30px', minHeight: 0, overflowY: 'auto', flexGrow: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: 0 }}>
                  {materialsList.find(m => m.id === activeMaterial)?.label}
                </h4>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {activeMaterial === 'worldSetting' && "定义小说主舞台的大陆疆域、宏观规则、历史背景与社会法则"}
                  {activeMaterial === 'coreConflict' && "推动小说主线发展的主要矛盾，以及网文吸引读者的爽点卖点设计"}
                  {activeMaterial === 'powerSystem' && "定义主角及世界的修炼境界、超自然等级，以及主角的特殊外挂金手指设定"}
                  {activeMaterial === 'specialSetting' && "小说的体裁定位、情感基调偏好，以及绑定写作模型时的反 AI 底层约束"}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1 }}>
              {activeMaterial === 'worldSetting' && (
                <KernelDimensionCard
                  cardKey="worldSetting"
                  title="核心世界观背景描述"
                  subtitle="定义小说主舞台的大陆疆域、宏观规则、历史背景与微观社会法则"
                  value={tempWorldSetting}
                  setValue={setTempWorldSetting}
                  cardType="worldSetting"
                  placeholder="例如：一个灵气衰退的仙侠世界，修行者寿元大减，凡人建立的机械帝国与修士宗门共存..."
                  alwaysExpanded={true}
                />
              )}

              {activeMaterial === 'coreConflict' && (
                <>
                  <KernelDimensionCard
                    cardKey="coreConflict"
                    title="核心矛盾与冲突线"
                    subtitle="推动小说主线发展的主要矛盾，以及主角面临的终极敌对势力或危机"
                    value={tempCoreConflict}
                    setValue={setTempCoreConflict}
                    cardType="coreConflict"
                    placeholder="例如：真仙下凡灭族之仇，或是主角身上的天劫诅咒，需不断打破封印..."
                    alwaysExpanded={true}
                  />
                  <KernelDimensionCard
                    cardKey="sellingPoints"
                    title="爽点与核心卖点"
                    subtitle="网文吸引读者的商业爽点，如打脸、越级挑战、幕后黑手等节奏设计"
                    value={tempSellingPoints}
                    setValue={setTempSellingPoints}
                    cardType="sellingPoints"
                    placeholder="例如：扮猪吃老虎，极限反杀，创建宗门幕后操控世界流派..."
                    alwaysExpanded={true}
                  />
                </>
              )}

              {activeMaterial === 'powerSystem' && (
                <>
                  <KernelDimensionCard
                    cardKey="powerSystem"
                    title="境界与力量体系"
                    subtitle="定义主角及世界的修炼境界、超自然等级与晋升逻辑"
                    value={tempPowerSystem}
                    setValue={setTempPowerSystem}
                    cardType="powerSystem"
                    placeholder="例如：练气、筑基、金丹、元婴、化神..."
                    alwaysExpanded={true}
                  />
                  <KernelDimensionCard
                    cardKey="goldFinger"
                    title="金手指设定"
                    subtitle="主角的特殊外挂、系统、随身宝物或独占机缘"
                    value={tempGoldFinger}
                    setValue={setTempGoldFinger}
                    cardType="goldFinger"
                    placeholder="例如：可以复制万物的神秘古镜，或者属性加点的诸天面板..."
                    alwaysExpanded={true}
                  />
                </>
              )}

              {activeMaterial === 'specialSetting' && (
                <>
                  <KernelDimensionCard
                    cardKey="styleSetting"
                    title="小说文风与题材基调"
                    subtitle="定义小说的体裁定位、情感色调与写作偏好（如：快节奏爽文、热血升级、幽默吐槽等）"
                    value={tempStyleSetting}
                    setValue={setTempStyleSetting}
                    cardType="styleSetting"
                    placeholder="例如：都市超能体裁，快节奏神豪爽文，整体色调轻松幽默，节奏明快..."
                    alwaysExpanded={true}
                  />
                  
                  <div
                    className="glass-card animate-fade-in"
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-light)',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      flexShrink: 0,
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
                        transition: 'background 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <strong style={{ fontSize: '15px', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          反 AI 写作控制与文风特征过滤器
                        </strong>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          绑定写作模型时的底层约束规则，彻底清除大模型生成文章中的"AI 鸡汤味"与"模板腔"
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
                          background: 'rgba(0,0,0,0.1)',
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
                                  boxShadow: isActive ? '0 0 10px rgba(99, 102, 241, 0.15)' : 'none',
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
                                    background: isActive ? 'var(--accent)' : 'transparent',
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
                </>
              )}
            </div>
          </div>
        )}

        {/* 2. 大纲设定视图 (outline) */}
        {activeMaterial === 'outline' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '30px', minHeight: 0, overflowY: 'auto', flexGrow: 1 }}>
            {/* 顶部标题统计栏 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'rgba(99, 102, 241, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(99, 102, 241, 0.25)'
                }}>
                  <BookOpen size={18} color="#6366f1" />
                </div>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', margin: 0 }}>大纲设定</h4>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {totalChapters} 章节 · {completionRate}% 完成
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={async () => {
                    if (!store.currentProject) return;
                    try {
                      await store.updateProject(store.currentProject.id, { outlineFull: tempOutlineFull });
                      alert('小说大纲已成功保存至项目！');
                    } catch (e) {
                      alert('大纲保存失败');
                    }
                  }}
                  style={{
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    color: '#fff',
                    fontSize: '12px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                  }}
                >
                  <Save size={14} />
                  <span>保存</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => handleSelectMaterial('worldSetting')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: 'var(--text-muted)',
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  title="关闭大纲设定，返回世界观设定"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* 功能操作工具行 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: '10px',
              padding: '10px 16px',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => handleInsertVolume(localSections.length)}
                  style={{
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    color: '#a5b4fc',
                    fontSize: '12px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: '600',
                    transition: 'all 0.2s'
                  }}
                >
                  <Plus size={14} />
                  <span>添加卷</span>
                </button>

                <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.08)' }} />

                {/* 展开/折叠全部 */}
                <button
                  type="button"
                  onClick={() => {
                    const allCollapsed = localSections.every((_, idx) => collapsedVolumes[idx]);
                    if (allCollapsed) {
                      setCollapsedVolumes({});
                    } else {
                      const next: Record<number, boolean> = {};
                      localSections.forEach((_, idx) => { next[idx] = true; });
                      setCollapsedVolumes(next);
                    }
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px',
                    borderRadius: '4px',
                    transition: 'all 0.2s'
                  }}
                  title={localSections.every((_, idx) => collapsedVolumes[idx]) ? "展开全部" : "折叠全部"}
                >
                  {localSections.every((_, idx) => collapsedVolumes[idx]) ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>

                {/* 撤销 AI 推演 */}
                <button
                  type="button"
                  onClick={undoLastAiRegen}
                  disabled={aiUndoStack.length === 0}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: aiUndoStack.length > 0 ? '#38bdf8' : 'rgba(255,255,255,0.2)',
                    cursor: aiUndoStack.length > 0 ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px',
                    borderRadius: '4px',
                    transition: 'all 0.2s'
                  }}
                  title={aiUndoStack.length > 0 ? `撤销上一次 AI 推演: ${aiUndoStack[aiUndoStack.length - 1].label}` : "无撤销步骤"}
                >
                  <Undo2 size={16} />
                </button>
              </div>

              {/* 搜索框 */}
              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                <input
                  type="text"
                  value={outlineSearchQuery}
                  onChange={e => setOutlineSearchQuery(e.target.value)}
                  placeholder="搜索..."
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '6px',
                    padding: '6px 10px 6px 30px',
                    fontSize: '12px',
                    color: '#fff',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                />
                {outlineSearchQuery && (
                  <button
                    onClick={() => setOutlineSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'rgba(255,255,255,0.4)',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            </div>

            {/* 大纲卷章核心树状列表 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flexGrow: 1, paddingRight: '4px' }}>
              {(() => {
                // 执行搜索过滤
                const query = outlineSearchQuery.trim().toLowerCase();
                const matchedVols = localSections.map((vol, vIdx) => {
                  if (!query) return { vol, vIdx, matches: true, matchedChaps: vol.chapters.map((ch, cIdx) => ({ ch, cIdx, matches: true })) };
                  
                  const volTitleMatches = vol.title.toLowerCase().includes(query);
                  const volContentMatches = vol.content.toLowerCase().includes(query);
                  
                  const matchedChaps = vol.chapters.map((ch, cIdx) => {
                    const chTitleMatches = ch.title.toLowerCase().includes(query);
                    const chContentMatches = ch.content.toLowerCase().includes(query);
                    return { ch, cIdx, matches: chTitleMatches || chContentMatches };
                  });
                  
                  const anyChapMatches = matchedChaps.some(c => c.matches);
                  
                  return {
                    vol,
                    vIdx,
                    matches: volTitleMatches || volContentMatches || anyChapMatches,
                    matchedChaps
                  };
                }).filter(item => item.matches);

                if (matchedVols.length === 0) {
                  return (
                    <div style={{
                      padding: '40px',
                      textAlign: 'center',
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px dashed rgba(255,255,255,0.04)',
                      borderRadius: '12px',
                      color: 'var(--text-muted)',
                      fontSize: '13px'
                    }}>
                      未找到符合条件的大纲分卷或章节设定
                    </div>
                  );
                }

                return matchedVols.map(({ vol, vIdx, matchedChaps }) => {
                  const isCollapsed = collapsedVolumes[vIdx] || false;
                  const isVolRegening = regeningVolumeIdx === vIdx;
                  const isEditing = editingVolumeIdx === vIdx;

                  // 计算卷状态
                  let volStatus = '未开始';
                  if (vol.chapters.length > 0) {
                    const totalChaps = vol.chapters.length;
                    // 在 store.chapters 中寻找标题或章节匹配的
                    const writtenChaps = vol.chapters.filter(ch => {
                      const dbCh = store.chapters.find(dbc => dbc.title.includes(ch.title) || ch.title.includes(dbc.title));
                      return dbCh && dbCh.content && dbCh.content.trim().length > 10;
                    }).length;
                    if (writtenChaps === totalChaps) {
                      volStatus = '已完成';
                    } else if (writtenChaps > 0) {
                      volStatus = '进行中';
                    }
                  }

                  return (
                    <div
                      key={vIdx}
                      className="glass-card animate-fade-in"
                      style={{
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.005) 100%)',
                        border: isEditing
                          ? '1px solid rgba(99,102,241,0.45)'
                          : vol.isLocked
                            ? '1px solid rgba(251,191,36,0.35)'
                            : '1px solid rgba(255,255,255,0.04)',
                        borderRadius: '12px',
                        boxShadow: vol.isLocked
                          ? '0 4px 24px rgba(251,191,36,0.05)'
                          : '0 4px 20px rgba(0,0,0,0.12)',
                        transition: 'all 0.25s ease',
                        overflow: 'hidden',
                        ...(isVolRegening && {
                          border: '1px solid rgba(56,189,248,0.5)',
                          boxShadow: '0 0 0 0 rgba(56,189,248,0.45), 0 4px 24px rgba(56,189,248,0.15)',
                          animation: 'aiPulse 1.6s ease-in-out infinite',
                          background: 'linear-gradient(135deg, rgba(56,189,248,0.04) 0%, rgba(56,189,248,0.01) 100%)'
                        })
                      }}
                    >
                      {/* AI推演分卷加载条 */}
                      {isVolRegening && (
                        <div style={{
                          padding: '6px 12px',
                          background: 'rgba(56,189,248,0.08)',
                          borderBottom: '1px solid rgba(56,189,248,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Loader2 size={13} className="spin" color="#38bdf8" />
                            <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '500' }}>AI 正在推演本卷剧情走向与看点...</span>
                          </div>
                          <button
                            type="button"
                            onClick={cancelAiRegen}
                            style={{
                              fontSize: '10px', color: 'var(--text-muted)',
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              padding: '1px 8px', borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            取消
                          </button>
                        </div>
                      )}

                      {/* 行内编辑分卷模式 */}
                      {isEditing && editVolumeForm ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '600' }}>
                              修改分卷大纲
                            </span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={saveVolumeEditing}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  color: '#4ade80',
                                  background: 'rgba(74,222,128,0.1)',
                                  border: '1px solid rgba(74,222,128,0.2)',
                                  padding: '4px 10px',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                <Check size={11} />
                                <span>保存</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingVolumeIdx(null);
                                  setEditVolumeForm(null);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  color: '#f87171',
                                  background: 'rgba(248,113,113,0.1)',
                                  border: '1px solid rgba(248,113,113,0.2)',
                                  padding: '4px 10px',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                <X size={11} />
                                <span>取消</span>
                              </button>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>分卷名称</label>
                            <input
                              type="text"
                              className="input"
                              value={editVolumeForm.title}
                              onChange={e => setEditVolumeForm({ ...editVolumeForm, title: e.target.value })}
                              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '13px' }}
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>分卷剧情走向描述</label>
                            <textarea
                              className="textarea"
                              rows={4}
                              value={editVolumeForm.content}
                              onChange={e => setEditVolumeForm({ ...editVolumeForm, content: e.target.value })}
                              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '13px', lineHeight: '1.6' }}
                            />
                          </div>
                        </div>
                      ) : (
                        /* 分卷卡片常规视图 */
                        <div style={{ padding: '20px' }}>
                          {/* 卷头部 */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '10px', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <button
                                type="button"
                                onClick={() => setCollapsedVolumes(prev => ({ ...prev, [vIdx]: !isCollapsed }))}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: 0
                                }}
                              >
                                {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                              </button>
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <BookOpen size={14} color="#6366f1" />
                                <h4 style={{ fontSize: '15px', fontWeight: '700', color: vol.isLocked ? '#fbbf24' : '#fff', margin: 0 }}>
                                  {vol.title}
                                </h4>
                                
                                <span style={{
                                  fontSize: '11px',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  background: volStatus === '已完成' ? 'rgba(74, 222, 128, 0.1)' : volStatus === '进行中' ? 'rgba(249, 115, 22, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                                  color: volStatus === '已完成' ? '#4ade80' : volStatus === '进行中' ? '#fb923c' : 'var(--text-muted)',
                                  fontWeight: '600'
                                }}>
                                  {volStatus}
                                </span>

                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  {vol.chapters.length} 章
                                </span>
                              </div>
                            </div>

                            {/* 卷右侧控制按钮 */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => toggleLockVolume(vIdx)}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: vol.isLocked ? '#fbbf24' : 'rgba(255,255,255,0.25)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '2px',
                                  transition: 'all 0.2s'
                                }}
                                title={vol.isLocked ? "已锁定（更新大纲时此卷剧情走向将受保护）" : "锁定此分卷"}
                              >
                                {vol.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => handleMoveVolume(vIdx, 'up')}
                                disabled={vIdx === 0}
                                style={{ border: 'none', background: 'transparent', color: vIdx === 0 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)', cursor: vIdx === 0 ? 'not-allowed' : 'pointer' }}
                                title="上移卷"
                              >
                                <ArrowUp size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveVolume(vIdx, 'down')}
                                disabled={vIdx === localSections.length - 1}
                                style={{ border: 'none', background: 'transparent', color: vIdx === localSections.length - 1 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)', cursor: vIdx === 0 || vIdx === localSections.length - 1 ? 'not-allowed' : 'pointer' }}
                                title="下移卷"
                              >
                                <ArrowDown size={12} />
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => {
                                  setAiPromptVolIdx(vIdx);
                                  setAiPromptText('');
                                }}
                                style={{
                                  fontSize: '11px',
                                  color: '#38bdf8',
                                  background: 'rgba(56,189,248,0.06)',
                                  border: '1px solid rgba(56,189,248,0.15)',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                                title="AI 智能为本卷生成/完善大纲剧情走向"
                              >
                                <Sparkles size={11} />
                                <span>AI推演</span>
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingVolumeIdx(vIdx);
                                  setEditVolumeForm(JSON.parse(JSON.stringify(vol)));
                                }}
                                style={{ fontSize: '11px', color: 'var(--accent)', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                              >
                                <Edit3 size={11} />
                                <span>编辑</span>
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => handleDeleteVolume(vIdx)}
                                style={{ fontSize: '11px', color: '#ef4444', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                              >
                                <Trash2 size={11} />
                                <span>删除</span>
                              </button>
                            </div>
                          </div>

                          {/* 卷剧情走向简述 */}
                          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', margin: '0 0 14px 0', whiteSpace: 'pre-wrap' }}>
                            {vol.content || '暂无此分卷的整体走向描述，点击编辑或AI推演来完善走向...'}
                          </p>

                          {/* AI推演输入框 */}
                          {aiPromptVolIdx === vIdx && (
                            <div style={{ marginBottom: '14px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                              <input
                                type="text"
                                value={aiPromptText}
                                onChange={e => setAiPromptText(e.target.value)}
                                placeholder="输入推演要求（可选，如：加入主角在此击败魔尊）"
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                                    setAiPromptVolIdx(null);
                                    handleAiRegenVolume(vIdx, aiPromptText);
                                  }
                                }}
                                style={{
                                  flex: 1,
                                  fontSize: '12px',
                                  padding: '5px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(56,189,248,0.3)',
                                  background: 'rgba(56,189,248,0.05)',
                                  color: 'var(--text-primary)',
                                  outline: 'none'
                                }}
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setAiPromptVolIdx(null);
                                  handleAiRegenVolume(vIdx, aiPromptText);
                                }}
                                style={{
                                  fontSize: '11px',
                                  padding: '5px 10px',
                                  borderRadius: '4px',
                                  border: 'none',
                                  background: '#38bdf8',
                                  color: '#000',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                推演
                              </button>
                              <button
                                type="button"
                                onClick={() => setAiPromptVolIdx(null)}
                                style={{
                                  fontSize: '11px',
                                  padding: '5px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid var(--border-light)',
                                  background: 'transparent',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer'
                                }}
                              >
                                取消
                              </button>
                            </div>
                          )}

                          {/* 卷下的章节树状折叠面板 */}
                          {!isCollapsed && (
                            <div style={{
                              background: 'rgba(0, 0, 0, 0.15)',
                              border: '1px solid rgba(255, 255, 255, 0.03)',
                              borderRadius: '8px',
                              padding: '16px',
                              marginTop: '12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px'
                            }}>
                              {/* 章节为空渲染 */}
                              {vol.chapters.length === 0 ? (
                                <div
                                  onClick={() => handleInsertChapter(vIdx, -1)}
                                  style={{
                                    border: '1px dashed rgba(255,255,255,0.06)',
                                    borderRadius: '6px',
                                    padding: '24px',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    color: 'var(--text-muted)',
                                    background: 'rgba(255,255,255,0.005)',
                                    transition: 'all 0.2s',
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.borderColor = 'var(--accent)';
                                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.02)';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.005)';
                                  }}
                                >
                                  <div style={{ fontSize: '13px', color: '#c0c0c0', fontWeight: '500', marginBottom: '4px' }}>暂无章节</div>
                                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>点击在此分卷下添加首个章节</span>
                                </div>
                              ) : (
                                /* 章节列表 */
                                matchedChaps.filter(c => c.ch).map(({ ch: sec, cIdx }) => {
                                  const globalIdx = flatChapters.findIndex(ch => ch.volIdx === vIdx && ch.chapIdx === cIdx);
                                  const isRegening = regeningIndex === globalIdx;
                                  const isEditingChap = editingChapterPath && editingChapterPath.volIdx === vIdx && editingChapterPath.chapIdx === cIdx;

                                  // 判断是否已写作正文
                                  const dbChap = store.chapters.find(dbc => dbc.title.includes(sec.title) || sec.title.includes(dbc.title));
                                  const isWritten = dbChap && dbChap.content && dbChap.content.trim().length > 10;

                                  return (
                                    <div
                                      key={cIdx}
                                      style={{
                                        border: isEditingChap ? '1px solid rgba(99,102,241,0.35)' : '1px solid rgba(255,255,255,0.03)',
                                        background: isEditingChap ? 'rgba(99,102,241,0.02)' : 'rgba(255,255,255,0.01)',
                                        borderRadius: '6px',
                                        padding: '12px 14px',
                                        transition: 'all 0.2s',
                                        position: 'relative'
                                      }}
                                    >
                                      {/* AI单章重写加载状态 */}
                                      {isRegening && (
                                        <div style={{
                                          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                          background: 'rgba(15,15,25,0.85)', borderRadius: '6px',
                                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', zIndex: 10
                                        }}>
                                          <Loader2 size={13} className="spin" color="#38bdf8" />
                                          <span style={{ fontSize: '11px', color: '#38bdf8' }}>AI 正在推演本章细纲...</span>
                                        </div>
                                      )}

                                      {/* 章节编辑模式 */}
                                      {isEditingChap && editChapterForm ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '600' }}>编辑章节大纲</span>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                              <button
                                                type="button"
                                                onClick={saveChapterEditing}
                                                style={{ fontSize: '10px', color: '#4ade80', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                                              >
                                                保存
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setEditingChapterPath(null);
                                                  setEditChapterForm(null);
                                                }}
                                                style={{ fontSize: '10px', color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                                              >
                                                取消
                                              </button>
                                            </div>
                                          </div>

                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>章节名</label>
                                            <input
                                              type="text"
                                              className="input"
                                              value={editChapterForm.title}
                                              onChange={e => setEditChapterForm({ ...editChapterForm, title: e.target.value })}
                                              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '6px', color: '#fff', fontSize: '12px' }}
                                            />
                                          </div>

                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>本章剧情简述与推进</label>
                                            <textarea
                                              className="textarea"
                                              rows={3}
                                              value={editChapterForm.content}
                                              onChange={e => setEditChapterForm({ ...editChapterForm, content: e.target.value })}
                                              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '6px', color: '#fff', fontSize: '12px', lineHeight: '1.5' }}
                                            />
                                          </div>
                                        </div>
                                      ) : (
                                        /* 章节卡片常规视图 */
                                        <div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <span style={{
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                color: sec.isLocked ? '#fbbf24' : '#fff'
                                              }}>
                                                {sec.title}
                                              </span>
                                              
                                              <span style={{
                                                fontSize: '10px',
                                                padding: '1px 6px',
                                                borderRadius: '8px',
                                                background: isWritten ? 'rgba(74, 222, 128, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                                                color: isWritten ? '#4ade80' : 'var(--text-dark)',
                                                fontWeight: '500'
                                              }}>
                                                {isWritten ? '已写正文' : '未开始'}
                                              </span>
                                            </div>

                                            {/* 章级操作按钮组 */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <button
                                                type="button"
                                                onClick={() => toggleLockChapter(vIdx, cIdx)}
                                                style={{ border: 'none', background: 'transparent', color: sec.isLocked ? '#fbbf24' : 'rgba(255,255,255,0.2)', cursor: 'pointer', padding: '2px' }}
                                                title={sec.isLocked ? "章节已锁定（推演时大纲不被覆盖）" : "锁定章节大纲"}
                                              >
                                                {sec.isLocked ? <Lock size={11} /> : <Unlock size={11} />}
                                              </button>
                                              
                                              <button
                                                type="button"
                                                onClick={() => handleMoveChapter(vIdx, cIdx, 'up')}
                                                disabled={cIdx === 0}
                                                style={{ border: 'none', background: 'transparent', color: cIdx === 0 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)', cursor: cIdx === 0 ? 'not-allowed' : 'pointer', padding: '2px' }}
                                              >
                                                <ArrowUp size={11} />
                                              </button>
                                              
                                              <button
                                                type="button"
                                                onClick={() => handleMoveChapter(vIdx, cIdx, 'down')}
                                                disabled={cIdx === vol.chapters.length - 1}
                                                style={{ border: 'none', background: 'transparent', color: cIdx === vol.chapters.length - 1 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)', cursor: cIdx === vol.chapters.length - 1 ? 'not-allowed' : 'pointer', padding: '2px' }}
                                              >
                                                <ArrowDown size={11} />
                                              </button>

                                              <button
                                                type="button"
                                                onClick={() => handleAiRegenChapter(vIdx, cIdx)}
                                                style={{ fontSize: '10px', color: '#38bdf8', background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.12)', padding: '1px 6px', borderRadius: '3px', cursor: 'pointer' }}
                                                title="AI 智能推演重写本章细纲"
                                              >
                                                <Sparkles size={9} style={{ marginRight: '2px', display: 'inline-block', verticalAlign: 'middle' }} />
                                                <span style={{ verticalAlign: 'middle' }}>AI推演</span>
                                              </button>

                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setEditingChapterPath({ volIdx: vIdx, chapIdx: cIdx });
                                                  setEditChapterForm(JSON.parse(JSON.stringify(sec)));
                                                }}
                                                style={{ fontSize: '10px', color: 'var(--accent)', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)', padding: '1px 6px', borderRadius: '3px', cursor: 'pointer' }}
                                              >
                                                <Edit3 size={9} style={{ marginRight: '2px', display: 'inline-block', verticalAlign: 'middle' }} />
                                                <span style={{ verticalAlign: 'middle' }}>编辑</span>
                                              </button>

                                              <button
                                                type="button"
                                                onClick={() => handleDeleteChapter(vIdx, cIdx)}
                                                style={{ fontSize: '10px', color: '#ef4444', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)', padding: '1px 6px', borderRadius: '3px', cursor: 'pointer' }}
                                              >
                                                <Trash2 size={9} style={{ marginRight: '2px', display: 'inline-block', verticalAlign: 'middle' }} />
                                                <span style={{ verticalAlign: 'middle' }}>删除</span>
                                              </button>
                                            </div>
                                          </div>

                                          <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 6px 0', whiteSpace: 'pre-wrap' }}>
                                            {sec.content || '暂无详细的大纲推进说明，点击编辑或AI推演来完善剧情内容...'}
                                          </p>

                                          {/* 章节其它设定键值对详情展示 */}
                                          {sec.details.length > 0 && (
                                            <div style={{
                                              display: 'flex',
                                              flexWrap: 'wrap',
                                              gap: '6px',
                                              marginTop: '4px',
                                              borderTop: '1px solid rgba(255,255,255,0.02)',
                                              paddingTop: '6px'
                                            }}>
                                              {sec.details.map((det, dIdx) => (
                                                <div
                                                  key={dIdx}
                                                  style={{
                                                    fontSize: '10.5px',
                                                    background: 'rgba(255,255,255,0.02)',
                                                    border: '1px solid rgba(255,255,255,0.04)',
                                                    borderRadius: '4px',
                                                    padding: '2px 8px',
                                                    color: 'var(--text-dark)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                  }}
                                                >
                                                  <strong style={{ color: 'rgba(255,255,255,0.45)' }}>{det.key}:</strong>
                                                  <span>{det.value}</span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                              
                              {/* 章节下的 "+ 添加章节" 按钮 */}
                              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.03)', paddingTop: '10px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleInsertChapter(vIdx, vol.chapters.length - 1)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#a5b4fc',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 12px',
                                    borderRadius: '4px',
                                    transition: 'all 0.2s',
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.color = '#fff'; }}
                                  onMouseLeave={e => { e.currentTarget.style.color = '#a5b4fc'; }}
                                >
                                  <Plus size={12} />
                                  <span>添加章节</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* 3. 章节细纲视图 (chapter) */}
        {activeMaterial === 'chapter' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '30px', minHeight: 0, overflowY: 'auto', flexGrow: 1 }}>
            {/* 顶栏控制组 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: 0 }}>章节细纲</h4>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>可视化分析各章细纲内容及情感起伏节奏</span>
                </div>
                {localSections.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginLeft: '16px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>分卷筛选:</span>
                    <button
                      type="button"
                      onClick={() => setSelectedVolumeIdx(null)}
                      style={{
                        fontSize: '11px',
                        padding: '3px 10px',
                        borderRadius: '12px',
                        border: '1px solid ' + (selectedVolumeIdx === null ? 'var(--accent)' : 'rgba(255,255,255,0.06)'),
                        background: selectedVolumeIdx === null ? 'rgba(99,102,241,0.1)' : 'transparent',
                        color: selectedVolumeIdx === null ? '#fff' : 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      全部卷
                    </button>
                    {localSections.map((vol, vIdx) => (
                      <button
                        key={vIdx}
                        type="button"
                        onClick={() => setSelectedVolumeIdx(selectedVolumeIdx === vIdx ? null : vIdx)}
                        style={{
                          fontSize: '11px',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          border: '1px solid ' + (selectedVolumeIdx === vIdx ? 'var(--accent)' : 'rgba(255,255,255,0.06)'),
                          background: selectedVolumeIdx === vIdx ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)',
                          color: selectedVolumeIdx === vIdx ? '#fff' : 'var(--text-dark)',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {vol.title.split(/[：:]/)[0] || vol.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 0, flexGrow: 1 }}>
              {/* 情绪曲线图 */}
              {flatChapters.length > 0 && (
                <div
                  className="glass-card"
                  style={{
                    padding: '16px',
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.005) 100%)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '24px', minHeight: '24px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      <Activity size={13} style={{ color: 'var(--accent)' }} />
                      <span style={{ fontWeight: '500' }}>小说节奏与情绪张力曲线</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '350px', flexShrink: 0 }}>
                      {hoveredPoint !== null ? (
                        <span>
                          {points[hoveredPoint].title} | 情绪强度: {points[hoveredPoint].val}%
                        </span>
                      ) : (
                        <span>悬浮节点查看章节情绪值，点击可快速锚定</span>
                      )}
                    </div>
                  </div>

                  <div style={{ position: 'relative', width: '100%', height: '90px' }}>
                    <svg
                      width="100%"
                      height="100%"
                      viewBox="0 0 800 100"
                      preserveAspectRatio="none"
                      style={{ overflow: 'visible' }}
                    >
                      <defs>
                        <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="chart-stroke" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#818cf8" />
                          <stop offset="50%" stopColor="var(--accent)" />
                          <stop offset="100%" stopColor="#c084fc" />
                        </linearGradient>
                      </defs>

                      <line x1="40" y1="20" x2="760" y2="20" stroke="rgba(255,255,255,0.02)" strokeDasharray="3 3" />
                      <line x1="40" y1="50" x2="760" y2="50" stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
                      <line x1="40" y1="80" x2="760" y2="80" stroke="rgba(255,255,255,0.02)" strokeDasharray="3 3" />

                      {points.length > 0 && (
                        <path d={areaPath} fill="url(#chart-fill)" />
                      )}

                      {points.length > 1 && (
                        <path d={linePath} fill="none" stroke="url(#chart-stroke)" strokeWidth="2.5" />
                      )}

                      {points.map((p, i) => (
                        <g key={i}>
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={hoveredPoint === i ? 6 : 4}
                            fill={flatChapters[i].isLocked ? '#fbbf24' : (hoveredPoint === i ? '#fff' : 'var(--accent)')}
                            stroke={hoveredPoint === i ? 'var(--accent)' : 'rgba(255,255,255,0.8)'}
                            strokeWidth={hoveredPoint === i ? 3 : 1.5}
                            style={{ transition: 'all 0.15s ease' }}
                          />
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={14}
                            fill="rgba(0,0,0,0)"
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={() => setHoveredPoint(i)}
                            onMouseLeave={() => setHoveredPoint(null)}
                            onClick={() => {
                              const element = document.getElementById(`chapter-card-${i}`);
                              if (element) {
                                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                element.style.borderColor = 'var(--accent)';
                                setTimeout(() => {
                                  element.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                                }, 1000);
                              }
                            }}
                          />
                        </g>
                      ))}
                    </svg>
                  </div>
                </div>
              )}

              {/* 角色过滤器 */}
              {allCharacters.length > 0 && (
                <div
                  className="glass-card"
                  style={{
                    padding: '12px 16px',
                    background: 'rgba(0,0,0,0.12)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', marginRight: '4px' }}>
                    <User size={12} />
                    <span>人物筛选:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedChar(null)}
                    style={{
                      fontSize: '11px',
                      padding: '3px 10px',
                      borderRadius: '12px',
                      border: '1px solid ' + (selectedChar === null ? 'var(--accent)' : 'rgba(255,255,255,0.06)'),
                      background: selectedChar === null ? 'rgba(99,102,241,0.1)' : 'transparent',
                      color: selectedChar === null ? '#fff' : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    全部章节
                  </button>
                  {allCharacters.map((char, cIdx) => (
                    <button
                      key={cIdx}
                      type="button"
                      onClick={() => setSelectedChar(selectedChar === char ? null : char)}
                      style={{
                        fontSize: '11px',
                        padding: '3px 10px',
                        borderRadius: '12px',
                        border: '1px solid ' + (selectedChar === char ? 'var(--accent)' : 'rgba(255,255,255,0.06)'),
                        background: selectedChar === char ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)',
                        color: selectedChar === char ? '#fff' : 'var(--text-dark)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Tag size={9} style={{ opacity: 0.6 }} />
                      <span>{char}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* 按分卷分组的章节细纲时间线列表 */}
              <div style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '6px', minHeight: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                  {localSections.map((vol, vIdx) => {
                    if (selectedVolumeIdx !== null && selectedVolumeIdx !== vIdx) {
                      return null;
                    }
                    if (vol.chapters.length === 0) return null;

                    return (
                      <div key={vIdx} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                          <BookOpen size={13} style={{ color: 'var(--accent)' }} />
                          <strong style={{ fontSize: '13px', color: 'var(--accent)' }}>{vol.title}</strong>
                          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.03)', padding: '1px 5px', borderRadius: '3px' }}>
                            {vol.chapters.length} 章节
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingLeft: '8px', borderLeft: '2px solid rgba(99,102,241,0.12)', marginLeft: '6px', position: 'relative' }}>
                          {vol.chapters.map((sec, cIdx) => {
                            const globalIdx = flatChapters.findIndex(ch => ch.volIdx === vIdx && ch.chapIdx === cIdx);
                            const secChars = parseCharacters(sec.details);
                            const isFiltered = selectedChar !== null && !secChars.includes(selectedChar);
                            const isRegening = regeningIndex === globalIdx;
                            const isEditing = editingChapterPath && editingChapterPath.volIdx === vIdx && editingChapterPath.chapIdx === cIdx;

                            return (
                              <div
                                key={cIdx}
                                id={`chapter-card-${globalIdx}`}
                                style={{
                                  position: 'relative',
                                  opacity: isFiltered ? 0.28 : 1,
                                  filter: isFiltered ? 'grayscale(40%)' : 'none',
                                  transition: 'all 0.35s ease',
                                  transform: selectedChar && !isFiltered ? 'scale(1.01)' : 'scale(1)'
                                }}
                              >
                                <div style={{
                                  position: 'absolute',
                                  left: '-15px',
                                  top: '24px',
                                  width: '12px',
                                  height: '12px',
                                  borderRadius: '50%',
                                  background: sec.isLocked ? 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)' : 'linear-gradient(135deg, var(--accent) 0%, #a5b4fc 100%)',
                                  boxShadow: sec.isLocked ? '0 0 10px rgba(251,191,36,0.6)' : '0 0 8px rgba(99,102,241,0.4)',
                                  zIndex: 2,
                                }} />

                                <div
                                  className="glass-card"
                                  style={{
                                    padding: '20px',
                                    background: 'linear-gradient(135deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.005) 100%)',
                                    border: isEditing
                                      ? '1px solid rgba(99,102,241,0.45)'
                                      : sec.isLocked
                                        ? '1px solid rgba(251,191,36,0.35)'
                                        : '1px solid rgba(255,255,255,0.04)',
                                    borderRadius: '12px',
                                    transition: 'all 0.25s ease',
                                  }}
                                >
                                  {isRegening ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '12px' }}>
                                      <Loader2 size={24} className="animate-spin" style={{ color: '#38bdf8' }} />
                                      <span style={{ fontSize: '12px', color: '#38bdf8' }}>AI 正在智能推演本章细纲</span>
                                    </div>
                                  ) : isEditing && editChapterForm ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                      <input
                                        type="text"
                                        className="input"
                                        value={editChapterForm.title}
                                        onChange={e => setEditChapterForm({ ...editChapterForm, title: e.target.value })}
                                        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '13px' }}
                                      />
                                      <textarea
                                        className="textarea"
                                        rows={3}
                                        value={editChapterForm.content}
                                        onChange={e => setEditChapterForm({ ...editChapterForm, content: e.target.value })}
                                        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '13px', lineHeight: '1.6' }}
                                      />
                                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                        <button type="button" onClick={saveChapterEditing} style={{ padding: '4px 10px', fontSize: '11px', color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '4px', cursor: 'pointer' }}>保存</button>
                                        <button type="button" onClick={() => { setEditingChapterPath(null); setEditChapterForm(null); }} style={{ padding: '4px 10px', fontSize: '11px', color: '#f87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '4px', cursor: 'pointer' }}>取消</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '10px', marginBottom: '12px' }}>
                                        <h4 style={{ fontSize: '14px', fontWeight: '600', color: sec.isLocked ? '#fbbf24' : '#fff', margin: 0 }}>
                                          {sec.title}
                                        </h4>
                                      </div>
                                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', margin: '0 0 16px 0', whiteSpace: 'pre-wrap' }}>
                                        {sec.content || '暂无剧情描述...'}
                                      </p>
                                      {sec.details.length > 0 && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                                          {sec.details.map((det, dIdx) => (
                                            <div key={dIdx} style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                                              <div style={{ fontSize: '10.5px', color: 'var(--accent)', fontWeight: '600', marginBottom: '4px' }}>{det.key}</div>
                                              <div style={{ fontSize: '12px', color: '#e2e8f0', lineHeight: '1.5' }}>{det.value}</div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. 角色管理视图 (character) */}
        {activeMaterial === 'character' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '30px', minHeight: 0, overflowY: 'auto', flexGrow: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: 0 }}>
                  角色管理 ({store.characters ? store.characters.length : 0})
                </h4>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>管理本小说的登场角色，设定其身份、性格及修行状态</span>
              </div>
              
              {!isAddingChar && store.currentProject && (
                <button
                  className="btn btn-primary"
                  onClick={() => setIsAddingChar(true)}
                  style={{ fontSize: '11px', padding: '6px 12px', background: 'var(--accent)', border: 'none' }}
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
                  setIsAddingChar(false);
                }}
                onCancel={() => setIsAddingChar(false)}
              />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1 }}>
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
                      createVersionSnapshot({
                        projectId: store.currentProject!.id,
                        type: 'character',
                        key: id,
                        label: `${updates.name || char.name}`,
                        data: updates,
                        source: 'auto',
                      });
                    }}
                    onDelete={async (id) => {
                      await store.deleteCharacter(id);
                    }}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* 5. 扩展设定与世界设定资产库 (location, faction, item, currency, skillSystem, relation, foreshadow, plot, subPlot, timeline, events) */}
        {['location', 'faction', 'item', 'currency', 'skillSystem', 'timeline', 'foreshadow', 'plot', 'subPlot', 'events', 'relation'].includes(activeMaterial) && (
          (() => {
            const currentRules = getFilteredRules(activeMaterial);
            const materialLabel = materialsList.find(m => m.id === activeMaterial)?.label || '';
            const materialColor = materialsList.find(m => m.id === activeMaterial)?.color || 'var(--accent)';

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

      {/* AI 推演撤销浮层 - 固定在面板底部 */}
      {aiUndoStack.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          padding: '12px 20px',
          background: 'rgba(15, 15, 25, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          zIndex: 100,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '8px', height: '8px',
              borderRadius: '50%',
              background: '#38bdf8',
              boxShadow: '0 0 6px rgba(56,189,248,0.6)'
            }} />
            <span style={{ fontSize: '13px', color: '#e0e0e0' }}>
              {(() => {
                const last = aiUndoStack[aiUndoStack.length - 1];
                const typeLabel = last.type === 'volume' ? '分卷' : last.type === 'chapter' ? '章节' : '字段';
                return `【${last.label}】${typeLabel}已推演`;
              })()}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={undoLastAiRegen}
              style={{
                fontSize: '12px', padding: '4px 14px',
                background: 'rgba(56,189,248,0.15)',
                border: '1px solid rgba(56,189,248,0.4)',
                color: '#38bdf8', borderRadius: '4px',
                cursor: 'pointer', fontWeight: '500'
              }}
            >
              撤销
            </button>
            <button
              type="button"
              onClick={clearAiUndo}
              style={{
                fontSize: '11px', padding: '4px 8px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-muted)', borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              确认
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
);
}
