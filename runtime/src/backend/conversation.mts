import mongoose from 'mongoose';
import { models } from '../db.mjs';
import { readableStore, requirePermission, stripTags, tagsOf } from './memories.mjs';
import type { ConversationMemoryRow, MemoryDomainRow, MemoryEntryRow } from './types.mjs';

/** One memory link as the conversation list surfaces it. */
interface ConversationMemoryEntry {
  created: boolean;
  key: string;
  value: string;
  content: string;
  tags: string[];
  domainId?: string;
  domainName?: string;
  stable: boolean;
  locked?: true;
  extracted: boolean;
  recallCount: number;
  lastRecalledAt?: Date;
  tokenCount?: number;
  updated_at?: Date;
}

/** The conversation's memory links joined with their entries, newest first. */
export async function listConversationMemories({
  userId,
  role,
  storeId,
  conversationId,
}: {
  userId?: string;
  role?: string;
  storeId?: string;
  conversationId?: string;
}): Promise<
  { storeId: string; conversationId: string; memories: ConversationMemoryEntry[] } | { error: 404 }
> {
  await requirePermission({ userId, role, permissions: ['USE', 'READ'] });
  if (!conversationId) {
    throw Object.assign(new Error('conversationId is required.'), { status: 400 });
  }
  const access = await readableStore({ userId, storeId });
  if (!access) {
    return { error: 404 };
  }
  const store = access.store;
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(access.ownerId));
  const links = (await db.ConversationMemory.find({
    userId: user,
    conversationId,
    storeId: String(store._id),
  }).lean()) as ConversationMemoryRow[];
  const keys = links.map((link) => link.key);
  const entries = (await db.MemoryEntry.find({
    userId: user,
    storeId: String(store._id),
    key: { $in: keys },
  }).lean()) as MemoryEntryRow[];
  const byKey = new Map(entries.map((entry) => [entry.key, entry]));
  const domains = (await db.MemoryDomain.find({
    storeId: String(store._id),
  }).lean()) as MemoryDomainRow[];
  const domainNames = new Map(domains.map((domain) => [String(domain._id), domain.name]));
  const memories = links
    .map((link): ConversationMemoryEntry | null => {
      const entry = byKey.get(link.key);
      if (!entry) {
        return null;
      }
      const domainName = entry.domainId ? domainNames.get(String(entry.domainId)) : undefined;
      const hasDomainName = entry.domainId ? domainNames.has(String(entry.domainId)) : false;
      return {
        created: link.source === 'extracted' && link.createdByConversation === true,
        key: entry.key,
        value: entry.value,
        content: stripTags(entry.value),
        tags: tagsOf(entry),
        ...(entry.domainId ? { domainId: entry.domainId } : {}),
        ...(hasDomainName ? { domainName } : {}),
        stable: entry.stable === true,
        ...(entry.locked === true ? { locked: true } : {}),
        extracted: link.source === 'extracted',
        recallCount: link.recallCount ?? 0,
        ...(entry.lastRecalledAt ? { lastRecalledAt: entry.lastRecalledAt } : {}),
        ...(entry.tokenCount != null ? { tokenCount: entry.tokenCount } : {}),
        ...(entry.updated_at ? { updated_at: entry.updated_at } : {}),
      };
    })
    .filter((memory): memory is ConversationMemoryEntry => memory != null)
    .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime());
  return { storeId: String(store._id), conversationId, memories };
}
