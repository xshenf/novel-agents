import { useState, useEffect, type FormEvent } from 'react';
import type { NovelStore } from '@/lib/store';
import type { CallAIApi } from './useAiClient';
import { createVersionSnapshot } from '@/lib/versionSnapshot';

type RuleFilter = 'all' | 'location' | 'faction' | 'rule' | 'item' | 'other';

interface UseProjectKernelDeps {
  store: NovelStore;
  callAIApi: CallAIApi;
}

export type ProjectKernelApi = ReturnType<typeof useProjectKernel>;

export function useProjectKernel({ store, callAIApi }: UseProjectKernelDeps) {
  const [kernelOptions, setKernelOptions] = useState<any>(null);
  const [isKernelLoading, setIsKernelLoading] = useState(false);
  const [kernelProgress, setKernelProgress] = useState<string>('');
  const [expandedKernelCard, setExpandedKernelCard] = useState<string | null>('powerSystem');

  const [activeSettingsSubTab, setActiveSettingsSubTab] = useState<'kernel' | 'assets'>('kernel');
  const [ruleFilter, setRuleFilter] = useState<RuleFilter>('all');
  const [isAddingChar, setIsAddingChar] = useState(false);
  const [isAddingRule, setIsAddingRule] = useState(false);

  // 临时设定编辑状态
  const [tempPowerSystem, setTempPowerSystem] = useState('');
  const [tempGoldFinger, setTempGoldFinger] = useState('');
  const [tempCoreConflict, setTempCoreConflict] = useState('');
  const [tempFactionsMap, setTempFactionsMap] = useState('');
  const [tempSellingPoints, setTempSellingPoints] = useState('');
  const [tempOutlineFull, setTempOutlineFull] = useState('');
  const [tempStyleSetting, setTempStyleSetting] = useState('');
  const [tempWorldSetting, setTempWorldSetting] = useState('');
  const [tempSkillSystem, setTempSkillSystem] = useState('');
  const [tempLocation, setTempLocation] = useState('');
  const [tempFaction, setTempFaction] = useState('');
  const [tempCurrency, setTempCurrency] = useState('');
  const [tempItem, setTempItem] = useState('');

  // 完善新书设定 Modal
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editProjTitle, setEditProjTitle] = useState('');
  const [editProjStyle, setEditProjStyle] = useState('');
  const [editProjWorld, setEditProjWorld] = useState('');
  const [editProjDesc, setEditProjDesc] = useState('');
  const [isEditProjectAiLoading, setIsEditProjectAiLoading] = useState(false);

  // AI 推演单项设定字段（3个备选）状态
  const [deductingField, setDeductingField] = useState<string | null>(null);
  const [deductingFieldLabel, setDeductingFieldLabel] = useState<string>('');
  const [deductionOptions, setDeductionOptions] = useState<{ title: string; content: string }[]>([]);
  const [isDeducting, setIsDeducting] = useState(false);

  // 切换项目时同步设定状态
  useEffect(() => {
    if (store.currentProject) {
      setTempPowerSystem(store.currentProject.powerSystem || '');
      setTempGoldFinger(store.currentProject.goldFinger || '');
      setTempCoreConflict(store.currentProject.coreConflict || '');
      setTempFactionsMap(store.currentProject.factionsMap || '');
      setTempSellingPoints(store.currentProject.sellingPoints || '');
      setTempOutlineFull(store.currentProject.outlineFull || '');
      setTempStyleSetting(store.currentProject.styleSetting || '');
      setTempWorldSetting(store.currentProject.worldSetting || '');
      setTempSkillSystem(store.currentProject.skillSystem || '');
      setTempLocation(store.currentProject.location || '');
      setTempFaction(store.currentProject.faction || '');
      setTempCurrency(store.currentProject.currency || '');
      setTempItem(store.currentProject.item || '');

      // 切换新项目时清空旧的 AI 推荐，以便于触发新的推演，且重置次级 Tab
      setKernelOptions(null);
      setActiveSettingsSubTab('kernel');
      setIsAddingChar(false);
      setIsAddingRule(false);
    }
  }, [store.currentProject]);

  // AI 设定与大纲推演请求（SSE 流式进度）
  // 返回 true 表示需要向导补全，'needStyle' 表示需要先配置风格基调，false 表示正常执行
  const fetchKernelOptions = async (): Promise<boolean | string> => {
    if (!store.currentProject) return false;

    // 风格基调未设置时，提示用户先配置
    const styleSetting = (store.currentProject.styleSetting || '').trim();
    if (!styleSetting) {
      return 'needStyle';
    }

    setIsKernelLoading(true);
    setKernelProgress('正在准备推演...');
    try {
      // 获取当前绑定模型的并发配置
      const boundModelId = store.agentModelBindings['orchestrator'] || store.models[0]?.id;
      const boundModel = store.models.find(m => m.id === boundModelId);
      const concurrency = boundModel?.concurrency || 3;

      const response = await callAIApi({
        action: 'generateKernel',
        projectTitle: store.currentProject.title,
        genre: store.currentProject.description || '仙侠修真',
        tone: store.currentProject.styleSetting || '传统正剧',
        concurrency,
        projectId: store.currentProject.id
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: '请求失败' }));
        throw new Error(errData.error || '请求失败');
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream')) {
        // SSE 流式处理
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // 维度 key -> 对应的 temp setter
        const tempSetters: Record<string, (v: string) => void> = {
          worldSetting: setTempWorldSetting,
          coreConflict: setTempCoreConflict,
          sellingPoints: setTempSellingPoints,
          powerSystem: setTempPowerSystem,
          goldFinger: setTempGoldFinger,
          styleSetting: setTempStyleSetting,
          skillSystem: setTempSkillSystem,
          location: setTempLocation,
          faction: setTempFaction,
          currency: setTempCurrency,
          item: setTempItem,
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let currentEvent = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              try {
                const data = JSON.parse(dataStr);
                if (currentEvent === 'dimension_done') {
                  // 每个维度完成后实时更新 UI
                  setKernelProgress(`正在推演第 ${data.index}/${data.total} 维度：${data.dimLabel} - 已完成`);
                  if (data.dimKey && data.firstOption) {
                    const setter = tempSetters[data.dimKey];
                    if (setter) setter(data.firstOption);
                  }
                } else if (currentEvent === 'done') {
                  // 全部完成，刷新项目数据
                  if (store.currentProject) {
                    try {
                      await store.refreshProject(store.currentProject.id);
                    } catch (e) {
                      console.error('Failed to refresh project', e);
                    }
                  }
                } else if (currentEvent === 'error') {
                  throw new Error(data.error || 'AI 操作执行失败');
                }
              } catch (e: any) {
                if (e.message && !e.message.includes('JSON')) throw e;
              }
              currentEvent = '';
            }
          }
        }
      } else {
        // 降级为普通 JSON 响应
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        // 直接应用每个维度的第一个方案，自动保存
        const updates: Record<string, string> = {};
        for (const [dimKey, options] of Object.entries(data)) {
          const opts = options as Array<{ name: string; description: string }>;
          if (opts && opts.length > 0 && opts[0].description) {
            updates[dimKey] = opts[0].description;
          }
        }
        if (Object.keys(updates).length > 0 && store.currentProject) {
          try {
            await store.updateProject(store.currentProject.id, updates);
            const tempSetters: Record<string, (v: string) => void> = {
              worldSetting: setTempWorldSetting,
              coreConflict: setTempCoreConflict,
              sellingPoints: setTempSellingPoints,
              powerSystem: setTempPowerSystem,
              goldFinger: setTempGoldFinger,
              styleSetting: setTempStyleSetting,
              skillSystem: setTempSkillSystem,
              location: setTempLocation,
              faction: setTempFaction,
              currency: setTempCurrency,
              item: setTempItem,
            };
            for (const [key, setter] of Object.entries(tempSetters)) {
              if (updates[key]) setter(updates[key]);
            }
          } catch (e) {
            console.error('Failed to auto-apply kernel options', e);
          }
        }
      }
    } catch (err: any) {
      alert('AI 设定推演失败: ' + err.message);
    } finally {
      setIsKernelLoading(false);
      setKernelProgress('');
    }
    return false;
  };

  const handleOpenEditProject = () => {
    if (store.currentProject) {
      setEditProjTitle(store.currentProject.title);
      setEditProjStyle(store.currentProject.styleSetting || '');
      setEditProjWorld(store.currentProject.worldSetting || '');
      setEditProjDesc(store.currentProject.description || '');
      setShowEditProjectModal(true);
    }
  };

  const handleSaveProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!store.currentProject) return;
    try {
      await store.updateProject(store.currentProject.id, {
        title: editProjTitle,
        styleSetting: editProjStyle,
        worldSetting: editProjWorld,
        description: editProjDesc,
      });
      setShowEditProjectModal(false);
    } catch (err) {
      alert("保存项目设定失败");
    }
  };

  const handleEditProjectAiPlan = async () => {
    setIsEditProjectAiLoading(true);
    try {
      const res = await callAIApi({
        action: 'autoPlan',
        genre: editProjTitle ? '基于' + editProjTitle : '玄幻奇幻',
        tone: editProjStyle || '传统正剧',
        tags: []
      });
      if (!res.ok) throw new Error('AI推演失败');
      const data = await res.json();
      if (data) {
        setEditProjDesc(data.description || '');
        setEditProjWorld(data.worldSetting || '');
        if (data.styleSetting && !editProjStyle) {
          setEditProjStyle(data.styleSetting);
        }
      }
    } catch (err) {
      alert("AI 推演失败，请检查网络或稍后再试");
    } finally {
      setIsEditProjectAiLoading(false);
    }
  };

  const filteredRules = store.worldRules ? store.worldRules.filter(rule => {
    if (ruleFilter === 'all') return true;
    return rule.type === ruleFilter;
  }) : [];

  const isOutlineMissing = !!(store.currentProject && (!store.currentProject.outlineFull || !store.currentProject.outlineFull.trim()));
  const isSettingsMissing = !!(store.currentProject && (
    !store.currentProject.worldSetting || !store.currentProject.worldSetting.trim() ||
    !store.currentProject.powerSystem || !store.currentProject.powerSystem.trim() ||
    !store.currentProject.goldFinger || !store.currentProject.goldFinger.trim() ||
    !store.currentProject.coreConflict || !store.currentProject.coreConflict.trim()
  ));

  const handleAiDeduceField = async (fieldKey: string, fieldLabel: string) => {
    if (!store.currentProject) return;
    setIsDeducting(true);
    setDeductingField(fieldKey);
    setDeductingFieldLabel(fieldLabel);
    setDeductionOptions([]);

    try {
      const prompt = `你是一个专业的网络小说金牌策划和商业企划大师。请为我的小说《${store.currentProject.title}》推演和重新设计 3 套风格迥异、极具网文爽点与创意的【${fieldLabel}】备选方案。
【当前书本基础信息】:
- 书名: ${store.currentProject.title}
- 简介: ${store.currentProject.description || '暂无描述'}
- 当前世界观: ${tempWorldSetting || store.currentProject.worldSetting || '暂无'}
- 当前文风和背景基调: ${tempStyleSetting || store.currentProject.styleSetting || '暂无'}

Please output in Chinese. 请推演出这 3 套备选方案。
为了方便解析，请务必严格按照以下 JSON 格式输出，不要输出任何多余的引言、前言、解释、markdown 标记或任何 JSON 格式之外的字符：
{
  "options": [
    {
      "title": "方案1名称（如：快节奏神豪爽文）",
      "content": "方案1具体设定描述，字数在150字左右，符合当前题材且具备商业网文的流行爽感"
    },
    {
      "title": "方案2名称（如：传统正剧沉浸式）",
      "content": "方案2具体设定描述..."
    },
    {
      "title": "方案3名称（如：轻喜吐槽爆笑流）",
      "content": "方案3具体设定描述..."
    }
  ]
}`;

      const res = await callAIApi({
        action: 'chat',
        projectId: store.currentProject.id,
        query: prompt
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const reply = data.reply.trim();
      let cleaned = reply;
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      }
      const parsed = JSON.parse(cleaned);
      if (parsed.options && Array.isArray(parsed.options)) {
        setDeductionOptions(parsed.options);
      } else {
        throw new Error('格式不符合预期');
      }
    } catch (err: any) {
      console.error(err);
      const mockOpts = getMockDeductionOptions(fieldKey);
      setDeductionOptions(mockOpts);
    } finally {
      setIsDeducting(false);
    }
  };

  return {
    kernelOptions,
    setKernelOptions,
    isKernelLoading,
    kernelProgress,
    fetchKernelOptions,
    expandedKernelCard,
    setExpandedKernelCard,
    activeSettingsSubTab,
    setActiveSettingsSubTab,
    ruleFilter,
    setRuleFilter,
    isAddingChar,
    setIsAddingChar,
    isAddingRule,
    setIsAddingRule,
    tempPowerSystem,
    setTempPowerSystem,
    tempGoldFinger,
    setTempGoldFinger,
    tempCoreConflict,
    setTempCoreConflict,
    tempFactionsMap,
    setTempFactionsMap,
    tempSellingPoints,
    setTempSellingPoints,
    tempOutlineFull,
    setTempOutlineFull,
    tempStyleSetting,
    setTempStyleSetting,
    tempWorldSetting,
    setTempWorldSetting,
    tempSkillSystem,
    setTempSkillSystem,
    tempLocation,
    setTempLocation,
    tempFaction,
    setTempFaction,
    tempCurrency,
    setTempCurrency,
    tempItem,
    setTempItem,
    showEditProjectModal,
    setShowEditProjectModal,
    editProjTitle,
    setEditProjTitle,
    editProjStyle,
    setEditProjStyle,
    editProjWorld,
    setEditProjWorld,
    editProjDesc,
    setEditProjDesc,
    isEditProjectAiLoading,
    handleOpenEditProject,
    handleSaveProject,
    handleEditProjectAiPlan,
    filteredRules,
    isOutlineMissing,
    isSettingsMissing,
    deductingField,
    setDeductingField,
    deductingFieldLabel,
    deductionOptions,
    setDeductionOptions,
    isDeducting,
    handleAiDeduceField,
  };
}

