# 模块构成

## 1. 领域模块

| 模块     | 职责                                             |
| -------- | ------------------------------------------------ |
| 记忆存储 | store、domain、entry、version、conversation link |
| 抽取     | 从对话生成记忆变更                               |
| 召回     | 为当前 turn 选择相关记忆                         |
| 注入     | 把 stable/recall 结果放进 prompt                 |
| VFS      | `/memory` 文件视图与 `EXTRACTION.md`             |
| 图片     | 图片存储、去重、嵌入、召回                       |
| 权限     | store 共享与读写权限                             |
| UI       | 记忆面板、消息卡片、agent 设置                   |

## 2. 目录

```text
plugin/memory/
  runtime/
    backend/      记忆 CRUD、store、domain、注入、图片
    recall/       召回算法
    extraction/   抽取、调度、工具、向量同步
    domain/       domain runtime 与 domain tools
    vfs/          /memory provider
    db.mjs        数据连接与模型
    db/           本地数据层（models/methods/ACL）
  client/
    src/          面板、卡片、设置页
    dist/         浏览器 ESM bundle
  docs/           本目录
```

## 3. backend

| 文件                                       | 职责                         |
| ------------------------------------------ | ---------------------------- |
| `memories.mjs`                             | 权限、store 访问、记忆列表   |
| `write.mjs`                                | create/update/delete         |
| `stores.mjs`                               | store 创建、共享、清空、删除 |
| `domains.mjs` / `domain-write.mjs`         | domain 查询与写入            |
| `history.mjs`                              | 版本与恢复                   |
| `conversation.mjs`                         | 会话关联                     |
| `preferences.mjs`                          | 用户偏好                     |
| `injection.mjs`                            | stable/dynamic 注入          |
| `recall-full.mjs`                          | 完整召回入口                 |
| `recall.mjs`                               | 向量召回阶段                 |
| `store.mjs`                                | store 解析与格式化记忆       |
| `vfs.mjs`                                  | VFS 基础操作                 |
| `extraction-prompt.mjs`                    | `EXTRACTION.md` 存储         |
| `images.mjs` / `image.mjs`                 | 图片 ingest 与读取           |
| `tokens.mjs` / `embed.mjs` / `vectors.mjs` | token、embedding、pgvector   |

## 4. recall

| 文件                                     | 角色                 |
| ---------------------------------------- | -------------------- |
| `recall.mjs`                             | 候选合并、重排、选择 |
| `lexical.mjs`                            | 词法索引             |
| `tagVocabulary.mjs`                      | 标签词表             |
| `reranker.mjs`                           | cross-encoder        |
| `links.mjs`                              | `@记忆名` 关联       |
| `vectorStore.mjs`                        | 文本向量             |
| `imageRecall.mjs` / `imageStore.mjs`     | 图片向量             |
| `embeddings.mjs` / `imageEmbeddings.mjs` | embedding 客户端     |
| `transport.mjs`                          | HTTP 传输            |

## 5. extraction

| 文件              | 角色                |
| ----------------- | ------------------- |
| `index.mjs`       | 抽取器、工具、调度  |
| `processor.mjs`   | 单次抽取的编排      |
| `database.mjs`    | 记忆数据层适配      |
| `vector-sync.mjs` | 记忆变更 → 向量同步 |

## 6. domain

- `domain.mjs`：domain scope、domain runtime、domain tools
- `register.mjs`：注册 domain 工具与 `memory.domain.scope`

## 7. vfs

- `provider-impl.mjs`：`/memory` 路径语义、INDEX、domain 文件夹
- `provider.mjs`：provider 包装、`EXTRACTION.md`

## 8. client

| 路径              | 职责              |
| ----------------- | ----------------- |
| `src/index.js`    | UI 插槽入口       |
| `src/runtime.js`  | 前端 runtime      |
| `src/data.js`     | 数据请求          |
| `src/hooks.js`    | React Query hooks |
| `src/components/` | 面板、卡片、设置  |
| `dist/index.mjs`  | ESM bundle        |
