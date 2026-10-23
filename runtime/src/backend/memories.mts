import mongoose from 'mongoose';
import { models, connectAppDb } from '../db.mjs';
import type {
  AclEntryRow,
  AppRoleRow,
  MemoryEntryRow,
  MemoryPermissionBits,
  MemoryStoreAccess,
  MemoryStoreRow,
  StoreStatsRow,
} from './types.mjs';

export type {
  MemoryDomainRow,
  MemoryEntryRow,
  MemoryImageRow,
  MemoryStoreRow,
  StoreStatsRow,
} from './types.mjs';

/** The permission bits a memory role may carry. */
export type MemoryPermission = 'USE' | 'CREATE' | 'UPDATE' | 'READ' | 'OPT_OUT' | 'SHARE';

/** The result of one memory-list read. */
export interface MemoryListResult {
  storeId: string;
  canWrite: boolean;
  memories: MemoryListEntry[];
  totalTokens: number;
}

/** One memory as the panel and RPC list surface consume it. */
export interface MemoryListEntry {
  key: string;
  value: string;
  content: string;
  tags: string[];
  domainId?: string;
  tokenCount: number;
  stable: boolean;
  injection: 'system' | 'additional';
  locked: boolean;
  updated_at?: Date;
  lastRecalledAt?: Date;
}

/** One store in the owned-store inventory. */
export interface StoreListEntry {
  id: string;
  name: string;
  isDefault: boolean;
  isOwner: boolean;
  canWrite: boolean;
  memoryCount: number;
  totalTokens: number;
  updated_at?: Date;
}

/** The role's memory permission bits, read from the app's roles collection. */
export async function roleMemoryPermissions({
  role,
}: {
  role?: string;
}): Promise<MemoryPermissionBits | null> {
  if (!role) {
    return null;
  }
  const conn = await connectAppDb();
  const doc = (await conn.collection('roles').findOne({ name: String(role) })) as AppRoleRow | null;
  if (!doc) {
    return null;
  }
  return doc.permissions?.MEMORIES ?? doc.MEMORIES ?? {};
}

export async function requirePermission({
  userId,
  role,
  permissions = ['USE'],
}: {
  userId?: string;
  role?: string;
  permissions?: MemoryPermission[];
}): Promise<void> {
  if (!userId) {
    throw Object.assign(new Error('AUTH_REQUIRED'), { status: 401 });
  }
  const bits = await roleMemoryPermissions({ role });
  if (!bits) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
  for (const permission of permissions) {
    if (bits[permission] !== true) {
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    }
  }
}

export function stripTags(value: string | null | undefined): string {
  return String(value ?? '')
    .split('\n')
    .filter((line) => !/^tags:\s*/.test(line.trim()))
    .join('\n')
    .trimEnd();
}

export function tagsOf(entry: Pick<MemoryEntryRow, 'tags' | 'value'>): string[] {
  if (Array.isArray(entry.tags) && entry.tags.length > 0) {
    return entry.tags;
  }
  const line = String(entry.value ?? '')
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

export async function ownedStore({
  userId,
  storeId,
}: {
  userId?: string;
  storeId?: string;
}): Promise<MemoryStoreRow | null> {
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(userId));
  if (storeId) {
    return (await db.MemoryStore.findOne({
      _id: storeId,
      userId: user,
    }).lean()) as MemoryStoreRow | null;
  }
  return ((await db.MemoryStore.findOne({ userId: user, isDefault: true }).lean()) ??
    (await db.MemoryStore.findOne({ userId: user })
      .sort({ created_at: 1 })
      .lean())) as MemoryStoreRow | null;
}

