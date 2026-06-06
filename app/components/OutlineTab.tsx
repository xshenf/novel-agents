'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useWorkspace } from '../workspace-context';
import { useAiClient } from '../hooks/useAiClient';
import { createVersionSnapshot } from '@/lib/versionSnapshot';
import { KernelDimensionsPanel } from './KernelDimensionsPanel';
import { CharacterManagementView } from './CharacterManagementView';
import { WorldRuleCard, AddWorldRuleCard } from './AssetCards';
import { WorldStateView } from './WorldStateView';
import { useMaterialTabs, MATERIALS_LIST } from '../hooks/useMaterialTabs';
import { OutlineSidebar } from './OutlineSidebar';

export function OutlineTab() {
  const { store, kernel } = useWorkspace();
  const {
    tempStyleSetting, setTempStyleSetting,
    tempWorldSetting, setTempWorldSetting,
    tempPowerSystem, setTempPowerSystem,
    tempGoldFinger, setTempGoldFinger,
    tempCoreConflict, setTempCoreConflict,
    tempFactionsMap, setTempFactionsMap,
    tempSellingPoints, setTempSellingPoints,
    isAddingRule, setIsAddingRule,
    expandedKernelCard, setExpandedKernelCard,
  } = kernel;

  const callAIApi = useAiClient();

  // 素材磁贴 / 大纲子 Tab 状态
  const {
    activeMaterial,
    handleSelectMaterial,
  } = useMaterialTabs();

  const [initingMaterial, setInitingMaterial] = useState<string | null>(null);

  const handleInitMaterialWithAi = async (materialId: string, label: string) => {
    if (!store.currentProject) return;
    setInitingMaterial(materialId);
    try {
      const prompt = `根据当前小说项目的信息，为小说设计一个专属的【${label}】。项目名：《${store.currentProject.title}》，简介：${store.currentProject.description || '无'}，文风：${store.currentProject.styleSetting || '无'}，世界观：${store.currentProject.worldSetting || '无'}，力量体系：${store.currentProject.powerSystem || '无'}。请详细编写其具体的设定，包含层级、规则、注意事项或具体示例。不要包含任何 Emoji 图标。直接输出设定正文，字数在 500 字以上。`;
      
      const controller = new AbortController();
      const res = await callAIApi({
        action: 'chat',
        projectId: store.currentProject.id,
        query: prompt,
        systemInstruction: '你是一个网络小说设定专家，擅长推演合理、严密的世界观和设定元素。直接输出文本设定，不要带任何 Markdown 标题或 Emoji 图标。'
      }, controller.signal);

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (data && data.reply) {
        let type: 'location' | 'faction' | 'rule' | 'item' | 'other' = 'rule';
        if (['currency', 'skillSystem', 'timeline'].includes(materialId)) type = 'rule';
        else if (['foreshadow', 'plot', 'subPlot', 'events'].includes(materialId)) type = 'other';
        else if (materialId === 'relation') type = 'other';

        await store.createWorldRule({
          projectId: store.currentProject.id,
          name: `${label}设定`,
          type,
          description: data.reply
        });
        
        createVersionSnapshot({
          projectId: store.currentProject.id,
          type: 'worldRule',
          key: 'init_' + materialId,
          label: `${label}初始化设定`,
          data: { name: `${label}设定`, type, description: data.reply },
          source: 'ai'
        });
      } else {
        alert('AI 推演未返回有效结果');
      }
    } catch (e: any) {
      alert(`AI 一键推演【${label}】失败: ` + e.message);
    } finally {
      setInitingMaterial(null);
    }
  };

  // 世界规则筛选映射
  const getFilteredRules = (material: string) => {
    if (!store.worldRules) return [];

    if (material === 'location') return store.worldRules.filter((r: any) => r.type === 'location');
    if (material === 'faction') return store.worldRules.filter((r: any) => r.type === 'faction');
    if (material === 'item') return store.worldRules.filter((r: any) => r.type === 'item');

    if (material === 'currency') return store.worldRules.filter((r: any) => r.type === 'rule' && r.name.includes('货币'));
    if (material === 'skillSystem') return store.worldRules.filter((r: any) => r.type === 'rule' && (r.name.includes('功法') || r.name.includes('技能') || r.name.includes('修炼') || r.name.includes('体系')));
    if (material === 'timeline') return store.worldRules.filter((r: any) => r.type === 'rule' && r.name.includes('时间线'));

    if (material === 'foreshadow') return store.worldRules.filter((r: any) => r.type === 'other' && r.name.includes('伏笔'));
    if (material === 'plot') return store.worldRules.filter((r: any) => r.type === 'other' && (r.name.includes('情节') || r.name.includes('脉络')));
    if (material === 'subPlot') return store.worldRules.filter((r: any) => r.type === 'other' && r.name.includes('支线'));
    if (material === 'events') return store.worldRules.filter((r: any) => r.type === 'other' && r.name.includes('事件'));
    if (material === 'relation') return store.worldRules.filter((r: any) => r.type === 'other' && r.name.includes('关系'));

    return store.worldRules;
  };

  return (
    <div style={{ display: 'flex', flex: '1', minHeight: 0, overflow: 'hidden', position: 'relative' }}>
      <OutlineSidebar
        activeMaterial={activeMaterial}
        onSelectMaterial={handleSelectMaterial}
      />

      {/* 右侧动态主面板 */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: 'rgba(10, 10, 15, 0.2)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {['worldSetting', 'coreConflict', 'sellingPoints', 'powerSystem', 'specialSetting'].includes(activeMaterial) && (
          <KernelDimensionsPanel
            activeMaterial={activeMaterial}
            tempWorldSetting={tempWorldSetting}
            setTempWorldSetting={setTempWorldSetting}
            tempCoreConflict={tempCoreConflict}
            setTempCoreConflict={setTempCoreConflict}
            tempPowerSystem={tempPowerSystem}
            setTempPowerSystem={setTempPowerSystem}
            tempGoldFinger={tempGoldFinger}
            setTempGoldFinger={setTempGoldFinger}
            tempStyleSetting={tempStyleSetting}
            setTempStyleSetting={setTempStyleSetting}
            tempSellingPoints={tempSellingPoints}
            setTempSellingPoints={setTempSellingPoints}
            expandedKernelCard={expandedKernelCard}
            setExpandedKernelCard={setExpandedKernelCard}
            currentProject={store.currentProject}
            updateProject={store.updateProject}
          />
        )}

        {/* 4. 角色管理视图 (character) */}
        {activeMaterial === 'character' && (
          <CharacterManagementView store={store} isAddingChar={kernel.isAddingChar} setIsAddingChar={kernel.setIsAddingChar} createVersionSnapshot={createVersionSnapshot} />
        )}

        {/* 4.5. 世界状态视图 (worldState) */}
        {activeMaterial === 'worldState' && (
          <WorldStateView store={store} />
        )}

        {/* 5. 扩展设定与世界设定资产库 (location, faction, item, currency, skillSystem, relation, foreshadow, plot, subPlot, timeline, events) */}
        {['location', 'faction', 'item', 'currency', 'skillSystem', 'timeline', 'foreshadow', 'plot', 'subPlot', 'events', 'relation'].includes(activeMaterial) && (
          (() => {
            const currentRules = getFilteredRules(activeMaterial);
            const materialLabel = MATERIALS_LIST.find(m => m.id === activeMaterial)?.label || '';
            const materialColor = MATERIALS_LIST.find(m => m.id === activeMaterial)?.color || 'var(--accent)';

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '30px', minHeight: 0, overflowY: 'auto', flexGrow: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: 0 }}>
                      {materialLabel}资产库 ({currentRules.length})
                    </h4>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      管理本小说的{materialLabel}，可在写作推演中被随时引用与核对
                    </span>
                  </div>
                  
                  {!isAddingRule && store.currentProject && (
                    <button
                      className="btn btn-primary"
                      onClick={() => setIsAddingRule(true)}
                      style={{ fontSize: '11px', padding: '6px 12px', background: 'var(--accent)', border: 'none' }}
                    >
                      新建设定项
                    </button>
                  )}
                </div>

                {isAddingRule && store.currentProject && (
                  <AddWorldRuleCard
                    projectId={store.currentProject.id}
                    onAdd={async (rule) => {
                      let targetType: 'location' | 'faction' | 'rule' | 'item' | 'other' = 'other';
                      if (activeMaterial === 'location') targetType = 'location';
                      else if (activeMaterial === 'faction') targetType = 'faction';
                      else if (activeMaterial === 'item') targetType = 'item';
                      else if (['currency', 'skillSystem', 'timeline'].includes(activeMaterial)) targetType = 'rule';
                      
                      await store.createWorldRule({
                        ...rule,
                        type: targetType,
                        name: rule.name.includes(materialLabel) ? rule.name : `${materialLabel}：${rule.name}`
                      });
                      setIsAddingRule(false);
                    }}
                    onCancel={() => setIsAddingRule(false)}
                  />
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1 }}>
                  {currentRules.length === 0 && !isAddingRule ? (
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
                        当前尚未有【{materialLabel}】相关的数据资产
                      </div>
                      
                      <button
                        type="button"
                        disabled={initingMaterial === activeMaterial}
                        onClick={() => handleInitMaterialWithAi(activeMaterial, materialLabel)}
                        style={{
                          fontSize: '12px',
                          padding: '8px 16px',
                          background: `${materialColor}20`,
                          border: `1px solid ${materialColor}50`,
                          color: materialColor,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s',
                        }}
                      >
                        {initingMaterial === activeMaterial ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>AI 推演生成中...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={13} />
                            <span>一键 AI 智能推演初始化</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    currentRules.map((rule) => (
                      <WorldRuleCard
                        key={rule.id}
                        rule={rule}
                        onSave={async (id, updates) => {
                          await store.updateWorldRule(id, updates);
                          createVersionSnapshot({
                            projectId: store.currentProject!.id,
                            type: 'worldRule',
                            key: id,
                            label: `${updates.name || rule.name}`,
                            data: updates,
                            source: 'auto',
                          });
                        }}
                        onDelete={async (id) => {
                          await store.deleteWorldRule(id);
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
