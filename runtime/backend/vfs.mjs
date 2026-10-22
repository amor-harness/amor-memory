import { createRequire } from 'node:module';
import mongoose from 'mongoose';
import { extractionMethods } from '../extraction/database.mjs';
import { readableStore, writableStore } from './memories.mjs';

const require = createRequire(import.meta.url);
const { Tokenizer } = require('@librechat/api');

async function defaultStore(userId) {
  const methods = await extractionMethods();
  return methods.ensureDefaultMemoryStore(userId);
}

async function readAccess({ userId, storeId }) {
  let access = await readableStore({ userId, storeId });
  if (!access && storeId == null) {
    await defaultStore(userId);
    access = await readableStore({ userId, storeId });
  }
  return access;
}

export async function vfsList({ userId, storeId }) {
  const access = await readAccess({ userId, storeId });
  if (!access) {
    return { memories: [] };
  }
  const methods = await extractionMethods();
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

export async function vfsDomains({ userId, storeId }) {
  const access = await readAccess({ userId, storeId });
  if (!access) {
    return { domains: [] };
  }
  const methods = await extractionMethods();
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

export async function vfsSet({ userId, key, value, allowLocked, storeId, domainId, conversationId }) {
  let access = await writableStore({ userId, storeId });
  if (!access && storeId == null) {
    await defaultStore(userId);
    access = await writableStore({ userId, storeId });
  }
  if (!access) {
    return { ok: false, reason: 'This run has no memory store.' };
  }
  const methods = await extractionMethods();
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

export async function vfsDelete({ userId, key, allowLocked, storeId }) {
  const access = await writableStore({ userId, storeId });
  if (!access) {
    return { ok: false, reason: 'This run has no memory store.' };
  }
  const methods = await extractionMethods();
  return methods.deleteMemory({
    userId: access.ownerId,
    key,
    storeId: String(access.store._id),
    allowLocked,
  });
}

export async function vfsImage({ userId, id, sha256, storeId }) {
  const access = await readAccess({ userId, storeId });
  if (!access) {
    return null;
  }
  const methods = await extractionMethods();
  return methods.getMemoryImage({
    userId: access.ownerId,
    storeId: String(access.store._id),
    id,
    sha256,
  });
}
