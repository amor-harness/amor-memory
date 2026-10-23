# 测试与构建

## 命令

```bash
cd plugin/memory
npm run typecheck       # runtime
npm run typecheck:client
npm run build           # runtime tsc + client esbuild
npm test                # build + client tests + runtime tests
```

单独运行：

```bash
npm run build:runtime
npm run build:client
npm run test:runtime
node client/test/render.mjs
node client/test/interaction.mjs
node client/test/scope.mjs
```

产物：

```text
runtime/dist/
client/dist/index.mjs
```

`pretest` 会重新 build 并打包 `client/test/entry.ts` 到 `client/.test/bundle.mjs`。

## 测试分层

### 客户端

- `render.mjs`：面板、列表、卡片、agent 设置的渲染和 slot 注册
- `interaction.mjs`：新建/编辑/删除、store/domain 选择、共享对话框
- `scope.mjs`：记忆开关、store/domain scope 传递

客户端测试不启动浏览器，使用轻量 DOM/React harness。

### Runtime

- `memory.test.mjs`：store、CRUD、注入、偏好、ACL
- `extraction-*.test.mjs`：抽取模块、工具、processor、数据库适配
- `artifacts*.test.mjs`：消息 attachment 形状
- `vfs-provider.test.mjs`：`/memory` 路径、读写、domain、删除、搜索

## 真实链路

单元测试不能替代插件 kernel 与真实数据库。部署后至少验证：

```bash
curl -s -o /dev/null -w '%{http_code}\n' localhost:3080
```

通过已登录会话调用：

```text
memories.stores
memories.list
memories.domains
```

预期：返回当前用户的 store/记忆，不出现 missing method 或连接错误。

再走一次 UI：

1. 打开 Memories 面板，确认 store 和记忆加载
2. 新建一条记忆，切换 stable/locked
3. 编辑 domain / store 名称
4. 在 agent 设置选择 store 和 domains
5. 发起一轮会触发记忆的对话，确认消息卡片出现

## VFS 验证

在一次性会话中请求：

```text
只读取 /memory/INDEX.yaml 并告诉我第一行
```

预期 tool output 包含 `File: /memory/INDEX.yaml` 和只读索引内容。再验证：

- 写 `/memory/<key>.md` 创建记忆
- stable 记忆不能直接删除
- 写 `EXTRACTION.md` 后抽取使用新提示词

## 抽取验证

用一次性会话发送含新事实的消息，等待抽取完成，检查：

- `memoryentries` 新增/更新
- `memoryversions` 有旧值快照
- `conversationmemories` 有 link
- `memory_vectors` 有向量（stable 除外）
- assistant message 出现 memory artifact

## 清理

真实链路测试后必须清理：

- 新建的 conversation / messages
- 新建或改写的 memory entries
- memory versions
- conversation memories
- memory_vectors / image_vectors
- 上传文件和 `files` 文档
- 临时修改的 `EXTRACTION.md`
- 测试写入的 store/domain

不要在共享会话或真实用户数据上做写测试；优先使用一次性会话和测试账号。

## 常见故障

| 现象 | 检查 |
|---|---|
| 插件加载失败 | kernel 日志 `runtime_failed`，共享包/TSC 产物 |
| store/记忆全空 | database 插件是否提供 Mongo；初始化是否完成 |
| 召回总是空 | embedding URL、向量表维度、`MEMORY_RAG_*` |
| 抽取不触发 | `chat.afterRun` 是否注册、store/llmConfig/conversationId |
| 注入内容重复 | stable/recall 去重 key、domain scope |
| VFS 写失败 | 共享 store 是否只有 VIEW、key/domain 是否合法 |
| 图片无法召回 | `embedded` 是否为 true、图片维度/服务 |
