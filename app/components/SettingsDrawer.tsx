'use client';

import { Settings } from 'lucide-react';
import { useWorkspace } from '../workspace-context';

export function SettingsDrawer() {
  const { store, models } = useWorkspace();
  const {
    showSettings, setShowSettings, settingsTab, setSettingsTab,
    editingModelId, setEditingModelId, editModelForm, setEditModelForm,
    testStatus, testMessage, handleTestConnection,
    fetchedModels, setFetchedModels, fetchingModels, fetchModelsError, handleFetchModels,
    handleAddNewModel, handleEditModel, handleSaveModel, agentsList,
  } = models;

  return (
    <>
      {/* 遮罩层 */}
      <div
        className={`drawer-overlay ${showSettings ? 'active' : ''}`}
        onClick={() => { setShowSettings(false); setEditingModelId(null); }}
      />

      {/* 抽屉本体 */}
      <div className={`drawer-content ${showSettings ? 'active' : ''}`}>
        <div className="drawer-header">
          <div className="drawer-title">
            <Settings size={20} style={{ color: 'var(--accent)' }} />
            <span>智能写作大模型控制台</span>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={() => { setShowSettings(false); setEditingModelId(null); }}
            style={{ fontSize: '20px', lineHeight: '1' }}
          >
            &times;
          </button>
        </div>

        {/* 抽屉 Tab 导航栏 */}
        <div className="drawer-tabs">
          <button
            type="button"
            className={`drawer-tab-btn ${settingsTab === 'models' ? 'active' : ''}`}
            onClick={() => { setSettingsTab('models'); setEditingModelId(null); }}
          >
            模型池管理
          </button>
          <button
            type="button"
            className={`drawer-tab-btn ${settingsTab === 'bindings' ? 'active' : ''}`}
            onClick={() => { setSettingsTab('bindings'); setEditingModelId(null); }}
          >
            智能体分配
          </button>
          <button
            type="button"
            className={`drawer-tab-btn ${settingsTab === 'prompts' ? 'active' : ''}`}
            onClick={() => { setSettingsTab('prompts'); setEditingModelId(null); }}
          >
            全局写作提示词
          </button>
        </div>

        <div className="drawer-body">
          {/* TAB 1: 模型池管理 */}
          {settingsTab === 'models' && (
            <>
              {editingModelId === null ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    配置您所拥有的多个 API 模型账号，之后可任意绑定给系统内的专业智能体。
                  </div>
                  <div className="model-grid">
                    {store.models.map((model) => {
                      const isDefault = store.agentModelBindings['orchestrator'] === model.id;
                      return (
                        <div
                          key={model.id}
                          className={`model-card ${isDefault ? 'active' : ''}`}
                          onClick={() => handleEditModel(model)}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ fontWeight: '600', color: '#fff', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                                {model.alias}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase' }}>
                                {model.provider} / {model.name}
                              </div>
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-dark)' }}>
                              Temp: {model.temperature} | Tokens: {model.maxTokens}
                            </div>
                          </div>
                          {isDefault && <span className="model-card-badge">总控默认</span>}
                          {store.models.length > 1 && (
                            <button
                              type="button"
                              className="model-card-delete-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                store.showConfirm(`确定要删除模型「${model.alias}」吗？`, () => {
                                  store.deleteModel(model.id);
                                });
                              }}
                            >
                              删除
                            </button>
                          )}
                        </div>
                      );
                    })}
                    <div className="model-card-add" onClick={handleAddNewModel}>
                      <span>+ 录入新模型</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* 模型编辑与新建表单 */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
                      {editingModelId === 'new' ? '录入新模型配置' : `编辑模型: ${editModelForm.alias}`}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setEditingModelId(null)}
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                    >
                      返回列表
                    </button>
                  </div>

                  <div className="drawer-field">
                    <label className="drawer-label">模型别名 (区分不同模型配置)</label>
                    <input
                      type="text"
                      className="input"
                      value={editModelForm.alias}
                      onChange={(e) => setEditModelForm(prev => ({ ...prev, alias: e.target.value }))}
                      placeholder="例如: 智能大纲、备用 Gemini 等"
                    />
                  </div>

                  <div className="drawer-field">
                    <label className="drawer-label">接口服务商 (Provider)</label>
                    <select
                      className="input"
                      value={editModelForm.provider}
                      onChange={(e) => {
                        const prov = e.target.value;
                        let defaultName = 'gemini-2.5-flash';
                        let defaultBase = '';
                        if (prov === 'gemini') {
                          defaultName = 'gemini-2.5-flash';
                        } else if (prov === 'openai') {
                          defaultName = 'gpt-4o-mini';
                          defaultBase = 'https://api.openai.com/v1';
                        } else if (prov === 'deepseek') {
                          defaultName = 'deepseek-chat';
                          defaultBase = 'https://api.deepseek.com/v1';
                        } else if (prov === 'claude') {
                          defaultName = 'claude-3-5-sonnet-20241022';
                        }
                        setEditModelForm(prev => ({
                          ...prev,
                          provider: prov,
                          name: defaultName,
                          apiBaseUrl: defaultBase,
                        }));
                        setFetchedModels([]);
                      }}
                      style={{ background: 'var(--bg-input)' }}
                    >
                      <option value="gemini">Google Gemini</option>
                      <option value="openai">OpenAI</option>
                      <option value="deepseek">DeepSeek (深度求索)</option>
                      <option value="claude">Anthropic Claude</option>
                      <option value="custom">Custom (OpenAI 兼容中转)</option>
                    </select>
                  </div>

                  <div className="drawer-field">
                    <label className="drawer-label">API 密钥 (API Key)</label>
                    <input
                      type="password"
                      className="input"
                      value={editModelForm.apiKey}
                      onChange={(e) => setEditModelForm(prev => ({ ...prev, apiKey: e.target.value }))}
                      placeholder="输入 API 密钥 (留空则使用后端默认环境变量或本地 Mock)"
                    />
                  </div>

                  <div className="drawer-field">
                    <label className="drawer-label">自定义代理地址 (Base URL)</label>
                    <input
                      type="text"
                      className="input"
                      value={editModelForm.apiBaseUrl}
                      onChange={(e) => setEditModelForm(prev => ({ ...prev, apiBaseUrl: e.target.value }))}
                      placeholder="留空则使用各厂商默认请求网关"
                    />
                  </div>

                  <div className="drawer-field">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="drawer-label">模型名称选择 (Model Name)</label>
                      <button
                        type="button"
                        onClick={() => handleFetchModels(editModelForm)}
                        disabled={fetchingModels || !editModelForm.apiKey}
                        style={{
                          fontSize: '11px',
                          background: 'none',
                          border: 'none',
                          color: editModelForm.apiKey ? 'var(--accent)' : 'var(--text-dark)',
                          cursor: editModelForm.apiKey ? 'pointer' : 'default',
                          fontWeight: 500,
                        }}
                      >
                        {fetchingModels ? '正在获取...' : '在线获取模型列表'}
                      </button>
                    </div>
                    {fetchModelsError && (
                      <div style={{ fontSize: '11px', color: 'var(--accent-danger)', marginTop: '2px' }}>
                        {fetchModelsError}
                      </div>
                    )}
                    <select
                      className="input"
                      value={editModelForm.name}
                      onChange={(e) => setEditModelForm(prev => ({ ...prev, name: e.target.value }))}
                      style={{ background: 'var(--bg-input)' }}
                    >
                      {fetchedModels.length > 0 ? (
                        fetchedModels.map((model) => (
                          <option key={model} value={model}>{model}</option>
                        ))
                      ) : (
                        <>
                          {editModelForm.provider === 'gemini' && (
                            <>
                              <option value="gemini-2.5-flash">gemini-2.5-flash (快速, 推荐)</option>
                              <option value="gemini-2.5-pro">gemini-2.5-pro (深度创作)</option>
                              <option value="gemini-1.5-flash">gemini-1.5-flash (轻量)</option>
                            </>
                          )}
                          {editModelForm.provider === 'openai' && (
                            <>
                              <option value="gpt-4o-mini">gpt-4o-mini (经济极速, 推荐)</option>
                              <option value="gpt-4o">gpt-4o (全能旗舰)</option>
                              <option value="o3-mini">o3-mini (高级推理)</option>
                            </>
                          )}
                          {editModelForm.provider === 'deepseek' && (
                            <>
                              <option value="deepseek-chat">deepseek-chat (V3 极高性价比)</option>
                              <option value="deepseek-reasoner">deepseek-reasoner (R1 深度推理思考)</option>
                            </>
                          )}
                          {editModelForm.provider === 'claude' && (
                            <>
                              <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet (文学创作标杆)</option>
                              <option value="claude-3-5-haiku-20241022">claude-3-5-haiku (高速高能)</option>
                            </>
                          )}
                        </>
                      )}
                      <option value={editModelForm.name}>当前输入: {editModelForm.name}</option>
                    </select>
                  </div>

                  <div className="drawer-field">
                    <label className="drawer-label">手动输入其他模型名 (若下拉框中未列出)</label>
                    <input
                      type="text"
                      className="input"
                      value={editModelForm.name}
                      onChange={(e) => setEditModelForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="请输入真实模型名称"
                    />
                  </div>

                  <div className="drawer-field">
                    <label className="drawer-label">默认生成温度 (Temperature): {editModelForm.temperature.toFixed(1)}</label>
                    <div className="slider-container">
                      <input
                        type="range"
                        min="0"
                        max="2.0"
                        step="0.1"
                        className="slider-input"
                        value={editModelForm.temperature}
                        onChange={(e) => setEditModelForm(prev => ({ ...prev, temperature: Number(e.target.value) }))}
                      />
                    </div>
                  </div>

                  <div className="drawer-field">
                    <label className="drawer-label">单次最大生成长度 (Max Tokens)</label>
                    <input
                      type="number"
                      className="input"
                      min="100"
                      max="16000"
                      step="100"
                      value={editModelForm.maxTokens}
                      onChange={(e) => setEditModelForm(prev => ({ ...prev, maxTokens: Number(e.target.value) }))}
                    />
                  </div>

                  <div className="drawer-field">
                    <div className="switch-container">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '500', color: '#ffffff' }}>思考模型格式兼容</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>去除 R1 类似思考标记，优化输出格式</span>
                      </div>
                      <label className="switch-control">
                        <input
                          type="checkbox"
                          checked={editModelForm.reasoningEnabled}
                          onChange={(e) => setEditModelForm(prev => ({ ...prev, reasoningEnabled: e.target.checked }))}
                        />
                        <span className="switch-slider"></span>
                      </label>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>连接状态测试：</span>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleTestConnection(editModelForm)}
                        disabled={testStatus === 'testing' || !editModelForm.apiKey}
                      >
                        {testStatus === 'testing' ? '连接探测中...' : '测试此配置连通性'}
                      </button>
                    </div>
                    {testStatus !== 'idle' && (
                      <div className={`test-result-box ${testStatus === 'success' ? 'success' : testStatus === 'error' ? 'error' : ''}`} style={{ fontSize: '11.5px' }}>
                        {testMessage}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid var(--border-light)', paddingTop: '14px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditingModelId(null)}>取消</button>
                    <button type="button" className="btn btn-primary" onClick={handleSaveModel}>保存此模型</button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 2: 智能体模型绑定 */}
          {settingsTab === 'bindings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                将系统内的 5 大核心专业智能体角色，分别绑定至模型池中不同的模型并个性化微调其生成参数。
              </div>
              {agentsList.map(agent => {
                const boundModelId = store.agentModelBindings[agent.id] || store.models[0]?.id;
                const isOverrideActive = store.agentOverrides[agent.id] !== undefined;
                const overrideData = store.agentOverrides[agent.id] || {};

                return (
                  <div key={agent.id} className="agent-binding-card">
                    <div className="agent-binding-header">
                      <div className="agent-binding-title">
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: agent.color }}></span>
                        <span>{agent.label}</span>
                      </div>
                      <select
                        className="input"
                        value={boundModelId}
                        onChange={(e) => store.bindAgentModel(agent.id, e.target.value)}
                        style={{ width: '180px', padding: '4px 8px', fontSize: '12px', background: 'var(--bg-input)' }}
                      >
                        {store.models.map(m => (
                          <option key={m.id} value={m.id}>{m.alias} ({m.provider})</option>
                        ))}
                      </select>
                    </div>

                    {/* 开启特异性参数配置 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <input
                        type="checkbox"
                        id={`override-${agent.id}`}
                        checked={isOverrideActive}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const model = store.models.find(m => m.id === boundModelId) || store.models[0];
                            store.updateAgentOverride(agent.id, {
                              temperature: model ? model.temperature : 0.7,
                              maxTokens: model ? model.maxTokens : 3000,
                            });
                          } else {
                            store.updateAgentOverride(agent.id, null);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      <label htmlFor={`override-${agent.id}`} style={{ cursor: 'pointer' }}>为该智能体启用独立参数覆盖</label>
                    </div>

                    {/* 展开特异性参数微调区域 */}
                    {isOverrideActive && (
                      <div className="agent-override-box">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>专属生成温度 (Temperature)</span>
                            <span style={{ color: '#fff', fontWeight: '600' }}>{(overrideData.temperature ?? 0.7).toFixed(1)}</span>
                          </div>
                          <div className="slider-container">
                            <input
                              type="range"
                              min="0"
                              max="2.0"
                              step="0.1"
                              className="slider-input"
                              value={overrideData.temperature ?? 0.7}
                              onChange={(e) => store.updateAgentOverride(agent.id, { temperature: Number(e.target.value) })}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>专属最大生成长度 (Max Tokens)</span>
                            <span style={{ color: '#fff', fontWeight: '600' }}>{overrideData.maxTokens ?? 3000}</span>
                          </div>
                          <input
                            type="number"
                            className="input"
                            min="100"
                            max="16000"
                            step="100"
                            value={overrideData.maxTokens ?? 3000}
                            onChange={(e) => store.updateAgentOverride(agent.id, { maxTokens: Number(e.target.value) })}
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: 全局创作提示词 */}
          {settingsTab === 'prompts' && (
            <div className="drawer-section" style={{ borderBottom: 'none' }}>
              <div className="drawer-field">
                <label className="drawer-label">全局创作系统提示词前缀 (注入小说大纲前)</label>
                <textarea
                  className="textarea"
                  placeholder="配置对全部 AI 生效的宏观提示，例如：要求行文古色古香、强调悬疑逻辑、人物内心戏细腻等"
                  value={store.systemInstruction}
                  onChange={(e) => store.setSystemInstruction(e.target.value)}
                  style={{ minHeight: '180px', lineHeight: '1.6' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-dark)', marginTop: '4px' }}>
                  本提示词作为系统的全局基调，会自动附加在各智能体的任务提示之前，用以锁定小说整体文风。
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="drawer-footer">
          <button className="btn btn-primary" onClick={() => { setShowSettings(false); setEditingModelId(null); }}>保存配置并关闭</button>
        </div>
      </div>
    </>
  );
}
