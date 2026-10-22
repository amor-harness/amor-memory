import { Model } from 'mongoose';
import type { IMemoryVersion } from '../../types/memory';
import { applyTenantIsolation } from './tenantIsolation';
import memoryVersionSchema from '../schema/memoryVersion';

export function createMemoryVersionModel(
  mongoose: typeof import('mongoose'),
): Model<IMemoryVersion> {
  applyTenantIsolation(memoryVersionSchema);
  return (
    mongoose.models.MemoryVersion ||
    mongoose.model<IMemoryVersion>('MemoryVersion', memoryVersionSchema)
  );
}
