# 客户端与界面

客户端入口是 `client/dist/index.mjs`，由宿主作为 ESM 插件加载。它只负责 UI，所有数据通过 runtime 的 `memories.*` RPC 获取。

## 注册内容

| 类型 | slot / id | 说明 |
|---|---|---|
| 侧边栏面板 | `api.ui.panel({ id: 'memories' })` | Memories 页面 |
| 消息卡片 | `chat.message.cards` | 本轮 memory updated / recalled |
| 聊天头部 | `chat.header.actions` | 记忆范围对话框入口 |
| Agent 设置 | `agent.settings.memory` | store / domain 选择 |

客户端 `inject`：

```ts
['ui', 'app-ui', 'i18n']
```

`ui` 提供宿主的共享组件；`app-ui` 提供 `useAuthContext`、`useHasAccess`、`GenericGrantAccessDialog`、toast 等门面；`i18n` 提供词条作用域。

## 页面结构

```text
client/src/
  index.ts             插件激活、slot 注册
  runtime.ts           app-ui 与宿主 UI 适配
  data.ts              useRpc / query hooks / mutation helpers
  sdk.ts               客户端传输类型
  locales.ts           词条作用域
  components/
    MemoryPanel.tsx    侧边栏面板
    MemoryList.tsx     列表与搜索
    MemoryCard.tsx     单条记忆
    MemoryCreateDialog.tsx / MemoryEditDialog.tsx
    MemoryDomain*.tsx  domain 管理
    MemoryStore*.tsx   store 管理、共享、清空
    MemoryVersionList.tsx
    MemoryArtifacts.tsx 消息卡片
    AdminSettings.tsx   管理端设置
```

## 数据访问

`data.ts` 提供：

- `useRpc<T>(method, params, enabled?)` — 查询并缓存
- mutation helper — 调用 `memories.*` 并 invalidate 相关 key
- store / domain / memory 列表的查询 key

UI 不直接拼 REST URL；所有请求都走插件 kernel RPC。

## 主要流程

### 浏览与编辑

1. 面板加载 store 列表
2. 选择 store → 加载 domains 和 memories
3. 新建/编辑/删除通过 mutation RPC
4. 成功后在本地乐观更新并 invalidate
5. 版本对话框读取 `memories.versions`，恢复调用 `memories.versions.restore`

### Agent 设置

- 选择 memory store
- 选择 active domains
- 开关 `useMemory`
- 选项来自 `memories.stores` / `memories.domains`

### 共享

- `memories.stores.share` 读取当前 grant
- `memories.stores.share.search` 搜索用户/组
- `memories.stores.share.update` 应用新增/移除/公开
- 权限按钮受 `useHasAccess` 控制

### 消息卡片

`MemoryArtifacts` 读取 assistant message 的 attachments：

- `memory` 更新/删除记录
- 本轮 recall 结果
- 图片 artifact 的引用

卡片只展示，不重新查询全部记忆。

## i18n

词条在 `locales.ts`，通过：

```ts
i18n.forScope(memoryCatalogs)
```

注册。插件特有词条（面板、卡片、store/domain）在插件 catalog；通用按钮和共享对话框回退宿主词条。

## 样式与可访问性

- 使用宿主语义主题类（`bg-surface-tertiary`、`text-text-primary` 等），不写死颜色
- 弹窗、列表、开关复用 app-ui 组件
- 图标来自 `api.icons` / app-ui
- 交互元素带 `aria-label`，键盘可操作
- 小屏下 store/domain 选择器与面板布局保持单列

## 扩展边界

其他插件不应直接 import memory 的 React 组件。需要记忆数据时调用 `memories.*` RPC；需要展示时消费 memory 已注册的 slot，或由宿主提供新的通用 slot。

memory 不注册 token source；记忆注入的 token 由宿主上下文统计处理。