function getMockDeductionOptions(fieldKey: string): { title: string; content: string }[] {
  const mockTemplates: Record<string, { title: string; content: string }[]> = {
    powerSystem: [
      { title: "传统境界升级体系", content: "境界划分为：炼气期、筑基期、结丹期、元婴期、化神期。每一阶分为九层，升级需要渡劫和服用相应破境丹药，灵力质变。" },
      { title: "血脉神相觉醒体系", content: "修行不炼气，而是觉醒神魔祖先血脉。境界为：觉醒境、显像境、法相境、归神境、不死至尊。法相大小决定战力上限。" },
      { title: "赛博机甲飞升体系", content: "将肉身与钢铁阵法融合。境界为：碳基筑基、核动力金丹、纳米元婴、量子飞升。用核聚变阵法提供无限灵力，科技修仙。" }
    ],
    goldFinger: [
      { title: "太古吞噬仙药小鼎", content: "主角体内的神秘青铜小鼎，能将任何垃圾丹药、杂质灵草提纯为百分之百药效 of 无杂质九转金丹，并可催熟灵药。" },
      { title: "熟练度极限肝帝面板", content: "主角能将自己掌握的所有法术、神通、炼丹术以数据熟练度面板呈现。只要练习就必然增加熟练度，且能突破上限达到化境。" },
      { title: "天道错觉模拟器", content: "能向天道发送错觉信号，让天道以为主角正在遭遇死劫或已经陨落，从而直接略过雷劫，甚至白嫖天地造化洗礼。" }
    ],
    coreConflict: [
      { title: "真仙宗门夺基之仇与家族危机", content: "起因：主角家族的灵脉被高高在上的真仙宗门看中，欲强行剥夺。冲突：主角反杀宗门使者，与该顶级宗门结下血海深仇，面临灭族危机。" },
      { title: "九幽魔劫爆发与正道伪君子围剿", content: "起因：九幽魔气泄露，主角觉醒魔神血脉。冲突：正道魁首以除魔卫道为名，欲炼化主角血脉，实则是为了掠夺其神魔本源。" },
      { title: "天道崩塌与帝路争锋", content: "起因：三百年一次的帝路重开，但这一纪元天道法则残缺，只能诞生一位大帝。冲突：诸天万界天骄与古代沉睡的至尊疯狂厮杀，争夺唯一的证道契机。" }
    ],
    factionsMap: [
      { title: "东荒三宗、西漠佛国、北海妖域", content: "天玄大陆地理庞大。东荒由三大长生仙宗统治，西漠由大雷音寺及佛国掌控信仰，北海则是无尽妖族统领。各方犬牙交错，摩擦不断。" },
      { title: "九重天界与凡界仙盟", content: "世界分为九重天。下界由修士建立的万仙盟共同打理，而上三重天则是高高在上的真仙道统，俯瞰并奴役下界凡人修士。" },
      { title: "诸天万界与不朽古族", content: "三千大世界，万界争锋。古老的不朽世家占据了资源最丰厚的祖星，建立跨越星域的星际传送阵，压榨边缘弱小生命世界。" }
    ],
    sellingPoints: [
      { title: "智商碾压，绝对理性杀伐果断", content: "主角心智如妖，布局深远，不圣母不拖泥带水。爽点在于敌人以为自己占尽上风，实则一步步落入主角的连环死套中。" },
      { title: "平推暴爽，一剑破万法", content: "主角资质旷古绝今，悟性逆天，任何剑招神通一学即会、一会即精。爽点在于极致的无敌感，越级打脸，强敌皆为踏脚石。" },
      { title: "低调幕后流，马甲傀儡遍天下", content: "主角身在暗处，操控各方傀儡化身，在幕后推动世界局势。爽点在于各方大佬被主角玩弄于股掌之中，却对主角背后的神秘势力极度敬畏。" }
    ],
    worldSetting: [
      { title: "灵气枯竭的末法时代", content: "这是一个天道规则异变、灵力每日枯竭的世界。高阶修士为了苟延残喘，纷纷封锁洞府，甚至掠夺低阶修士，导致修行界环境极其严酷。" },
      { title: "科技与玄幻并存的交织界", content: "凡人依靠机械重工、外骨骼装甲和聚变打击与修行者划江而治。旧日修真宗门视科技为奇技淫巧，而科技帝国正计划以人造天劫扫平仙山。" },
      { title: "太古神魔遗留的破碎荒原", content: "大地是由死去的太古巨兽和陨落神魔的残骸构成的。荒野中弥漫着危险的法则风暴，只有在各大残存神火照耀的神殿庇护所里才能安全繁衍。" }
    ],
    styleSetting: [
      { title: "轻松幽默吐槽风", content: "行文以第一人称或欢脱的第三人称视角展开，充斥着网络热梗与脑洞大开的吐槽，主角性格乐天，在欢声笑语中强敌灰飞烟灭。" },
      { title: "黑暗沉重正剧向", content: "强调细节铺垫与人性的挣扎，整体基调沉重写实。主角每前进一步都要付出惨痛代价，修真界遵循赤裸裸的社会达尔文主义。" },
      { title: "极速爽快无敌流", content: "行文快节奏，打脸不隔夜。没有压抑的苦修情节，主角出场即在同阶立于不败之地，注重极致的爽感释放和爽快的推进。" }
    ]
  };

  return mockTemplates[fieldKey] || [
    { title: "方案A", content: `关于小说的${fieldKey}设计，这是一套新颖的构思方案。` },
    { title: "方案B", content: `关于小说的${fieldKey}设计的第二套创意方案，具备极佳的网文商业价值。` },
    { title: "方案C", content: `关于小说的${fieldKey}设计的第三套创意方案，展现深度的世界观魅力。` }
  ];
}