/** One store's entries, shaped like the memory list RPC returns. */
export async function listOwnedMemories({
  userId,
  role,
  storeId,
}: {
  userId?: string;
  role?: string;
  storeId?: string;
}): Promise<MemoryListResult | { error: 404 }> {
  await requirePermission({ userId, role, permissions: ['USE', 'READ'] });
  const access = await readableStore({ userId, storeId });
  if (!access) {
    return { error: 404 };
  }
  const store = access.store;
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(access.ownerId));
  const rows = (await db.MemoryEntry.find({ userId: user, storeId: String(store._id) })
    .sort({ updated_at: -1 })
    .lean()) as MemoryEntryRow[];
  let totalTokens = 0;
  const memories: MemoryListEntry[] = rows.map((entry) => {
    totalTokens += entry.tokenCount ?? 0;
    const tags = tagsOf(entry);
    return {
      key: entry.key,
      value: entry.value,
      content: stripTags(entry.value),
      tags,
      ...(entry.domainId ? { domainId: entry.domainId } : {}),
      tokenCount: entry.tokenCount ?? 0,
      stable: entry.stable === true,
      injection: entry.injection === 'additional' ? 'additional' : 'system',
      locked: entry.locked === true,
      ...(entry.updated_at ? { updated_at: entry.updated_at } : {}),
      ...(entry.lastRecalledAt ? { lastRecalledAt: entry.lastRecalledAt } : {}),
    };
  });
  const writable =
    access.isOwner || (await writableStore({ userId, storeId: String(store._id) })) != null;
  return {
    storeId: String(store._id),
    canWrite: writable,
    memories,
    totalTokens,
  };
}

/** The user's own stores with counts and token sums. */
export async function listOwnedStores({
  userId,
  role,
}: {
  userId?: string;
  role?: string;
}): Promise<{ stores: StoreListEntry[] }> {
  await requirePermission({ userId, role, permissions: ['USE', 'READ'] });
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(userId));
  const stores = (await db.MemoryStore.find({ userId: user }).lean()) as MemoryStoreRow[];
  const counts = (await db.MemoryEntry.aggregate([
    { $match: { userId: user } },
    {
      $group: {
        _id: '$storeId',
        n: { $sum: 1 },
        tokens: { $sum: '$tokenCount' },
      },
    },
  ])) as StoreStatsRow[];
  const byStore = new Map(counts.map((row) => [row._id ?? '', row]));
  return {
    stores: stores.map((store) => ({
      id: String(store._id),
      name: store.name,
      isDefault: store.isDefault === true,
      isOwner: true,
      canWrite: true,
      memoryCount: byStore.get(String(store._id))?.n ?? 0,
      totalTokens: byStore.get(String(store._id))?.tokens ?? 0,
      updated_at: store.updated_at,
    })),
  };
}

/** A store the caller can read: their own, or one shared through the ACL. */
export async function readableStore({
  userId,
  storeId,
}: {
  userId?: string;
  storeId?: string;
}): Promise<MemoryStoreAccess | null> {
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(userId));
  const own = (
    storeId
      ? await db.MemoryStore.findOne({ _id: storeId, userId: user }).lean()
      : await db.MemoryStore.findOne({ userId: user, isDefault: true }).lean()
  ) as MemoryStoreRow | null;
  if (own) {
    return { store: own, ownerId: String(userId), isOwner: true };
  }
  if (!storeId) {
    return null;
  }
  const store = (await db.MemoryStore.findById(storeId).lean()) as MemoryStoreRow | null;
  if (!store) {
    return null;
  }
  const conn = await connectAppDb();
  const acl = (await conn.collection('aclentries').findOne({
    resourceType: 'memoryStore',
    resourceId: new mongoose.Types.ObjectId(String(storeId)),
    permBits: { $bitsAllSet: 1 },
    $or: [{ principalType: 'user', principalId: user }, { principalType: 'public' }],
  })) as AclEntryRow | null;
  if (!acl) {
    return null;
  }
  return { store, ownerId: String(store.userId), isOwner: String(store.userId) === String(userId) };
}

/** A store the caller can write: owner, or a shared grant with EDIT. */
export async function writableStore({
  userId,
  storeId,
}: {
  userId?: string;
  storeId?: string;
}): Promise<MemoryStoreAccess | null> {
  const access = await readableStore({ userId, storeId });
  if (!access) {
    return null;
  }
  if (access.isOwner) {
    return access;
  }
  const conn = await connectAppDb();
  const entry = (await conn.collection('aclentries').findOne({
    resourceType: 'memoryStore',
    resourceId: new mongoose.Types.ObjectId(String(access.store._id)),
    principalType: 'user',
    principalId: new mongoose.Types.ObjectId(String(userId)),
    permBits: { $bitsAllSet: 2 },
  })) as AclEntryRow | null;
  return entry == null ? null : access;
}
