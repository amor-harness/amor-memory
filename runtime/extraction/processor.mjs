import { createRequire } from 'node:module';
import mongoose from 'mongoose';
import { connectAppDb, models } from '../db.mjs';
import { extractionMethods } from './database.mjs';
import { writableStore } from '../backend/memories.mjs';
import { getExtractionPrompt } from '../backend/extraction-prompt.mjs';
import { createMemoryDomainRuntime } from '../domain/domain.mjs';
import * as memory from './index.mjs';

const require = createRequire(import.meta.url);
const { HumanMessage, AIMessage, SystemMessage, ToolMessage } = require('@librechat/agents/langchain/messages');

function toMessages(rows) {
  return (rows ?? [])
    .map((row) => {
      const content = row?.content;
      if (content == null || content === '') {
        return null;
      }
      const fields = {
        content,
        ...(row.additional_kwargs != null ? { additional_kwargs: row.additional_kwargs } : {}),
        ...(row.tool_calls != null ? { tool_calls: row.tool_calls } : {}),
        ...(row.tool_call_id != null ? { tool_call_id: row.tool_call_id } : {}),
        ...(row.name != null ? { name: row.name } : {}),
        ...(row.response_metadata != null
          ? { response_metadata: row.response_metadata }
          : {}),
        ...(row.artifact != null ? { artifact: row.artifact } : {}),
      };
      switch (row.role) {
        case 'tool':
          return new ToolMessage(fields);
        case 'assistant':
        case 'ai':
          return new AIMessage(fields);
        case 'system':
          return new SystemMessage(fields);
        default:
          return new HumanMessage(fields);
      }
    })
    .filter(Boolean);
}

async function conversationDomains({ userId, conversationId }) {
  if (!conversationId) {
    return undefined;
  }
  const app = await connectAppDb();
  const convo = await app
    .collection('conversations')
    .findOne({ conversationId, user: String(userId) }, { projection: { activeDomainIds: 1 } });
  return Array.isArray(convo?.activeDomainIds) ? convo.activeDomainIds : undefined;
}

async function setConversationDomains({ userId, conversationId, domainIds }) {
  if (!conversationId) {
    return;
  }
  const app = await connectAppDb();
  await app
    .collection('conversations')
    .updateOne(
      { conversationId, user: String(userId) },
      { $set: { activeDomainIds: domainIds } },
    );
}

async function attachmentsFromWrites({ userId, storeId, conversationId, messageId, since }) {
  const db = await models();
  const versions = await db.MemoryVersion.find({
    storeId: String(storeId),
    createdAt: { $gte: since },
  })
    .sort({ createdAt: 1 })
    .lean();
  const latest = new Map();
  for (const version of versions) {
    latest.set(version.key, version);
  }
  return [...latest.values()].map((version) => ({
    type: 'memory',
    messageId,
    conversationId,
    memory: {
      key: version.key,
      value: version.value,
      ...(Array.isArray(version.tags) && version.tags.length > 0 ? { tags: version.tags } : {}),
      tokenCount: version.tokenCount ?? 0,
      type: 'update',
      storeId: String(storeId),
      ...(version.domainId ? { domainId: version.domainId } : {}),
    },
  }));
}

/** Builds the original processor and runs one extraction window. */
export async function runExtraction({
  userId,
  storeId,
  conversationId,
  messageId,
  messages,
  llmConfig,
  instructions,
  validKeys,
  tokenLimit,
  user,
  timezone,
  signal,
  streamId,
  jobCreatedAt,
  tenantId,
  now,
  appConfig,
}) {
  const methods = await extractionMethods();
  const access = await writableStore({ userId, storeId });
  if (!access) {
    return { attachments: [], withoutKeys: '', skipped: true };
  }
  const ownerId = access.ownerId;
  const canWrite = access.isOwner || access.canWrite !== false;
  const domainRuntime = await createMemoryDomainRuntime({
    userId: String(ownerId),
    storeId: String(storeId),
    canWrite,
    toolNames: ['search_domains', 'create_domain'],
    deps: {
      getConversationDomainIds: () => conversationDomains({ userId: ownerId, conversationId }),
      setConversationDomainIds: (domainIds) =>
        setConversationDomains({ userId: ownerId, conversationId, domainIds }),
      methods,
    },
  });
  const userPrompt = await getExtractionPrompt({ userId: ownerId });
  const [withoutKeys, processMemory] = await memory.createMemoryProcessor({
    res: { headersSent: false, write() {} },
    userId: ownerId,
    storeId,
    messageId,
    conversationId,
    config: {
      validKeys,
      instructions: userPrompt.trim() !== '' ? userPrompt : instructions,
      llmConfig,
      tokenLimit,
    },
    memoryMethods: methods,
    domains: domainRuntime.scope,
    domainTools: domainRuntime.tools,
    timezone,
    user,
    streamId,
    jobCreatedAt,
    tenantId,
    now,
    appConfig,
  });
  if (typeof processMemory !== 'function') {
    return { attachments: [], withoutKeys };
  }
  const startedAt = new Date();
  await processMemory(toMessages(messages), signal);
  const attachments = await attachmentsFromWrites({
    userId: ownerId,
    storeId,
    conversationId,
    messageId,
    since: startedAt,
  }).catch(() => []);
  return { attachments, withoutKeys };
}

export { attachmentsFromWrites };
