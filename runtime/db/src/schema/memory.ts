import { Schema } from 'mongoose';
import type { IMemoryEntry } from '../../types/memory';

const MemoryEntrySchema: Schema<IMemoryEntry> = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    required: true,
  },
  key: {
    type: String,
    required: true,
    validate: {
      validator: (v: string) => /^[a-z0-9_]+$/.test(v),
      message: 'Key must only contain lowercase letters, numbers, and underscores',
    },
  },
  value: {
    type: String,
    required: true,
  },
  /** Cue anchors parsed from the value's trailing `tags:` lines, materialized
   *  at write time so recall can match them without re-parsing every row. The
   *  value keeps the declaration — it is what the panel and the `/memory`
   *  files show — so this is a derived index, never the source of truth. */
  tags: {
    type: [String],
    default: [],
  },
  /** Memory store this entry belongs to. Stores are the isolation unit: a run
   *  only ever reads the store its agent selected. */
  storeId: {
    type: String,
    default: undefined,
    index: true,
  },
  /** Memory domain this entry belongs to: the context it is true in. A run
   *  only reads and writes the domains it has active, so a game world's
   *  memories never surface as facts about real life. */
  domainId: {
    type: String,
    default: undefined,
    index: true,
  },
  tokenCount: {
    type: Number,
    default: 0,
  },
  /** Stable memories ride the cacheable stable system baseline; new memories
   *  default to ephemeral (single-turn RAG recall). */
  stable: {
    type: Boolean,
    default: false,
  },
  /** Where a stable memory is injected every turn: the cacheable system prompt
   *  (`system`, the default) or the per-turn `additional_instructions` tail,
   *  which a frequently edited memory can use so it never rewrites the cached
   *  prefix. Ephemeral memories ignore it. */
  injection: {
    type: String,
    enum: ['system', 'additional'],
    default: 'system',
  },
  /** Locked memories are invisible to the memory extractor and refuse every
   *  LLM write path (set/append/delete). Only the Memories panel and the
   *  `/memory` VFS mount may change them, so a user-authored memory survives
   *  automatic extraction and capacity eviction untouched. */
  locked: {
    type: Boolean,
    default: false,
  },
  /** When an ephemeral memory was last recalled into a turn's context; absent
   *  means it has never been recalled. Drives capacity eviction: when storage
   *  is full, the least-recently-recalled (never-recalled first) ephemeral
   *  memories are dropped to make room for new ones. */
  lastRecalledAt: {
    type: Date,
    default: undefined,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
  tenantId: {
    type: String,
    index: true,
  },
});

MemoryEntrySchema.index({ storeId: 1, key: 1 });
MemoryEntrySchema.index({ storeId: 1, domainId: 1 });

export default MemoryEntrySchema;
