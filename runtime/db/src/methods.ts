import { createMemoryMethods } from './method/memory';
import { createMemoryStoreMethods } from './method/memoryStore';
import { createMemoryDomainMethods } from './method/memoryDomain';
import { createMemoryImageMethods } from './method/memoryImage';
import { createMemoryVersionMethods } from './method/memoryVersion';

export function createMemoryMethodSet(
  mongoose: typeof import('mongoose'),
  deps: Parameters<typeof createMemoryStoreMethods>[1],
) {
  return {
    ...createMemoryMethods(mongoose),
    ...createMemoryStoreMethods(mongoose, deps),
    ...createMemoryDomainMethods(mongoose),
    ...createMemoryImageMethods(mongoose),
    ...createMemoryVersionMethods(mongoose),
  };
}

export * from './method/memoryTags';
export * from './method/memorySections';
export { onMemoryChange, emitMemoryChange } from './memoryEvents';
export { formatMemoryTime, memoryTimeField } from './util/memoryTime';
