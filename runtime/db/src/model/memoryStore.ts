import { Model } from 'mongoose';
import type { IMemoryStore } from '../../types/memoryStore';
import { applyTenantIsolation } from './tenantIsolation';
import memoryStoreSchema from '../schema/memoryStore';

export function createMemoryStoreModel(
  mongoose: typeof import('mongoose'),
): Model<IMemoryStore> {
  applyTenantIsolation(memoryStoreSchema);
  return (
    mongoose.models.MemoryStore || mongoose.model<IMemoryStore>('MemoryStore', memoryStoreSchema)
  );
}
