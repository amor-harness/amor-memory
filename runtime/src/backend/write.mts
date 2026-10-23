import mongoose from 'mongoose';
import { models } from '../db.mjs';
import { memoryEnv } from './config.mjs';
import { countTokens } from './tokens.mjs';
import { dropEntryVector, syncEntryVector } from './vectors.mjs';
import { writableStore, requirePermission, stripTags } from './memories.mjs';
import { resetLexicalIndexes } from '../recall/lexical.mjs';
import type { MemoryDomainRow, MemoryEntryRow, MemoryFailure } from './types.mjs';

const KEY_PATTERN = /^[a-z0-9_]+$/;

type BackendModels = Awaited<ReturnType<typeof models>>;

/** The plain entry document returned after a create. */
type CreatedEntry = MemoryEntryRow & {
  toObject(): MemoryEntryRow;
};

/** One memory as the write RPC returns it. */
interface WrittenMemory extends MemoryEntryRow {
  content: string;
}

interface CreateMemoryParams {
  userId?: string;
  role?: string;
  storeId?: string;
  key: string;
  value: string;
  domainId?: string;
  stable?: boolean;
  injection?: string;
  locked?: boolean;
  conversationId?: string;
}

interface UpdateMemoryParams {
  userId?: string;
  role?: string;
  storeId?: string;
  key: string;
  newKey?: string;
  value?: string;
  domainId?: string;
  stable?: boolean;
  injection?: string;
  locked?: boolean;
}

interface DeleteMemoryParams {
  userId?: string;
  role?: string;
  storeId?: string;
  key: string;
}

function charLimit(): number {
  return Number(memoryEnv('MEMORY_CHAR_LIMIT') || 10000);
}

function parseTags(value: string): string[] {
  const line = String(value)
    .split('\n')
    .reverse()
    .find((candidate) => /^tags:\s*/.test(candidate.trim()));
  if (!line) {
    return [];
  }
  return line
    .replace(/^tags:\s*/, '')
    .split('|')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function fail(status: number, error: string): MemoryFailure {
  return { ok: false, status, error };
}

async function ensureDomain({
  db,
  userId,
  storeId,
  domainId,
}: {
  db: BackendModels;
  userId?: string;
  storeId: string;
  domainId?: string;
}): Promise<string | null> {
  if (domainId) {
    const domain = (await db.MemoryDomain.findOne({
      _id: domainId,
      storeId,
    }).lean()) as MemoryDomainRow | null;
    if (!domain) {
      return null;
    }
    return String(domain._id);
  }
  const existing = (await db.MemoryDomain.findOne({
    storeId,
    isDefault: true,
  }).lean()) as MemoryDomainRow | null;
  if (existing) {
    return String(existing._id);
  }
  const user = new mongoose.Types.ObjectId(String(userId));
  const created = (await db.MemoryDomain.create({
    userId: user,
    storeId,
    name: 'Default',
    kind: 'real',
    isDefault: true,
    createdBy: 'user',
  })) as MemoryDomainRow;
  return String(created._id);
}

function validateKey(key: string): string | null {
  if (typeof key !== 'string' || key.trim() === '') {
    return 'Memory key is required.';
  }
  if (!KEY_PATTERN.test(key.trim())) {
    return 'Key must only contain lowercase letters, numbers, and underscores';
  }
  return null;
}

export async function createMemory({
  userId,
  role,
  storeId,
  key,
  value,
  domainId,
  stable = false,
  injection = 'system',
  locked = false,
  conversationId,
}: CreateMemoryParams): Promise<
  MemoryFailure | { ok: true; created: true; memory: WrittenMemory }
> {
  await requirePermission({ userId, role, permissions: ['USE', 'CREATE'] });
  const keyError = validateKey(key);
  if (keyError) {
    return fail(400, keyError);
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return fail(400, 'Memory value is required.');
  }
  if (value.length > charLimit()) {
    return fail(400, `Memory value exceeds the ${charLimit()} character limit.`);
  }
  const access = await writableStore({ userId, storeId });
  if (!access) {
    return fail(404, 'Memory store not found.');
  }
  const store = access.store;
  const ownerId = access.ownerId;
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(ownerId));
  const resolvedStoreId = String(store._id);
  const existing = (await db.MemoryEntry.findOne({
    userId: user,
    storeId: resolvedStoreId,
    key: key.trim(),
  }).lean()) as MemoryEntryRow | null;
  if (existing) {
    return fail(400, 'Memory with this key already exists.');
  }
  const resolvedDomain = await ensureDomain({ db, userId, storeId: resolvedStoreId, domainId });
  if (resolvedDomain == null) {
    return fail(400, 'Memory domain not found.');
  }
  const tags = parseTags(value);
  const tokenCount = countTokens(value);
  const entry = (await db.MemoryEntry.create({
    userId: user,
    key: key.trim(),
    value,
    tags,
    storeId: resolvedStoreId,
    domainId: resolvedDomain,
    tokenCount,
    stable: stable === true,
    injection: injection === 'additional' ? 'additional' : 'system',
    locked: locked === true,
    updated_at: new Date(),
  })) as CreatedEntry;
  await db.MemoryVersion.create({
    userId: user,
    memoryId: String(entry._id),
    key: entry.key,
    value,
    tags,
    storeId: resolvedStoreId,
    domainId: resolvedDomain,
    tokenCount,
    stable: entry.stable,
    injection: entry.injection,
    locked: entry.locked,
  });
  await syncEntryVector(entry.toObject());
  resetLexicalIndexes();
  if (conversationId) {
    await db.ConversationMemory.updateOne(
      { userId: user, conversationId, key: entry.key },
      {
        $set: {
          storeId: resolvedStoreId,
          domainId: resolvedDomain,
          source: 'extracted',
          createdByConversation: true,
          key: entry.key,
          updated_at: new Date(),
        },
        $setOnInsert: { recallCount: 0 },
      },
      { upsert: true },
    );
  }
  return {
    ok: true,
    created: true,
    memory: {
      ...entry.toObject(),
      tags,
      content: stripTags(entry.value),
      injection: entry.injection,
    },
  };
}

