/**
 * Image memory ingest.
 *
 * An image the user attaches, or one a `read_file` call reads, is normalized,
 * hashed and stored once per store: exact duplicates by sha256, visually
 * identical frames by dHash (Hamming distance), and only genuinely new images
 * are embedded and indexed for recall. Work runs on a serial queue — an image
 * embed costs seconds, so callers fire and forget and a slow image never
 * delays a turn.
 *
 * An image lands in the memory store its caller names — the `read_file` path
 * names the reading agent's store — or, for an attachment, in the store of the
 * agent the message is addressed to; a chat with no agent falls back to the
 * user's default store. Only a store the user may write is ever used, and an
 * agent without memory indexes nothing.
 *
 * Env: MEMORY_IMAGE_MAX_EDGE (default 1024), MEMORY_IMAGE_MAX_BYTES (default
 * 6MB after normalization), MEMORY_IMAGE_DHASH_DISTANCE (default 4).
 */
import crypto from 'node:crypto';
import sharp from 'sharp';
import mongoose from 'mongoose';
import { logger } from '@librechat/data-schemas';
import imageEmbeddings from '../recall/imageEmbeddings.mjs';
import imageStore from '../recall/imageStore.mjs';
import { memoryEnv } from './config.mjs';
import { extractionMethods } from '../extraction/database.mjs';

const { Types } = mongoose;
const db = new Proxy(
  {},
  {
    get: (_target, name) => async (...args) => {
      const methods = await extractionMethods();
      return methods[name](...args);
    },
  },
);
const { isAgentMemoryEnabled } = (await import('node:module')).createRequire(import.meta.url)(
  '@librechat/api',
);

const MAX_EDGE = Number(memoryEnv('MEMORY_IMAGE_MAX_EDGE') || 1024);
const MAX_BYTES = Number(memoryEnv('MEMORY_IMAGE_MAX_BYTES') || 6 * 1024 * 1024);
const MIN_EDGE = Number(memoryEnv('MEMORY_IMAGE_MIN_EDGE') || 32);
const DHASH_DISTANCE = Number(memoryEnv('MEMORY_IMAGE_DHASH_DISTANCE') || 4);
/** Bound on the near-duplicate scan (metadata only) per ingest. */
const NEAR_DUPLICATE_SCAN_LIMIT = Number(memoryEnv('MEMORY_IMAGE_DEDUPE_SCAN') || 1000);

/** Formats providers and browsers all accept; anything else is re-encoded. */
const PASSTHROUGH_FORMATS = new Map([
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp'],
  ['gif', 'image/gif'],
]);

function isEnabled() {
  return imageEmbeddings.isEnabled() && imageStore.isEnabled();
}

/**
 * 64-bit difference hash: a 9x8 greyscale reduction where each bit records
 * whether a pixel is brighter than its right neighbour. Two encodings of the
 * same picture land within a few bits of each other.
 */
async function computeDhash(buffer) {
  const { data } = await sharp(buffer)
    .greyscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let bits = '';
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const index = row * 9 + column;
      bits += data[index] < data[index + 1] ? '1' : '0';
    }
  }
  return BigInt(`0b${bits}`).toString(16).padStart(16, '0');
}

/** Bit distance between two dHash values; `null` when either is unparseable. */
function hammingDistance(a, b) {
  try {
    let value = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
    let count = 0;
    while (value > 0n) {
      count += Number(value & 1n);
      value >>= 1n;
    }
    return count;
  } catch {
    return null;
  }
}

/** Number of set bits in a dHash value. */
function countBits(dhash) {
  try {
    let value = BigInt(`0x${dhash}`);
    let count = 0;
    while (value > 0n) {
      count += Number(value & 1n);
      value >>= 1n;
    }
    return count;
  } catch {
    return null;
  }
}

/**
 * Whether a dHash actually describes an image. Flat images (a solid colour, a
 * plain gradient stop, a mostly-blank screenshot) reduce to every comparison
 * landing the same way, so unrelated flat pictures hash identically — treating
 * those as near-duplicates would fuse two different memories into one.
 */
