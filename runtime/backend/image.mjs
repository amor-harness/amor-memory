import mongoose from 'mongoose';
import { models } from '../db.mjs';
import { requirePermission } from './memories.mjs';

const MAX_BYTES = 8 * 1024 * 1024;

function payload(record) {
  return {
    dataUrl: `data:${record.mime};base64,${record.data.toString('base64')}`,
    mime: record.mime,
    width: record.width,
    height: record.height,
  };
}

/** One stored image by exact content hash. */
export async function getImageBySha({ userId, role, sha256 }) {
  await requirePermission({ userId, role, permissions: ['USE', 'READ'] });
  if (!/^[a-f0-9]{64}$/i.test(sha256 ?? '')) {
    throw Object.assign(new Error('Invalid image id.'), { status: 400 });
  }
  const db = await models();
  const record = await db.MemoryImage.findOne({
    userId: new mongoose.Types.ObjectId(String(userId)),
    sha256,
  }).lean();
  if (!record) {
    throw Object.assign(new Error('Image not found.'), { status: 404 });
  }
  if (record.bytes > MAX_BYTES) {
    throw Object.assign(new Error('Image is too large to preview.'), { status: 413 });
  }
  return payload(record);
}

/** One stored image by its short `/memory/images/<id>` path. */
export async function getImageByUrl({ userId, role, url }) {
  await requirePermission({ userId, role, permissions: ['USE', 'READ'] });
  const match = typeof url === 'string' ? url.match(/\/memory\/images\/(\d+)(?:\.[a-z0-9]+)?$/i) : null;
  if (!match) {
    throw Object.assign(new Error('Invalid image URL.'), { status: 400 });
  }
  const db = await models();
  const record = await db.MemoryImage.findOne({
    userId: new mongoose.Types.ObjectId(String(userId)),
    id: Number(match[1]),
  }).lean();
  if (!record) {
    throw Object.assign(new Error('Image not found.'), { status: 404 });
  }
  if (record.bytes > MAX_BYTES) {
    throw Object.assign(new Error('Image is too large to preview.'), { status: 413 });
  }
  return payload(record);
}

export async function deleteImage({ userId, role, storeId, sha256 }) {
  await requirePermission({ userId, role, permissions: ['USE', 'UPDATE'] });
  if (!/^[a-f0-9]{64}$/i.test(sha256 ?? '')) {
    throw Object.assign(new Error('Invalid image id.'), { status: 400 });
  }
  const db = await models();
  const result = await db.MemoryImage.deleteOne({
    userId: new mongoose.Types.ObjectId(String(userId)),
    ...(storeId ? { storeId: String(storeId) } : {}),
    sha256,
  });
  if (result.deletedCount === 0) {
    throw Object.assign(new Error('Image not found.'), { status: 404 });
  }
  return { deleted: true };
}
