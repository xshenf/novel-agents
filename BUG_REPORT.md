# 项目缺陷排查报告

- 生成日期：2026-06-08
- 排查范围：lib/agent（多智能体系统）、lib/ 数据与解析层、app/api（路由）、app/hooks（自定义 hooks）、lib/store.ts、prisma/schema.prisma
- 方法：四组并行子代理按子系统扫描，再由主代理逐条阅读源码核验；下文每条标注「已核验」或「待复核」
- 严重度定义：
  - 严重 = 直接破坏核心诉求（长篇记忆不跑偏 / 长篇任务跑得完）或导致数据错乱
  - 中等 = 特定路径下功能失效、资源浪费、错误处理缺陷
  - 轻微 = 边界问题、设计脆弱、体验瑕疵

---

## 严重

### S1. 续跑后被强制收尾，长篇任务接不上

- 位置：`lib/agent/graph.ts:325`、`lib/agent/graph.ts:345`、`app/api/agent/route.ts:104`
- 状态：已核验
- 根因：recursion 达上限中断后，前端点「继续」走 `isContinueLimit` 分支，向同一 `thread_id` 注入新的 HumanMessage 并由 checkpointer 恢复状态。但恢复的状态里 `delegationCount` 已累积（`afterSpecialistNode` 每次专家完成 +1）。orchestrator 节点判断 `force = state.delegationCount >= MAX_DELEGATIONS`，若已达上限则立即绑定无委托工具的 `boundSummary` 并进入收尾模式。
- 影响：续跑时无法再委托专家继续写作，与续跑提示语「从上次中断处无缝衔接」直接矛盾，长篇任务跑不完。
- 修复建议：续跑（`isContinueLimit`）时通过 `Command`/状态更新把 `delegationCount` 重置为 0（或减去本轮已收尾的计数），使续跑后能重新进入调度模式。

### S2. 世界状态锁定后同名条目重复堆积

- 位置：`lib/db.ts:560-577`
- 状态：已核验
- 根因：`replaceAutoWorldStates` 删除条件为 `{ pinned: false, source: 'ai' }`，但插入恒为 `pinned: false, source: 'ai'`，且不按 `name` 去重或 upsert。用户一旦把某条 AI 生成的状态锁定（`pinned: true`），该条不会被删除；AI 下次生成同名条目时会再插入一条 `pinned: false` 的同名记录。
- 影响：世界状态表中同名条目并存且可能内容矛盾；注入记忆时（`lib/memory.ts:243`）两条同名状态同时进入提示词，导致设定跑偏。
- 修复建议：插入前按 `(projectId, name)` 去重或改用 upsert；或在删除步骤中一并清理与新条目同名的 pinned 记录（需产品确认锁定语义）。

### S3. 「最近 N 章」按 createdAt 取，乱序场景取错章节

- 位置：`prisma/schema.prisma:81`（Chapter 模型无 order 字段）、`lib/memory.ts:153`、`lib/memory.ts:261`、`lib/db.ts:300/310/321`
- 状态：已核验
- 根因：Chapter 表仅有 `createdAt`，无显式排序字段，所有章节查询用 `orderBy: { createdAt: 'asc' }`。`chapters.slice(-RECENT_DETAIL_N)` 取的是「最后创建」而非「章节序号最大」的章节。
- 影响：顺序生成时无害；一旦补写、重生成或在中间插入早期章节，注入的「最近章节细节」与「最近章节摘要」会错位，直接影响长篇记忆连贯性。
- 修复建议：为 Chapter 增加显式 `order`（或 `seq`）整数字段并以此排序；迁移时按现有 createdAt 回填。

---

## 中等

### M1. 客户端断开时 SSE controller 重复 close 抛错

- 位置：`app/api/agent/route.ts:86-89`
- 状态：已核验
- 根因：abort 回调直接 `controller.close()`，但 `for await` 事件循环里多处 `await db.appendAgentMessage(...)` 之后还有 `send(...)`。断开若发生在 await 期间，恢复后的 `send()` 会向已关闭的 controller enqueue 抛错；该错误被外层 catch 捕获后又 `send('error')` 再次抛错，finally 还会二次 `close()`。
- 影响：客户端中断后服务端产生错误噪声、错误被误分类；并发计数虽在 finally 正确递减，但流程不干净。
- 修复建议：abort 回调只 `clearInterval(heartbeat)` 并设置中断标志，由循环 `break` 后的 finally 统一 `close()`；`send()` 内部加 try/catch 兜底。

### M2. ai.ts 所有 callModelApi 调用漏传 signal

- 位置：`lib/ai.ts`（约 11 处调用）、`lib/modelApi.ts:2`
- 状态：已核验
- 根因：`callModelApi` 第 6 参数 `signal?: AbortSignal` 从未被上层调用传入，仅靠内部 `AbortSignal.timeout(120_000)` 兜底。
- 影响：不会无限挂起（已有 120s 超时），但客户端断开或外部超时无法中断底层 HTTP，后台请求仍跑满 120s，浪费 token 与配额。
- 修复建议：为 ai.ts 各 generateXXX 函数增加 signal 形参并透传给 callModelApi；调用方（如 `app/api/ai/route.ts`）传入 `request.signal`。

