# 图片记忆

## 1. 目标

用户上传的图片、`read_file` 读到的图片，都可以成为可召回的记忆，而不仅是附件。

图片记忆支持：

- 按图片找图片；
- 按文字描述找图片；
- 近重复图片去重；
- 原图按 id/sha 提供访问。

## 2. 处理链路

```text
buffer / URL
   │
   ▼
normalizeImage（sharp）
   ├─ EXIF rotate
   ├─ 最长边限制
   ├─ 格式转换
   └─ 尺寸/字节限制
   │
   ▼
sha256 + dHash
   │
   ├─ 已有相同 sha → 复用
   ├─ 已有相近 dHash → 复用
   │
   ▼
upsert memoryimages
   │
   ▼
imageEmbeddings.embedImage
   │
   ▼
upsert image_vectors
   │
   ▼
markMemoryImageEmbedded
```

## 3. 归一化

`normalizeImage`：

- `sharp(buffer).rotate()` 应用 EXIF 方向；
- 最长边 `MEMORY_IMAGE_MAX_EDGE`，默认 1024；
- 最小边 `MEMORY_IMAGE_MIN_EDGE`，默认 32；
- 超过 `MEMORY_IMAGE_MAX_BYTES`（默认 6MB）拒绝；
- 常见格式直接保留：jpeg/png/webp/gif；
- 其他格式重新编码。

## 4. dHash 去重

64 位 difference hash：

- 9×8 灰度；
- 每个 bit 表示像素是否比右侧亮；
- Hamming distance ≤ `MEMORY_IMAGE_DHASH_DISTANCE` 视为近重复；
- 平坦图片（全同色/纯渐变）的 hash 不具信息量，不参与近重复判断；
- 扫描上限 `MEMORY_IMAGE_DEDUPE_SCAN`，默认 1000。

去重结果：

- `sha256`：完全相同；
- `dhash`：视觉近似；
- 去重后只 touch `updatedAt`，不重复 embedding。

## 5. 存储

`memoryimages`：

- `sha256`、`dhash`、`mime`、`width`、`height`、`bytes`；
- `data`：原始 bytes；
- `source`：`attachment` / `tool`；
- `origin`：conversation/message/file/tool；
- `embedded`：是否已有向量。

## 6. 向量

`image_vectors`：

- 一条图片一行；
- 向量维度 `MEMORY_IMAGE_DIM`；
- 召回门槛：
  - 文本 query 找图：`MEMORY_IMAGE_TEXT_MIN_SCORE`；
  - 图片 query 找图：`MEMORY_IMAGE_IMAGE_QUERY_MIN_SCORE`；
- 与文本召回并行执行。

## 7. 入口

### 上传

图片上传后，以 base64 数据进入 ingest：

```text
userId, data(base64), mimeType, source, origin, storeId, agentId
```

### `read_file` 图片

tool callback 传 URL：

```js
memory.image.ingest({ userId, url, source: 'tool', origin });
```

### 手动删除

`memories.images.delete`：

- 删除 `memoryimages`；
- 删除 `image_vectors`。

## 8. 队列

图片 ingest 在系统内串行排队：

- 避免并发 embedding 打爆 sidecar；
- 单个失败只记日志，不影响上传响应；
- 上传接口只等待文件落盘，不等待 embedding。

## 9. 失败策略

| 失败点           | 行为                       |
| ---------------- | -------------------------- |
| 格式无法解析     | skip                       |
| 太小/太大        | skip                       |
| 无可用 store     | skip                       |
| embedding 不可用 | 图片入库，`embedded:false` |
| 向量写入失败     | 图片入库，后续可重试       |
