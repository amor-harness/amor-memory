# Prompt 注入

注入在 `prompt.inject` hook 中完成，返回两个可独立使用的字符串：

```ts
{
  stableContext?: string,
  dynamicContext?: string,
}
```

- **stableContext**：跨 turn 稳定的系统基线，适合 prompt cache
- **dynamicContext**：每轮变化的内容，放在消息尾部

## stableContext

只包含 stable 记忆：

1. 按 active domains 过滤
2. 取 `stable: true` 且 `injection !== 'additional'`
3. 按 domain 分组
4. 渲染为：

```text
# Existing memory:
1. ["key": "..."] ["updated": "..."] ["value": "..."]
```

如果有 active domains，会追加 domain kind legend。stableContext 不包含召回结果，也不重复注入 dynamic 内容。

## dynamicContext

按顺序拼接：

1. `stable=true, injection=additional` 的记忆
2. active domains 块
3. 非默认 domain 的 stable 记忆，按 domain 分块
4. 本轮召回结果
5. 图片召回块

没有任何内容时返回 `undefined`。

## Domain 分层

- 默认 domain 的 stable 记忆进入 system 基线
- 其他 active domain 的 stable 记忆进入 dynamic 尾部
- 未激活 domain 不读取
- 所有 domain 关闭时 scope 为 `enabled: false`，注入为空

这保证“现实/项目”等不同语境不会互相污染系统基线。

## 去重

- `excludeKeys`：本轮已经注入的 key
- `contextMemoryKeys`：当前上下文已经携带的 key
- stable 与 recall 不重复
- 同一 `##` 文档的 section 受槽位限制，避免整篇占满

## 格式化

- 记忆值可包含多段 `##` section；注入时按 section 选择
- `@key` 行会被解析为关联摘要，附在 memory 行后
- 时间按用户 timezone 格式化
- 超过 token/字符预算时按优先级截断

## 缓存边界

- stableContext 可缓存；domain 激活状态、stable/locked 变更会使缓存失效
- dynamicContext 每轮重新生成
- 召回结果、时间、图片变化都只影响 dynamic
- stable 内容应精简；事件性细节放 ephemeral

## 失败

- store 不可读 → 返回 `{ stableContext: undefined, dynamicContext: undefined }`
- 数据库/召回失败 → 尽量保留 stable，dynamic 为空
- 注入失败不阻断对话；错误只记日志
