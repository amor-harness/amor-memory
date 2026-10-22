import { backendInfo } from './backend/info.mjs';
import { listOwnedMemories, listOwnedStores, ownedStore } from './backend/memories.mjs';
import { listDomains } from './backend/domains.mjs';
import { listVersions } from './backend/history.mjs';
import { listConversationMemories } from './backend/conversation.mjs';
import { memoryEnv, setConfig } from './backend/config.mjs';
import { createMemory, deleteMemory, updateMemory } from './backend/write.mjs';
import { clearStore, createStore, deleteStore, listStores, renameStore } from './backend/stores.mjs';
import { restoreVersion } from './backend/restore.mjs';
import { deleteImage, getImageBySha, getImageByUrl } from './backend/image.mjs';
import { getPreferences, setPreferences } from './backend/preferences.mjs';
import { recallVectorStage } from './backend/recall.mjs';
import { preparePluginRecall } from './backend/recall-full.mjs';
import { prepareInjection } from './backend/injection.mjs';
import { ingestImageBuffer, ingestImageUrl } from './backend/images.mjs';
import { vfsDelete, vfsDomains, vfsImage, vfsList, vfsSet } from './backend/vfs.mjs';
import { defaultStore, formattedMemories, resolveStore } from './backend/store.mjs';
import { handleProviderOperation } from './vfs/provider.mjs';
import { domainScope, registerDomainTools } from './domain/register.mjs';
import { runExtraction } from './extraction/processor.mjs';
import { registerMemoryVectorSync } from './extraction/vector-sync.mjs';
import * as extraction from './extraction/index.mjs';
import { createDomain, deleteDomain, setActiveDomains, updateDomain } from './backend/domain-write.mjs';

