import { extractionMethods } from '../extraction/database.mjs';
import { readableStore, writableStore } from './memories.mjs';

function accessShape(access) {
  if (!access) {
    return null;
  }
  return {
    storeId: String(access.store._id),
    ownerId: String(access.ownerId),
    canWrite: access.canWrite === true,
  };
}

export async function resolveStore({ userId, storeId }) {
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

export async function defaultStore({ userId }) {
  const methods = await extractionMethods();
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
}) {
  const methods = await extractionMethods();
  return methods.getFormattedMemories({
    userId,
    storeId,
    ...(Array.isArray(domainIds) ? { domainIds } : {}),
    ...(excludeConversationId != null ? { excludeConversationId } : {}),
    ...(timezone != null ? { timezone } : {}),
  });
}
