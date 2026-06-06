'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Save, Loader2, Eye, Edit3, Plus, Trash2, ArrowUp, ArrowDown, User, Activity, Key, BookOpen, Check, X, Tag, Lock, Unlock, Sparkles, Compass, Flame, Zap, Award, Trophy } from 'lucide-react';
import { useWorkspace } from '../workspace-context';
import { useAiClient } from '../hooks/useAiClient';
import { createVersionSnapshot } from '@/lib/versionSnapshot';

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
  } = kernel;

  const callAIApi = useAiClient();

  const [viewMode, setViewMode] = useState<'structure' | 'editor'>('structure');
  
  // 核心切换 Tab：大纲划分为 宏观、卷级、章级 三级视图看板
  const [outlineSubTab, setOutlineSubTab] = useState<'macro' | 'volume' | 'chapter'>('macro');
  
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

  // AI 宏观大纲单项设定字段推演 ( Deducing StoryMacro fields )
  const handleAiRegenMacroField = async (fieldKey: string, fieldLabel: string) => {
    if (!store.currentProject) return;
    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;
    setRegeningField(fieldKey);
    try {
      const prompt = `你是一个网络小说金牌策划和商业企划大师。请为我的小说《${store.currentProject.title}》推演和设计一个极具吸睛力、新颖度与商业卖点的【${fieldLabel}】。
【当前书本基础信息】:
- 书名: ${store.currentProject.title}
- 简介: ${tempWorldSetting || store.currentProject.worldSetting || '暂无描述'}
- 文风和背景基调: ${tempStyleSetting || store.currentProject.styleSetting || '暂无'}

Please output in Chinese. 请直接输出推荐的【${fieldLabel}】的具体文本内容描述（字数在150字左右），不需要输出任何标题、多余的说明前言或分析，直接给出描述即可。`;

      const res = await callAIApi({
        action: 'chat',
        projectId: store.currentProject.id,
        query: prompt
      }, controller.signal);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const reply = data.reply.trim();
      if (reply) {
        const prevValue = fieldKey === 'styleSetting' ? tempStyleSetting
          : fieldKey === 'worldSetting' ? tempWorldSetting
          : fieldKey === 'powerSystem' ? tempPowerSystem
          : fieldKey === 'goldFinger' ? tempGoldFinger
          : fieldKey === 'coreConflict' ? tempCoreConflict
          : fieldKey === 'factionsMap' ? tempFactionsMap
          : tempSellingPoints;

        if (fieldKey === 'styleSetting') setTempStyleSetting(reply);
        else if (fieldKey === 'worldSetting') setTempWorldSetting(reply);
        else if (fieldKey === 'powerSystem') setTempPowerSystem(reply);
        else if (fieldKey === 'goldFinger') setTempGoldFinger(reply);
        else if (fieldKey === 'coreConflict') setTempCoreConflict(reply);
        else if (fieldKey === 'factionsMap') setTempFactionsMap(reply);
        else if (fieldKey === 'sellingPoints') setTempSellingPoints(reply);

        pushAiUndo({
          type: 'macro',
          label: fieldLabel,
          restore: () => {
            if (fieldKey === 'styleSetting') setTempStyleSetting(prevValue);
            else if (fieldKey === 'worldSetting') setTempWorldSetting(prevValue);
            else if (fieldKey === 'powerSystem') setTempPowerSystem(prevValue);
            else if (fieldKey === 'goldFinger') setTempGoldFinger(prevValue);
            else if (fieldKey === 'coreConflict') setTempCoreConflict(prevValue);
            else if (fieldKey === 'factionsMap') setTempFactionsMap(prevValue);
            else if (fieldKey === 'sellingPoints') setTempSellingPoints(prevValue);
          }
        });
      } else {
        throw new Error('AI 未能返回有效的生成数据');
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        alert(`AI 单项推演【${fieldLabel}】失败: ` + e.message);
      }
    } finally {
      if (aiAbortRef.current === controller) {
        aiAbortRef.current = null;
        setRegeningField(null);
      }
    }
  };

  // 保存宏观设定落库
  const handleSaveMacroSettings = async () => {
    if (!store.currentProject) return;
    try {
      await store.updateProject(store.currentProject.id, {
        styleSetting: tempStyleSetting,
        worldSetting: tempWorldSetting,
        powerSystem: tempPowerSystem,
        goldFinger: tempGoldFinger,
        coreConflict: tempCoreConflict,
        factionsMap: tempFactionsMap,
        sellingPoints: tempSellingPoints,
      });
      alert('核心宏观策划设定已成功保存至项目！');
    } catch (e) {
      alert('保存核心设定失败');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: '1', minHeight: 0, position: 'relative' }}>
      <div style={{ display: 'flex', flex: '1', minHeight: 0, padding: '30px', gap: '30px', overflowY: 'auto' }}>
      {/* 左栏：核心故事大纲看板 */}
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 0 }}>
        
        {/* 三级大纲 Tab 控制组：宏观、卷级、章级页签 */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', gap: '16px', flexShrink: 0 }}>
          {[
            { key: 'macro', label: '故事宏观设定' },
            { key: 'volume', label: '分卷主线大纲' },
            { key: 'chapter', label: '章节时间细纲' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setOutlineSubTab(tab.key as any)}
              style={{
                background: 'none',
                border: 'none',
                color: outlineSubTab === tab.key ? '#fff' : 'var(--text-muted)',
                fontSize: '14px',
                fontWeight: outlineSubTab === tab.key ? '600' : 'normal',
                paddingBottom: '8px',
                borderBottom: outlineSubTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {outlineSubTab === 'macro' ? (
          /* ============= 故事宏观大纲企划 Tab ============= */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 0, flexGrow: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', margin: 0 }}>小说核心设定企划内核</h4>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>控制全书主线走向的基础骨架设定，支持字段级单项 AI 创意生成</span>
              </div>
              
              <button
                className="btn btn-primary"
                onClick={handleSaveMacroSettings}
                style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Save size={13} />
                <span>保存核心设定</span>
              </button>
            </div>

            {/* 7 大维度网格 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px', overflowY: 'auto', paddingRight: '4px', flexGrow: 1 }}>
              {[
                { key: 'sellingPoints', label: '一句话爽点与商业卖点', val: tempSellingPoints, setVal: setTempSellingPoints, icon: <Trophy size={14} />, placeholder: '简述本书的核心卖点与商业爽点，如扮猪吃老虎、幕后黑手...' },
                { key: 'coreConflict', label: '核心矛盾与长期冲突线', val: tempCoreConflict, setVal: setTempCoreConflict, icon: <Flame size={14} />, placeholder: '主要的故事对抗冲突，终极敌对势力或天命使命...' },
                { key: 'goldFinger', label: '主角金手指设定', val: tempGoldFinger, setVal: setTempGoldFinger, icon: <Zap size={14} />, placeholder: '主角特有的挂牌、系统、伴生宝物或极道能力...' },
                { key: 'powerSystem', label: '境界与力量等级体系', val: tempPowerSystem, setVal: setTempPowerSystem, icon: <Award size={14} />, placeholder: '例如：练气、筑基、金丹、元婴、化神；或其它特异力量层级体系...' },
                { key: 'factionsMap', label: '势力分布与地理图谱', val: tempFactionsMap, setVal: setTempFactionsMap, icon: <Compass size={14} />, placeholder: '世界地理背景，不同宗门门阀、教派与世家盟友的冲突交错...' },
                { key: 'worldSetting', label: '小说世界观微观/宏观背景', val: tempWorldSetting, setVal: setTempWorldSetting, icon: <BookOpen size={14} />, placeholder: '大陆环境、规则机制或社会形态...' },
                { key: 'styleSetting', label: '写作风格与题材调性', val: tempStyleSetting, setVal: setTempStyleSetting, icon: <Activity size={14} />, placeholder: '文风走势，如：轻喜搞笑、压抑正剧、王道热血...' },
              ].map(field => {
                const isFieldRegening = regeningField === field.key;
                
                return (
                  <div
                    key={field.key}
                    className="glass-card animate-fade-in"
                    style={{
                      padding: '16px 20px',
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.005) 100%)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: 'var(--accent)' }}>
                        {field.icon}
                        <span>{field.label}</span>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => kernel.handleAiDeduceField(field.key, field.label)}
                        style={{
                          fontSize: '10.5px',
                          color: '#38bdf8',
                          background: 'rgba(56,189,248,0.06)',
                          border: '1px solid rgba(56,189,248,0.15)',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <Sparkles size={10} />
                        <span>AI推演</span>
                      </button>
                    </div>

                    <textarea
                      className="textarea"
                      rows={5}
                      placeholder={field.placeholder}
                      value={field.val}
                      onChange={e => field.setVal(e.target.value)}
                      style={{
                        background: 'rgba(0,0,0,0.22)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        color: '#f1f5f9',
                        fontSize: '12.5px',
                        lineHeight: '1.6',
                        resize: 'none',
                        flexGrow: 1
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : outlineSubTab === 'volume' ? (
          /* ============= 分卷大纲主线看板 Tab ============= */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 0, overflowY: 'auto', paddingRight: '4px', flexGrow: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', margin: 0 }}>小说分卷大纲看板</h4>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>规划各卷的情节高潮与走向，每卷大纲控制对应章节的发展</span>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleInsertVolume(localSections.length - 1)}
                style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={13} />
                <span>添加新分卷</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1, overflowY: 'auto', paddingRight: '4px' }}>
              {localSections.map((vol, vIdx) => {
                const isVolRegening = regeningVolumeIdx === vIdx;
                const isEditing = editingVolumeIdx === vIdx;

                return (
                  <div
                    key={vIdx}
                    className="glass-card animate-fade-in"
                    style={{
                      padding: '20px',
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
                      ...(isVolRegening && {
                        border: '1px solid rgba(56,189,248,0.5)',
                        boxShadow: '0 0 0 0 rgba(56,189,248,0.45), 0 4px 24px rgba(56,189,248,0.15)',
                        animation: 'aiPulse 1.6s ease-in-out infinite',
                        background: 'linear-gradient(135deg, rgba(56,189,248,0.04) 0%, rgba(56,189,248,0.01) 100%)'
                      })
                    }}
                  >
                    {isVolRegening && (
                      <div style={{
                        marginBottom: '12px', padding: '6px 12px',
                        background: 'rgba(56,189,248,0.08)',
                        border: '1px solid rgba(56,189,248,0.25)',
                        borderRadius: '6px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '14px', height: '14px',
                            borderRadius: '50%',
                            border: '2px solid rgba(56,189,248,0.2)',
                            borderTopColor: '#38bdf8',
                            animation: 'spin 1s linear infinite'
                          }} />
                          <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: '500' }}>AI 正在推演本卷走向...</span>
                        </div>
                        <button
                          type="button"
                          onClick={cancelAiRegen}
                          style={{
                            fontSize: '11px', color: 'var(--text-muted)',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '2px 10px', borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          取消
                        </button>
                      </div>
                    )}
                    {isEditing && editVolumeForm ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                          <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>分卷大纲剧情走向与主要看点</label>
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
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '10px', marginBottom: '12px' }}>
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
                              title={vol.isLocked ? "已锁定（更新推荐大纲时此卷将受到保留）" : "未锁定"}
                            >
                              {vol.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                            </button>
                            <h4 style={{ fontSize: '14px', fontWeight: '600', color: vol.isLocked ? '#fbbf24' : '#fff', margin: 0 }}>
                              {vol.title}
                            </h4>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px' }}>
                              共 {vol.chapters.length} 章
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => handleMoveVolume(vIdx, 'up')}
                              disabled={vIdx === 0}
                              style={{ border: 'none', background: 'transparent', color: vIdx === 0 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)', cursor: vIdx === 0 ? 'not-allowed' : 'pointer' }}
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveVolume(vIdx, 'down')}
                              disabled={vIdx === localSections.length - 1}
                              style={{ border: 'none', background: 'transparent', color: vIdx === localSections.length - 1 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)', cursor: vIdx === localSections.length - 1 ? 'not-allowed' : 'pointer' }}
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
                                fontSize: '10.5px',
                                color: '#38bdf8',
                                background: 'rgba(56,189,248,0.06)',
                                border: '1px solid rgba(56,189,248,0.15)',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                              title="让 AI 为本卷智能推演剧情走向大纲"
                            >
                              <Sparkles size={10} />
                              <span>AI推演</span>
                            </button>
                            
                            <button
                              type="button"
                              onClick={() => {
                                setEditingVolumeIdx(vIdx);
                                setEditVolumeForm(JSON.parse(JSON.stringify(vol)));
                              }}
                              style={{ fontSize: '10.5px', color: 'var(--accent)', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                            >
                              <Edit3 size={10} />
                              <span>编辑</span>
                            </button>
                            
                            <button
                              type="button"
                              onClick={() => handleDeleteVolume(vIdx)}
                              style={{ fontSize: '10.5px', color: '#ef4444', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                            >
                              <Trash2 size={10} />
                              <span>删除</span>
                            </button>
                          </div>
                        </div>

                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' }}>
                          {vol.content || '暂无此分卷的整体走向描述，点击"编辑"或"AI推演"完善大纲...'}
                        </p>

                        {/* AI推演本卷 - 用户输入框 */}
                        {aiPromptVolIdx === vIdx && (
                          <div style={{ marginTop: '8px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                            <input
                              type="text"
                              value={aiPromptText}
                              onChange={e => setAiPromptText(e.target.value)}
                              placeholder="输入推演要求（可选，如：加入主角觉醒情节）"
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ============= 章节大纲时间线细纲 Tab ============= */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 0, flexGrow: 1 }}>
            
            {/* 顶栏控制组 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>分章细目</span>
                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-light)', borderRadius: '16px', padding: '2px' }}>
                  <button
                    type="button"
                    onClick={() => setViewMode('structure')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      border: 'none',
                      background: viewMode === 'structure' ? 'var(--accent)' : 'transparent',
                      color: viewMode === 'structure' ? '#fff' : 'var(--text-muted)',
                      fontSize: '11px',
                      padding: '4px 12px',
                      borderRadius: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Eye size={12} />
                    <span>结构化卡片</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('editor')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      border: 'none',
                      background: viewMode === 'editor' ? 'var(--accent)' : 'transparent',
                      color: viewMode === 'editor' ? '#fff' : 'var(--text-muted)',
                      fontSize: '11px',
                      padding: '4px 12px',
                      borderRadius: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Edit3 size={12} />
                    <span>Markdown文本</span>
                  </button>
                </div>
                 {viewMode === 'structure' && localSections.length > 0 && (
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
              
              <button
                className="btn btn-primary"
                onClick={async () => {
                  if (!store.currentProject) return;
                  try {
                    await store.updateProject(store.currentProject.id, { outlineFull: tempOutlineFull });
                    alert('章节大纲已成功保存至项目！');
                  } catch (e) {
                    alert('大纲保存失败');
                  }
                }}
                style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Save size={13} />
                <span>保存大纲数据</span>
              </button>
            </div>

            {viewMode === 'editor' ? (
              <textarea
                className="textarea"
                placeholder="在此以 Markdown 格式直接起草大纲，以 # 开头为分卷，以 ## 开头作为章节划分..."
                value={tempOutlineFull}
                onChange={e => setTempOutlineFull(e.target.value)}
                style={{ flexGrow: 1, minHeight: '400px', fontSize: '13px', lineHeight: '1.7', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '10px' }}
              />
            ) : (
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

                        {/* 网格参考线 */}
                        <line x1="40" y1="20" x2="760" y2="20" stroke="rgba(255,255,255,0.02)" strokeDasharray="3 3" />
                        <line x1="40" y1="50" x2="760" y2="50" stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
                        <line x1="40" y1="80" x2="760" y2="80" stroke="rgba(255,255,255,0.02)" strokeDasharray="3 3" />

                        {/* 渐变填充 */}
                        {points.length > 0 && (
                          <path d={areaPath} fill="url(#chart-fill)" />
                        )}

                        {/* 折线 */}
                        {points.length > 1 && (
                          <path d={linePath} fill="none" stroke="url(#chart-stroke)" strokeWidth="2.5" />
                        )}

                        {/* 圆点 */}
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
                      if (vol.chapters.length === 0) {
                        return (
                          <div key={vIdx} style={{ background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                            <div style={{ fontSize: '13px', color: 'var(--text-dark)', fontWeight: '600', marginBottom: '4px' }}>{vol.title}</div>
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>本分卷下尚未添加任何章节</span>
                            <div style={{ marginTop: '8px' }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => handleInsertChapter(vIdx, -1)}
                                style={{ fontSize: '10.5px', padding: '4px 8px' }}
                              >
                                添加首章
                              </button>
                            </div>
                          </div>
                        );
                      }

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
                                  {/* 时间轴节点 */}
                                  <div style={{
                                    position: 'absolute',
                                    left: '-15px',
                                    top: '24px',
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    background: sec.isLocked
                                      ? 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)'
                                      : selectedChar && !isFiltered
                                        ? 'linear-gradient(135deg, #a855f7 0%, var(--accent) 100%)'
                                        : 'linear-gradient(135deg, var(--accent) 0%, #a5b4fc 100%)',
                                    boxShadow: sec.isLocked
                                      ? '0 0 10px rgba(251,191,36,0.6)'
                                      : selectedChar && !isFiltered
                                        ? '0 0 12px rgba(168,85,247,0.8)'
                                        : '0 0 8px rgba(99,102,241,0.4)',
                                    zIndex: 2,
                                    transition: 'all 0.3s'
                                  }} />

                                  {/* 卡片容器 */}
                                  <div
                                    className="glass-card"
                                    style={{
                                      padding: '20px',
                                      background: 'linear-gradient(135deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.005) 100%)',
                                      border: isEditing
                                        ? '1px solid rgba(99,102,241,0.45)'
                                        : sec.isLocked
                                          ? '1px solid rgba(251,191,36,0.35)'
                                          : selectedChar && !isFiltered
                                            ? '1px solid rgba(168,85,247,0.3)'
                                            : '1px solid rgba(255,255,255,0.04)',
                                      borderRadius: '12px',
                                      boxShadow: sec.isLocked
                                        ? '0 4px 24px rgba(251,191,36,0.05)'
                                        : selectedChar && !isFiltered
                                          ? '0 6px 24px rgba(168,85,247,0.1)'
                                          : '0 4px 20px rgba(0,0,0,0.12)',
                                      transition: 'all 0.25s ease',
                                    }}
                                  >
                                    {isRegening ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '12px' }}>
                                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                          <div style={{
                                            position: 'absolute',
                                            width: '50px', height: '50px',
                                            borderRadius: '50%',
                                            border: '2px solid rgba(56,189,248,0.2)',
                                            borderTopColor: '#38bdf8',
                                            animation: 'spin 1s linear infinite'
                                          }} />
                                          <Sparkles size={20} style={{ color: '#38bdf8' }} />
                                        </div>
                                        <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: '600' }}>AI 正在智能推演本章细纲</span>
                                        <button
                                          type="button"
                                          onClick={cancelAiRegen}
                                          style={{
                                            display: 'flex', alignItems: 'center', gap: '4px',
                                            fontSize: '11px', color: 'var(--text-muted)',
                                            background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            padding: '3px 10px', borderRadius: '4px',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          <X size={11} />
                                          <span>取消推演</span>
                                        </button>
                                      </div>
                                    ) : isEditing && editChapterForm ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '600' }}>
                                            行内细化大纲卡片
                                          </span>
                                          <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                              type="button"
                                              onClick={saveChapterEditing}
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
                                                setEditingChapterPath(null);
                                                setEditChapterForm(null);
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
                                          <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>章节标题</label>
                                          <input
                                            type="text"
                                            className="input"
                                            value={editChapterForm.title}
                                            onChange={e => setEditChapterForm({ ...editChapterForm, title: e.target.value })}
                                            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '13px' }}
                                          />
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                          <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>剧情推进叙述</label>
                                          <textarea
                                            className="textarea"
                                            rows={3}
                                            value={editChapterForm.content}
                                            onChange={e => setEditChapterForm({ ...editChapterForm, content: e.target.value })}
                                            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '13px', lineHeight: '1.6' }}
                                          />
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                          {[
                                            { key: '核心冲突', label: '核心冲突' },
                                            { key: '信息释放', label: '信息释放' },
                                            { key: '情绪曲线', label: '情绪起伏' },
                                            { key: '相关人物', label: '相关人物' }
                                          ].map(detailField => {
                                            const detailItem = editChapterForm.details.find(d => d.key === detailField.key);
                                            return (
                                              <div key={detailField.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{detailField.label}</label>
                                                <input
                                                  type="text"
                                                  className="input"
                                                  value={detailItem?.value || ''}
                                                  onChange={e => {
                                                    const newDetails = [...editChapterForm.details];
                                                    const idx = newDetails.findIndex(d => d.key === detailField.key);
                                                    if (idx >= 0) newDetails[idx].value = e.target.value;
                                                    else newDetails.push({ key: detailField.key, value: e.target.value });
                                                    setEditChapterForm({ ...editChapterForm, details: newDetails });
                                                  }}
                                                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '12px' }}
                                                />
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ) : (
                                      <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '10px', marginBottom: '12px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <button
                                              type="button"
                                              onClick={() => toggleLockChapter(vIdx, cIdx)}
                                              style={{
                                                border: 'none',
                                                background: 'transparent',
                                                color: sec.isLocked ? '#fbbf24' : 'rgba(255,255,255,0.25)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: '2px',
                                                transition: 'all 0.2s'
                                              }}
                                              title={sec.isLocked ? "已锁定（更新推荐大纲时此卡片将受到保留）" : "未锁定"}
                                            >
                                              {sec.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                                            </button>
                                            <h4 style={{ fontSize: '14px', fontWeight: '600', color: sec.isLocked ? '#fbbf24' : '#fff', margin: 0 }}>
                                              {sec.title}
                                            </h4>
                                          </div>

                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <button
                                              type="button"
                                              onClick={() => handleMoveChapter(vIdx, cIdx, 'up')}
                                              disabled={cIdx === 0}
                                              style={{ border: 'none', background: 'transparent', color: cIdx === 0 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)', cursor: cIdx === 0 ? 'not-allowed' : 'pointer' }}
                                            >
                                              <ArrowUp size={12} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleMoveChapter(vIdx, cIdx, 'down')}
                                              disabled={cIdx === vol.chapters.length - 1}
                                              style={{ border: 'none', background: 'transparent', color: cIdx === vol.chapters.length - 1 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)', cursor: cIdx === vol.chapters.length - 1 ? 'not-allowed' : 'pointer' }}
                                            >
                                              <ArrowDown size={12} />
                                            </button>
                                            
                                            <button
                                              type="button"
                                              onClick={() => handleAiRegenChapter(vIdx, cIdx)}
                                              style={{
                                                fontSize: '10.5px',
                                                color: '#38bdf8',
                                                background: 'rgba(56,189,248,0.06)',
                                                border: '1px solid rgba(56,189,248,0.15)',
                                                padding: '3px 8px',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '3px'
                                              }}
                                              title="让 AI 局部重写本章的大纲设定"
                                            >
                                              <Sparkles size={10} />
                                              <span>AI推演</span>
                                            </button>
                                            
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditingChapterPath({ volIdx: vIdx, chapIdx: cIdx });
                                                setEditChapterForm(JSON.parse(JSON.stringify(sec)));
                                              }}
                                              style={{ fontSize: '10.5px', color: 'var(--accent)', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                                            >
                                              <Edit3 size={10} />
                                              <span>编辑</span>
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleInsertChapter(vIdx, cIdx)}
                                              style={{ fontSize: '10.5px', color: '#a855f7', background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                                            >
                                              <Plus size={10} />
                                              <span>加章</span>
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteChapter(vIdx, cIdx)}
                                              style={{ fontSize: '10.5px', color: '#ef4444', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                                            >
                                              <Trash2 size={10} />
                                              <span>删除</span>
                                            </button>
                                          </div>
                                        </div>

                                        {sec.content && (
                                          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', margin: '0 0 16px 0', whiteSpace: 'pre-wrap' }}>
                                            {sec.content}
                                          </p>
                                        )}

                                        {sec.details.length > 0 && (
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                                            {sec.details.map((det, dIdx) => {
                                              let icon = <Tag size={10} />;
                                              if (det.key.includes('冲突')) icon = <BookOpen size={10} />;
                                              if (det.key.includes('信息') || det.key.includes('伏笔')) icon = <Key size={10} />;
                                              if (det.key.includes('情绪') || det.key.includes('起伏')) icon = <Activity size={10} />;
                                              if (det.key.includes('人物') || det.key.includes('角色')) icon = <User size={10} />;

                                              return (
                                                <div
                                                  key={dIdx}
                                                  style={{
                                                    padding: '10px 12px',
                                                    background: 'rgba(0,0,0,0.18)',
                                                    border: '1px solid rgba(255,255,255,0.02)',
                                                    borderRadius: '6px'
                                                  }}
                                                >
                                                  <div style={{ fontSize: '10.5px', color: 'var(--accent)', fontWeight: '600', letterSpacing: '0.5px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    {icon}
                                                    <span>{det.key}</span>
                                                  </div>
                                                  <div style={{ fontSize: '12px', color: '#e2e8f0', lineHeight: '1.5' }}>
                                                    {det.value}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
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
            )}
          </div>
        )}
      </div>
      </div>

      {/* AI 推演撤销浮层 - 固定在面板底部 */}
      {aiUndoStack.length > 0 && (
        <div style={{
          padding: '10px 16px',
          background: 'rgba(15,15,25,0.92)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid rgba(56,189,248,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          zIndex: 10
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
            {aiUndoStack.length > 1 && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '3px' }}>
                可撤销 {aiUndoStack.length} 次
              </span>
            )}
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
              撤销推演
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
              全部确认
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
