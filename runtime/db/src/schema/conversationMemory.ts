import { Schema } from 'mongoose';
import type { IConversationMemory } from '../../types/conversationMemory';

/**
 * Links a memory key to the conversation that auto-extracted it. Kept OUT of
 * the memory entry itself so deleting a conversation cleans up these small
 * link documents (via `deleteConversationMemories`) instead of leaving a
 * growing `conversationId` on every memory. Used to avoid re-injecting a
 * conversation's own extracted memories back into its run context.
 */
const ConversationMemorySchema: Schema<IConversationMemory> = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    required: true,
  },
  conversationId: {
    type: String,
    required: true,
    index: true,
  },
  /** Memory store the linked entry lives in (mirrors `MemoryEntry.storeId`). */
  storeId: {
    type: String,
    default: undefined,
  },
  /** Memory domain the linked entry belongs to (mirrors its `domainId`). */
  domainId: {
    type: String,
    default: undefined,
  },
  /** `extracted` = this conversation created the memory; `recalled` = the
   *  conversation only read it. Only extracted links make the memory "its own"
   *  — which is what keeps a conversation from re-injecting what it wrote, and
   *  what stops a recalled memory from being excluded ever after. */
  source: {
    type: String,
    enum: ['extracted', 'recalled'],
    default: 'extracted',
  },
  /** Turns of THIS conversation that recalled the memory into context. */
  recallCount: {
    type: Number,
    default: 0,
  },
  /** The turn that last moved `recallCount`, so the counter moves once per
   *  turn: a regenerated, retried, or resumed run is the same turn. */
  lastRecallTurnId: {
    type: String,
    default: undefined,
  },
  /** True when this conversation CREATED the memory, false when it only
   *  updated one that already existed. Absent on recall links and old rows. */
  createdByConversation: {
    type: Boolean,
    default: undefined,
  },
  /** The turn whose extraction last wrote this link, named by that turn's
   *  assistant reply message. Compaction releases the links whose turn sits
   *  before the message the summary retained from; absent on rows written
   *  before this field existed and on `/memory` mount writes. */
  turnMessageId: {
    type: String,
    default: undefined,
  },
  key: {
    type: String,
    required: true,
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

ConversationMemorySchema.index({ userId: 1, conversationId: 1, key: 1 }, { unique: true });

export default ConversationMemorySchema;
