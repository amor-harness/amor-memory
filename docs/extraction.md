# 抽取

抽取负责把一轮对话变成记忆变更。它在回复完成后异步执行，不阻塞 HTTP 响应或下一轮对话。

## 触发

`chat.afterRun` 收到：

- `userId` / `storeId` / `conversationId` / `messageId`
- `llmConfig` / `instructions` / `validKeys` / `tokenLimit`
- `messages`（user/assistant/tool 历史）
- `streamId` / `jobCreatedAt` / `tenantId` / `now` / `timezone`
- 安全 user

只有配置了 store、llmConfig 和 conversationId 才会调度；否则直接返回。

## 调度

调度键：

```text
<userId>:<storeId>:<conversationId>
```

同一键同时只跑一个抽取任务：

- 新任务到达且已有任务运行 → 进入队列
- 新 turn 开始 → 中断当前任务；被中断的任务重新入队
- 任务完成 → 取出下一个
- 会话删除 → 清理该会话的队列和运行态

抽取和回复争抢同一个本地模型时，这个串行/中断机制避免两侧同时超时。

## Processor

`runExtraction`：

1. 解析 `writableStore`；无权限或 store 不存在则 skipped
2. 读取每用户 `EXTRACTION.md`：
   - 非空 → 覆盖传入的 instructions
   - 空 → 使用 agent instructions
   - 都没有 → 内置默认提示词
3. 构造 domain runtime（搜索、创建、激活 domain）
4. 创建 memory processor：
   - 工具：`set_memory`、`append_memory`、`delete_memory`
   - domain tools：`search_domains`、`create_domain`、`activate_domain`、`deactivate_domain`
   - LLM：`llmConfig`
   - prompt：instructions + key 格式提示 + 已有记忆 + domain 提示
   - token/字符限制
5. 执行工具循环（默认 4 轮，最大 25，`MEMORY_EXTRACTION_TOOL_ROUNDS`）
6. 返回 `attachments`（消息卡片）和内部变更结果

## 工具语义

### set_memory

创建或整条替换一个记忆。

- key 必须匹配 `^[a-z0-9_]+$`
- 受 `locked` 保护：locked 记忆只能从面板/VFS 改
- 受 `MEMORY_CHAR_LIMIT` 限制（默认 10000）
- 容量不足时触发 eviction
- 成功后写 entry、version、conversation link，并发出 change event

### append_memory

在现有 value 末尾追加，不覆盖已有内容；key 不存在时拒绝，提示先用 `set_memory`。

### delete_memory

按 key 删除；locked 记忆拒绝。删除后清理 version/link/vector。

### domain tools

- `search_domains`：按名称/描述搜索
- `create_domain`：创建 domain
- `activate_domain` / `deactivate_domain`：调整本轮 scope

domain tools 由插件注册到工具运行时，不直接操作集合。

## Prompt

```text
<EXTRACTION.md 或 agent instructions 或默认提示词>
+
IMPORTANT: memory keys MUST be lowercase...
+
<已有记忆>
+
<domain 说明 / active domains>
+
<token 状态>
```

`replaceSpecialVars` 处理日期、时间和用户名。默认提示词强调：只有用户明确要求“记住/忘记”时才调用工具，普通聊天内容不写入。

## 结果

抽取返回的 attachments 由宿主挂到 assistant 消息，前端显示 memory updated 卡片。写入本身通过 memory 数据层完成，不依赖前端。

## 向量同步

`extraction/vector-sync` 订阅记忆变更：

- create/update：embed 并 upsert `memory_vectors`
- delete：删除向量
- stable：删除文本向量（stable 走基线，不参与 RAG）
- `##` section：拆分后逐段 embedding
- sweep：按 store/domain/user 清理分区

向量同步失败不回滚已写入的记忆。

## 失败与降级

| 情况 | 行为 |
|---|---|
| LLM 抽取失败 | 记录日志，回复已完成，不写半成品 |
| embedding 失败 | 记忆保留，向量缺失，召回降级 |
| store 只读/无权限 | skipped，不写 |
| store 不存在 | skipped |
| 任务被新 turn 中断 | 重新入队，不重复写同一 message |
| 队列/任务状态丢失 | 下次抽取可重新触发；不阻塞对话 |

## 限制

- 单条 key 最长 1000 字符
- 单条 value 受 `MEMORY_CHAR_LIMIT` 限制
- 工具轮数默认 4，最大 25
- 抽取只处理当前 store 的 active domains；不会跨 store 写入