function isInformativeDhash(dhash) {
  const bits = countBits(dhash);
  return bits !== null && bits > 0 && bits < 64;
}

/**
 * Downscales to a recall-friendly size, applies EXIF orientation and reports
 * the stored mime. Returns `null` for anything too small to be content or too
 * large to store.
 */
async function normalizeImage(buffer, mimeType) {
  const pipeline = sharp(buffer, { failOn: 'none' }).rotate();
  const metadata = await pipeline.metadata();
  const { width = 0, height = 0, format } = metadata;
  if (!format || Math.min(width, height) < MIN_EDGE) {
    return null;
  }
  const resized = pipeline.resize({
    width: MAX_EDGE,
    height: MAX_EDGE,
    fit: 'inside',
    withoutEnlargement: true,
  });
  const passthrough = PASSTHROUGH_FORMATS.get(format);
  const output = passthrough ? resized : resized.png();
  const { data, info } = await output.toBuffer({ resolveWithObject: true });
  if (data.length > MAX_BYTES) {
    return null;
  }
  return {
    buffer: data,
    mime: passthrough ?? 'image/png',
    width: info.width ?? width,
    height: info.height ?? height,
    sourceMimeType: mimeType,
  };
}

/** Parses `data:image/png;base64,...` into a buffer plus its declared mime. */
function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') {
    return null;
  }
  const match = /^data:([a-z0-9.+/-]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) {
    return null;
  }
  return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

const toObjectId = (userId) =>
  userId instanceof Types.ObjectId ? userId : new Types.ObjectId(String(userId));

/**
 * Resolves where an image lands and whose rows it becomes: the store the caller
 * named — but only when this user may write it — or the user's default store
 * when the caller has no run context (an upload happens before any agent picks
 * a store). `null` means there is nowhere to write, so the image is skipped
 * instead of being filed into a library its reader never chose.
 */
async function resolveImageTarget(userId, storeId) {
  if (storeId == null || storeId === '') {
    const store = await db.ensureDefaultMemoryStore(userId);
    return { storeId: String(store._id), userId: String(userId) };
  }
  if (typeof db.resolveMemoryStoreAccess !== 'function') {
    return null;
  }
  const resolved = await db.resolveMemoryStoreAccess({ storeId, userId }).catch(() => null);
  if (!resolved?.canWrite) {
    return null;
  }
  return { storeId: String(resolved.storeId), userId: String(resolved.ownerId) };
}

/**
 * Resolves the destination for one ingest: a store the caller named wins (the
 * `read_file` path names the reading agent's store), otherwise the agent the
 * message is addressed to decides, and a chat with no agent falls back to the
 * user's default store. `null` = not indexed: the agent the user sent this to
 * has no memory, so there is no library for its content to belong to.
 */
async function resolveIngestTarget({ userId, storeId, agentId }) {
  if (storeId != null && storeId !== '') {
    return await resolveImageTarget(userId, storeId);
  }
  if (agentId == null || agentId === '') {
    return await resolveImageTarget(userId, undefined);
  }
  const agent =
    typeof db.getAgent === 'function' ? await db.getAgent({ id: agentId }).catch(() => null) : null;
  if (!isAgentMemoryEnabled(agent)) {
    logger.debug(`[memoryImages] Agent ${agentId} has no memory store; not indexing for it`);
    return null;
  }
  return await resolveImageTarget(userId, agent.memory_store);
}

/**
 * Stores and indexes one image. Safe to call for an image already known: the
 * row's `updatedAt` refreshes and no second embedding is paid for. A named
 * store that this user cannot write is skipped, never redirected.
 */
