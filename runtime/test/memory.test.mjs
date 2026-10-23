// Runtime tests for the plugin-owned data layer. They run against a real
// in-memory MongoDB so the schemas, indexes and write paths are exercised, not
// mocked.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const USER_ID = new mongoose.Types.ObjectId().toString();

let memoryServer;
let connection;
let backend;
let models;
let storeId;

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = memoryServer.getUri();
  const db = await import('../dist/db.mjs');
  models = await db.models();
  connection = await db.connectDb();
  backend = {
    ...(await import('../dist/backend/write.mjs')),
    ...(await import('../dist/backend/memories.mjs')),
    ...(await import('../dist/backend/domains.mjs')),
    ...(await import('../dist/backend/stores.mjs')),
    ...(await import('../dist/backend/domain-write.mjs')),
    ...(await import('../dist/backend/restore.mjs')),
    ...(await import('../dist/backend/image.mjs')),
    ...(await import('../dist/backend/history.mjs')),
    ...(await import('../dist/backend/preferences.mjs')),
    ...(await import('../dist/backend/injection.mjs')),
  };
  await connection.collection('users').insertOne({
    _id: new mongoose.Types.ObjectId(USER_ID),
    personalization: { memories: true },
  });
  await connection.collection('roles').insertOne({
    name: 'USER',
    permissions: {
      MEMORIES: { USE: true, CREATE: true, UPDATE: true, READ: true, OPT_OUT: true },
    },
  });
  const store = await models.MemoryStore.create({
    userId: new mongoose.Types.ObjectId(USER_ID),
    name: 'Test store',
    isDefault: true,
  });
  storeId = String(store._id);
});

after(async () => {
  if (connection) {
    await connection.close();
  }
  if (memoryServer) {
    await memoryServer.stop();
  }
});

test('creates, lists and version-recorded updates a memory', async () => {
  const created = await backend.createMemory({
    userId: USER_ID,
    role: 'USER',
    storeId,
    key: 'alpha',
    value: 'first value\ntags:one|two',
  });
  assert.equal(created.ok, true);
  assert.equal(created.memory.key, 'alpha');

  const listed = await backend.listOwnedMemories({ userId: USER_ID, role: 'USER', storeId });
  assert.equal(listed.memories.length, 1);
  assert.equal(listed.memories[0].content, 'first value');
  assert.deepEqual(listed.memories[0].tags, ['one', 'two']);

  const updated = await backend.updateMemory({
    userId: USER_ID,
    role: 'USER',
    storeId,
    key: 'alpha',
    value: 'second value',
  });
  assert.equal(updated.ok, true);

  const entry = await models.MemoryEntry.findOne({ storeId, key: 'alpha' }).lean();
  const versions = await models.MemoryVersion.find({ memoryId: String(entry._id) }).lean();
  assert.equal(versions.length, 2);
});

test('domain reads include counts and the default domain', async () => {
  const domains = await backend.listDomains({ userId: USER_ID, role: 'USER', storeId });
  assert.equal(domains.domains.length, 1);
  assert.equal(domains.domains[0].isDefault, true);
  assert.equal(domains.domains[0].memoryCount, 1);
});

test('deletes the entry and its history', async () => {
  const deleted = await backend.deleteMemory({
    userId: USER_ID,
    role: 'USER',
    storeId,
    key: 'alpha',
  });
  assert.equal(deleted.ok, true);
  assert.equal(await models.MemoryEntry.countDocuments({ storeId }), 0);
  assert.equal(await models.MemoryVersion.countDocuments({ storeId }), 0);
});

test('creates, renames and clears a store through the plugin backend', async () => {
  const created = await backend.createStore({
    userId: USER_ID,
    role: 'USER',
    name: 'Second store',
  });
  assert.equal(created.ok, true);
  const secondId = created.store.id;

  const renamed = await backend.renameStore({
    userId: USER_ID,
    role: 'USER',
    storeId: secondId,
    name: 'Renamed store',
  });
  assert.equal(renamed.ok, true);
  assert.equal(renamed.store.name, 'Renamed store');

  await backend.createMemory({
    userId: USER_ID,
    role: 'USER',
    storeId: secondId,
    key: 'beta',
    value: 'to be cleared',
  });
  const cleared = await backend.clearStore({ userId: USER_ID, role: 'USER', storeId: secondId });
  assert.equal(cleared.ok, true);
  assert.equal(cleared.deleted, 1);

  const removed = await backend.deleteStore({ userId: USER_ID, role: 'USER', storeId: secondId });
  assert.equal(removed.ok, true);
});

