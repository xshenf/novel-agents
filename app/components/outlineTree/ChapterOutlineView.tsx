'use client';

import { Activity, User, Tag, BookOpen, Loader2 } from 'lucide-react';
import { parseCharacters, parseEmotionValue } from '@/lib/outlineParser';
import type { OutlineTreeController } from './types';

interface ChapterOutlineViewProps {
  ctrl: OutlineTreeController;
}

export function ChapterOutlineView({ ctrl }: ChapterOutlineViewProps) {
  const {
    localSections,
    selectedVolumeIdx,
    setSelectedVolumeIdx,
    flatChapters,
    hoveredPoint,
    setHoveredPoint,
    selectedChar,
    setSelectedChar,
    allCharacters,
    regeningIndex,
    editingChapterPath,
    editChapterForm,
    setEditingChapterPath,
    setEditChapterForm,
    saveChapterEditing,
  } = ctrl;

  // 折线图数据
  const points = flatChapters.map((ch, i) => {
    const N = Math.max(1, flatChapters.length);
    const x = 40 + ((800 - 80) * i) / N;
    const emotion = parseEmotionValue(ch.details);
    const y = 90 - (emotion * 0.7);
    return { x, y, val: emotion, title: ch.title };
  });
  const linePath = points
    .map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
    .join(' ');
  const areaPath = points.length > 0
    ? `${linePath} L${points[points.length - 1].x},90 L${points[0].x},90 Z`
    : '';

  return (
    <>
      {/* 顶部：分卷筛选 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {localSections.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
            {allCharacters.map((char) => (
              <button
                key={char}
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
              if (selectedVolumeIdx !== null && selectedVolumeIdx !== vIdx) return null;
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
    </>
  );
}
