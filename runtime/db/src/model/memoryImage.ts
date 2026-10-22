import { Model } from 'mongoose';
import type { IMemoryImage } from '../../types/memoryImage';
import { applyTenantIsolation } from './tenantIsolation';
import memoryImageSchema from '../schema/memoryImage';

export function createMemoryImageModel(
  mongoose: typeof import('mongoose'),
): Model<IMemoryImage> {
  applyTenantIsolation(memoryImageSchema);
  return (
    mongoose.models.MemoryImage ||
    mongoose.model<IMemoryImage>('MemoryImage', memoryImageSchema)
  );
}
