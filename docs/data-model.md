# 数据模型

记忆数据由 memory 插件独占，使用插件 Mongo 连接。宿主不直接读写这些集合。

```text
User
 └─ MemoryStore
     ├─ MemoryDomain
     │   └─ MemoryEntry
     │       ├─ MemoryVersion
     │       ├─ ConversationMemory
     │       └─ text vector
     └─ MemoryImage
         └─ image vector
```

## memorystores

| 字段 | 说明 |
|---|---|
| `userId` | 所有者 |
| `name` | store 名称，`(userId, name)` 索引 |
| `isDefault` | 默认 store |
| `created_at` / `updated_at` | 时间 |
| `tenantId` | 租户隔离 |

默认 store 在用户第一次使用记忆时创建；共享 store 的数据仍归 owner，调用者通过 ACL 访问。

## memorydomains

| 字段 | 说明 |
|---|---|
| `userId` / `storeId` | 归属 |
| `name` | domain 文件夹名，`(storeId, name)` 唯一 |
| `kind` | `real` / `fictional` / `project` / `work` / `study` / `sandbox` 等 |
| `description` | 一行说明 |
| `isDefault` | 默认 domain，不可删除 |
| `createdBy` | `user` / `agent` |
| `tenantId` | 租户隔离 |

domain 决定召回范围和写入归属；一轮对话只读写 active domains。

## memoryentries

| 字段 | 说明 |
|---|---|
| `userId` / `storeId` / `domainId` | 归属 |
| `key` | 稳定标识，`^[a-z0-9_]+$`，最长 1000 字符 |
| `value` | 正文，可带末尾 `tags:` / `@key` 关联 |
| `tags` | 写入时物化的标签，供召回 |
| `tokenCount` | token 估计 |
| `stable` | 进入 stable 基线 |
| `injection` | `system` 或 `additional` |
| `locked` | 阻止 LLM 改写 |
| `updated_at` | 排序和衰减依据 |
| `tenantId` | 租户隔离 |

索引：`(storeId, key)`、`(storeId, domainId)`。

`stable` 与 `injection` 的组合：

- `stable=true, injection=system` → system 基线
- `stable=true, injection=additional` → dynamic 尾部
- `stable=false` → 每轮召回

## memoryversions

每次成功写入前的快照：

| 字段 | 说明 |
|---|---|
| `memoryId` | 对应 entry |
| `value` | 旧值 |
| `key` / `domainId` | 旧位置 |
| `createdAt` | 版本时间 |

按 `(memoryId, createdAt)` 倒序读取；恢复版本会重新写入 entry 并生成新版本。

## conversationmemories

记忆与会话的关联：

| 字段 | 说明 |
|---|---|
| `userId` / `conversationId` / `key` | 唯一 |
| `source` | `extracted` 或 `recalled` |
| `messageId` | 触发写入/召回的消息 |
| `createdAt` | 时间 |

用途：

- 排除“本会话刚刚写入”的记忆，避免立刻又召回；
- 会话删除/压缩时清理关联；
- 前端显示本轮 recalled 列表。

## memoryimages

| 字段 | 说明 |
|---|---|
| `userId` / `storeId` | 归属 |
| `sha256` | 内容哈希，`(userId, storeId, sha256)` 唯一 |
| `dhash` | 64 位 dHash，近重复扫描 |
| `id` | 每用户递增编号，用于 VFS 路径 |
| `mime` / `width` / `height` / `bytes` | 元数据 |
| `data` | 原图 bytes |
| `source` | `attachment` / `tool` |
| `origin` | conversation / message / file / tool |
| `embedded` | 是否已有向量 |
| `tenantId` | 租户隔离 |

## memoryextractionprompts

每用户自定义抽取提示词，对应 `/memory/EXTRACTION.md`：

- `userId` 唯一；
- `instructions` 为空表示回退到 agent 或默认提示词；
- 写入/删除通过 VFS 或 RPC，不直接暴露给模型。

## 向量表

- `memory_vectors`：记忆正文/section 的 embedding + 元数据
- `image_vectors`：图片 embedding

维度由 `MEMORY_EMBED_DIM` / `MEMORY_IMAGE_DIM` 决定，默认 1024。表在首次启动时自动创建；换模型后必须重建并重新生成向量。

## 隔离规则

1. **用户隔离**：所有查询带 `userId`。
2. **store 隔离**：召回、写入、VFS 都以 store 为边界。
3. **domain 隔离**：active domain 同时是读范围和写范围。
4. **共享 store**：ACL 决定 VIEW/EDIT；数据仍归 owner。
5. **租户隔离**：模型带 `tenantId`，查询由 tenant isolation 包装。

## 删除语义

- 删除 entry → 删除版本、会话关联、文本向量。
- 删除 domain → 先处理其记忆，不能留下悬挂 entry。
- 删除 store → 清理全部 entry/version/link/image/vector。
- 删除用户 → 清理所有 store、entry、image 和会话关联。
