# @amor-harness/memory

**中文** · [English](./README.en.md)

Amor 的记忆系统插件。

它把长期记忆拆成 **store → domain → entry** 三层，提供自动抽取、混合召回、prompt 注入、`/memory` 虚拟文件系统和图片记忆。

## 能力

- **记忆库**：多 store、默认 store、共享与 ACL
- **领域**：现实、虚构、项目、工作等语境分区
- **自动抽取**：回复后异步提取事实，支持 `set_memory` / `append_memory` / `delete_memory`
- **混合召回**：向量 + 标签 + 词法 + cross-encoder + 时间衰减 + MMR
- **注入**：stable 系统基线 + 每轮 dynamic 上下文
- **VFS**：`/memory/<domain>/<key>.md`、`INDEX.yaml`、每用户 `EXTRACTION.md`
- **图片记忆**：归一化、dHash 去重、图片向量、图文互搜
- **UI**：记忆面板、消息卡片、agent 记忆设置

## 依赖

- MongoDB（记忆条目、store、domain、版本）
- PostgreSQL + pgvector（文本与图片向量）
- OpenAI 兼容 embedding 服务
- 可选 cross-encoder rerank 服务

## 配置

复制 `config.example.json` 为 `config.json`，按部署环境填写 embedding、pgvector、rerank 地址。

主要配置组：

```text
embedding   embedding 服务与维度
postgres    pgvector 连接
rerank      cross-encoder
recall      候选数、注入条数、相似度门槛
tags        标签召回参数
images      图片向量与召回门槛
decay       时间衰减
mmr         去冗余
limits      token/字符上限
```

## 安装

这是一个 cordis 插件包，不是一个独立服务。把包内容放到 Amor 的插件目录：

```text
plugin/memory/
  plugin.json
  runtime/
  client/dist/
  config.json
  docs/
```

`plugin.json` 指向：

```json
{
  "client": { "entry": "./client/dist/index.mjs" },
  "runtime": { "entry": "./runtime/index.mjs" }
}
```

## 文档

完整设计见 [docs/README.md](./docs/README.md)：

- 架构与生命周期
- 数据模型
- 抽取、召回、注入算法
- VFS 与图片记忆
- 配置与测试

## License

MIT。
