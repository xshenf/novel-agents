'use client';

// TODO: Migrate inline styles to CSS Modules or Tailwind CSS
// TODO: Extract hardcoded Chinese strings for i18n support

import { CheckCircle2 } from 'lucide-react';
import { KernelDimensionCard } from './KernelDimensionCard';
import { StyleSettingPanel } from './StyleSettingPanel';
import { DEFAULT_ANTI_AI_RULES } from '@/lib/rules';
import { MATERIALS_LIST } from '../hooks/useMaterialTabs';
import { useWorkspace } from '../workspace-context';
import { GlassCard } from './ui/common';

interface KernelDimensionsPanelProps {
  activeMaterial: string;
}

/**
 * 大纲 Tab 右侧的"核心设定"面板。
 * 包括：世界设定、故事核心、力量体系、特殊设定 4 个维度的编辑卡，
 * 以及 specialSetting 下的"反 AI 文风特征过滤器"折叠面板。
 *
 * 所有维度数据与 setter 均从 useWorkspace() context 中获取，无需 prop drilling。
 */
export function KernelDimensionsPanel({ activeMaterial }: KernelDimensionsPanelProps) {
  const { store, kernel } = useWorkspace();
  const {
    tempDescription, setTempDescription,
    tempWorldSetting, setTempWorldSetting,
    tempCoreConflict, setTempCoreConflict,
    tempPowerSystem, setTempPowerSystem,
    tempGoldFinger, setTempGoldFinger,
    tempStyleSetting, setTempStyleSetting,
    tempSellingPoints, setTempSellingPoints,
    tempSkillSystem, setTempSkillSystem,
    tempLocation, setTempLocation,
    tempFaction, setTempFaction,
    tempCurrency, setTempCurrency,
    tempItem, setTempItem,
    tempForbiddenSetting, setTempForbiddenSetting,
    expandedKernelCard, setExpandedKernelCard,
  } = kernel;
  const currentProject = store.currentProject;
  const updateProject = store.updateProject;

  const subtitle =
    activeMaterial === 'worldSetting' ? '定义小说主舞台的大陆疆域、宏观规则、历史背景与社会法则'
    : activeMaterial === 'coreConflict' ? '推动小说主线发展的主要矛盾，以及主角面临的终极敌对势力或危机'
    : activeMaterial === 'sellingPoints' ? '网文吸引读者的商业爽点，如打脸、越级挑战、幕后黑手等节奏设计'
    : activeMaterial === 'powerSystem' ? '定义主角及世界的修炼境界、超自然等级，以及主角的特殊外挂金手指设定'
    : activeMaterial === 'skillSystem' ? '定义世界的功法、技能、神通体系与修炼路径'
    : activeMaterial === 'location' ? '定义世界中的地理区域、城市、秘境与地标'
    : activeMaterial === 'faction' ? '定义世界中的势力组织、宗门、家族与阵营关系'
    : activeMaterial === 'currency' ? '定义世界的货币、交易体系与资源流通方式'
    : activeMaterial === 'item' ? '定义世界中的法宝、丹药、材料与特殊物品'
    : activeMaterial === 'styleSetting' ? '定义小说的体裁定位、情感色调与写作偏好'
    : activeMaterial === 'specialSetting' ? '绑定写作模型时的底层约束规则，彻底清除大模型生成文章中的"AI 鸡汤味"与"模板腔"'
    : '';

  const activeRules = currentProject?.antiAiStyleRules || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '30px', minHeight: 0, overflowY: 'auto', flexGrow: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: 0 }}>
            {MATERIALS_LIST.find(m => m.id === activeMaterial)?.label}
          </h4>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{subtitle}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1 }}>
        {activeMaterial === 'worldSetting' && (
          <>
            <KernelDimensionCard
              cardKey="description"
              title="作品简介"
              subtitle="故事梗概与核心卖点概述，点明主角目标与核心冲突"
              value={tempDescription}
              setValue={setTempDescription}
              cardType="description"
              placeholder="例如：少年萧天偶得神秘古镜，踏上逆天修仙之路..."
              alwaysExpanded={true}
            />
            <KernelDimensionCard
              cardKey="worldSetting"
              title="核心世界观背景描述"
              subtitle="定义小说主舞台的大陆疆域、宏观规则、历史背景与微观社会法则"
              value={tempWorldSetting}
              setValue={setTempWorldSetting}
              cardType="worldSetting"
              placeholder="例如：一个灵气衰退的仙侠世界，修行者寿元大减，凡人建立的机械帝国与修士宗门共存..."
              alwaysExpanded={true}
            />
          </>
        )}

        {activeMaterial === 'coreConflict' && (
          <KernelDimensionCard
            cardKey="coreConflict"
            title="核心矛盾与冲突线"
            subtitle="推动小说主线发展的主要矛盾，以及主角面临的终极敌对势力或危机"
            value={tempCoreConflict}
            setValue={setTempCoreConflict}
            cardType="coreConflict"
            placeholder="例如：真仙下凡灭族之仇，或是主角身上的天劫诅咒，需不断打破封印..."
            alwaysExpanded={true}
          />
        )}

        {activeMaterial === 'sellingPoints' && (
          <KernelDimensionCard
            cardKey="sellingPoints"
            title="爽点与核心卖点"
            subtitle="网文吸引读者的商业爽点，如打脸、越级挑战、幕后黑手等节奏设计"
            value={tempSellingPoints}
            setValue={setTempSellingPoints}
            cardType="sellingPoints"
            placeholder="例如：扮猪吃老虎，极限反杀，创建宗门幕后操控世界流派..."
            alwaysExpanded={true}
          />
        )}

        {activeMaterial === 'powerSystem' && (
          <>
            <KernelDimensionCard
              cardKey="powerSystem"
              title="境界与力量体系"
              subtitle="定义主角及世界的修炼境界、超自然等级与晋升逻辑"
              value={tempPowerSystem}
              setValue={setTempPowerSystem}
              cardType="powerSystem"
              placeholder="例如：练气、筑基、金丹、元婴、化神..."
              alwaysExpanded={true}
            />
            <KernelDimensionCard
              cardKey="goldFinger"
              title="金手指设定"
              subtitle="主角的特殊外挂、系统、随身宝物或独占机缘"
              value={tempGoldFinger}
              setValue={setTempGoldFinger}
              cardType="goldFinger"
              placeholder="例如：可以复制万物的神秘古镜，或者属性加点的诸天面板..."
              alwaysExpanded={true}
            />
          </>
        )}

        {activeMaterial === 'styleSetting' && (
          <>
            <StyleSettingPanel
              tempStyleSetting={tempStyleSetting}
              setTempStyleSetting={setTempStyleSetting}
            />
            <div style={{ marginTop: '16px' }}>
              <KernelDimensionCard
                cardKey="forbiddenSetting"
                title="禁止出现的设定/桥段"
                subtitle="自定义负向约束，定义小说正文及大纲生成中严禁出现的毒点、剧情或词汇"
                value={tempForbiddenSetting}
                setValue={setTempForbiddenSetting}
                cardType="forbiddenSetting"
                placeholder="例如：严禁主角舔狗、送女行为；禁止出现无脑降智反派；禁止出现长篇大论的心理描写..."
                alwaysExpanded={true}
              />
            </div>
          </>
        )}

        {activeMaterial === 'skillSystem' && (
          <KernelDimensionCard
            cardKey="skillSystem"
            title="功法与技能体系"
            subtitle="定义世界的功法、技能、神通体系与修炼路径"
            value={tempSkillSystem}
            setValue={setTempSkillSystem}
            cardType="skillSystem"
            placeholder="例如：剑道三十六式、天罡七十二变、九转玄功..."
            alwaysExpanded={true}
            hideHeader={true}
          />
        )}

        {activeMaterial === 'location' && (
          <KernelDimensionCard
            cardKey="location"
            title="地理与地图设定"
            subtitle="定义世界中的地理区域、城市、秘境与地标"
            value={tempLocation}
            setValue={setTempLocation}
            cardType="location"
            placeholder="例如：东荒大陆、天剑城、万妖山脉、幽冥深渊..."
            alwaysExpanded={true}
            hideHeader={true}
          />
        )}

        {activeMaterial === 'faction' && (
          <KernelDimensionCard
            cardKey="faction"
            title="势力与阵营设定"
            subtitle="定义世界中的势力组织、宗门、家族与阵营关系"
            value={tempFaction}
            setValue={setTempFaction}
            cardType="faction"
            placeholder="例如：天剑宗、万妖殿、散修联盟、暗影商会..."
            alwaysExpanded={true}
            hideHeader={true}
          />
        )}

        {activeMaterial === 'currency' && (
          <KernelDimensionCard
            cardKey="currency"
            title="货币与交易体系"
            subtitle="定义世界的货币、交易体系与资源流通方式"
            value={tempCurrency}
            setValue={setTempCurrency}
            cardType="currency"
            placeholder="例如：灵石为通用货币，上品灵石=100中品灵石，仙晶为高阶硬通货..."
            alwaysExpanded={true}
            hideHeader={true}
          />
        )}

        {activeMaterial === 'item' && (
          <KernelDimensionCard
            cardKey="item"
            title="物品与道具设定"
            subtitle="定义世界中的法宝、丹药、材料与特殊物品"
            value={tempItem}
            setValue={setTempItem}
            cardType="item"
            placeholder="例如：天罡剑（仙器）、九转金丹、龙血草、虚空令..."
            alwaysExpanded={true}
            hideHeader={true}
          />
        )}

        {activeMaterial === 'specialSetting' && (
          <GlassCard>
            <div style={{
              padding: '20px',
              background: 'rgba(0,0,0,0.1)',
            }}>
              <div style={{
                marginBottom: '16px', fontSize: '12px', color: 'var(--text-muted)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <span>点击以下文风特征药丸，一键启用或关闭（即时落库生效）：</span>
                {activeRules.length > 0 && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      if (!currentProject) return;
                      store.showConfirm('是否清空所有已启用的反 AI 规则？', async () => {
                        await updateProject(currentProject.id, { antiAiStyleRules: [] });
                      });
                    }}
                    style={{ padding: '2px 8px', fontSize: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)' }}
                  >
                    重置全部
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
                {DEFAULT_ANTI_AI_RULES.map((rule) => {
                  const isActive = activeRules.includes(rule.key);
                  return (
                    <div
                      key={rule.key}
                      onClick={async () => {
                        if (!currentProject) return;
                        const next = isActive
                          ? activeRules.filter((k: string) => k !== rule.key)
                          : [...activeRules, rule.key];
                        try {
                          await updateProject(currentProject.id, { antiAiStyleRules: next });
                        } catch {
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
          </GlassCard>
        )}
      </div>
    </div>
  );
}
