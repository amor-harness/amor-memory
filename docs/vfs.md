# `/memory` VFS

memory 插件注册 `/memory` provider，把记忆映射为可被 agent 文件工具访问的文件树。

## 路径

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

- 一个 domain 一个文件夹，文件夹名来自 domain `name`
- 默认 domain 的 key 可以放在根目录，也可以放在 domain 文件夹
- 文件名去掉 `.md` 就是记忆 key
- `images/` 是只读图片视图

## 文件语义

| 路径 | 读写 |
|---|---|
| `<key>.md` | 读/写/删除记忆 |
| `<domain>/<key>.md` | 读/写/删除该 domain 的记忆 |
| `INDEX.yaml` | 只读索引 |
| `EXTRACTION.md` | 每用户抽取提示词，可读写/清除 |
| `images/<id>.<ext>` | 只读图片 |

## INDEX.yaml

只读，动态生成：

- `stable:`：stable 记忆 key
- `today:`：今天创建/修改的 ephemeral 记忆
- `tags:`：store 中最常用的标签（有上限）

不允许写/删除；stable 需从面板切换。

## EXTRACTION.md

- 存储在 `memoryextractionprompts`，`userId` 唯一
- 非空内容覆盖抽取 instructions
- 空内容 / 删除 → 回退到 agent 或默认提示词
- 只按 userId 隔离，不受 store 共享影响

## 写入

写 `<domain>/<key>.md`：

1. 校验 key 和 domain
2. 解析当前 store 的 writable 权限
3. 调 `vfsSet` 写入 entry
4. 写 version 和 conversation link（如带 conversationId）
5. 发 change event → 向量同步

删除：

- 普通记忆可删
- stable 记忆不能直接删，需先从面板移除 stable
- locked 记忆允许 VFS 删除（`allowLocked: true`）
- 删除后清版本/关联/向量

## 操作

provider 支持：

- `list`：根目录、domain 文件夹、images
- `read`：记忆、INDEX、EXTRACTION、图片
- `write`：创建/更新记忆或 EXTRACTION
- `delete`：删除记忆、清空 EXTRACTION
- `search`：内容匹配，返回 `path:line:text`
- `glob`：路径 glob

move/copy 由 VFS 引擎路由到写/删组合；provider 不单独维护第二套语义。

## 权限

- 读：owner 或共享 VIEW
- 写：owner 或共享 EDIT
- 只读共享 store 可读 `/memory`，不能写
- 默认 store 读写也受用户级 `memories` 开关影响
- EXTRACTION.md 始终按 userId 隔离

## 图片

`/memory/images/<id>.<ext>`：

- 按数字 id 或 sha256 查找
- 返回原始 bytes 和 mime
- 只读；删除走面板或 `memories.images.delete`
- 不参与文本记忆列表
