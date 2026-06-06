'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2, Eye, Edit3, Plus, Trash2, ArrowUp, ArrowDown, User, Activity, Key, BookOpen, Check, X, Tag } from 'lucide-react';
import { useWorkspace } from '../workspace-context';

interface OutlineSection {
  title: string;
  content: string;
  details: { key: string; value: string }[];
}

// 智能大纲解析器
function parseStructureOutline(text: string): OutlineSection[] {
  if (!text) return [];
  const sections: OutlineSection[] = [];
  
  // 以 markdown 格式的二级标题 "## " 作为切分节点
  const parts = text.split(/(?=^##\s+)/m);
  
  for (const part of parts) {
    const lines = part.split('\n');
    let title = '';
    const details: { key: string; value: string }[] = [];
    const contentLines: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      if (trimmed.startsWith('##')) {
        title = trimmed.replace(/^##\s+/, '').trim();
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
        details
      });
    }
  }
  
  return sections;
}

// 将修改后的结构重新编译成 Markdown 文本
function generateMarkdownFromSections(sections: OutlineSection[]): string {
  return sections.map(sec => {
    let part = `## ${sec.title}\n`;
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
    kernelOptions, isKernelLoading,
  } = kernel;

  const [viewMode, setViewMode] = useState<'structure' | 'editor'>('structure');
  
  // 结构化大纲内部局部状态
  const [localSections, setLocalSections] = useState<OutlineSection[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<OutlineSection | null>(null);
  
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
    
    // 如果修改了标题格式，对其进行规范化
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

  return (
    <div style={{ display: 'flex', flex: '1', minHeight: 0, padding: '30px', gap: '30px', overflowY: 'auto' }}>
      {/* 左栏：核心故事大纲看板 */}
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 0 }}>
        {/* 顶部标题与视图切换 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: 0 }}>
              故事大纲看板
            </h3>
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
                <span>结构化大纲</span>
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
                <span>文本编辑</span>
              </button>
            </div>
          </div>
          
          <button
            className="btn btn-primary"
            onClick={async () => {
              if (!store.currentProject) return;
              try {
                await store.updateProject(store.currentProject.id, { outlineFull: tempOutlineFull });
                alert('故事大纲数据已成功保存至项目！');
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
            style={{ flexGrow: 1, minHeight: '450px', fontSize: '13px', lineHeight: '1.7', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '10px' }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 0, flexGrow: 1 }}>
            
            {/* 可视化面板 1: 情绪节奏折线图 (仅当有章节大纲时展示) */}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <Activity size={13} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontWeight: '500' }}>小说节奏与情绪张力曲线</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
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

                    {/* 绘制圆点与交互面 */}
                    {points.map((p, i) => (
                      <g key={i}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={hoveredPoint === i ? 6 : 4}
                          fill={hoveredPoint === i ? '#fff' : 'var(--accent)'}
                          stroke={hoveredPoint === i ? 'var(--accent)' : 'rgba(255,255,255,0.8)'}
                          strokeWidth={hoveredPoint === i ? 3 : 1.5}
                          style={{ transition: 'all 0.15s ease' }}
                        />
                        {/* 隐形触发区域以方便悬浮和点击 */}
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={14}
                          fill="transparent"
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={() => setHoveredPoint(i)}
                          onMouseLeave={() => setHoveredPoint(null)}
                          onClick={() => {
                            const element = document.getElementById(`chapter-card-${i}`);
                            if (element) {
                              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              // 视觉上闪烁一下闪光高亮
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

            {/* 可视化面板 2: 角色登场分布过滤器 */}
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
                  <span>登场人物筛选器:</span>
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

            {/* 结构化章节列表大纲时间轴 */}
            <div style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '6px', minHeight: 0 }}>
              {localSections.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', gap: '10px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', border: '1px dashed var(--border-light)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-dark)' }}>当前大纲为空，请切换到「文本编辑」录入或点击右侧 AI 推荐生成。</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', paddingLeft: '8px', borderLeft: '2px solid rgba(99,102,241,0.12)', marginLeft: '6px', position: 'relative' }}>
                  {localSections.map((sec, idx) => {
                    const secChars = parseCharacters(sec.details);
                    const isFiltered = selectedChar !== null && !secChars.includes(selectedChar);
                    
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
                        {/* 时间线发光节点 */}
                        <div style={{
                          position: 'absolute',
                          left: '-15px',
                          top: '24px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: selectedChar && !isFiltered 
                            ? 'linear-gradient(135deg, #a855f7 0%, var(--accent) 100%)'
                            : 'linear-gradient(135deg, var(--accent) 0%, #a5b4fc 100%)',
                          boxShadow: selectedChar && !isFiltered
                            ? '0 0 12px rgba(168,85,247,0.8)'
                            : '0 0 8px rgba(99,102,241,0.4)',
                          zIndex: 2,
                          transition: 'all 0.3s'
                        }} />

                        {/* 卡片实体 */}
                        <div
                          className="glass-card"
                          style={{
                            padding: '20px',
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.005) 100%)',
                            border: editingIndex === idx 
                              ? '1px solid rgba(99,102,241,0.45)' 
                              : selectedChar && !isFiltered 
                                ? '1px solid rgba(168,85,247,0.3)' 
                                : '1px solid rgba(255,255,255,0.04)',
                            borderRadius: '12px',
                            boxShadow: selectedChar && !isFiltered
                              ? '0 6px 24px rgba(168,85,247,0.1)'
                              : '0 4px 20px rgba(0,0,0,0.12)',
                            transition: 'all 0.25s ease',
                          }}
                        >
                          {editingIndex === idx && editForm ? (
                            /* 卡片编辑状态表单 */
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '600', letterSpacing: '0.5px' }}>
                                  正在编辑大纲卡片
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
                                    <span>确认保存</span>
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
                                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>章节名 (支持自动重排序号)</label>
                                <input
                                  type="text"
                                  className="input"
                                  value={editForm.title}
                                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '13px' }}
                                />
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>章节大纲情景故事线</label>
                                <textarea
                                  className="textarea"
                                  rows={3}
                                  value={editForm.content}
                                  onChange={e => setEditForm({ ...editForm, content: e.target.value })}
                                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '13px', lineHeight: '1.6' }}
                                />
                              </div>

                              {/* 四个核心结构化属性编辑 */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>核心冲突</label>
                                  <input
                                    type="text"
                                    className="input"
                                    value={editForm.details.find(d => d.key === '核心冲突')?.value || ''}
                                    onChange={e => updateDetailValue('核心冲突', e.target.value)}
                                    placeholder="输入章节的对抗或难点"
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
                                    placeholder="交代什么伏笔与秘密"
                                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '12px' }}
                                  />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>情绪曲线</label>
                                  <input
                                    type="text"
                                    className="input"
                                    value={editForm.details.find(d => d.key === '情绪曲线')?.value || ''}
                                    onChange={e => updateDetailValue('情绪曲线', e.target.value)}
                                    placeholder="例如：爽快(80%) 或 压抑(30%)"
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
                                    placeholder="登场角色，用逗号隔开"
                                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '12px' }}
                                  />
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* 卡片浏览状态展示 */
                            <div>
                              {/* 头部操作栏 */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '10px', marginBottom: '12px' }}>
                                <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', margin: 0 }}>
                                  {sec.title}
                                </h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {/* 位置移动 */}
                                  <button
                                    type="button"
                                    onClick={() => handleMoveSection(idx, 'up')}
                                    disabled={idx === 0}
                                    style={{ border: 'none', background: 'transparent', color: idx === 0 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)', padding: '2px', cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
                                    title="上移章节"
                                  >
                                    <ArrowUp size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveSection(idx, 'down')}
                                    disabled={idx === localSections.length - 1}
                                    style={{ border: 'none', background: 'transparent', color: idx === localSections.length - 1 ? 'rgba(255,255,255,0.1)' : 'var(--text-muted)', padding: '2px', cursor: idx === localSections.length - 1 ? 'not-allowed' : 'pointer' }}
                                    title="下移章节"
                                  >
                                    <ArrowDown size={12} />
                                  </button>
                                  
                                  {/* 卡片动作 */}
                                  <button
                                    type="button"
                                    onClick={() => startEditing(idx)}
                                    style={{
                                      fontSize: '10.5px',
                                      color: 'var(--accent)',
                                      background: 'rgba(99,102,241,0.06)',
                                      border: '1px solid rgba(99,102,241,0.15)',
                                      padding: '3px 8px',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '3px'
                                    }}
                                  >
                                    <Edit3 size={10} />
                                    <span>编辑</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleInsertSection(idx)}
                                    style={{
                                      fontSize: '10.5px',
                                      color: '#a855f7',
                                      background: 'rgba(168,85,247,0.06)',
                                      border: '1px solid rgba(168,85,247,0.15)',
                                      padding: '3px 8px',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '3px'
                                    }}
                                    title="在当前章后面插入新一章大纲"
                                  >
                                    <Plus size={10} />
                                    <span>加章</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSection(idx)}
                                    style={{
                                      fontSize: '10.5px',
                                      color: '#ef4444',
                                      background: 'rgba(239,68,68,0.06)',
                                      border: '1px solid rgba(239,68,68,0.15)',
                                      padding: '3px 8px',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '3px'
                                    }}
                                    title="删除这一章大纲"
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

                              {/* 结构化明细字段 */}
                              {sec.details.length > 0 && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                                  {sec.details.map((det, dIdx) => {
                                    // 确定图标
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
              )}
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
                    onClick={async () => {
                      const val = opt.name + '：' + opt.description;
                      setTempOutlineFull(val);
                      if (store.currentProject) {
                        try {
                          await store.updateProject(store.currentProject.id, { outlineFull: val });
                          alert(`已选用《${opt.name}》大纲并自动保存！`);
                        } catch (e) {}
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
  );
}


