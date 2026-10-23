# 模块参考

本页是目录级索引，具体行为见 architecture 和各专题文档。

## Runtime

```text
runtime/src/
  index.mts          插件入口：hook、RPC、生命周期
  backend/           记忆、store、domain、注入、图片、VFS 用例
  db/                Mongo 模型、方法、ACL、租户隔离
  domain/            domain scope 与 domain tools
  extraction/        抽取器、processor、工具、向量同步
  recall/            向量、标签、词法、重排、衰减、MMR
  vfs/               /memory provider
```

### backend

| 文件 | 职责 |
|---|---|
| `memories.mts` | 可读/可写 store、记忆列表、ACL 过滤 |
| `write.mts` | create/update/delete、容量与 locked 守卫 |
| `stores.mts` | store 创建、共享、清空、删除 |
| `domains.mts` / `domain-write.mts` | domain 查询与写入 |
| `history.mts` | 版本列表与恢复 |
| `conversation.mts` | conversation-memory 关联 |
| `preferences.mts` | 用户记忆开关 |
| `injection.mts` | stable/dynamic 上下文 |
| `recall-full.mts` | 完整召回入口 |
| `recall.mts` | 向量召回阶段 |
| `store.mts` | store 解析与记忆格式化 |
| `vfs.mts` | VFS 基础操作 |
| `extraction-prompt.mts` | `EXTRACTION.md` 存储 |
| `images.mts` / `image.mts` | 图片 ingest、读取、删除 |
| `tokens.mts` / `embed.mts` / `vectors.mts` | token、embedding、pgvector |

### recall

| 文件 | 角色 |
|---|---|
| `recall.mts` | 候选合并、重排、选择 |
| `lexical.mts` | 倒排索引与日期展开 |
| `tagVocabulary.mts` | 标签词表 |
| `reranker.mts` | Jina rerank 客户端 |
| `links.mts` | `@memory` 关联摘要 |
| `vectorStore.mts` | 文本向量 |
| `imageRecall.mts` / `imageStore.mts` | 图片向量 |
| `embeddings.mts` / `imageEmbeddings.mts` | embedding 客户端 |
| `transport.mts` | token/proxy transport |

### extraction

| 文件 | 角色 |
|---|---|
| `index.mts` | 抽取器、工具、调度、prompt |
| `processor.mts` | 单次抽取编排 |
| `database.mts` | 记忆数据层适配 |
| `vector-sync.mts` | 记忆变更 → 向量同步 |

### client

| 路径 | 职责 |
|---|---|
| `src/index.ts` | 激活、slot/panel 注册 |
| `src/runtime.ts` | app-ui / host UI 适配 |
| `src/data.ts` | RPC query/mutation |
| `src/sdk.ts` | 客户端传输类型 |
| `src/locales.ts` | 词条作用域 |
| `src/components/` | 面板、列表、卡片、store/domain 对话框 |
| `dist/index.mjs` | 浏览器 ESM bundle |

## 构建

`runtime/src` 由 `tsc` 输出到 `runtime/dist`；`client/src` 由 esbuild 打成单文件 ESM。新增 runtime 文件时确认 tsconfig include 覆盖，否则构建成功但运行时缺模块。
