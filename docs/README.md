# Memory 系统文档

本目录描述 memory 系统的整体设计与实现。

## 阅读顺序

1. [architecture.md](./architecture.md) — 记忆系统的分层、读写路径与生命周期
2. [modules.md](./modules.md) — 模块构成与目录职责
3. [data-model.md](./data-model.md) — store/domain/entry/version/image 数据模型
4. [extraction.md](./extraction.md) — 记忆抽取、队列、工具与提示词
5. [recall.md](./recall.md) — 向量/标签/词法/重排/衰减/MMR 算法
6. [injection.md](./injection.md) — stable/dynamic 上下文注入
7. [vfs.md](./vfs.md) — `/memory` 虚拟文件系统
8. [images.md](./images.md) — 图片归一化、去重、嵌入与召回
9. [services.md](./services.md) — embedding / rerank 服务 API 要求
10. [config.md](./config.md) — 配置项
11. [testing.md](./testing.md) — 测试与真实链路验证

## 总体数据流

```
对话 turn
  │
  ├─ 读取：recall → ranking → prompt 注入
  │
  └─ 写入：extraction → store/domain → memory entry
                              ├─ version
                              ├─ conversation link
                              └─ vector
```

## 核心概念

| 概念 | 含义 |
|---|---|
| store | 记忆库，用户或 agent 的隔离单元 |
| domain | store 内的语境分区，如现实/虚构/项目 |
| entry | 一条记忆，key + value + tags + 状态 |
| stable | 进入系统基线的长期记忆 |
| ephemeral | 按 turn 召回的事件性记忆 |
| extraction | 从对话中写入/更新记忆 |
| recall | 按当前 turn 找出相关 ephemeral 记忆 |
| injection | 把 stable/recall 结果放进 prompt |
