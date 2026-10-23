import { createRequire } from 'node:module';
import mongoose from 'mongoose';
import { models } from '../db.mjs';
import { readableStore } from './memories.mjs';
import { formatMemoryEntries } from '../extraction/index.mjs';
import type { MemoryInjectionScope, MemoryEntryRow, PreparedInjection } from './types.mjs';

const require = createRequire(import.meta.url);
const { buildDomainKindLegend, buildActiveDomainsBlock } = require('@amor-harness/api') as {
  buildDomainKindLegend(): string;
  buildActiveDomainsBlock(scope: MemoryInjectionScope): string | undefined | null;
};

interface StableEntriesParams {
  ownerId: string;
  storeId: string;
  domainIds?: string[];
  stableOnly?: boolean;
}

async function stableEntries({
  ownerId,
  storeId,
  domainIds,
  stableOnly = true,
}: StableEntriesParams): Promise<MemoryEntryRow[]> {
  const db = await models();
  const filter = {
    userId: new mongoose.Types.ObjectId(String(ownerId)),
    storeId: String(storeId),
    ...(stableOnly ? { stable: true } : {}),
    ...(Array.isArray(domainIds) ? { domainId: { $in: domainIds.map(String) } } : {}),
  };
  return (await db.MemoryEntry.find(filter).lean()) as MemoryEntryRow[];
}

/** Stable-memory injection for one turn, shaped like the app's planner. */
export async function prepareInjection({
  userId,
  storeId,
  scope,
  timezone,
}: {
  userId?: string;
  storeId: string;
  scope?: MemoryInjectionScope | null;
  timezone?: string;
}): Promise<PreparedInjection | null> {
  const access = await readableStore({ userId, storeId });
  if (!access) {
    return null;
  }
  if (scope != null && scope.enabled === false) {
    return { stableContext: undefined, dynamicContext: undefined };
  }
  const { store, ownerId } = access;
  const resolvedStoreId = String(store._id);
  const defaultDomainId = scope?.defaultDomain?.id;
  const wholeStore = scope == null || (!defaultDomainId && !Array.isArray(scope.domainIds));
  const activeIds = scope?.domainIds ?? [];
  const tailDomainIds = wholeStore
    ? []
    : defaultDomainId
      ? activeIds.filter((id: string) => id !== defaultDomainId)
      : [];
  const readDomainIds = wholeStore
    ? undefined
    : defaultDomainId
      ? activeIds.filter((id: string) => id === defaultDomainId)
      : activeIds;
  const readStable: MemoryEntryRow[] =
    readDomainIds != null && readDomainIds.length === 0
      ? []
      : await stableEntries({
          ownerId,
          storeId: resolvedStoreId,
          domainIds: readDomainIds,
        }).catch(() => []);
  const tailStable: MemoryEntryRow[] =
    tailDomainIds.length > 0
      ? await stableEntries({
          ownerId,
          storeId: resolvedStoreId,
          domainIds: tailDomainIds,
        }).catch(() => [])
      : [];
  const systemEntries: MemoryEntryRow[] = [];
  const tailEntries: MemoryEntryRow[] = [];
  for (const entry of readStable) {
    if (entry.injection === 'additional') {
      tailEntries.push(entry);
    } else {
      systemEntries.push(entry);
    }
  }
  const deltaParts: string[] = [];
  let stableInstructionsContext: string | undefined;
  if (systemEntries.length > 0) {
    stableInstructionsContext = `# Existing memory:\n${formatMemoryEntries(systemEntries, undefined, false, timezone)}`;
  }
  if (tailEntries.length > 0) {
    deltaParts.push(
      `# Existing memory:\n${formatMemoryEntries(tailEntries, undefined, false, timezone)}`,
    );
  }
  if (scope && Array.isArray(scope.active) && scope.active.length > 0) {
    const legend = buildDomainKindLegend();
    stableInstructionsContext = stableInstructionsContext
      ? `${legend}\n\n${stableInstructionsContext}`
      : legend;
  }
  if (scope) {
    const domainsBlock = buildActiveDomainsBlock(scope);
    if (domainsBlock) {
      deltaParts.push(domainsBlock);
    }
    for (const domain of scope.active ?? []) {
      if (domain.id === defaultDomainId) {
        continue;
      }
      const rows = tailStable.filter((entry) => entry.domainId === domain.id);
      if (rows.length === 0) {
        continue;
      }
      deltaParts.push(
        `# Stable memory — ${domain.name}\n${formatMemoryEntries(rows, undefined, false, timezone)}`,
      );
    }
  }
  return {
    stableContext: stableInstructionsContext,
    dynamicContext: deltaParts.filter(Boolean).join('\n\n') || undefined,
  };
}
