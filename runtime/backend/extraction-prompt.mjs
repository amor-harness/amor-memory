import mongoose from 'mongoose';
import { models } from '../db.mjs';

const FILENAME = 'EXTRACTION.md';

export async function getExtractionPrompt({ userId }) {
  if (!userId) {
    return '';
  }
  const db = await models();
  const doc = await db.MemoryExtractionPrompt.findOne({
    userId: new mongoose.Types.ObjectId(String(userId)),
  }).lean();
  return typeof doc?.instructions === 'string' ? doc.instructions : '';
}

export async function setExtractionPrompt({ userId, instructions }) {
  if (!userId) {
    return null;
  }
  const db = await models();
  const value = typeof instructions === 'string' ? instructions : '';
  if (value.trim() === '') {
    await db.MemoryExtractionPrompt.deleteOne({
      userId: new mongoose.Types.ObjectId(String(userId)),
    });
    return '';
  }
  await db.MemoryExtractionPrompt.findOneAndUpdate(
    { userId: new mongoose.Types.ObjectId(String(userId)) },
    { $set: { instructions: value, updated_at: new Date() } },
    { upsert: true, new: true },
  );
  return value;
}

export { FILENAME as EXTRACTION_PROMPT_FILE };
