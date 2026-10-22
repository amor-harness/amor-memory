import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Run, GraphEvents } from '@librechat/agents';

let server;
let memory;
let extractionMethods;

before(async () => {
  server = await MongoMemoryServer.create();
  process.env.MONGO_URI = server.getUri();
  ({ extractionMethods } = await import('../extraction/database.mjs'));
  memory = await import('../extraction/index.mjs');
});

after(async () => {
  await mongoose.disconnect();
  await server.stop();
});

test('collects a memory artifact from a tool-end event', async () => {
  const methods = await extractionMethods();
  const originalCreate = Run.create;
  Run.create = async ({ customHandlers }) => ({
    processStream: async () => {
      await customHandlers[GraphEvents.TOOL_END].handle(
        GraphEvents.TOOL_END,
        {
          output: {
            tool_call_id: 'tool-1',
            artifact: { memory: { key: 'k', value: 'v', type: 'update' } },
          },
        },
        {},
        {},
      );
      return 'done';
    },
  });
  try {
    const [, processMemory] = await memory.createMemoryProcessor({
      res: { headersSent: false, write() {} },
      userId: new mongoose.Types.ObjectId(),
      storeId: 'store-1',
      messageId: 'msg-1',
      conversationId: 'convo-1',
      config: {
        validKeys: [],
        instructions: 'extract',
        llmConfig: { provider: 'openai', model: 'gpt-4o-mini' },
        tokenLimit: 1000,
      },
      memoryMethods: methods,
    });
    const attachments = await processMemory([], undefined);
    assert.equal(attachments.length, 1);
    assert.equal(attachments[0].memory.key, 'k');
  } finally {
    Run.create = originalCreate;
  }
});
