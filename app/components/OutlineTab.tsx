'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2, Eye, Edit3, Plus, Trash2, ArrowUp, ArrowDown, User, Activity, Key, BookOpen, Check, X, Tag, Lock, Unlock, Sparkles, Compass, Flame, Zap, Award, Trophy } from 'lucide-react';
import { useWorkspace } from '../workspace-context';
import { useAiClient } from '../hooks/useAiClient';

interface OutlineSection {
  title: string;
  content: string;
  details: { key: string; value: string }[];
  isLocked?: boolean;
}

// 智能大纲解析器，提取章节与锁定标记
function parseStructureOutline(text: string): OutlineSection[] {
  if (!text) return [];
  const sections: OutlineSection[] = [];
  
  // 以 markdown 格式的二级标题 "## " 作为切分节点
  const parts = text.split(/(?=^##\s+)/m);
  
  for (const part of parts) {
    const lines = part.split('\n');
    let title = '';
    let isLocked = false;
    const details: { key: string; value: string }[] = [];
    const contentLines: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      if (trimmed.startsWith('##')) {
        let titleText = trimmed.replace(/^##\s+/, '').trim();
        if (titleText.includes('<!-- LOCKED -->') || titleText.includes('[LOCKED]')) {
          isLocked = true;
          titleText = titleText.replace('<!-- LOCKED -->', '').replace('[LOCKED]', '').trim();
        }
        title = titleText;
      } else if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        // 匹配属性键值对，例如: "- **核心冲突**：xxx" 或 "- 核心冲突: xxx"
        const kvMatch = trimmed.match(/^[\-\*]\s+(?:\*\*(.*?)\*\*|([^：:]+))[：:](.*)$/);
        if (kvMatch) {
          const key = (kvMatch[1] || kvMatch[2]).trim();
          const value = kvMatch[3].trim();
          details.push({ key, value });
        } else {
          contentLines.push(trimmed.replace(/^[\-\*]\s+/, ''));
        }
      } else if (!trimmed.startsWith('#')) {
        contentLines.push(trimmed);
      }
    }
    
    if (title || contentLines.length > 0 || details.length > 0) {
      sections.push({
        title: title || '故事导言',
        content: contentLines.join('\n'),
        details,
        isLocked
      });
    }
  }
  
  return sections;
}

// 将修改后的结构重新编译成 Markdown 文本并写入 <!-- LOCKED --> 锁定标记
function generateMarkdownFromSections(sections: OutlineSection[]): string {
  return sections.map(sec => {
    let part = `## ${sec.title}${sec.isLocked ? ' <!-- LOCKED -->' : ''}\n`;
    if (sec.content && sec.content.trim()) {
      part += `${sec.content.trim()}\n`;
    }
    sec.details.forEach(det => {
      if (det.key.trim() && det.value.trim()) {
        part += `- **${det.key.trim()}**：${det.value.trim()}\n`;
      }
    });
    return part;
  }).join('\n\n');
}

// 将数字转换为中文章节号
function getChineseChapterNumber(num: number): string {
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

// 自动对章节标题重新编序
function renumberSections(sections: OutlineSection[]): OutlineSection[] {
  let chapIdx = 1;
  return sections.map((sec, idx) => {
    const currentTitle = sec.title;
    // 剥离类似 "第X章：" 的前缀
    const titleMatch = currentTitle.match(/^(?:第[一二三四五六七八九十百\d]+章[：:\s\-]*)(.*)$/);
    const remainingTitle = titleMatch ? titleMatch[1].trim() : currentTitle;
    
    // 如果是导言，不强加章节序号
    if (idx === 0 && (remainingTitle.includes('导言') || remainingTitle.includes('前言') || remainingTitle.includes('简介'))) {
      return sec;
    }
    
    const chapNum = getChineseChapterNumber(chapIdx);
    chapIdx++;
    return {
      ...sec,
      title: `第${chapNum}章：${remainingTitle || '新章节'}`
    };
  });
}

// 提取章节的相关人物
function parseCharacters(details: { key: string; value: string }[]): string[] {
  const charDetail = details.find(d => d.key.includes('人物') || d.key.includes('角色'));
  if (!charDetail) return [];
  return charDetail.value
    .split(/[,，、\/\\\s\+]+/)
    .map(c => c.trim())
    .filter(c => c.length > 0 && c !== '主角' && c !== '配角');
}

// 量化情绪值以便在折线图中画图
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
  
  // 大纲子 Tab 视图
  const [outlineSubTab, setOutlineSubTab] = useState<'chapters' | 'macro'>('chapters');
  
  // 结构化大纲内部局部状态
  const [localSections, setLocalSections] = useState<OutlineSection[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<OutlineSection | null>(null);
  
  // AI 局部生成状态
  const [regeningIndex, setRegeningIndex] = useState<number | null>(null);
  const [regeningField, setRegeningField] = useState<string | null>(null);
  
  // 可视化状态控制
  const [selectedChar, setSelectedChar] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  // 同步外部 Markdown 大纲至局部状态
  useEffect(() => {
    if (editingIndex === null) {
      setLocalSections(parseStructureOutline(tempOutlineFull));
    }
  }, [tempOutlineFull, editingIndex]);

  // 提取大纲中包含的全部角色列表以供筛选
  const allCharacters = Array.from(
    new Set(
      localSections.flatMap(sec => parseCharacters(sec.details))
    )
  );

  // 计算情绪起伏折线图的点
  const points = localSections.map((sec, i) => {
    const val = parseEmotionValue(sec.details);
    // X 坐标均分，留出边距
    const x = localSections.length > 1 ? 50 + (i / (localSections.length - 1)) * 700 : 400;
    const y = 80 - (val / 100) * 60;
    return { x, y, val, title: sec.title, idx: i };
  });

  // 构造 SVG 路径
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x} 95 L ${points[0].x} 95 Z` 
    : '';

  // 添加新章节大纲
  const handleInsertSection = (index: number) => {
    const newSec: OutlineSection = {
      title: '新章节',
      content: '在此输入新章节的核心故事情节描述...',
      details: [
        { key: '核心冲突', value: '新章节的博弈冲突点' },
        { key: '信息释放', value: '本章透露的秘密或回收的伏笔' },
        { key: '情绪曲线', value: '情绪波动，如铺垫(40%)或高潮(85%)' },
        { key: '相关人物', value: '主角' }
      ]
    };
    const newSections = [...localSections];
    newSections.splice(index + 1, 0, newSec);
    const renumbered = renumberSections(newSections);
    setLocalSections(renumbered);
    const md = generateMarkdownFromSections(renumbered);
    setTempOutlineFull(md);
  };

  // 删除某章大纲
  const handleDeleteSection = (index: number) => {
    if (!confirm('确定要删除该章节大纲吗？删除后将重新计算并同步章节序号。')) return;
    const newSections = [...localSections];
    newSections.splice(index, 1);
    const renumbered = renumberSections(newSections);
    setLocalSections(renumbered);
    const md = generateMarkdownFromSections(renumbered);
    setTempOutlineFull(md);
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditForm(null);
    }
  };

  // 大纲卡片上下调换位置
  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === localSections.length - 1) return;
    
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newSections = [...localSections];
    
    const temp = newSections[index];
    newSections[index] = newSections[targetIndex];
    newSections[targetIndex] = temp;
    
    const renumbered = renumberSections(newSections);
    setLocalSections(renumbered);
    const md = generateMarkdownFromSections(renumbered);
    setTempOutlineFull(md);
  };

  // 切换卡片的锁定状态，并即时保存
  const toggleLockSection = (index: number) => {
    const newSections = [...localSections];
    newSections[index].isLocked = !newSections[index].isLocked;
    setLocalSections(newSections);
    const md = generateMarkdownFromSections(newSections);
    setTempOutlineFull(md);
  };

  // 进入编辑模式并初始化表单
  const startEditing = (index: number) => {
    setEditingIndex(index);
    // 深拷贝
    setEditForm(JSON.parse(JSON.stringify(localSections[index])));
  };

  // 保存单个卡片的编辑内容并同步回 Markdown 文本
  const saveEditing = () => {
    if (editingIndex === null || !editForm) return;
    const newSections = [...localSections];
    newSections[editingIndex] = editForm;
    
    const renumbered = renumberSections(newSections);
    setLocalSections(renumbered);
    const md = generateMarkdownFromSections(renumbered);
    setTempOutlineFull(md);
    
    setEditingIndex(null);
    setEditForm(null);
  };

  // 修改表单中特定属性的值
  const updateDetailValue = (key: string, val: string) => {
    if (!editForm) return;
    const details = [...editForm.details];
    const itemIdx = details.findIndex(d => d.key === key);
    if (itemIdx >= 0) {
      details[itemIdx].value = val;
    } else {
      details.push({ key, value: val });
    }
    setEditForm({ ...editForm, details });
  };

  // 选用推荐大纲时智能合并锁定章节的算法
  const handleSelectRecommendedOutline = async (opt: any) => {
    const optDesc = opt.description || '';
    const newSections = parseStructureOutline(optDesc);
    const oldSections = localSections;

    // 智能合并：被锁定的卡片绝对保留，未锁定的覆盖
    const mergedSections = newSections.map((newSec, idx) => {
      const oldSec = oldSections[idx];
      if (oldSec && oldSec.isLocked) {
        return oldSec;
      }
      return newSec;
    });

    // 如果旧章节多于新推荐章节，且多出来的章节里有被锁定的，需要追加回来以防止丢失
    if (oldSections.length > newSections.length) {
      for (let i = newSections.length; i < oldSections.length; i++) {
        if (oldSections[i].isLocked) {
          mergedSections.push(oldSections[i]);
        }
      }
    }

    const renumbered = renumberSections(mergedSections);
    setLocalSections(renumbered);
    const md = generateMarkdownFromSections(renumbered);
    setTempOutlineFull(md);

    if (store.currentProject) {
      try {
        await store.updateProject(store.currentProject.id, { outlineFull: md });
        alert(`已成功选用该大纲并执行智能合并（已保留锁定章节）！`);
      } catch (e) {
        alert('智能合并保存失败');
      }
    }
  };

  // AI 局部单章大纲重写 (Regenerate Beat)
  const handleAiRegenSection = async (idx: number) => {
    if (!store.currentProject) return;
    setRegeningIndex(idx);
    try {
      const sec = localSections[idx];
      const prompt = `你是一个资深网络小说剧情策划。请为我的小说《${store.currentProject.title}》重新规划设计【${sec.title}】的详细章节细纲。

【当前小说设定】:
- 书名: ${store.currentProject.title}
- 简介: ${tempWorldSetting || store.currentProject.worldSetting || '暂无'}
- 题材/核心冲突: ${tempCoreConflict || store.currentProject.coreConflict || '暂无'}

【其他相邻章节的上下文大纲】:
${localSections.map((s, sIdx) => sIdx !== idx ? `- ${s.title}: ${s.content}` : '').filter(Boolean).slice(Math.max(0, idx - 2), idx + 3).join('\n')}

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
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const reply = data.reply;
      const parsedRegen = parseStructureOutline(reply);
      if (parsedRegen.length > 0) {
        const newSec = parsedRegen[0];
        // 保留原锁定属性与原章节名
        const mergedSec = {
          ...newSec,
          title: sec.title,
          isLocked: sec.isLocked
        };
        const newSections = [...localSections];
        newSections[idx] = mergedSec;

        const md = generateMarkdownFromSections(newSections);
        setLocalSections(newSections);
        setTempOutlineFull(md);
        alert('该章节细纲已成功完成 AI 局部重写并同步！');
      } else {
        throw new Error('AI 生成的章节大纲格式有误，未能成功解析');
      }
    } catch (e: any) {
      alert('AI 单章重写失败: ' + e.message);
    } finally {
      setRegeningIndex(null);
    }
  };

  // AI 宏观大纲单项字段推演 (Regenerate Macro Field)
  const handleAiRegenMacroField = async (fieldKey: string, fieldLabel: string) => {
    if (!store.currentProject) return;
    setRegeningField(fieldKey);
    try {
      const prompt = `你是一个网络小说金牌策划和商业企划大师。请为我的小说《${store.currentProject.title}》推演和设计一个极具吸睛力、新颖度与商业卖点的【${fieldLabel}】。
【当前书本基础信息】:
- 书名: ${store.currentProject.title}
- 简介: ${tempWorldSetting || store.currentProject.worldSetting || '暂无描述'}
- 文风和背景基调: ${tempStyleSetting || store.currentProject.styleSetting || '暂无'}

请直接输出推荐的【${fieldLabel}】的具体文本内容描述（字数在150字左右），不需要输出任何标题、多余的说明前言或分析，直接给出描述即可。`;

      const res = await callAIApi({
        action: 'chat',
        projectId: store.currentProject.id,
        query: prompt
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const reply = data.reply.trim();
      if (reply) {
        if (fieldKey === 'styleSetting') setTempStyleSetting(reply);
        else if (fieldKey === 'worldSetting') setTempWorldSetting(reply);
        else if (fieldKey === 'powerSystem') setTempPowerSystem(reply);
        else if (fieldKey === 'goldFinger') setTempGoldFinger(reply);
        else if (fieldKey === 'coreConflict') setTempCoreConflict(reply);
        else if (fieldKey === 'factionsMap') setTempFactionsMap(reply);
        else if (fieldKey === 'sellingPoints') setTempSellingPoints(reply);

        alert(`已成功单独推演【${fieldLabel}】！请记得点击顶部的“保存大纲数据”或“保存宏观设定”完成落库。`);
      } else {
        throw new Error('AI 未能返回有效的生成数据');
      }
    } catch (e: any) {
      alert(`AI 单项推演【${fieldLabel}】失败: ` + e.message);
    } finally {
      setRegeningField(null);
    }
  };

  // 保存宏观企划的设定
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
    <div style={{ display: 'flex', flex: '1', minHeight: 0, padding: '30px', gap: '30px', overflowY: 'auto' }}>
      {/* 左栏：核心故事大纲看板 */}
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 0 }}>
        
        {/* 顶部的次级 Tab 切换：Chapters vs Macro */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', gap: '16px', flexShrink: 0 }}>
          <button
            onClick={() => setOutlineSubTab('chapters')}
            style={{
              background: 'none',
              border: 'none',
              color: outlineSubTab === 'chapters' ? '#fff' : 'var(--text-muted)',
              fontSize: '14px',
              fontWeight: outlineSubTab === 'chapters' ? '600' : 'normal',
              paddingBottom: '8px',
              borderBottom: outlineSubTab === 'chapters' ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            章节时间线细纲
          </button>
          <button
            onClick={() => setOutlineSubTab('macro')}
            style={{
              background: 'none',
              border: 'none',
              color: outlineSubTab === 'macro' ? '#fff' : 'var(--text-muted)',
              fontSize: '14px',
              fontWeight: outlineSubTab === 'macro' ? '600' : 'normal',
              paddingBottom: '8px',
              borderBottom: outlineSubTab === 'macro' ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            故事宏观大纲企划
          </button>
        </div>

        {outlineSubTab === 'chapters' ? (
          /* ============= 章节时间线细纲 Tab ============= */
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
                placeholder="在此以 Markdown 格式直接起草大纲，以 ## 开头作为章节划分..."
                value={tempOutlineFull}
                onChange={e => setTempOutlineFull(e.target.value)}
                style={{ flexGrow: 1, minHeight: '400px', fontSize: '13px', lineHeight: '1.7', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '10px' }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 0, flexGrow: 1 }}>
                
                {/* 情绪曲线图 */}
                {localSections.length > 0 && (
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
                              fill={localSections[i].isLocked ? '#fbbf24' : (hoveredPoint === i ? '#fff' : 'var(--accent)')}
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

                {/* 章节列表 */}
                <div style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '6px', minHeight: 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', paddingLeft: '8px', borderLeft: '2px solid rgba(99,102,241,0.12)', marginLeft: '6px', position: 'relative' }}>
                    {localSections.map((sec, idx) => {
                      const secChars = parseCharacters(sec.details);
                      const isFiltered = selectedChar !== null && !secChars.includes(selectedChar);
                      const isRegening = regeningIndex === idx;

                      return (
                        <div
                          key={idx}
                          id={`chapter-card-${idx}`}
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
                              border: editingIndex === idx
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
                              /* 局部重写加载动效 */
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '10px' }}>
                                <Loader2 className="animate-spin" size={20} style={{ color: 'var(--accent)' }} />
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>AI 正在智能推演和重写本章细纲...</span>
                              </div>
                            ) : editingIndex === idx && editForm ? (
                              /* 行内编辑表单 */
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '600' }}>
                                    行内细化大纲卡片
                                  </span>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                      type="button"
                                      onClick={saveEditing}
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
                                        setEditingIndex(null);
                                        setEditForm(null);
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
                                    value={editForm.title}
                                    onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '13px' }}
                                  />
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>剧情推进叙述</label>
                                  <textarea
                                    className="textarea"
                                    rows={3}
                                    value={editForm.content}
                                    onChange={e => setEditForm({ ...editForm, content: e.target.value })}
                                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '13px', lineHeight: '1.6' }}
                                  />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>核心冲突</label>
                                    <input
                                      type="text"
                                      className="input"
                                      value={editForm.details.find(d => d.key === '核心冲突')?.value || ''}
                                      onChange={e => updateDetailValue('核心冲突', e.target.value)}
                                      style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '12px' }}
                                    />
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>信息释放</label>
                                    <input
                                      type="text"
                                      className="input"
                                      value={editForm.details.find(d => d.key === '信息释放')?.value || ''}
                                      onChange={e => updateDetailValue('信息释放', e.target.value)}
                                      style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '12px' }}
                                    />
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>情绪起伏</label>
                                    <input
                                      type="text"
                                      className="input"
                                      value={editForm.details.find(d => d.key === '情绪曲线')?.value || ''}
                                      onChange={e => updateDetailValue('情绪曲线', e.target.value)}
                                      style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '12px' }}
                                    />
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>相关人物</label>
                                    <input
                                      type="text"
                                      className="input"
                                      value={editForm.details.find(d => d.key === '相关人物')?.value || ''}
                                      onChange={e => updateDetailValue('相关人物', e.target.value)}
                                      style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '12px' }}
                                    />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              /* 浏览视图 */
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '10px', marginBottom: '12px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {/* 锁定图标按钮 */}
                                    <button
                                      type="button"
                                      onClick={() => toggleLockSection(idx)}
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
                                      onClick={() => handleMoveSection(idx, 'up')}
                                      disabled={idx === 0}
                                      style={{ border: 'none', background: 'transparent', color: idx === 0 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)', cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
                                    >
                                      <ArrowUp size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleMoveSection(idx, 'down')}
                                      disabled={idx === localSections.length - 1}
                                      style={{ border: 'none', background: 'transparent', color: idx === localSections.length - 1 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)', cursor: idx === localSections.length - 1 ? 'not-allowed' : 'pointer' }}
                                    >
                                      <ArrowDown size={12} />
                                    </button>
                                    
                                    {/* AI 局部重生 */}
                                    <button
                                      type="button"
                                      onClick={() => handleAiRegenSection(idx)}
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
                                      <span>AI重生</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => startEditing(idx)}
                                      style={{ fontSize: '10.5px', color: 'var(--accent)', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                                    >
                                      <Edit3 size={10} />
                                      <span>编辑</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleInsertSection(idx)}
                                      style={{ fontSize: '10.5px', color: '#a855f7', background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                                    >
                                      <Plus size={10} />
                                      <span>加章</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSection(idx)}
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
              </div>
            )}
          </div>
        ) : (
          /* ============= 故事宏观大纲企划 Tab ============= */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 0, flexGrow: 1 }}>
            
            {/* 顶栏控制组 */}
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

            {/* 7 大宏观维度网格卡片 */}
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
                        onClick={() => handleAiRegenMacroField(field.key, field.label)}
                        disabled={isFieldRegening}
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
                      >
                        {isFieldRegening ? (
                          <Loader2 className="animate-spin" size={10} />
                        ) : (
                          <Sparkles size={10} />
                        )}
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
        )}
      </div>

      {/* 右栏：AI 推演的 3 套备选方案卡片 */}
      <div style={{ width: '420px', display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0 }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>AI 大纲备选推荐（点击一键选用）</span>
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
                    onClick={() => handleSelectRecommendedOutline(opt)}
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
  );
}