export async function updateMemory({
  userId,
  role,
  storeId,
  key,
  newKey,
  value,
  domainId,
  stable,
  injection,
  locked,
}: UpdateMemoryParams): Promise<
  MemoryFailure | { ok: true; updated: true; memory: WrittenMemory }
> {
  await requirePermission({ userId, role, permissions: ['USE', 'UPDATE'] });
  const access = await writableStore({ userId, storeId });
  if (!access) {
    return fail(404, 'Memory store not found.');
  }
  const store = access.store;
  const ownerId = access.ownerId;
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(ownerId));
  const resolvedStoreId = String(store._id);
  const existing = (await db.MemoryEntry.findOne({
    userId: user,
    storeId: resolvedStoreId,
    key,
  }).lean()) as MemoryEntryRow | null;
  if (!existing) {
    return fail(404, 'Memory not found.');
  }
  const nextKey = typeof newKey === 'string' && newKey.trim() !== '' ? newKey.trim() : existing.key;
  if (nextKey !== existing.key) {
    const conflict = (await db.MemoryEntry.findOne({
      userId: user,
      storeId: resolvedStoreId,
      key: nextKey,
    }).lean()) as MemoryEntryRow | null;
    if (conflict) {
      return fail(409, 'Memory with this key already exists.');
    }
  }
  const nextValue = typeof value === 'string' && value.trim() !== '' ? value : existing.value;
  if (nextValue.length > charLimit()) {
    return fail(400, `Memory value exceeds the ${charLimit()} character limit.`);
  }
  const nextTags = parseTags(nextValue);
  const update = {
    key: nextKey,
    value: nextValue,
    tags: nextTags,
    tokenCount: countTokens(nextValue),
    ...(stable !== undefined ? { stable: stable === true } : {}),
    ...(injection !== undefined
      ? { injection: injection === 'additional' ? 'additional' : 'system' }
      : {}),
    ...(locked !== undefined ? { locked: locked === true } : {}),
    ...(domainId !== undefined ? { domainId } : {}),
    updated_at: new Date(),
  };
  const updated = (await db.MemoryEntry.findOneAndUpdate(
    { _id: existing._id },
    { $set: update },
    { new: true },
  ).lean()) as MemoryEntryRow;
  await db.MemoryVersion.create({
    userId: user,
    memoryId: String(existing._id),
    key: updated.key,
    value: updated.value,
    tags: nextTags,
    storeId: resolvedStoreId,
    domainId: updated.domainId,
    tokenCount: updated.tokenCount,
    stable: updated.stable,
    injection: updated.injection,
    locked: updated.locked,
  });
  await syncEntryVector(updated);
  resetLexicalIndexes();
  return {
    ok: true,
    updated: true,
    memory: { ...updated, content: stripTags(updated.value) },
  };
}

export async function deleteMemory({
  userId,
  role,
  storeId,
  key,
}: DeleteMemoryParams): Promise<MemoryFailure | { ok: true; deleted: true }> {
  await requirePermission({ userId, role, permissions: ['USE', 'UPDATE'] });
  const access = await writableStore({ userId, storeId });
  if (!access) {
    return fail(404, 'Memory store not found.');
  }
  const store = access.store;
  const ownerId = access.ownerId;
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(ownerId));
  const entry = (await db.MemoryEntry.findOneAndDelete({
    userId: user,
    storeId: String(store._id),
    key,
  }).lean()) as MemoryEntryRow | null;
  if (!entry) {
    return fail(404, 'Memory not found.');
  }
  await db.MemoryVersion.deleteMany({ userId: user, memoryId: String(entry._id) });
  await dropEntryVector(entry);
  resetLexicalIndexes();
  return { ok: true, deleted: true };
}
