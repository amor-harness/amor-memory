import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let server;
let methods;

before(async () => {
  server = await MongoMemoryServer.create();
  process.env.MONGO_URI = server.getUri();
  const { extractionMethods } = await import('../extraction/database.mjs');
  methods = await extractionMethods();
});

after(async () => {
  await mongoose.disconnect();
  await server.stop();
});

test('exposes the exact extraction data methods', () => {
  for (const name of [
    'setMemory',
    'deleteMemory',
    'getFormattedMemories',
    'setConversationMemory',
    'getUserMemories',
    'getMemoryExtractionEntries',
    'evictMemoriesToFitCapacity',
    'getStoreTagVocabulary',
  ]) {
    assert.equal(typeof methods[name], 'function', name);
  }
});
