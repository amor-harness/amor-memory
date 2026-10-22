import { Types } from 'mongoose';
import type * as t from '../types';
import { parseTrailingTags, memoryContentOf, memoryTagField } from './memoryTags';
import { deleteMemoryVersions, recordMemoryVersion } from './memoryVersion';
import { memoryTimeField } from '../util/memoryTime';
import { emitMemoryChange } from '../memoryEvents';
import { logger } from '@librechat/data-schemas';

/** Store filter: `storeId: null` matches both null and missing fields, so
 *  entries written before stores existed stay reachable. */
const partitionFilter = (storeId?: string | Types.ObjectId) => ({
  storeId: storeId ?? null,
});

/** Change events carry plain strings (the vector store keys off them). */
const storeIdOf = (storeId?: string | Types.ObjectId): string | undefined =>
  storeId ? String(storeId) : undefined;

/** Domain filter for reads: a run only ever reads the domains it has active,
 *  so an empty/absent set means "no domain restriction" (legacy callers). */
const domainFilter = (domainIds?: Array<string | Types.ObjectId>) => {
  const ids = (domainIds ?? []).map(String).filter((id) => id !== '');
  return ids.length > 0 ? { domainId: { $in: ids } } : {};
};

/** Rejection reason shared by the locked-memory write guards, so callers can
 *  surface a precise message and point the user at the panel toggle. */
const LOCKED_UPDATE_REASON =
  'Cannot update a locked memory. Unlock it in the Memories panel first.';
const LOCKED_DELETE_REASON =
  'Cannot delete a locked memory. Unlock it in the Memories panel first.';

/** Whether an entry is locked. Only the memory panel and the `/memory` VFS
 *  mount may change a locked entry; every LLM write path is guarded. */
const isLocked = (entry: { locked?: boolean } | null | undefined): boolean =>
  entry?.locked === true;

/** An entry's injection point as its recorded state should carry it: anything
 *  but an explicit `additional` is the system prompt, which is what rows
 *  written before the field existed mean. */
const injectionOf = (value?: t.MemoryInjection | null): t.MemoryInjection =>
  value === 'additional' ? 'additional' : 'system';

