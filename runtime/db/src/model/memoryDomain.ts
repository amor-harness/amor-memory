import { Model } from 'mongoose';
import type { IMemoryDomain } from '../../types/memoryDomain';
import { applyTenantIsolation } from './tenantIsolation';
import memoryDomainSchema from '../schema/memoryDomain';

export function createMemoryDomainModel(
  mongoose: typeof import('mongoose'),
): Model<IMemoryDomain> {
  applyTenantIsolation(memoryDomainSchema);
  return (
    mongoose.models.MemoryDomain ||
    mongoose.model<IMemoryDomain>('MemoryDomain', memoryDomainSchema)
  );
}
