# 智能体改进方案（聚焦 LangGraph + 提示词）

基于对 `lib/agent/graph.ts`、`prompts.ts`、`tools.ts`、`app/api/agent/route.ts` 的评审。范围限定为 LangGraph 编排体系与喂给节点的提示词，**不含**大纲 Markdown 解析、向量库选型等非 langgraph 工程。环境：`@langchain/langgraph@1.3.5`（`Command`/`interrupt`/`Send` 均可用）。

## 一、现状速览（LangGraph 视角）

- 拓扑：星型。`orchestrator` 经 `delegate_to_*` 工具发 `[DELEGATE:role]` 字符串信号，路由函数正则扫描 tool message 内容决定去哪个专家。
- 节点数约 15 个，其中 `*_tool_count` / `after_specialist` / `reset_specialist` 多为纯计数/重置样板节点。
- 状态：单一 `messages` 数组 + `delegationCount` / `specialistToolCalls` 计数通道；专家与编导靠 `filterSpecialistMessages` / `filterOrchestratorMessages` 手动切片同一数组来做视野隔离。
- 持久化：`MemorySaver`（进程内存），`thread_id = projectId`。
- 人工确认：锁定项删除/修改靠工具返回 `[CONFIRM_REQUIRED]` 字符串，依赖 LLM 自觉二次确认。
- 提示词：`prompts.ts` 5 个角色静态 system prompt，通用人设；项目文风仅通过 overview 工具结果间接进入。

## 二、改进项

优先级：P0 = 创作质量/地基；P1 = 框架契合度与可靠性；P2 = 拓扑与协作优化。

### P0-1 提示词工程（创作质量最高杠杆）

创作类 agent 中，提示词对产出质感的影响高于编排结构。当前五个角色提示词存在系统性短板：

- **A 风格未锚定**：writer/editor 是写死的通用网文人设，项目 `styleSetting`/题材只通过 overview 间接进入，不在角色"创作认知"里。古风与赛博朋克共用同一套语气指令；多模型绑定下 writer 与 editor 可能跑不同模型，文风漂移却无"风格契约"约束。
  - 方案：节点构建时把项目文风设定 + 既定文风样本注入 writer/editor 的 system prompt 顶部，所有产出文本类角色共享同一段风格锚。
- **B 零 few-shot**：writer 全靠抽象描述（"多用动词""避免堆砌形容词"），无范文示范。设计文档 9.6 的"文风模仿"完全未落地。
  - 方案：项目级文风样本（用户范文或已采纳章节片段）写作前注入 1–2 段做 few-shot，可配 AI 腔反例对照。
- **C 反 AI 规则只在润色阶段注入**：`antiAiStyleRules` 仅在 `polishTextTool` 生效（`tools.ts`），writer 生成时不受约束——源头不治、靠编辑补，多花一轮 token 效果还差。
  - 方案：把激活的反 AI 规则同时注入 writer 的 system prompt，生成即规避。
- **D writer 无生成自检与输出约束**：质量全压在 editor 一道；planner 大纲无结构化模板，难解析入库。
  - 方案：writer 末尾加轻量自检清单（动机/伏笔/钩子）；planner 大纲固定输出模板；writer 支持目标字数/分段约束。
- **E 创作模式未提示化**：设计文档 3.3 的续写/改写/扩写/复盘等模式语气本应不同，现 writer 是单一固定 prompt。
  - 方案：为 writer/editor 引入模式化 prompt 片段，由编导按意图选择注入。

取舍：A/C/D 改动集中在 `prompts.ts` 与节点构建处，低风险、可灰度，提到 P0 快赢；B 依赖文风样本（可取已采纳章节），E 是较大结构改动放后。**配套**：提示词迭代必须有可评估闭环——留一组固定测试输入，跑前后 prompt 做对比评分，否则"改了感觉变好"无依据。
工作量：A+C 约 1 人日；D 中；B/E 中。

### P0-2 状态持久化 Checkpointer

- 现状：`graph.ts:13` 用 `MemorySaver`，进程重启/多实例/冷启动状态全丢；而 `route.ts:256` 提示用户"发送'请继续'续跑"，底层没持久化、续跑拿不到中断前图状态，承诺与实现不符。
- 方案：新增依赖 `@langchain/langgraph-checkpoint-sqlite`，`SqliteSaver.fromConnString('./data/agent-checkpoints.db')` 替换 `MemorySaver`，与业务库分文件。
- 关联：这是 P1-4 `interrupt`（human-in-the-loop）的**前置依赖**——interrupt 依赖 checkpointer 才能暂停/恢复。
- 取舍：SQLite saver 适合单机；上多实例/serverless 需换 Postgres saver。
- 工作量：小（约 0.5 人日，含续跑闭环验证）。

