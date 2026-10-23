# 数据模型

memory 系统使用独立 Mongo 连接（`runtime/db.mjs`），模型只属于 memory。

## 集合

### `memorystores`

一个用户可拥有多个记忆库。

| 字段                        | 说明     |
| --------------------------- | -------- |
| `userId`                    | 所有者   |
| `name`                      | 展示名   |
| `isDefault`                 | 默认库   |
| `created_at` / `updated_at` | 时间     |
| `tenantId`                  | 租户隔离 |

### `memoryentries`

一条记忆。

| 字段         | 说明                            |
| ------------ | ------------------------------- |
| `userId`     | 所有者                          |
| `storeId`    | 所属 store                      |
| `domainId`   | 所属 domain                     |
| `key`        | 稳定标识，通常 `[a-z0-9_]+`     |
| `value`      | 记忆正文，可含 trailing `tags:` |
| `tags`       | 物化标签                        |
| `stable`     | 是否进入 stable 注入            |
| `injection`  | `system` 或 `additional`        |
| `locked`     | 锁定，LLM 写入守卫              |
| `tokenCount` | token 用量                      |
| `updated_at` | 排序/注入时间                   |

### `memorydomains`

store 内的语境分区。

| 字段                 | 说明                                                               |
| -------------------- | ------------------------------------------------------------------ |
| `userId` / `storeId` | 归属                                                               |
| `name`               | 文件夹名                                                           |
| `kind`               | `real` / `fictional` / `project` / `work` / `study` / `sandbox` 等 |
| `description`        | 一行说明                                                           |
| `isDefault`          | 默认 domain，不可删除                                              |
| `createdBy`          | `user` / `agent`                                                   |

### `memoryversions`

每次写入的旧值快照，用于恢复。

### `conversationmemories`

记忆与会话的关联：

- `source: extracted`：本轮抽取写入；
- `source: recalled`：只被召回；
- 用于“排除本会话自己刚写的记忆”。

### `memoryimages`

图片记忆：

- sha256、dhash、mime、宽高、字节；
- 原始 bytes；
- `embedded` 标记；
- `origin`（conversation / message / file / tool）。

### `memoryimagecounters`

每用户图片编号序列。

### `memoryextractionprompts`

每用户抽取提示词，对应 VFS `/memory/EXTRACTION.md`：

```js
{
  (userId, instructions, updated_at, tenantId);
}
```

`userId` 唯一。为空表示使用 agent instructions 或代码默认提示词。

## 索引要点

- `memoryentries`: `(storeId, key)`, `(storeId, domainId)`
- `memorydomains`: `(storeId, name)` 唯一
- `memoryversions`: `(memoryId, createdAt)` 倒序
- `conversationmemories`: `(userId, conversationId, key)` 唯一
- `memoryimages`: `(userId, storeId, sha256)` 唯一；`(userId, id)` 稀疏唯一；`(userId, dhash)`
- `memoryextractionprompts`: `userId` 唯一

## 隔离规则

1. **用户隔离**：所有查询都带 `userId`。
2. **store 隔离**：召回、写入、VFS 都以 store 为边界。
3. **domain 隔离**：active domain scope 同时是读范围和写范围。
4. **共享 store**：owner 的 `userId` 持有数据；调用者通过 ACL 读写，`canWrite` 由 EDIT bit 决定。
5. **租户隔离**：模型带 `tenantId`，由 tenant isolation 逻辑控制。

## 数据层边界

- memory models / methods / ACL 全部由 memory 系统维护；
- 数据访问只经过 memory 的 `db` 层；
- 记忆能力通过系统接口使用，不直接访问 memory 集合。
