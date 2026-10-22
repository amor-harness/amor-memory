import { Schema } from 'mongoose';
import type { IMemoryStore } from '../../types/memoryStore';

/**
 * A user-owned container of memories. Every memory entry (and indexed image)
 * carries the store it belongs to; runs only ever touch the store their agent
 * selected, which is what keeps stores isolated from one another. Access beyond
 * the owner is granted through the resource ACL (viewer/editor/owner roles).
 */
const MemoryStoreSchema: Schema<IMemoryStore> = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  /** The store pre-existing memories were migrated into; never deletable. */
  isDefault: {
    type: Boolean,
    default: false,
  },
  created_at: {
    type: Date,
    default: Date.now,
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

MemoryStoreSchema.index({ userId: 1, name: 1 });

export default MemoryStoreSchema;
