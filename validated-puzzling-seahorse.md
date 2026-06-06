# 重构 app/page.tsx（4553 行 God Component）

## Context（为什么）
`app/page.tsx` 是一个 4553 行的单文件客户端组件，包含约 60 个 `useState`、全部业务 handler、三个巨型 render 辅助函数（`renderWizardPanel` ~600 行、`renderSettingsDrawer` ~530 行、`renderInspirationsModal` ~315 行）以及一个 ~1240 行的主 `return`。文件过长导致难以阅读、定位与维护。

目标（已与用户确认）：**彻底拆分** —— 业务逻辑抽到自定义 hooks，UI 按功能拆成组件，组件间通过**单一 `WorkspaceProvider` Context** 共享状态；`page.tsx` 收敛为 ~300 行的编排层。**纯结构性重构，不改变任何运行行为**（除明确列出的死代码清理）。

约束：
- 遵守 AGENTS.md：禁止任何 Emoji（代码/UI/文案）；Next 16 行为以 `node_modules/next/dist/docs` 为准（已核对 client component 与 `useSearchParams`）。
- `useSearchParams`/`useRouter`/`usePathname` 仅在顶层 `page.tsx`（已被 `layout.tsx` 的 `<Suspense>` 包裹）使用，**不要下放到子组件**，避免破坏预渲染边界。
- 全局样式来自 `app/globals.css`（在 layout 引入），className 在任意组件位置均生效，无需 CSS module 改造。

## 目标目录结构
```
app/
  page.tsx                       # ~300 行：调用 hooks、组装 context value、顶层视图切换、挂载 modals
  workspace-context.tsx          # createContext + WorkspaceProvider + useWorkspace()
  hooks/
    useAiClient.ts               # callAIApi（agent 角色 -> 模型映射）
    useWorkspaceRouting.ts       # router/pathname/searchParams、buildWorkspaceUrl、url 派生 id、mounted、初始化/seed/URL 恢复 effects、seedDemoData
    useEditor.ts                 # editorTitle/Content/saveStatus + handlers + 同步 effect + exportFile
    useModelSettings.ts          # 模型池表单/测试/拉取模型 + showSettings + agentsList + add/edit/save
    useAutoWriter.ts             # 自动写作引擎（依赖 editor setters + callAIApi）
    useAgentChat.ts              # SSE 多智能体对话 + localStorage/后端持久化 + chatInput
    useAiAssist.ts               # kernelOptions/推演、一致性检测、章节摘要、灵感库
    useWizard.ts                 # 向导流程 + loadingTip effect
    useProjectKernel.ts          # 核心设定 temp* 同步、子 Tab、ruleFilter、KernelCard 展开、完善新书 Modal
    useCreationModals.ts         # 新建章节/角色/设定 Modal 状态 + handlers
    useResizablePanels.ts        # sidebar/aiPanel 宽度 + 折叠 + 拖拽 handler 工厂
  components/
    Dashboard.tsx                # 项目大厅
    wizard/WizardPanel.tsx
    settings/SettingsDrawer.tsx
    InspirationsModal.tsx
    workspace/
      WorkspaceSidebar.tsx       # 章节列表 + 左拖拽条
      WorkspaceTabs.tsx          # 顶部 3 Tab 头（write/outline/settings）
      WriteTab.tsx               # 新书 banner + 自动写作控制台 + 编辑器
      OutlineTab.tsx
      SettingsTab.tsx            # 子 Tab：网文内核（KernelDimensionCard 列表 + 反 AI）/ 故事资产
      KernelDimensionCard.tsx    # 由 renderKernelDimensionCard 抽出
      AgentPanel.tsx             # 右侧智能体面板 + 右拖拽条
    modals/
      NewChapterModal.tsx
      NewCharacterModal.tsx
      NewRuleModal.tsx
      EditProjectModal.tsx
  components/AssetCards.tsx       # 既有，保留
  components/Markdown.tsx         # 既有，保留
```
（若某个 hook 体量过小可合并；leaf modals/KernelDimensionCard 用显式 props，feature 面板用 `useWorkspace()`。）

