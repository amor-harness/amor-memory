import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let server;
let processor;

before(async () => {
  server = await MongoMemoryServer.create();
  process.env.MONGO_URI = server.getUri();
  const { extractionMethods } = await import('../dist/extraction/database.mjs');
  const methods = await extractionMethods();
  const memory = await import('../dist/extraction/index.mjs');
  const userId = new mongoose.Types.ObjectId();
  const { models } = await import('../dist/db.mjs');
  const db = await models();
  await db.MemoryEntry.create({
    userId,
    storeId: 'store-1',
    key: 'seed',
    value: 'seed memory',
    tags: [],
  });
  const [withoutKeys, processMemory] = await memory.createMemoryProcessor({
    res: { headersSent: false, write() {} },
    userId,
    storeId: 'store-1',
    messageId: 'msg-1',
    conversationId: 'convo-1',
    config: {
      validKeys: [],
      instructions: 'extract memories',
      llmConfig: { provider: 'openai', model: 'gpt-4o-mini' },
      tokenLimit: 10000,
    },
    memoryMethods: methods,
    user: { id: String(userId), name: 'Test' },
  });
  processor = { withoutKeys, processMemory };
});

after(async () => {
  await mongoose.disconnect();
  await server.stop();
});

test('builds the original memory processor with exact data methods', () => {
  assert.equal(typeof processor.processMemory, 'function');
  assert.equal(typeof processor.withoutKeys, 'string');
});
