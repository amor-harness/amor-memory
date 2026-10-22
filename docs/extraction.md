# 记忆抽取

## 1. 触发

assistant 回复完成、消息落库后触发抽取任务，输入包含：

- userId / storeId / conversationId / messageId
- llmConfig / instructions / validKeys / tokenLimit
- messages（user/assistant/tool 历史）
- streamId / jobCreatedAt / tenantId / now / timezone
- 安全 user

抽取任务立即返回，不阻塞 HTTP 响应。

## 2. 调度

调度键：

```text
userId:storeId:conversationId
```

状态：

- `runningExtractions`：正在跑的任务；
- `extractionQueues`：同键等待队列；
- `pausedExtractionKeys`：被新 turn 暂停的键。

行为：

1. 新 turn 开始 → `interruptMemoryExtractions(key)`：
   - `AbortController.abort()`；
   - 正在跑的任务重新入队；
   - key 标记 paused。
2. 新 turn 完成 → `chat.afterRun` → `scheduleMemoryExtraction`。
3. 抽取完成 → `dequeueNextExtraction(key)`。
4. 删除会话 → `clearMemoryExtractions(userId, conversationIds)`。

这保证同一会话同时只有一个抽取任务，避免本地模型被抽取和回复同时抢占。

## 3. Processor

`runExtraction`：

1. 解析 `writableStore`，失败的 store 直接 skipped；
2. 读每用户 `EXTRACTION.md`：
   - 非空 → 用它覆盖 `instructions`；
   - 空 → 用当前 agent 的 instructions；
   - 都没有 → `getDefaultInstructions`。
3. 构造 domain runtime（`search_domains` / `create_domain`）；
4. 调用 `createMemoryProcessor`：
   - 工具：`set_memory`、`delete_memory`、`append_memory`、domain tools；
   - LLM：`llmConfig`；
   - prompt：`instructions` + `MEMORY_KEY_FORMAT_HINT`；
   - token/char limit。
5. 执行 `processMemory`；
6. 返回 `attachments`（memory artifact）和 `withoutKeys`。

## 4. 工具

### `set_memory`

写入或整条替换。

- key 必须匹配 `^[a-z0-9_]+$`；
- 受 `locked` 保护；
- 受 token/char limit；
- 超过容量时可调用 `evictMemoriesToFitCapacity`；
- 成功后：
  - 写 `memoryentries`；
  - 写 `memoryversions`；
  - 写 `conversationmemories`（source=extracted）；
  - 发 `onMemoryChange` → vector sync。

### `append_memory`

在现有 value 末尾追加，不覆盖已有内容。

### `delete_memory`

删指定 key；同样发 change event。

### domain tools

- `search_domains`
- `create_domain`
- `activate_domain`
- `deactivate_domain`

由 memory 系统注册，通过 run context 执行。

## 5. Prompt 组成

```text
<custom instructions 或 agent instructions 或 default>
+
IMPORTANT: Memory keys MUST be lowercase...
+
<existing memory>
+
<domain 说明 / active domains>
+
<token status>
```

`replaceSpecialVars` 处理：

- `{{current_date}}`
- `{{current_datetime}}`
- `{{iso_datetime}}`
- user name

## 6. 抽取结果

返回 `attachments`，回写 assistant 消息：

```json
{
  "type": "memory",
  "memory": {
    "type": "update",
    "key": "...",
    "value": "...",
    "tags": ["..."],
    "domainId": "..."
  }
}
```

前端据此显示 “memory updated” 卡片。

## 7. 向量同步

`extraction/vector-sync.mjs` 订阅本地 `onMemoryChange`：

- `set` / `create`：embed 并 upsert `memory_vectors`；
- `delete`：删除向量；
- `stable`：删除向量（stable 走 system prompt，不进 RAG）；
- `sweep`：按 store/domain/user 清分区；
- `##` 文档：按 section 拆分、逐段 embedding；
- 同时发 `memory_updated` 事件，刷新前端。

## 8. 失败与降级

- LLM 抽取失败：只记日志，回复已完成；
- embedding 失败：记忆仍写入，向量缺失；
- vector sync 失败：不回滚已写入的记忆；
- 无 store / 只读共享 store：不抽取。