### P1-3 委托路由改用 Command（替代字符串信号）

- 现状：委托靠工具返回 `[DELEGATE:role] task` 字符串，`routeAfterOrchestratorTools` 正则 `^\[DELEGATE:(\w+)\]` 扫描末尾 tool message 来路由（`graph.ts`）。脆弱：信号格式被模型改写、或正文出现同形字符串即误判。
- 方案：LangGraph 1.x 节点可直接返回 `new Command({ goto: 'planner', update: {...} })` 完成"路由 + 状态更新"，省掉 `orchestrator_tools → reset_specialist → 专家` 的字符串信号链与正则扫描。
- 取舍：需重构编导节点与条件边；与 P2-6 拓扑简化一起做更省事。
- 工作量：中（约 1.5 人日）。

### P1-4 锁定确认改用 interrupt（真正的 human-in-the-loop）

- 现状：删除/修改锁定的分卷章节时，工具返回 `[CONFIRM_REQUIRED]` 字符串，靠 LLM 自觉"先问用户、确认后带 force=true 重调"。不可靠：模型可能忽略提示直接 `force=true`，破坏锁定保护。
- 方案：用 `interrupt({ question })` 在工具/节点内**真正暂停图**，等前端回传用户决定后用 `new Command({ resume })` 恢复。破坏性操作从"提示自律"升级为"框架级强制暂停"。
- 关联：依赖 P0-2 checkpointer。并需改造 `route.ts` SSE——检测 `__interrupt__` 事件并推给前端，新增 resume 接口。
- 取舍：interrupt 在 JS 中以恢复时**重跑该节点**实现，interrupt() 之前的副作用会执行两次，须把 interrupt 放在副作用之前或保证幂等。
- 工作量：中（约 2 人日，含 SSE/前端联动）。

### P1-5 消息状态管理（减少手动正则过滤）

- 现状：所有角色共用一个 `messages` 数组，`filterSpecialistMessages`/`filterOrchestratorMessages` 每次节点执行都遍历切片、正则识别归属。逻辑复杂、易随提示词变化失效，且专家中间产物全留在主状态里推高 token。
- 方案：用独立状态通道（如 `specialistScratch`、`finalReports`）或 subgraph 隔离专家内部消息，主 `messages` 只保留用户对话与最终汇报。
- 取舍：状态模型重构，建议在 P1-3 Command 改造时一并设计通道。
- 工作量：中（约 2 人日）。

### P2-6 图拓扑简化

- 现状：`planner_tool_count`/`lore_builder_tool_count`/`writer_tool_count`/`editor_tool_count`/`after_specialist`/`reset_specialist` 等节点纯做计数与重置，拓扑冗长。
- 方案：计数收敛进专家节点自身的 `Command.update`，或用 `recursionLimit` + 单一条件边表达上限，删除样板节点。
- 取舍：与 P1-3 同期做，单独做收益有限。
- 工作量：小到中（并入 P1-3 评估）。

### P2-7 专家横向协作 / Send

- 现状：星型拓扑，专家完成即回编导，彼此不能协作；writer 写到一半缺角色卡只能回编导串行再派 lore_builder。
- 方案（保守）：专家返回结构化"补充请求"，编导识别后接力委托，不给专家直接 delegate 工具（避免破坏失控封顶）。
- 方案（进阶）：用 `Send` 做并行 fan-out（如同时让多专家产出后聚合）。
- 取舍：进阶方案显著增加失控与调试成本，当前规模优先保守方案。
- 工作量：中（约 2 人日）。

## 三、推荐分阶段路线

- 阶段一（创作质量 + 地基，约 1.5–2 人日）：P0-1 提示词 A/C/D + P0-2 持久化 checkpointer。低风险、直接提升产出质量并补上续跑闭环。
- 阶段二（框架契合，约 3–4 人日）：P1-3 Command 路由 + P2-6 拓扑简化（同期）+ P1-5 状态通道（同期设计）。
- 阶段三（可靠性，约 2 人日）：P1-4 interrupt 人工确认（依赖阶段一 checkpointer）。
- 阶段四（按需）：P0-1 的 B/E（文风样本 + 创作模式）、P2-7 专家协作。

## 四、风险与前置确认

- 提示词迭代须先建固定测试用例集做前后对比，否则无法判断是否真的变好。
- `interrupt` 恢复会重跑节点，注意副作用幂等；上线前在 SSE 链路验证暂停/恢复。
- 新增 `@langchain/langgraph-checkpoint-sqlite` 前确认与 langgraph 1.3.5 版本兼容。
- 单文件 500 行约束：`tools.ts` 已 929 行，新增工具/提示词模块应拆到新文件（如 `lib/agent/prompts/` 按角色拆分、`lib/agent/tools/` 分组），不要继续堆大文件。
