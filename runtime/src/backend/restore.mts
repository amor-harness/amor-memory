import mongoose from 'mongoose';
import { models } from '../db.mjs';
import { requirePermission, stripTags, tagsOf } from './memories.mjs';
import { ownedStore } from './memories.mjs';
import { countTokens } from './tokens.mjs';
import { syncEntryVector } from './vectors.mjs';
import type { MemoryEntryRow, MemoryFailure, MemoryVersionRow } from './types.mjs';

function fail(status: number, error: string): MemoryFailure {
  return { ok: false, status, error };
}

export interface RestoredMemory extends MemoryEntryRow {
  content: string;
}

/** Restores one recorded state onto its memory and records the restore as a
 *  new version, so it can be undone the same way. */
export async function restoreVersion({
  userId,
  role,
  storeId,
  key,
  versionId,
}: {
  userId?: string;
  role?: string;
  storeId?: string;
  key: string;
  versionId?: string;
}): Promise<MemoryFailure | { ok: true; memory: RestoredMemory }> {
  await requirePermission({ userId, role, permissions: ['USE', 'UPDATE'] });
  if (!/^[a-f0-9]{24}$/i.test(versionId ?? '')) {
    return fail(400, 'Invalid version id.');
  }
  const store = await ownedStore({ userId, storeId });
  if (!store) {
    return fail(404, 'Memory store not found.');
  }
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(userId));
  const resolvedStoreId = String(store._id);
  const entry = (await db.MemoryEntry.findOne({
    userId: user,
    storeId: resolvedStoreId,
    key,
  }).lean()) as MemoryEntryRow | null;
  if (!entry) {
    return fail(404, 'Memory not found.');
  }
  const version = (await db.MemoryVersion.findOne({
    _id: versionId,
    userId: user,
    memoryId: String(entry._id),
  }).lean()) as MemoryVersionRow | null;
  if (!version) {
    return fail(404, 'Version not found.');
  }
  const newKey = version.key || key;
  if (newKey !== key) {
    const conflict = (await db.MemoryEntry.findOne({
      userId: user,
      storeId: resolvedStoreId,
      key: newKey,
    }).lean()) as MemoryEntryRow | null;
    if (conflict) {
      return fail(409, 'Memory with this key already exists.');
    }
  }
  const value = version.value;
  const updated = (await db.MemoryEntry.findOneAndUpdate(
    { _id: entry._id },
    {
      $set: {
        key: newKey,
        value,
        tags: version.tags ?? tagsOf({ value }),
        tokenCount: countTokens(value),
        stable: version.stable === true,
        injection: version.injection === 'additional' ? 'additional' : 'system',
        locked: version.locked === true,
        ...(version.domainId ? { domainId: String(version.domainId) } : {}),
        updated_at: new Date(),
      },
    },
    { new: true },
  ).lean()) as MemoryEntryRow;
  await db.MemoryVersion.create({
    userId: user,
    memoryId: String(entry._id),
    key: updated.key,
    value: updated.value,
    tags: updated.tags,
    storeId: resolvedStoreId,
    domainId: updated.domainId,
    tokenCount: updated.tokenCount,
    stable: updated.stable,
    injection: updated.injection,
    locked: updated.locked,
  });
  await syncEntryVector(updated);
  return {
    ok: true,
    memory: {
      ...updated,
      content: stripTags(updated.value),
    },
  };
}
