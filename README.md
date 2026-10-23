# @amor-harness/memory

**中文** · [English](./README.en.md)

Amor 的长期记忆插件。它把记忆拆成 **store → domain → entry** 三层，负责自动抽取、混合召回、prompt 注入、`/memory` 虚拟文件系统和图片记忆。

## 能力

- **记忆库**：多 store、默认 store、共享与 ACL
- **领域**：现实、虚构、项目、工作等语境分区；domain 同时约束读写范围
- **自动抽取**：回复完成后异步提取事实，支持 `set_memory` / `append_memory` / `delete_memory`
- **混合召回**：向量 + 标签 + 词法 + cross-encoder + 时间衰减 + MMR
- **注入**：stable 系统基线 + 每轮动态上下文
- **VFS**：`/memory/<domain>/<key>.md`、`INDEX.yaml`、每用户 `EXTRACTION.md`
- **图片记忆**：归一化、dHash 近重复去重、图片向量、图文互搜
- **UI**：记忆面板、消息卡片、agent 记忆设置和记忆库共享

记忆按用户隔离；store 是隔离单元；stable 记忆进入基线，ephemeral 记忆按轮召回，两者不重复注入。

## 架构

```text
浏览器 UI
  ├─ 记忆面板 / 消息卡片 / agent 设置
  └─ 插件 API
        │
        ▼
memory runtime（插件 kernel 子进程）
  ├─ turn / 会话 / 图片 / VFS 生命周期钩子
  ├─ 记忆与 store 的插件 API
  ├─ 抽取、召回、注入、图片
  └─ /memory VFS provider
        │
        ├─ MongoDB：store / domain / entry / version / image
        └─ PostgreSQL + pgvector：文本与图片向量
```

宿主只在正确的 turn 时点通知插件；记忆的读写、召回和格式化都在插件内完成。

## 依赖

运行在 Amor 插件宿主中，需要：

- **database** — MongoDB 与 PostgreSQL/pgvector 连接
- **permissions** — store ACL 与共享
- **i18n** — 客户端词条
- **agent-runtime** — agent 生命周期与工具运行时

另外需要可选的 embedding 与 rerank HTTP 服务；没有 embedding 时召回降级到标签/词法，没有 rerank 时保留原排序。

## 安装

把目录放到宿主的插件根目录（例如 `plugin/memory`），入口由 `plugin.json` 指定。首次使用复制 `config.example.json` 为 `config.json`，填入 embedding / rerank 地址，然后构建：

```bash
npm install
npm run build
```

构建使用宿主 monorepo 的共享包（`@amor-harness/api` / `data-provider` / `data-schemas`）；独立克隆时需要这些包可被解析。

## 配置

`config.json` 是扁平键配置，按组填写：

```json
{
  "embedding": { "MEMORY_EMBED_URL": "http://127.0.0.1:8788", "MEMORY_EMBED_DIM": "1024" },
  "rerank": { "MEMORY_RERANK_URL": "http://127.0.0.1:8787" },
  "recall": { "MEMORY_RAG_CANDIDATES": "15", "MEMORY_RAG_LIMIT": "3" }
}
```

配置也可以被环境变量覆盖。完整字段、默认值和调参建议见 [docs/config.md](./docs/config.md)。

## 使用

### UI

- 侧边栏 **Memories**：浏览、搜索、新建、编辑、删除记忆；切换 stable/locked；查看版本
- 消息卡片：显示本轮 **memory updated** / **recalled** 结果
- Agent 设置 → Memory：选择 memory store 和 domain
- 共享对话框：把 store 共享给用户、组或公开访问

### 自动抽取

消息落库后，插件异步读取对话窗口，通过工具写入记忆；不会阻塞回复。同一会话的抽取串行执行，新 turn 会中断上一轮抽取。

### 召回与注入

每轮开始前，插件按当前 store 和 active domains 召回 ephemeral 记忆；stable 记忆单独组成可缓存的系统基线。两者都会去重，不重复占 token。

### VFS

```text
/memory/
  INDEX.yaml
  EXTRACTION.md
  <domain>/<key>.md
  <key>.md
  images/<id>.<ext>
```

`INDEX.yaml` 只读；`EXTRACTION.md` 是该用户的抽取提示词；普通记忆文件可读写。详见 [docs/vfs.md](./docs/vfs.md)。

## 文档

- [docs/README.md](./docs/README.md) — 文档索引
- [架构](./docs/architecture.md) — 进程、生命周期、模块
- [数据模型](./docs/data-model.md) — store/domain/entry/version/image
- [抽取](./docs/extraction.md) — 触发、调度、工具、失败恢复
- [召回](./docs/recall.md) — 向量/标签/词法/重排/衰减/MMR
- [注入](./docs/injection.md) — stable 与 dynamic 上下文
- [客户端](./docs/client.md) — 面板、卡片与插件 API
- [RPC](./docs/rpc.md) — `memories.*` 方法
- [VFS](./docs/vfs.md)
- [图片](./docs/images.md)
- [服务要求](./docs/services.md) — embedding / rerank
- [配置](./docs/config.md)
- [测试](./docs/testing.md)

## 开发

```bash
npm run typecheck
npm run typecheck:client
npm run build
npm test
```

产物：`runtime/dist/index.mjs` 和 `client/dist/index.mjs`。测试和真实链路验证见 [docs/testing.md](./docs/testing.md)。

## License

MIT
