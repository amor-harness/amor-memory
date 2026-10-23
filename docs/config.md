# 配置

## 1. 配置来源

优先级：

1. `plugin/memory/config.json`
2. 环境变量
3. 代码默认值

`runtime/recall/env.mjs` 的 `memoryEnv(name)` 先读 `config.json` 的扁平键，再读 `process.env`。

运行期可以应用配置覆盖。

以下默认值是代码默认；`config.json` 和运行期覆盖可能改变实际生效值。

## 2. 配置分组

### embedding

| 键                        | 作用               |
| ------------------------- | ------------------ |
| `MEMORY_EMBED_URL`        | embedding 服务地址 |
| `MEMORY_EMBED_DIM`        | 向量维度           |
| `MEMORY_EMBED_MODEL`      | 模型名             |
| `MEMORY_EMBED_TOKEN`      | 可选 Bearer token  |
| `MEMORY_EMBED_PROXY`      | 可选 HTTP 代理     |
| `MEMORY_EMBED_TIMEOUT_MS` | 文本嵌入超时       |

### PostgreSQL

向量召回需要 PostgreSQL + pgvector。连接由 `database` 插件提供，memory 不提供 PostgreSQL 连接配置。

memory 会自动创建所需的扩展和向量表，不需要手工建表。

### recall

| 键                          | 代码默认 | 作用                 |
| --------------------------- | -------- | -------------------- |
| `MEMORY_RAG_CANDIDATES`     | 15       | 向量候选数           |
| `MEMORY_RAG_LIMIT`          | 3        | 最终注入条数         |
| `MEMORY_RAG_MIN_SCORE`      | 0.7      | 单行 cosine 下限     |
| `MEMORY_RAG_GATE_MIN_SCORE` | 0.75     | top-1 召回闸门       |
| `MEMORY_RECALL_POOL_LIMIT`  | 8        | 排序池大小           |
| `MEMORY_RECALL_SHADOW`      | false    | 影子运行，不改变注入 |

### tags

| 键                                       | 作用                        |
| ---------------------------------------- | --------------------------- |
| `MEMORY_TAG_SPECIFIC_MAX_COUNT`          | specific tag 的最大出现次数 |
| `MEMORY_TAG_MIN_DENSITY`                 | 标签占 query 的最小比例     |
| `MEMORY_TAG_MIN_OCCURRENCES`             | 长 query 中的最小重复次数   |
| `MEMORY_TAG_OCCURRENCE_PROMOTES_GENERIC` | 重复是否可提升泛化标签      |

### rerank

| 键                              | 作用               |
| ------------------------------- | ------------------ |
| `MEMORY_RERANK_URL`             | cross-encoder 服务 |
| `MEMORY_RERANK_MODEL`           | 模型名             |
| `MEMORY_RERANK_RELATIVE_MIN`    | 相对最高分下限     |
| `MEMORY_RERANK_TOP_MIN_SCORE`   | 组内最高分下限     |
| `MEMORY_RERANK_QUERY_MAX_CHARS` | query 截断         |
| `MEMORY_RERANK_TEXT_MAX_CHARS`  | 候选文本截断       |
| `MEMORY_RERANK_TOKEN`           | 可选 Bearer token  |
| `MEMORY_RERANK_PROXY`           | 可选 HTTP 代理     |
| `MEMORY_RERANK_TIMEOUT`         | 重排超时（毫秒）   |

### decay / MMR

| 键                            | 作用              |
| ----------------------------- | ----------------- |
| `MEMORY_DECAY_ENABLED`        | 时间衰减          |
| `MEMORY_DECAY_HALF_LIFE_DAYS` | 半衰期            |
| `MEMORY_DECAY_FLOOR`          | 衰减下限          |
| `MEMORY_MMR_ENABLED`          | MMR 去冗余        |
| `MEMORY_MMR_LAMBDA`           | 相关性/多样性权重 |
| `MEMORY_MMR_SIM_FLOOR`        | 相似度 floor      |
| `MEMORY_MMR_DUPLICATE_CUT`    | 重复判定阈值      |

### images

| 键                                   | 作用         |
| ------------------------------------ | ------------ |
| `MEMORY_IMAGE_DIM`                   | 图片向量维度 |
| `MEMORY_IMAGE_MAX_EDGE`              | 最长边       |
| `MEMORY_IMAGE_MAX_BYTES`             | 最大字节     |
| `MEMORY_IMAGE_MIN_EDGE`              | 最小边       |
| `MEMORY_IMAGE_DHASH_DISTANCE`        | 近重复距离   |
| `MEMORY_IMAGE_DEDUPE_SCAN`           | 去重扫描上限 |
| `MEMORY_IMAGE_TEXT_MIN_SCORE`        | 文本找图门槛 |
| `MEMORY_IMAGE_IMAGE_QUERY_MIN_SCORE` | 图片找图门槛 |

### limits

| 键                   | 作用                |
| -------------------- | ------------------- |
| `MEMORY_TOKEN_LIMIT` | 单条记忆 token 上限 |
| `MEMORY_CHAR_LIMIT`  | 单条记忆字符上限    |

### extraction

| 键                              | 作用                          |
| ------------------------------- | ----------------------------- |
| `MEMORY_EXTRACTION_TOOL_ROUNDS` | 抽取工具轮数，默认 4，最大 25 |

## 3. 运行时覆盖

运行期配置覆盖通过 `config.apply` 应用，`config.snapshot` 返回当前生效值，用于诊断。