## 状态共享设计
`page.tsx` 顺序调用各 hook 并显式连线依赖，再聚合为**命名空间化**的 context value，避免 150 字段大平铺：

```ts
const value = {
  store, ui: { isAiLoading, setIsAiLoading },   // isAiLoading 保持单一全局忙标志（见下）
  routing, editor, models, autoWriter, agent,
  assist, wizard, kernel, modals, layout,
};
<WorkspaceProvider value={value}> ... </WorkspaceProvider>
```
消费端：`const { editor, autoWriter } = useWorkspace();`

**关键跨 hook 依赖（在 page.tsx 连线）：**
- `useAiClient().callAIApi` 注入 `useAutoWriter`/`useAiAssist`/`useWizard`/`useProjectKernel`。
- `useEditor` 的 `setEditorContent`/`setSaveStatus`/`editorContent` 注入 `useAutoWriter`（自动写作写编辑器）与 `useAiAssist`（润色/检测/摘要读编辑器内容）。
- `useWorkspaceRouting` 的 `router`/`buildWorkspaceUrl` 注入 `useWizard`、`Dashboard`、`WorkspaceSidebar`、`WorkspaceTabs`。
- `kernelOptions`/`isKernelLoading`/`fetchKernelOptions`（assist）被 `OutlineTab` 与 `SettingsTab` 共用。

**re-render 说明**：当前是单组件，任意 setState 已触发整树渲染；改为单 context value 后渲染面与现状一致，无回退。后续如需可拆分 context / 选择器优化（本次不做，避免过度设计）。

## 行级抽取映射（实现时机械搬运）
逻辑 -> hooks：
- callAIApi 43-103 -> useAiClient
- 20-22 / 29-41 / 767-794（init+URL 恢复）/ 860-946 seedDemoData / mounted 23-26 -> useWorkspaceRouting
- 453-456 / 802-857 / 1831-1843 exportFile -> useEditor
- 105-119 / 121-273 / renderSettingsDrawer 内 2457-2523（add/edit/save/agentsList）/ showSettings 279 -> useModelSettings
- 445 / 460-465 / 1208-1347 -> useAutoWriter
- 317-346 / 349-440 / 442-443 / 1379-1638 -> useAgentChat
- 524-526 / 565-585 / 1663-1680 / 1707-1731 / 450 checkResult / 468-489 / 1733-1828 -> useAiAssist
- 281-284 / 492-504 / 755-764 / 949-1071 / 1073-1128 / 1038-1042 -> useWizard
- 288-293 / 529-562 / 535-542 / 987-1036 / 530-532 / 3311-3314 filteredRules / 526 expandedKernelCard -> useProjectKernel
- 280 / 285-314 / 1131-1205 -> useCreationModals
- 506-520（+拖拽 3470-3494 / 4180-4204）-> useResizablePanels

render -> components：
- 3360-3406 Dashboard / 1846-2453 WizardPanel / 2456-2992 SettingsDrawer / 2994-3309 InspirationsModal
- 3412-3466(+3469-3495) Sidebar / 3500-3542 WorkspaceTabs / 3545-3712 WriteTab / 3713-3796 OutlineTab / 3797-4176 SettingsTab / 588-753 KernelDimensionCard / 4206-4380(+4180-4204) AgentPanel
- 4391-4405/4408-4460/4463-4493/4496-4550 -> 四个 modal
- navbar 3336-3353 与顶层视图切换留在 page.tsx

## 死代码清理（明确列出，可逐条否决）
确认完全未接线，建议删除：
- `activeTab`/`setActiveTab`（275）
- 遗留单助手聊天：`chatMessages`/`setChatMessages`（318）、`chatBottomRef`（457）、滚动 effect（797-799）、`handleSendChatMessage`（1350-1376）
- `handlePolishText`（1642-1660）+ `polishInstruction`（446）+ `outlineResult`/`setOutlineResult`（448）
- `handleGenerateOutline`（1683-1704）+ `outlineChapters`（447）
- page.tsx 第 3 行未使用的 `Suspense` 导入

