# 图片记忆

图片记忆让图片本身成为可召回的上下文，而不仅是聊天附件。

支持：

- 按图片找图片
- 按文字描述找图片
- 完全相同 / 视觉近重复去重
- 原图按编号或 sha256 访问

## 处理链路

```text
buffer / URL
   │
   ▼
normalizeImage（sharp）
   ├─ EXIF rotate
   ├─ 最长边限制
   ├─ 格式转换
   └─ 尺寸/字节校验
   │
   ▼
sha256 + dHash
   │
   ├─ 相同 sha256 → 复用
   ├─ dHash 距离 ≤ 阈值 → 复用
   │
   ▼
memoryimages upsert
   │
   ▼
图片 embedding
   │
   ▼
image_vectors upsert
```

## 归一化

- `sharp().rotate()` 应用 EXIF 方向
- 最长边默认 1024（`MEMORY_IMAGE_MAX_EDGE`）
- 最小边默认 32（`MEMORY_IMAGE_MIN_EDGE`）
- 原图字节上限默认 6 MiB（`MEMORY_IMAGE_MAX_BYTES`）
- jpeg/png/webp/gif 尽量保留；其他格式重新编码
- 无法解析/过小/过大 → skip

## 去重

- `sha256`：内容完全相同
- 64 位 dHash：9×8 灰度差分
- Hamming distance ≤ `MEMORY_IMAGE_DHASH_DISTANCE`（默认 4）视为近重复
- 平坦图片的 dHash 信息量低，不参与近重复判断
- 扫描上限 `MEMORY_IMAGE_DEDUPE_SCAN`（默认 1000）

命中重复时只更新 `updatedAt`，不重复生成 embedding。

## 存储字段

`memoryimages`：

- `sha256` / `dhash` / `id`
- `mime` / `width` / `height` / `bytes`
- `data`：原始 bytes
- `source`：`attachment` / `tool`
- `origin`：conversation / message / file / tool
- `embedded`：是否已有向量

`image_vectors` 与图片一一对应；维度由 `MEMORY_IMAGE_DIM` 决定，默认 1024。

## 入口

### 上传

文件上传后，图片以 base64 进入 `image.ingest`：

```text
userId, storeId, data, mimeType, source, origin, agentId
```

上传响应不等待 embedding。

### agent `read_file`

工具读到图片时，通过 URL ingest：

```text
memory.image.ingest({ userId, url, source: 'tool', origin })
```

### 删除

`memories.images.delete` 删除 `memoryimages` 和 `image_vectors`。

## 召回

图片召回与文本召回并行：

- 文本 query → 图片向量
- 图片 query → 图片向量
- 候选默认 6，最终注入默认 1
- 文本找图门槛默认 0.34
- 注入受字节上限限制，太大时退化为资源引用
- 与文本共享已注入 key 排除逻辑

## 队列与失败

图片 ingest 在进程内串行排队，避免并发 embedding 压垮 sidecar。

| 失败 | 行为 |
|---|---|
| 格式/尺寸不合法 | skip |
| 无可用 store | skip |
| embedding 不可用 | 图片入库，`embedded: false` |
| 向量写入失败 | 图片入库，后续可重试 |
| 近重复扫描超限 | 只做 sha256 去重 |
