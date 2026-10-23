# 召回

召回在 `chat.beforeRun` 阶段为当前 turn 找出最多 `MEMORY_RAG_LIMIT` 条相关 ephemeral 记忆，交给注入层。

## 输入

- 当前 `query` / `contextQuery`
- `userId`、`storeId`、`conversationId`
- active domain scope
- 本轮已注入的 key、当前上下文已携带的 key

## 约束

- 只召回 `stable=false` 的 ephemeral 记忆
- stable 记忆走注入层，不进入 RAG
- 只读 active domains
- 排除本会话已注入的 key 和上下文已携带的 key
- 只能在当前 store 内召回
- 图片与文本分开召回，分别占位

## 流程

```text
query
  │
  ├─ 向量召回（embedding + pgvector）
  ├─ 标签召回（tag vocabulary）
  ├─ 词法召回（倒排索引 + 日期展开）
  │
  ▼
候选合并 / 去重
  │
  ▼
reranker（可选）
  │
  ▼
时间衰减 / MMR / 槽位选择
  │
  ▼
排除已注入 key、校验 entry 仍存在
  │
  ▼
按时间排序 + @memory 摘要
  │
  ▼
formatRecalled → dynamic context
```

## 向量召回

- 查询 `memory_vectors`，按 `userId/storeId/domainIds` 过滤
- 候选数默认 15，单行 cosine 下限默认 0.7
- top-1 低于 `MEMORY_RAG_GATE_MIN_SCORE`（默认 0.75）时跳过本轮向量召回
- 按 key 去重后加载 entry，丢弃 stable
- embedding 不可用时直接跳过

## 标签召回

标签来自记忆 value 末尾的 `tags:` 和写入时物化的 `tags` 字段。

规则：

- query 命中 store 词表中的标签才进入候选
- **specific tag**（出现次数 ≤ `MEMORY_TAG_SPECIFIC_MAX_COUNT`，默认 3）可放宽相似度门槛
- 泛化标签只进入候选，不放宽门槛
- 标签需满足密度/重复条件：
  - `MEMORY_TAG_MIN_DENSITY`（默认 0.02）
  - `MEMORY_TAG_MIN_OCCURRENCES`（默认 3）
- 最终结果给标签命中保留槽位 `MEMORY_TAG_RESERVED_SLOTS`（默认 1）

词表有 TTL 和大小上限，避免每个 turn 都重新聚合全部标签。

## 词法召回

`recall/lexical` 为每个 `(userId, storeId, domainIds)` 维护倒排索引：

- 候选数默认 3
- 索引 TTL 默认 5 分钟
- 文档上限 2000、字符上限 2,000,000
- 记忆变更事件使索引失效
- 日期展开把“昨天”“上周”等解析成多种写法

作用：召回 embedding 空间没命中、但词面明确的记忆。

## Rerank

`recall/reranker` 调用 Jina 风格 `/v1/rerank`：

- 服务由 `MEMORY_RERANK_URL` 启用；未配置时直接跳过
- 模型默认 `jina-reranker-v3.5`
- 输入 query + 候选文本；文本截断默认 400 字符
- 分数只在同一次请求内可比
- 相对门槛默认 0.4，组内最高分门槛默认 0
- 任一候选缺分数就整体放弃本次重排，保留原顺序
- 失败/超时不影响对话

## 时间衰减

默认关闭；开启后：

- 半衰期默认 30 天
- 最低保留系数默认 0.4
- 可设置 admission：衰减后的分数是否参与入选

衰减用于降低旧事件性记忆的权重，但不让重要旧记忆彻底消失。

## MMR

默认关闭。开启后按 `MMR_LAMBDA`（默认 0.5）在相关性和多样性之间折中：

- `MMR_SIM_FLOOR`：低于该相似度才视为可补充
- `MMR_DUPLICATE_CUT`：高于该阈值视为重复
- `MMR_MAX_PARTS_PER_KEY`：同一 key 的多个 section 最多占几个槽位

## 选择

1. 按 `memoryPartId` 分组，避免同一篇 `##` 文档的多个 section 占满结果
2. 按分数、标签保留槽位和多样性选出 `MEMORY_RAG_LIMIT` 条
3. 排除 `excludeKeys` 和已注入 key
4. 重新校验 entry 仍存在
5. 按时间排序
6. 为 `@memory` 链接补一行摘要
7. `formatRecalled` 生成模型可读文本

## 图片召回

与文本并行：

- query embedding 搜 `image_vectors`
- 候选默认 6，最终注入默认 1
- 文本找图门槛默认 0.34
- 注入图片有字节上限，超过则改用 URL/缩略提示
- 与文本一样排除已注入 key

## 降级

| 失败 | 处理 |
|---|---|
| embedding 不可用 | 跳过向量，标签/词法继续 |
| reranker 不可用 | 保留原排序 |
| pgvector 不可用 | 词法召回 |
| 所有通道失败 | 返回空，不影响 chat |
| 候选对应 entry 已删除 | 丢弃该候选 |
