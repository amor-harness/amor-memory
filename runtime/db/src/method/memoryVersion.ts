import { Types } from 'mongoose';
import type * as t from '../types';
import { logger } from '@librechat/data-schemas';

/** Recorded states kept per memory. Deep enough to undo a long editing
 *  session, capped so one hot memory (the extractor rewrites the same key every
 *  few turns) cannot grow its history without bound. */
export const MAX_MEMORY_VERSIONS = 50;

/** Identity of a state for de-duplication: a write that reproduces the newest
 *  recorded state — the extractor re-writing the same fact, or a restore that
 *  lands on the state it came from — records nothing, so the history stays a
 *  list of actual changes. Flags are metadata on a state and do not make one. */
const sameState = (version: t.IMemoryVersionLean, snapshot: t.MemoryVersionSnapshot): boolean =>
  version.key === snapshot.key &&
  version.value === snapshot.value &&
  (version.domainId ?? undefined) === (snapshot.domainId ? String(snapshot.domainId) : undefined);

/** Appends a snapshot of a memory entry's new state, newest-first read for
 *  de-duplication and for pruning the oldest states past the cap. History is a
 *  convenience: a failure here is logged and never fails the memory write. */
export async function recordMemoryVersion(
  mongoose: typeof import('mongoose'),
  snapshot: t.MemoryVersionSnapshot,
): Promise<void> {
  try {
    const MemoryVersion = mongoose.models.MemoryVersion;
    const memoryId = String(snapshot.memoryId);
    const kept = (await MemoryVersion.find({ memoryId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(MAX_MEMORY_VERSIONS)
      .lean()) as unknown as t.IMemoryVersionLean[];

    const latest = kept[0];
    if (latest && sameState(latest, snapshot)) {
      return;
    }

    const created = await MemoryVersion.create({
      userId: snapshot.userId,
      memoryId,
      key: snapshot.key,
      value: snapshot.value,
      tags: snapshot.tags ?? [],
      ...(snapshot.storeId ? { storeId: String(snapshot.storeId) } : {}),
      ...(snapshot.domainId ? { domainId: String(snapshot.domainId) } : {}),
      tokenCount: snapshot.tokenCount ?? 0,
      stable: snapshot.stable === true,
      injection: snapshot.injection === 'additional' ? 'additional' : 'system',
      locked: snapshot.locked === true,
      createdAt: new Date(),
    });

    /** At the cap the new state takes the last free slot, so everything except
     *  it and the newest `MAX - 1` older states goes. Under the cap there is
     *  nothing to prune, which keeps the hot write path at one read. */
    if (kept.length === MAX_MEMORY_VERSIONS) {
      const keepIds = [
        created._id,
        ...kept.slice(0, MAX_MEMORY_VERSIONS - 1).map((version) => version._id),
      ];
      await MemoryVersion.deleteMany({ memoryId, _id: { $nin: keepIds } });
    }
  } catch (error) {
    logger.error('Failed to record a memory version:', error);
  }
}

/** One memory's recorded states, newest first. */
export async function listMemoryVersions(
  mongoose: typeof import('mongoose'),
  { userId, memoryId, limit }: t.GetMemoryVersionsParams,
): Promise<t.IMemoryVersionLean[]> {
  const MemoryVersion = mongoose.models.MemoryVersion;
  const query = MemoryVersion.find({ userId, memoryId }).sort({ createdAt: -1, _id: -1 });
  if (limit != null && limit > 0) {
    query.limit(limit);
  }
  return (await query.lean()) as unknown as t.IMemoryVersionLean[];
}

/** One recorded state, scoped to the chain it must belong to. */
export async function findMemoryVersion(
  mongoose: typeof import('mongoose'),
  { userId, memoryId, versionId }: t.GetMemoryVersionParams,
): Promise<t.IMemoryVersionLean | null> {
  if (!Types.ObjectId.isValid(versionId)) {
    return null;
  }
  const MemoryVersion = mongoose.models.MemoryVersion;
  return (await MemoryVersion.findOne({
    _id: versionId,
    userId,
    memoryId,
  }).lean()) as unknown as t.IMemoryVersionLean | null;
}

/** Drops the history of memories that no longer exist (deleted, evicted, or
 *  cleared with their store). */
export async function deleteMemoryVersions(
  mongoose: typeof import('mongoose'),
  filter: t.MemoryVersionFilter,
): Promise<void> {
  const { userId, storeId, memoryIds } = filter;
  const query: Record<string, unknown> = {};
  if (userId) {
    query.userId = userId;
  }
  if (storeId) {
    query.storeId = String(storeId);
  }
  if (memoryIds) {
    if (memoryIds.length === 0) {
      return;
    }
    query.memoryId = { $in: memoryIds };
  }
  if (Object.keys(query).length === 0) {
    return;
  }
  await mongoose.models.MemoryVersion.deleteMany(query);
}

/** Moves a chain to the entry a rename created, so the memory keeps its history
 *  after its key changes. */
export async function reassignMemoryVersions(
  mongoose: typeof import('mongoose'),
  { fromMemoryId, toMemoryId }: t.ReassignMemoryVersionsParams,
): Promise<void> {
  if (fromMemoryId === toMemoryId) {
    return;
  }
  await mongoose.models.MemoryVersion.updateMany(
    { memoryId: fromMemoryId },
    { $set: { memoryId: toMemoryId } },
  );
}

export function createMemoryVersionMethods(mongoose: typeof import('mongoose')): {
  getMemoryVersions: (params: t.GetMemoryVersionsParams) => Promise<t.IMemoryVersionLean[]>;
  getMemoryVersion: (params: t.GetMemoryVersionParams) => Promise<t.IMemoryVersionLean | null>;
  reassignMemoryVersions: (params: t.ReassignMemoryVersionsParams) => Promise<void>;
} {
  return {
    getMemoryVersions: (params: t.GetMemoryVersionsParams) => listMemoryVersions(mongoose, params),
    getMemoryVersion: (params: t.GetMemoryVersionParams) => findMemoryVersion(mongoose, params),
    reassignMemoryVersions: (params: t.ReassignMemoryVersionsParams) =>
      reassignMemoryVersions(mongoose, params),
  };
}

export type MemoryVersionMethods = ReturnType<typeof createMemoryVersionMethods>;
