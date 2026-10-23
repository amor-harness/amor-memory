import { configureDatabase, models } from './db.mjs';
import { ensureMemorySchema } from './recall/schema.mjs';
import { configurePool } from './recall/vectorStore.mjs';
import { listOwnedMemories, ownedStore } from './backend/memories.mjs';
import { listDomains } from './backend/domains.mjs';
import { listVersions } from './backend/history.mjs';
import { listConversationMemories } from './backend/conversation.mjs';
import { memoryEnv, setConfig } from './backend/config.mjs';
import { createMemory, deleteMemory, updateMemory } from './backend/write.mjs';
import {
  clearStore,
  createStore,
  deleteStore,
  listStores,
  renameStore,
} from './backend/stores.mjs';
import { restoreVersion } from './backend/restore.mjs';
import { deleteImage, getImageBySha, getImageByUrl } from './backend/image.mjs';
import { getPreferences, setPreferences } from './backend/preferences.mjs';
import { preparePluginRecall } from './backend/recall-full.mjs';
import { prepareInjection } from './backend/injection.mjs';
import { ingestImageBuffer, ingestImageUrl } from './backend/images.mjs';
import { vfsDelete, vfsDomains, vfsImage, vfsList, vfsSet } from './backend/vfs.mjs';
import { defaultStore, resolveStore } from './backend/store.mjs';
import { handleProviderOperation } from './vfs/provider.mjs';
import { domainScope, registerDomainTools } from './domain/register.mjs';
import { extractionMethods } from './extraction/database.mjs';
import { runExtraction } from './extraction/processor.mjs';
import { registerMemoryVectorSync } from './extraction/vector-sync.mjs';
import * as extraction from './extraction/index.mjs';
import {
  createDomain,
  deleteDomain,
  setActiveDomains,
  updateDomain,
} from './backend/domain-write.mjs';

import type { Context, PluginRpcMeta } from 'cordis';
import type { ImageOrigin, MemoryFailure } from './backend/types.mjs';
import type { ProviderOperation } from './vfs/provider.mjs';
import type { MemoryChatRow, MemoryLLMConfig, MemoryUser } from './extraction/index.mjs';

/** The caller identity the kernel attaches to an exposed method. Every method
 *  here runs after the app authenticated the request, so the id and role are
 *  present by contract even though the kernel types them as optional. */
interface MemoryRpcMeta {
  userId: string;
  role: string;
}

/** Params of `memories.create`. */
type MemoryCreateParams = {
  storeId?: string;
  key: string;
  value: string;
  domainId?: string;
  stable?: boolean;
  injection?: string;
  locked?: boolean;
  conversationId?: string;
};

/** Params of `memories.update`. */
type MemoryUpdateParams = {
  storeId?: string;
  key: string;
  newKey?: string;
  value?: string;
  domainId?: string;
  stable?: boolean;
  injection?: string;
  locked?: boolean;
};

type MemoryDeleteParams = { storeId?: string; key: string };

type MemoryListParams = { storeId?: string };

type MemoryDomainsParams = { storeId?: string; conversationId?: string };

type MemoryVersionsParams = { storeId?: string; key: string };

type MemoryConversationParams = { storeId?: string; conversationId?: string };

type MemorySetActiveDomainsParams = {
  storeId?: string;
  conversationId?: string;
  domainIds?: readonly string[];
};

type MemoryPreferencesParams = { memories?: boolean };

type MemoryDomainCreateParams = {
  storeId?: string;
  name: string;
  kind: string;
  description?: string;
};

type MemoryDomainUpdateParams = {
  storeId?: string;
  domainId: string;
  name?: string;
  kind?: string;
  description?: string;
};

type MemoryDomainDeleteParams = { storeId?: string; domainId: string; force?: boolean };

type MemoryStoreCreateParams = { name: string };

type MemoryStoreRenameParams = { storeId: string; name: string };

type MemoryStoreShareParams = { storeId?: string };

type MemoryStoreShareSearchParams = { query: string; types?: string[] };

/** One principal a memory store's share dialog grants a role to. */
type StoreShareGrant = { type: string; id: string; accessRoleId: string };

/** One principal a memory store's share dialog revokes. */
type StoreShareRevoke = { type: string; id: string };