// Factory function that takes mongoose instance and returns the methods
export function createMemoryMethods(mongoose: typeof import('mongoose')): {
  setMemory: ({
    userId,
    key,
    value,
    tokenCount,
    storeId,
  }: t.SetMemoryParams) => Promise<t.MemoryResult>;
  setMemoryStable: ({
    userId,
    key,
    storeId,
    stable,
  }: t.SetMemoryStableParams) => Promise<t.MemoryResult>;
  createMemory: ({
    userId,
    key,
    value,
    tokenCount,
    storeId,
  }: t.SetMemoryParams) => Promise<t.MemoryResult>;
  deleteMemory: ({ userId, key, storeId }: t.DeleteMemoryParams) => Promise<t.MemoryResult>;
  getAllUserMemories: (userId: string | Types.ObjectId) => Promise<t.IMemoryEntryLean[]>;
  getUserMemories: ({
    userId,
    storeId,
    excludeKeys,
  }: t.GetUserMemoriesParams) => Promise<t.IMemoryEntryLean[]>;
  getMemoryEntriesByKeys: ({
    userId,
    storeId,
    keys,
  }: t.GetMemoryEntriesByKeysParams) => Promise<t.IMemoryEntryLean[]>;
  getFormattedMemories: ({
    userId,
    storeId,
    domainIds,
    excludeConversationId,
    timezone,
  }: t.GetFormattedMemoriesParams) => Promise<t.FormattedMemoriesResult>;
  deleteAllUserMemories: (userId: string | Types.ObjectId) => Promise<number>;
  setConversationMemory: (params: t.SetConversationMemoryParams) => Promise<t.MemoryResult>;
  getConversationMemoryKeys: (params: t.GetConversationMemoryKeysParams) => Promise<string[]>;
  getConversationMemories: (
    params: t.GetConversationMemoriesParams,
  ) => Promise<t.IMemoryEntryLean[]>;
  getConversationMemoryDetails: (
    params: t.GetConversationMemoryKeysParams,
  ) => Promise<
    Array<{ entry: t.IMemoryEntryLean; source: 'extracted' | 'recalled'; recallCount: number }>
  >;
  getMemoryInjectionEntries: (
    params: t.GetMemoryInjectionEntriesParams,
  ) => Promise<t.IMemoryEntryLean[]>;
  getMemoryExtractionEntries: (
    params: t.GetMemoryExtractionEntriesParams,
  ) => Promise<t.IMemoryEntryLean[]>;
  getStoreTagVocabulary: (params: t.GetStoreTagVocabularyParams) => Promise<t.MemoryTagUsage[]>;
  markMemoriesRecalled: (params: t.MarkMemoriesRecalledParams) => Promise<void>;
  evictMemoriesToFitCapacity: (params: t.EvictMemoriesParams) => Promise<t.MemoryEvictionResult>;
  deleteConversationMemories: (params: t.DeleteConversationMemoriesParams) => Promise<number>;
  deleteCompactedConversationMemories: (
    params: t.DeleteCompactedConversationMemoriesParams,
  ) => Promise<number>;
  deleteAllConversationMemories: (userId: string | Types.ObjectId) => Promise<number>;
} {
  /**
   * Creates a new memory entry for a user
   * Throws an error if a memory with the same key already exists
   */
  async function createMemory({
    userId,
    key,
    value,
    tokenCount = 0,
    storeId,
    domainId,
    defaultDomainId,
    stable,
    injection,
    locked,
  }: t.SetMemoryParams): Promise<t.MemoryResult> {
    try {
      if (key?.toLowerCase() === 'nothing') {
        return { ok: false };
      }

      const MemoryEntry = mongoose.models.MemoryEntry;
      const existingMemory = await MemoryEntry.findOne({
        userId,
        key,
        ...partitionFilter(storeId),
      });
      /** A locked memory is never overwritten by a create either: the
       *  duplicate-key rejection below already refuses an existing key, so no
       *  caller can clobber one through this path. */
      if (existingMemory) {
        throw new Error('Memory with this key already exists');
      }

      const now = new Date();
      const tags = parseTrailingTags(value).tags;
      const created = await MemoryEntry.create({
        userId,
        key,
        value,
        tags,
        tokenCount,
        ...(storeId ? { storeId } : {}),
        ...(domainId || defaultDomainId ? { domainId: String(domainId ?? defaultDomainId) } : {}),
        ...(typeof stable === 'boolean' ? { stable } : {}),
        ...(injection != null ? { injection } : {}),
        ...(typeof locked === 'boolean' ? { locked } : {}),
        /** A just-created memory counts as just-used: its last-recall stamp is
         *  its creation time, so capacity eviction drops older memories first. */
        lastRecalledAt: now,
        updated_at: now,
      });
      /** The entry's first state: the history starts at creation, so every
       *  later edit has something to be compared against and restored to. */
      await recordMemoryVersion(mongoose, {
        userId,
        memoryId: created._id,
        key,
        value,
        tags,
        storeId,
        domainId: created.domainId != null ? String(created.domainId) : undefined,
        tokenCount,
        stable: created.stable === true,
        injection: injectionOf(created.injection),
        locked: created.locked === true,
      });
      emitMemoryChange({
        type: 'create',
        userId: String(userId),
        key,
        storeId: storeIdOf(storeId),
        domainId: storeIdOf(domainId) ?? storeIdOf(defaultDomainId),
        value,
        tags,
        stable: stable === true,
      });

      return {
        ok: true,
        created: true,
        ...(created?.domainId != null ? { domainId: String(created.domainId) } : {}),
      };
    } catch (error) {
      throw new Error(
        `Failed to create memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Sets or updates a memory entry for a user
   */
  async function setMemory({
    userId,
    key,
    value,
    tokenCount = 0,
    storeId,
    domainId,
    defaultDomainId,
    stable,
    injection,
    locked,
    allowLocked = false,
  }: t.SetMemoryParams): Promise<t.MemoryResult> {
    try {
      if (key?.toLowerCase() === 'nothing') {
        return { ok: false };
      }

      const MemoryEntry = mongoose.models.MemoryEntry;
      /** A locked memory is write-protected against every LLM path (the
       *  `set_memory`/`append_memory` tools); the memory panel and the
       *  `/memory` VFS mount pass `allowLocked` to edit it anyway. Read before
       *  writing so the caller receives a precise reason instead of a silent
       *  overwrite. */
      if (!allowLocked) {
        const existing = (await MemoryEntry.findOne({
          userId,
          key,
          ...partitionFilter(storeId),
        })
          .select('locked')
          .lean()) as { locked?: boolean } | null;
        if (isLocked(existing)) {
          return { ok: false, reason: LOCKED_UPDATE_REASON };
        }
      }

      const now = new Date();
      const tags = parseTrailingTags(value).tags;
      /** Whether this write is a create or an update is the caller's label on
       *  the memory-update card, so it is read before the upsert (writes here
       *  are low-frequency: extraction only). */
      const existed =
        (await MemoryEntry.exists({ userId, key, ...partitionFilter(storeId) })) != null;
      const updated = await MemoryEntry.findOneAndUpdate(
        { userId, key, ...partitionFilter(storeId) },
        {
          $set: {
            value,
            tags,
            tokenCount,
            ...(storeId ? { storeId } : {}),
            ...(domainId ? { domainId: String(domainId) } : {}),
            ...(typeof stable === 'boolean' ? { stable } : {}),
            ...(injection != null ? { injection } : {}),
            ...(typeof locked === 'boolean' ? { locked } : {}),
            updated_at: now,
          },
          /** New memories default to ephemeral; stable is only ever set by an
           *  explicit opt-in so a plain edit never silently demotes a stable
           *  memory. An explicit stability override rides `$set` instead, and
           *  must not repeat on `$setOnInsert` (same-path conflict). The same
           *  applies to `locked` and `injection`. `lastRecalledAt` seeds on
           *  insert only — a just-created memory counts as just-used — and is
           *  never refreshed by an edit. */
          $setOnInsert: {
            ...(typeof stable === 'boolean' ? {} : { stable: false }),
            ...(injection != null ? {} : { injection: 'system' }),
            ...(typeof locked === 'boolean' ? {} : { locked: false }),
            /** A brand-new memory lands in the caller's default domain; an
             *  edit never moves one, so an append keeps its own domain. */
            ...(domainId || !defaultDomainId ? {} : { domainId: String(defaultDomainId) }),
            lastRecalledAt: now,
          },
        },
        {
          upsert: true,
          new: true,
        },
      );
      /** Only a state that differs from the newest recorded one is kept, so a
       *  re-run of the extractor does not fill the history with copies. */
      if (updated) {
        await recordMemoryVersion(mongoose, {
          userId,
          memoryId: updated._id,
          key,
          value,
          tags,
          storeId: storeId ?? updated.storeId,
          domainId: updated.domainId != null ? String(updated.domainId) : undefined,
          tokenCount,
          stable: updated.stable === true,
          injection: injectionOf(updated.injection),
          locked: updated.locked === true,
        });
      }
      emitMemoryChange({
        type: 'set',
        userId: String(userId),
        key,
        storeId: storeIdOf(storeId),
        domainId: storeIdOf(domainId) ?? storeIdOf(updated?.domainId) ?? storeIdOf(defaultDomainId),
        value,
        tags,
        stable: updated?.stable === true,
      });

      /** The upsert's own result says where the write landed — an edit that
       *  named no domain kept the entry's, which nothing else can recover. */
      return {
        ok: true,
        created: !existed,
        ...(updated?.domainId != null ? { domainId: String(updated.domainId) } : {}),
      };
    } catch (error) {
      throw new Error(
        `Failed to set memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Deletes a specific memory entry for a user
   */
  async function deleteMemory({
    userId,
    key,
    storeId,
    allowStable = false,
    allowLocked = false,
  }: t.DeleteMemoryParams): Promise<t.MemoryResult> {
    try {
      const MemoryEntry = mongoose.models.MemoryEntry;
      const match = { userId, key, ...partitionFilter(storeId) };
      /** Stable memories ride the injected stable baseline and are protected
       *  from deletion unless the caller opts in explicitly (`allowStable`, the
       *  memory panel's rename/delete flows) — agents and VFS must demote or
       *  remove them from stable first. Locked memories are protected against
       *  every LLM path and only the memory panel and the `/memory` VFS mount
       *  may opt in via `allowLocked`. */
      const existing = await MemoryEntry.findOne(match).lean();
      if (existing) {
        if (!allowLocked && isLocked(existing as { locked?: boolean })) {
          return { ok: false, reason: LOCKED_DELETE_REASON };
        }
        if (!allowStable && (existing as { stable?: boolean }).stable === true) {
          return {
            ok: false,
            reason: 'Cannot delete a stable memory. Disable stable memory before deleting.',
          };
        }
      }
      const result = await MemoryEntry.findOneAndDelete(match);
      if (result) {
        /** A memory's history dies with it: the panel can only reach versions
         *  through an existing entry, so keeping them would be garbage. */
        await deleteMemoryVersions(mongoose, { userId, memoryIds: [String(result._id)] });
        emitMemoryChange({
          type: 'delete',
          userId: String(userId),
          key,
          storeId: storeIdOf(storeId),
        });
      }
      return { ok: !!result };
    } catch (error) {
      throw new Error(
        `Failed to delete memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Flips whether a memory is stable (rides the stable system baseline) or
   * ephemeral (single-turn RAG recall). Does not touch the value.
   */
  async function setMemoryStable({
    userId,
    key,
    storeId,
    stable,
  }: t.SetMemoryStableParams): Promise<t.MemoryResult> {
    try {
      const MemoryEntry = mongoose.models.MemoryEntry;
      const result = await MemoryEntry.findOneAndUpdate(
        { userId, key, ...partitionFilter(storeId) },
        { $set: { stable } },
        { new: true },
      );
      if (result) {
        emitMemoryChange({
          type: 'stable',
          userId: String(userId),
          key,
          storeId: storeIdOf(storeId),
          stable: result.stable === true,
          value: result.value,
        });
      }
      return { ok: !!result };
    } catch (error) {
      throw new Error(
        `Failed to update memory stability: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Gets all memory entries for a user across every store
   */
  async function getAllUserMemories(
    userId: string | Types.ObjectId,
  ): Promise<t.IMemoryEntryLean[]> {
    try {
      const MemoryEntry = mongoose.models.MemoryEntry;
      return (await MemoryEntry.find({ userId }).lean()) as t.IMemoryEntryLean[];
    } catch (error) {
      throw new Error(
        `Failed to get all memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Gets a user's memory entries for a single partition
   * (the store when `storeId` is provided)
   */
  async function getUserMemories({
    userId,
    storeId,
    domainIds,
    excludeKeys,
    stableOnly,
  }: t.GetUserMemoriesParams): Promise<t.IMemoryEntryLean[]> {
    try {
      const MemoryEntry = mongoose.models.MemoryEntry;
      const query: Record<string, unknown> = {
        userId,
        ...partitionFilter(storeId),
        ...domainFilter(domainIds),
      };
      if (stableOnly === true) {
        query.stable = true;
      }
      /** `$nin` matches docs whose key is absent from the list — memories whose
       *  key the current conversation generated are skipped, everything else
       *  (other conversations + user-managed) is kept. */
      if (excludeKeys && excludeKeys.length > 0) {
        query.key = { $nin: excludeKeys };
      }
      return (await MemoryEntry.find(query).lean()) as t.IMemoryEntryLean[];
    } catch (error) {
      throw new Error(
        `Failed to get memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Fetches a partition's memory entries by key (best effort: absent keys are
   * simply not returned). Used to resolve the `@memory-key` cross-references a
   * recalled memory can carry in its trailing lines — a targeted read instead
   * of loading the whole partition, which may hold many stable memories.
   */
  async function getMemoryEntriesByKeys({
    userId,
    storeId,
    domainIds,
    keys,
  }: t.GetMemoryEntriesByKeysParams): Promise<t.IMemoryEntryLean[]> {
    try {
      const MemoryEntry = mongoose.models.MemoryEntry;
      if (!keys || keys.length === 0) {
        return [];
      }
      return (await MemoryEntry.find({
        userId,
        key: { $in: keys },
        ...partitionFilter(storeId),
        ...domainFilter(domainIds),
      }).lean()) as t.IMemoryEntryLean[];
    } catch (error) {
      throw new Error(
        `Failed to get memories by key: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Gets and formats a partition's memories for a user in two different formats.
   * When `excludeConversationId` is set, memories whose key that conversation
   * auto-extracted (resolved via the conversation↔memory link table) are
   * dropped so a chat's own memories never feed back into its run context.
   *
   * Every entry leads with its update time — the model needs to know whether a
   * fact is fresh, and the timestamp is pinned as an absolute instant because
   * the prompt outlives the turn that built it.
   */
  async function getFormattedMemories({
    userId,
    storeId,
    domainIds,
    excludeConversationId,
    timezone,
  }: t.GetFormattedMemoriesParams): Promise<t.FormattedMemoriesResult> {
    try {
      let excludeKeys: string[] | undefined;
      if (excludeConversationId) {
        excludeKeys = await getConversationMemoryKeys({
          userId,
          conversationId: excludeConversationId,
        });
      }
      const memories = await getUserMemories({ userId, storeId, domainIds, excludeKeys });

      if (!memories || memories.length === 0) {
        return { withKeys: '', withoutKeys: '', totalTokens: 0 };
      }

      const sortedMemories = memories.sort(
        (a, b) => new Date(a.updated_at!).getTime() - new Date(b.updated_at!).getTime(),
      );

      const totalTokens = sortedMemories.reduce((sum, memory) => {
        return sum + (memory.tokenCount || 0);
      }, 0);

      const withKeys = sortedMemories
        .map(
          (memory, index) =>
            `${index + 1}. ["key": "${memory.key}"].` +
            memoryTimeField(memory, timezone) +
            ` ["value": "${memoryContentOf(memory)}"]` +
            memoryTagField(memory),
        )
        .join('\n\n');

      const withoutKeys = sortedMemories
        .map(
          (memory, index) =>
            `${index + 1}.${memoryTimeField(memory, timezone)} ${memoryContentOf(memory)}`,
        )
        .join('\n\n');

      return { withKeys, withoutKeys, totalTokens };
    } catch (error) {
      logger.error('Failed to get formatted memories:', error);
      return { withKeys: '', withoutKeys: '', totalTokens: 0 };
    }
  }

  /**
   * The store's tag vocabulary, derived from the memories themselves: every tag
   * that appears on at least one memory, with the number of memories carrying
   * it and whether it passed the promotion threshold. Deriving it keeps the
   * vocabulary from drifting — there is no counter to maintain, and deleting a
   * memory retires its tags on the next read. Deeper history is lost, but
   * inside one store that is a handful of rows either way.
   *
   * Scope is the store, not the caller: a shared store has one vocabulary, the
   * same way it has one set of memories. The list is uncapped unless the caller
   * names a limit; the extraction prompt lists every tag, while the recall
   * matcher caps how many it reads.
   */
  async function getStoreTagVocabulary({
    storeId,
    limit,
    promoteAt = 2,
  }: t.GetStoreTagVocabularyParams): Promise<t.MemoryTagUsage[]> {
    try {
      const MemoryEntry = mongoose.models.MemoryEntry;
      const cap =
        typeof limit === 'number' && Number.isFinite(limit) && limit > 0 ? limit : undefined;
      const rows = (await MemoryEntry.aggregate([
        { $match: { ...partitionFilter(storeId), tags: { $exists: true, $ne: [] } } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        ...(cap != null ? [{ $limit: cap }] : []),
      ])) as Array<{ _id: string; count: number }>;
      return rows.map((row) => ({
        tag: row._id,
        count: row.count,
        promoted: row.count >= promoteAt,
      }));
    } catch (error) {
      logger.error('Failed to read the store tag vocabulary:', error);
      return [];
    }
  }

  /**
   * Deletes all memory entries for a user
   */
  async function deleteAllUserMemories(userId: string | Types.ObjectId): Promise<number> {
    try {
      const MemoryEntry = mongoose.models.MemoryEntry;
      const result = await MemoryEntry.deleteMany({ userId });
      await deleteMemoryVersions(mongoose, { userId });
      /** Rows drop directly, which emits nothing; one sweep with no store or
       *  domain drops every vector row the user owns — text and images both —
       *  across every store. */
      emitMemoryChange({ type: 'delete', userId: String(userId), sweep: true });
      return result.deletedCount;
    } catch (error) {
      throw new Error(
        `Failed to delete all user memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Records (or refreshes) the link between a conversation and a memory key it
   * auto-extracted, so the run-context loader can exclude that conversation's
   * own memories without stamping the memory entry itself.
   */
  async function setConversationMemory({
    userId,
    conversationId,
    storeId,
    domainId,
    created,
    turnMessageId,
    key,
  }: t.SetConversationMemoryParams): Promise<t.MemoryResult> {
    try {
      const ConversationMemory = mongoose.models.ConversationMemory;
      await ConversationMemory.findOneAndUpdate(
        { userId, conversationId, ...partitionFilter(storeId), key },
        {
          $set: {
            updated_at: new Date(),
            /** This link records the conversation EXTRACTING the memory, which
             *  also upgrades a row it had only recalled before. */
            source: 'extracted',
            ...(typeof created === 'boolean' ? { createdByConversation: created } : {}),
            ...(domainId ? { domainId: String(domainId) } : {}),
            ...(turnMessageId ? { turnMessageId } : {}),
          },
        },
        { upsert: true, new: true },
      );
      return { ok: true };
    } catch (error) {
      throw new Error(
        `Failed to link conversation memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Memory keys a conversation has auto-extracted. A link the conversation
   * only RECALLED through is not one of the conversation's own memories, so it
   * is left out — otherwise a recalled memory would stop being recallable.
   */
  async function getConversationMemoryKeys({
    userId,
    conversationId,
  }: t.GetConversationMemoryKeysParams): Promise<string[]> {
    try {
      const ConversationMemory = mongoose.models.ConversationMemory;
      const links = (await ConversationMemory.find({
        userId,
        conversationId,
        /** Rows written before `source` existed are extraction links. */
        source: { $ne: 'recalled' },
      }).lean()) as t.IConversationMemoryLean[];
      return Array.from(new Set(links.map((link) => link.key)));
    } catch (error) {
      logger.error('Failed to get conversation memory keys:', error);
      return [];
    }
  }

  /**
   * The conversation's memory links joined with their entries: what the
   * conversation extracted, what it recalled and how often, and each row's
   * domain. Powers the conversation's memory panel.
   */
  async function getConversationMemoryDetails({
    userId,
    conversationId,
  }: t.GetConversationMemoryKeysParams): Promise<
    Array<{
      entry: t.IMemoryEntryLean;
      source: 'extracted' | 'recalled';
      recallCount: number;
    }>
  > {
    try {
      const ConversationMemory = mongoose.models.ConversationMemory;
      const links = (await ConversationMemory.find({
        userId,
        conversationId,
      }).lean()) as t.IConversationMemoryLean[];
      if (links.length === 0) {
        return [];
      }
      const MemoryEntry = mongoose.models.MemoryEntry;
      const entries = (await MemoryEntry.find({
        userId,
        $or: links.map((link) => ({ key: link.key, ...partitionFilter(link.storeId) })),
      }).lean()) as t.IMemoryEntryLean[];
      return entries.flatMap((entry) => {
        const link = links.find(
          (candidate) =>
            candidate.key === entry.key && (candidate.storeId ?? null) === (entry.storeId ?? null),
        );
        if (!link) {
          return [];
        }
        return [
          {
            entry,
            /** A memory a conversation both extracted and recalled stays
             *  "extracted": it is still the conversation's own. */
            source: link.source === 'recalled' ? ('recalled' as const) : ('extracted' as const),
            recallCount: link.recallCount ?? 0,
            ...(link.createdByConversation != null
              ? { createdByConversation: link.createdByConversation }
              : {}),
          },
        ];
      });
    } catch (error) {
      logger.error('Failed to get conversation memory details:', error);
      return [];
    }
  }

  /**
   * Memory entries a conversation has auto-extracted, resolved per partition
   * from the link table. `before` limits the result to memories last updated
   * at or before a point in time — used to attach only the memories that
   * existed when a conversation's history was compacted.
   */
  async function getConversationMemories({
    userId,
    conversationId,
    before,
  }: t.GetConversationMemoriesParams): Promise<t.IMemoryEntryLean[]> {
    try {
      const ConversationMemory = mongoose.models.ConversationMemory;
      const links = (await ConversationMemory.find({
        userId,
        conversationId,
      }).lean()) as t.IConversationMemoryLean[];
      if (!links || links.length === 0) {
        return [];
      }
      const MemoryEntry = mongoose.models.MemoryEntry;
      const query: Record<string, unknown> = {
        userId,
        /** Match each link's (storeId, key) exactly — the same key can exist in
         *  different partitions, and each link records its own partition. */
        $or: links.map((link) => ({ key: link.key, ...partitionFilter(link.storeId) })),
      };
      if (before) {
        query.updated_at = { $lte: before };
      }
      return (await MemoryEntry.find(query).lean()) as t.IMemoryEntryLean[];
    } catch (error) {
      logger.error('Failed to get conversation memories:', error);
      return [];
    }
  }

  /**
   * Deletes the conversation↔memory links for one or more conversations — called
   * when conversations are deleted so the link table doesn't grow stale. The
   * memory entries themselves are untouched (they may be shared across
   * conversations or user-managed).
   */
  async function deleteConversationMemories({
    userId,
    conversationId,
  }: t.DeleteConversationMemoriesParams): Promise<number> {
    try {
      const ConversationMemory = mongoose.models.ConversationMemory;
      const ids = Array.isArray(conversationId) ? conversationId : [conversationId];
      const result = await ConversationMemory.deleteMany({ userId, conversationId: { $in: ids } });
      return result.deletedCount ?? 0;
    } catch (error) {
      throw new Error(
        `Failed to delete conversation memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Deletes every conversation↔memory link for a user (full history clear).
   */
  async function deleteAllConversationMemories(userId: string | Types.ObjectId): Promise<number> {
    try {
      const ConversationMemory = mongoose.models.ConversationMemory;
      const result = await ConversationMemory.deleteMany({ userId });
      return result.deletedCount ?? 0;
    } catch (error) {
      throw new Error(
        `Failed to delete all conversation memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /** When the named conversation messages were written, keyed by messageId.
   *  Missing rows (never persisted, or deleted since) are absent from the map. */
  async function loadMessageCreatedAt({
    userId,
    conversationId,
    messageIds,
  }: {
    userId: string | Types.ObjectId;
    conversationId: string;
    messageIds: string[];
  }): Promise<Map<string, Date>> {
    const times = new Map<string, Date>();
    const Message = mongoose.models.Message;
    if (!Message || messageIds.length === 0) {
      return times;
    }
    const rows = (await Message.find(
      { user: String(userId), conversationId, messageId: { $in: messageIds } },
      { messageId: 1, createdAt: 1 },
    ).lean()) as Array<{ messageId: string; createdAt?: Date }>;
    for (const row of rows) {
      if (row.createdAt) {
        times.set(row.messageId, row.createdAt);
      }
    }
    return times;
  }

  /**
   * Releases the conversation↔memory links for the turns a summary swallowed,
   * keeping the ones the retained recency window still carries verbatim: the
   * released entries stay in the pool and its recall store, where the
   * single-turn RAG tail can bring them back, instead of staying pinned to the
   * conversation that no longer shows them.
   *
   * Each link names the turn whose extraction wrote it, and the comparison is
   * between stored messages, so an extraction that ran late — re-queued behind
   * a newer turn — cannot slip an older memory past the boundary. Links with no
   * recorded turn (rows written before the field existed, and the `/memory`
   * mount's writes) are released: a memory the summary swallowed has to end up
   * recallable. A boundary that is not a stored message of this conversation
   * releases everything, exactly like a summary that retained nothing.
   */
  async function deleteCompactedConversationMemories({
    userId,
    conversationId,
    retainedFromMessageId,
  }: t.DeleteCompactedConversationMemoriesParams): Promise<number> {
    try {
      const ConversationMemory = mongoose.models.ConversationMemory;
      const links = (await ConversationMemory.find({
        userId,
        conversationId,
      }).lean()) as t.IConversationMemoryLean[];
      if (links.length === 0) {
        return 0;
      }
      const anchors = [
        ...new Set(
          links.flatMap((link) => (link.turnMessageId == null ? [] : [link.turnMessageId])),
        ),
      ];
      /** One read orders every anchor against the boundary — both are stored
       *  messages of this conversation, so their `createdAt` is the turn order. */
      const times =
        retainedFromMessageId == null
          ? new Map<string, Date>()
          : await loadMessageCreatedAt({
              userId,
              conversationId,
              messageIds: [...anchors, retainedFromMessageId],
            });
      const boundary = retainedFromMessageId == null ? undefined : times.get(retainedFromMessageId);
      if (boundary == null) {
        return deleteConversationMemories({ userId, conversationId });
      }
      const released = links.filter((link) => {
        const turn = link.turnMessageId == null ? undefined : times.get(link.turnMessageId);
        return turn == null || turn.getTime() < boundary.getTime();
      });
      if (released.length === 0) {
        return 0;
      }
      const result = await ConversationMemory.deleteMany({
        _id: { $in: released.map((link) => link._id) },
      });
      return result.deletedCount ?? 0;
    } catch (error) {
      throw new Error(
        `Failed to delete compacted conversation memories: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Returns a partition's memory entries in the same scoping the run-context
   * loader uses: memories whose key the current conversation auto-extracted
   * are excluded, everything else (other conversations + user-managed) is
   * kept. Used for incremental memory injection baselines/deltas.
   */
  async function getMemoryInjectionEntries({
    userId,
    storeId,
    domainIds,
    excludeConversationId,
    stableOnly,
  }: t.GetMemoryInjectionEntriesParams): Promise<t.IMemoryEntryLean[]> {
    try {
      let excludeKeys: string[] | undefined;
      if (excludeConversationId) {
        excludeKeys = await getConversationMemoryKeys({
          userId,
          conversationId: excludeConversationId,
        });
      }
      return getUserMemories({ userId, storeId, domainIds, excludeKeys, stableOnly });
    } catch (error) {
      logger.error('Failed to get memory injection entries:', error);
      return [];
    }
  }

  /**
   * Returns the partition's memory entries the memory extractor is allowed to
   * see: every stable memory plus whatever the current conversation itself
   * created (resolved through the conversation↔memory link table). Ephemeral
   * memories from other conversations are deliberately hidden so extraction
   * never mutates knowledge it cannot see. With no conversation context only
   * stable memories are visible. Locked memories are visible too — the list
   * marks them `locked` and every write path refuses them — so the extractor
   * can see what it must not change.
   */
  async function getMemoryExtractionEntries({
    userId,
    storeId,
    domainIds,
    conversationId,
  }: t.GetMemoryExtractionEntriesParams): Promise<t.IMemoryEntryLean[]> {
    try {
      let entries: t.IMemoryEntryLean[];
      if (!conversationId) {
        entries = await getUserMemories({ userId, storeId, domainIds, stableOnly: true });
      } else {
        const [convKeys, all] = await Promise.all([
          getConversationMemoryKeys({ userId, conversationId }),
          getUserMemories({ userId, storeId, domainIds }),
        ]);
        if (convKeys.length === 0) {
          entries = all.filter((entry) => entry.stable === true);
        } else {
          const conversationKeys = new Set(convKeys);
          entries = all.filter((entry) => entry.stable === true || conversationKeys.has(entry.key));
        }
      }
      return entries;
    } catch (error) {
      logger.error('Failed to get memory extraction entries:', error);
      return [];
    }
  }

  /** Stamps `lastRecalledAt` on the given partition's memory keys. Called after
   *  a single-turn recall actually injects ephemeral memories, so capacity
   *  eviction can order by least-recently-recalled. Best-effort; a stamping
   *  failure must never break a turn. */
  async function markMemoriesRecalled({
    userId,
    storeId,
    conversationId,
    turnId,
    keys,
  }: t.MarkMemoriesRecalledParams): Promise<void> {
    try {
      if (!Array.isArray(keys) || keys.length === 0) {
        return;
      }
      const MemoryEntry = mongoose.models.MemoryEntry;
      await MemoryEntry.updateMany(
        { userId, key: { $in: keys }, ...partitionFilter(storeId) },
        { $set: { lastRecalledAt: new Date() } },
      );
      /** Recall is counted per CONVERSATION: the link row keeps how many of
       *  this conversation's turns pulled the memory into context, which is
       *  what the conversation's memory panel shows. */
      if (conversationId) {
        const ConversationMemory = mongoose.models.ConversationMemory;
        const now = new Date();
        await Promise.all(
          keys.map((key) => {
            const filter = { userId, conversationId, ...partitionFilter(storeId), key };
            /** Without a turn to compare against, every call counts. */
            if (turnId == null) {
              return ConversationMemory.updateOne(
                filter,
                {
                  $set: { updated_at: now },
                  $inc: { recallCount: 1 },
                  $setOnInsert: { source: 'recalled' },
                },
                { upsert: true },
              );
            }
            /** A turn can reach recall more than once, so the count moves only
             *  in the run that first recalled for this turn: the conditional
             *  write keeps concurrent runs of the same turn from both landing. */
            return ConversationMemory.updateOne(
              filter,
              [
                {
                  $set: {
                    updated_at: now,
                    source: { $ifNull: ['$source', 'recalled'] },
                    lastRecallTurnId: turnId,
                    recallCount: {
                      $cond: [
                        { $eq: ['$lastRecallTurnId', turnId] },
                        { $ifNull: ['$recallCount', 0] },
                        { $add: [{ $ifNull: ['$recallCount', 0] }, 1] },
                      ],
                    },
                  },
                },
              ],
              { upsert: true },
            );
          }),
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to mark memories recalled: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /** Eviction order: never-recalled (null) first, then oldest recall, then the
   *  oldest edit — the least-recently-used ephemeral memories go first. */
  const evictionTime = (entry: t.IMemoryEntryLean): number =>
    entry.lastRecalledAt ? new Date(entry.lastRecalledAt).getTime() : 0;
  const entryUpdatedTime = (entry: t.IMemoryEntryLean): number =>
    entry.updated_at ? new Date(entry.updated_at).getTime() : 0;
  const compareForEviction = (a: t.IMemoryEntryLean, b: t.IMemoryEntryLean): number => {
    const byRecall = evictionTime(a) - evictionTime(b);
    return byRecall !== 0 ? byRecall : entryUpdatedTime(a) - entryUpdatedTime(b);
  };

  /**
   * Ensures a new memory of `tokenCount` fits within the user's `tokenLimit`
   * storage budget for one store. When it only fits by evicting,
   * drops ephemeral memories in least-recently-recalled order until there is
   * room. Stable and locked memories are never evicted. With `dryRun` no
   * deletion happens and the caller receives the eviction plan instead.
   * Deleting only fits when every removable ephemeral memory is gone — then it
   * reports `ok: false` without touching anything.
   */
  async function evictMemoriesToFitCapacity({
    userId,
    storeId,
    tokenLimit,
    tokenCount,
    dryRun = false,
  }: t.EvictMemoriesParams): Promise<t.MemoryEvictionResult> {
    try {
      if (!tokenLimit || tokenLimit <= 0) {
        return { ok: true, evicted: [] };
      }
      /** Capacity is enforced per store: stores are isolated, so one filling up
       *  never evicts another's memories. */
      const memories = await getUserMemories({ userId, storeId });
      const totalTokens = memories.reduce((sum, memory) => sum + (memory.tokenCount || 0), 0);
      const overBy = totalTokens + tokenCount - tokenLimit;
      if (overBy <= 0) {
        return { ok: true, evicted: [] };
      }
      /** Only ephemeral memories can be evicted; stable memories ride the stable
       *  system baseline and locked memories are user-protected, so both are
       *  never dropped automatically. */
      const ephemeral = memories
        .filter((memory) => memory.stable !== true && memory.locked !== true)
        .sort(compareForEviction);
      const evictableTokens = ephemeral.reduce((sum, memory) => sum + (memory.tokenCount || 0), 0);
      if (evictableTokens < overBy) {
        return {
          ok: false,
          reason: `This memory exceeds the available capacity of ${tokenLimit} tokens. Even after removing every removable memory it still cannot be stored.`,
        };
      }
      const evicted: t.EvictedMemory[] = [];
      let freed = 0;
      for (const memory of ephemeral) {
        if (freed >= overBy) {
          break;
        }
        evicted.push({
          key: memory.key,
          value: memory.value,
          ...(memory.storeId ? { storeId: String(memory.storeId) } : {}),
          tokenCount: memory.tokenCount,
          ...(memory.lastRecalledAt ? { lastRecalledAt: memory.lastRecalledAt } : {}),
        });
        freed += memory.tokenCount || 0;
        if (!dryRun) {
          await deleteMemory({ userId, key: memory.key, storeId: memory.storeId });
        }
      }
      return { ok: true, evicted };
    } catch (error) {
      throw new Error(
        `Failed to evict memories for capacity: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  return {
    setMemory,
    setMemoryStable,
    createMemory,
    deleteMemory,
    getAllUserMemories,
    getUserMemories,
    getMemoryEntriesByKeys,
    getFormattedMemories,
    getMemoryInjectionEntries,
    getMemoryExtractionEntries,
    getStoreTagVocabulary,
    markMemoriesRecalled,
    evictMemoriesToFitCapacity,
    deleteAllUserMemories,
    setConversationMemory,
    getConversationMemoryKeys,
    getConversationMemories,
    getConversationMemoryDetails,
    deleteConversationMemories,
    deleteCompactedConversationMemories,
    deleteAllConversationMemories,
  };
}

export type MemoryMethods = ReturnType<typeof createMemoryMethods>;
