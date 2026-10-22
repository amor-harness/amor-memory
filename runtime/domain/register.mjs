import mongoose from 'mongoose';
import {
  MEMORY_DOMAIN_TOOL_DEFINITIONS,
  createMemoryDomainRuntime,
  resolveMemoryDomainScope,
} from './domain.mjs';
import { extractionMethods } from '../extraction/database.mjs';
import { writableStore } from '../backend/memories.mjs';

async function buildRuntime(context) {
  if (!context?.userId || !context?.storeId) {
    return null;
  }
  const access = await writableStore({ userId: context.userId, storeId: context.storeId });
  if (!access) {
    return null;
  }
  const methods = await extractionMethods();
  const conversationId = context.conversationId ?? '';
  const userObjectId = new mongoose.Types.ObjectId(String(context.userId));
  const conversations = mongoose.connection.collection('conversations');
  let agentDomainIds = context.agentDomainIds;
  if (!Array.isArray(agentDomainIds) && context.agentId) {
    const agent = await mongoose.connection
      .collection('agents')
      .findOne({ id: context.agentId }, { projection: { memory_domains: 1 } });
    agentDomainIds = agent?.memory_domains;
  }
  return createMemoryDomainRuntime({
    userId: context.userId,
    storeId: String(access.store._id),
    canWrite: true,
    ...(Array.isArray(agentDomainIds) ? { agentDomainIds } : {}),
    toolNames: MEMORY_DOMAIN_TOOL_DEFINITIONS.map((definition) => definition.name),
    deps: {
      getConversationDomainIds: async () => {
        if (!conversationId) {
          return undefined;
        }
        const convo = await conversations.findOne({
          conversationId,
          user: userObjectId,
        });
        return convo?.activeDomainIds;
      },
      setConversationDomainIds: async (domainIds) => {
        if (!conversationId) {
          return;
        }
        await conversations.updateOne(
          { conversationId, user: userObjectId },
          { $set: { activeDomainIds: domainIds } },
        );
      },
      methods: {
        ensureDefaultMemoryDomain: methods.ensureDefaultMemoryDomain,
        listMemoryDomains: methods.listMemoryDomains,
        resolveMemoryDomain: methods.resolveMemoryDomain,
        createMemoryDomain: methods.createMemoryDomain,
      },
    },
  });
}

/** Statically registers the four domain tools. Run context arrives in the
 *  invocation meta; no app-side domain runtime is needed. */
export function registerDomainTools(tools) {
  for (const definition of MEMORY_DOMAIN_TOOL_DEFINITIONS) {
    tools.register({
      name: definition.name,
      description: definition.description,
      parameters: definition.parameters,
      autoInclude: true,
      handler: async (args, invocation) => {
        const context = invocation.meta?.context ?? {};
        const runtime = await buildRuntime(context);
        if (runtime == null) {
          return { content: 'This run has no writable memory store.' };
        }
        const tool = runtime.tools.find((candidate) => candidate.name === definition.name);
        if (tool == null) {
          return { content: `Domain tool "${definition.name}" is unavailable.`, isError: true };
        }
        const result = await tool.invoke(args);
        return {
          content:
            typeof result === 'string'
              ? result
              : typeof result?.content === 'string'
                ? result.content
                : JSON.stringify(result),
        };
      },
    });
  }
}

/** Resolves the active domain scope for prompt injection and recall. */
export async function domainScope(params) {
  if (!params?.userId || !params?.storeId) {
    return null;
  }
  const methods = await extractionMethods();
  return resolveMemoryDomainScope({
    userId: params.userId,
    storeId: params.storeId,
    ...(Array.isArray(params.conversationDomainIds)
      ? { conversationDomainIds: params.conversationDomainIds }
      : {}),
    ...(Array.isArray(params.agentDomainIds) ? { agentDomainIds: params.agentDomainIds } : {}),
    readOnly: params.readOnly === true,
    methods: {
      ensureDefaultMemoryDomain: methods.ensureDefaultMemoryDomain,
      listMemoryDomains: methods.listMemoryDomains,
      resolveMemoryDomain: methods.resolveMemoryDomain,
    },
  });
}
