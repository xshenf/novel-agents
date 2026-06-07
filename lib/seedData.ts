import type { NovelStore } from '@/lib/store';

/**
 * 预设种子演示小说数据，提升初次体验。
 * 从 useWorkspaceRouting 中抽离，保持 hook 职责单一。
 */
export async function seedDemoData(store: NovelStore) {
  const demoProj = await store.createProject(
    '仙途密信',
    '一封前朝密信，打破了偏远小镇上的平静。陆家藏书阁女史陆青禾与随身佩戴神秘玉佩的失忆公子沈砚被迫卷入仙盟博弈与前朝复辟的洪流中。',
    '传统修真悬疑，文笔清丽细腻，注重人物心理博弈与细腻的情感描写。',
    '凡尘之上有三大修真豪门（陆、苏、王）以及统一天下的仙盟。暗地里，被消灭的前朝皇室死士组织"九幽阁"蠢幽动。'
  );

  // 选择此项目
  store.setCurrentProject(demoProj);

  // 创建角色卡
  await store.createCharacter({
    projectId: demoProj.id,
    name: '沈砚',
    role: '男主',
    age: '23',
    identity: '前朝大皇子，在皇宫政变中重伤失忆，流落民间',
    personality: ['冷静克制', '眼神锐利', '内心极度护短'],
    goals: ['寻回遗失记忆', '查明生母死因', '暗中保护陆青禾'],
    relationships: [{ target: '陆青禾', type: '同盟 / 暗生情愫' }],
    currentState: '在藏书阁发现了蛛丝马迹，已警觉有人在调查我',
    forbidden: ['言行不能流于轻浮猥琐', '遇到危机时不能自乱阵脚']
  });

  await store.createCharacter({
    projectId: demoProj.id,
    name: '陆青禾',
    role: '女主',
    age: '20',
    identity: '修真豪门陆家分支的藏书阁管卷女史，负责古籍整理',
    personality: ['聪慧机智', '洞察力极强', '外柔内刚'],
    goals: ['保全弟弟性命', '通过家族旧卷查明祖父被仙盟治罪真相'],
    relationships: [{ target: '沈砚', type: '怀疑身份 / 利益盟友' }],
    currentState: '在密室意外查阅到残破印章密信，开始怀疑沈砚身世',
    forbidden: ['不可恋爱脑', '不可盲目相信他人']
  });

  // 创建设定卡
  await store.createWorldRule({
    projectId: demoProj.id,
    name: '九幽阁',
    type: 'faction',
    description: '前朝大周皇室的核心死士亲军，擅长夜袭、隐匿与影杀术。旗帜印记为残破盘龙纹。'
  });

  await store.createWorldRule({
    projectId: demoProj.id,
    name: '盘龙玉佩',
    type: 'item',
    description: '沈砚贴身之物，品质温润的极品玄玉。其边缘雕刻有细密的皇家特有盘龙暗纹，但有明显火烧磨损痕迹。'
  });

  // 创建初始章节
  const ch12 = await store.createChapter(demoProj.id, '第十二章：藏书阁夜读');
  await store.updateChapter(ch12.id, {
    content: `窗外夜雨淅淅沥沥，冷风吹得老旧的铜锁发出刺耳的撞击声。
陆青禾侧身护着手里那盏昏黄的灯笼，轻手轻脚地推开了藏书阁最底层的铁木重门。这里的架上全是被仙盟列为"存疑"的世家旧档，纸张泛着陈旧的霉味。
她耐着性子，纤细的手指在一排排泛黄的卷宗间划过，最终在角落一个落了锁的小暗格底端，抽出了那封信。
信封一角盖着红斑斑驳的盘龙火漆，虽残破不全，但那盘卷的长龙之角，却猛地让陆青禾倒吸了一口凉气。
"这印记……明明和沈公子的那枚玉佩……"她低语，捂住了自己狂跳的心口。`,
    summary: '陆青禾在藏书阁底的密室发现了一封盖着盘龙火漆的密信，这火漆上的残破盘龙印记与沈砚随身玉佩上的纹路如出一辙，陆青禾大为震惊。',
    characterChanges: [{ character: '陆青禾', change: '发现关键证据，对沈砚的来历产生极大怀疑' }],
    newForeshadowing: ['盘龙火漆密信', '沈砚玉佩上的残缺龙角'],
    resolvedForeshadowing: [],
    timelineEvents: ['细雨之夜，陆青禾私入藏书阁禁区，查获前朝密信']
  });

  const ch13 = await store.createChapter(demoProj.id, '第十三章：深夜茶香的试探');
  // 未写正文，以留空供AI自动写作体验
  await store.updateChapter(ch13.id, {
    content: ``,
    summary: '',
    characterChanges: [],
    newForeshadowing: [],
    resolvedForeshadowing: [],
    timelineEvents: []
  });

  return { demoProj, ch13 };
}
