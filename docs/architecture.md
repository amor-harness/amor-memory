# 架构

## 进程边界

memory 插件运行在插件 kernel 的独立 Node 进程，浏览器 UI 以 ESM 模块加载。两侧不共享对象，只通过 kernel 的 hook 和 JSON-RPC 通信。

```text
plugin/memory/
  plugin.json
  runtime/src/index.mts     → runtime/dist/index.mjs
  client/src/index.ts       → client/dist/index.mjs
```

- **runtime** 拥有记忆数据、抽取、召回、注入、图片和 VFS provider。
- **client** 只负责 UI：面板、卡片、agent 设置和共享对话框。
- 宿主不实现记忆算法，只在 turn 的固定时点调用 hook。

## Runtime 生命周期

`apply(ctx, config)` 的主要步骤：

1. 把插件配置扁平化为键值，写入 memory config
2. 通过 `database` 插件获取 Mongo 和 PostgreSQL/pgvector 连接
3. 等待数据库就绪（异步重试，不阻塞插件加载）
4. 初始化向量表、模型和领域工具
5. 注册 `memories.*` RPC
6. 注册 kernel hooks
7. dispose 时注销 hooks、停止抽取任务

数据库暂时不可用时插件仍会加载；后续请求会继续尝试初始化，而不是让 kernel 启动失败。

## Hook 入口

| hook | 用途 |
|---|---|
| `chat.beforeRun` | 中断上一轮抽取、计算 domain scope、召回记忆 |
| `prompt.inject` | 生成 stable / dynamic 上下文 |
| `chat.afterRun` | 异步调度记忆抽取 |
| `conversation.deleted` | 清理该会话的 conversation-memory 关联 |
| `allConversations.deleted` | 清理用户所有会话关联 |
| `conversation.compacted` | 删除被压缩掉的消息对应的关联 |
| `user.deleted` | 清理该用户的全部记忆、图片和关联 |
| `image.ingest` | 图片入库、去重、向量化 |
| `vfs.memory` | `/memory` 文件操作转发 |

Hook 失败只记日志并返回 null，不应让对话主流程失败。

## RPC

浏览器和宿主 agent 通过 `memories.*` 读取/写入记忆：

- `memories.list` / `create` / `update` / `delete`
- `memories.domains*` / `stores*` / `versions*`
- `memories.permissions*` / `preferences*`
- `memory.vfs.provider`（内部 VFS 入口）

完整列表见 [rpc.md](./rpc.md)。每个方法都带 `userId`/`role`，服务端不从参数信任调用者身份。

## 数据边界

| 数据 | 存储 |
|---|---|
| store / domain / entry / version / conversation link | 插件 Mongo |
| 图片 bytes、sha256、dHash、元数据 | 插件 Mongo |
| 文本/图片向量 | PostgreSQL + pgvector |
| 用户偏好、共享 ACL | 插件 Mongo + permissions |
| 抽取提示词 | 插件 Mongo（`memoryextractionprompts`） |

宿主只提供连接和认证上下文；memory 不直接暴露数据库给其他插件。

## 模块

```text
runtime/src/
  index.mts          入口、hook、RPC
  backend/           领域服务：memory/store/domain/history/injection/images
  db/                模型、方法、ACL、租户隔离
  domain/            domain scope 与 domain tools
  extraction/        抽取器、processor、工具、向量同步
  recall/            向量/标签/词法/重排/衰减/MMR/图片召回
  vfs/               /memory provider
```

| 层 | 职责 |
|---|---|
| backend | 面向 RPC/hook 的用例，组合 db 与算法 |
| db | 唯一直接访问集合的层，所有查询带 userId/storeId/tenant |
| extraction | 从对话生成记忆变更，异步、可中断 |
| recall | 为当前 turn 排序和选择候选 |
| vfs | 把记忆映射成文件路径和读写语义 |
| client | React 组件、RPC 调用、词条和 slot 注册 |

## 生命周期不变量

- **用户隔离**：所有查询必须带 `userId`。
- **store 边界**：召回、写入、VFS 都以 store 为单位。
- **domain scope**：active domain 同时是读范围和写归属。
- **stable 不进 RAG**：stable 走基线，ephemeral 走召回。
- **抽取不阻塞回复**：`chat.afterRun` 只负责调度。
- **写入先落库再同步向量**：向量失败不回滚记忆。
- **共享只读**：有 VIEW 无 EDIT 的 store 可以召回，不能写。

## 降级

| 故障 | 行为 |
|---|---|
| embedding 不可用 | 跳过向量召回，使用标签/词法 |
| reranker 不可用 | 保留向量/标签顺序 |
| pgvector 不可用 | 词法召回仍可用 |
| 图片工具不可用 | 图片仍入库，`embedded: false` |
| 抽取 LLM 失败 | 回复已完成，不写半成品记忆 |
| 数据库暂时不可用 | 插件加载不失败，后续请求重试 |