async function ingestImageBuffer({
  userId,
  storeId: requestedStoreId,
  agentId,
  buffer,
  mimeType,
  source,
  origin,
  tenantId,
}) {
  if (!isEnabled() || !userId || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { ok: false, skipped: true };
  }
  try {
    const destination = await resolveIngestTarget({
      userId,
      storeId: requestedStoreId,
      agentId,
    });
    if (!destination) {
      return { ok: false, skipped: true };
    }
    /** A shared store belongs to its owner: the rows are theirs, so recall and
     *  the panel find them by the owner's user id. */
    const { storeId, userId: ownerId } = destination;
    const normalized = await normalizeImage(buffer, mimeType);
    if (!normalized) {
      return { ok: false, skipped: true };
    }
    const sha256 = crypto.createHash('sha256').update(normalized.buffer).digest('hex');
    const dhash = await computeDhash(normalized.buffer);

    let existing = null;
    if (typeof db.getMemoryImages === 'function' && isInformativeDhash(dhash)) {
      /** A near-duplicate is decided before storing: the same picture
       *  re-encoded by a tool must not become a second memory. The scan is
       *  bounded — it reads metadata only, and a user's image memory is a
       *  personal-scale collection. */
      const candidates = await db
        .getMemoryImages({ userId: ownerId, storeId, limit: NEAR_DUPLICATE_SCAN_LIMIT })
        .catch(() => []);
      existing = candidates.find(
        (image) =>
          image.sha256 === sha256 ||
          (isInformativeDhash(image.dhash) &&
            (hammingDistance(image.dhash, dhash) ?? 99) <= DHASH_DISTANCE),
      );
    }

    const stored = existing
      ? { ok: true, deduped: existing.sha256 === sha256 ? 'sha256' : 'dhash', image: existing }
      : await db.upsertMemoryImage({
          userId: toObjectId(ownerId),
          storeId,
          sha256,
          dhash,
          mime: normalized.mime,
          width: normalized.width,
          height: normalized.height,
          bytes: normalized.buffer.length,
          data: normalized.buffer,
          source,
          origin,
          tenantId,
        });

    if (existing) {
      await db.touchMemoryImage({ userId: ownerId, storeId, sha256: existing.sha256 });
    }

    if (!stored.ok) {
      return stored;
    }
    if (stored.deduped) {
      const target = stored.image ?? existing ?? null;
      const targetSha = target?.sha256 ?? sha256;
      /** Retry the embedding when a previous attempt stored the row but the
       *  sidecar was unavailable, so an image never stays unsearchable. */
      if (target?.embedded === true) {
        return { ok: true, sha256: targetSha, deduped: stored.deduped };
      }
      const vector = await imageEmbeddings.embedImage(normalized.buffer, normalized.mime);
      if (vector) {
        await imageStore.upsertImageVector({
          userId: String(ownerId),
          storeId,
          sha256: targetSha,
          vector,
        });
        await db.markMemoryImageEmbedded({ userId: ownerId, storeId, sha256: targetSha });
      }
      return { ok: true, sha256: targetSha, deduped: stored.deduped, embedded: Boolean(vector) };
    }

    const vector = await imageEmbeddings.embedImage(normalized.buffer, normalized.mime);
    if (!vector) {
      return { ok: true, sha256, embedded: false };
    }
    await imageStore.upsertImageVector({ userId: String(ownerId), storeId, sha256, vector });
    await db.markMemoryImageEmbedded({ userId: ownerId, storeId, sha256 });
    return { ok: true, sha256, embedded: true };
  } catch (error) {
    logger.error('[memoryImages] Failed to ingest image', error);
    return { ok: false, reason: 'ingest failed' };
  }
}

/** Reads an image the caller holds as a URL: a `data:` payload as-is, or a
 *  storage URL (an S3/CloudFront file the model's image part points at) fetched.
 *  Both describe bytes our own file rows wrote. */
async function readImageUrl(url) {
  const parsed = parseDataUrl(url);
  if (parsed) {
    return parsed;
  }
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    return null;
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      logger.warn(`[memoryImages] Could not read image URL (HTTP ${response.status})`);
      return null;
    }
    return {
      mimeType: response.headers.get('content-type') ?? 'image/png',
      buffer: Buffer.from(await response.arrayBuffer()),
    };
  } catch (error) {
    logger.warn('[memoryImages] Could not read image URL', error);
    return null;
  }
}

