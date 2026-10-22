import type { Model } from 'mongoose';
import { createMemoryModel } from './model/memory';
import { createMemoryStoreModel } from './model/memoryStore';
import { createMemoryDomainModel } from './model/memoryDomain';
import { createMemoryImageModel } from './model/memoryImage';
import { createConversationMemoryModel } from './model/conversationMemory';
import { createMemoryVersionModel } from './model/memoryVersion';

export function createMemoryModels(mongoose: typeof import('mongoose')): {
  MemoryEntry: Model<unknown>;
  MemoryStore: Model<unknown>;
  MemoryDomain: Model<unknown>;
  MemoryImage: Model<unknown>;
  ConversationMemory: Model<unknown>;
  MemoryVersion: Model<unknown>;
} {
  return {
    MemoryEntry: createMemoryModel(mongoose),
    MemoryStore: createMemoryStoreModel(mongoose),
    MemoryDomain: createMemoryDomainModel(mongoose),
    MemoryImage: createMemoryImageModel(mongoose),
    ConversationMemory: createConversationMemoryModel(mongoose),
    MemoryVersion: createMemoryVersionModel(mongoose),
  };
}
