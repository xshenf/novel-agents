'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { useWorkspace } from '../workspace-context';

export function NewChapterModal() {
  const { modals } = useWorkspace();
  const {
    showNewChapModal, setShowNewChapModal,
    newChapTitle, setNewChapTitle,
    handleCreateChapter,
  } = modals;

  if (!showNewChapModal) return null;

  return (
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
  );
}

export function NewCharModal() {
  const { modals } = useWorkspace();
  const {
    showNewCharModal, setShowNewCharModal,
    newCharName, setNewCharName, newCharRole, setNewCharRole, newCharAge, setNewCharAge,
    newCharIdentity, setNewCharIdentity, newCharPersonality, setNewCharPersonality,
    newCharGoals, setNewCharGoals, newCharState, setNewCharState,
    newCharForbidden, setNewCharForbidden,
    handleCreateCharacter,
  } = modals;

  if (!showNewCharModal) return null;

  return (
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
  );
}

export function NewRuleModal() {
  const { modals } = useWorkspace();
  const {
    showNewRuleModal, setShowNewRuleModal,
    newRuleName, setNewRuleName, newRuleType, setNewRuleType, newRuleDesc, setNewRuleDesc,
    handleCreateRule,
  } = modals;

  if (!showNewRuleModal) return null;

  return (
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
  );
}

export function EditProjectModal() {
  const { store, kernel } = useWorkspace();
  const {
    showEditProjectModal, setShowEditProjectModal,
    editProjTitle, setEditProjTitle, editProjStyle, setEditProjStyle,
    editProjWorld, setEditProjWorld, editProjDesc, setEditProjDesc,
    isEditProjectAiLoading,
    handleSaveProject, handleEditProjectAiPlan,
  } = kernel;

  if (!showEditProjectModal) return null;

  return (
    <div className="modal-overlay">
      <form className="modal-content glass-card" onSubmit={handleSaveProject} style={{ maxWidth: '600px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
          <div className="modal-title" style={{ margin: 0 }}>完善新书设定</div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleEditProjectAiPlan}
            disabled={isEditProjectAiLoading}
            style={{ fontSize: '11px', padding: '6px 12px', background: 'linear-gradient(135deg, var(--accent) 0%, #a5b4fc 100%)', border: 'none', boxShadow: 'none' }}
          >
            {isEditProjectAiLoading ? (
              <>
                <Loader2 size={11} className="animate-spin" style={{ marginRight: '4px' }} />
                <span>AI 推演中...</span>
              </>
            ) : (
              <>
                <Sparkles size={11} style={{ marginRight: '4px' }} />
                <span>一键 AI 智能推演</span>
              </>
            )}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>小说书名</label>
            <input required type="text" className="input" placeholder="输入您小说的名字..." value={editProjTitle} onChange={e => setEditProjTitle(e.target.value)} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>文风设定（可自定义输入，如：暗黑克苏鲁、轻快吐槽）</label>
            <input type="text" className="input" placeholder="输入文风偏好（如：传统仙侠正剧，快节奏爽文）..." value={editProjStyle} onChange={e => setEditProjStyle(e.target.value)} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>故事简介</label>
            <textarea className="textarea" placeholder="填写一句话简介或故事看点，有助于 AI 写作时紧扣主题..." value={editProjDesc} onChange={e => setEditProjDesc(e.target.value)} style={{ minHeight: '80px' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>核心世界观/背景描述</label>
            <textarea className="textarea" placeholder="在此补充世界的物理规则、力量体系等级、地理背景等（如：凡人修真，境界分为练气、筑基、金丹等）..." value={editProjWorld} onChange={e => setEditProjWorld(e.target.value)} style={{ minHeight: '120px' }} />
          </div>
        </div>

        <div className="modal-actions" style={{ marginTop: '20px', borderTop: '1px solid var(--border-light)', paddingTop: '14px' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setShowEditProjectModal(false)} disabled={isEditProjectAiLoading}>取消</button>
          <button type="submit" className="btn btn-primary" disabled={isEditProjectAiLoading}>保存设定</button>
        </div>
      </form>
    </div>
  );
}

export function AiDeductionModal() {
  const { kernel } = useWorkspace();
  const {
    showDeductionModal, setShowDeductionModal,
    isDeducting, deductingFieldLabel, deductionOptions,
    handleSelectDeductionOption
  } = kernel;

  if (!showDeductionModal) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content glass-card" style={{ maxWidth: '650px', width: '90%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
          <div className="modal-title" style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#fff' }}>
            AI 智能推演：{deductingFieldLabel}
          </div>
        </div>

        {isDeducting ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: '12px' }}>
            <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>正在为您推演 3 个高品质备选方案...</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '450px', overflowY: 'auto', paddingRight: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              请阅读以下推演方案，点击「选用」将其填入当前设定项中。
            </span>
            {deductionOptions.map((opt: any, idx: number) => (
              <div
                key={idx}
                style={{
                  padding: '14px 16px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  transition: 'border-color 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--accent)' }}>
                    方案 {idx + 1}：{opt.title}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleSelectDeductionOption(opt.content)}
                    style={{ fontSize: '11px', padding: '4px 12px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid var(--accent)' }}
                  >
                    选用
                  </button>
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                  {opt.content}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: '10px', borderTop: '1px solid var(--border-light)', paddingTop: '14px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setShowDeductionModal(false);
            }}
            disabled={isDeducting}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
