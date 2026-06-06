# 世界设定：静态/动态分层 —— 新建「世界状态层（World State）」

## Context（为什么做）

当前「世界设定」把两类本质不同的信息混在一起：
- **静态设定（Canon）**：作者立的规矩，贯穿全书不该变（worldSetting/powerSystem/goldFinger/coreConflict 等核心设定 + WorldRule 里的法则）。记忆注入时已标注「贯穿全书、不得自相矛盾」。
- **动态状态（State）**：随剧情演化（势力格局、主角境界、所在地、时间进度、关键物品归属）。目前散落在 WorldRule 里被当成静态全量注入，没有随写作更新——这是长篇「跑偏」的高发区（第一优先级要解决的问题）。

本次新建一个独立的**世界状态层**：由 AI 每章写完后自动增量维护、人工可校对、可锁定（pinned）防 AI 覆盖。与静态 Canon 用不同口吻注入提示词（「铁律不可违背」 vs 「当前快照、以最新为准」）。

**范围边界（已与用户确认）**：
- 世界状态层**不含人物**。人物当前状态已由现有人物卡每章自动更新（useAutoWriter.ts:184-196 把 characterChanges 写回 Character.currentState），不重复。世界状态层只管「世界级」动态：势力格局、主角境界/实力、当前所在地、时间进度、关键物品归属、其他。
- 展示与校对入口**两处都加**：写作页「AI 记忆」面板（就近快速校对）+ 世界设定页新增「世界状态」素材项（完整管理）。

> 注意：世界设定页 OutlineTab 用户标记过「后续要重构」。本次**只新增一个素材项的渲染分支，不重构现有结构**，待用户的大重构再统一收拢。

## 设计概览

复用项目已有的两条成熟范式，几乎不发明新机制：
1. **AI 自动维护并落库**：照搬 `foldSynopsis` 范式（`ai.updateRollingSynopsis` 算 → `db.updateProject` 落库）做 `foldWorldState`。
2. **行内人工校对**：照搬 MemoryPanel 的 `EditableText` 组件 + WorldRule 卡片的 debounce 自动保存。

数据上用**独立表 + 多条目**（而非单 JSON 字段），因为要支持「单条编辑、单条锁定」的细粒度校对。

## 数据模型

`prisma/schema.prisma` 新增 model（字段简单、无 JSON 数组字段，CRUD 最省）：

```prisma
model WorldState {
  id              String       @id
  projectId       String
  project         NovelProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  category        String       // 势力格局 | 主角境界 | 当前所在地 | 时间进度 | 关键物品 | 其他
  name            String       // 条目名，如「主角实力」「天澜宗」
  content         String       // 当前状态描述（AI 会更新，人工可改）
  pinned          Boolean      @default(false) // 人工锁定：AI 自动维护时不得覆盖/删除
  source          String       @default("ai")  // ai | manual
  updatedAtChapter String      @default("")     // 最后更新于哪一章（可追溯）
  updatedAt       DateTime     @updatedAt
}
```

`NovelProject` 加关系：`worldStates  WorldState[]`。

**pinned 是防跑偏的关键**：人工校对过的条目锁定后，AI 每章重算时跳过它们，保证人工纠偏不被自动覆盖。

## 后端改动

### 1. `lib/db.ts`
- 加 `interface WorldState`（含 pinned/source/updatedAtChapter）。
- 加 CRUD（仿 WorldRule，lib/db.ts:354-399，无需 JSON parse/stringify）：`getWorldStates(projectId)` / `getWorldState(id)` / `createWorldState` / `updateWorldState(id, updates)` / `deleteWorldState(id)`。
- 加 `replaceAutoWorldStates(projectId, items)`：删除该项目所有 `pinned=false` 条目，批量插入 AI 输出的新条目（source='ai'）。pinned 条目保留不动。供 foldWorldState 落库用。

### 2. `app/api/world-states/route.ts`（新）+ `app/api/world-states/[id]/route.ts`（新）
完全仿 `app/api/world-rules/` 两个文件：GET(list by projectId)/POST(create)、PUT/DELETE。

### 3. `lib/ai.ts` 新增 `ai.updateWorldState(projectId, apiKey?, modelName?)`
仿 `updateRollingSynopsis`（lib/ai.ts:1077-1109）：
- 读 `db.getProject`（rollingSynopsis）+ `db.getChapters`（取最近 N 章摘要）+ `db.getWorldStates`（现有台账）。
- prompt：给「现有世界状态台账（标出哪些已锁定·不可改）」+「滚动概要」+「最近章节摘要」，要求输出更新后的**非锁定**世界状态条目数组 JSON：`[{category, name, content}]`。维度限定在上面 6 类。
- 用 `safeParseJSON`（lib/ai.ts:28）解析；无 key 时走 mock 兜底（返回现有台账不变）。
- 返回数组，**调用方负责落库**（与 updateRollingSynopsis 一致）。

### 4. `app/api/ai/route.ts` 新增 `case 'foldWorldState'`
仿 `foldSynopsis`（app/api/ai/route.ts:144-152）：
```
const items = await ai.updateWorldState(projectId, apiKey, modelName);
await db.replaceAutoWorldStates(projectId, items);
return NextResponse.json({ worldStates: items });
```

## 记忆注入 —— `lib/memory.ts`

