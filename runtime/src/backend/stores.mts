import mongoose from 'mongoose';
import { connectAppDb, models } from '../db.mjs';
import { requirePermission } from './memories.mjs';
import { deleteVectorsForStore, vectorsEnabled } from './vectors.mjs';
import imageStore from '../recall/imageStore.mjs';
import type {
  AclEntryRow,
  MemoryEntryRow,
  MemoryFailure,
  MemoryStoreRow,
  StoreStatsRow,
  UserNameRow,
} from './types.mjs';

type BackendModels = Awaited<ReturnType<typeof models>>;

/** The image-vector deletion the store teardown performs. */
interface ImageVectorStore {
  deleteImageVectorsForStore(params: { userId: string; storeId: string }): Promise<void>;
}

/** One store as the store list RPC returns it. */
interface StoreEntry {
  id: string;
  name: string;
  isDefault: boolean;
  isOwner: boolean;
  canWrite: boolean;
  accessLevel: 'owner' | 'editor' | 'viewer';
  memoryCount?: number;
  totalTokens?: number;
  updated_at?: Date;
  ownerName?: string;
  isShared?: boolean;
}

interface CreateStoreParams {
  userId?: string;
  role?: string;
  name: string;
}

interface RenameStoreParams {
  userId?: string;
  role?: string;
  storeId: string;
  name: string;
}

interface StoreMutationParams {
  userId?: string;
  role?: string;
  storeId: string;
}

const OWNER_BITS = 15;
const VIEW_BITS = 1;
const EDIT_BITS = 2;
const imageVectors = imageStore as ImageVectorStore;

function failure(status: number, error: string): MemoryFailure {
  return { ok: false, status, error };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const storeName = (name: string): string | null => {
  if (typeof name !== 'string' || name.trim() === '') {
    return 'Memory store name is required.';
  }
  if (name.trim().length > 100) {
    return 'Memory store name is too long.';
  }
  return null;
};

export async function createStore({
  userId,
  role,
  name,
}: CreateStoreParams): Promise<MemoryFailure | { ok: true; created: true; store: StoreEntry }> {
  await requirePermission({ userId, role, permissions: ['USE', 'CREATE'] });
  const error = storeName(name);
  if (error) {
    return failure(400, error);
  }
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(userId));
  const existing = (await db.MemoryStore.findOne({
    userId: user,
    name: name.trim(),
  }).lean()) as MemoryStoreRow | null;
  if (existing) {
    return failure(400, 'A memory store with that name already exists.');
  }
  const store = (await db.MemoryStore.create({
    userId: user,
    name: name.trim(),
  })) as MemoryStoreRow;
  return {
    ok: true,
    created: true,
    store: {
      id: String(store._id),
      name: store.name,
      isDefault: store.isDefault === true,
      isOwner: true,
      canWrite: true,
      accessLevel: 'owner',
      memoryCount: 0,
      totalTokens: 0,
      updated_at: store.updated_at,
    },
  };
}

export async function renameStore({
  userId,
  role,
  storeId,
  name,
}: RenameStoreParams): Promise<MemoryFailure | { ok: true; store: StoreEntry }> {
  await requirePermission({ userId, role, permissions: ['USE', 'UPDATE'] });
  const error = storeName(name);
  if (error) {
    return failure(400, error);
  }
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(userId));
  const store = (await db.MemoryStore.findOne({
    _id: storeId,
    userId: user,
  }).lean()) as MemoryStoreRow | null;
  if (!store) {
    return failure(404, 'Memory store not found.');
  }
  const conflict = (await db.MemoryStore.findOne({
    userId: user,
    name: name.trim(),
    _id: { $ne: store._id },
  }).lean()) as MemoryStoreRow | null;
  if (conflict) {
    return failure(400, 'A memory store with that name already exists.');
  }
  const updated = (await db.MemoryStore.findOneAndUpdate(
    { _id: store._id },
    { $set: { name: name.trim(), updated_at: new Date() } },
    { new: true },
  ).lean()) as MemoryStoreRow;
  return {
    ok: true,
    store: {
      id: String(updated._id),
      name: updated.name,
      isDefault: updated.isDefault === true,
      isOwner: true,
      canWrite: true,
      accessLevel: 'owner',
      updated_at: updated.updated_at,
    },
  };
}

async function purgeStore({
  db,
  userId,
  store,
}: {
  db: BackendModels;
  userId: mongoose.Types.ObjectId;
  store: MemoryStoreRow;
}): Promise<{ entries: Array<Pick<MemoryEntryRow, '_id' | 'key'>>; storeId: string }> {
  const storeId = String(store._id);
  const entries = (await db.MemoryEntry.find({ userId, storeId })
    .select('_id key')
    .lean()) as Array<Pick<MemoryEntryRow, '_id' | 'key'>>;
  await Promise.all([
    db.MemoryEntry.deleteMany({ userId, storeId }),
    db.MemoryVersion.deleteMany({ userId, storeId }),
    db.MemoryImage.deleteMany({ userId, storeId }),
    db.MemoryDomain.deleteMany({ userId, storeId }),
    db.ConversationMemory.deleteMany({ userId, storeId }),
  ]);
  return { entries, storeId };
}

