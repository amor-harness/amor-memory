import { Schema } from 'mongoose';
import { MEMORY_DOMAIN_KINDS } from 'librechat-data-provider';
import type { IMemoryDomain } from '../../types/memoryDomain';

/**
 * A context memories belong to inside one store. Entries carry their domain,
 * and a run only touches the domains it has active, which is what keeps a game
 * world's memories from being read as facts about real life.
 */
const MemoryDomainSchema: Schema<IMemoryDomain> = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    required: true,
  },
  storeId: {
    type: String,
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  /** Fixed vocabulary: how the injected memory text is framed for the model. */
  kind: {
    type: String,
    enum: MEMORY_DOMAIN_KINDS,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  /** The domain pre-existing memories were migrated into; never deletable. */
  isDefault: {
    type: Boolean,
    default: false,
  },
  createdBy: {
    type: String,
    enum: ['user', 'agent'],
    default: 'user',
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

/** Names are unique per store; the case-insensitive check lives in the methods. */
MemoryDomainSchema.index({ storeId: 1, name: 1 }, { unique: true });

export default MemoryDomainSchema;
