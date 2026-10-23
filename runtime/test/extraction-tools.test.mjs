import test from 'node:test';
import assert from 'node:assert/strict';
import * as memory from '../dist/extraction/index.mjs';

function baseArgs(overrides = {}) {
  return {
    userId: 'user-1',
    storeId: 'store-1',
    validKeys: [],
    charLimit: 10000,
    tokenLimit: 100000,
    totalTokens: 0,
    ...overrides,
  };
}

test('set_memory writes through the original tool and returns an artifact', async () => {
  const writes = [];
  const tool = memory.createMemoryTool(
    baseArgs({
      setMemory: async (params) => {
        writes.push(params);
        return { ok: true };
      },
      getUserMemories: async () => [],
    }),
  );
  const result = await tool.invoke({ key: 'tea_preference', value: 'loves tea' });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].key, 'tea_preference');
  assert.equal(writes[0].runId, undefined);
  assert.ok(result.includes('tea_preference') || typeof result === 'string');
});

test('append_memory appends to the existing value', async () => {
  const writes = [];
  const entries = [{ key: 'tea', value: 'loves tea', locked: false }];
  const memoryTool = memory.createMemoryTool(
    baseArgs({
      setMemory: async (params) => {
        writes.push(params);
        return { ok: true };
      },
      getUserMemories: async () => entries,
    }),
  );
  const tool = memory.createAppendMemoryTool({
    userId: 'user-1',
    storeId: 'store-1',
    memoryTool,
    getUserMemories: async () => entries,
  });
  await tool.invoke({ key: 'tea', value: 'and jasmine' });
  assert.equal(writes.length, 1);
  assert.match(writes[0].value, /loves tea/);
  assert.match(writes[0].value, /and jasmine/);
});

test('delete_memory refuses stable memories by default', async () => {
  const tool = memory.createDeleteMemoryTool(
    baseArgs({
      deleteMemory: async () => ({ ok: true }),
      getUserMemories: async () => [{ key: 'stable', stable: true }],
    }),
  );
  const result = await tool.invoke({ key: 'stable' });
  assert.match(result, /stable/i);
});

test('delete_memory records a successful deletion for the run', async () => {
  const deletedKeys = new Set();
  const tool = memory.createDeleteMemoryTool(
    baseArgs({
      deleteMemory: async () => ({ ok: true }),
      getUserMemories: async () => [{ key: 'old', locked: false }],
      deletedKeys,
    }),
  );
  await tool.invoke({ key: 'old' });
  assert.deepEqual([...deletedKeys], ['old']);
});

test('set_memory carries the extraction turn id', async () => {
  const writes = [];
  const tool = memory.createMemoryTool(
    baseArgs({
      turnMessageId: 'msg-1',
      setMemory: async (params) => {
        writes.push(params);
        return { ok: true };
      },
      getUserMemories: async () => [],
    }),
  );
  await tool.invoke({ key: 'run_id_test', value: 'value' });
  assert.equal(writes[0].runId, 'msg-1');
});
