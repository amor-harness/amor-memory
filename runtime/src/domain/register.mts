import {
  MEMORY_DOMAIN_TOOL_DEFINITIONS,
  createMemoryDomainRuntime,
  resolveMemoryDomainScope,
} from './domain.mjs';
import type { DomainToolParameters, MemoryDomainToolArgs } from './domain.mjs';
import { connectAppDb } from '../db.mjs';
import { extractionMethods } from '../extraction/database.mjs';
import { writableStore } from '../backend/memories.mjs';

/** The run context a domain tool invocation carries. */
interface DomainRunContext {
  userId?: string;
  storeId?: string;
  conversationId?: string;
  agentId?: string;
  agentDomainIds?: string[];
}

interface DomainToolRegistration {
  name: string;
  description: string;
  parameters: DomainToolParameters;
  autoInclude?: boolean;
  handler(
    args: MemoryDomainToolArgs,
    invocation: { meta?: { context?: DomainRunContext } },
  ): Promise<{ content: string; isError?: boolean }>;
}

interface DomainToolRegistrar {
  register(registration: DomainToolRegistration): () => void;
}

interface DomainScopeParams {
  userId?: string;
  storeId?: string;
  conversationDomainIds?: readonly string[];
  agentDomainIds?: readonly string[];
  readOnly?: boolean;
}

async function buildRuntime(context: DomainRunContext) {
  if (!context?.userId || !context?.storeId) {
    return null;
  }
  const access = await writableStore({ userId: context.userId, storeId: context.storeId });
  if (!access) {
    return null;
  }
  const methods = await extractionMethods();
  const app = await connectAppDb();
  const conversationId = context.conversationId ?? '';
  const user = String(context.userId);
  const conversations = app.collection('conversations');
  let agentDomainIds = context.agentDomainIds;
  if (!Array.isArray(agentDomainIds) && context.agentId) {
    const agent = await app
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
          user,
        });
        return convo?.activeDomainIds;
      },
      setConversationDomainIds: async (domainIds) => {
        if (!conversationId) {
          return;
        }
        await conversations.updateOne(
          { conversationId, user },
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

function toolResultContent(result: string | { content: string | object[] }): string {
  if (typeof result === 'string') {
    return result;
  }
  return typeof result.content === 'string' ? result.content : JSON.stringify(result);
}

/** Statically registers the four domain tools. Run context arrives in the
 *  invocation meta; no app-side domain runtime is needed. */
export function registerDomainTools(tools: DomainToolRegistrar) {
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
        return { content: toolResultContent(result) };
      },
    });
  }
}

/** Resolves the active domain scope for prompt injection and recall. */
export async function domainScope(params: DomainScopeParams) {
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
