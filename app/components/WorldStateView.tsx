'use client';

import { useState, useRef, useEffect } from 'react';
import { Loader2, Lock, Unlock, Plus, Trash2, Sparkles } from 'lucide-react';
import type { NovelStore } from '@/lib/store';
import type { WorldState } from '@/lib/db';
import { useAiClient } from '../hooks/useAiClient';

const CATEGORIES = ['势力格局', '主角境界', '当前所在地', '时间进度', '关键物品', '其他'];

// 单条世界状态卡片：支持行内编辑 + debounce 自动保存 + 锁定切换
function WorldStateCard({
  state,
  onSave,
  onDelete,
}: {
  state: WorldState;
  onSave: (id: string, updates: Partial<WorldState>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { store } = useWorkspaceViaProps();
  const [name, setName] = useState(state.name);
  const [category, setCategory] = useState(state.category);
  const [content, setContent] = useState(state.content);
  const [pinned, setPinned] = useState(state.pinned);
  const [isSaving, setIsSaving] = useState(false);

  // debounce 2s 自动保存
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const prevRef = useRef({ name, category, content });
  useEffect(() => {
    const curr = { name, category, content };
    if (JSON.stringify(prevRef.current) === JSON.stringify(curr)) return;
    prevRef.current = curr;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!name.trim()) return;
      try {
        await onSave(state.id, { name, category, content });
      } catch { /* ignore */ }
    }, 2000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [name, category, content]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await onSave(state.id, { name, category, content });
    } catch { /* ignore */ }
    finally {
      setIsSaving(false);
    }
  };

  const handleTogglePinned = async () => {
    const next = !pinned;
    setPinned(next);
    await onSave(state.id, { pinned: next });
  };

  return (
    <div className="glass-card animate-fade-in" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid var(--border-light)', background: 'rgba(255, 255, 255, 0.015)', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '13px', fontWeight: '600', width: '130px', outline: 'none', borderBottom: '1px dashed var(--border-light)' }}
          />
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: '4px', fontSize: '11px', color: 'var(--text-muted)', padding: '2px 6px', outline: 'none' }}
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={handleTogglePinned}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', color: pinned ? '#f59e0b' : 'var(--text-muted)' }}
            title={pinned ? '已锁定，AI 不会覆盖' : '未锁定，AI 可更新'}
          >
            {pinned ? <Lock size={14} /> : <Unlock size={14} />}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving} style={{ padding: '3px 8px', fontSize: '11px', border: 'none' }}>
            {isSaving ? '保存中' : '保存'}
          </button>
          <button className="btn btn-secondary" onClick={() => store.showConfirm(`确定删除世界状态 ${name} 吗？`, () => onDelete(state.id))} style={{ padding: '3px 8px', fontSize: '11px', color: 'var(--accent-warning)', border: 'none' }}>
            删除
          </button>
        </div>
      </div>

      <textarea
        className="textarea"
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="描述当前状态..."
        rows={3}
        style={{ width: '100%', fontSize: '12px', resize: 'vertical' }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
        <span>来源：{state.source === 'ai' ? 'AI 自动' : '手动'}</span>
        {state.updatedAtChapter && <span>更新于：{state.updatedAtChapter}</span>}
      </div>
    </div>
  );
}

// 临时辅助：WorldStateCard 需要 store 的 showConfirm，通过 props 传递不方便，
// 这里用一个轻量 hook 从 workspace-context 取 store
function useWorkspaceViaProps() {
  // 直接从 zustand store 取（避免循环依赖）
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useNovelStore } = require('@/lib/store');
  return { store: useNovelStore.getState() };
}

