'use client';

import React, { useState } from 'react';
import { Character, WorldRule } from '@/lib/db';

export const CharacterCard = ({ 
  character, 
  onSave, 
  onDelete 
}: { 
  character: Character; 
  onSave: (id: string, updates: any) => Promise<void>; 
  onDelete: (id: string) => Promise<void>; 
}) => {
  const [name, setName] = useState(character.name);
  const [role, setRole] = useState(character.role);
  const [age, setAge] = useState(character.age);
  const [identity, setIdentity] = useState(character.identity);
  const [personality, setPersonality] = useState(character.personality.join(', '));
  const [goals, setGoals] = useState(character.goals.join(', '));
  const [currentState, setCurrentState] = useState(character.currentState);
  const [forbidden, setForbidden] = useState(character.forbidden.join(', '));
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      alert('姓名不能为空');
      return;
    }
    setIsSaving(true);
    try {
      await onSave(character.id, {
        name,
        role,
        age,
        identity,
        personality: personality.split(',').map(s => s.trim()).filter(Boolean),
        goals: goals.split(',').map(s => s.trim()).filter(Boolean),
        currentState,
        forbidden: forbidden.split(',').map(s => s.trim()).filter(Boolean),
      });
    } catch (e) {
      // 异常处理
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="glass-card animate-fade-in" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--border-light)', background: 'rgba(255, 255, 255, 0.015)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input 
            type="text" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '15px', fontWeight: '600', width: '120px', outline: 'none', borderBottom: '1px dashed var(--border-light)' }} 
          />
          <select 
            value={role} 
            onChange={e => setRole(e.target.value)} 
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: '4px', fontSize: '11px', color: 'var(--text-muted)', padding: '2px 6px', outline: 'none' }}
          >
            <option value="男主">男主</option>
            <option value="女主">女主</option>
            <option value="主角">主角</option>
            <option value="配角">配角</option>
            <option value="反派">反派</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving} style={{ padding: '4px 10px', fontSize: '11px', border: 'none' }}>
            {isSaving ? '保存中' : '保存'}
          </button>
          <button className="btn btn-secondary" onClick={() => { if(confirm(`确定删除角色 ${name} 吗？`)) onDelete(character.id) }} style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--accent-warning)', border: 'none' }}>
            删除
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ color: 'var(--text-dark)', fontSize: '11px' }}>年龄</span>
          <input type="text" className="input" value={age} onChange={e => setAge(e.target.value)} style={{ padding: '4px 8px', fontSize: '12px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ color: 'var(--text-dark)', fontSize: '11px' }}>性格（逗号隔开）</span>
          <input type="text" className="input" value={personality} onChange={e => setPersonality(e.target.value)} style={{ padding: '4px 8px', fontSize: '12px' }} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
        <span style={{ color: 'var(--text-dark)', fontSize: '11px' }}>身份背景</span>
        <input type="text" className="input" value={identity} onChange={e => setIdentity(e.target.value)} style={{ padding: '4px 8px', fontSize: '12px' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
        <span style={{ color: 'var(--text-dark)', fontSize: '11px' }}>行动目标</span>
        <input type="text" className="input" value={goals} onChange={e => setGoals(e.target.value)} style={{ padding: '4px 8px', fontSize: '12px' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
        <span style={{ color: 'var(--text-dark)', fontSize: '11px' }}>当前状态/心思</span>
        <input type="text" className="input" value={currentState} onChange={e => setCurrentState(e.target.value)} style={{ padding: '4px 8px', fontSize: '12px' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
        <span style={{ color: 'var(--text-dark)', fontSize: '11px' }}>写作禁忌</span>
        <input type="text" className="input" value={forbidden} onChange={e => setForbidden(e.target.value)} style={{ padding: '4px 8px', fontSize: '12px' }} />
      </div>
    </div>
  );
};

export const AddCharacterCard = ({ 
  projectId, 
  onAdd, 
  onCancel 
}: { 
  projectId: string; 
  onAdd: (char: any) => Promise<void>; 
  onCancel: () => void; 
}) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('配角');
  const [age, setAge] = useState('');
  const [identity, setIdentity] = useState('');
  const [personality, setPersonality] = useState('');
  const [goals, setGoals] = useState('');
  const [currentState, setCurrentState] = useState('');
  const [forbidden, setForbidden] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      await onAdd({
        projectId,
        name,
        role,
        age,
        identity,
        personality: personality.split(',').map(s => s.trim()).filter(Boolean),
        goals: goals.split(',').map(s => s.trim()).filter(Boolean),
        currentState,
        forbidden: forbidden.split(',').map(s => s.trim()).filter(Boolean),
        relationships: []
      });
      onCancel();
    } catch (e) {
      // 异常处理
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card animate-fade-in" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--accent)', background: 'rgba(99, 102, 241, 0.05)', marginBottom: '16px' }}>
      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--accent)', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
        新增角色卡资产
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <input required placeholder="姓名" type="text" className="input" value={name} onChange={e => setName(e.target.value)} style={{ padding: '4px 8px', fontSize: '12px' }} />
        <select className="input" value={role} onChange={e => setRole(e.target.value)} style={{ background: 'var(--bg-input)', padding: '4px 8px', fontSize: '12px', width: '100%', outline: 'none' }}>
          <option value="主角">主角</option>
          <option value="男主">男主</option>
          <option value="女主">女主</option>
          <option value="配角">配角</option>
          <option value="反派">反派</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <input placeholder="年龄 (如：23)" type="text" className="input" value={age} onChange={e => setAge(e.target.value)} style={{ padding: '4px 8px', fontSize: '12px' }} />
        <input placeholder="性格 (如：冷静, 腹黑)" type="text" className="input" value={personality} onChange={e => setPersonality(e.target.value)} style={{ padding: '4px 8px', fontSize: '12px' }} />
      </div>

      <input placeholder="身份背景 (如：前朝失忆皇子)" type="text" className="input" value={identity} onChange={e => setIdentity(e.target.value)} style={{ padding: '4px 8px', fontSize: '12px' }} />
      <input placeholder="行动目标 (如：保护女主)" type="text" className="input" value={goals} onChange={e => setGoals(e.target.value)} style={{ padding: '4px 8px', fontSize: '12px' }} />
      <input placeholder="当前状态 (如：开始怀疑女主)" type="text" className="input" value={currentState} onChange={e => setCurrentState(e.target.value)} style={{ padding: '4px 8px', fontSize: '12px' }} />
      <input placeholder="写作禁忌 (如：不能变得轻佻油滑)" type="text" className="input" value={forbidden} onChange={e => setForbidden(e.target.value)} style={{ padding: '4px 8px', fontSize: '12px' }} />

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} style={{ padding: '4px 10px', fontSize: '11px', border: 'none' }}>取消</button>
        <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ padding: '4px 10px', fontSize: '11px', border: 'none' }}>
          {isLoading ? '创建中' : '确认创建'}
        </button>
      </div>
    </form>
  );
};

