'use client';

import { ChevronUp, ChevronDown, CheckCircle2 } from 'lucide-react';
import { KernelDimensionCard } from './KernelDimensionCard';
import { DEFAULT_ANTI_AI_RULES } from '@/lib/rules';
import { MATERIALS_LIST } from '../hooks/useMaterialTabs';
import { useWorkspace } from '../workspace-context';

interface KernelDimensionsPanelProps {
  activeMaterial: string;
  // 维度卡的值与 setter
  tempWorldSetting: string;
  setTempWorldSetting: (v: string) => void;
  tempCoreConflict: string;
  setTempCoreConflict: (v: string) => void;
  tempPowerSystem: string;
  setTempPowerSystem: (v: string) => void;
  tempGoldFinger: string;
  setTempGoldFinger: (v: string) => void;
  tempStyleSetting: string;
  setTempStyleSetting: (v: string) => void;
  tempSellingPoints: string;
  setTempSellingPoints: (v: string) => void;
  // 反 AI 规则折叠控制
  expandedKernelCard: string | null;
  setExpandedKernelCard: (v: string | null) => void;
  // 项目状态
  currentProject: any;
  updateProject: (id: string, patch: any) => Promise<any>;
}

/**
 * 大纲 Tab 右侧的"核心设定"面板。
 * 包括：世界设定、故事核心、力量体系、特殊设定 4 个维度的编辑卡，
 * 以及 specialSetting 下的"反 AI 文风特征过滤器"折叠面板。
 */
export function KernelDimensionsPanel(props: KernelDimensionsPanelProps) {
  const { store } = useWorkspace();
  const {
    activeMaterial,
    tempWorldSetting, setTempWorldSetting,
    tempCoreConflict, setTempCoreConflict,
    tempPowerSystem, setTempPowerSystem,
    tempGoldFinger, setTempGoldFinger,
    tempStyleSetting, setTempStyleSetting,
    tempSellingPoints, setTempSellingPoints,
    expandedKernelCard, setExpandedKernelCard,
    currentProject, updateProject,
  } = props;

  const subtitle =
    activeMaterial === 'worldSetting' ? '定义小说主舞台的大陆疆域、宏观规则、历史背景与社会法则'
    : activeMaterial === 'coreConflict' ? '推动小说主线发展的主要矛盾，以及网文吸引读者的爽点卖点设计'
    : activeMaterial === 'powerSystem' ? '定义主角及世界的修炼境界、超自然等级，以及主角的特殊外挂金手指设定'
    : activeMaterial === 'specialSetting' ? '小说的体裁定位、情感基调偏好，以及绑定写作模型时的反 AI 底层约束'
    : '';

  const activeRules = currentProject?.antiAiStyleRules || [];
  const isAntiAiExpanded = expandedKernelCard === 'antiAiStyleRules';

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
        )}

        {activeMaterial === 'coreConflict' && (
          <>
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
          </>
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

        {activeMaterial === 'specialSetting' && (
          <>
            <KernelDimensionCard
              cardKey="styleSetting"
              title="小说文风与题材基调"
              subtitle="定义小说的体裁定位、情感色调与写作偏好（如：快节奏爽文、热血升级、幽默吐槽等）"
              value={tempStyleSetting}
              setValue={setTempStyleSetting}
              cardType="styleSetting"
              placeholder="例如：都市超能体裁，快节奏神豪爽文，整体色调轻松幽默，节奏明快..."
              alwaysExpanded={true}
            />

            <div
              className="glass-card animate-fade-in"
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-light)',
                borderRadius: '12px',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <div
                onClick={() => setExpandedKernelCard(isAntiAiExpanded ? null : 'antiAiStyleRules')}
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  background: isAntiAiExpanded ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
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
                    {activeRules.length ? `已启用 ${activeRules.length} 项` : '未启用'}
                  </span>
                  {isAntiAiExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {isAntiAiExpanded && (
                <div
                  style={{
                    padding: '20px',
                    borderTop: '1px solid var(--border-light)',
                    background: 'rgba(0,0,0,0.1)',
                  }}
                >
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
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
