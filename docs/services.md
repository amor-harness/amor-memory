# Embedding 与 Rerank 服务要求

memory 系统依赖两个 HTTP 服务：

```text
embedding  文本/图片向量
rerank     cross-encoder 候选重排
```

两者都按 Jina/OpenAI 风格的 `/v1/...` JSON API 调用。

## 1. Embedding 服务

### 端点

```http
POST {MEMORY_EMBED_URL}/v1/embeddings
Content-Type: application/json
Authorization: Bearer <MEMORY_EMBED_TOKEN>   # 可选
```

### 文本请求

```json
{
  "model": "jina-embeddings-v5-omni-small",
  "input": ["要嵌入的文本"],
  "task": "retrieval.passage"
}
```

`task` 取值：

- `retrieval.query`：召回 query；
- `retrieval.passage`：记忆正文、图片。

### 图片请求

```json
{
  "model": "jina-embeddings-v5-omni-small",
  "input": [
    {
      "image": "data:image/png;base64,...."
    }
  ],
  "task": "retrieval.passage"
}
```

文本和图片使用同一个 embedding 模型；模型必须支持多模态输入。

### 响应

```json
{
  "data": [
    {
      "embedding": [0.123, -0.456, 0.789]
    }
  ]
}
```

要求：

- `data[0].embedding` 是非空数字数组；
- 向量维度固定，且与 pgvector 表的列维度一致；
- 不要求返回 `index`、`object` 等额外字段；
- 一次请求只发一个 input，不依赖批量接口。

### 超时

| 用途 | 配置 | 默认 |
|---|---|---|
| 文本 embedding | `MEMORY_EMBED_TIMEOUT_MS` | 30000 |
| 图片文本 query | `MEMORY_IMAGE_TEXT_TIMEOUT_MS` | 15000 |
| 图片 embedding | `MEMORY_IMAGE_TIMEOUT_MS` | 60000 |

超时或 HTTP 非 2xx：

- 文本 embedding 抛错，召回阶段降级；
- 图片 embedding 返回 `null`，图片仍入库但 `embedded: false`。

### 认证与代理

| 变量 | 作用 |
|---|---|
| `MEMORY_EMBED_TOKEN` | 加 `Authorization: Bearer ...` |
| `MEMORY_EMBED_PROXY` | 通过 HTTP 代理访问 |
| `MEMORY_EMBED_URL` | 服务根地址，不含 `/v1` |
| `MEMORY_EMBED_MODEL` | 模型名，默认 `jina-embeddings-v5-omni-small` |

## 2. Rerank 服务

### 端点

```http
POST {MEMORY_RERANK_URL}/v1/rerank
Content-Type: application/json
Authorization: Bearer <MEMORY_RERANK_TOKEN>   # 可选
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

- `results[].index` 必须对应请求里的 document 下标；
- `relevance_score` 可以是负数；
- 分数只在同一次请求内可比，不能跨请求做绝对阈值；
- 允许返回顺序与输入不同；
- 每个候选都必须有分数；缺一个分数就整体放弃本次重排，保留原向量顺序。

### 超时

| 配置 | 默认 |
|---|---|
| `MEMORY_RERANK_TIMEOUT` | 15000 |

失败、超时、分数不完整：

- 记日志；
- 返回原候选顺序；
- 不阻断本轮对话。

### 认证与代理

| 变量 | 作用 |
|---|---|
| `MEMORY_RERANK_TOKEN` | Bearer token |
| `MEMORY_RERANK_PROXY` | HTTP 代理 |
| `MEMORY_RERANK_URL` | 服务根地址，不含 `/v1` |
| `MEMORY_RERANK_MODEL` | 默认 `jina-reranker-v3.5` |

## 3. pgvector 表要求

服务本身不创建表；部署时必须已有：

```sql
CREATE TABLE memory_vectors (
  "userId" text NOT NULL,
  "storeId" text NOT NULL DEFAULT '',
  key text NOT NULL,
  section text NOT NULL DEFAULT '',
  embedding vector(1024) NOT NULL,
  value text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  "domainId" text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("userId", "storeId", key, section)
);

CREATE TABLE image_vectors (
  "userId" text NOT NULL,
  "storeId" text NOT NULL DEFAULT '',
  sha256 text NOT NULL,
  embedding vector(1024) NOT NULL,
  "domainId" text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("userId", "storeId", sha256)
);
```

`vector(N)` 的 N 必须等于 embedding 模型输出维度。当前配置：

```text
MEMORY_EMBED_DIM=1024
MEMORY_IMAGE_DIM=1024
```

换模型时：

1. 先迁移/重建向量表到新维度；
2. 重新生成已有记忆和图片向量；
3. 再切换 `MEMORY_EMBED_MODEL`。

## 4. 健康检查

```bash
curl -s http://127.0.0.1:8788/v1/embeddings \
  -H 'content-type: application/json' \
  -d '{"model":"jina-embeddings-v5-omni-small","input":["ping"],"task":"retrieval.query"}'

curl -s http://127.0.0.1:8787/v1/rerank \
  -H 'content-type: application/json' \
  -d '{"model":"jina-reranker-v3.5","query":"ping","documents":["pong"],"return_documents":false}'
```

## 5. 最小兼容实现

只要满足下面两点，就可以替换成自建服务：

- embedding：接收 `input`/`task`，返回 `data[0].embedding`；
- rerank：接收 `query`/`documents`，返回 `results[].index` + `results[].relevance_score`。

不需要实现流式响应、批量输入或文档回传。
