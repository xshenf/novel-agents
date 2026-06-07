'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, Sparkles, Loader2 } from 'lucide-react';
import { GENRE_CATEGORIES, TONES, PRESET_TAG_GROUPS } from '@/lib/constants';
import { useWorkspace } from '../workspace-context';
import { createVersionSnapshot } from '@/lib/versionSnapshot';

interface StyleSettingPanelProps {
  tempStyleSetting: string;
  setTempStyleSetting: (v: string) => void;
}

export function StyleSettingPanel({ setTempStyleSetting }: StyleSettingPanelProps) {
  const { store, kernel } = useWorkspace();
  const { isKernelLoading, kernelProgress, fetchKernelOptions } = kernel;

  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedTone, setSelectedTone] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customGenreInput, setCustomGenreInput] = useState('');
  const [customToneInput, setCustomToneInput] = useState('');
  const [customTagInput, setCustomTagInput] = useState('');

  // 收缩状态：默认全部展开
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // 题材大类筛选：null 表示全部
  const [activeGenreCategory, setActiveGenreCategory] = useState<string | null>(null);

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 初始化：从已有数据解析（过滤占位文本）
  useEffect(() => {
    if (!store.currentProject) return;
    const desc = (store.currentProject.description || '').trim();
    const tone = (store.currentProject.styleSetting || '').trim();
    const tags = (store.currentProject.worldSetting || '').trim();

    // 过滤占位描述
    const isPlaceholder = (s: string) => !s || s.includes('补充') || s.includes('待补充') || s.includes('点击');

    if (desc && !isPlaceholder(desc)) {
      const allGenreNames = GENRE_CATEGORIES.flatMap(c => c.genres.map(g => g.name));
      const matched = allGenreNames.find(g => desc.includes(g));
      if (matched) {
        setSelectedGenre(matched);
      } else {
        setSelectedGenre(desc);
      }
    }

    if (tone && !isPlaceholder(tone)) {
      const matchedTone = TONES.find(t => tone.includes(t.name));
      setSelectedTone(matchedTone?.name || tone);
    }

    if (tags && !isPlaceholder(tags)) {
      const allTags = PRESET_TAG_GROUPS.flatMap(g => g.tags);
      const matchedTags = allTags.filter(t => tags.includes(t));
      setSelectedTags(matchedTags);
    }
  }, [store.currentProject?.id, store.currentProject]);

  // 任意维度变化时，合成 styleSetting 并保存
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const prevGenreRef = useRef(selectedGenre);
  const prevToneRef = useRef(selectedTone);
  const prevTagsRef = useRef(selectedTags);
  const pendingSaveRef = useRef<{ genre: string; tone: string; tags: string[] } | null>(null);

  const doSave = async (genre: string, tone: string, tags: string[]) => {
    if (!store.currentProject) return;
    const parts: string[] = [];
    if (genre) parts.push(`题材：${genre}`);
    if (tone) parts.push(`文风：${tone}`);
    if (tags.length > 0) parts.push(`看点：${tags.join('、')}`);
    const combined = parts.join('；');
    setTempStyleSetting(combined);
    try {
      await store.updateProject(store.currentProject!.id, {
        styleSetting: combined,
        description: genre || store.currentProject!.description,
        worldSetting: tags.join('、') || store.currentProject!.worldSetting,
      });
      createVersionSnapshot({
        projectId: store.currentProject!.id,
        type: 'macro',
        key: 'styleSetting',
        label: '风格基调',
        data: combined,
        source: 'auto',
      });
    } catch { /* ignore */ }
  };

  const doSaveRef = useRef(doSave);
  doSaveRef.current = doSave;

  useEffect(() => {
    if (selectedGenre === prevGenreRef.current && selectedTone === prevToneRef.current && selectedTags === prevTagsRef.current) return;
    prevGenreRef.current = selectedGenre;
    prevToneRef.current = selectedTone;
    prevTagsRef.current = selectedTags;
    pendingSaveRef.current = { genre: selectedGenre, tone: selectedTone, tags: selectedTags };

    if (!store.currentProject) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(async () => {
      pendingSaveRef.current = null;
      await doSave(selectedGenre, selectedTone, selectedTags);
    }, 1500);
  }, [selectedGenre, selectedTone, selectedTags, doSave, store.currentProject]);

  // 组件卸载时立即保存未提交的内容
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (pendingSaveRef.current) {
        const { genre, tone, tags } = pendingSaveRef.current;
        doSaveRef.current(genre, tone, tags);
      }
    };
  }, []);

  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  // 推演完整设定
  const handleDeduceFull = async () => {
    const result = await fetchKernelOptions();
    if (result === 'needStyle') {
      alert('请先选择题材、文风与看点，再进行设定推演。');
    }
  };

  // 根据大类筛选显示的题材
  const filteredGenres = activeGenreCategory
    ? GENRE_CATEGORIES.find(c => c.id === activeGenreCategory)?.genres || []
    : GENRE_CATEGORIES.flatMap(c => c.genres);

  const sectionHeaderStyle = (): React.CSSProperties => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 20px',
    cursor: 'pointer',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border-light)',
    borderRadius: '10px',
    transition: 'background 0.2s',
  });

  // 风格基调是否已配置（三个维度都必须选择）
  const isStyleConfigured = selectedGenre.trim() && selectedTone.trim() && selectedTags.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* 推演完整设定按钮 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', flexShrink: 0, flexWrap: 'wrap' }}>
        {!isStyleConfigured && (
          <span style={{ fontSize: '11px', color: '#f59e0b' }}>
            请先配置{!selectedGenre.trim() ? '题材分类' : ''}{!selectedGenre.trim() && !selectedTone.trim() ? '、' : ''}{!selectedTone.trim() ? '文风调性' : ''}{(!selectedGenre.trim() || !selectedTone.trim()) && selectedTags.length === 0 ? '、' : ''}{selectedTags.length === 0 ? '故事看点' : ''}，再推演完整设定
          </span>
        )}
        <button
          className="btn btn-secondary"
          onClick={handleDeduceFull}
          disabled={isKernelLoading || !isStyleConfigured}
          style={{
            fontSize: '12px',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            opacity: isStyleConfigured ? 1 : 0.4,
          }}
        >
          {isKernelLoading ? <Loader2 className="animate-spin" size={13} /> : <Sparkles size={13} style={{ color: 'var(--accent)' }} />}
          <span>{isKernelLoading && kernelProgress ? kernelProgress : '推演完整设定'}</span>
        </button>
      </div>

      {/* 维度1：题材分类 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        <div onClick={() => toggleSection('genre')} style={sectionHeaderStyle()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h5 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', margin: 0 }}>题材分类</h5>
            {selectedGenre && (
              <span style={{ fontSize: '11px', color: 'var(--accent)', background: 'rgba(99,102,241,0.08)', padding: '2px 8px', borderRadius: '4px' }}>
                {selectedGenre}
              </span>
            )}
          </div>
          {collapsedSections['genre'] ? <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} />}
        </div>

        {!collapsedSections['genre'] && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px 20px', border: '1px solid var(--border-light)', borderTop: 'none', borderRadius: '0 0 10px 10px', background: 'rgba(255,255,255,0.01)' }}>
            {/* 大类 Tab */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px' }}>
              <button
                type="button"
                onClick={() => setActiveGenreCategory(null)}
                style={{
                  padding: '4px 10px', fontSize: '11px', borderRadius: '16px',
                  border: !activeGenreCategory ? '1px solid var(--accent)' : '1px solid var(--border-light)',
                  background: !activeGenreCategory ? 'rgba(99,102,241,0.1)' : 'transparent',
                  color: !activeGenreCategory ? '#fff' : 'var(--text-muted)',
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                全部
              </button>
              {GENRE_CATEGORIES.map(category => {
                const isActive = activeGenreCategory === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setActiveGenreCategory(isActive ? null : category.id)}
                    style={{
                      padding: '4px 10px', fontSize: '11px', borderRadius: '16px',
                      border: isActive ? '1px solid var(--accent)' : '1px solid var(--border-light)',
                      background: isActive ? 'rgba(99,102,241,0.1)' : 'transparent',
                      color: isActive ? '#fff' : 'var(--text-muted)',
                      cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                  >
                    {category.title}
                  </button>
                );
              })}
            </div>

            {/* 细分卡片网格 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
              {filteredGenres.map(genre => {
                const isSelected = selectedGenre === genre.name;
                return (
                  <div
                    key={genre.name}
                    onClick={() => setSelectedGenre(isSelected ? '' : genre.name)}
                    style={{
                      padding: '8px 10px', borderRadius: '8px',
                      background: isSelected ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.01)',
                      border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-light)'}`,
                      cursor: 'pointer', transition: 'all 0.15s',
                      boxShadow: isSelected ? '0 0 8px rgba(99,102,241,0.12)' : 'none',
                    }}
                  >
                    <div style={{ fontWeight: '600', fontSize: '12px', color: isSelected ? '#fff' : 'var(--text-main)', marginBottom: '2px' }}>{genre.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4' }}>{genre.desc}</div>
                  </div>
                );
              })}
            </div>

            {/* 自定义题材 - 输入即确认 */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                className="input"
                placeholder="输入自定义题材..."
                value={customGenreInput}
                onChange={e => setCustomGenreInput(e.target.value)}
                onBlur={() => {
                  const trimmed = customGenreInput.trim();
                  if (trimmed) { setSelectedGenre(trimmed); setCustomGenreInput(''); }
                }}
                style={{ fontSize: '12px', padding: '6px 10px' }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const trimmed = customGenreInput.trim();
                  if (trimmed) { setSelectedGenre(trimmed); setCustomGenreInput(''); }
                }}
                style={{ fontSize: '11px', padding: '4px 10px' }}
              >
                确定
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 维度2：文风调性 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        <div onClick={() => toggleSection('tone')} style={sectionHeaderStyle()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h5 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', margin: 0 }}>文风调性</h5>
            {selectedTone && (
              <span style={{ fontSize: '11px', color: 'var(--accent)', background: 'rgba(99,102,241,0.08)', padding: '2px 8px', borderRadius: '4px' }}>
                {selectedTone}
              </span>
            )}
          </div>
          {collapsedSections['tone'] ? <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} />}
        </div>

        {!collapsedSections['tone'] && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px 20px', border: '1px solid var(--border-light)', borderTop: 'none', borderRadius: '0 0 10px 10px', background: 'rgba(255,255,255,0.01)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
              {TONES.map(tone => {
                const isSelected = selectedTone === tone.name;
                return (
                  <div
                    key={tone.name}
                    onClick={() => setSelectedTone(isSelected ? '' : tone.name)}
                    style={{
                      padding: '10px 12px', borderRadius: '8px',
                      background: isSelected ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.01)',
                      border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-light)'}`,
                      cursor: 'pointer', transition: 'all 0.15s',
                      boxShadow: isSelected ? '0 0 8px rgba(99,102,241,0.12)' : 'none',
                    }}
                  >
                    <div style={{ fontWeight: '600', fontSize: '12px', color: isSelected ? '#fff' : 'var(--text-main)', marginBottom: '2px' }}>{tone.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4' }}>{tone.desc}</div>
                  </div>
                );
              })}
            </div>

            {/* 自定义文风 */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                className="input"
                placeholder="输入自定义文风..."
                value={customToneInput}
                onChange={e => setCustomToneInput(e.target.value)}
                onBlur={() => {
                  const trimmed = customToneInput.trim();
                  if (trimmed) { setSelectedTone(trimmed); setCustomToneInput(''); }
                }}
                style={{ fontSize: '12px', padding: '6px 10px' }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const trimmed = customToneInput.trim();
                  if (trimmed) { setSelectedTone(trimmed); setCustomToneInput(''); }
                }}
                style={{ fontSize: '11px', padding: '4px 10px' }}
              >
                确定
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 维度3：故事看点 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        <div onClick={() => toggleSection('tags')} style={sectionHeaderStyle()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h5 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', margin: 0 }}>故事看点</h5>
            {selectedTags.length > 0 && (
              <span style={{ fontSize: '11px', color: 'var(--accent)', background: 'rgba(99,102,241,0.08)', padding: '2px 8px', borderRadius: '4px' }}>
                {selectedTags.length} 项
              </span>
            )}
          </div>
          {collapsedSections['tags'] ? <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} />}
        </div>

        {!collapsedSections['tags'] && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px 20px', border: '1px solid var(--border-light)', borderTop: 'none', borderRadius: '0 0 10px 10px', background: 'rgba(255,255,255,0.01)' }}>
            {PRESET_TAG_GROUPS.map(group => (
              <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>{group.title}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {group.tags.map(tag => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <div
                        key={tag}
                        onClick={() => handleToggleTag(tag)}
                        style={{
                          padding: '4px 10px', borderRadius: '14px',
                          background: isSelected ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.01)',
                          border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-light)'}`,
                          color: isSelected ? '#fff' : 'var(--text-muted)',
                          cursor: 'pointer', fontSize: '11px',
                          fontWeight: isSelected ? '600' : '400', transition: 'all 0.15s',
                        }}
                      >
                        {tag}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* 自定义标签 */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {selectedTags.filter(tag => !PRESET_TAG_GROUPS.some(g => g.tags.includes(tag))).map(tag => (
                <div
                  key={tag}
                  onClick={() => handleToggleTag(tag)}
                  style={{
                    padding: '4px 10px', borderRadius: '14px',
                    background: 'rgba(99,102,241,0.12)', border: '1px solid var(--accent)',
                    color: '#fff', cursor: 'pointer', fontSize: '11px', fontWeight: '600',
                  }}
                >
                  {tag}
                </div>
              ))}
              <input
                type="text"
                className="input"
                placeholder="输入自定义标签..."
                value={customTagInput}
                onChange={e => setCustomTagInput(e.target.value)}
                onBlur={() => {
                  const trimmed = customTagInput.trim();
                  if (trimmed && !selectedTags.includes(trimmed)) {
                    setSelectedTags(prev => [...prev, trimmed]);
                    setCustomTagInput('');
                  }
                }}
                style={{ fontSize: '12px', padding: '6px 10px', width: '180px' }}
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
                style={{ fontSize: '11px', padding: '4px 10px' }}
              >
                添加
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