type MemoryStoreShareUpdateParams = {
  storeId?: string;
  updated?: StoreShareGrant[];
  removed?: StoreShareRevoke[];
  public?: boolean;
  publicAccessRoleId?: string;
};

type MemoryPermissionsSetParams = {
  roleName: string;
  updates: Record<string, boolean>;
};

type MemoryStoreClearParams = { storeId: string };

type MemoryStoreDeleteParams = { storeId: string };

type MemoryVersionRestoreParams = { storeId?: string; key: string; versionId?: string };

type MemoryImageParams = { sha256?: string };

type MemoryImageUrlParams = { url?: string };

type MemoryImageDeleteParams = { storeId?: string; sha256?: string };

/** The `/memory` provider's RPC envelope; the provider narrows it to one op.
 *  The record half lets the kernel's JSON payload narrow to it. */
type VfsProviderParams = ProviderOperation & Record<string, unknown>;

/** A turn that may recall memories into the prompt. The host also sends the
 *  turn's already-recalled keys as an array; they pass through untouched. */
type ChatBeforeRunPayload = {
  userId: string;
  storeId?: string;
  conversationId?: string;
  query?: string;
  contextQuery?: string;
  timezone?: string;
  turnId?: string;
  conversationDomainIds?: readonly string[];
  agent?: { memory_domains?: readonly string[] } | null;
};

type ConversationDeletedPayload = { userId: string; conversationIds: string | string[] };

type AllConversationsDeletedPayload = { userId: string };

type ConversationCompactedPayload = {
  userId: string;
  conversationId: string;
  retainedFromMessageId?: string;
};

type UserDeletedPayload = { userId: string };

/** The prompt contributions one turn asks for. */
type PromptInjectPayload = {
  userId?: string;
  conversationId?: string;
  agentId?: string;
  storeId?: string;
  timezone?: string;
  conversationDomainIds?: readonly string[];
  agent?: { memory_domains?: readonly string[] } | null;
};

/** The finished reply extraction consumes. */
type ChatAfterRunPayload = {
  userId: string;
  storeId: string;
  conversationId: string;
  messageId: string;
  llmConfig: MemoryLLMConfig;
  messages: MemoryChatRow[];
  instructions?: string;
  validKeys?: string[];
  tokenLimit?: number;
  user?: MemoryUser | null;
  timezone?: string;
  streamId?: string | null;
  jobCreatedAt?: Date;
  tenantId?: string | null;
  now?: Date;
};

/** One image the app wants indexed, as bytes or as a URL. */
type ImageIngestPayload = {
  userId?: string;
  storeId?: string;
  agentId?: string;
  url?: string;
  data?: string;
  mimeType?: string;
  source?: string;
  origin?: ImageOrigin;
  tenantId?: string;
};

/** The `/memory` mount's bridge: one operation per payload. */
type VfsHookPayload =
  | { method: 'resolve'; params: { userId?: string; storeId?: string } }
  | { method: 'default'; params: { userId: string } }
  | { method: 'list' | 'domains'; params: { userId?: string; storeId?: string } }
  | {
      method: 'set';
      params: {
        userId?: string;
        key: string;
        value: string;
        allowLocked?: boolean;
        storeId?: string;
        domainId?: string;
        conversationId?: string;
      };
    }
  | {
      method: 'delete';
      params: { userId?: string; key: string; allowLocked?: boolean; storeId?: string };
    }
  | {
      method: 'image';
      params: { userId?: string; id?: number; sha256?: string; storeId?: string };
    };

/** The message a thrown value carries, when it carries one. */
function messageOf(error: unknown): unknown {
  const message =
    typeof error === 'object' && error != null
      ? (error as { message?: unknown }).message
      : undefined;
  return message ?? error;
}

/** Whether a thrown value is an RPC failure with this HTTP status. */
function isStatus(error: unknown, status: number): boolean {
  return (
    typeof error === 'object' && error != null && (error as { status?: unknown }).status === status
  );
}

/** Narrows the kernel's optional caller identity to the value the ACL layer
 *  and the share service require. */
function metaOf(meta: PluginRpcMeta): MemoryRpcMeta {
  return { userId: meta.userId as string, role: meta.role as string };
}

