# `/memory` 虚拟文件系统

## 1. 挂载

memory 系统挂载 `/memory` provider，负责全部路径语义：

```text
/memory
  ├─ domain 文件夹
  ├─ <key>.md
  ├─ INDEX.yaml
  ├─ EXTRACTION.md
  └─ images/
```

## 2. 目录结构

```text
/memory/
  INDEX.yaml
  EXTRACTION.md
  <domain-folder>/
    <key>.md
  <key>.md              # 默认 domain 的扁平形式
  images/
    <id>.<ext>
```

- 一个 domain 一个文件夹；
- 一个记忆一个 `.md` 文件；
- 文件内容就是 memory value；
- 文件名去掉 `.md` 就是 key。

## 3. 操作

provider 实现：

| 操作     | 语义                                            |
| -------- | ----------------------------------------------- |
| `list`   | 列出 domain 文件夹、记忆文件、INDEX、EXTRACTION |
| `read`   | 读取记忆、INDEX 或 EXTRACTION                   |
| `write`  | 创建/更新记忆，或写 EXTRACTION                  |
| `delete` | 删除记忆或清空 EXTRACTION                       |
| `move`   | 同 domain 重命名，跨 domain 改 domainId         |
| `search` | 内容匹配，返回 `path:line:text`                 |
| `glob`   | 路径 glob                                       |

## 4. `INDEX.yaml`

只读索引：

- `stable:`：stable 记忆 key；
- `today:`：今天创建/修改的 ephemeral 记忆；
- 不允许写入或删除；
- 由 provider 动态生成，不落库。

## 5. `EXTRACTION.md`

每用户抽取提示词：

- 存储于 `memoryextractionprompts`；
- `userId` 唯一；
- 读取时按当前用户隔离；
- 写入非空内容 → upsert；
- 写入空内容或删除 → 清除自定义提示词；
- extraction 优先使用它，空则回退 agent/default。

## 6. 写入语义

写 `<domain>/<key>.md`：

1. 校验 key；
2. 解析 domain 文件夹；
3. 调 `memory.vfs.set`；
4. 写 memory entry；
5. 写 version；
6. 写 conversation link（如果带 conversationId）；
7. 发 `onMemoryChange`。

删除：

- stable 记忆禁止删除；
- locked 记忆允许由 VFS 删除；
- 删除后清向量并更新索引。

## 7. 权限

- `readableStore`：owner 或共享 VIEW；
- `writableStore`：owner 或共享 EDIT；
- 只读共享 store 可以读 `/memory`，但不能写；
- 用户级 `EXTRACTION.md` 不受 store 共享影响，始终按 userId 隔离。

## 8. 图片

`/memory/images/<id>.<ext>`：

- 读取 `memoryimages` 的原始 bytes；
- 支持 sha256 / 数字 id 两种路径；
- 返回 image mime；
- 不经过文本记忆列表。