test('creates, updates and force-deletes a domain with its memories', async () => {
  const store = await backend.createStore({ userId: USER_ID, role: 'USER', name: 'Domain store' });
  const storeId = store.store.id;

  const created = await backend.createDomain({
    userId: USER_ID,
    role: 'USER',
    storeId,
    name: 'Island',
    kind: 'fictional',
    description: 'A game world',
  });
  assert.equal(created.ok, true);
  const domainId = created.domain.id;

  const updated = await backend.updateDomain({
    userId: USER_ID,
    role: 'USER',
    storeId,
    domainId,
    name: 'Island v2',
  });
  assert.equal(updated.ok, true);
  assert.equal(updated.domain.name, 'Island v2');

  await backend.createMemory({
    userId: USER_ID,
    role: 'USER',
    storeId,
    key: 'island_memory',
    value: 'belongs to the island',
    domainId,
  });
  const refused = await backend.deleteDomain({
    userId: USER_ID,
    role: 'USER',
    storeId,
    domainId,
  });
  assert.equal(refused.ok, false);

  const forced = await backend.deleteDomain({
    userId: USER_ID,
    role: 'USER',
    storeId,
    domainId,
    force: true,
  });
  assert.equal(forced.ok, true);
});

test('restores a recorded version', async () => {
  const store = await backend.createStore({ userId: USER_ID, role: 'USER', name: 'Restore store' });
  const storeId = store.store.id;
  await backend.createMemory({
    userId: USER_ID,
    role: 'USER',
    storeId,
    key: 'restore_me',
    value: 'first',
  });
  await backend.updateMemory({
    userId: USER_ID,
    role: 'USER',
    storeId,
    key: 'restore_me',
    value: 'second',
  });
  const history = await backend.listVersions({
    userId: USER_ID,
    role: 'USER',
    storeId,
    key: 'restore_me',
  });
  assert.equal(history.versions.length, 2);
  const firstVersion = history.versions[history.versions.length - 1];
  const restored = await backend.restoreVersion({
    userId: USER_ID,
    role: 'USER',
    storeId,
    key: 'restore_me',
    versionId: firstVersion.id,
  });
  assert.equal(restored.ok, true);
  assert.equal(restored.memory.value, 'first');
});

test('serves and deletes an image from the plugin store', async () => {
  const sha256 = 'a'.repeat(64);
  await models.MemoryImage.create({
    userId: new mongoose.Types.ObjectId(USER_ID),
    sha256,
    dhash: '0000000000000000',
    mime: 'image/png',
    width: 2,
    height: 1,
    bytes: 3,
    data: Buffer.from('abc'),
    source: 'attachment',
  });
  const image = await backend.getImageBySha({ userId: USER_ID, role: 'USER', sha256 });
  assert.equal(image.mime, 'image/png');
  assert.ok(image.dataUrl.startsWith('data:image/png;base64,'));
  const deleted = await backend.deleteImage({ userId: USER_ID, role: 'USER', sha256 });
  assert.equal(deleted.deleted, true);
  assert.equal(await models.MemoryImage.countDocuments({ sha256 }), 0);
});

test('reads and writes the user memory preference', async () => {
  const initial = await backend.getPreferences({ userId: USER_ID, role: 'USER' });
  assert.equal(initial.memories, true);
  const updated = await backend.setPreferences({
    userId: USER_ID,
    role: 'USER',
    memories: false,
  });
  assert.equal(updated.preferences.memories, false);
  const after = await backend.getPreferences({ userId: USER_ID, role: 'USER' });
  assert.equal(after.memories, false);
});

test('lists owned stores with counts', async () => {
  const listed = await backend.listStores({ userId: USER_ID, role: 'USER' });
  const names = listed.stores.map((store) => store.name);
  assert.ok(names.includes('Test store'));
  const testStore = listed.stores.find((store) => store.name === 'Test store');
  assert.equal(testStore.canWrite, true);
  assert.equal(testStore.isOwner, true);
});

test('builds stable context and dynamic blocks for injection', async () => {
  const store = await backend.createStore({ userId: USER_ID, role: 'USER', name: 'Inject store' });
  const storeId = store.store.id;
  await backend.createMemory({
    userId: USER_ID,
    role: 'USER',
    storeId,
    key: 'stable_fact',
    value: 'a stable fact',
    stable: true,
  });
  const result = await backend.prepareInjection({
    userId: USER_ID,
    storeId,
    scope: null,
    timezone: 'UTC',
  });
  assert.match(result.stableContext, /a stable fact/);
  assert.equal(result.dynamicContext, undefined);
});
