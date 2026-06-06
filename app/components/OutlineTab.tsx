'use client';

import { useState } from 'react';
import { Save, Loader2, Eye, Edit3 } from 'lucide-react';
import { useWorkspace } from '../workspace-context';

interface OutlineSection {
  title: string;
  content: string;
  details: { key: string; value: string }[];
}

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

export function OutlineTab() {
  const { store, kernel } = useWorkspace();
  const {
    tempOutlineFull, setTempOutlineFull,
    kernelOptions, isKernelLoading,
  } = kernel;

  const [viewMode, setViewMode] = useState<'structure' | 'editor'>('structure');
  const sections = parseStructureOutline(tempOutlineFull);

  return (
    <div style={{ display: 'flex', flex: '1', minHeight: 0, padding: '30px', gap: '30px', overflowY: 'auto' }}>
      {/* 左栏：当前完整故事大纲 */}
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: 0 }}>
              完整故事大纲
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
                alert('大纲保存成功！');
              } catch (e) { alert('大纲保存失败'); }
            }}
            style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Save size={13} />
            <span>保存大纲修改</span>
          </button>
        </div>

        {viewMode === 'editor' ? (
          <textarea
            className="textarea"
            placeholder="在此起草或微调本书的起承转合、主线任务及结局走向..."
            value={tempOutlineFull}
            onChange={e => setTempOutlineFull(e.target.value)}
            style={{ flexGrow: 1, minHeight: '400px', fontSize: '13px', lineHeight: '1.7', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: '10px' }}
          />
        ) : (
          <div style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '6px', minHeight: 0 }}>
            {sections.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 20px', gap: '10px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', border: '1px dashed var(--border-light)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-dark)' }}>当前大纲内容为空，请切换到「文本编辑」录入或在右侧选用 AI 推荐大纲。</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingLeft: '8px', borderLeft: '2px solid rgba(99,102,241,0.15)', marginLeft: '6px', position: 'relative' }}>
                {sections.map((sec, idx) => (
                  <div key={idx} style={{ position: 'relative' }}>
                    {/* 时间线连接点 */}
                    <div style={{
                      position: 'absolute',
                      left: '-15px',
                      top: '24px',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--accent) 0%, #a5b4fc 100%)',
                      boxShadow: '0 0 8px rgba(99,102,241,0.5)',
                      zIndex: 2
                    }} />

                    {/* 卡片 */}
                    <div
                      className="glass-card"
                      style={{
                        padding: '20px',
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '12px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)';
                        e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = '';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                        e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%)';
                      }}
                    >
                      <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#fff', margin: '0 0 10px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                        {sec.title}
                      </h4>
                      {sec.content && (
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', margin: '0 0 16px 0', whiteSpace: 'pre-wrap' }}>
                          {sec.content}
                        </p>
                      )}
                      {sec.details.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                          {sec.details.map((det, dIdx) => (
                            <div
                              key={dIdx}
                              style={{
                                padding: '10px 12px',
                                background: 'rgba(0,0,0,0.2)',
                                border: '1px solid rgba(255,255,255,0.03)',
                                borderRadius: '6px'
                              }}
                            >
                              <div style={{ fontSize: '10.5px', color: 'var(--accent)', fontWeight: '600', letterSpacing: '0.5px', marginBottom: '4px' }}>
                                {det.key}
                              </div>
                              <div style={{ fontSize: '12px', color: '#e2e8f0', lineHeight: '1.5' }}>
                                {det.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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

