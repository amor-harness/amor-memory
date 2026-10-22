# Prompt 注入

## 1. 两类上下文

`prompt.inject` 返回：

```ts
{
  stableContext?: string,
  dynamicContext?: string,
}
```

- **stableContext**：可缓存、跨 turn 稳定的系统基线；
- **dynamicContext**：每轮可能变化的内容，放在消息尾部。

## 2. stableContext

由 `backend/injection.mjs` 构造：

1. 读取 active domains；
2. 取 `stable: true` 且 `injection !== 'additional'` 的记忆；
3. 用 `formatMemoryEntries` 渲染；
4. 如果有 active domains，追加 domain kind legend。

形状：

```text
# Memory domains
...

# Existing memory:
1. ["key": "..."]. ["updated": "..."] ["value": "..."]
```

stableContext 不包含召回结果。

## 3. dynamicContext

按顺序拼接：

1. `injection: 'additional'` 的 stable 记忆；
2. active domains 块（`buildActiveDomainsBlock`）；
3. 非默认 domain 的 stable 记忆，按 domain 分块；
4. 本轮 recall 结果。

如果没有任何内容，返回 `undefined`。

## 4. Domain 分层

- 默认 domain 的记忆进入 system 基线；
- 其他 active domain 的记忆进入 dynamic 块；
- 未激活 domain 不读取；
- 所有 domain 关闭时，scope 为 `enabled: false`，注入为空。

## 5. Recall 注入

每轮召回结果格式化为文本后放进 dynamic 上下文。

召回只取 ephemeral 记忆；stable 记忆不会重复进入 RAG。

## 6. 去重

- `excludeKeys`：本轮已注入的 key；
- `contextMemoryKeys`：当前上下文已经携带的 key；
- stable 与 recall 不重复；
- 同一 `##` 文档的 section 受槽位限制，避免整篇占满。

## 7. 缓存边界

- stableContext 可被 prompt cache 复用；
- dynamicContext 每轮重新生成；
- 时间、domain 激活状态、召回结果变化都会使 dynamic 部分变化；
- stable 内容应保持精简，事件性细节放 ephemeral 记忆。
