import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let server;
let attachmentsFromWrites;
let models;

before(async () => {
  server = await MongoMemoryServer.create();
  process.env.MONGO_URI = server.getUri();
  ({ attachmentsFromWrites } = await import('../extraction/processor.mjs'));
  ({ models } = await import('../db.mjs'));
});

after(async () => {
  await mongoose.disconnect();
  await server.stop();
});

test('builds memory update attachments from versions written during extraction', async () => {
  const db = await models();
  const userId = new mongoose.Types.ObjectId();
  const createdAt = new Date();
  await db.MemoryVersion.create({
    userId,
    memoryId: 'memory-1',
    key: 'dream_20261023',
    value: 'a dream',
    tags: ['dream'],
    storeId: 'store-1',
    createdAt,
  });
  const attachments = await attachmentsFromWrites({
    userId: String(userId),
    storeId: 'store-1',
    conversationId: 'convo-1',
    messageId: 'msg-1',
    since: new Date(createdAt.getTime() - 1000),
  });
  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].type, 'memory');
  assert.equal(attachments[0].memory.key, 'dream_20261023');
  assert.equal(attachments[0].memory.type, 'update');
  assert.equal(attachments[0].messageId, 'msg-1');
});
