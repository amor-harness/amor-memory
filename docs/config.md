# 配置

## 来源与优先级

memory 配置来自：

1. `plugin/memory/config.json` 的扁平键
2. 进程环境变量
3. 代码默认值

插件启动时会把 `config.json` 的嵌套对象 flatten，`memoryEnv(name)` 先查插件配置，再查 `process.env`。运行期还可以通过 `memory.config.apply` 覆盖。

`config.example.json` 是调优示例，不是代码默认值；例如示例中的召回门槛可能与代码默认不同。

## embedding

| 键 | 默认 | 说明 |
|---|---|---|
| `MEMORY_EMBED_URL` | 空 | 服务根地址，不含 `/v1`；空表示禁用 embedding |
| `MEMORY_EMBED_DIM` | `1024` | 文本向量维度，建表时使用 |
| `MEMORY_EMBED_MODEL` | `jina-embeddings-v5-omni-small` | 模型名 |
| `MEMORY_EMBED_TIMEOUT_MS` | `30000` | 文本 embedding 超时 |
| `MEMORY_EMBED_TOKEN` | 空 | Bearer token（读进程环境变量） |
| `MEMORY_EMBED_PROXY` | 空 | HTTP 代理（读进程环境变量） |

## rerank

| 键 | 默认 | 说明 |
|---|---|---|
| `MEMORY_RERANK_URL` | 空 | 服务根地址；空表示禁用重排 |
| `MEMORY_RERANK_MODEL` | `jina-reranker-v3.5` | 模型名 |
| `MEMORY_RERANK_TIMEOUT` | `15000` | 超时毫秒 |
| `MEMORY_RERANK_RELATIVE_MIN` | `0.4` | 低于组内最高分的比例则丢弃 |
| `MEMORY_RERANK_TOP_MIN_SCORE` | `0` | 组内最高分低于此值则整组不注入 |
| `MEMORY_RERANK_QUERY_MAX_CHARS` | `400` | query 截断 |
| `MEMORY_RERANK_TEXT_MAX_CHARS` | `400` | 候选文本截断 |
| `MEMORY_RERANK_TOKEN` | 空 | Bearer token（读进程环境变量） |
| `MEMORY_RERANK_PROXY` | 空 | HTTP 代理（读进程环境变量） |

## recall

| 键 | 默认 | 说明 |
|---|---|---|
| `MEMORY_RAG_CANDIDATES` | `15` | 向量候选数 |
| `MEMORY_RAG_LIMIT` | `3` | 最终注入条数 |
| `MEMORY_RAG_MIN_SCORE` | `0.7` | 单行 cosine 下限 |
| `MEMORY_RAG_GATE_MIN_SCORE` | `0.75` | top-1 准入闸门 |
| `MEMORY_RECALL_POOL_LIMIT` | `8` | 排序池大小 |
| `MEMORY_RECALL_SHADOW` | `false` | 影子运行，不改变注入 |
| `MEMORY_LEXICAL_CANDIDATES` | `3` | 词法候选数 |
| `MEMORY_LEXICAL_CACHE_MS` | `300000` | 词法索引 TTL |
| `MEMORY_LEXICAL_MAX_DOCS` | `2000` | 词法文档上限 |
| `MEMORY_LEXICAL_MAX_CHARS` | `2000000` | 词法字符上限 |
| `MEMORY_RECALL_DATES` | `true` | 日期词展开 |

## tags

| 键 | 默认 | 说明 |
|---|---|---|
| `MEMORY_TAG_RECALL` | `true` | 启用标签召回 |
| `MEMORY_TAG_SPECIFIC_MAX_COUNT` | `3` | specific tag 最大出现次数 |
| `MEMORY_TAG_MIN_DENSITY` | `0.02` | 标签占 query 最小比例 |
| `MEMORY_TAG_MIN_OCCURRENCES` | `3` | 最短 query 重复次数 |
| `MEMORY_TAG_OCCURRENCE_PROMOTES_GENERIC` | `true` | 重复是否提升泛化标签 |
| `MEMORY_TAG_RESERVED_SLOTS` | `1` | 标签命中保留槽位 |
| `MEMORY_TAG_VOCABULARY_LIMIT` | `200` | 词表大小 |
| `MEMORY_TAG_QUERY_LIMIT` | `3` | query 命中标签上限 |
| `MEMORY_TAG_VOCABULARY_TTL_MS` | `60000` | 词表 TTL |

## decay 与 MMR

| 键 | 默认 | 说明 |
|---|---|---|
| `MEMORY_DECAY_ENABLED` | `false` | 时间衰减 |
| `MEMORY_DECAY_HALF_LIFE_DAYS` | `30` | 半衰期 |
| `MEMORY_DECAY_FLOOR` | `0.4` | 最低系数 |
| `MEMORY_DECAY_ADMISSION` | `false` | 衰减分参与准入 |
| `MEMORY_MMR_ENABLED` | `false` | MMR 去冗余 |
| `MEMORY_MMR_LAMBDA` | `0.5` | 相关性/多样性权重 |
| `MEMORY_MMR_SIM_FLOOR` | `0.7` | 相似度 floor |
| `MEMORY_MMR_DUPLICATE_CUT` | `0.6` | 重复判定 |
| `MEMORY_MMR_MAX_PARTS_PER_KEY` | `0` | 同 key section 上限 |

## images

| 键 | 默认 | 说明 |
|---|---|---|
| `MEMORY_IMAGE_DIM` | `1024` | 图片向量维度 |
| `MEMORY_IMAGE_MAX_EDGE` | `1024` | 最长边 |
| `MEMORY_IMAGE_MAX_BYTES` | `6291456` | 原图字节上限（6 MiB） |
| `MEMORY_IMAGE_MIN_EDGE` | `32` | 最小边 |
| `MEMORY_IMAGE_DHASH_DISTANCE` | `4` | 近重复 Hamming 距离 |
| `MEMORY_IMAGE_DEDUPE_SCAN` | `1000` | 近重复扫描上限 |
| `MEMORY_IMAGE_TEXT_MIN_SCORE` | `0.34` | 文本找图门槛 |
| `MEMORY_IMAGE_RAG_CANDIDATES` | `6` | 图片候选数 |
| `MEMORY_IMAGE_RAG_LIMIT` | `1` | 图片最终注入数 |
| `MEMORY_IMAGE_INJECT_MAX_BYTES` | `1500000` | 注入图片字节上限 |
| `MEMORY_IMAGE_DISABLED` | `false` | 禁用图片记忆 |
| `MEMORY_IMAGE_TEXT_TIMEOUT_MS` | `15000` | 图片文本 query 超时 |
| `MEMORY_IMAGE_TIMEOUT_MS` | `60000` | 图片 embedding 超时 |

## limits 与 extraction

| 键 | 默认 | 说明 |
|---|---|---|
| `MEMORY_CHAR_LIMIT` | `10000` | 单条记忆字符上限 |
| `MEMORY_EXTRACTION_TOOL_ROUNDS` | `4` | 抽取工具轮数，最大 25 |

`MEMORY_TOKEN_LIMIT` 由宿主在 `chat.afterRun` 传入，memory 用它约束抽取上下文，不作为 `config.json` 的独立开关。

## 运行时覆盖

宿主启动时通过 `memory.config.apply` 把 `config.json` 的扁平键下发给插件；覆盖只影响当前插件进程，不写回 `config.json`。memory 没有公开的配置写入 RPC。
