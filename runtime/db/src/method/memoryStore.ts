import { Types } from 'mongoose';
import { PermissionBits, ResourceType } from 'librechat-data-provider';
import type * as t from '../types';
import { logger } from '@librechat/data-schemas';
import { deleteMemoryVersions } from './memoryVersion';
import { emitMemoryChange } from '../memoryEvents';

export const MEMORY_STORE_NAME_MAX = 80;
export const DEFAULT_MEMORY_STORE_NAME = 'Default';

const NAME_REQUIRED_REASON = 'Memory store name is required.';
const NAME_TOO_LONG_REASON = `Memory store name exceeds ${MEMORY_STORE_NAME_MAX} characters.`;
const NAME_EXISTS_REASON = 'A memory store with this name already exists.';
const NOT_FOUND_REASON = 'Memory store not found.';
const FORBIDDEN_REASON = 'Only the memory store owner can change it.';
const DEFAULT_DELETE_REASON = 'The default memory store cannot be deleted.';

const idOf = (value: string | Types.ObjectId): string => value.toString();

const normalizeName = (name: unknown): string => (typeof name === 'string' ? name.trim() : '');

/**
 * Memory stores: user-owned containers that memories are isolated in. Every
 * memory entry carries its store, and a run reads only the store its agent
 * selected, so two stores never see each other's memories. Sharing rides the
 * resource ACL: the owner holds every bit, an editor may write memories, and a
 * viewer may only read them.
 */
