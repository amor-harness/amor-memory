# RPC

memory runtime 暴露 `memories.*` 和内部 `memory.vfs.provider` 方法。浏览器通过 `api.call`、宿主通过 kernel 调用；没有公开的 `/api/memories` HTTP 路由。

## 调用上下文

每个方法收到 kernel 附加的 `meta`：

| 字段 | 用途 |
|---|---|
| `userId` | 当前用户；所有数据查询都会使用 |
| `role` | ACL 与角色权限计算 |
| `tenantId` | 租户隔离 |

服务端不从参数信任 `userId`。store 共享、domain 归属和用户偏好都以 meta 为准。

## 记忆

| 方法 | 参数 | 说明 |
|---|---|---|
| `memories.list` | `{ storeId? }` | 列出可读记忆 |
| `memories.create` | `{ storeId?, key, value, domainId?, stable?, injection?, locked?, conversationId? }` | 创建 |
| `memories.update` | `{ storeId?, key, newKey?, value?, domainId?, stable?, injection?, locked? }` | 更新/重命名/移动 |
| `memories.delete` | `{ storeId?, key }` | 删除 |
| `memories.versions` | `{ storeId?, key }` | 版本列表 |
| `memories.versions.restore` | `{ storeId?, key, versionId? }` | 恢复版本 |
| `memories.conversation` | `{ storeId?, conversationId? }` | 会话关联记忆 |
| `memories.preferences` | `{}` | 用户记忆开关 |
| `memories.preferences.set` | `{ memories?: boolean }` | 更新开关 |

## Store

| 方法 | 说明 |
|---|---|
| `memories.stores` | 可读 store 列表 |
| `memories.stores.create` | 创建 store |
| `memories.stores.rename` | 重命名 |
| `memories.stores.share` | 读取共享状态 |
| `memories.stores.share.search` | 搜索可共享主体 |
| `memories.stores.share.update` | 新增/移除/公开共享 |
| `memories.stores.clear` | 清空 store 内记忆 |
| `memories.stores.delete` | 删除 store |
| `memories.permissions` | 当前角色权限 |
| `memories.permissions.set` | 更新角色权限 |

## Domain

| 方法 | 说明 |
|---|---|
| `memories.domains` | 列出 domain；可带 `conversationId` 返回 active scope |
| `memories.domains.create` | 创建 domain |
| `memories.domains.update` | 更新 name/kind/description |
| `memories.domains.delete` | 删除；`force` 处理非空 |
| `memories.domains.setActive` | 设置会话 active domains |

## 图片

| 方法 | 说明 |
|---|---|
| `memories.image` | 按 sha256 读取图片 |
| `memories.image.url` | 按 URL 读取/代理图片 |
| `memories.images.delete` | 删除图片和向量 |

## 内部

`memory.vfs.provider` 由 VFS 引擎调用，用于 `/memory` 的 list/read/write/delete/search/glob；普通客户端不应直接使用。

## 错误语义

- 未找到 → 返回 not found，客户端显示空状态
- 无权限 → 拒绝，不泄露数据
- 只读共享 store 写入 → 拒绝
- stable 记忆直接删除 → 拒绝，提示先取消 stable
- locked 记忆被 LLM 改写 → 拒绝
- store/domain 不存在 → 400/404 语义

## 示例

```ts
const stores = await api.call('memories.stores', {});
const storeId = stores.stores[0].id;

const list = await api.call('memories.list', { storeId });
await api.call('memories.update', {
  storeId,
  key: 'coffee_preference',
  value: '用户喜欢浅烘',
  stable: false,
});
```