// 新增世界状态卡片
function AddWorldStateCard({
  projectId,
  onAdd,
  onCancel,
}: {
  projectId: string;
  onAdd: (item: Omit<WorldState, 'id' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('其他');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      await onAdd({
        projectId,
        category,
        name,
        content,
        pinned: false,
        source: 'manual',
        updatedAtChapter: '',
      });
    } catch { /* ignore */ }
    finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card animate-fade-in" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px dashed rgba(34,211,238,0.3)', background: 'rgba(34,211,238,0.03)', marginBottom: '16px' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <input placeholder="条目名称" type="text" className="input" value={name} onChange={e => setName(e.target.value)} style={{ padding: '4px 8px', fontSize: '12px', flex: 1 }} />
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: '4px', fontSize: '11px', color: 'var(--text-muted)', padding: '4px 6px', outline: 'none' }}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <textarea placeholder="描述当前状态..." className="textarea" value={content} onChange={e => setContent(e.target.value)} rows={3} style={{ fontSize: '12px', resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} style={{ padding: '4px 10px', fontSize: '11px', border: 'none' }}>取消</button>
        <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ padding: '4px 10px', fontSize: '11px', border: 'none' }}>
          {isLoading ? '创建中' : '确认创建'}
        </button>
      </div>
    </form>
  );
}

// 世界状态主视图
export function WorldStateView({ store }: { store: NovelStore }) {
  const [isAdding, setIsAdding] = useState(false);
  const [isAiRefreshing, setIsAiRefreshing] = useState(false);
  const callAIApi = useAiClient();

  const worldStates = store.worldStates;
  const projectId = store.currentProject?.id;

  // 按 category 分组
  const grouped: Record<string, WorldState[]> = {};
  worldStates.forEach(s => {
    const cat = s.category || '其他';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  });

  const handleAiRefresh = async () => {
    if (!projectId) return;
    setIsAiRefreshing(true);
    try {
      await callAIApi({ action: 'foldWorldState', projectId });
      await store.fetchWorldStates(projectId);
    } catch (e) {
      console.error('AI 复盘世界状态失败:', e);
    } finally {
      setIsAiRefreshing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '30px', minHeight: 0, overflowY: 'auto', flexGrow: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: 0 }}>
            世界状态 ({worldStates.length})
          </h4>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            随剧情演化的动态世界信息，AI 每章写完后自动维护
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleAiRefresh}
            disabled={isAiRefreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 12px', background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)', color: '#22d3ee', borderRadius: '6px', cursor: 'pointer' }}
            title="让 AI 基于最新剧情复盘世界状态"
          >
            {isAiRefreshing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            AI 复盘世界状态
          </button>
          {!isAdding && projectId && (
            <button
              className="btn btn-primary"
              onClick={() => setIsAdding(true)}
              style={{ fontSize: '11px', padding: '6px 12px', background: 'var(--accent)', border: 'none' }}
            >
              <Plus size={12} style={{ display: 'inline', marginRight: '4px' }} />
              新建状态条目
            </button>
          )}
        </div>
      </div>

      {isAdding && projectId && (
        <AddWorldStateCard
          projectId={projectId}
          onAdd={async (item) => {
            await store.createWorldState(item);
            setIsAdding(false);
          }}
          onCancel={() => setIsAdding(false)}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1 }}>
        {worldStates.length === 0 && !isAdding ? (
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
              当前尚未有世界状态数据
            </div>
            <button
              onClick={handleAiRefresh}
              disabled={isAiRefreshing}
              style={{
                fontSize: '12px',
                padding: '8px 16px',
                background: 'rgba(34,211,238,0.12)',
                border: '1px solid rgba(34,211,238,0.3)',
                color: '#22d3ee',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isAiRefreshing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              一键 AI 复盘初始化
            </button>
          </div>
        ) : (
          // 按 category 分组渲染
          Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div style={{ fontSize: '12px', color: '#22d3ee', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22d3ee', display: 'inline-block' }} />
                {cat}（{items.length}）
              </div>
              {items.map(s => (
                <WorldStateCard
                  key={s.id}
                  state={s}
                  onSave={async (id, updates) => {
                    await store.updateWorldState(id, updates);
                  }}
                  onDelete={async (id) => {
                    await store.deleteWorldState(id);
                  }}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
