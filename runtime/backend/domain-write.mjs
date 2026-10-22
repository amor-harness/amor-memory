import mongoose from 'mongoose';
import { connectAppDb, models } from '../db.mjs';
import { requirePermission } from './memories.mjs';
import { dropEntryVector } from './vectors.mjs';

const KINDS = ['real', 'fictional', 'project', 'sandbox', 'study', 'work'];

function fail(status, error) {
  return { ok: false, status, error };
}

function validateName(name) {
  if (typeof name !== 'string' || name.trim() === '') {
    return 'Memory domain name is required.';
  }
  if (name.trim().length > 80) {
    return 'Memory domain name is too long.';
  }
  return null;
}

async function ownedStore({ userId, storeId }) {
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(userId));
  return db.MemoryStore.findOne({ _id: storeId, userId: user }).lean();
}

export async function createDomain({ userId, role, storeId, name, kind, description }) {
  await requirePermission({ userId, role, permissions: ['USE', 'CREATE'] });
  const error = validateName(name);
  if (error) {
    return fail(400, error);
  }
  if (!KINDS.includes(kind)) {
    return fail(400, 'Invalid memory domain kind.');
  }
  const store = await ownedStore({ userId, storeId });
  if (!store) {
    return fail(404, 'Memory store not found.');
  }
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(userId));
  const existing = await db.MemoryDomain.findOne({
    storeId: String(store._id),
    name: name.trim(),
  }).lean();
  if (existing) {
    return fail(400, 'A memory domain with that name already exists.');
  }
  const domain = await db.MemoryDomain.create({
    userId: user,
    storeId: String(store._id),
    name: name.trim(),
    kind,
    description: typeof description === 'string' ? description : '',
    createdBy: 'user',
  });
  return {
    ok: true,
    domain: {
      id: String(domain._id),
      name: domain.name,
      kind: domain.kind,
      description: domain.description,
      isDefault: false,
      createdBy: 'user',
      memoryCount: 0,
      updated_at: domain.updated_at,
    },
  };
}

export async function updateDomain({ userId, role, storeId, domainId, name, kind, description }) {
  await requirePermission({ userId, role, permissions: ['USE', 'UPDATE'] });
  const store = await ownedStore({ userId, storeId });
  if (!store) {
    return fail(404, 'Memory store not found.');
  }
  if (name !== undefined) {
    const error = validateName(name);
    if (error) {
      return fail(400, error);
    }
  }
  if (kind !== undefined && !KINDS.includes(kind)) {
    return fail(400, 'Invalid memory domain kind.');
  }
  const db = await models();
  const domain = await db.MemoryDomain.findOne({ _id: domainId, storeId: String(store._id) }).lean();
  if (!domain) {
    return fail(404, 'Memory domain not found.');
  }
  if (name !== undefined) {
    const conflict = await db.MemoryDomain.findOne({
      storeId: String(store._id),
      name: name.trim(),
      _id: { $ne: domain._id },
    }).lean();
    if (conflict) {
      return fail(400, 'A memory domain with that name already exists.');
    }
  }
  const updated = await db.MemoryDomain.findOneAndUpdate(
    { _id: domain._id },
    {
      $set: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(kind !== undefined ? { kind } : {}),
        ...(description !== undefined ? { description } : {}),
        updated_at: new Date(),
      },
    },
    { new: true },
  ).lean();
  return {
    ok: true,
    domain: {
      id: String(updated._id),
      name: updated.name,
      kind: updated.kind,
      description: updated.description,
      isDefault: updated.isDefault === true,
      createdBy: updated.createdBy,
      updated_at: updated.updated_at,
    },
  };
}

export async function deleteDomain({ userId, role, storeId, domainId, force = false }) {
  await requirePermission({ userId, role, permissions: ['USE', 'UPDATE'] });
  const store = await ownedStore({ userId, storeId });
  if (!store) {
    return fail(404, 'Memory store not found.');
  }
  const db = await models();
  const domain = await db.MemoryDomain.findOne({ _id: domainId, storeId: String(store._id) }).lean();
  if (!domain) {
    return fail(404, 'Memory domain not found.');
  }
  if (domain.isDefault === true) {
    return fail(400, 'The default memory domain cannot be deleted.');
  }
  const entries = await db.MemoryEntry.find({
    userId: new mongoose.Types.ObjectId(String(userId)),
    storeId: String(store._id),
    domainId: String(domain._id),
  }).lean();
  if (entries.length > 0 && force !== true) {
    return fail(400, 'Memory domain still holds memories. Pass force to delete them.');
  }
  await Promise.all([
    db.MemoryEntry.deleteMany({ storeId: String(store._id), domainId: String(domain._id) }),
    db.MemoryImage.deleteMany({ storeId: String(store._id), domainId: String(domain._id) }),
    db.ConversationMemory.deleteMany({
      storeId: String(store._id),
      domainId: String(domain._id),
    }),
  ]);
  for (const entry of entries) {
    await dropEntryVector(entry);
  }
  await db.MemoryVersion.deleteMany({
    memoryId: { $in: entries.map((entry) => String(entry._id)) },
  });
  await db.MemoryDomain.deleteOne({ _id: domain._id });
  return { ok: true };
}

export async function setActiveDomains({ userId, role, storeId, conversationId, domainIds }) {
  await requirePermission({ userId, role, permissions: ['USE', 'READ'] });
  if (!Array.isArray(domainIds)) {
    return fail(400, 'domainIds must be an array.');
  }
  const store = await ownedStore({ userId, storeId });
  if (!store) {
    return fail(404, 'Memory store not found.');
  }
  const db = await models();
  const conn = await connectAppDb();
  const convo = await conn
    .collection('conversations')
    .findOne({ conversationId, user: String(userId) });
  if (!convo) {
    return fail(404, 'Conversation not found.');
  }
  const domains = await db.MemoryDomain.find({ storeId: String(store._id) }).lean();
  const known = new Set(domains.map((domain) => String(domain._id)));
  const wanted = domainIds.map(String).filter((id) => known.has(id));
  await conn
    .collection('conversations')
    .updateOne({ _id: convo._id }, { $set: { activeDomainIds: wanted } });
  return { ok: true, conversationId, activeDomainIds: wanted };
}