### M3. OpenAI 兼容分支忽略 reasoningEnabled

- 位置：`lib/modelApi.ts:61-65`（仅 Gemini 分支处理）
- 状态：已核验
- 根因：Gemini 分支设置 `thinkingConfig`，OpenAI/DeepSeek 兼容分支（`lib/modelApi.ts:135-144`）构建 body 时完全未处理 `config.reasoningEnabled`。
- 影响：使用 OpenAI 兼容服务商时 UI 的推理开关静默失效（对 DeepSeek R1 等自带推理的模型无影响，对需显式参数开启的服务商失效）。
- 修复建议：在 OpenAI 分支按目标服务商补充对应参数（如 `reasoning_effort` 等），或在 UI 标注该开关仅对部分服务商生效。

### M4. formatProject 的 JSON.parse 无 try/catch

- 位置：`lib/db.ts`（formatProject 对 modelsConfig/agentBindings/agentOverrides 等字段解析）
- 状态：待复核（子代理报告，逻辑可信）
- 根因：JSON 字段解析无异常保护，单条记录字段被写入非法 JSON 时会抛出。
- 影响：`getProjects` 整个列表接口抛 500，项目列表打不开。formatChapter/formatCharacter 同理。
- 修复建议：解析处包裹 try/catch，损坏时回退默认值并记录告警。

### M5. useAgentChat 历史加载依赖整个 currentProject 对象

- 位置：`app/hooks/useAgentChat.ts:116`
- 状态：待复核（子代理报告，逻辑可信）
- 根因：effect 依赖 `[store.currentProject?.id, store.currentProject]`，对象引用每次刷新都变。
- 影响：agent 跑完多次刷新 project 时反复重新 fetch `/api/agent/history` 并重置消息，可能覆盖流式刚追加的内容、产生多余请求。
- 修复建议：依赖数组只保留 `store.currentProject?.id`。

### M6. useAgentChat 流超时/abort 后遗留 streaming 消息转圈

- 位置：`app/hooks/useAgentChat.ts`（processAgentStream 的 catch 分支）
- 状态：待复核（子代理报告，逻辑可信）
- 根因：流中途抛错时直接 throw，未对最后一条 `streaming:true` 的消息收尾，catch 只追加 error 消息。
- 影响：界面上残留一条永远转圈的流式消息。
- 修复建议：catch/finally 中统一把未完成的 streaming 消息置为结束态。

---

## 轻微 / 设计脆弱

### L1. updateProject 白名单漏字段

- 位置：`app/api/projects/[id]/route.ts`（ALLOWED 白名单）
- 状态：待复核
- 现象：`skillSystem/location/faction/currency/item` 不在更新白名单内，无法经 API 更新（静默丢弃）。

### L2. store 乐观更新追加到列表尾部，与刷新后排序不一致

- 位置：`lib/store.ts`（createProject 及多处 `[...state.xxx, new]`）
- 状态：待复核
- 现象：新建项追加到尾部，但后端按 `createdAt desc` / `updatedAt desc` 返回，刷新后顺序跳变。

### L3. 脱敏 apiKey 方案在换环境时仍可能回流

- 位置：`lib/store.ts:296-312`（updateModel）、`lib/store.ts:260-277`（addModel）
- 状态：已核验（已有护栏）
- 现象：已有「从 localStorage 恢复真实 key」的护栏，但换浏览器/清缓存且 localStorage 无真实 key 时，脱敏值（`***` 开头）仍可能被写回 `apiKey`。
- 修复建议：后端持久化真实 key（或加密存储），前端永不把脱敏值回写为可用 key。

---

## 经核验后降级的项（子代理报为严重，实际危害低）

### D1. useEditor 缺依赖 editorContent

- 位置：`app/hooks/useEditor.ts:70-80`
- 结论：存在 `prevContentRef` 作为「用户是否改过」的护栏，且 `currentChapterContent` 变化必然伴随一次 render 捕获最新 `editorContent`，「覆盖未保存正文」的论断不成立。ESLint 仍会告警缺依赖，可按需补全但非功能 bug。

### D2. modelApi 的 AbortSignal.timeout 「timer 泄漏」

- 位置：`lib/modelApi.ts:34`
- 结论：`AbortSignal.timeout(120_000)` 的底层定时器会在 120s 后自动回收，长驻进程下不构成真正泄漏。

---

## 修复优先级建议

1. 第一梯队（直接影响长篇连贯/可完成性）：S1、S2、S3
2. 第二梯队（健壮性/资源）：M1、M4、M2
3. 第三梯队（功能完整/体验）：M3、M5、M6、L1~L3
