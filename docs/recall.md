# 召回算法

## 1. 目标

一个 turn 开始前，从当前 store + active domains 中找出最多 `MEMORY_RAG_LIMIT` 条与当前内容相关的记忆，注入 prompt。

约束：

- 只召回 **ephemeral** 记忆；`stable` 记忆走 stable 注入，不进入 RAG；
- 只读取 active domains；
- 排除本会话已经注入过的 key；
- 排除 stable baseline 已经包含的 key；
- 文本记忆和图片记忆分开召回、分块展示。

## 2. 总流程

```
query / contextQuery
   │
   ├─ 向量召回（embedding + pgvector）
   ├─ 标签召回（tag vocabulary）
   ├─ 词法召回（倒排索引 + 日期展开）
   │
   ▼
候选合并 / 去重
   │
   ▼
cross-encoder 重排（可选）
   │
   ▼
时间衰减 / MMR 去冗余 / 配额选择
   │
   ▼
排除已注入 key、校验记忆仍存在
   │
   ▼
按时间排序 + 关联 @memory 摘要
   │
   ▼
formatRecalled → prompt 文本
```

## 3. 向量召回

配置：

- `MEMORY_RAG_CANDIDATES`：候选数，默认 15；
- `MEMORY_RAG_MIN_SCORE`：单行 cosine 下限；
- `MEMORY_RAG_GATE_MIN_SCORE`：top-1 低于此值则跳过召回；
- `MEMORY_RAG_LIMIT`：最终条数。

步骤：

1. `embedText(query, 'query')`；
2. pgvector `memory_vectors` 按 `userId/storeId/domainIds` 查询；
3. 过滤 `score < MEMORY_RAG_MIN_SCORE`；
4. 按 key 去重，加载 `memoryentries`；
5. 丢弃 `stable: true`。

## 4. 标签召回

标签来源：

- 记忆 value 末尾的 `tags:`；
- 写入时物化的 `tags` 字段。

规则：

- query 中出现的标签，若在 store 词表中，作为候选；
- **specific tag**（出现次数 ≤ `MEMORY_TAG_SPECIFIC_MAX_COUNT`）可以放宽相似度门槛；
- 泛化标签（出现次数多）只进入候选，不放宽门槛；
- 标签必须满足密度/重复条件才算“用户真的在说这个 cue”：
  - `MEMORY_TAG_MIN_DENSITY`：标签占 query 的比例；
  - `MEMORY_TAG_MIN_OCCURRENCES`：短 query 中的重复次数；
- `TAG_RESERVED_SLOTS`：最终结果中给标签命中保留的槽位，默认 1。

## 5. 词法召回

`lexical.mjs`：

- 每个 `(userId, storeId, domainIds)` 维护倒排索引；
- 文档上限 `MEMORY_LEXICAL_MAX_DOCS`；
- 索引缓存 TTL `MEMORY_LEXICAL_CACHE_MS`；
- 变更事件 `onMemoryChange` 使索引失效；
- 支持日期展开：把 “昨天/上周/2026-10-01” 解析成多种拼写；
- 分成 section 匹配，命中 section 后可只注入该段。

作用：找回 embedding 空间没召回、但词面明确匹配的记忆。

## 6. 重排

`reranker.mjs`：

- 服务：`MEMORY_RERANK_URL`；
- 模型：`MEMORY_RERANK_MODEL`，默认 `jina-reranker-v3.5`；
- 输入：query + 候选文本；
- 输出：每个候选的相关性分数。

成本控制：

- `MEMORY_RERANK_QUERY_MAX_CHARS`：截断 query；
- `MEMORY_RERANK_TEXT_MAX_CHARS`：截断候选文本；
- `MEMORY_RERANK_RELATIVE_MIN`：低于本组最高分的比例则丢弃；
- `MEMORY_RERANK_TOP_MIN_SCORE`：整组最高分下限，低于则整组不注入。

重排分数只在同一个候选组内可比，因此按 query 分组选择。

## 7. 衰减与 MMR

### 时间衰减

配置：

- `MEMORY_DECAY_ENABLED`
- `MEMORY_DECAY_HALF_LIFE_DAYS`
- `MEMORY_DECAY_FLOOR`
- `MEMORY_DECAY_ADMISSION`

越旧的记忆分数越低，但保留 floor，避免旧但重要的记忆完全消失。

### MMR

配置：

- `MEMORY_MMR_ENABLED`
- `MEMORY_MMR_LAMBDA`
- `MEMORY_MMR_SIM_FLOOR`
- `MEMORY_MMR_DUPLICATE_CUT`
- `MEMORY_MMR_MAX_PARTS_PER_KEY`

MMR 在“相关性”和“与已选内容的差异”之间折中，减少同一主题的重复注入。

## 8. 选择与收尾

1. 按 `memoryPartId` 分组，避免同一 `##` 文档的多个 section 占满槽位；
2. `selectRecall` 按分数/槽位/标签保留策略选择；
3. 排除 `excludeKeys`（本轮已注入）；
4. 按时间排序；
5. `annotateLinkedSummaries` 为 `@memory` 链接补一行摘要；
6. `formatRecalled` 生成模型可读文本。

## 9. 图片召回

与文本并行：

- query embedding 搜 `image_vectors`；
- 也支持用文本描述找图片；
- `MEMORY_IMAGE_TEXT_MIN_SCORE` / `MEMORY_IMAGE_IMAGE_QUERY_MIN_SCORE` 控制门槛；
- 返回 URL / mime / 可选 data URL；
- 和文本一样排除本轮已注入 key。

## 10. 降级

- embedding 服务不可用 → 跳过向量召回，保留词法/标签；
- reranker 不可用 → 用向量/标签分数排序；
- pgvector 不可用 → 词法召回；
- 所有通道都失败 → 返回空，不影响 chat。