需先核实再决定（实现时确认）：
- `showNewProjModal` + “新建项目 Modal” 路径 + `handleCreateProject`/`newProj*`：疑似被向导取代而未接线；若确认无入口则一并移除。

保留（write-only 但 handler 已接线）：`checkResult`（由已接线的 `handleConsistencyCheck` 写入但未渲染）—— 保持不动，仅备注为后续可做的 UI 补全。

## 行为保持要点
- `isAiLoading` 维持**单一全局 AI 忙标志**（被 wizard 创建按钮、灵感导入、摘要等共用），放在 `ui` 命名空间，语义与现状完全一致；不要按功能拆成多个 loading。
- `agent_messages_<projectId>` 的 localStorage key 与后端 `/api/agent/history` 同步逻辑、防抖、流式过滤保持不变。
- `layout_sidebar_width`/`layout_ai_panel_width` 等 localStorage key 不变。
- 自动写作的 `autoWriteStopRef` 暂停语义、章节遍历/跳过逻辑、摘要联动角色卡逻辑保持不变。

## 实现顺序（每步均可编译 + 验证 + 提交）
1. `useAiClient` + `useWorkspaceRouting` + `useEditor`：把对应逻辑移出，page.tsx 改为调用 hook 返回值，JSX 暂不动。typecheck + dev 验证。提交。
2. 其余 hooks（models/autoWriter/agent/assist/wizard/projectKernel/creationModals/resizable）：同样仅搬运逻辑，连线依赖。typecheck + dev。提交。
3. 新建 `workspace-context.tsx`，page.tsx 用 hooks 输出组装 value 并以 `WorkspaceProvider` 包裹现有 JSX（仍内联）。提交。
4. 按簇抽组件并改为 `useWorkspace()`/props：modals -> Dashboard -> WizardPanel -> SettingsDrawer -> InspirationsModal -> Sidebar/Tabs -> WriteTab/OutlineTab -> SettingsTab + KernelDimensionCard -> AgentPanel。每簇抽完即 typecheck + dev 点检，分组提交。
5. 执行死代码清理；最终 page.tsx 收敛核对（~300 行）。提交。

## 关键文件
- 改：`app/page.tsx`
- 复用/读取：`lib/store.ts`（`useNovelStore`、`ModelConfig`）、`lib/db.ts`（类型）、`lib/constants.ts`（`GENRE_CATEGORIES`/`TONES`/`PRESET_TAG_GROUPS`）、`lib/rules.ts`（`DEFAULT_ANTI_AI_RULES`，形状 `{key,name,promptInstruction}`）、`app/components/AssetCards.tsx`、`app/components/Markdown.tsx`
- 不改后端：`app/api/**`、`app/project/[id]/page.tsx`（仍 `export default Home`）

## 验证
- 类型：`pnpm exec tsc --noEmit`（或 `pnpm build`）每个里程碑通过。
- 运行：`pnpm dev`（端口 4000）逐项手测：
  1. 项目大厅渲染/删除；新建向导 4 步 + 直接开书 + 创建项目跳转 URL。
  2. 工作台三 Tab（连载写作/核心大纲/核心设定）切换与 URL 同步、章节选择 URL 同步。
  3. 编辑器输入自动保存、手动保存、导出 md。
  4. 自动写作引擎：开始/暂停、进度、连写、摘要联动；纯编辑模式切换。
  5. 右侧智能体面板：发送、SSE 流式（thinking/token/tool/delegate/final）、清空历史、刷新后历史恢复。
  6. 设置抽屉：模型池增删改、测试连通、在线拉取模型、智能体绑定与参数覆盖、全局提示词。
  7. 灵感库弹窗：生成/勾选/导入；完善新书 Modal 的 AI 推演与保存；核心设定 KernelCard 选用/保存、反 AI 规则开关。
  8. 左右面板拖拽与 sidebar 折叠；刷新后宽度保持。
- 回归判据：以上行为与重构前完全一致；控制台无新增报错；UI 无 Emoji。
