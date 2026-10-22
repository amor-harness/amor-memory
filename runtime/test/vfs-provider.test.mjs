import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryProvider, MEMORY_INDEX_FILE } from '../vfs/provider-impl.mjs';

function fixture() {
  const rows = [
    { key: 'note', value: 'hello', domainId: 'd1', updated_at: new Date('2026-01-01T00:00:00Z') },
  ];
  const domains = [{ id: 'd1', name: 'Default', kind: 'personal', isDefault: true }];
  const calls = { set: [], delete: [] };
  const provider = createMemoryProvider({
    listMemories: async () => rows,
    listDomains: async () => domains,
    setMemory: async (params) => {
      calls.set.push(params);
      const index = rows.findIndex((row) => row.key === params.key);
      if (index >= 0) rows[index] = { ...rows[index], value: params.value };
      else rows.push({ key: params.key, value: params.value, domainId: params.domainId });
      return { ok: true, created: index < 0, domainId: params.domainId };
    },
    deleteMemory: async (params) => {
      calls.delete.push(params);
      const index = rows.findIndex((row) => row.key === params.key);
      if (index >= 0) rows.splice(index, 1);
      return { ok: true };
    },
  });
  return { provider, rows, calls, ctx: { req: { user: { id: 'u1' }, body: {} }, memoryStoreId: 's1' } };
}

test('memory provider lists the index, domains and entries', async () => {
  const { provider, ctx } = fixture();
  const listing = await provider.list('', ctx);
  assert.ok(listing);
  assert.deepEqual(listing.entries.map((entry) => entry.name).sort(), ['Default', MEMORY_INDEX_FILE]);
});

test('memory provider reads and writes a memory file', async () => {
  const { provider, rows, calls, ctx } = fixture();
  const read = await provider.read('Default/note.md', ctx);
  assert.equal(read.status, 'text');
  assert.equal(read.content, 'hello');
  const write = await provider.write('Default/fresh.md', 'fresh value', ctx);
  assert.ok(write.bytes > 0);
  assert.equal(calls.set[0].key, 'fresh');
  assert.equal(rows.find((row) => row.key === 'fresh').value, 'fresh value');
});

test('memory provider writes into a domain folder and deletes', async () => {
  const { provider, calls, ctx } = fixture();
  await provider.write('Default/fresh.md', 'domain value', ctx);
  assert.equal(calls.set[0].domainId, 'd1');
  const removed = await provider.delete('Default/note.md', ctx);
  assert.deepEqual(removed, { ok: true });
  assert.equal(calls.delete[0].key, 'note');
});

test('memory provider searches matching values', async () => {
  const { provider, ctx } = fixture();
  const result = await provider.search({ pattern: 'hello', maxResults: 10 }, ctx);
  assert.ok(result.results.some((path) => path.includes('Default/note.md')));
});
