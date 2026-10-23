import { createRequire } from 'node:module';
import { extractionMethods } from '../extraction/database.mjs';
import { readableStore, writableStore } from './memories.mjs';
import type {
  MemoryDomainRow,
  MemoryImageRow,
  MemoryStoreAccess,
  MemoryStoreRow,
} from './types.mjs';

const require = createRequire(import.meta.url);
const { Tokenizer } = require('@amor-harness/api') as {
  Tokenizer: { getTokenCount(value: string, encoding: string): number };
};

/** One memory row as VFS list reads it. */
interface VfsMemoryRow {
  key: string;
  value: string;
  domainId?: string | null;
  updated_at?: Date;
  stable?: boolean;
  tags?: string[];
}

/** The result of a VFS set. */
interface VfsSetResult {
  ok: boolean;
  reason?: string;
  domainId?: string;
  created?: boolean;
}

/** The result of a VFS delete. */
interface VfsDeleteResult {
  ok: boolean;
  reason?: string;
}

/** The extraction-data-layer methods the VFS surface consumes. */
interface VfsMethods {
  ensureDefaultMemoryStore(userId?: string): Promise<MemoryStoreRow>;
  getUserMemories(params: { userId: string; storeId: string }): Promise<VfsMemoryRow[]>;
  listMemoryDomains(params: { storeId: string }): Promise<MemoryDomainRow[]>;
  setMemory(params: {
    userId: string;
    key: string;
    value: string;
    tokenCount: number;
    storeId: string;
    allowLocked?: boolean;
    domainId?: string;
  }): Promise<VfsSetResult | null>;
  setConversationMemory(params: {
    userId: string;
    conversationId: string;
    storeId: string;
    domainId?: string;
    created?: boolean;
    key: string;
  }): Promise<{ ok: boolean }>;
  deleteMemory(params: {
    userId: string;
    key: string;
    storeId: string;
    allowLocked?: boolean;
  }): Promise<VfsDeleteResult>;
  getMemoryImage(params: {
    userId: string;
    storeId: string;
    id?: number;
    sha256?: string;
  }): Promise<MemoryImageRow | null>;
}

async function defaultStore(userId?: string): Promise<MemoryStoreRow> {
  const methods = (await extractionMethods()) as VfsMethods;
  return methods.ensureDefaultMemoryStore(userId);
}

async function readAccess({
  userId,
  storeId,
}: {
  userId?: string;
  storeId?: string;
}): Promise<MemoryStoreAccess | null> {
  let access = await readableStore({ userId, storeId });
  if (!access && storeId == null) {
    await defaultStore(userId);
    access = await readableStore({ userId, storeId });
  }
  return access;
}

export async function vfsList({
  userId,
  storeId,
}: {
  userId?: string;
  storeId?: string;
}): Promise<{ memories: VfsMemoryRow[] }> {
  const access = await readAccess({ userId, storeId });
  if (!access) {
    return { memories: [] };
  }
  const methods = (await extractionMethods()) as VfsMethods;
  const rows = await methods.getUserMemories({
    userId: access.ownerId,
    storeId: String(access.store._id),
  });
  return {
    memories: rows.map((row) => ({
      key: row.key,
      value: row.value,
      ...(row.domainId != null ? { domainId: row.domainId } : {}),
      ...(row.updated_at != null ? { updated_at: row.updated_at } : {}),
      ...(row.stable != null ? { stable: row.stable } : {}),
      ...(Array.isArray(row.tags) && row.tags.length > 0 ? { tags: row.tags } : {}),
    })),
  };
}

export async function vfsDomains({
  userId,
  storeId,
}: {
  userId?: string;
  storeId?: string;
}): Promise<{ domains: Array<{ id: string; name: string; kind: string; isDefault: boolean }> }> {
  const access = await readAccess({ userId, storeId });
  if (!access) {
    return { domains: [] };
  }
  const methods = (await extractionMethods()) as VfsMethods;
  const rows = await methods.listMemoryDomains({ storeId: String(access.store._id) });
  return {
    domains: rows.map((domain) => ({
      id: String(domain._id),
      name: domain.name,
      kind: domain.kind,
      isDefault: domain.isDefault === true,
    })),
  };
}

export async function vfsSet({
  userId,
  key,
  value,
  allowLocked,
  storeId,
  domainId,
  conversationId,
}: {
  userId?: string;
  key: string;
  value: string;
  allowLocked?: boolean;
  storeId?: string;
  domainId?: string;
  conversationId?: string;
}): Promise<VfsSetResult | null> {
  let access = await writableStore({ userId, storeId });
  if (!access && storeId == null) {
    await defaultStore(userId);
    access = await writableStore({ userId, storeId });
  }
  if (!access) {
    return { ok: false, reason: 'This run has no memory store.' };
  }
  const methods = (await extractionMethods()) as VfsMethods;
  const ownerId = access.ownerId;
  const resolvedStoreId = String(access.store._id);
  const result = await methods.setMemory({
    userId: ownerId,
    key,
    value,
    tokenCount: Tokenizer.getTokenCount(value, 'o200k_base'),
    storeId: resolvedStoreId,
    allowLocked,
    ...(domainId != null ? { domainId } : {}),
  });
  if (result?.ok && conversationId) {
    await methods
      .setConversationMemory({
        userId: ownerId,
        conversationId,
        storeId: resolvedStoreId,
        domainId: result.domainId ?? domainId,
        created: result.created,
        key,
      })
      .catch(() => undefined);
  }
  return result;
}

export async function vfsDelete({
  userId,
  key,
  allowLocked,
  storeId,
}: {
  userId?: string;
  key: string;
  allowLocked?: boolean;
  storeId?: string;
}): Promise<VfsDeleteResult> {
  const access = await writableStore({ userId, storeId });
  if (!access) {
    return { ok: false, reason: 'This run has no memory store.' };
  }
  const methods = (await extractionMethods()) as VfsMethods;
  return methods.deleteMemory({
    userId: access.ownerId,
    key,
    storeId: String(access.store._id),
    allowLocked,
  });
}

export async function vfsImage({
  userId,
  id,
  sha256,
  storeId,
}: {
  userId?: string;
  id?: number;
  sha256?: string;
  storeId?: string;
}): Promise<MemoryImageRow | null> {
  const access = await readAccess({ userId, storeId });
  if (!access) {
    return null;
  }
  const methods = (await extractionMethods()) as VfsMethods;
  return methods.getMemoryImage({
    userId: access.ownerId,
    storeId: String(access.store._id),
    id,
    sha256,
  });
}
