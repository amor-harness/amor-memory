import { Model } from 'mongoose';
import type { IConversationMemory } from '../../types/conversationMemory';
import { applyTenantIsolation } from './tenantIsolation';
import conversationMemorySchema from '../schema/conversationMemory';

export function createConversationMemoryModel(
  mongoose: typeof import('mongoose'),
): Model<IConversationMemory> {
  applyTenantIsolation(conversationMemorySchema);
  return (
    mongoose.models.ConversationMemory ||
    mongoose.model<IConversationMemory>('ConversationMemory', conversationMemorySchema)
  );
}