function flatten(value: unknown, out: Record<string, string>): Record<string, string> {
  if (value == null) {
    return out;
  }
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry != null && typeof entry === 'object' && !Array.isArray(entry)) {
      flatten(entry, out);
    } else if (typeof entry === 'string') {
      out[key] = entry;
    }
  }
  return out;
}

export default {
  name: 'memory',
  inject: ['kernel', 'access', 'agentRuntime', 'tools', 'database'],
  async apply(ctx: Context, config: Record<string, unknown>): Promise<void> {
    const kernel = ctx.kernel;
    const access = ctx.access;
    const values = flatten(config, {});
    setConfig(values);
    const ensureActiveDatabase = async () => {
      try {
        const database = ctx.database;
        if (database == null) {
          return null;
        }
        const pool = await database.postgres();
        if (pool != null) {
          configurePool(pool);
          await ensureMemorySchema(pool);
        }
        const mongo = await database.mongo().catch(() => null);
        const appMongo = await database.appMongo().catch(() => null);
        if (mongo != null) {
          configureDatabase(mongo, appMongo);
        }
        return pool;
      } catch (error) {
        console.error('[memory] database setup failed:', messageOf(error));
        return null;
      }
    };
    void (async () => {
      for (let i = 0; i < 100; i += 1) {
        if ((await ensureActiveDatabase()) != null) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    })();

    const disposeHooks: Array<() => void> = [];
    /** Registers one exposed method, narrowing the kernel's payload to the
     *  request shape the app sends for it. */
    const expose = <Params extends Record<string, unknown> = Record<string, unknown>>(
      method: string,
      handler: (params: Params, meta: MemoryRpcMeta) => unknown,
    ): void => {
      ctx.kernel.expose(method, (params, meta) => handler(params as Params, metaOf(meta)));
    };
    /** Registers one kernel hook and keeps its teardown. The host hands each
     *  hook the JSON payload it emitted, which the hook narrows to its event. */
    const registerHook = <Payload extends Record<string, unknown>>(
      name: string,
      handler: (payload: Payload) => unknown,
    ): void => {
      const unsubscribe = kernel.hook(name, (payload) => handler(payload as Payload));
      if (typeof unsubscribe === 'function') {
        disposeHooks.push(unsubscribe);
      }
    };
    if (typeof ctx.on === 'function') {
      ctx.on('dispose', () => {
        for (const unsubscribe of disposeHooks.splice(0)) {
          unsubscribe();
        }
        extraction.resetMemoryExtractionState();
      });
    }
    registerMemoryVectorSync();
    registerDomainTools(ctx.tools);
    await kernel.call('memory.config.apply', { values });
    /** Owned stores are served by the plugin's own data layer; a store that
     *  isn't owned yet falls through to the app until ACL reads move too. */
    const localFirst = async <Result,>(
      localFn: () => Promise<Result>,
      _method: string,
      _params: object,
      _meta: MemoryRpcMeta,
    ): Promise<Result> => localFn();

    const localWrite = async <Success extends { ok: true }>(
      operation: () => Promise<Success | MemoryFailure>,
      _method: string,
      _params: object,
      _meta: MemoryRpcMeta,
    ): Promise<Success> => {
      const result = await operation();
      if (result.ok === true) {
        return result;
      }
      throw Object.assign(new Error(result.error), { status: result.status ?? 400 });
    };

    expose<VfsProviderParams>('memory.vfs.provider', async (params) =>
      handleProviderOperation(params),
    );

    expose<MemoryCreateParams>('memories.create', async (params, meta) =>
      localWrite(
        () =>
          createMemory({
            ...params,
            userId: meta?.userId,
            role: meta?.role,
          }),
        'memory.create',
        params ?? {},
        meta,
      ),
    );
    expose<MemoryUpdateParams>('memories.update', async (params, meta) =>
      localWrite(
        () =>
          updateMemory({
            ...params,
            userId: meta?.userId,
            role: meta?.role,
          }),
        'memory.update',
        params ?? {},
        meta,
      ),
    );
    expose<MemoryDeleteParams>('memories.delete', async (params, meta) =>
      localWrite(
        () =>
          deleteMemory({
            key: params?.key,
            storeId: params?.storeId,
            userId: meta?.userId,
            role: meta?.role,
          }),
        'memory.delete',
        params ?? {},
        meta,
      ),
    );

    expose<MemoryListParams>('memories.list', async (params, meta) =>
      localFirst(
        () =>
          listOwnedMemories({
            userId: meta?.userId,
            role: meta?.role,
            storeId: params?.storeId,
          }),
        'memory.list',
        params ?? {},
        meta,
      ),
    );
    expose<MemoryDomainsParams>('memories.domains', async (params, meta) =>
      localFirst(
        () =>
          listDomains({
            userId: meta?.userId,
            role: meta?.role,
            storeId: params?.storeId,
            conversationId: params?.conversationId,
          }),
        'memory.domains',
        params ?? {},
        meta,
      ),
    );
    expose<MemoryVersionsParams>('memories.versions', async (params, meta) =>
      localFirst(
        () =>
          listVersions({
            userId: meta?.userId,
            role: meta?.role,
            storeId: params?.storeId,
            key: params?.key,
          }),
        'memory.versions',
        params ?? {},
        meta,
      ),
    );
    expose<MemoryConversationParams>('memories.conversation', async (params, meta) =>
      localFirst(
        () =>
          listConversationMemories({
            userId: meta?.userId,
            role: meta?.role,
            storeId: params?.storeId,
            conversationId: params?.conversationId,
          }),
        'memory.conversation',
        params ?? {},
        meta,
      ),
    );

    const localMutation = async <Success extends { ok: true }>(
      operation: () => Promise<Success | MemoryFailure>,
      _method: string,
      _params: object,
      _meta: MemoryRpcMeta,
    ): Promise<Success> => {
      const result = await operation();
      if (result.ok === true) {
        return result;
      }
      throw Object.assign(new Error(result.error), { status: result.status ?? 400 });
    };

    expose<MemorySetActiveDomainsParams>('memories.domains.setActive', async (params, meta) => {
      const result = await localMutation(
        () =>
          setActiveDomains({
            userId: meta?.userId,
            role: meta?.role,
            storeId: params?.storeId,
            conversationId: params?.conversationId,
            domainIds: params?.domainIds,
          }),
        'memory.domains.setActive',
        params ?? {},
        meta,
      );
      return { conversationId: result.conversationId, activeDomainIds: result.activeDomainIds };
    });
    expose('memories.preferences', async (_params, meta) =>
      getPreferences({ userId: meta?.userId, role: meta?.role }),
    );
    expose<MemoryPreferencesParams>('memories.preferences.set', async (params, meta) =>
      setPreferences({
        userId: meta?.userId,
        role: meta?.role,
        memories: params?.memories,
      }),
    );
    expose<MemoryDomainCreateParams>('memories.domains.create', async (params, meta) => {
      const result = await localMutation(
        () =>
          createDomain({
            userId: meta?.userId,
            role: meta?.role,
            storeId: params?.storeId,
            name: params?.name,
            kind: params?.kind,
            description: params?.description,
          }),
        'memory.domains.create',
        params ?? {},
        meta,
      );
      return result.domain ?? result;
    });
    expose<MemoryDomainUpdateParams>('memories.domains.update', async (params, meta) => {
      const result = await localMutation(
        () =>
          updateDomain({
            userId: meta?.userId,
            role: meta?.role,
            storeId: params?.storeId,
            domainId: params?.domainId,
            name: params?.name,
            kind: params?.kind,
            description: params?.description,
          }),
        'memory.domains.update',
        params ?? {},
        meta,
      );
      return result.domain ?? result;
    });
    expose<MemoryDomainDeleteParams>('memories.domains.delete', async (params, meta) =>
      localMutation(
        () =>
          deleteDomain({
            userId: meta?.userId,
            role: meta?.role,
            storeId: params?.storeId,
            domainId: params?.domainId,
            force: params?.force === true,
          }),
        'memory.domains.delete',
        params ?? {},
        meta,
      ),
    );
    expose<MemoryStoreCreateParams>('memories.stores.create', async (params, meta) => {
      const result = await localMutation(
        () => createStore({ userId: meta?.userId, role: meta?.role, name: params?.name }),
        'memory.stores.create',
        params ?? {},
        meta,
      );
      const store = result.store ?? result;
      if (store?.id) {
        await access.grantOwner({
          resourceType: 'memoryStore',
          resourceId: store.id,
          userId: meta?.userId,
        });
      }
      return store;
    });
    expose<MemoryStoreRenameParams>('memories.stores.rename', async (params, meta) => {
      const result = await localMutation(
        () =>
          renameStore({
            userId: meta?.userId,
            role: meta?.role,
            storeId: params?.storeId,
            name: params?.name,
          }),
        'memory.stores.update',
        params ?? {},
        meta,
      );
      return result.store ?? result;
    });
    expose<MemoryStoreShareParams>('memories.stores.share', async (params, meta) => {
      const store = await ownedStore({ userId: meta?.userId, storeId: params?.storeId });
      if (!store) {
        throw Object.assign(new Error('Memory store not found.'), { status: 404 });
      }
      const [shared, permissions] = await Promise.all([
        access.shares({ resourceType: 'memoryStore', resourceId: String(store._id) }),
        access.rolePermissions({ roleName: meta?.role, permissionType: 'MEMORIES' }),
      ]);
      const shareState = shared as Record<string, unknown>;
      const rolePermissions = permissions as Record<string, unknown>;
      return {
        storeId: String(store._id),
        canSharePublic: rolePermissions.SHARE_PUBLIC === true,
        ...shareState,
      };
    });
    expose<MemoryStoreShareSearchParams>('memories.stores.share.search', async (params) =>
      access.search({ query: params?.query, types: params?.types }),
    );
    expose<MemoryStoreShareUpdateParams>('memories.stores.share.update', async (params, meta) => {
      const store = await ownedStore({ userId: meta?.userId, storeId: params?.storeId });
      if (!store) {
        throw Object.assign(new Error('Memory store not found.'), { status: 404 });
      }
      return access.updateShares({
        resourceType: 'memoryStore',
        resourceId: String(store._id),
        updated: params?.updated,
        removed: params?.removed,
        public: params?.public,
        publicAccessRoleId: params?.publicAccessRoleId,
      });
    });
    expose('memories.permissions', async (_params, meta) => {
      if (meta?.role !== 'ADMIN') {
        throw Object.assign(new Error('Forbidden'), { status: 403 });
      }
      return access.permissionsFor('MEMORIES');
    });
    expose<MemoryPermissionsSetParams>('memories.permissions.set', async (params, meta) => {
      if (meta?.role !== 'ADMIN') {
        throw Object.assign(new Error('Forbidden'), { status: 403 });
      }
      const result = await access.setRole({
        roleName: params?.roleName,
        permissionType: 'MEMORIES',
        updates: params?.updates,
      });
      if (!result.ok) {
        throw Object.assign(new Error(result.error), { status: result.status });
      }
      return result;
    });
    expose<MemoryStoreClearParams>('memories.stores.clear', async (params, meta) => {
      const result = await localMutation(
        () => clearStore({ userId: meta?.userId, role: meta?.role, storeId: params?.storeId }),
        'memory.stores.clear',
        params ?? {},
        meta,
      );
      return { deleted: result.deleted ?? 0 };
    });
    expose<MemoryStoreDeleteParams>('memories.stores.delete', async (params, meta) =>
      localMutation(
        () => deleteStore({ userId: meta?.userId, role: meta?.role, storeId: params?.storeId }),
        'memory.stores.delete',
        params ?? {},
        meta,
      ),
    );
    expose<MemoryVersionRestoreParams>('memories.versions.restore', async (params, meta) =>
      localWrite(
        () =>
          restoreVersion({
            userId: meta?.userId,
            role: meta?.role,
            key: params?.key,
            versionId: params?.versionId,
            storeId: params?.storeId,
          }),
        'memory.versions.restore',
        params ?? {},
        meta,
      ),
    );
    expose<MemoryImageParams>('memories.image', async (params, meta) => {
      try {
        return await getImageBySha({
          userId: meta?.userId,
          role: meta?.role,
          sha256: params?.sha256,
        });
      } catch (error) {
        if (!isStatus(error, 404)) {
          throw error;
        }
        return kernel.call('memory.image', {
          userId: meta?.userId,
          role: meta?.role,
          sha256: params?.sha256,
        });
      }
    });
    expose<MemoryImageUrlParams>('memories.image.url', async (params, meta) => {
      try {
        return await getImageByUrl({ userId: meta?.userId, role: meta?.role, url: params?.url });
      } catch (error) {
        if (!isStatus(error, 404)) {
          throw error;
        }
        return kernel.call('memory.image.url', {
          userId: meta?.userId,
          role: meta?.role,
          url: params?.url,
        });
      }
    });
    expose<MemoryImageDeleteParams>('memories.images.delete', async (params, meta) => {
      try {
        return await deleteImage({
          userId: meta?.userId,
          role: meta?.role,
          storeId: params?.storeId,
          sha256: params?.sha256,
        });
      } catch (error) {
        if (!isStatus(error, 404)) {
          throw error;
        }
        return kernel.call('memory.image.delete', {
          userId: meta?.userId,
          role: meta?.role,
          storeId: params?.storeId,
          sha256: params?.sha256,
        });
      }
    });
    /** A plugin can add to the system prompt (`stableContext`) and/or the
     *  dynamic `additional_instructions` tail (`dynamicContext`). */
    const registeredHooks: string[] = [];
    let hookError: string | null = null;
    try {
      if (typeof kernel?.hook === 'function') {
        registerHook<ChatBeforeRunPayload>('chat.beforeRun', async (payload) => {
          if (payload?.storeId != null && payload?.conversationId != null) {
            extraction.interruptMemoryExtractions(
              extraction.getMemoryExtractionKey({
                userId: payload.userId,
                storeId: payload.storeId,
                conversationId: payload.conversationId,
              }),
            );
          }
          if (
            payload?.storeId == null ||
            typeof payload?.query !== 'string' ||
            payload.query === ''
          ) {
            return null;
          }
          try {
            await ensureActiveDatabase();
            const methodSet = await extractionMethods();
            const contextMemoryKeys = new Set(
              await methodSet.getConversationMemoryKeys({
                userId: payload.userId,
                conversationId: String(payload.conversationId),
              }),
            );
            const scope = await domainScope({
              userId: payload.userId,
              storeId: payload.storeId,
              conversationDomainIds: payload.conversationDomainIds,
              agentDomainIds: payload.agent?.memory_domains,
            });
            const result = await preparePluginRecall({
              ...payload,
              query: payload.query,
              domainIds: scope?.domainIds,
              contextMemoryKeys,
            });
            if (result != null && Array.isArray(result.entries) && result.entries.length > 0) {
              await methodSet
                .markMemoriesRecalled({
                  userId: payload.userId,
                  storeId: payload.storeId,
                  conversationId: String(payload.conversationId),
                  turnId: payload.turnId,
                  keys: [...new Set(result.entries.map((entry) => entry.key))],
                })
                .catch((error) =>
                  console.error('[memory-plugin] failed to mark recalled memories:', error),
                );
            }
            return result ?? null;
          } catch (error) {
            console.error('[memory-plugin] local recall failed:', error);
            return null;
          }
        });
        registeredHooks.push('chat.beforeRun');
        registerHook<ConversationDeletedPayload>('conversation.deleted', async (payload) => {
          await ensureActiveDatabase();
          const methodSet = await extractionMethods();
          await methodSet.deleteConversationMemories({
            userId: payload?.userId,
            conversationId: payload?.conversationIds,
          });
          return { ok: true };
        });
        registeredHooks.push('conversation.deleted');
        registerHook<ImageIngestPayload>('image.ingest', async (payload) => {
          await ensureActiveDatabase();
          if (payload?.url != null) {
            return ingestImageUrl({ ...payload, userId: payload.userId });
          }
          if (payload?.data != null) {
            return ingestImageBuffer({
              ...payload,
              userId: payload.userId,
            } as Parameters<typeof ingestImageBuffer>[0]);
          }
          return null;
        });
        registeredHooks.push('image.ingest');
        registerHook<VfsHookPayload>('vfs.memory', async (payload) => {
          await ensureActiveDatabase();
          switch (payload?.method) {
            case 'resolve':
              return resolveStore(payload.params);
            case 'default':
              return defaultStore(payload.params);
            case 'list':
              return vfsList(payload.params);
            case 'domains':
              return vfsDomains(payload.params);
            case 'set':
              return vfsSet(payload.params);
            case 'delete':
              return vfsDelete(payload.params);
            case 'image':
              return vfsImage(payload.params);
            default:
              return null;
          }
        });
        registeredHooks.push('vfs.memory');
        registerHook<AllConversationsDeletedPayload>(
          'allConversations.deleted',
          async (payload) => {
            await ensureActiveDatabase();
            const methodSet = await extractionMethods();
            await methodSet.deleteAllConversationMemories(payload?.userId);
            return { ok: true };
          },
        );
        registeredHooks.push('allConversations.deleted');
        registerHook<ConversationCompactedPayload>('conversation.compacted', async (payload) => {
          await ensureActiveDatabase();
          const methodSet = await extractionMethods();
          await methodSet.deleteCompactedConversationMemories({
            userId: payload?.userId,
            conversationId: payload?.conversationId,
            retainedFromMessageId: payload?.retainedFromMessageId,
          });
          return { ok: true };
        });
        registeredHooks.push('conversation.compacted');
        registerHook<UserDeletedPayload>('user.deleted', async (payload) => {
          await ensureActiveDatabase();
          const methodSet = await extractionMethods();
          await methodSet.deleteAllUserMemories(payload?.userId);
          await methodSet.deleteAllUserMemoryImages(payload?.userId);
          await methodSet.deleteAllConversationMemories(payload?.userId);
          return { ok: true };
        });
        registeredHooks.push('user.deleted');
        registerHook<PromptInjectPayload>('prompt.inject', async (payload) => {
          if (payload?.storeId == null) {
            return null;
          }
          try {
            await ensureActiveDatabase();
            const scope = await domainScope({
              userId: payload.userId,
              storeId: payload.storeId,
              conversationDomainIds: payload.conversationDomainIds,
              agentDomainIds: payload.agent?.memory_domains,
            });
            const result = await prepareInjection({
              ...payload,
              storeId: payload.storeId,
              scope,
            });
            return result == null
              ? null
              : {
                  stableContext: result.stableContext,
                  dynamicContext: result.dynamicContext,
                };
          } catch (error) {
            console.error('[memory-plugin] prompt injection failed:', error);
            return null;
          }
        });
        registeredHooks.push('prompt.inject');
        registerHook<ChatAfterRunPayload>('chat.afterRun', async (payload) => {
          if (
            payload?.storeId == null ||
            payload?.llmConfig == null ||
            payload?.conversationId == null
          ) {
            return null;
          }
          const key = extraction.getMemoryExtractionKey({
            userId: payload.userId,
            storeId: payload.storeId,
            conversationId: payload.conversationId,
          });
          extraction.scheduleMemoryExtraction(key, {
            id: payload.messageId,
            run: async (signal) => {
              const result = await runExtraction({
                userId: payload.userId,
                storeId: payload.storeId,
                conversationId: payload.conversationId,
                messageId: payload.messageId,
                messages: payload.messages,
                llmConfig: payload.llmConfig,
                instructions: payload.instructions,
                validKeys: payload.validKeys,
                tokenLimit: payload.tokenLimit,
                user: payload.user,
                timezone: payload.timezone,
                streamId: payload.streamId,
                jobCreatedAt: payload.jobCreatedAt,
                tenantId: payload.tenantId,
                now: payload.now,
                signal,
              });
              const attachments = Array.isArray(result?.attachments)
                ? result.attachments.filter((entry) => entry != null)
                : [];
              if (attachments.length > 0) {
                await kernel
                  .call('memory.extraction.attachments', {
                    userId: payload.userId,
                    conversationId: payload.conversationId,
                    messageId: payload.messageId,
                    attachments,
                  })
                  .catch((error) =>
                    console.error('[memory-plugin] artifact bridge failed:', error),
                  );
              }
              return result;
            },
          });
          return { scheduled: true };
        });
        registeredHooks.push('chat.afterRun');
      } else {
        hookError = 'kernel.hook is unavailable';
      }
    } catch (error) {
      hookError = error instanceof Error ? error.message : String(error);
    }
    expose('memories.stores', async (_params, meta) =>
      listStores({ userId: meta?.userId, role: meta?.role }),
    );
  },
};