/** Ingest entry point for an image the caller holds as a URL. */
async function ingestImageUrl({ userId, storeId, agentId, url, source, origin, tenantId }) {
  const parsed = await readImageUrl(url);
  if (!parsed) {
    return { ok: false, skipped: true };
  }
  return await ingestImageBuffer({
    userId,
    storeId,
    agentId,
    buffer: parsed.buffer,
    mimeType: parsed.mimeType,
    source,
    origin,
    tenantId,
  });
}

/**
 * One image at a time, process-wide: the sidecar serializes too, but this
 * keeps a burst of attachments from piling up requests it would only queue.
 */
let tail = Promise.resolve();
function enqueue(task) {
  const run = tail.then(task, task);
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Reports a fire-and-forget ingest. A skip is a designed outcome — the agent
 *  has no memory, or the store is not this user's to write — so it stays at
 *  debug; anything else means an image that should have been indexed was not. */
function reportIngest(run, subject) {
  void run.then(
    (result) => {
      if (result?.ok) {
        return;
      }
      if (result?.skipped === true) {
        logger.debug(`[memoryImages] ${subject} image was skipped`, result);
        return;
      }
      logger.warn(
        `[memoryImages] ${subject} image was not indexed`,
        result ?? { reason: 'no result' },
      );
    },
    (error) => logger.error(`[memoryImages] ${subject} image ingest failed`, error),
  );
}

/** Fire-and-forget ingest for request paths: never throws, never blocks. The
 *  destination is resolved on the queue — an attachment belongs to the agent
 *  the message is addressed to, named by `agentId`. */
function enqueueImageIngest(params) {
  if (!isEnabled()) {
    return;
  }
  reportIngest(
    enqueue(() => ingestImageBuffer(params)),
    'Attachment',
  );
}

/** Fire-and-forget variant for callers holding an image URL. The caller names
 *  where it came from — a store (a `read_file` image, whose run names the
 *  reading agent's store) or an agent (an attachment, filed with the agent the
 *  message is sent to) — and the queue resolves the store from that. With
 *  neither there is nothing to resolve against, so nothing is queued: an image
 *  must never be filed into a library its reader never chose. */
function enqueueImageIngestFromUrl(params) {
  const { storeId, agentId } = params ?? {};
  const hasTarget =
    (typeof storeId === 'string' && storeId !== '') ||
    (typeof agentId === 'string' && agentId !== '');
  if (!isEnabled() || !hasTarget) {
    return;
  }
  reportIngest(
    enqueue(() => ingestImageUrl(params)),
    params?.source === 'tool' ? 'Read-file' : 'Attachment',
  );
}

/** The stored bytes for serving one image, or `null`. */
async function getImageRecord({ userId, sha256, id, storeId }) {
  if (!userId || (sha256 == null && id == null)) {
    return null;
  }
  if (sha256 != null && !/^[a-f0-9]{64}$/.test(sha256)) {
    return null;
  }
  return await db.getMemoryImage({
    userId: toObjectId(userId),
    ...(storeId != null ? { storeId } : {}),
    ...(sha256 != null ? { sha256 } : { id }),
  });
}

async function listImages({ userId, storeId }) {
  return await db.getMemoryImages({ userId: toObjectId(userId), storeId });
}

async function deleteImage({ userId, storeId, sha256 }) {
  const removed = await db.deleteMemoryImage({ userId: toObjectId(userId), storeId, sha256 });
  if (removed > 0 && imageStore.isEnabled()) {
    await imageStore.deleteImageVector({ userId: String(userId), storeId, sha256 });
  }
  return removed;
}

export {
  isEnabled,
  computeDhash,
  hammingDistance,
  isInformativeDhash,
  normalizeImage,
  parseDataUrl,
  ingestImageBuffer,
  readImageUrl,
  ingestImageUrl,
  enqueueImageIngest,
  enqueueImageIngestFromUrl,
  getImageRecord,
  listImages,
  deleteImage,
  DHASH_DISTANCE,
};