function flatten(value, out) {
  for (const [key, entry] of Object.entries(value ?? {})) {
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
  async apply(ctx, config) {
    const kernel = ctx.kernel;
    const access = ctx.access;
    const values = flatten(config, {});
    setConfig(values);
    try {
      if (ctx.database?.mongo != null) {
        configureDatabase(ctx.database.mongo);
      }
      const pgConfig = {
        host: values.MEMORY_PG_HOST || '',
        port: Number(values.MEMORY_PG_PORT || 5432),
        database: values.MEMORY_PG_DB || '',
        user: values.MEMORY_PG_USER || '',
        password: values.MEMORY_PG_PASSWORD || '',
      };
      if (ctx.database?.postgres != null && pgConfig.host !== '') {
        const pool = await ctx.database.postgres(pgConfig);
        configurePool(pool);
        await ensureMemorySchema(pool);
      }
    } catch (error) {
      console.error('[memory] database setup failed:', error?.message ?? error);
    }
    registerMemoryVectorSync();
    registerDomainTools(ctx.tools);
    await kernel.call('memory.config.apply', { values });
    ctx.kernel.expose('config.snapshot', async () => kernel.call('memory.config.snapshot', {}));
    ctx.kernel.expose('memories.backend.info', async (_params, meta) =>
      backendInfo({ userId: meta?.userId }),
    );
    /** Owned stores are served by the plugin's own data layer; a store that
     *  isn't owned yet falls through to the app until ACL reads move too. */
    const localFirst = async (localFn, remoteMethod, params, meta) => {
      try {
        const result = await localFn();
        if (result != null && result.error == null) {
          return result;
        }
      } catch (error) {
        if (error?.status !== 404) {
          throw error;
        }
      }
      return kernel.call(remoteMethod, {
        ...params,
        userId: meta?.userId,
        role: meta?.role,
      });
    };

    const localWrite = async (operation, remoteMethod, params, meta) => {
      const result = await operation();
      if (result.ok === true) {
        return result;
      }
      if (result.status === 404) {
        return kernel.call(remoteMethod, {
          ...params,
          userId: meta?.userId,
          role: meta?.role,
        });
      }
      throw Object.assign(new Error(result.error), { status: result.status ?? 400 });
    };

    ctx.kernel.expose('memories.create', async (params, meta) =>
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
    ctx.kernel.expose('memories.update', async (params, meta) =>
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
    ctx.kernel.expose('memories.delete', async (params, meta) =>
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

    ctx.kernel.expose('memories.list', async (params, meta) =>
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
    ctx.kernel.expose('memories.domains', async (params, meta) =>
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
    ctx.kernel.expose('memories.versions', async (params, meta) =>
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
    ctx.kernel.expose('memories.conversation', async (params, meta) =>
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

    ctx.kernel.expose('memories.list.local', async (params, meta) => {
      const result = await listOwnedMemories({
        userId: meta?.userId,
        role: meta?.role,
        storeId: params?.storeId,
      });
      if (result.error) {
        throw Object.assign(new Error('Memory store not found.'), { status: result.error });
      }
      return result;
    });
    ctx.kernel.expose('memories.stores.local', async (_params, meta) =>
      listOwnedStores({ userId: meta?.userId, role: meta?.role }),
    );
    ctx.kernel.expose('memories.domains.local', async (params, meta) =>
      listDomains({
        userId: meta?.userId,
        role: meta?.role,
        storeId: params?.storeId,
        conversationId: params?.conversationId,
      }),
    );
    ctx.kernel.expose('memories.versions.local', async (params, meta) =>
      listVersions({
        userId: meta?.userId,
        role: meta?.role,
        storeId: params?.storeId,
        key: params?.key,
      }),
    );
    ctx.kernel.expose('memories.conversation.local', async (params, meta) =>
      listConversationMemories({
        userId: meta?.userId,
        role: meta?.role,
        storeId: params?.storeId,
        conversationId: params?.conversationId,
      }),
    );
    const localMutation = async (operation, remoteMethod, params, meta) => {
      const result = await operation();
      if (result.ok === true) {
        return result;
      }
      if (result.status === 404) {
        return kernel.call(remoteMethod, {
          ...params,
          userId: meta?.userId,
          role: meta?.role,
        });
      }
      throw Object.assign(new Error(result.error), { status: result.status ?? 400 });
    };

    ctx.kernel.expose('memories.domains.setActive', async (params, meta) => {
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
    ctx.kernel.expose('memories.preferences', async (_params, meta) =>
      getPreferences({ userId: meta?.userId, role: meta?.role }),
    );
    ctx.kernel.expose('memories.preferences.set', async (params, meta) =>
      setPreferences({
        userId: meta?.userId,
        role: meta?.role,
        memories: params?.memories,
      }),
    );
    ctx.kernel.expose('memories.domains.create', async (params, meta) => {
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
    ctx.kernel.expose('memories.domains.update', async (params, meta) => {
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
    ctx.kernel.expose('memories.domains.delete', async (params, meta) =>
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
    ctx.kernel.expose('memories.stores.create', async (params, meta) => {
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
    ctx.kernel.expose('memories.stores.rename', async (params, meta) => {
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
    ctx.kernel.expose('memories.stores.share', async (params, meta) => {
      const store = await ownedStore({ userId: meta?.userId, storeId: params?.storeId });
      if (!store) {
        throw Object.assign(new Error('Memory store not found.'), { status: 404 });
      }
      const [shared, permissions] = await Promise.all([
        access.shares({ resourceType: 'memoryStore', resourceId: String(store._id) }),
        access.rolePermissions({ roleName: meta?.role, permissionType: 'MEMORIES' }),
      ]);
      return {
        storeId: String(store._id),
        canSharePublic: permissions.SHARE_PUBLIC === true,
        ...shared,
      };
    });
    ctx.kernel.expose('memories.stores.share.search', async (params) =>
      access.search({ query: params?.query, types: params?.types }),
    );
    ctx.kernel.expose('memories.stores.share.update', async (params, meta) => {
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
    ctx.kernel.expose('memories.permissions', async (_params, meta) => {
      if (meta?.role !== 'ADMIN') {
        throw Object.assign(new Error('Forbidden'), { status: 403 });
      }
      return access.permissionsFor('MEMORIES');
    });
    ctx.kernel.expose('memories.permissions.set', async (params, meta) => {
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
    ctx.kernel.expose('memories.stores.clear', async (params, meta) => {
      const result = await localMutation(
        () => clearStore({ userId: meta?.userId, role: meta?.role, storeId: params?.storeId }),
        'memory.stores.clear',
        params ?? {},
        meta,
      );
      return { deleted: result.deleted ?? 0 };
    });
    ctx.kernel.expose('memories.stores.delete', async (params, meta) =>
      localMutation(
        () => deleteStore({ userId: meta?.userId, role: meta?.role, storeId: params?.storeId }),
        'memory.stores.delete',
        params ?? {},
        meta,
      ),
    );
    ctx.kernel.expose('memories.versions.restore', async (params, meta) =>
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
    ctx.kernel.expose('memories.image', async (params, meta) => {
      try {
        return await getImageBySha({
          userId: meta?.userId,
          role: meta?.role,
          sha256: params?.sha256,
        });
      } catch (error) {
        if (error?.status !== 404) {
          throw error;
        }
        return kernel.call('memory.image', {
          userId: meta?.userId,
          role: meta?.role,
          sha256: params?.sha256,
        });
      }
    });
    ctx.kernel.expose('memories.image.url', async (params, meta) => {
      try {
        return await getImageByUrl({ userId: meta?.userId, role: meta?.role, url: params?.url });
      } catch (error) {
        if (error?.status !== 404) {
          throw error;
        }
        return kernel.call('memory.image.url', {
          userId: meta?.userId,
          role: meta?.role,
          url: params?.url,
        });
      }
    });
    ctx.kernel.expose('memories.images.delete', async (params, meta) => {
      try {
        return await deleteImage({
          userId: meta?.userId,
          role: meta?.role,
          storeId: params?.storeId,
          sha256: params?.sha256,
        });
      } catch (error) {
        if (error?.status !== 404) {
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
    ctx.kernel.expose('memory.store.resolve', async (params) => resolveStore(params ?? {}));
    ctx.kernel.expose('memory.store.default', async (params) => defaultStore(params ?? {}));
    ctx.kernel.expose('memory.formatted', async (params) => formattedMemories(params ?? {}));
    ctx.kernel.expose('memory.domain.scope', async (params) => domainScope(params ?? {}));
    ctx.kernel.expose('memory.vfs.list', async (params, meta) =>
      vfsList({ ...(params ?? {}), userId: params?.userId ?? meta?.userId }),
    );
    ctx.kernel.expose('memory.vfs.domains', async (params, meta) =>
      vfsDomains({ ...(params ?? {}), userId: params?.userId ?? meta?.userId }),
    );
    ctx.kernel.expose('memory.vfs.set', async (params, meta) =>
      vfsSet({ ...(params ?? {}), userId: params?.userId ?? meta?.userId }),
    );
    ctx.kernel.expose('memory.vfs.delete', async (params, meta) =>
      vfsDelete({ ...(params ?? {}), userId: params?.userId ?? meta?.userId }),
    );
    ctx.kernel.expose('memory.vfs.provider', async (params) =>
      handleProviderOperation(params ?? {}),
    );
    ctx.kernel.expose('memory.vfs.image', async (params, meta) =>
      vfsImage({ ...(params ?? {}), userId: params?.userId ?? meta?.userId }),
    );
    const registeredHooks = [];
    let hookError = null;
    try {
      if (typeof kernel?.hook === 'function') {
        kernel.hook('chat.beforeRun', async (payload) => {
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
            const result = await preparePluginRecall(payload);
            return result ?? null;
          } catch (error) {
            console.error('[memory-plugin] local recall failed:', error);
            return null;
          }
        });
        registeredHooks.push('chat.beforeRun');
        kernel.hook('prompt.inject', async (payload) => {
          if (payload?.storeId == null) {
            return null;
          }
          try {
            const result = await prepareInjection(payload);
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
        kernel.hook('chat.afterRun', async (payload) => {
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
              if (Array.isArray(result.attachments) && result.attachments.length > 0) {
                await kernel
                  .call('memory.extraction.attachments', {
                    userId: payload.userId,
                    conversationId: payload.conversationId,
                    messageId: payload.messageId,
                    attachments: result.attachments,
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
    ctx.kernel.expose('memory.image.ingest', async (params, meta) => {
      const userId = params?.userId ?? meta?.userId;
      if (params?.url != null) {
        return ingestImageUrl({ ...params, userId });
      }
      if (params?.data != null) {
        return ingestImageBuffer({
          ...params,
          userId,
          buffer: Buffer.from(params.data, 'base64'),
        });
      }
      return { ok: false, skipped: true };
    });
    ctx.kernel.expose('memories.recall.plugin', async (params, meta) =>
      preparePluginRecall({
        ...params,
        userId: meta?.userId,
        collectDiagnostics: params?.collectDiagnostics === true,
      }),
    );
    ctx.kernel.expose('memories.recall.local', async (params, meta) =>
      recallVectorStage({
        userId: meta?.userId,
        storeId: params?.storeId,
        domainIds: params?.domainIds,
        query: params?.query,
      }),
    );
    ctx.kernel.expose('memories.stores', async (_params, meta) =>
      listStores({ userId: meta?.userId, role: meta?.role }),
    );
  },
};
