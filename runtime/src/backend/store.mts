import { extractionMethods } from '../extraction/database.mjs';
import { readableStore, writableStore } from './memories.mjs';
import type { MemoryStoreRow } from './types.mjs';

/** The store/formatting methods the extraction data layer exposes. */
interface StoreMethods {
  ensureDefaultMemoryStore(userId: string): Promise<MemoryStoreRow>;
  getFormattedMemories(params: {
    userId: string;
    storeId?: string;
    domainIds?: string[];
    excludeConversationId?: string;
    timezone?: string;
  }): Promise<FormattedMemories>;
}

interface FormattedMemories {
  withKeys: string;
  withoutKeys: string;
  totalTokens?: number;
}

/** The store identity and write capability returned to VFS callers. */
export interface StoreResolution {
  storeId: string;
  ownerId: string;
  canWrite: boolean;
}

export async function resolveStore({
  userId,
  storeId,
}: {
  userId?: string;
  storeId?: string;
}): Promise<StoreResolution | null> {
  const access = await readableStore({ userId, storeId });
  if (!access) {
    return null;
  }
  const writable = await writableStore({ userId, storeId });
  return {
    storeId: String(access.store._id),
    ownerId: String(access.ownerId),
    canWrite: writable != null,
  };
}

export async function defaultStore({ userId }: { userId: string }): Promise<StoreResolution> {
  const methods = (await extractionMethods()) as StoreMethods;
  const store = await methods.ensureDefaultMemoryStore(userId);
  return {
    storeId: String(store._id),
    ownerId: String(userId),
    canWrite: true,
  };
}

export async function formattedMemories({
  userId,
  storeId,
  domainIds,
  excludeConversationId,
  timezone,
}: {
  userId: string;
  storeId?: string;
  domainIds?: string[];
  excludeConversationId?: string;
  timezone?: string;
}): Promise<FormattedMemories> {
  const methods = (await extractionMethods()) as StoreMethods;
  return methods.getFormattedMemories({
    userId,
    storeId,
    ...(Array.isArray(domainIds) ? { domainIds } : {}),
    ...(excludeConversationId != null ? { excludeConversationId } : {}),
    ...(timezone != null ? { timezone } : {}),
  });
}
