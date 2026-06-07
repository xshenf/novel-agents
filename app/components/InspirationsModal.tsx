'use client';

import { Sparkles, Loader2, User, Globe, RefreshCw } from 'lucide-react';
import { useWorkspace } from '../workspace-context';

export function InspirationsModal() {
  const { ui, assist } = useWorkspace();
  const { isAiLoading } = ui;
  const {
    showInspirationsModal, setShowInspirationsModal,
    isInspirationLoading,
    inspCharacters, setInspCharacters, inspRules, setInspRules,
    activeInspTab, setActiveInspTab, handleOpenInspirations, handleImportInspirations,
  } = assist;

  if (!showInspirationsModal) return null;

  const checkedCharsCount = inspCharacters.filter(c => c.checked).length;
  const checkedRulesCount = inspRules.filter(r => r.checked).length;
  const totalChecked = checkedCharsCount + checkedRulesCount;

  return (
    <div className="modal-overlay" style={{ zIndex: 1001 }}>
      <div className="modal-content glass-card" style={{ maxWidth: '850px', maxHeight: '90vh', width: '90%' }}>
        <div className="modal-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} style={{ color: 'var(--accent)' }} />
            AI 多维度设定灵感库
          </span>
          <button type="button" className="btn-icon" onClick={() => setShowInspirationsModal(false)} style={{ fontSize: '18px' }}>
            &times;
          </button>
        </div>

        {isInspirationLoading ? (
          <div style={{ padding: '60px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
            <Loader2 className="animate-spin" size={36} style={{ color: 'var(--accent)' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>AI 正在根据小说背景规划多维度人物与世界观设定...</span>
          </div>
        ) : (
          <>
            {/* 多维度 Tab */}
            <div className="tab-container" style={{ marginBottom: '15px' }}>
              <button
                type="button"
                className={`tab-btn ${activeInspTab === 'char' ? 'active' : ''}`}
                onClick={() => setActiveInspTab('char')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <User size={14} />
                <span>推荐人物设定 ({inspCharacters.length})</span>
              </button>
              <button
                type="button"
                className={`tab-btn ${activeInspTab === 'rule' ? 'active' : ''}`}
                onClick={() => setActiveInspTab('rule')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Globe size={14} />
                <span>推荐世界观与道具设定 ({inspRules.length})</span>
              </button>
            </div>

            {/* 灵感列表区 */}
            <div style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '55vh', paddingRight: '5px' }}>
              {activeInspTab === 'char' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {inspCharacters.length === 0 ? (
                    <div style={{ padding: '20px', color: 'var(--text-dark)', textAlign: 'center' }}>无生成的人物设定</div>
                  ) : (
                    inspCharacters.map((char, index) => (
                      <div
                        key={char.id}
                        className="glass-card"
                        style={{
                          padding: '16px',
                          borderLeft: char.checked ? '4px solid var(--accent)' : '1px solid var(--border-light)',
                          background: char.checked ? 'rgba(99, 102, 241, 0.03)' : 'transparent',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <input
                            type="checkbox"
                            checked={char.checked}
                            onChange={(e) => {
                              const newChars = [...inspCharacters];
                              newChars[index].checked = e.target.checked;
                              setInspCharacters(newChars);
                            }}
                            style={{ marginTop: '5px', cursor: 'pointer', width: '16px', height: '16px' }}
                          />

                          <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px' }}>
                              <input
                                type="text"
                                className="input"
                                value={char.name}
                                onChange={(e) => {
                                  const newChars = [...inspCharacters];
                                  newChars[index].name = e.target.value;
                                  setInspCharacters(newChars);
                                }}
                                placeholder="角色名"
                                style={{ padding: '6px 10px', fontSize: '13px' }}
                              />
                              <select
                                className="input"
                                value={char.role}
                                onChange={(e) => {
                                  const newChars = [...inspCharacters];
                                  newChars[index].role = e.target.value;
                                  setInspCharacters(newChars);
                                }}
                                style={{ padding: '6px 10px', fontSize: '13px', background: 'var(--bg-input)' }}
                              >
                                <option value="主角">主角</option>
                                <option value="男主">男主</option>
                                <option value="女主">女主</option>
                                <option value="配角">配角</option>
                                <option value="反派">反派</option>
                              </select>
                              <input
                                type="text"
                                className="input"
                                value={char.age}
                                onChange={(e) => {
                                  const newChars = [...inspCharacters];
                                  newChars[index].age = e.target.value;
                                  setInspCharacters(newChars);
                                }}
                                placeholder="年龄"
                                style={{ padding: '6px 10px', fontSize: '13px' }}
                              />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label style={{ fontSize: '11px', color: 'var(--text-dark)' }}>身份背景</label>
                              <input
                                type="text"
                                className="input"
                                value={char.identity}
                                onChange={(e) => {
                                  const newChars = [...inspCharacters];
                                  newChars[index].identity = e.target.value;
                                  setInspCharacters(newChars);
                                }}
                                placeholder="身份背景介绍..."
                                style={{ padding: '6px 10px', fontSize: '13px' }}
                              />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '11px', color: 'var(--text-dark)' }}>性格特征</label>
                                <input
                                  type="text"
                                  className="input"
                                  value={char.personality}
                                  onChange={(e) => {
                                    const newChars = [...inspCharacters];
                                    newChars[index].personality = e.target.value;
                                    setInspCharacters(newChars);
                                  }}
                                  placeholder="逗号隔开..."
                                  style={{ padding: '6px 10px', fontSize: '12px' }}
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '11px', color: 'var(--text-dark)' }}>行动目标</label>
                                <input
                                  type="text"
                                  className="input"
                                  value={char.goals}
                                  onChange={(e) => {
                                    const newChars = [...inspCharacters];
                                    newChars[index].goals = e.target.value;
                                    setInspCharacters(newChars);
                                  }}
                                  placeholder="逗号隔开..."
                                  style={{ padding: '6px 10px', fontSize: '12px' }}
                                />
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '11px', color: 'var(--text-dark)' }}>当前初始状态</label>
                                <input
                                  type="text"
                                  className="input"
                                  value={char.currentState}
                                  onChange={(e) => {
                                    const newChars = [...inspCharacters];
                                    newChars[index].currentState = e.target.value;
                                    setInspCharacters(newChars);
                                  }}
                                  placeholder="所处状态..."
                                  style={{ padding: '6px 10px', fontSize: '12px' }}
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '11px', color: 'var(--text-dark)' }}>写作禁忌</label>
                                <input
                                  type="text"
                                  className="input"
                                  value={char.forbidden}
                                  onChange={(e) => {
                                    const newChars = [...inspCharacters];
                                    newChars[index].forbidden = e.target.value;
                                    setInspCharacters(newChars);
                                  }}
                                  placeholder="逗号隔开..."
                                  style={{ padding: '6px 10px', fontSize: '12px' }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {inspRules.length === 0 ? (
                    <div style={{ padding: '20px', color: 'var(--text-dark)', textAlign: 'center' }}>无推荐的设定信息</div>
                  ) : (
                    inspRules.map((rule, index) => (
                      <div
                        key={rule.id}
                        className="glass-card"
                        style={{
                          padding: '16px',
                          borderLeft: rule.checked ? '4px solid var(--accent)' : '1px solid var(--border-light)',
                          background: rule.checked ? 'rgba(99, 102, 241, 0.03)' : 'transparent',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <input
                            type="checkbox"
                            checked={rule.checked}
                            onChange={(e) => {
                              const newRules = [...inspRules];
                              newRules[index].checked = e.target.checked;
                              setInspRules(newRules);
                            }}
                            style={{ marginTop: '5px', cursor: 'pointer', width: '16px', height: '16px' }}
                          />

                          <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                              <input
                                type="text"
                                className="input"
                                value={rule.name}
                                onChange={(e) => {
                                  const newRules = [...inspRules];
                                  newRules[index].name = e.target.value;
                                  setInspRules(newRules);
                                }}
                                placeholder="设定名称"
                                style={{ padding: '6px 10px', fontSize: '13px' }}
                              />
                              <select
                                className="input"
                                value={rule.type}
                                onChange={(e) => {
                                  const newRules = [...inspRules];
                                  newRules[index].type = e.target.value as WorldRule['type'];
                                  setInspRules(newRules);
                                }}
                                style={{ padding: '6px 10px', fontSize: '13px', background: 'var(--bg-input)' }}
                              >
                                <option value="faction">宗门势力/组织</option>
                                <option value="location">地理位置/地点</option>
                                <option value="item">法宝/神兵/道具</option>
                                <option value="rule">天道法则/修炼等级</option>
                                <option value="other">其他设定项</option>
                              </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label style={{ fontSize: '11px', color: 'var(--text-dark)' }}>设定描述</label>
                              <textarea
                                className="textarea"
                                value={rule.description}
                                onChange={(e) => {
                                  const newRules = [...inspRules];
                                  newRules[index].description = e.target.value;
                                  setInspRules(newRules);
                                }}
                                placeholder="输入设定的背景介绍或功能详细描述..."
                                style={{ padding: '6px 10px', fontSize: '13px', minHeight: '60px' }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* 弹窗底部操作 */}
            <div className="modal-actions" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '15px', marginTop: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={handleOpenInspirations} style={{ marginRight: 'auto' }}>
                <RefreshCw size={14} /> 重新生成
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowInspirationsModal(false)}>
                取消
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleImportInspirations}
                disabled={totalChecked === 0 || isAiLoading}
              >
                {isAiLoading ? <Loader2 className="animate-spin" size={14} /> : `导入勾选设定到本项目 (${totalChecked} 项)`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
