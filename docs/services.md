# Embedding 与 Rerank 服务

memory 通过 HTTP 调用两个可选服务：

```text
embedding  文本/图片向量
rerank     候选重排
```

两者都使用 Jina 风格的 `/v1/...` JSON API。服务不可用时 memory 会降级，不阻断对话。

## Embedding

### 端点

```http
POST {MEMORY_EMBED_URL}/v1/embeddings
Content-Type: application/json
```

### 文本

```json
{
  "model": "jina-embeddings-v5-omni-small",
  "input": ["要嵌入的文本"],
  "task": "retrieval.passage"
}
```

`task`：

- `retrieval.query`：召回 query
- `retrieval.passage`：记忆正文、图片文本

### 图片

```json
{
  "model": "jina-embeddings-v5-omni-small",
  "input": [{ "image": "data:image/png;base64,..." }],
  "task": "retrieval.passage"
}
```

模型必须支持多模态输入；文本和图片共用同一模型。

### 响应

```json
{ "data": [{ "embedding": [0.123, -0.456, 0.789] }] }
```

要求：

- `data[0].embedding` 是非空数字数组
- 维度与 pgvector 表一致（`MEMORY_EMBED_DIM` / `MEMORY_IMAGE_DIM`）
- 一次请求一个 input；不要求 batch/index 字段

### 超时

| 用途 | 配置 | 默认 |
|---|---|---:|
| 文本 | `MEMORY_EMBED_TIMEOUT_MS` | 30000 |
| 图片文本 query | `MEMORY_IMAGE_TEXT_TIMEOUT_MS` | 15000 |
| 图片 | `MEMORY_IMAGE_TIMEOUT_MS` | 60000 |

失败：

- 文本 → 丢弃向量召回，标签/词法继续
- 图片 → 图片仍入库，`embedded: false`

## Rerank

### 端点

```http
POST {MEMORY_RERANK_URL}/v1/rerank
Content-Type: application/json
```

### 请求

```json
{
  "model": "jina-reranker-v3.5",
  "query": "用户这一轮的问题",
  "documents": ["候选记忆 1", "候选记忆 2"],
  "return_documents": false
}
```

### 响应

```json
{
  "results": [
    { "index": 0, "relevance_score": 0.82 },
    { "index": 1, "relevance_score": 0.41 }
  ]
}
```

要求：

- `index` 必须对应请求中的 document 下标
- `relevance_score` 可正可负，只在同一次请求内可比
- 每个候选都要有分数；缺一个就整体放弃本次重排，保留原顺序
- 允许返回顺序与输入不同

### 超时

`MEMORY_RERANK_TIMEOUT`，默认 15000ms。失败/超时只记日志，不阻断本轮。

## 认证与代理

`MEMORY_EMBED_TOKEN` / `MEMORY_RERANK_TOKEN` 会加 Bearer header；`MEMORY_EMBED_PROXY` / `MEMORY_RERANK_PROXY` 通过 undici ProxyAgent。

注意：token/proxy 当前直接读进程环境变量，不走 `config.json` 的扁平键；服务地址、模型、超时等仍可通过配置覆盖。

## PostgreSQL / pgvector

向量存储由 database 插件提供连接。memory 首次启动时创建：

- `memory_vectors`
- `image_vectors`

已有表不会被覆盖。更换 embedding 模型或维度后，需要重建表并重新生成所有向量。

## 健康检查

```bash
curl -s http://127.0.0.1:8788/v1/embeddings \
  -H 'content-type: application/json' \
  -d '{"model":"jina-embeddings-v5-omni-small","input":["ping"],"task":"retrieval.query"}'

curl -s http://127.0.0.1:8787/v1/rerank \
  -H 'content-type: application/json' \
  -d '{"model":"jina-reranker-v3.5","query":"ping","documents":["pong"],"return_documents":false}'
```

## 最小兼容实现

- embedding：接收 `input` / `task`，返回 `data[0].embedding`
- rerank：接收 `query` / `documents`，返回 `results[].index` + `results[].relevance_score`

不需要流式、批量或文档回传。