export async function deleteStore({
  userId,
  role,
  storeId,
}: StoreMutationParams): Promise<MemoryFailure | { ok: true; deleted: true }> {
  await requirePermission({ userId, role, permissions: ['USE', 'UPDATE'] });
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(userId));
  const store = (await db.MemoryStore.findOne({
    _id: storeId,
    userId: user,
  }).lean()) as MemoryStoreRow | null;
  if (!store) {
    return failure(404, 'Memory store not found.');
  }
  if (store.isDefault === true) {
    return failure(403, 'The default memory store cannot be deleted.');
  }
  await purgeStore({ db, userId: user, store });
  await db.MemoryStore.deleteOne({ _id: store._id });
  const conn = await connectAppDb();
  await conn.collection('aclentries').deleteMany({
    resourceType: 'memoryStore',
    resourceId: store._id,
  });
  if (vectorsEnabled()) {
    await Promise.all([
      deleteVectorsForStore({ userId: String(userId), storeId: String(store._id) }).catch(
        (error: unknown) =>
          console.error('[memory-plugin] vector store cleanup failed:', errorMessage(error)),
      ),
      imageVectors
        .deleteImageVectorsForStore({ userId: String(userId), storeId: String(store._id) })
        .catch((error: unknown) =>
          console.error('[memory-plugin] image vector cleanup failed:', errorMessage(error)),
        ),
    ]);
  }
  return { ok: true, deleted: true };
}

export async function clearStore({
  userId,
  role,
  storeId,
}: StoreMutationParams): Promise<MemoryFailure | { ok: true; deleted: number }> {
  await requirePermission({ userId, role, permissions: ['USE', 'UPDATE'] });
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(userId));
  const store = (await db.MemoryStore.findOne({
    _id: storeId,
    userId: user,
  }).lean()) as MemoryStoreRow | null;
  if (!store) {
    return failure(404, 'Memory store not found.');
  }
  const { entries } = await purgeStore({ db, userId: user, store });
  if (vectorsEnabled()) {
    await Promise.all([
      deleteVectorsForStore({ userId: String(userId), storeId: String(store._id) }).catch(
        (error: unknown) =>
          console.error('[memory-plugin] vector store cleanup failed:', errorMessage(error)),
      ),
      imageVectors
        .deleteImageVectorsForStore({ userId: String(userId), storeId: String(store._id) })
        .catch((error: unknown) =>
          console.error('[memory-plugin] image vector cleanup failed:', errorMessage(error)),
        ),
    ]);
  }
  return { ok: true, deleted: entries.length };
}

/** The user's stores plus the ones shared with them, shaped for the panel. */
export async function listStores({
  userId,
  role,
}: {
  userId?: string;
  role?: string;
}): Promise<{ stores: StoreEntry[] }> {
  await requirePermission({ userId, role, permissions: ['USE', 'READ'] });
  const conn = await connectAppDb();
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(userId));
  const [owned, userAcl] = (await Promise.all([
    db.MemoryStore.find({ userId: user }).lean(),
    conn
      .collection('aclentries')
      .find({ resourceType: 'memoryStore', principalType: 'user', principalId: user })
      .toArray(),
  ])) as [MemoryStoreRow[], AclEntryRow[]];
  const ownedIds = new Set(owned.map((store) => String(store._id)));
  const sharedAcl = userAcl.filter((entry) => !ownedIds.has(String(entry.resourceId)));
  const shared = (await db.MemoryStore.find({
    _id: { $in: sharedAcl.map((entry) => entry.resourceId) },
  }).lean()) as MemoryStoreRow[];
  const aclByStore = new Map(sharedAcl.map((entry) => [String(entry.resourceId), entry]));
  const all = [...owned, ...shared];
  const ids = all.map((store) => store._id);
  const [counts, otherGrants] = (await Promise.all([
    db.MemoryEntry.aggregate([
      {
        $match: {
          userId: { $in: [...new Set(all.map((store) => store.userId))] },
          storeId: { $in: ids.map(String) },
        },
      },
      { $group: { _id: '$storeId', n: { $sum: 1 }, tokens: { $sum: '$tokenCount' } } },
    ]),
    conn
      .collection('aclentries')
      .find({
        resourceType: 'memoryStore',
        resourceId: { $in: ids },
        $or: [
          { principalType: 'public' },
          { principalType: 'user', principalId: { $ne: user } },
          { principalType: 'group' },
        ],
      })
      .project({ resourceId: 1 })
      .toArray(),
  ])) as [StoreStatsRow[], AclEntryRow[]];
  const stats = new Map(counts.map((row) => [row._id ?? '', row]));
  const sharedWithOthers = new Set(otherGrants.map((entry) => String(entry.resourceId)));
  const ownerIds = [...new Set(shared.map((store) => String(store.userId)))];
  const owners =
    ownerIds.length === 0
      ? []
      : ((await conn
          .collection('users')
          .find({ _id: { $in: ownerIds.map((id) => new mongoose.Types.ObjectId(id)) } })
          .project({ name: 1 })
          .toArray()) as UserNameRow[]);
  const ownerNames = new Map(owners.map((owner) => [String(owner._id), owner.name]));
  return {
    stores: all.map((store) => {
      const id = String(store._id);
      const isOwner = ownedIds.has(id);
      const acl = aclByStore.get(id);
      const bits = isOwner ? OWNER_BITS : (acl?.permBits ?? VIEW_BITS);
      const canWrite = isOwner || (bits & EDIT_BITS) !== 0;
      return {
        id,
        name: store.name,
        isDefault: store.isDefault === true,
        isOwner,
        ...(isOwner ? {} : { ownerName: ownerNames.get(String(store.userId)) }),
        canWrite,
        accessLevel: isOwner ? 'owner' : canWrite ? 'editor' : 'viewer',
        isShared: !isOwner || sharedWithOthers.has(id),
        memoryCount: stats.get(id)?.n ?? 0,
        totalTokens: stats.get(id)?.tokens ?? 0,
        updated_at: store.updated_at,
      };
    }),
  };
}
