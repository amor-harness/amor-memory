# 记忆系统架构

## 1. 目标

memory 系统负责：

- 保存用户与 agent 的长期信息；
- 从对话中自动提取记忆；
- 在下一轮对话前召回相关记忆；
- 把稳定记忆和动态召回注入 prompt；
- 通过 `/memory` 虚拟文件系统提供可读写的记忆视图；
- 保存和召回图片记忆。

核心约束：

- 记忆按用户隔离；
- store 是记忆的隔离单元；
- domain 同时决定读取范围和写入归属；
- stable 与 ephemeral 分开处理；
- 写入、召回、注入都不能阻塞对话主流程。

## 2. 系统分层

```
交互层
  ├─ 记忆面板：列表、搜索、编辑、stable/locked
  ├─ 消息卡片：本轮 memory updated / recalled
  ├─ agent 设置：memory store、domains
  └─ /memory VFS：文件式读写

编排层
  ├─ turn 生命周期：读取 → 注入 → 回复 → 抽取
  ├─ 抽取调度：按会话串行、可中断、可排队
  └─ 写入编排：store/domain 解析、版本、链接、向量

算法层
  ├─ 抽取：对话窗口 → memory 工具调用
  ├─ 召回：向量 + 标签 + 词法 + 重排 + 选择
  ├─ 注入：stable / dynamic 上下文
  └─ 图片：归一化、去重、embedding、召回

数据层
  ├─ MemoryStore / MemoryDomain / MemoryEntry
  ├─ MemoryVersion / ConversationMemory
  ├─ MemoryImage / MemoryExtractionPrompt
  └─ pgvector：memory_vectors / image_vectors
```

## 2. 数据分层

```
User
 └─ MemoryStore
     ├─ MemoryDomain
     │   └─ MemoryEntry
     │       ├─ MemoryVersion
     │       ├─ ConversationMemory
     │       └─ vector
     └─ MemoryImage
         └─ image vector
```

### store

- 一个用户可以有多个 store；
- 默认 store 由 `isDefault` 标记；
- 共享 store 通过 ACL 授权；
- agent 可以选择自己的 store。

### domain

- store 内的语境分区；
- 每个 domain 有 `name`、`kind`、`description`；
- 默认 domain 是新建记忆的兜底；
- 一轮对话只读写 active domains。

### entry

- `key` 是稳定标识；
- `value` 是记忆正文；
- `tags` 是召回线索；
- `stable` 决定是否进入长期基线；
- `locked` 阻止 LLM 改写。

## 3. 读路径

```
turn 开始
  │
  ├─ 解析 store / domain scope
  │
  ├─ stable 记忆 ──────────────► system 基线
  │
  ├─ recall
  │   ├─ 向量召回
  │   ├─ 标签召回
  │   ├─ 词法召回
  │   ├─ 重排
  │   └─ 选择 ────────────────► dynamic 上下文
  │
  └─ 图片召回 ─────────────────► 图片块
```

### stable 部分

- 只取 `stable: true`；
- `injection: system` 进 stable 上下文；
- `injection: additional` 进 dynamic 上下文；
- stable 不进入 RAG，避免重复。

### recall 部分

- 只取 active domains；
- 只取 ephemeral；
- 排除本轮已注入的 key；
- 输出最多 `MEMORY_RAG_LIMIT` 条。

## 4. 写路径

写入有三种来源：

```
自动抽取
手动编辑（面板 / VFS）
图片 ingest
```

统一落到：

1. store / domain 解析；
2. key/value 校验；
3. 写 `memoryentries`；
4. 写 `memoryversions`；
5. 写 `conversationmemories`；
6. 发变更事件，更新向量。

### 自动抽取

- 一轮回复结束后异步执行；
- 从对话窗口提取事实；
- 通过 `set_memory` / `append_memory` / `delete_memory` 写入；
- 受 token/char limit 和 locked 保护。

### 手动编辑

- 面板直接改 entry；
- VFS 把 `/memory/<domain>/<key>.md` 映射到同一套写入；
- 两者都走 domain 校验和版本记录。

### 图片

- 上传或 `read_file` 时异步 ingest；
- 归一化、去重后存 bytes；
- 生成图片向量供召回；
- 不影响文本记忆。

## 5. 生命周期

### 一轮对话

1. 确定 store 和 active domains；
2. 读取 stable 记忆，生成稳定上下文；
3. 召回 ephemeral 记忆和图片；
4. 组装 prompt；
5. 模型回复；
6. 回复落库后触发抽取；
7. 抽取结果写回记忆，并更新消息卡片。

### 记忆变更

- 写入 → 版本 + link + 向量；
- 删除 → 清版本/链接/向量；
- stable 切换 → 进入或离开 RAG；
- store 删除 → 清理该 store 的所有记忆和向量。

## 6. 一致性与降级

- 记忆写入成功但向量失败：记忆保留，召回暂时缺失；
- embedding 服务不可用：召回降级到标签/词法；
- reranker 不可用：使用向量/标签分数排序；
- 抽取失败：不影响已完成的回复；
- 只读共享 store：可以召回，不能写入。
