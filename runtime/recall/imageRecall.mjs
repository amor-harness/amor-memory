import mongoose from 'mongoose';
import { memoryEnv } from './env.mjs';
import imageEmbeddings from './imageEmbeddings.mjs';
import imageStore from './imageStore.mjs';

const CANDIDATE_LIMIT = Number(memoryEnv('MEMORY_IMAGE_RAG_CANDIDATES') ?? 6);
const RESULT_LIMIT = Number(memoryEnv('MEMORY_IMAGE_RAG_LIMIT') ?? 1);
const TEXT_MIN_SCORE = Number(memoryEnv('MEMORY_IMAGE_TEXT_MIN_SCORE') ?? 0.34);
const INJECT_MAX_BYTES = Number(memoryEnv('MEMORY_IMAGE_INJECT_MAX_BYTES') ?? 1_500_000);

function extensionFor(mime) {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/gif':
      return 'gif';
    case 'image/webp':
      return 'webp';
    default:
      return 'png';
  }
}

function imageUrlFor(identifier, mime) {
  return `/memory/images/${identifier}.${extensionFor(mime)}`;
}

function imagePathKeyOf(row) {
  return row.id ?? row.sha256;
}

function imageKeyOf(sha256) {
  return `image:${sha256}`;
}

function formatRecalledImages(entries) {
  const lines = entries.map((entry, index) => {
    const relevance = entry.score != null ? ` [relevance: ${entry.score.toFixed(2)}]` : '';
    const size = entry.width && entry.height ? ` [${entry.width}x${entry.height}]` : '';
    return (
      `${index + 1}. ["url": "${entry.url}"]${size}${relevance}` +
      `\n   To show this image in your reply, write: ![](${entry.url})`
    );
  });
  return `# Recalled images:\n${lines.join('\n\n')}`;
}

export async function recallImageMemories({
  userId,
  storeId,
  domainIds,
  query,
  excludeKeys,
  includeDataUrls = true,
}) {
  if (!query || !userId || !imageStore.isEnabled() || !imageEmbeddings.isEnabled()) {
    return { entries: [], text: '' };
  }
  try {
    const vector = await imageEmbeddings.embedText(query);
    if (!vector) {
      return { entries: [], text: '' };
    }
    const hits = await imageStore.searchImageVectors({
      userId: String(userId),
      storeId,
      domainIds,
      queryVector: vector,
      limit: CANDIDATE_LIMIT,
      threshold: TEXT_MIN_SCORE,
    });
    const fresh = hits.filter((hit) => !excludeKeys?.has(imageKeyOf(hit.sha256)));
    if (fresh.length === 0) {
      return { entries: [], text: '' };
    }
    const models = await (await import('../db.mjs')).models();
    const objectId = new mongoose.Types.ObjectId(String(userId));
    const rows = await models.MemoryImage.find({ userId: objectId, storeId: String(storeId) })
      .select('sha256 id mime width height embedded updatedAt')
      .limit(500)
      .lean();
    const bySha = new Map(rows.map((row) => [row.sha256, row]));
    const entries = [];
    for (const hit of fresh) {
      const row = bySha.get(hit.sha256);
      if (!row || row.embedded !== true) {
        continue;
      }
      const url = imageUrlFor(imagePathKeyOf(row), row.mime);
      let dataUrl;
      if (includeDataUrls) {
        const full = await models.MemoryImage.findOne({ userId: objectId, sha256: row.sha256 })
          .select('data')
          .lean();
        if (!full?.data) {
          continue;
        }
        dataUrl = `data:${row.mime};base64,${full.data.toString('base64')}`;
        if (dataUrl.length > INJECT_MAX_BYTES * 1.4) {
          dataUrl = undefined;
        }
      }
      entries.push({
        key: imageKeyOf(row.sha256),
        sha256: row.sha256,
        id: row.id,
        mime: row.mime,
        url,
        width: row.width,
        height: row.height,
        score: hit.score != null ? Number(hit.score) : undefined,
        updatedAt: row.updatedAt,
        dataUrl,
      });
      if (entries.length >= RESULT_LIMIT) {
        break;
      }
    }
    if (entries.length === 0) {
      return { entries: [], text: '' };
    }
    return { entries, text: formatRecalledImages(entries) };
  } catch {
    return { entries: [], text: '' };
  }
}

export { formatRecalledImages, imageUrlFor, imagePathKeyOf, imageKeyOf, extensionFor };
export default { recallImageMemories };
