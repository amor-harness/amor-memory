import mongoose from 'mongoose';
import { connectDb, models } from '../db.mjs';
import { requirePermission } from './memories.mjs';
import { deleteVectorsForStore } from './vectors.mjs';
import imageStore from '../recall/imageStore.mjs';
import { memoryEnv } from './config.mjs';

const OWNER_BITS = 15;


const storeName = (name) => {
  if (typeof name !== 'string' || name.trim() === '') {
    return 'Memory store name is required.';
  }
  if (name.trim().length > 100) {
    return 'Memory store name is too long.';
  }
  return null;
};

export async function createStore({ userId, role, name }) {
  await requirePermission({ userId, role, permissions: ['USE', 'CREATE'] });
  const error = storeName(name);
  if (error) {
    return { ok: false, status: 400, error };
  }
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(userId));
  const existing = await db.MemoryStore.findOne({ userId: user, name: name.trim() }).lean();
  if (existing) {
    return { ok: false, status: 400, error: 'A memory store with that name already exists.' };
  }
  const store = await db.MemoryStore.create({ userId: user, name: name.trim() });
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

export async function renameStore({ userId, role, storeId, name }) {
  await requirePermission({ userId, role, permissions: ['USE', 'UPDATE'] });
  const error = storeName(name);
  if (error) {
    return { ok: false, status: 400, error };
  }
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(userId));
  const store = await db.MemoryStore.findOne({ _id: storeId, userId: user }).lean();
  if (!store) {
    return { ok: false, status: 404, error: 'Memory store not found.' };
  }
  const conflict = await db.MemoryStore.findOne({
    userId: user,
    name: name.trim(),
    _id: { $ne: store._id },
  }).lean();
  if (conflict) {
    return { ok: false, status: 400, error: 'A memory store with that name already exists.' };
  }
  const updated = await db.MemoryStore.findOneAndUpdate(
    { _id: store._id },
    { $set: { name: name.trim(), updated_at: new Date() } },
    { new: true },
  ).lean();
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

async function purgeStore({ db, userId, store }) {
  const storeId = String(store._id);
  const entries = await db.MemoryEntry.find({ userId, storeId }).select('_id key').lean();
  await Promise.all([
    db.MemoryEntry.deleteMany({ userId, storeId }),
    db.MemoryVersion.deleteMany({ userId, storeId }),
    db.MemoryImage.deleteMany({ userId, storeId }),
    db.MemoryDomain.deleteMany({ userId, storeId }),
    db.ConversationMemory.deleteMany({ userId, storeId }),
  ]);
  return { entries, storeId };
}

export async function deleteStore({ userId, role, storeId }) {
  await requirePermission({ userId, role, permissions: ['USE', 'UPDATE'] });
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(userId));
  const store = await db.MemoryStore.findOne({ _id: storeId, userId: user }).lean();
  if (!store) {
    return { ok: false, status: 404, error: 'Memory store not found.' };
  }
  if (store.isDefault === true) {
    return { ok: false, status: 403, error: 'The default memory store cannot be deleted.' };
  }
  await purgeStore({ db, userId: user, store });
  await db.MemoryStore.deleteOne({ _id: store._id });
  const conn = await connectDb();
  await conn.collection('aclentries').deleteMany({
    resourceType: 'memoryStore',
    resourceId: store._id,
  });
  if (memoryEnv('MEMORY_PG_HOST')) {
    await Promise.all([
      deleteVectorsForStore({ userId, storeId: String(store._id) }).catch((error) =>
        console.error('[memory-plugin] vector store cleanup failed:', error.message),
      ),
      imageStore
        .deleteImageVectorsForStore({ userId, storeId: String(store._id) })
        .catch((error) => console.error('[memory-plugin] image vector cleanup failed:', error.message)),
    ]);
  }
  return { ok: true, deleted: true };
}

export async function clearStore({ userId, role, storeId }) {
  await requirePermission({ userId, role, permissions: ['USE', 'UPDATE'] });
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(userId));
  const store = await db.MemoryStore.findOne({ _id: storeId, userId: user }).lean();
  if (!store) {
    return { ok: false, status: 404, error: 'Memory store not found.' };
  }
  const { entries } = await purgeStore({ db, userId: user, store });
  if (memoryEnv('MEMORY_PG_HOST')) {
    await Promise.all([
      deleteVectorsForStore({ userId, storeId: String(store._id) }).catch((error) =>
        console.error('[memory-plugin] vector store cleanup failed:', error.message),
      ),
      imageStore
        .deleteImageVectorsForStore({ userId, storeId: String(store._id) })
        .catch((error) => console.error('[memory-plugin] image vector cleanup failed:', error.message)),
    ]);
  }
  return { ok: true, deleted: entries.length };
}

const VIEW_BITS = 1;
const EDIT_BITS = 2;

/** The user's stores plus the ones shared with them, shaped for the panel. */
export async function listStores({ userId, role }) {
  await requirePermission({ userId, role, permissions: ['USE', 'READ'] });
  const conn = await connectDb();
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(userId));
  const [owned, userAcl] = await Promise.all([
    db.MemoryStore.find({ userId: user }).lean(),
    conn
      .collection('aclentries')
      .find({ resourceType: 'memoryStore', principalType: 'user', principalId: user })
      .toArray(),
  ]);
  const ownedIds = new Set(owned.map((store) => String(store._id)));
  const sharedAcl = userAcl.filter((entry) => !ownedIds.has(String(entry.resourceId)));
  const shared = await db.MemoryStore.find({
    _id: { $in: sharedAcl.map((entry) => entry.resourceId) },
  }).lean();
  const aclByStore = new Map(sharedAcl.map((entry) => [String(entry.resourceId), entry]));
  const all = [...owned, ...shared];
  const ids = all.map((store) => store._id);
  const [counts, otherGrants] = await Promise.all([
    db.MemoryEntry.aggregate([
      { $match: { userId: { $in: [...new Set(all.map((store) => store.userId))] }, storeId: { $in: ids.map(String) } } },
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
  ]);
  const stats = new Map(counts.map((row) => [row._id ?? '', row]));
  const sharedWithOthers = new Set(otherGrants.map((entry) => String(entry.resourceId)));
  const ownerIds = [...new Set(shared.map((store) => String(store.userId)))];
  const owners =
    ownerIds.length === 0
      ? []
      : await conn
          .collection('users')
          .find({ _id: { $in: ownerIds.map((id) => new mongoose.Types.ObjectId(id)) } })
          .project({ name: 1 })
          .toArray();
  const ownerNames = new Map(owners.map((owner) => [String(owner._id), owner.name]));
  return {
    stores: all.map((store) => {
      const id = String(store._id);
      const isOwner = ownedIds.has(id);
      const acl = aclByStore.get(id);
      const bits = isOwner ? 15 : (acl?.permBits ?? VIEW_BITS);
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
