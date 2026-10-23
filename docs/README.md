# Memory 系统文档

本目录描述 memory 插件的设计、数据模型、算法和运行方式，面向使用者和二次开发者。

## 阅读顺序

1. [architecture.md](./architecture.md) — 进程边界、hook、生命周期、模块
2. [modules.md](./modules.md) — 目录与文件级模块索引
3. [data-model.md](./data-model.md) — store / domain / entry / version / image
4. [extraction.md](./extraction.md) — 自动抽取、工具、调度、失败恢复
5. [recall.md](./recall.md) — 向量、标签、词法、重排、衰减、MMR
6. [injection.md](./injection.md) — stable 与 dynamic prompt
7. [client.md](./client.md) — 面板、卡片、agent 设置、客户端扩展
8. [rpc.md](./rpc.md) — `memories.*` RPC
9. [vfs.md](./vfs.md) — `/memory` 虚拟文件系统
10. [images.md](./images.md) — 图片归一化、去重、向量和召回
11. [services.md](./services.md) — embedding / rerank 服务契约
12. [config.md](./config.md) — 配置项与默认值
13. [testing.md](./testing.md) — 构建、测试、真实链路

## 总体数据流

```text
对话 turn
  │
  ├─ 读取：store/domain scope → recall → ranking → prompt 注入
  │
  └─ 写入：chat.afterRun → extraction → entry/value
                                      ├─ version
                                      ├─ conversation link
                                      └─ vector
```

## 核心概念

| 概念 | 含义 |
|---|---|
| store | 记忆库，用户或共享访问的隔离单元 |
| domain | store 内的语境分区，如现实、虚构、项目、工作 |
| entry | 一条记忆，`key + value + tags + stable/locked` |
| stable | 进入系统基线的长期记忆 |
| ephemeral | 按 turn 召回的事件性记忆 |
| extraction | 从对话中写入/更新/删除记忆 |
| recall | 为当前 turn 找出相关 ephemeral 记忆 |
| injection | 把 stable 和 recall 结果放进 prompt |
| image memory | 可被文本或图片查询召回的图片 |