export function createMemoryStoreMethods(
  mongoose: typeof import('mongoose'),
  deps: t.MemoryStoreDeps,
): {
  createMemoryStore: (params: t.CreateMemoryStoreParams) => Promise<t.MemoryStoreResult>;
  ensureDefaultMemoryStore: (userId: string | Types.ObjectId) => Promise<t.IMemoryStoreLean>;
  listMemoryStores: (userId: string | Types.ObjectId) => Promise<t.MemoryStoreAccess[]>;
  getMemoryStore: (params: t.GetMemoryStoreParams) => Promise<t.IMemoryStoreLean | null>;
  resolveMemoryStoreAccess: (params: {
    storeId: string | Types.ObjectId;
    userId: string | Types.ObjectId;
  }) => Promise<t.ResolvedMemoryStore | null>;
  updateMemoryStore: (params: t.UpdateMemoryStoreParams) => Promise<t.MemoryStoreResult>;
  deleteMemoryStore: (params: t.DeleteMemoryStoreParams) => Promise<t.MemoryStoreResult>;
  getMemoryStoreStats: (
    storeIds: Array<string | Types.ObjectId>,
  ) => Promise<Map<string, t.MemoryStoreStats>>;
  clearMemoryStore: (params: { storeId: string | Types.ObjectId }) => Promise<number>;
} {
  const isOwner = (store: t.IMemoryStoreLean, userId: string): boolean =>
    idOf(store.userId) === userId;

  /** Effective ACL bits per store id for the principals the user acts as. */
  async function permissionBitsFor(
    userId: string | Types.ObjectId,
    storeIds: Array<string | Types.ObjectId>,
  ): Promise<Map<string, number>> {
    if (storeIds.length === 0) {
      return new Map();
    }
    const principals = await deps.getUserPrincipals({ userId });
    return deps.getEffectivePermissionsForResources(
      principals,
      ResourceType.MEMORYSTORE,
      storeIds,
    );
  }

  const canWrite = (bits: number): boolean => (bits & PermissionBits.EDIT) !== 0;

  /** Points pre-store memories at the default store so legacy data keeps
   *  working, and re-emits them so their vectors are re-keyed to the store. */
  async function migrateLegacyMemories(
    userId: string | Types.ObjectId,
    storeId: string,
  ): Promise<void> {
    const legacy = { userId, storeId: { $exists: false } };
    const migrated = (await mongoose.models.MemoryEntry?.find(legacy)
      .select('key value stable')
      .lean()) as unknown as
      | Array<{ key: string; value: string; stable?: boolean }>
      | undefined;
    await Promise.all([
      mongoose.models.MemoryEntry?.updateMany(legacy, { $set: { storeId } }),
      mongoose.models.MemoryImage?.updateMany(legacy, { $set: { storeId } }),
      mongoose.models.ConversationMemory?.updateMany(legacy, { $set: { storeId } }),
    ]);
    for (const entry of migrated ?? []) {
      emitMemoryChange({
        type: 'set',
        userId: String(userId),
        key: entry.key,
        storeId,
        value: entry.value,
        stable: entry.stable === true,
      });
    }
  }

  /** Returns the user's default store, creating it (and adopting legacy
   *  memories) on first use. */
  async function ensureDefaultMemoryStore(
    userId: string | Types.ObjectId,
  ): Promise<t.IMemoryStoreLean> {
    const MemoryStore = mongoose.models.MemoryStore;
    const existing = (await MemoryStore.findOne({ userId, isDefault: true }).lean()) as
      | t.IMemoryStoreLean
      | null;
    if (existing) {
      return existing;
    }
    const now = new Date();
    const created = (await MemoryStore.findOneAndUpdate(
      { userId, isDefault: true },
      {
        $setOnInsert: {
          userId,
          name: DEFAULT_MEMORY_STORE_NAME,
          isDefault: true,
          created_at: now,
          updated_at: now,
        },
      },
      { upsert: true, new: true },
    ).lean()) as t.IMemoryStoreLean;
    await migrateLegacyMemories(userId, String(created._id));
    return created;
  }

  async function createMemoryStore({
    userId,
    name,
  }: t.CreateMemoryStoreParams): Promise<t.MemoryStoreResult> {
    const trimmed = normalizeName(name);
    if (trimmed === '') {
      return { ok: false, reason: NAME_REQUIRED_REASON };
    }
    if (trimmed.length > MEMORY_STORE_NAME_MAX) {
      return { ok: false, reason: NAME_TOO_LONG_REASON };
    }
    const MemoryStore = mongoose.models.MemoryStore;
    const duplicate = await MemoryStore.findOne({ userId, name: trimmed }).lean();
    if (duplicate) {
      return { ok: false, reason: NAME_EXISTS_REASON };
    }
    const now = new Date();
    const store = (
      await MemoryStore.create({
        userId,
        name: trimmed,
        isDefault: false,
        created_at: now,
        updated_at: now,
      })
    ).toObject() as t.IMemoryStoreLean;
    return { ok: true, store };
  }

  async function listMemoryStores(
    userId: string | Types.ObjectId,
  ): Promise<t.MemoryStoreAccess[]> {
    const MemoryStore = mongoose.models.MemoryStore;
    const userIdStr = idOf(userId);
    const principals = await deps.getUserPrincipals({ userId });
    const sharedIds = await deps.findAccessibleResources(
      principals,
      ResourceType.MEMORYSTORE,
      PermissionBits.VIEW,
    );
    const stores = (await MemoryStore.find({
      $or: [{ userId }, { _id: { $in: sharedIds } }],
    })
      .sort({ isDefault: -1, name: 1 })
      .lean()) as t.IMemoryStoreLean[];
    const bitsByStore = await deps.getEffectivePermissionsForResources(
      principals,
      ResourceType.MEMORYSTORE,
      stores.map((store) => store._id),
    );
    const owned = stores.filter((store) => idOf(store.userId) === userIdStr);
    const shared = stores.filter((store) => idOf(store.userId) !== userIdStr);
    const toAccess = (store: t.IMemoryStoreLean, owner: boolean): t.MemoryStoreAccess => ({
      store,
      isOwner: owner,
      permissionBits: bitsByStore.get(String(store._id)) ?? 0,
    });
    return [
      ...owned.map((store) => toAccess(store, true)),
      ...shared.map((store) => toAccess(store, false)),
    ];
  }

  async function getMemoryStore({
    storeId,
    userId,
  }: t.GetMemoryStoreParams): Promise<t.IMemoryStoreLean | null> {
    const MemoryStore = mongoose.models.MemoryStore;
    const query: Record<string, unknown> = { _id: storeId };
    if (userId != null) {
      query.userId = userId;
    }
    return (await MemoryStore.findOne(query).lean()) as t.IMemoryStoreLean | null;
  }

  async function resolveMemoryStoreAccess({
    storeId,
    userId,
  }: {
    storeId: string | Types.ObjectId;
    userId: string | Types.ObjectId;
  }): Promise<t.ResolvedMemoryStore | null> {
    if (!storeId || !Types.ObjectId.isValid(storeId)) {
      return null;
    }
    try {
      const store = await getMemoryStore({ storeId });
      if (!store) {
        return null;
      }
      const userIdStr = idOf(userId);
      const ownerId = idOf(store.userId);
      if (ownerId === userIdStr) {
        return { store, ownerId, storeId: idOf(store._id), canWrite: true };
      }
      const bits = (await permissionBitsFor(userId, [store._id])).get(String(store._id)) ?? 0;
      if ((bits & PermissionBits.VIEW) === 0) {
        return null;
      }
      return {
        store,
        ownerId,
        storeId: idOf(store._id),
        canWrite: canWrite(bits),
      };
    } catch (error) {
      logger.error('Failed to resolve memory store access:', error);
      return null;
    }
  }

  async function updateMemoryStore({
    storeId,
    userId,
    name,
  }: t.UpdateMemoryStoreParams): Promise<t.MemoryStoreResult> {
    const trimmed = normalizeName(name);
    if (trimmed === '') {
      return { ok: false, reason: NAME_REQUIRED_REASON };
    }
    if (trimmed.length > MEMORY_STORE_NAME_MAX) {
      return { ok: false, reason: NAME_TOO_LONG_REASON };
    }
    const MemoryStore = mongoose.models.MemoryStore;
    const store = (await MemoryStore.findOne({ _id: storeId }).lean()) as
      | t.IMemoryStoreLean
      | null;
    if (!store) {
      return { ok: false, reason: NOT_FOUND_REASON };
    }
    const userIdStr = idOf(userId);
    if (!isOwner(store, userIdStr)) {
      const bits = (await permissionBitsFor(userId, [store._id])).get(String(store._id)) ?? 0;
      if (!canWrite(bits)) {
        return { ok: false, reason: FORBIDDEN_REASON };
      }
    }
    const duplicate = await MemoryStore.findOne({
      userId: store.userId,
      name: trimmed,
      _id: { $ne: store._id },
    }).lean();
    if (duplicate) {
      return { ok: false, reason: NAME_EXISTS_REASON };
    }
    const updated = (await MemoryStore.findByIdAndUpdate(
      store._id,
      { $set: { name: trimmed, updated_at: new Date() } },
      { new: true },
    ).lean()) as t.IMemoryStoreLean;
    return { ok: true, store: updated };
  }

  async function deleteMemoryStore({
    storeId,
    userId,
  }: t.DeleteMemoryStoreParams): Promise<t.MemoryStoreResult> {
    const MemoryStore = mongoose.models.MemoryStore;
    const store = (await MemoryStore.findOne({ _id: storeId }).lean()) as
      | t.IMemoryStoreLean
      | null;
    if (!store) {
      return { ok: false, reason: NOT_FOUND_REASON };
    }
    const userIdStr = idOf(userId);
    if (!isOwner(store, userIdStr)) {
      const bits = (await permissionBitsFor(userId, [store._id])).get(String(store._id)) ?? 0;
      if ((bits & PermissionBits.DELETE) === 0) {
        return { ok: false, reason: FORBIDDEN_REASON };
      }
    }
    if (store.isDefault === true) {
      return { ok: false, reason: DEFAULT_DELETE_REASON };
    }
    const storeIdStr = String(store._id);
    const memoryQuery = { storeId: storeIdStr };
    await Promise.all([
      mongoose.models.MemoryEntry?.deleteMany(memoryQuery),
      mongoose.models.MemoryImage?.deleteMany(memoryQuery),
      mongoose.models.ConversationMemory?.deleteMany(memoryQuery),
      /** The memories' recorded history goes with them. */
      deleteMemoryVersions(mongoose, { storeId: storeIdStr }),
      /** Domains belong to the store: they go with it. */
      mongoose.models.MemoryDomain?.deleteMany(memoryQuery),
    ]);
    /** Deleting the store drops its rows directly, which emits nothing; one
     *  sweep drops the store's vector rows — text and images both — instead of
     *  replaying a delete per row. */
    emitMemoryChange({
      type: 'delete',
      userId: String(store.userId),
      storeId: storeIdStr,
      sweep: true,
    });
    await MemoryStore.deleteOne({ _id: store._id });
    return { ok: true };
  }

  /**
   * Deletes every memory in a store while keeping the store itself. Stable and
   * locked entries go too: the memory panel is an allowed channel for both, and
   * "clear the store" is an explicit, confirmed action. Domains partition a
   * store's contents, so they are cleared with them; the default domain is
   * recreated on the next read.
   */
  async function clearMemoryStore({
    storeId,
  }: {
    storeId: string | Types.ObjectId;
  }): Promise<number> {
    const storeIdStr = idOf(storeId);
    const memoryQuery = { storeId: storeIdStr };
    const [owner, dropped] = await Promise.all([
      mongoose.models.MemoryStore.findOne({ _id: storeId }).select('userId').lean(),
      mongoose.models.MemoryEntry?.countDocuments(memoryQuery),
    ]);
    const ownerId = (owner as { userId: Types.ObjectId } | null)?.userId;
    await Promise.all([
      mongoose.models.MemoryEntry?.deleteMany(memoryQuery),
      mongoose.models.MemoryImage?.deleteMany(memoryQuery),
      mongoose.models.ConversationMemory?.deleteMany(memoryQuery),
      /** The memories' recorded history goes with them. */
      deleteMemoryVersions(mongoose, { storeId: storeIdStr }),
      /** Clear removes the store's contents, and domains are part of them: an
       *  emptied domain left behind would still show up in the panel and the
       *  `/memory` mount. */
      mongoose.models.MemoryDomain?.deleteMany(memoryQuery),
    ]);
    /** Rows drop directly, which emits nothing; one sweep drops the store's
     *  vector rows — text and images both — instead of replaying a delete per
     *  row. Every write path files its entries under the store's owner, so the
     *  owner is the user the vector partition is keyed by. */
    if (ownerId) {
      emitMemoryChange({
        type: 'delete',
        userId: String(ownerId),
        storeId: storeIdStr,
        sweep: true,
      });
    }
    return dropped ?? 0;
  }

  /** Memory count, token total, and latest memory update per store, for the
   *  store list. The store document's own `updated_at` only moves on rename, so
   *  the list has to read the newest memory timestamp instead. */
  async function getMemoryStoreStats(
    storeIds: Array<string | Types.ObjectId>,
  ): Promise<Map<string, t.MemoryStoreStats>> {
    const stats = new Map<string, t.MemoryStoreStats>();
    if (storeIds.length === 0) {
      return stats;
    }
    const rows = (await mongoose.models.MemoryEntry.aggregate([
      { $match: { storeId: { $in: storeIds.map(String) } } },
      {
        $group: {
          _id: '$storeId',
          memoryCount: { $sum: 1 },
          totalTokens: { $sum: { $ifNull: ['$tokenCount', 0] } },
          updatedAt: { $max: '$updated_at' },
        },
      },
    ])) as Array<{
      _id: string;
      memoryCount: number;
      totalTokens: number;
      updatedAt?: Date | null;
    }>;
    for (const row of rows) {
      stats.set(row._id, {
        memoryCount: row.memoryCount,
        totalTokens: row.totalTokens,
        updatedAt: row.updatedAt ?? undefined,
      });
    }
    return stats;
  }

  return {
    createMemoryStore,
    ensureDefaultMemoryStore,
    listMemoryStores,
    getMemoryStore,
    resolveMemoryStoreAccess,
    updateMemoryStore,
    deleteMemoryStore,
    getMemoryStoreStats,
    clearMemoryStore,
  };
}

export type MemoryStoreMethods = ReturnType<typeof createMemoryStoreMethods>;
