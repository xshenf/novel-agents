export const DEFAULT_ANTI_AI_RULES = [
  { key: 'no_summary_ending', name: '❌ 禁用鸡汤/总结式升华句', promptInstruction: '禁止在章节或段落末尾进行升华、总结主题，或替读者提炼中心思想。收尾必须落回具体的情境或行为中，避免模板化的AI收敛尾句。' },
  { key: 'show_dont_tell', name: '🎭 行为外化（Show, Don\'t Tell）', promptInstruction: '禁止直接叙述或解释人物的心理状态。人物的喜怒哀乐和内心波动，必须通过细微的动作、神态、语气变化或周遭的环境反应来体现，让剧情更有画面感。' },
  { key: 'oral_dialogue', name: '🗣️ 对话保留生活噪音', promptInstruction: '对话不要过于精炼和功能化。允许保留人物特有的语气词、口癖、重复或现实生活中的废话、噪音，使对话听起来像真人说话而非木偶对白。' },
  { key: 'reality_gap', name: '🧩 制造现实预期差', promptInstruction: '避免剧情发展完全顺理成章。优先制造现实落差，让人物的预期与实际发生的结果不完全一致，增加情节波折与转弯。' },
  { key: 'no_parallel_style', name: '📏 警惕句式重复与排比', promptInstruction: '警惕连续几个句子的句式重复，不要使用大段排比句，避免行文格式像工整的标准作文。长短句结合，错落有致。' },
  { key: 'life_details', name: '🍃 穿插无效生活细节', promptInstruction: '在主线推进过程中，适当穿插一些与剧情走向无关的真实细节（如拍掉身上的灰尘、整理茶杯、咳嗽一声等），以显著增强场景的现场感。' },
  { key: 'no_moralizing', name: '⚖️ 禁止直接说教与评判', promptInstruction: '作者视角禁止对人物的行为或选择进行直接的价值评判、道德说教或客观判定。让事情自然呈现，由读者自行体会。' },
  { key: 'dynamic_status', name: '🌪️ 避免大段静态解释', promptInstruction: '注意避免连续几段全是静态的设定解释或背景交代。必须将设定拆散，融入到人物动作和当下的对话交锋中。' }
];
