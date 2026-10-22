import { Schema } from 'mongoose';
import type { IMemoryImage } from '../../types/memoryImage';

/**
 * An indexed image memory: the bytes plus the identity needed to dedupe it.
 * Rows are written by the ingest pipeline and read by image recall / the
 * `/memory/images/...` virtual path; they are never part of the text memory
 * store (`MemoryEntry`) and never carry a token count.
 */
const memoryImageSchema: Schema<IMemoryImage> = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    required: true,
  },
  /** Memory store this image belongs to; images are isolated per store. */
  storeId: {
    type: String,
    default: undefined,
    index: true,
  },
  /** Memory domain this image belongs to; recall is scoped to the active set. */
  domainId: {
    type: String,
    default: undefined,
    index: true,
  },
  /** Short per-user id for the image path, from the per-user counter. */
  id: {
    type: Number,
  },
  sha256: {
    type: String,
    required: true,
  },
  dhash: {
    type: String,
    required: true,
  },
  mime: {
    type: String,
    required: true,
  },
  width: {
    type: Number,
    default: 0,
  },
  height: {
    type: Number,
    default: 0,
  },
  bytes: {
    type: Number,
    default: 0,
  },
  data: {
    type: Buffer,
    required: true,
  },
  source: {
    type: String,
    enum: ['attachment', 'tool'],
    required: true,
  },
  origin: {
    conversationId: { type: String },
    messageId: { type: String },
    fileId: { type: String },
    toolName: { type: String },
  },
  /** Whether the recall embedding was written; retried on a later ingest when
   *  a previous attempt could not reach the embedding service. */
  embedded: {
    type: Boolean,
    default: false,
  },
  /** When the image was last recalled into a turn; absent = never recalled. */
  lastRecalledAt: {
    type: Date,
    default: undefined,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  tenantId: {
    type: String,
    index: true,
  },
});

/** One row per store + exact content. Scoped to the store, not just the user:
 *  an image is recallable only from the store it was indexed into, so the same
 *  picture read by agents bound to two different stores is two memories. */
memoryImageSchema.index({ userId: 1, storeId: 1, sha256: 1 }, { unique: true });
/** One row per user + short id; sparse so pre-id rows stay valid. */
memoryImageSchema.index({ userId: 1, id: 1 }, { unique: true, sparse: true });
/** Near-duplicate probe: same user, same perceptual hash. */
memoryImageSchema.index({ userId: 1, dhash: 1 });

export default memoryImageSchema;