- `searchMemory`（memory.ts:91）的 `Promise.all` 加 `db.getWorldStates(projectId)`。
- `formatContext`（memory.ts:156）在 WorldRule 静态分区之后、滚动概要之前，新增动态分区：
  ```
  【世界当前状态（随剧情演化，以下为最新快照，须以此为准）】：
  - [势力格局] 天澜宗：……
  - [主角境界] 当前修为：……
  ```
  按 category 分组。口吻强调「最新快照、以此为准」，与静态 Canon 的「铁律不得矛盾」区分开。
- `MemorySearchResult` 接口加 `worldStates` 字段。

## 前端改动

### 5. `lib/store.ts`
- `NovelStore` 加 `worldStates: WorldState[]` + `fetchWorldStates/createWorldState/updateWorldState/deleteWorldState`（仿 worldRules，store.ts:651-704，走 `/api/world-states`）。
- `setCurrentProject`（store.ts:466）里补 `get().fetchWorldStates(project.id)`。

### 6. `app/hooks/useAutoWriter.ts`（自动维护触发点）
在 foldSynopsis 之后（useAutoWriter.ts:199-203）追加：
```
try { await callAIApi({ action: 'foldWorldState', projectId }); } catch {}
await store.fetchWorldStates(projectId); // 刷新视图
```

### 7. `app/hooks/useChapterMemory.ts`
- 从 `store.worldStates` 派生「按 category 分组」的视图数据。
- 加写回动作：`saveWorldState(id, content)` / `toggleWorldStatePinned(id, pinned)` / `addWorldState(item)` / `removeWorldState(id)`（调 store 对应方法）。
- 加手动触发：`refreshWorldState()` → `callAIApi({action:'foldWorldState'})` + fetch（供面板上「立即让 AI 复盘世界状态」按钮）。
- 在返回对象里导出这些（MemoryPanel 经 workspace-context 已能拿到，无需改 context 类型）。

### 8. `app/components/write/MemoryPanel.tsx`（写作页校对）
在「未回收伏笔」区块附近新增「世界当前状态」区块：
- 复用现有 `EditableText`（MemoryPanel.tsx:8）做 content 行内校对、`SectionLabel`、`boxStyle`。
- 每条显示 category 标签 + name + 可编辑 content + 一个锁/解锁图标（pinned 切换，提示「锁定后 AI 不再覆盖」）。
- 顶部一个小按钮「让 AI 复盘世界状态」(refreshWorldState)。

### 9. 世界设定页素材项
- `app/hooks/useMaterialTabs.ts`：`MATERIALS_LIST`（useMaterialTabs.ts:18）加 `{ id: 'worldState', label: '世界状态', icon: Globe, color: '#22d3ee' }`；`ASSET_MATERIAL_IDS`（:37）加 `'worldState'`。
- `app/components/OutlineTab.tsx`：加分支 `activeMaterial === 'worldState'` → 渲染 `<WorldStateView />`。
- `app/components/WorldStateView.tsx`（新，含 `WorldStateCard` + `AddWorldStateCard`）：仿 AssetCards 的 WorldRuleCard（AssetCards.tsx:221，debounce 2s 自动保存），但字段为 category/name/content + pinned 开关；顶部加「一键 AI 复盘世界状态」按钮（调 foldWorldState）。为控制单文件 ≤500 行，卡片与视图都放此新文件。

## 关键复用点（避免重复造轮子）
- 落库范式：`app/api/ai/route.ts:144` `foldSynopsis`。
- AI 维护范式：`lib/ai.ts:1077` `updateRollingSynopsis`、JSON 解析 `safeParseJSON`（:28）。
- CRUD 模板：`lib/db.ts:354-399` WorldRule、`lib/store.ts:651-704`。
- 行内校对：`app/components/write/MemoryPanel.tsx:8` `EditableText`。
- 卡片自动保存：`app/components/AssetCards.tsx:221` `WorldRuleCard`。
- 素材接入：`app/hooks/useMaterialTabs.ts:18` + `app/components/OutlineTab.tsx:152`。

## 验证（端到端）
1. `npx prisma db push` 同步 schema（本项目无 migrations 目录，走 db push）；**改 schema 后重启 dev server** 以重新生成 prisma client。
2. `pnpm dev` 起服务，浏览器验证：
   - 世界设定页出现「世界状态」素材项，可新建/编辑/删除条目、可锁定(pinned)。
   - 写作页「AI 记忆」面板显示世界状态、可行内校对、可锁定。
3. 选一章跑 AI 自动写作（GenerationControl 续写下一章），确认：
   - 写完后 `foldWorldState` 被触发，世界状态台账被 AI 更新（content 随剧情变）。
   - **pinned 条目未被覆盖**（先 pin 一条、改其 content，再写一章，确认保持不变）。
4. MemoryPanel 点「AI 实际检索到的记忆」(memoryPreview)，确认注入了「世界当前状态」分区，口吻为「最新快照、以此为准」。
5. `pnpm build` 通过（类型检查）。

## 文件清单
**新建**：`app/api/world-states/route.ts`、`app/api/world-states/[id]/route.ts`、`app/components/WorldStateView.tsx`
**修改**：`prisma/schema.prisma`、`lib/db.ts`、`lib/ai.ts`、`app/api/ai/route.ts`、`lib/memory.ts`、`lib/store.ts`、`app/hooks/useAutoWriter.ts`、`app/hooks/useChapterMemory.ts`、`app/components/write/MemoryPanel.tsx`、`app/hooks/useMaterialTabs.ts`、`app/components/OutlineTab.tsx`
