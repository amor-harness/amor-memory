import { Types } from 'mongoose';
import { MEMORY_DOMAIN_KINDS } from 'librechat-data-provider';
import type { MemoryDomainKind } from 'librechat-data-provider';
import type * as t from '../types';
import { logger } from '@librechat/data-schemas';
import { emitMemoryChange } from '../memoryEvents';

export const MEMORY_DOMAIN_NAME_MAX = 60;
export const MEMORY_DOMAIN_DESCRIPTION_MAX = 200;
export const DEFAULT_MEMORY_DOMAIN_NAME = 'Default';
const DEFAULT_MEMORY_DOMAIN_DESCRIPTION = 'Facts about the real world.';

const NAME_REQUIRED_REASON = 'Memory domain name is required.';
const NAME_TOO_LONG_REASON = `Memory domain name exceeds ${MEMORY_DOMAIN_NAME_MAX} characters.`;
const NAME_EXISTS_REASON = 'A memory domain with this name already exists.';
const KIND_INVALID_REASON = 'Unknown memory domain kind.';
const DESCRIPTION_REQUIRED_REASON = 'Memory domain description is required.';
const DESCRIPTION_TOO_LONG_REASON = `Memory domain description exceeds ${MEMORY_DOMAIN_DESCRIPTION_MAX} characters.`;
const NOT_FOUND_REASON = 'Memory domain not found.';
const DEFAULT_DELETE_REASON = 'The default memory domain cannot be deleted.';
const NOT_EMPTY_REASON = 'The memory domain still holds memories.';

/** Case-insensitive equality for names: Mongoose collation beats a regex, which
 *  would have to escape the user's input. */
const NAME_COLLATION = { locale: 'en', strength: 2 } as const;

/** Domain names and descriptions are injected into prompts, so they are
 *  normalized to one line and stripped of the quotes/backslashes the injected
 *  `["key": "..."]` fields are built from. A name is also one folder segment in
 *  the `/memory` mount, so path separators are removed rather than escaped. */
