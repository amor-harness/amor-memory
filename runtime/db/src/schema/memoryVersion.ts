import { Schema } from 'mongoose';
import type { IMemoryVersion } from '../../types/memory';

/**
 * One recorded state of a memory entry, appended by every write path. Kept OUT
 * of the entry itself: a memory's value can reach the configured character
 * limit, so an embedded history array would ride every memory list response and
 * grow the entry document without bound. The memory panel reads these rows to
 * show what an entry used to be and to restore one of its states.
 */
const MemoryVersionSchema: Schema<IMemoryVersion> = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    required: true,
  },
  /** The entry's `_id` as a hex string: the chain's identity. It survives a
   *  rename (the chain moves to the new entry), so a renamed memory keeps the
   *  history it earned under its old key. */
  memoryId: {
    type: String,
    required: true,
  },
  /** The key this state was written under — a rename's older states keep the
   *  key they actually had. */
  key: {
    type: String,
    required: true,
  },
  value: {
    type: String,
    required: true,
  },
  /** Cue anchors derived from the value's trailing `tags:` lines. */
  tags: {
    type: [String],
    default: [],
  },
  /** Mirrors the entry's store/domain so purging a store or a user can drop
   *  its history without reading every memory entry first. */
  storeId: {
    type: String,
    default: undefined,
    index: true,
  },
  domainId: {
    type: String,
    default: undefined,
  },
  tokenCount: {
    type: Number,
    default: 0,
  },
  stable: {
    type: Boolean,
    default: false,
  },
  /** Where the state's stable memory was injected; restores it with the rest
   *  of the state. */
  injection: {
    type: String,
    enum: ['system', 'additional'],
    default: 'system',
  },
  locked: {
    type: Boolean,
    default: false,
  },
  /** When this state was written — the version's creation time. */
  createdAt: {
    type: Date,
    default: Date.now,
  },
  tenantId: {
    type: String,
    index: true,
  },
});

/** The history reads newest-first for one memory, and pruning drops the tail
 *  of that same list, so one compound index serves both. */
MemoryVersionSchema.index({ memoryId: 1, createdAt: -1 });

export default MemoryVersionSchema;