export const WorldRuleCard = ({ 
  rule, 
  onSave, 
  onDelete 
}: { 
  rule: WorldRule; 
  onSave: (id: string, updates: any) => Promise<void>; 
  onDelete: (id: string) => Promise<void>; 
}) => {
  const [name, setName] = useState(rule.name);
  const [type, setType] = useState(rule.type);
  const [description, setDescription] = useState(rule.description);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !description.trim()) {
      alert('名称和描述不能为空');
      return;
    }
    setIsSaving(true);
    try {
      await onSave(rule.id, { name, type, description });
    } catch (e) {
      // 异常处理
    } finally {
      setIsSaving(false);
    }
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
            value={type} 
            onChange={e => setType(e.target.value as any)} 
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: '4px', fontSize: '11px', color: 'var(--text-muted)', padding: '2px 6px', outline: 'none' }}
          >
            <option value="location">地点</option>
            <option value="faction">势力</option>
            <option value="rule">法则</option>
            <option value="item">道具</option>
            <option value="other">其他</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving} style={{ padding: '3px 8px', fontSize: '11px', border: 'none' }}>
            {isSaving ? '保存中' : '保存'}
          </button>
          <button className="btn btn-secondary" onClick={() => { if(confirm(`确定删除设定项 ${name} 吗？`)) onDelete(rule.id) }} style={{ padding: '3px 8px', fontSize: '11px', color: 'var(--accent-warning)', border: 'none' }}>
            删除
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
        <textarea 
          className="textarea" 
          value={description} 
          onChange={e => setDescription(e.target.value)} 
          style={{ minHeight: '80px', fontSize: '12px', padding: '8px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border-light)', borderRadius: '6px', outline: 'none' }} 
        />
      </div>
    </div>
  );
};

export const AddWorldRuleCard = ({ 
  projectId, 
  onAdd, 
  onCancel 
}: { 
  projectId: string; 
  onAdd: (rule: any) => Promise<void>; 
  onCancel: () => void; 
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'location' | 'faction' | 'rule' | 'item' | 'other'>('location');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) return;
    setIsLoading(true);
    try {
      await onAdd({ projectId, name, type, description });
      onCancel();
    } catch (e) {
      // 异常处理
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card animate-fade-in" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid var(--accent)', background: 'rgba(99, 102, 241, 0.05)', marginBottom: '16px' }}>
      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--accent)', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
        新建设定项资产
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '10px' }}>
        <input required placeholder="设定项名称 (如：藏书阁)" type="text" className="input" value={name} onChange={e => setName(e.target.value)} style={{ padding: '4px 8px', fontSize: '12px' }} />
        <select className="input" value={type} onChange={e => setType(e.target.value as any)} style={{ background: 'var(--bg-input)', padding: '4px 8px', fontSize: '12px', outline: 'none' }}>
          <option value="location">地理位置/地点</option>
          <option value="faction">宗门势力/组织</option>
          <option value="rule">核心规则/法则</option>
          <option value="item">法宝/神兵/道具</option>
          <option value="other">其他设定</option>
        </select>
      </div>

      <textarea required placeholder="设定项的详细背景描述..." className="textarea" value={description} onChange={e => setDescription(e.target.value)} style={{ minHeight: '80px', fontSize: '12px', padding: '8px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border-light)', borderRadius: '6px', outline: 'none' }} />

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} style={{ padding: '3px 8px', fontSize: '11px', border: 'none' }}>取消</button>
        <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ padding: '3px 8px', fontSize: '11px', border: 'none' }}>
          {isLoading ? '创建中' : '确认创建'}
        </button>
      </div>
    </form>
  );
};
