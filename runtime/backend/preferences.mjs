import mongoose from 'mongoose';
import { connectAppDb } from '../db.mjs';
import { requirePermission } from './memories.mjs';

/** The user's memory preference, defaulting to enabled like the app does. */
export async function getPreferences({ userId, role }) {
  await requirePermission({ userId, role, permissions: ['USE'] });
  const conn = await connectAppDb();
  const user = await conn
    .collection('users')
    .findOne({ _id: new mongoose.Types.ObjectId(String(userId)) }, { projection: { personalization: 1 } });
  return { memories: user?.personalization?.memories !== false };
}

export async function setPreferences({ userId, role, memories }) {
  await requirePermission({ userId, role, permissions: ['USE', 'OPT_OUT'] });
  if (typeof memories !== 'boolean') {
    throw Object.assign(new Error('memories must be a boolean.'), { status: 400 });
  }
  const conn = await connectAppDb();
  const result = await conn.collection('users').updateOne(
    { _id: new mongoose.Types.ObjectId(String(userId)) },
    { $set: { 'personalization.memories': memories, updatedAt: new Date() } },
  );
  if (result.matchedCount === 0) {
    throw Object.assign(new Error('User not found.'), { status: 404 });
  }
  return { updated: true, preferences: { memories } };
}
