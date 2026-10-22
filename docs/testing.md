# 测试与验证

## 1. 单元测试

```bash
cd plugin/memory
pnpm test
```

覆盖：

- `runtime/test/memory.test.mjs`：store、记忆 CRUD、注入、偏好
- `runtime/test/extraction-*.test.mjs`：抽取模块、工具、processor、DB
- `runtime/test/vfs-provider.test.mjs`：VFS 根目录、读写、domain、删除、搜索

## 2. VFS 测试

```bash
cd packages/api
NODE_ENV=test npx jest src/vfs/__tests__/vfs.test.ts
```

VFS facade 测试使用 fake provider；`/memory` 的真实语义由 memory 测试覆盖。

## 3. Agent 集成测试

```bash
cd api
NODE_ENV=test npx jest server/controllers/agents/client.test.js
```

覆盖：

- memory target 解析
- domain scope
- memory scope 解析
- 抽取触发参数
- 工具合并

## 4. 真实链路验证

### VFS

1. 发一条只读请求：

```text
只读取 /memory/INDEX.yaml 并告诉我第一行
```

2. 期待 tool output 包含：

```text
File: /memory/INDEX.yaml
# Memory index (read-only).
```

### Domain 工具

1. 发：

```text
调用 search_domains 搜索“潮汐岛”，只回复结果。
```

2. 期待模型调用 `memory__search_domains`，输出 domain 列表。

### 图片

1. `POST /api/files/images` 上传一张真实 PNG；
2. 检查：
   - `memoryimages` 新增一行；
   - `embedded: true`；
   - `image_vectors` 新增一行；
3. 清理：
   - `files` 文档；
   - 物理文件；
   - `memoryimages`；
   - `image_vectors`。

### 抽取

1. 用一次性会话发一条含新事实的消息；
2. 等待抽取完成；
3. 检查：
   - `memoryentries`
   - `memoryversions`
   - `conversationmemories`
   - `memory_vectors`（stable 记忆除外）
   - assistant 消息 `attachments`
4. 清理所有测试数据。

## 5. 清理清单

真实链路测试后必须删除：

- 新建的 conversation / messages；
- 新建或改写的 memory entries；
- memory versions；
- conversation memories；
- memory vectors / image vectors；
- 上传文件与 `files` 文档；
- 临时写入的 `EXTRACTION.md`（如果测试改过）。

## 6. 当前基线

- plugin：20 pass
- VFS：366 pass
- agent client：86 pass
- `root=200`
