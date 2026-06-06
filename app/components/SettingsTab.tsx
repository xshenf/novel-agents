'use client';

import { ChevronUp, ChevronDown, CheckCircle2 } from 'lucide-react';
import { useWorkspace } from '../workspace-context';
import { KernelDimensionCard } from './KernelDimensionCard';
import { CharacterCard, AddCharacterCard, WorldRuleCard, AddWorldRuleCard } from './AssetCards';
import { DEFAULT_ANTI_AI_RULES } from '@/lib/rules';

export function SettingsTab() {
  const { store, kernel } = useWorkspace();
  const {
    activeSettingsSubTab, setActiveSettingsSubTab,
    tempPowerSystem, setTempPowerSystem,
    tempGoldFinger, setTempGoldFinger,
    tempCoreConflict, setTempCoreConflict,
    tempFactionsMap, setTempFactionsMap,
    tempSellingPoints, setTempSellingPoints,
    tempStyleSetting, setTempStyleSetting,
    tempWorldSetting, setTempWorldSetting,
    expandedKernelCard, setExpandedKernelCard,
    isAddingChar, setIsAddingChar,
    isAddingRule, setIsAddingRule,
    ruleFilter, setRuleFilter,
    filteredRules,
  } = kernel;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '30px', gap: '20px', overflowY: 'auto', flexGrow: 1 }}>
      {/* 顶部的次级 Tab 切换 */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', gap: '16px', flexShrink: 0 }}>
        <button
          onClick={() => setActiveSettingsSubTab('kernel')}
          style={{
            background: 'none',
            border: 'none',
            color: activeSettingsSubTab === 'kernel' ? '#fff' : 'var(--text-muted)',
            fontSize: '14px',
            fontWeight: activeSettingsSubTab === 'kernel' ? '600' : 'normal',
            paddingBottom: '8px',
            borderBottom: activeSettingsSubTab === 'kernel' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          网文策划内核
        </button>
        <button
          onClick={() => setActiveSettingsSubTab('assets')}
          style={{
            background: 'none',
            border: 'none',
            color: activeSettingsSubTab === 'assets' ? '#fff' : 'var(--text-muted)',
            fontSize: '14px',
            fontWeight: activeSettingsSubTab === 'assets' ? '600' : 'normal',
            paddingBottom: '8px',
            borderBottom: activeSettingsSubTab === 'assets' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          故事资产管理
        </button>
      </div>

      {activeSettingsSubTab === 'kernel' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: 0 }}>核心设定矩阵</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              网络小说内核由 5 大设定维度共同支撑。您可以点击各展开项，微调具体内容，或一键选用 AI 为您推演的创意方案。
            </p>
          </div>

          <KernelDimensionCard
            cardKey="styleSetting"
            title="小说文风与题材基调"
            subtitle="定义小说的体裁定位、情感色调与写作偏好（如：快节奏爽文、热血升级、幽默吐槽等）"
            value={tempStyleSetting}
            setValue={setTempStyleSetting}
            cardType="styleSetting"
            placeholder="例如：都市超能体裁，快节奏神豪爽文，整体色调轻松幽默，节奏明快..."
          />

          <KernelDimensionCard
            cardKey="worldSetting"
            title="核心世界观背景描述"
            subtitle="定义小说主舞台的大陆疆域、宏观规则、历史背景与微观社会法则"
            value={tempWorldSetting}
            setValue={setTempWorldSetting}
            cardType="worldSetting"
            placeholder="例如：一个灵气衰退的仙侠世界，修行者寿元大减，凡人建立的机械帝国与修士宗门共存..."
          />

          <KernelDimensionCard
            cardKey="powerSystem"
            title="境界与力量体系"
            subtitle="定义主角及世界的修炼境界、超自然等级与晋升逻辑"
            value={tempPowerSystem}
            setValue={setTempPowerSystem}
            cardType="powerSystem"
            placeholder="例如：练气、筑基、金丹、元婴、化神..."
          />

          <KernelDimensionCard
            cardKey="goldFinger"
            title="金手指设定"
            subtitle="主角的特殊外挂、系统、随身宝物或独占机缘"
            value={tempGoldFinger}
            setValue={setTempGoldFinger}
            cardType="goldFinger"
            placeholder="例如：可以复制万物的神秘古镜，或者属性加点的诸天面板..."
          />

          <KernelDimensionCard
            cardKey="coreConflict"
            title="核心矛盾与冲突线"
            subtitle="推动小说主线发展的主要矛盾，以及主角面临的终极敌对势力或危机"
            value={tempCoreConflict}
            setValue={setTempCoreConflict}
            cardType="coreConflict"
            placeholder="例如：真仙下凡灭族之仇，或是主角身上的天劫诅咒，需不断打破封印..."
          />

          <KernelDimensionCard
            cardKey="factionsMap"
            title="势力分布与地理"
            subtitle="故事发生的世界地理架构，以及各大宗门、家族、帝国的敌友关系"
            value={tempFactionsMap}
            setValue={setTempFactionsMap}
            cardType="factionsMap"
            placeholder="例如：东荒三宗、西漠佛国、北海妖域，各方势力犬牙交错..."
          />

          <KernelDimensionCard
            cardKey="sellingPoints"
            title="爽点与核心卖点"
            subtitle="网文吸引读者的商业爽点，如打脸、越级挑战、幕后黑手等节奏设计"
            value={tempSellingPoints}
            setValue={setTempSellingPoints}
            cardType="sellingPoints"
            placeholder="例如：扮猪吃老虎，极限反杀，创建宗门幕后操控世界流派..."
          />

          {/* 反 AI 写作控制与文风微调卡片 */}
          <div
            className="glass-card animate-fade-in"
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-light)',
              borderRadius: '12px',
              marginBottom: '16px',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <div
              onClick={() => setExpandedKernelCard(expandedKernelCard === 'antiAiStyleRules' ? null : 'antiAiStyleRules')}
              style={{
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                background: expandedKernelCard === 'antiAiStyleRules' ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                transition: 'background 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <strong style={{ fontSize: '15px', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  反 AI 写作控制与文风特征过滤器
                </strong>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  绑定写作模型时的底层约束规则，彻底清除大模型生成文章中的"AI 鸡汤味"与"模板腔"
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {store.currentProject?.antiAiStyleRules?.length ? `已启用 ${store.currentProject.antiAiStyleRules.length} 项` : '未启用'}
                </span>
                {expandedKernelCard === 'antiAiStyleRules' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            {expandedKernelCard === 'antiAiStyleRules' && (
              <div
                style={{
                  padding: '20px',
                  borderTop: '1px solid var(--border-light)',
                  background: 'rgba(0,0,0,0.1)',
                }}
              >
                <div style={{ marginBottom: '16px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>点击以下文风特征药丸，一键启用或关闭（即时落库生效）：</span>
                  {store.currentProject?.antiAiStyleRules && store.currentProject.antiAiStyleRules.length > 0 && (
                    <button
                      className="btn btn-secondary"
                      onClick={async () => {
                        if (!store.currentProject) return;
                        if (confirm('是否清空所有已启用的反 AI 规则？')) {
                          await store.updateProject(store.currentProject.id, { antiAiStyleRules: [] });
                        }
                      }}
                      style={{ padding: '2px 8px', fontSize: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)' }}
                    >
                      重置全部
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
                  {DEFAULT_ANTI_AI_RULES.map((rule) => {
                    const isActive = store.currentProject?.antiAiStyleRules?.includes(rule.key) || false;
                    return (
                      <div
                        key={rule.key}
                        onClick={async () => {
                          if (!store.currentProject) return;
                          const currentRules = store.currentProject.antiAiStyleRules || [];
                          let nextRules: string[];
                          if (currentRules.includes(rule.key)) {
                            nextRules = currentRules.filter(k => k !== rule.key);
                          } else {
                            nextRules = [...currentRules, rule.key];
                          }
                          try {
                            await store.updateProject(store.currentProject.id, { antiAiStyleRules: nextRules });
                          } catch (e) {
                            alert('更新反 AI 写作规则失败');
                          }
                        }}
                        style={{
                          padding: '12px 16px',
                          background: isActive ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.01)',
                          border: isActive ? '1px solid var(--accent)' : '1px solid var(--border-light)',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          transition: 'all 0.2s ease',
                          boxShadow: isActive ? '0 0 10px rgba(99, 102, 241, 0.15)' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '13px', color: isActive ? '#fff' : 'var(--text-muted)' }}>
                            {rule.name}
                          </strong>
                          <span style={{
                            width: '14px',
                            height: '14px',
                            borderRadius: '50%',
                            border: isActive ? 'none' : '1px solid var(--border-light)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: isActive ? 'var(--accent)' : 'transparent',
                          }}>
                            {isActive && <CheckCircle2 size={10} style={{ color: '#fff' }} />}
                          </span>
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--text-dark)', margin: 0, lineHeight: '1.5' }}>
                          {rule.promptInstruction}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '30px', flexGrow: 1, minHeight: 0 }}>
          {/* 左侧：角色资产列表 */}
          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#fff', margin: 0 }}>
                角色卡资产库 ({store.characters ? store.characters.length : 0})
              </h4>
              {!isAddingChar && store.currentProject && (
                <button
                  className="btn btn-primary"
                  onClick={() => setIsAddingChar(true)}
                  style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--accent)', border: 'none' }}
                >
                  添加角色
                </button>
              )}
            </div>
            {isAddingChar && store.currentProject && (
              <AddCharacterCard
                projectId={store.currentProject.id}
                onAdd={async (char) => {
                  await store.createCharacter(char);
                }}
                onCancel={() => setIsAddingChar(false)}
              />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {!store.characters || (store.characters.length === 0 && !isAddingChar) ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dark)', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', fontSize: '12px' }}>
                  当前尚未添加角色卡资产，点击右上角按钮创建！
                </div>
              ) : (
                store.characters.map((char) => (
                  <CharacterCard
                    key={char.id}
                    character={char}
                    onSave={async (id, updates) => {
                      await store.updateCharacter(id, updates);
                    }}
                    onDelete={async (id) => {
                      await store.deleteCharacter(id);
                    }}
                  />
                ))
              )}
            </div>
          </div>

          {/* 右侧：世界设定列表 */}
          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#fff', margin: 0 }}>
                世界设定资产库 ({store.worldRules ? store.worldRules.length : 0})
              </h4>
              {!isAddingRule && store.currentProject && (
                <button
                  className="btn btn-primary"
                  onClick={() => setIsAddingRule(true)}
                  style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--accent)', border: 'none' }}
                >
                  新建设定项
                </button>
              )}
            </div>

            {/* 世界设定类型过滤器小药丸 */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
              {(['all', 'location', 'faction', 'rule', 'item', 'other'] as const).map((filterOpt) => {
                const labels: Record<string, string> = {
                  all: '全部',
                  location: '地点',
                  faction: '势力',
                  rule: '法则',
                  item: '道具',
                  other: '其他',
                };
                const isActive = ruleFilter === filterOpt;
                return (
                  <button
                    key={filterOpt}
                    onClick={() => setRuleFilter(filterOpt)}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      border: isActive ? '1px solid var(--accent)' : '1px solid var(--border-light)',
                      background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-input)',
                      color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {labels[filterOpt]}
                  </button>
                );
              })}
            </div>

            {isAddingRule && store.currentProject && (
              <AddWorldRuleCard
                projectId={store.currentProject.id}
                onAdd={async (rule) => {
                  await store.createWorldRule(rule);
                }}
                onCancel={() => setIsAddingRule(false)}
              />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {!filteredRules || (filteredRules.length === 0 && !isAddingRule) ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dark)', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', fontSize: '12px' }}>
                  当前尚未添加该类型的设定项，点击右上角按钮创建！
                </div>
              ) : (
                filteredRules.map((rule) => (
                  <WorldRuleCard
                    key={rule.id}
                    rule={rule}
                    onSave={async (id, updates) => {
                      await store.updateWorldRule(id, updates);
                    }}
                    onDelete={async (id) => {
                      await store.deleteWorldRule(id);
                    }}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