const normalizeField = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }
  /** Separators go first: dropping them can leave two spaces where one
   *  separator was, and the whitespace pass below folds those back. */
  return value
    .normalize('NFKC')
    .replace(/["\\/]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeName = normalizeField;

const normalizeDescription = normalizeField;

const isKnownKind = (kind: unknown): kind is MemoryDomainKind =>
  typeof kind === 'string' && (MEMORY_DOMAIN_KINDS as readonly string[]).includes(kind);

/**
 * Memory domains partition a store's memories by context. A run reads and
 * writes only the domains it has active, so a game world's memories are never
 * read as facts about real life. The default domain is the one pre-existing
 * memories were migrated into: it is where a new conversation starts and it
 * cannot be deleted, though a conversation may close it like any other domain.
 */
export function createMemoryDomainMethods(mongoose: typeof import('mongoose')): {
  ensureDefaultMemoryDomain: (params: {
    userId: string | Types.ObjectId;
    storeId: string | Types.ObjectId;
  }) => Promise<t.IMemoryDomainLean>;
  listMemoryDomains: (params: t.ListMemoryDomainsParams) => Promise<t.MemoryDomainWithCount[]>;
  createMemoryDomain: (params: t.CreateMemoryDomainParams) => Promise<t.MemoryDomainResult>;
  updateMemoryDomain: (params: t.UpdateMemoryDomainParams) => Promise<t.MemoryDomainResult>;
  deleteMemoryDomain: (params: t.DeleteMemoryDomainParams) => Promise<t.MemoryDomainResult>;
  resolveMemoryDomain: (params: t.ResolveMemoryDomainParams) => Promise<t.IMemoryDomainLean | null>;
  getMemoryDomainMemories: (params: {
    storeId: string | Types.ObjectId;
    domainId: string | Types.ObjectId;
  }) => Promise<Array<{ key: string; value: string; stable?: boolean }>>;
} {
  /** Points pre-domain memories at the default domain so legacy data keeps
   *  working, and re-emits them so their vectors carry the domain column. */
  async function adoptLegacyMemories(storeId: string, domainId: string): Promise<void> {
    const legacy = { storeId, domainId: { $exists: false } };
    const migrated = (await mongoose.models.MemoryEntry?.find(legacy)
      .select('key value stable userId')
      .lean()) as unknown as
      | Array<{ key: string; value: string; stable?: boolean; userId: Types.ObjectId }>
      | undefined;
    await Promise.all([
      mongoose.models.MemoryEntry?.updateMany(legacy, { $set: { domainId } }),
      mongoose.models.MemoryImage?.updateMany(legacy, { $set: { domainId } }),
      mongoose.models.ConversationMemory?.updateMany(legacy, { $set: { domainId } }),
    ]);
    for (const entry of migrated ?? []) {
      emitMemoryChange({
        type: 'set',
        userId: String(entry.userId),
        key: entry.key,
        storeId,
        domainId,
        value: entry.value,
        stable: entry.stable === true,
      });
    }
  }

  /** Returns a store's default domain, creating it (and adopting legacy
   *  memories) on first use. */
  async function ensureDefaultMemoryDomain({
    userId,
    storeId,
  }: {
    userId: string | Types.ObjectId;
    storeId: string | Types.ObjectId;
  }): Promise<t.IMemoryDomainLean> {
    const MemoryDomain = mongoose.models.MemoryDomain;
    const storeIdStr = String(storeId);
    const existing = (await MemoryDomain.findOne({
      storeId: storeIdStr,
      isDefault: true,
    }).lean()) as t.IMemoryDomainLean | null;
    if (existing) {
      return existing;
    }
    const now = new Date();
    const created = (await MemoryDomain.findOneAndUpdate(
      { storeId: storeIdStr, isDefault: true },
      {
        $setOnInsert: {
          userId,
          storeId: storeIdStr,
          name: DEFAULT_MEMORY_DOMAIN_NAME,
          kind: 'real',
          description: DEFAULT_MEMORY_DOMAIN_DESCRIPTION,
          isDefault: true,
          createdBy: 'user',
          created_at: now,
          updated_at: now,
        },
      },
      { upsert: true, new: true },
    ).lean()) as t.IMemoryDomainLean;
    await adoptLegacyMemories(storeIdStr, String(created._id));
    return created;
  }

  async function countsFor(
    storeId: string,
  ): Promise<Map<string, { memoryCount: number; totalTokens: number }>> {
    const rows = (await mongoose.models.MemoryEntry?.aggregate([
      { $match: { storeId, domainId: { $type: 'string' } } },
      {
        $group: {
          _id: '$domainId',
          memoryCount: { $sum: 1 },
          totalTokens: { $sum: { $ifNull: ['$tokenCount', 0] } },
        },
      },
    ])) as Array<{ _id: string; memoryCount: number; totalTokens: number }> | undefined;
    return new Map(
      (rows ?? []).map((row) => [
        row._id,
        { memoryCount: row.memoryCount, totalTokens: row.totalTokens },
      ]),
    );
  }

  async function listMemoryDomains({
    storeId,
  }: t.ListMemoryDomainsParams): Promise<t.MemoryDomainWithCount[]> {
    const storeIdStr = String(storeId);
    const domains = (await mongoose.models.MemoryDomain.find({ storeId: storeIdStr })
      .sort({ isDefault: -1, name: 1 })
      .lean()) as t.IMemoryDomainLean[];
    const counts = await countsFor(storeIdStr);
    return domains.map((domain) => {
      const count = counts.get(String(domain._id));
      return {
        ...domain,
        memoryCount: count?.memoryCount ?? 0,
        totalTokens: count?.totalTokens ?? 0,
      };
    });
  }

  function validateName(name: string): string | null {
    if (name === '') {
      return NAME_REQUIRED_REASON;
    }
    if (name.length > MEMORY_DOMAIN_NAME_MAX) {
      return NAME_TOO_LONG_REASON;
    }
    return null;
  }

  function validateDescription(description: string): string | null {
    if (description === '') {
      return DESCRIPTION_REQUIRED_REASON;
    }
    if (description.length > MEMORY_DOMAIN_DESCRIPTION_MAX) {
      return DESCRIPTION_TOO_LONG_REASON;
    }
    return null;
  }

  async function nameTaken(
    storeId: string,
    name: string,
    excludeDomainId?: string,
  ): Promise<boolean> {
    const query: Record<string, unknown> = { storeId, name };
    if (excludeDomainId != null) {
      query._id = { $ne: excludeDomainId };
    }
    const duplicate = await mongoose.models.MemoryDomain.findOne(query)
      .collation(NAME_COLLATION)
      .lean();
    return duplicate != null;
  }

  async function createMemoryDomain({
    userId,
    storeId,
    name,
    kind,
    description,
    createdBy = 'user',
  }: t.CreateMemoryDomainParams): Promise<t.MemoryDomainResult> {
    const storeIdStr = String(storeId);
    const trimmed = normalizeName(name);
    const nameError = validateName(trimmed);
    if (nameError) {
      return { ok: false, reason: nameError };
    }
    if (!isKnownKind(kind)) {
      return { ok: false, reason: KIND_INVALID_REASON };
    }
    const trimmedDescription = normalizeDescription(description);
    const descriptionError = validateDescription(trimmedDescription);
    if (descriptionError) {
      return { ok: false, reason: descriptionError };
    }
    if (await nameTaken(storeIdStr, trimmed)) {
      return { ok: false, reason: NAME_EXISTS_REASON };
    }
    const now = new Date();
    try {
      const domain = (
        await mongoose.models.MemoryDomain.create({
          userId,
          storeId: storeIdStr,
          name: trimmed,
          kind,
          description: trimmedDescription,
          isDefault: false,
          createdBy,
          created_at: now,
          updated_at: now,
        })
      ).toObject() as t.IMemoryDomainLean;
      return { ok: true, domain };
    } catch (error) {
      /** The store-scoped unique index is the last word on duplicates: two
       *  concurrent creates can both pass the check above. */
      logger.warn(`Failed to create memory domain "${trimmed}": ${(error as Error).message}`);
      return { ok: false, reason: NAME_EXISTS_REASON };
    }
  }

  async function updateMemoryDomain({
    storeId,
    domainId,
    name,
    kind,
    description,
  }: t.UpdateMemoryDomainParams): Promise<t.MemoryDomainResult> {
    const storeIdStr = String(storeId);
    const domain = (await mongoose.models.MemoryDomain.findOne({
      _id: domainId,
      storeId: storeIdStr,
    }).lean()) as t.IMemoryDomainLean | null;
    if (!domain) {
      return { ok: false, reason: NOT_FOUND_REASON };
    }
    const update: Record<string, unknown> = { updated_at: new Date() };
    if (name !== undefined) {
      const trimmed = normalizeName(name);
      const nameError = validateName(trimmed);
      if (nameError) {
        return { ok: false, reason: nameError };
      }
      if (await nameTaken(storeIdStr, trimmed, String(domain._id))) {
        return { ok: false, reason: NAME_EXISTS_REASON };
      }
      update.name = trimmed;
    }
    if (kind !== undefined) {
      if (!isKnownKind(kind)) {
        return { ok: false, reason: KIND_INVALID_REASON };
      }
      update.kind = kind;
    }
    if (description !== undefined) {
      const trimmed = normalizeDescription(description);
      const descriptionError = validateDescription(trimmed);
      if (descriptionError) {
        return { ok: false, reason: descriptionError };
      }
      update.description = trimmed;
    }
    const updated = (await mongoose.models.MemoryDomain.findByIdAndUpdate(
      domain._id,
      { $set: update },
      { new: true },
    ).lean()) as t.IMemoryDomainLean;
    return { ok: true, domain: updated };
  }

  /** The domain's memories, in the order they were last written. */
  async function getMemoryDomainMemories({
    storeId,
    domainId,
  }: {
    storeId: string | Types.ObjectId;
    domainId: string | Types.ObjectId;
  }): Promise<Array<{ key: string; value: string; stable?: boolean }>> {
    return ((await mongoose.models.MemoryEntry?.find({
      storeId: String(storeId),
      domainId: String(domainId),
    })
      .select('key value stable')
      .lean()) ?? []) as unknown as Array<{ key: string; value: string; stable?: boolean }>;
  }

  async function deleteMemoryDomain({
    storeId,
    domainId,
    force = false,
  }: t.DeleteMemoryDomainParams): Promise<t.MemoryDomainResult> {
    const storeIdStr = String(storeId);
    const domain = (await mongoose.models.MemoryDomain.findOne({
      _id: domainId,
      storeId: storeIdStr,
    }).lean()) as t.IMemoryDomainLean | null;
    if (!domain) {
      return { ok: false, reason: NOT_FOUND_REASON };
    }
    if (domain.isDefault === true) {
      return { ok: false, reason: DEFAULT_DELETE_REASON };
    }
    const memories = await getMemoryDomainMemories({ storeId: storeIdStr, domainId: domain._id });
    if (memories.length > 0 && !force) {
      return { ok: false, reason: NOT_EMPTY_REASON };
    }
    const domainIdStr = String(domain._id);
    await Promise.all([
      mongoose.models.MemoryEntry?.deleteMany({ storeId: storeIdStr, domainId: domainIdStr }),
      mongoose.models.MemoryImage?.deleteMany({ storeId: storeIdStr, domainId: domainIdStr }),
      mongoose.models.ConversationMemory?.deleteMany({
        storeId: storeIdStr,
        domainId: domainIdStr,
      }),
    ]);
    /** Dropping rows directly emits nothing; one sweep drops the domain's
     *  vector rows — text and images both — instead of replaying a delete per
     *  row. */
    emitMemoryChange({
      type: 'delete',
      userId: String(domain.userId),
      storeId: storeIdStr,
      domainId: domainIdStr,
      sweep: true,
    });
    await mongoose.models.MemoryDomain.deleteOne({ _id: domain._id });
    return { ok: true };
  }

  async function resolveMemoryDomain({
    storeId,
    domain,
  }: t.ResolveMemoryDomainParams): Promise<t.IMemoryDomainLean | null> {
    const storeIdStr = String(storeId);
    const query: Record<string, unknown> = { storeId: storeIdStr };
    if (Types.ObjectId.isValid(domain)) {
      query._id = domain;
    } else {
      query.name = domain;
    }
    const found = await mongoose.models.MemoryDomain.findOne(query)
      .collation(NAME_COLLATION)
      .lean();
    return (found as t.IMemoryDomainLean | null) ?? null;
  }

  return {
    ensureDefaultMemoryDomain,
    listMemoryDomains,
    createMemoryDomain,
    updateMemoryDomain,
    deleteMemoryDomain,
    resolveMemoryDomain,
    getMemoryDomainMemories,
  };
}

export type MemoryDomainMethods = ReturnType<typeof createMemoryDomainMethods>;
