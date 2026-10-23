// runtime/db/src/method/memoryTags.ts
/** The memory fields the shared formatters read. Rows, vector hits and VFS
 *  records all satisfy it; nullable members stay nullable because a recall row
 *  is built from a join that can leave them unset. */
export interface MemoryEntryLike {
  tags?: string[] | null;
  value?: string | null;
  domainId?: string | null;
  lastRecalledAt?: Date | string | null;
  tokenCount?: number | null;
  updated_at?: Date | string | null;
  locked?: boolean;
  stable?: boolean;
}

export interface ModelRegistry {
  models: Record<string, import('mongoose').Model<Record<string, unknown>>>;
}

import type {
  Aggregate,
  Connection,
  HydratedDocument,
  Model,
  Query,
  Schema as MongooseSchema,
} from 'mongoose';

/** An identifier the RPC layer may hand over as a hex string or an ObjectId. */
type MemoryId = string | import('mongoose').Types.ObjectId;
/** A document `_id` as lean queries return it. */
type MemoryObjectId = import('mongoose').Types.ObjectId;

/** One `memoryentries` document, mirroring the schema that registers it. The
 *  factories receive an untyped model registry, so a query's rows are asserted
 *  to this shape once rather than at every property access. */
interface MemoryEntryRow extends MemoryEntryLike {
  _id: MemoryObjectId;
  userId: MemoryId;
  key: string;
  value: string;
  tags?: string[];
  storeId?: string | null;
  domainId?: string | null;
  tokenCount?: number;
  stable?: boolean;
  injection?: string;
  locked?: boolean;
  lastRecalledAt?: Date;
  updated_at?: Date;
  tenantId?: string;
}

/** One `memorystores` document. */
interface MemoryStoreRow {
  _id: MemoryObjectId;
  userId: MemoryId;
  name: string;
  isDefault?: boolean;
  created_at?: Date;
  updated_at?: Date;
  tenantId?: string;
}

/** One `memorydomains` document. */
interface MemoryDomainRow {
  _id: MemoryObjectId;
  userId: MemoryId;
  storeId?: string;
  name: string;
  kind: string;
  description?: string | null;
  isDefault?: boolean;
  createdBy?: string;
  created_at?: Date;
  updated_at?: Date;
  tenantId?: string;
}

/** One `memoryversions` document: a memory's recorded history entry. */
interface MemoryVersionRow {
  _id: MemoryObjectId;
  userId: MemoryId;
  memoryId: string;
  key: string;
  value: string;
  tags?: string[];
  storeId?: string | null;
  domainId?: string | null;
  tokenCount?: number;
  stable?: boolean;
  injection?: string;
  locked?: boolean;
  createdAt?: Date;
  tenantId?: string;
}

/** One `conversationmemories` document: a conversation's link to a memory. */
interface ConversationMemoryRow {
  _id: MemoryObjectId;
  userId: MemoryId;
  conversationId: string;
  storeId?: string | null;
  domainId?: string | null;
  source?: string;
  recallCount?: number;
  lastRecallTurnId?: string;
  createdByConversation?: boolean;
  turnMessageId?: string;
  key: string;
  updated_at?: Date;
  tenantId?: string;
}

/** Where an indexed image came from: the attachment or tool call that filed it. */
interface MemoryImageOrigin {
  conversationId?: string;
  messageId?: string;
  fileId?: string;
  toolName?: string;
}

/** One `memoryimages` document's metadata projection (`data` excluded). The
 *  `_id` stays optional because a fresh upsert returns the row it built. */
interface MemoryImageRow {
  _id?: MemoryObjectId;
  userId: MemoryId;
  storeId?: string | null;
  domainId?: string | null;
  id?: number;
  sha256: string;
  dhash?: string;
  mime?: string;
  width?: number;
  height?: number;
  bytes?: number;
  /** The stored blob; it is never read back here, and lean docs carry the
   *  driver's `Binary` rather than the `Buffer` the writer supplied. */
  data?: unknown;
  source?: string;
  origin?: MemoryImageOrigin;
  embedded?: boolean;
  lastRecalledAt?: Date;
  updatedAt?: Date;
  tenantId?: string;
}

/** One row of the per-user image id counter. */
interface MemoryImageCounterRow {
  userId: MemoryId;
  seq?: number;
}

/** The mongoose surface every factory needs: a shared model registry, plus the
 *  connection `loadMessageCreatedAt` reads the app's message collection from. */
interface MemoryMongoose {
  models: Record<string, unknown>;
  model(name: string, schema: MongooseSchema): Model<unknown>;
  connection?: Connection;
}

/** The registry hands out untyped models so it accepts both a mongoose instance
 *  and the app's model registry; the row type is asserted here, once per
 *  factory, instead of on every query result. */
function modelOf<Row>(mongoose: MemoryMongoose, name: string): Model<Row> {
  return mongoose.models[name] as Model<Row>;
}

/** The same lookup for stores that tolerate a model the host never registered. */
function optionalModelOf<Row>(mongoose: MemoryMongoose, name: string): Model<Row> | undefined {
  return mongoose.models[name] as Model<Row> | undefined;
}

/** A store partition as a query filter: rows filed before stores existed (and
 *  all `/memory` mount writes) carry `storeId: null`. */
interface StorePartition {
  storeId: string | null;
}

/** The domain scope of a read; an empty scope means every domain. */
interface DomainIdFilter {
  domainId: { $in: string[] };
}

/** What `createMemory` accepts. */
interface CreateMemoryParams {
  userId: MemoryId;
  key: string;
  value: string;
  tokenCount?: number;
  storeId?: string | null;
  domainId?: string | null;
  defaultDomainId?: string | null;
  stable?: boolean;
  injection?: string;
  locked?: boolean;
}

/** What `setMemory` (create-or-update) accepts. */
interface SetMemoryParams extends CreateMemoryParams {
  allowLocked?: boolean;
  runId?: string | null;
}

/** What `setMemoryStable` accepts. */
interface SetMemoryStableParams {
  userId: MemoryId;
  key: string;
  storeId?: string | null;
  stable?: boolean;
}

/** What `deleteMemory` accepts. */
interface DeleteMemoryParams {
  userId: MemoryId;
  key: string;
  storeId?: string | null;
  allowStable?: boolean;
  allowLocked?: boolean;
}

/** The outcome shared by the memory write paths. */
interface MemoryWriteResult {
  ok: boolean;
  reason?: string;
  created?: boolean;
  domainId?: string;
}

/** What `getMemoryEntriesByKeys` accepts. */
interface GetMemoryEntriesByKeysParams {
  userId: MemoryId;
  storeId?: string | null;
  domainIds?: string[] | null;
  keys?: string[];
}

/** What `getFormattedMemories` accepts. */
interface GetFormattedMemoriesParams {
  userId: MemoryId;
  storeId?: string | null;
  domainIds?: string[] | null;
  excludeConversationId?: string;
  timezone?: string | null;
}

/** The prompt-ready rendering of a store's memories. */
interface FormattedMemoriesResult {
  withKeys: string;
  withoutKeys: string;
  totalTokens: number;
}

/** One tag of a store's vocabulary and whether it is used often enough to
 *  promote into the extractor's prompt. */
interface StoreTagEntry {
  tag: string;
  count: number;
  promoted: boolean;
}

/** What `getStoreTagVocabulary` accepts. */
interface GetStoreTagVocabularyParams {
  storeId?: string | null;
  limit?: number;
  promoteAt?: number;
}

/** What `setConversationMemory` accepts. */
interface SetConversationMemoryParams {
  userId: MemoryId;
  conversationId: string;
  storeId?: string | null;
  domainId?: string | null;
  created?: boolean;
  turnMessageId?: string | null;
  key: string;
}

/** A conversation lookup: the link is scoped to one user's conversation. */
interface ConversationLookupParams {
  userId: MemoryId;
  conversationId: string;
}

/** One memory linked to a conversation, with the link's own accounting. */
interface ConversationMemoryDetail {
  entry: MemoryEntryRow;
  source: 'extracted' | 'recalled';
  recallCount: number;
  createdByConversation?: boolean;
}

/** What `getConversationMemories` accepts. */
interface GetConversationMemoriesParams extends ConversationLookupParams {
  before?: Date;
}

/** What `deleteConversationMemories` accepts. */
interface DeleteConversationMemoriesParams {
  userId: MemoryId;
  conversationId: string | string[];
}

/** What `loadMessageCreatedAt` accepts. */
interface LoadMessageCreatedAtParams {
  userId: MemoryId;
  conversationId: string;
  messageIds: string[];
}

/** One app `messages` row, projected to the anchor time of a turn. */
interface MessageTimeRow {
  messageId: string;
  createdAt?: Date;
}

/** What `deleteCompactedConversationMemories` accepts. */
interface DeleteCompactedConversationMemoriesParams {
  userId: MemoryId;
  conversationId: string;
  retainedFromMessageId?: string | null;
}

/** What `getMemoryInjectionEntries` accepts. */
interface GetMemoryInjectionEntriesParams {
  userId: MemoryId;
  storeId?: string | null;
  domainIds?: string[] | null;
  excludeConversationId?: string;
  stableOnly?: boolean;
}

/** What `getMemoryExtractionEntries` accepts. */
interface GetMemoryExtractionEntriesParams {
  userId: MemoryId;
  storeId?: string | null;
  domainIds?: string[] | null;
  conversationId?: string;
}

/** What `markMemoriesRecalled` accepts. */
interface MarkMemoriesRecalledParams {
  userId: MemoryId;
  storeId?: string | null;
  conversationId?: string;
  turnId?: string | null;
  keys: string[];
}

/** What `evictMemoriesToFitCapacity` accepts. */
interface EvictMemoriesParams {
  userId: MemoryId;
  storeId?: string | null;
  tokenLimit?: number;
  tokenCount: number;
  dryRun?: boolean;
}

/** One memory dropped to make room for a new one. */
interface EvictedMemory {
  key: string;
  value: string;
  storeId?: string;
  tokenCount?: number;
  lastRecalledAt?: Date;
}

/** The outcome of a capacity sweep: `evicted` lists what a dry run would drop. */
interface EvictionResult {
  ok: boolean;
  reason?: string;
  evicted?: EvictedMemory[];
}

/** The state `recordMemoryVersion` records for one write. */
interface MemoryVersionSnapshot {
  userId: MemoryId;
  memoryId: MemoryId;
  key: string;
  value: string;
  tags?: string[];
  storeId?: string | null;
  domainId?: string | null;
  tokenCount?: number;
  stable?: boolean;
  injection?: string;
  locked?: boolean;
  runId?: string | null;
}

/** What `getMemoryVersions` accepts. */
interface MemoryVersionListParams {
  userId: MemoryId;
  memoryId: string;
  limit?: number;
}

/** What `getMemoryVersion` accepts. */
interface MemoryVersionLookupParams extends MemoryVersionListParams {
  versionId: string;
}

/** What `reassignMemoryVersions` accepts. */
interface ReassignMemoryVersionsParams {
  fromMemoryId: string;
  toMemoryId: string;
}

/** One principal an ACL check runs for, as the injected helpers expect it. */
export interface MemoryStorePrincipal {
  principalType: string;
  principalId?: MemoryId;
}

/** The ACL helpers `createMemoryStoreMethods` is injected with. They mirror
 *  data-schemas' aclEntry/userGroup methods but read through the plugin's own
 *  models, which is why they stay injected instead of imported. */
export interface MemoryStoreDeps {
  getUserPrincipals(params: { userId: MemoryId; role?: string }): Promise<MemoryStorePrincipal[]>;
  findAccessibleResources(
    principals: MemoryStorePrincipal[],
    resourceType: string,
    requiredPermission: number,
  ): Promise<Array<string | MemoryObjectId>>;
  getEffectivePermissionsForResources(
    principals: MemoryStorePrincipal[],
    resourceType: string,
    resourceIds: Array<string | MemoryObjectId>,
  ): Promise<Map<string, number>>;
}

/** What `createMemoryStore` accepts. */
interface CreateMemoryStoreParams {
  userId: MemoryId;
  name?: string | null;
}

/** What `updateMemoryStore` accepts. */
interface UpdateMemoryStoreParams {
  storeId: string;
  userId: MemoryId;
  name?: string | null;
}

/** What `deleteMemoryStore` / `clearMemoryStore` accept. */
interface MemoryStoreIdParams {
  storeId: string;
  userId: MemoryId;
}

/** The outcome of a store write. */
interface MemoryStoreWriteResult {
  ok: boolean;
  reason?: string;
  store?: MemoryStoreRow | null;
}

/** One store as the panel lists it, with the caller's access. */
interface MemoryStoreListEntry {
  store: MemoryStoreRow;
  isOwner: boolean;
  permissionBits: number;
}

/** A resolved store access, owner and write capability included. */
interface MemoryStoreAccessInfo {
  store: MemoryStoreRow;
  ownerId: string;
  storeId: string;
  canWrite: boolean;
}

/** One row of the per-store memory/token aggregate. */
interface MemoryStoreStatsRow {
  _id: string;
  memoryCount: number;
  totalTokens: number;
  updatedAt?: Date;
}

/** What `ensureDefaultMemoryDomain` accepts. */
interface EnsureDefaultMemoryDomainParams {
  userId: MemoryId;
  storeId: string;
}

/** One domain as the panel lists it, with its memory accounting. */
interface MemoryDomainListEntry extends MemoryDomainRow {
  memoryCount: number;
  totalTokens: number;
}

/** What `createMemoryDomain` accepts. */
interface CreateMemoryDomainParams {
  userId: MemoryId;
  storeId: string;
  name?: string;
  kind?: string | null;
  description?: string;
  createdBy?: string;
}

/** What `updateMemoryDomain` accepts. */
interface UpdateMemoryDomainParams {
  storeId: MemoryId;
  domainId?: MemoryId;
  name?: string;
  kind?: string;
  description?: string;
}

/** The outcome of a domain write. */
interface MemoryDomainWriteResult {
  ok: boolean;
  reason?: string;
  domain?: MemoryDomainRow;
}

/** The outcome of a domain update: the row can be gone by the time it lands, so
 *  it may still report `null`. */
interface MemoryDomainUpdateResult {
  ok: boolean;
  reason?: string;
  domain?: MemoryDomainRow | null;
}

/** What `getMemoryDomainMemories` accepts. */
interface MemoryDomainMemoriesParams {
  storeId: MemoryId;
  domainId: MemoryId;
}

/** What `deleteMemoryDomain` accepts. */
interface DeleteMemoryDomainParams {
  storeId: MemoryId;
  domainId?: MemoryId;
  force?: boolean;
}

/** What `resolveMemoryDomain` accepts: a domain name or its id. */
interface ResolveMemoryDomainParams {
  storeId: MemoryId;
  domain: string | MemoryObjectId;
}

/** What `upsertMemoryImage` accepts. */
interface UpsertMemoryImageParams {
  userId: MemoryId;
  storeId?: string | null;
  domainId?: string | null;
  sha256: string;
  dhash: string;
  mime: string;
  width?: number;
  height?: number;
  bytes?: number;
  data: Buffer;
  source: string;
  origin?: MemoryImageOrigin;
  tenantId?: string;
}

/** The outcome of filing an image. */
interface UpsertMemoryImageResult {
  ok: boolean;
  reason?: string;
  deduped?: string;
  image?: MemoryImageRow;
}

/** What `getMemoryImages` accepts. */
interface GetMemoryImagesParams {
  userId: MemoryId;
  storeId?: string | null;
  limit?: number;
}

/** What `getMemoryImage` accepts: a content hash or the short id. */
interface GetMemoryImageParams {
  userId: MemoryId;
  storeId?: string | null;
  sha256?: string | null;
  id?: number | null;
}

/** What the sha-addressed image methods accept. */
interface MemoryImageShaParams {
  userId: MemoryId;
  storeId?: string | null;
  sha256: string;
}

/** What `markMemoryImagesRecalled` accepts. */
interface MarkMemoryImagesRecalledParams {
  userId: MemoryId;
  storeId?: string | null;
  hashes: string[];
}

/** The memory read/write surface `createMemoryMethods` builds. */
interface MemoryMethods {
  setMemory(params: SetMemoryParams): Promise<MemoryWriteResult>;
  setMemoryStable(params: SetMemoryStableParams): Promise<MemoryWriteResult>;
  createMemory(params: CreateMemoryParams): Promise<MemoryWriteResult>;
  deleteMemory(params: DeleteMemoryParams): Promise<MemoryWriteResult>;
  getAllUserMemories(userId: MemoryId): Promise<MemoryEntryRow[]>;
  getUserMemories(params: GetUserMemoriesParams): Promise<MemoryEntryRow[]>;
  getMemoryEntriesByKeys(params: GetMemoryEntriesByKeysParams): Promise<MemoryEntryRow[]>;
  getFormattedMemories(params: GetFormattedMemoriesParams): Promise<FormattedMemoriesResult>;
  getMemoryInjectionEntries(params: GetMemoryInjectionEntriesParams): Promise<MemoryEntryRow[]>;
  getMemoryExtractionEntries(params: GetMemoryExtractionEntriesParams): Promise<MemoryEntryRow[]>;
  getStoreTagVocabulary(params: GetStoreTagVocabularyParams): Promise<StoreTagEntry[]>;
  markMemoriesRecalled(params: MarkMemoriesRecalledParams): Promise<void>;
  evictMemoriesToFitCapacity(params: EvictMemoriesParams): Promise<EvictionResult>;
  deleteAllUserMemories(userId: MemoryId): Promise<number>;
  setConversationMemory(params: SetConversationMemoryParams): Promise<{ ok: boolean }>;
  getConversationMemoryKeys(params: ConversationLookupParams): Promise<string[]>;
  getConversationMemories(params: GetConversationMemoriesParams): Promise<MemoryEntryRow[]>;
  getConversationMemoryDetails(
    params: ConversationLookupParams,
  ): Promise<ConversationMemoryDetail[]>;
  deleteConversationMemories(params: DeleteConversationMemoriesParams): Promise<number>;
  deleteCompactedConversationMemories(
    params: DeleteCompactedConversationMemoriesParams,
  ): Promise<number>;
  deleteAllConversationMemories(userId: MemoryId): Promise<number>;
}

/** The store surface `createMemoryStoreMethods` builds. */
interface MemoryStoreMethods {
  createMemoryStore(params: CreateMemoryStoreParams): Promise<MemoryStoreWriteResult>;
  ensureDefaultMemoryStore(userId: MemoryId): Promise<MemoryStoreRow>;
  listMemoryStores(userId: MemoryId): Promise<MemoryStoreListEntry[]>;
  getMemoryStore(params: MemoryStoreLookupParams): Promise<MemoryStoreRow | null>;
  resolveMemoryStoreAccess(params: MemoryStoreAccessParams): Promise<MemoryStoreAccessInfo | null>;
  updateMemoryStore(params: UpdateMemoryStoreParams): Promise<MemoryStoreWriteResult>;
  deleteMemoryStore(params: MemoryStoreIdParams): Promise<MemoryStoreWriteResult>;
  getMemoryStoreStats(
    storeIds: Array<string | MemoryObjectId>,
  ): Promise<Map<string, MemoryStoreStats>>;
  clearMemoryStore(params: MemoryStoreIdParams): Promise<number>;
}

/** The domain surface `createMemoryDomainMethods` builds. */
interface MemoryDomainMethods {
  ensureDefaultMemoryDomain(params: EnsureDefaultMemoryDomainParams): Promise<MemoryDomainRow>;
  listMemoryDomains(params: { storeId: MemoryId }): Promise<MemoryDomainListEntry[]>;
  createMemoryDomain(params: CreateMemoryDomainParams): Promise<MemoryDomainWriteResult>;
  updateMemoryDomain(params: UpdateMemoryDomainParams): Promise<MemoryDomainUpdateResult>;
  deleteMemoryDomain(params: DeleteMemoryDomainParams): Promise<MemoryDomainWriteResult>;
  resolveMemoryDomain(params: ResolveMemoryDomainParams): Promise<MemoryDomainRow | null>;
  getMemoryDomainMemories(params: MemoryDomainMemoriesParams): Promise<MemoryEntryRow[]>;
}

/** The history surface `createMemoryVersionMethods` builds. */
interface MemoryVersionMethods {
  getMemoryVersions(params: MemoryVersionListParams): Promise<MemoryVersionRow[]>;
  getMemoryVersion(params: MemoryVersionLookupParams): Promise<MemoryVersionRow | null>;
  reassignMemoryVersions(params: ReassignMemoryVersionsParams): Promise<void>;
}

/** The image surface `createMemoryImageMethods` builds. */
interface MemoryImageMethods {
  upsertMemoryImage(params: UpsertMemoryImageParams): Promise<UpsertMemoryImageResult>;
  getMemoryImages(params: GetMemoryImagesParams): Promise<MemoryImageRow[]>;
  getMemoryImage(params: GetMemoryImageParams): Promise<MemoryImageRow | null>;
  nextMemoryImageId(userId: MemoryId): Promise<number>;
  deleteMemoryImage(params: MemoryImageShaParams): Promise<number>;
  deleteAllUserMemoryImages(userId: MemoryId): Promise<number>;
  markMemoryImagesRecalled(params: MarkMemoryImagesRecalledParams): Promise<number>;
  markMemoryImageEmbedded(params: MemoryImageShaParams): Promise<number>;
  touchMemoryImage(params: MemoryImageShaParams): Promise<number>;
}

/** Every factory's surface, as one method set. */
type MemoryMethodSet = MemoryMethods &
  MemoryStoreMethods &
  MemoryDomainMethods &
  MemoryImageMethods &
  MemoryVersionMethods;

/** One `##` heading of a memory written as a document. */
interface MemoryHeading {
  index: number;
  heading: string;
}

/** A memory scanned as a document: its lines, headings and lead paragraph. */
interface MemoryDocumentScan {
  lines: string[];
  headings: MemoryHeading[];
  lead: string;
}

/** One heading-delimited section, addressed by its ordinal id. */
interface MemorySection {
  id: string;
  heading: string;
  text: string;
}

/** A memory split into its lead and sections. */
interface MemorySectionSplit {
  lead: string;
  sections: MemorySection[];
}

var TAG_PREFIX = 'tags:';
var TAG_SEPARATOR = '|';
var TAG_DELIMITER_PATTERN = /[|｜,，、]/;
function splitTagTokens(raw: string | null | undefined): string[] {
  return typeof raw === 'string' ? raw.split(TAG_DELIMITER_PATTERN) : [];
}
var MAX_TAG_CHARS = 32;
var MAX_TAGS_PER_MEMORY = 24;
var TAG_LINE_PATTERN = /^\s*tags:\s*(\S.*)$/i;
var LINK_KEY_TOKEN = '@[\\p{L}\\p{N}_]+';
var LINK_LINE_PATTERN = new RegExp(`^${LINK_KEY_TOKEN}(?:[^\\S\\n]+${LINK_KEY_TOKEN})*$`, 'u');
var LINK_SEPARATOR_PATTERN = /[^\S\n]+/;
function parseMemoryLinkKeys(line: string | null | undefined): string[] {
  if (typeof line !== 'string') {
    return [];
  }
  const text = line.trim();
  if (!LINK_LINE_PATTERN.test(text)) {
    return [];
  }
  return text.split(LINK_SEPARATOR_PATTERN).map((token) => token.slice(1));
}
function normalizeTag(raw: string | null | undefined): string {
  if (typeof raw !== 'string') {
    return '';
  }
  const normalized = raw
    .normalize('NFKC')
    .replace(/["\\]/g, '')
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return normalized.length > MAX_TAG_CHARS ? '' : normalized;
}
function parseTagPayload(payload: string): string[] {
  return splitTagTokens(payload).map(normalizeTag).filter(Boolean);
}
function isLinkLine(line: string): boolean {
  return LINK_LINE_PATTERN.test(line);
}
function isMetadataLine(line: string): boolean {
  return TAG_LINE_PATTERN.test(line) || LINK_LINE_PATTERN.test(line);
}
function mergeTags(
  ...groups: Array<ReadonlyArray<string | null | undefined> | null | undefined>
): string[] {
  const merged = [];
  const seen = /* @__PURE__ */ new Set();
  for (const group of groups) {
    for (const raw of group ?? []) {
      for (const token of splitTagTokens(raw)) {
        const tag = normalizeTag(token);
        if (!tag || seen.has(tag)) {
          continue;
        }
        seen.add(tag);
        merged.push(tag);
        if (merged.length === MAX_TAGS_PER_MEMORY) {
          return merged;
        }
      }
    }
  }
  return merged;
}
function splitTrailingMetadata(value: string): {
  content: string;
  tags: string[];
  links: string[];
} {
  const text = value.trimEnd();
  const lines = text.split('\n');
  const dropped = /* @__PURE__ */ new Set();
  const declared = [];
  const links = [];
  let index = lines.length - 1;
  while (index >= 0) {
    const line = lines[index].trim();
    if (!isMetadataLine(line)) {
      break;
    }
    dropped.add(index);
    const tagMatch = TAG_LINE_PATTERN.exec(line);
    if (tagMatch) {
      declared.push(parseTagPayload(tagMatch[1]));
    } else {
      links.push(line);
    }
    index -= 1;
  }
  if (dropped.size === 0) {
    return { content: text, tags: [], links: [] };
  }
  return {
    content: lines
      .filter((_, lineIndex) => !dropped.has(lineIndex))
      .join('\n')
      .trimEnd(),
    tags: mergeTags(...declared.reverse()),
    links: links.reverse(),
  };
}
function dedupe<T>(lines: T[]): T[] {
  return [...new Set(lines)];
}
function parseTrailingTags(value: string | null | undefined): { content: string; tags: string[] } {
  if (typeof value !== 'string' || !value.trim()) {
    return { content: '', tags: [] };
  }
  const metadata = splitTrailingMetadata(value);
  if (metadata.tags.length === 0) {
    return { content: value.trimEnd(), tags: [] };
  }
  const content = [metadata.content, ...dedupe(metadata.links)].filter(Boolean).join('\n');
  return { content: content.trimEnd(), tags: metadata.tags };
}
function formatTagLine(tags: ReadonlyArray<string | null | undefined> | null | undefined): string {
  const merged = mergeTags(tags);
  return merged.length === 0 ? '' : `${TAG_PREFIX}${merged.join(TAG_SEPARATOR)}`;
}
function memoryTagsOf(entry: MemoryEntryLike | null | undefined): string[] {
  if (!entry) {
    return [];
  }
  const stored = mergeTags(Array.isArray(entry.tags) ? entry.tags : null);
  return stored.length > 0 ? stored : parseTrailingTags(entry.value).tags;
}
/** A memory value of unknown provenance: recall's link summarizer hands over a
 *  column this module cannot type, and the text helpers narrow it themselves. */
type MemoryValueSource = { value?: unknown };

function memoryContentOf(entry: MemoryEntryLike | MemoryValueSource | null | undefined): string {
  const value = entry?.value;
  return typeof value === 'string' ? parseTrailingTags(value).content : '';
}
function memoryBodyOf(entry: MemoryEntryLike | null | undefined): string {
  const value = entry?.value;
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }
  const content = parseTrailingTags(value).content.trimEnd();
  const lines = content.split('\n');
  let index = lines.length - 1;
  while (index >= 0 && isLinkLine(lines[index].trim())) {
    index -= 1;
  }
  return (index === lines.length - 1 ? content : lines.slice(0, index + 1).join('\n')).trimEnd();
}
function withoutLinkLines(text: string): string {
  return text
    .split('\n')
    .filter((line) => !isLinkLine(line.trim()))
    .join('\n');
}
function memoryVectorText(entry: MemoryEntryLike | null | undefined): string {
  const body = withoutLinkLines(memoryBodyOf(entry));
  const tags = memoryTagsOf(entry);
  if (tags.length === 0) {
    return body;
  }
  return [body, formatTagLine(tags)].filter(Boolean).join('\n');
}
function memoryTagField(entry: MemoryEntryLike | null | undefined): string {
  const tags = memoryTagsOf(entry);
  return tags.length === 0 ? '' : ` ["tags": "${tags.join(', ')}"]`;
}
function mergeLinkLines(lines: string[]): string[] {
  const seen = /* @__PURE__ */ new Set();
  const merged = [];
  for (const line of lines) {
    const keys = parseMemoryLinkKeys(line);
    const remaining = [];
    for (const key of keys) {
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      remaining.push(key);
    }
    if (remaining.length === 0) {
      continue;
    }
    merged.push(
      remaining.length === keys.length ? line : remaining.map((key) => `@${key}`).join(' '),
    );
  }
  return merged;
}
function normalizeMemoryValue(value: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    return value;
  }
  const metadata = splitTrailingMetadata(value);
  const bodyLines = metadata.content.split('\n');
  const interiorLinks = bodyLines.filter((line) => isLinkLine(line.trim()));
  if (interiorLinks.length === 0) {
    return value;
  }
  const body = bodyLines
    .filter((line) => !isLinkLine(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
  const links = mergeLinkLines([...interiorLinks, ...metadata.links]);
  return [body, ...links, formatTagLine(metadata.tags)].filter(Boolean).join('\n');
}
function appendMemoryValue(existingValue: string, addition: string): string {
  const existing = splitTrailingMetadata(existingValue);
  const added = splitTrailingMetadata(addition);
  const content = [existing.content, added.content].filter(Boolean).join('\n');
  const links = mergeLinkLines([...existing.links, ...added.links]);
  const tagLine = formatTagLine(mergeTags(existing.tags, added.tags));
  return normalizeMemoryValue([content, ...links, tagLine].filter(Boolean).join('\n'));
}

// runtime/db/src/method/memoryVersion.ts
import { Types } from 'mongoose';
import { logger } from '@amor-harness/data-schemas';
var MAX_MEMORY_VERSIONS = 50;
var sameState = (version: MemoryVersionRow, snapshot: MemoryVersionSnapshot): boolean =>
  version.key === snapshot.key &&
  version.value === snapshot.value &&
  (version.domainId ?? void 0) === (snapshot.domainId ? String(snapshot.domainId) : void 0);
async function recordMemoryVersion(
  mongoose: MemoryMongoose,
  snapshot: MemoryVersionSnapshot,
): Promise<void> {
  try {
    const MemoryVersion = modelOf<MemoryVersionRow>(mongoose, 'MemoryVersion');
    const memoryId = String(snapshot.memoryId);
    const kept = await MemoryVersion.find({ memoryId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(MAX_MEMORY_VERSIONS)
      .lean();
    const latest = kept[0];
    if (latest && sameState(latest, snapshot)) {
      return;
    }
    const created = await MemoryVersion.create({
      userId: snapshot.userId,
      memoryId,
      key: snapshot.key,
      value: snapshot.value,
      tags: snapshot.tags ?? [],
      ...(snapshot.storeId ? { storeId: String(snapshot.storeId) } : {}),
      ...(snapshot.domainId ? { domainId: String(snapshot.domainId) } : {}),
      tokenCount: snapshot.tokenCount ?? 0,
      stable: snapshot.stable === true,
      injection: snapshot.injection === 'additional' ? 'additional' : 'system',
      locked: snapshot.locked === true,
      ...(snapshot.runId ? { runId: String(snapshot.runId) } : {}),
      createdAt: /* @__PURE__ */ new Date(),
    });
    if (kept.length === MAX_MEMORY_VERSIONS) {
      const keepIds = [
        created._id,
        ...kept.slice(0, MAX_MEMORY_VERSIONS - 1).map((version) => version._id),
      ];
      await MemoryVersion.deleteMany({ memoryId, _id: { $nin: keepIds } });
    }
  } catch (error) {
    logger.error('Failed to record a memory version:', error);
  }
}
async function listMemoryVersions(
  mongoose: MemoryMongoose,
  { userId, memoryId, limit }: MemoryVersionListParams,
): Promise<MemoryVersionRow[]> {
  const MemoryVersion = modelOf<MemoryVersionRow>(mongoose, 'MemoryVersion');
  const query = MemoryVersion.find({ userId, memoryId }).sort({ createdAt: -1, _id: -1 });
  if (limit != null && limit > 0) {
    query.limit(limit);
  }
  return await query.lean();
}
async function findMemoryVersion(
  mongoose: MemoryMongoose,
  { userId, memoryId, versionId }: MemoryVersionLookupParams,
): Promise<MemoryVersionRow | null> {
  if (!Types.ObjectId.isValid(versionId)) {
    return null;
  }
  const MemoryVersion = modelOf<MemoryVersionRow>(mongoose, 'MemoryVersion');
  return await MemoryVersion.findOne({
    _id: versionId,
    userId,
    memoryId,
  }).lean();
}
interface MemoryVersionDeleteFilter {
  userId?: string | Types.ObjectId;
  storeId?: string;
  memoryIds?: string[];
}
interface MemoryVersionDeleteQuery {
  userId?: string | Types.ObjectId;
  storeId?: string;
  memoryId?: { $in: string[] };
}
async function deleteMemoryVersions(
  mongoose: MemoryMongoose,
  filter: MemoryVersionDeleteFilter,
): Promise<void> {
  const { userId, storeId, memoryIds } = filter;
  const query: MemoryVersionDeleteQuery = {};
  if (userId) {
    query.userId = userId;
  }
  if (storeId) {
    query.storeId = String(storeId);
  }
  if (memoryIds) {
    if (memoryIds.length === 0) {
      return;
    }
    query.memoryId = { $in: memoryIds };
  }
  if (Object.keys(query).length === 0) {
    return;
  }
  await modelOf<MemoryVersionRow>(mongoose, 'MemoryVersion').deleteMany(query);
}
async function reassignMemoryVersions(
  mongoose: MemoryMongoose,
  { fromMemoryId, toMemoryId }: ReassignMemoryVersionsParams,
): Promise<void> {
  if (fromMemoryId === toMemoryId) {
    return;
  }
  await modelOf<MemoryVersionRow>(mongoose, 'MemoryVersion').updateMany(
    { memoryId: fromMemoryId },
    { $set: { memoryId: toMemoryId } },
  );
}
function createMemoryVersionMethods(mongoose: MemoryMongoose): MemoryVersionMethods {
  return {
    getMemoryVersions: (params: MemoryVersionListParams) => listMemoryVersions(mongoose, params),
    getMemoryVersion: (params: MemoryVersionLookupParams) => findMemoryVersion(mongoose, params),
    reassignMemoryVersions: (params: ReassignMemoryVersionsParams) =>
      reassignMemoryVersions(mongoose, params),
  };
}

// runtime/db/src/util/memoryTime.ts
function formatMemoryTime(
  value: Date | string | number | null | undefined,
  timezone: string | null | undefined,
): string | undefined {
  if (value == null) {
    return void 0;
  }
  const date = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(date.getTime())) {
    return void 0;
  }
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  };
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      ...options,
      ...(timezone ? { timeZone: timezone } : {}),
    });
  } catch {
    formatter = new Intl.DateTimeFormat('en-CA', options);
  }
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}
function memoryTimeField(
  entry: MemoryEntryLike | null | undefined,
  timezone: string | null | undefined,
): string {
  const time = formatMemoryTime(entry?.updated_at, timezone);
  return time == null ? '' : ` ["updated": "${time}"]`;
}

// runtime/db/src/memoryEvents.ts
interface MemoryChange {
  type: 'create' | 'set' | 'delete' | 'stable';
  userId?: string;
  key?: string;
  storeId?: string;
  domainId?: string;
  value?: string;
  tags?: string[];
  stable?: boolean;
  sweep?: boolean;
  image?: boolean;
}
type MemoryChangeHandler = (change: MemoryChange) => void | Promise<void>;
var handlers = /* @__PURE__ */ new Set<MemoryChangeHandler>();
function onMemoryChange(handler: MemoryChangeHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}
function emitMemoryChange(change: MemoryChange): void {
  for (const handler of handlers) {
    try {
      const result = handler(change);
      if (result && typeof result.then === 'function') {
        result.catch((error) => {
          console.error('[memoryEvents] vector sync handler failed', error);
        });
      }
    } catch (error) {
      console.error('[memoryEvents] vector sync handler threw', error);
    }
  }
}

// runtime/db/src/method/memory.ts
import { logger as logger2 } from '@amor-harness/data-schemas';
var partitionFilter = (storeId: string | null | undefined): StorePartition => ({
  storeId: storeId ?? null,
});
var storeIdOf = (storeId: string | MemoryObjectId | null | undefined): string | undefined =>
  storeId ? String(storeId) : void 0;
var domainFilter = (domainIds: string[] | null | undefined): Partial<DomainIdFilter> => {
  const ids = (domainIds ?? []).map(String).filter((id) => id !== '');
  return ids.length > 0 ? { domainId: { $in: ids } } : {};
};
var LOCKED_UPDATE_REASON = 'Cannot update a locked memory. Unlock it in the Memories panel first.';
var LOCKED_DELETE_REASON = 'Cannot delete a locked memory. Unlock it in the Memories panel first.';
var isLocked = (entry: Pick<MemoryEntryRow, 'locked'> | null | undefined): boolean =>
  entry?.locked === true;
var injectionOf = (value: string | null | undefined): 'system' | 'additional' =>
  value === 'additional' ? 'additional' : 'system';

interface MemoryEntryQuery {
  userId?: string | Types.ObjectId;
  storeId?: string | null;
  domainId?: { $in: string[] };
  stable?: boolean;
  key?: string | { $in: string[] } | { $nin: string[] };
  updated_at?: { $lte: Date };
  $or?: Array<{ key?: string; storeId?: string | null }>;
}
interface GetUserMemoriesParams {
  userId: string | Types.ObjectId;
  storeId?: string | null;
  domainIds?: string[] | null;
  excludeKeys?: string[];
  stableOnly?: boolean;
}
function createMemoryMethods(
  mongoose: MemoryMongoose,
  appMongoose: MemoryMongoose = mongoose,
): MemoryMethods {
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
  }: CreateMemoryParams): Promise<MemoryWriteResult> {
    try {
      if (key?.toLowerCase() === 'nothing') {
        return { ok: false };
      }
      const MemoryEntry = modelOf<MemoryEntryRow>(mongoose, 'MemoryEntry');
      const existingMemory = await MemoryEntry.findOne({
        userId,
        key,
        ...partitionFilter(storeId),
      });
      if (existingMemory) {
        throw new Error('Memory with this key already exists');
      }
      const now = /* @__PURE__ */ new Date();
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
      await recordMemoryVersion(mongoose, {
        userId,
        memoryId: created._id,
        key,
        value,
        tags,
        storeId,
        domainId: created.domainId != null ? String(created.domainId) : void 0,
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
    runId,
  }: SetMemoryParams): Promise<MemoryWriteResult> {
    try {
      if (key?.toLowerCase() === 'nothing') {
        return { ok: false };
      }
      const MemoryEntry = modelOf<MemoryEntryRow>(mongoose, 'MemoryEntry');
      if (!allowLocked) {
        const existing = await MemoryEntry.findOne({
          userId,
          key,
          ...partitionFilter(storeId),
        })
          .select('locked')
          .lean();
        if (isLocked(existing)) {
          return { ok: false, reason: LOCKED_UPDATE_REASON };
        }
      }
      const now = /* @__PURE__ */ new Date();
      const tags = parseTrailingTags(value).tags;
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
      if (updated) {
        await recordMemoryVersion(mongoose, {
          userId,
          memoryId: updated._id,
          key,
          value,
          tags,
          storeId: storeId ?? updated.storeId,
          domainId: updated.domainId != null ? String(updated.domainId) : void 0,
          tokenCount,
          stable: updated.stable === true,
          injection: injectionOf(updated.injection),
          locked: updated.locked === true,
          ...(runId ? { runId: String(runId) } : {}),
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
  async function deleteMemory({
    userId,
    key,
    storeId,
    allowStable = false,
    allowLocked = false,
  }: DeleteMemoryParams): Promise<MemoryWriteResult> {
    try {
      const MemoryEntry = modelOf<MemoryEntryRow>(mongoose, 'MemoryEntry');
      const match = { userId, key, ...partitionFilter(storeId) };
      const existing = await MemoryEntry.findOne(match).lean();
      if (existing) {
        if (!allowLocked && isLocked(existing)) {
          return { ok: false, reason: LOCKED_DELETE_REASON };
        }
        if (!allowStable && existing.stable === true) {
          return {
            ok: false,
            reason: 'Cannot delete a stable memory. Disable stable memory before deleting.',
          };
        }
      }
      const result = await MemoryEntry.findOneAndDelete(match);
      if (result) {
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
  async function setMemoryStable({
    userId,
    key,
    storeId,
    stable,
  }: SetMemoryStableParams): Promise<MemoryWriteResult> {
    try {
      const MemoryEntry = modelOf<MemoryEntryRow>(mongoose, 'MemoryEntry');
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
  async function getAllUserMemories(userId: MemoryId): Promise<MemoryEntryRow[]> {
    try {
      const MemoryEntry = modelOf<MemoryEntryRow>(mongoose, 'MemoryEntry');
      return await MemoryEntry.find({ userId }).lean();
    } catch (error) {
      throw new Error(
        `Failed to get all memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
  async function getUserMemories({
    userId,
    storeId,
    domainIds,
    excludeKeys,
    stableOnly,
  }: GetUserMemoriesParams): Promise<MemoryEntryRow[]> {
    try {
      const MemoryEntry = modelOf<MemoryEntryRow>(mongoose, 'MemoryEntry');
      const query: MemoryEntryQuery = {
        userId,
        ...partitionFilter(storeId),
        ...domainFilter(domainIds),
      };
      if (stableOnly === true) {
        query.stable = true;
      }
      if (excludeKeys && excludeKeys.length > 0) {
        query.key = { $nin: excludeKeys };
      }
      return await MemoryEntry.find(query).lean();
    } catch (error) {
      throw new Error(
        `Failed to get memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
  async function getMemoryEntriesByKeys({
    userId,
    storeId,
    domainIds,
    keys,
  }: GetMemoryEntriesByKeysParams): Promise<MemoryEntryRow[]> {
    try {
      const MemoryEntry = modelOf<MemoryEntryRow>(mongoose, 'MemoryEntry');
      if (!keys || keys.length === 0) {
        return [];
      }
      return await MemoryEntry.find({
        userId,
        key: { $in: keys },
        ...partitionFilter(storeId),
        ...domainFilter(domainIds),
      }).lean();
    } catch (error) {
      throw new Error(
        `Failed to get memories by key: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
  async function getFormattedMemories({
    userId,
    storeId,
    domainIds,
    excludeConversationId,
    timezone,
  }: GetFormattedMemoriesParams): Promise<FormattedMemoriesResult> {
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
        (a, b) => new Date(a.updated_at ?? 0).getTime() - new Date(b.updated_at ?? 0).getTime(),
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
      logger2.error('Failed to get formatted memories:', error);
      return { withKeys: '', withoutKeys: '', totalTokens: 0 };
    }
  }
  async function getStoreTagVocabulary({
    storeId,
    limit,
    promoteAt = 2,
  }: GetStoreTagVocabularyParams): Promise<StoreTagEntry[]> {
    try {
      const MemoryEntry = modelOf<MemoryEntryRow>(mongoose, 'MemoryEntry');
      const cap = typeof limit === 'number' && Number.isFinite(limit) && limit > 0 ? limit : void 0;
      const rows = await MemoryEntry.aggregate<{ _id: string; count: number }>([
        { $match: { ...partitionFilter(storeId), tags: { $exists: true, $ne: [] } } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        ...(cap != null ? [{ $limit: cap }] : []),
      ]);
      return rows.map((row) => ({
        tag: row._id,
        count: row.count,
        promoted: row.count >= promoteAt,
      }));
    } catch (error) {
      logger2.error('Failed to read the store tag vocabulary:', error);
      return [];
    }
  }
  async function deleteAllUserMemories(userId: MemoryId): Promise<number> {
    try {
      const MemoryEntry = modelOf<MemoryEntryRow>(mongoose, 'MemoryEntry');
      const result = await MemoryEntry.deleteMany({ userId });
      await deleteMemoryVersions(mongoose, { userId });
      emitMemoryChange({ type: 'delete', userId: String(userId), sweep: true });
      return result.deletedCount;
    } catch (error) {
      throw new Error(
        `Failed to delete all user memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
  async function setConversationMemory({
    userId,
    conversationId,
    storeId,
    domainId,
    created,
    turnMessageId,
    key,
  }: SetConversationMemoryParams): Promise<{ ok: boolean }> {
    try {
      const ConversationMemory = modelOf<ConversationMemoryRow>(mongoose, 'ConversationMemory');
      await ConversationMemory.findOneAndUpdate(
        { userId, conversationId, ...partitionFilter(storeId), key },
        {
          $set: {
            updated_at: /* @__PURE__ */ new Date(),
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
  async function getConversationMemoryKeys({
    userId,
    conversationId,
  }: ConversationLookupParams): Promise<string[]> {
    try {
      const ConversationMemory = modelOf<ConversationMemoryRow>(mongoose, 'ConversationMemory');
      const links = await ConversationMemory.find({
        userId,
        conversationId,
        /** Rows written before `source` existed are extraction links. */
        source: { $ne: 'recalled' },
      }).lean();
      return Array.from(new Set(links.map((link) => link.key)));
    } catch (error) {
      logger2.error('Failed to get conversation memory keys:', error);
      return [];
    }
  }
  async function getConversationMemoryDetails({
    userId,
    conversationId,
  }: ConversationLookupParams): Promise<ConversationMemoryDetail[]> {
    try {
      const ConversationMemory = modelOf<ConversationMemoryRow>(mongoose, 'ConversationMemory');
      const links = await ConversationMemory.find({
        userId,
        conversationId,
      }).lean();
      if (links.length === 0) {
        return [];
      }
      const MemoryEntry = modelOf<MemoryEntryRow>(mongoose, 'MemoryEntry');
      const entries = await MemoryEntry.find({
        userId,
        $or: links.map((link) => ({ key: link.key, ...partitionFilter(link.storeId) })),
      }).lean();
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
            source: link.source === 'recalled' ? 'recalled' : 'extracted',
            recallCount: link.recallCount ?? 0,
            ...(link.createdByConversation != null
              ? { createdByConversation: link.createdByConversation }
              : {}),
          },
        ];
      });
    } catch (error) {
      logger2.error('Failed to get conversation memory details:', error);
      return [];
    }
  }
  async function getConversationMemories({
    userId,
    conversationId,
    before,
  }: GetConversationMemoriesParams): Promise<MemoryEntryRow[]> {
    try {
      const ConversationMemory = modelOf<ConversationMemoryRow>(mongoose, 'ConversationMemory');
      const links = await ConversationMemory.find({
        userId,
        conversationId,
      }).lean();
      if (!links || links.length === 0) {
        return [];
      }
      const MemoryEntry = modelOf<MemoryEntryRow>(mongoose, 'MemoryEntry');
      const query: MemoryEntryQuery = {
        userId,
        /** Match each link's (storeId, key) exactly — the same key can exist in
         *  different partitions, and each link records its own partition. */
        $or: links.map((link) => ({ key: link.key, ...partitionFilter(link.storeId) })),
      };
      if (before) {
        query.updated_at = { $lte: before };
      }
      return await MemoryEntry.find(query).lean();
    } catch (error) {
      logger2.error('Failed to get conversation memories:', error);
      return [];
    }
  }
  async function deleteConversationMemories({
    userId,
    conversationId,
  }: DeleteConversationMemoriesParams): Promise<number> {
    try {
      const ConversationMemory = modelOf<ConversationMemoryRow>(mongoose, 'ConversationMemory');
      const ids = Array.isArray(conversationId) ? conversationId : [conversationId];
      const result = await ConversationMemory.deleteMany({ userId, conversationId: { $in: ids } });
      return result.deletedCount ?? 0;
    } catch (error) {
      throw new Error(
        `Failed to delete conversation memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
  async function deleteAllConversationMemories(userId: MemoryId): Promise<number> {
    try {
      const ConversationMemory = modelOf<ConversationMemoryRow>(mongoose, 'ConversationMemory');
      const result = await ConversationMemory.deleteMany({ userId });
      return result.deletedCount ?? 0;
    } catch (error) {
      throw new Error(
        `Failed to delete all conversation memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
  async function loadMessageCreatedAt({
    userId,
    conversationId,
    messageIds,
  }: LoadMessageCreatedAtParams): Promise<Map<string, Date>> {
    const times = /* @__PURE__ */ new Map<string, Date>();
    if (messageIds.length === 0) {
      return times;
    }
    const appConnection = (appMongoose.connection ?? appMongoose) as Connection;
    const rows = await appConnection
      .collection<MessageTimeRow>('messages')
      .find(
        { user: String(userId), conversationId, messageId: { $in: messageIds } },
        { projection: { messageId: 1, createdAt: 1 } },
      )
      .toArray();
    for (const row of rows) {
      if (row.createdAt) {
        times.set(row.messageId, row.createdAt);
      }
    }
    return times;
  }
  async function deleteCompactedConversationMemories({
    userId,
    conversationId,
    retainedFromMessageId,
  }: DeleteCompactedConversationMemoriesParams): Promise<number> {
    try {
      const ConversationMemory = modelOf<ConversationMemoryRow>(mongoose, 'ConversationMemory');
      const links = await ConversationMemory.find({
        userId,
        conversationId,
      }).lean();
      if (links.length === 0) {
        return 0;
      }
      const anchors = [
        ...new Set(
          links.flatMap((link) => (link.turnMessageId == null ? [] : [link.turnMessageId])),
        ),
      ];
      const times =
        retainedFromMessageId == null
          ? /* @__PURE__ */ new Map()
          : await loadMessageCreatedAt({
              userId,
              conversationId,
              messageIds: [...anchors, retainedFromMessageId],
            });
      const boundary = retainedFromMessageId == null ? void 0 : times.get(retainedFromMessageId);
      if (boundary == null) {
        return deleteConversationMemories({ userId, conversationId });
      }
      const released = links.filter((link) => {
        const turn = link.turnMessageId == null ? void 0 : times.get(link.turnMessageId);
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
        `Failed to delete compacted conversation memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
  async function getMemoryInjectionEntries({
    userId,
    storeId,
    domainIds,
    excludeConversationId,
    stableOnly,
  }: GetMemoryInjectionEntriesParams): Promise<MemoryEntryRow[]> {
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
      logger2.error('Failed to get memory injection entries:', error);
      return [];
    }
  }
  async function getMemoryExtractionEntries({
    userId,
    storeId,
    domainIds,
    conversationId,
  }: GetMemoryExtractionEntriesParams): Promise<MemoryEntryRow[]> {
    try {
      let entries;
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
      logger2.error('Failed to get memory extraction entries:', error);
      return [];
    }
  }
  async function markMemoriesRecalled({
    userId,
    storeId,
    conversationId,
    turnId,
    keys,
  }: MarkMemoriesRecalledParams): Promise<void> {
    try {
      if (!Array.isArray(keys) || keys.length === 0) {
        return;
      }
      const MemoryEntry = modelOf<MemoryEntryRow>(mongoose, 'MemoryEntry');
      await MemoryEntry.updateMany(
        { userId, key: { $in: keys }, ...partitionFilter(storeId) },
        { $set: { lastRecalledAt: /* @__PURE__ */ new Date() } },
      );
      if (conversationId) {
        const ConversationMemory = modelOf<ConversationMemoryRow>(mongoose, 'ConversationMemory');
        const now = /* @__PURE__ */ new Date();
        await Promise.all(
          keys.map((key) => {
            const filter = { userId, conversationId, ...partitionFilter(storeId), key };
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
  const evictionTime = (entry: MemoryEntryRow): number =>
    entry.lastRecalledAt ? new Date(entry.lastRecalledAt).getTime() : 0;
  const entryUpdatedTime = (entry: MemoryEntryRow): number =>
    entry.updated_at ? new Date(entry.updated_at).getTime() : 0;
  const compareForEviction = (a: MemoryEntryRow, b: MemoryEntryRow): number => {
    const byRecall = evictionTime(a) - evictionTime(b);
    return byRecall !== 0 ? byRecall : entryUpdatedTime(a) - entryUpdatedTime(b);
  };
  async function evictMemoriesToFitCapacity({
    userId,
    storeId,
    tokenLimit,
    tokenCount,
    dryRun = false,
  }: EvictMemoriesParams): Promise<EvictionResult> {
    try {
      if (!tokenLimit || tokenLimit <= 0) {
        return { ok: true, evicted: [] };
      }
      const memories = await getUserMemories({ userId, storeId });
      const totalTokens = memories.reduce((sum, memory) => sum + (memory.tokenCount || 0), 0);
      const overBy = totalTokens + tokenCount - tokenLimit;
      if (overBy <= 0) {
        return { ok: true, evicted: [] };
      }
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
      const evicted = [];
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
        `Failed to evict memories for capacity: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

// runtime/db/src/method/memoryStore.ts
import { Types as Types2 } from 'mongoose';
import { PermissionBits, ResourceType } from '@amor-harness/data-provider';
import { logger as logger3 } from '@amor-harness/data-schemas';
var MEMORY_STORE_NAME_MAX = 80;
var DEFAULT_MEMORY_STORE_NAME = 'Default';
var NAME_REQUIRED_REASON = 'Memory store name is required.';
var NAME_TOO_LONG_REASON = `Memory store name exceeds ${MEMORY_STORE_NAME_MAX} characters.`;
var NAME_EXISTS_REASON = 'A memory store with this name already exists.';
var NOT_FOUND_REASON = 'Memory store not found.';
var FORBIDDEN_REASON = 'Only the memory store owner can change it.';
var DEFAULT_DELETE_REASON = 'The default memory store cannot be deleted.';
var idOf = (value: MemoryId): string => value.toString();
var normalizeName = (name: string | null | undefined): string =>
  typeof name === 'string' ? name.trim() : '';

interface MemoryStoreQuery {
  _id?: string | Types2.ObjectId;
  userId?: string | Types2.ObjectId;
}
interface MemoryStoreLookupParams {
  storeId: string;
  userId?: string;
}
/** A store lookup that always names the caller, as access resolution needs. */
interface MemoryStoreAccessParams {
  storeId: string;
  userId: string;
}
interface MemoryStoreStats {
  memoryCount: number;
  totalTokens: number;
  updatedAt?: Date;
}
function createMemoryStoreMethods(
  mongoose: MemoryMongoose,
  acl: MemoryStoreDeps,
): MemoryStoreMethods {
  const isOwner = (store: MemoryStoreRow, userId: string): boolean => idOf(store.userId) === userId;
  async function permissionBitsFor(
    userId: MemoryId,
    storeIds: Array<string | MemoryObjectId>,
  ): Promise<Map<string, number>> {
    if (storeIds.length === 0) {
      return new Map();
    }
    const principals = await acl.getUserPrincipals({ userId });
    return acl.getEffectivePermissionsForResources(principals, ResourceType.MEMORYSTORE, storeIds);
  }
  const canWrite = (bits: number): boolean => (bits & PermissionBits.EDIT) !== 0;
  async function migrateLegacyMemories(userId: MemoryId, storeId: string): Promise<void> {
    const legacy = { userId, storeId: { $exists: false } };
    const migrated = await optionalModelOf<MemoryEntryRow>(mongoose, 'MemoryEntry')
      ?.find(legacy)
      .select('key value stable')
      .lean();
    await Promise.all([
      optionalModelOf<MemoryEntryRow>(mongoose, 'MemoryEntry')?.updateMany(legacy, {
        $set: { storeId },
      }),
      optionalModelOf<MemoryImageRow>(mongoose, 'MemoryImage')?.updateMany(legacy, {
        $set: { storeId },
      }),
      optionalModelOf<ConversationMemoryRow>(mongoose, 'ConversationMemory')?.updateMany(legacy, {
        $set: { storeId },
      }),
    ]);
    for (const entry of migrated ?? []) {
      emitMemoryChange({
        type: 'set',
        userId: String(userId),
        key: entry.key,
        storeId,
        value: entry.value,
        stable: entry.stable === true,
      });
    }
  }
  async function ensureDefaultMemoryStore(userId: MemoryId): Promise<MemoryStoreRow> {
    const MemoryStore = modelOf<MemoryStoreRow>(mongoose, 'MemoryStore');
    const existing = await MemoryStore.findOne({ userId, isDefault: true }).lean();
    if (existing) {
      return existing;
    }
    const now = /* @__PURE__ */ new Date();
    const created = await MemoryStore.findOneAndUpdate(
      { userId, isDefault: true },
      {
        $setOnInsert: {
          userId,
          name: DEFAULT_MEMORY_STORE_NAME,
          isDefault: true,
          created_at: now,
          updated_at: now,
        },
      },
      { upsert: true, new: true },
    ).lean();
    await migrateLegacyMemories(userId, String(created._id));
    return created;
  }
  async function createMemoryStore({
    userId,
    name,
  }: CreateMemoryStoreParams): Promise<MemoryStoreWriteResult> {
    const trimmed = normalizeName(name);
    if (trimmed === '') {
      return { ok: false, reason: NAME_REQUIRED_REASON };
    }
    if (trimmed.length > MEMORY_STORE_NAME_MAX) {
      return { ok: false, reason: NAME_TOO_LONG_REASON };
    }
    const MemoryStore = modelOf<MemoryStoreRow>(mongoose, 'MemoryStore');
    const duplicate = await MemoryStore.findOne({ userId, name: trimmed }).lean();
    if (duplicate) {
      return { ok: false, reason: NAME_EXISTS_REASON };
    }
    const now = /* @__PURE__ */ new Date();
    const store = (
      await MemoryStore.create({
        userId,
        name: trimmed,
        isDefault: false,
        created_at: now,
        updated_at: now,
      })
    ).toObject();
    return { ok: true, store };
  }
  async function listMemoryStores(userId: MemoryId): Promise<MemoryStoreListEntry[]> {
    const MemoryStore = modelOf<MemoryStoreRow>(mongoose, 'MemoryStore');
    const userIdStr = idOf(userId);
    const principals = await acl.getUserPrincipals({ userId });
    const sharedIds = await acl.findAccessibleResources(
      principals,
      ResourceType.MEMORYSTORE,
      PermissionBits.VIEW,
    );
    const stores = await MemoryStore.find({
      $or: [{ userId }, { _id: { $in: sharedIds } }],
    })
      .sort({ isDefault: -1, name: 1 })
      .lean();
    const bitsByStore = await acl.getEffectivePermissionsForResources(
      principals,
      ResourceType.MEMORYSTORE,
      stores.map((store) => store._id),
    );
    const owned = stores.filter((store) => idOf(store.userId) === userIdStr);
    const shared = stores.filter((store) => idOf(store.userId) !== userIdStr);
    const toAccess = (store: MemoryStoreRow, owner: boolean): MemoryStoreListEntry => ({
      store,
      isOwner: owner,
      permissionBits: bitsByStore.get(String(store._id)) ?? 0,
    });
    return [
      ...owned.map((store) => toAccess(store, true)),
      ...shared.map((store) => toAccess(store, false)),
    ];
  }
  async function getMemoryStore({
    storeId,
    userId,
  }: MemoryStoreLookupParams): Promise<MemoryStoreRow | null> {
    const MemoryStore = modelOf<MemoryStoreRow>(mongoose, 'MemoryStore');
    const query: MemoryStoreQuery = { _id: storeId };
    if (userId != null) {
      query.userId = userId;
    }
    return await MemoryStore.findOne(query).lean();
  }
  async function resolveMemoryStoreAccess({
    storeId,
    userId,
  }: MemoryStoreAccessParams): Promise<MemoryStoreAccessInfo | null> {
    if (!storeId || !Types2.ObjectId.isValid(storeId)) {
      return null;
    }
    try {
      const store = await getMemoryStore({ storeId });
      if (!store) {
        return null;
      }
      const userIdStr = idOf(userId);
      const ownerId = idOf(store.userId);
      if (ownerId === userIdStr) {
        return { store, ownerId, storeId: idOf(store._id), canWrite: true };
      }
      const bits = (await permissionBitsFor(userId, [store._id])).get(String(store._id)) ?? 0;
      if ((bits & PermissionBits.VIEW) === 0) {
        return null;
      }
      return {
        store,
        ownerId,
        storeId: idOf(store._id),
        canWrite: canWrite(bits),
      };
    } catch (error) {
      logger3.error('Failed to resolve memory store access:', error);
      return null;
    }
  }
  async function updateMemoryStore({
    storeId,
    userId,
    name,
  }: UpdateMemoryStoreParams): Promise<MemoryStoreWriteResult> {
    const trimmed = normalizeName(name);
    if (trimmed === '') {
      return { ok: false, reason: NAME_REQUIRED_REASON };
    }
    if (trimmed.length > MEMORY_STORE_NAME_MAX) {
      return { ok: false, reason: NAME_TOO_LONG_REASON };
    }
    const MemoryStore = modelOf<MemoryStoreRow>(mongoose, 'MemoryStore');
    const store = await MemoryStore.findOne({ _id: storeId }).lean();
    if (!store) {
      return { ok: false, reason: NOT_FOUND_REASON };
    }
    const userIdStr = idOf(userId);
    if (!isOwner(store, userIdStr)) {
      const bits = (await permissionBitsFor(userId, [store._id])).get(String(store._id)) ?? 0;
      if (!canWrite(bits)) {
        return { ok: false, reason: FORBIDDEN_REASON };
      }
    }
    const duplicate = await MemoryStore.findOne({
      userId: store.userId,
      name: trimmed,
      _id: { $ne: store._id },
    }).lean();
    if (duplicate) {
      return { ok: false, reason: NAME_EXISTS_REASON };
    }
    const updated = await MemoryStore.findByIdAndUpdate(
      store._id,
      { $set: { name: trimmed, updated_at: /* @__PURE__ */ new Date() } },
      { new: true },
    ).lean();
    return { ok: true, store: updated };
  }
  async function deleteMemoryStore({
    storeId,
    userId,
  }: MemoryStoreIdParams): Promise<MemoryStoreWriteResult> {
    const MemoryStore = modelOf<MemoryStoreRow>(mongoose, 'MemoryStore');
    const store = await MemoryStore.findOne({ _id: storeId }).lean();
    if (!store) {
      return { ok: false, reason: NOT_FOUND_REASON };
    }
    const userIdStr = idOf(userId);
    if (!isOwner(store, userIdStr)) {
      const bits = (await permissionBitsFor(userId, [store._id])).get(String(store._id)) ?? 0;
      if ((bits & PermissionBits.DELETE) === 0) {
        return { ok: false, reason: FORBIDDEN_REASON };
      }
    }
    if (store.isDefault === true) {
      return { ok: false, reason: DEFAULT_DELETE_REASON };
    }
    const storeIdStr = String(store._id);
    const memoryQuery = { storeId: storeIdStr };
    await Promise.all([
      optionalModelOf<MemoryEntryRow>(mongoose, 'MemoryEntry')?.deleteMany(memoryQuery),
      optionalModelOf<MemoryImageRow>(mongoose, 'MemoryImage')?.deleteMany(memoryQuery),
      optionalModelOf<ConversationMemoryRow>(mongoose, 'ConversationMemory')?.deleteMany(
        memoryQuery,
      ),
      /** The memories' recorded history goes with them. */
      deleteMemoryVersions(mongoose, { storeId: storeIdStr }),
      /** Domains belong to the store: they go with it. */
      optionalModelOf<MemoryDomainRow>(mongoose, 'MemoryDomain')?.deleteMany(memoryQuery),
    ]);
    emitMemoryChange({
      type: 'delete',
      userId: String(store.userId),
      storeId: storeIdStr,
      sweep: true,
    });
    await MemoryStore.deleteOne({ _id: store._id });
    return { ok: true };
  }
  async function clearMemoryStore({ storeId }: MemoryStoreIdParams): Promise<number> {
    const storeIdStr = idOf(storeId);
    const memoryQuery = { storeId: storeIdStr };
    const [owner, dropped] = await Promise.all([
      modelOf<MemoryStoreRow>(mongoose, 'MemoryStore')
        .findOne({ _id: storeId })
        .select('userId')
        .lean(),
      optionalModelOf<MemoryEntryRow>(mongoose, 'MemoryEntry')?.countDocuments(memoryQuery),
    ]);
    const ownerId = owner?.userId;
    await Promise.all([
      optionalModelOf<MemoryEntryRow>(mongoose, 'MemoryEntry')?.deleteMany(memoryQuery),
      optionalModelOf<MemoryImageRow>(mongoose, 'MemoryImage')?.deleteMany(memoryQuery),
      optionalModelOf<ConversationMemoryRow>(mongoose, 'ConversationMemory')?.deleteMany(
        memoryQuery,
      ),
      /** The memories' recorded history goes with them. */
      deleteMemoryVersions(mongoose, { storeId: storeIdStr }),
      /** Clear removes the store's contents, and domains are part of them: an
       *  emptied domain left behind would still show up in the panel and the
       *  `/memory` mount. */
      optionalModelOf<MemoryDomainRow>(mongoose, 'MemoryDomain')?.deleteMany(memoryQuery),
    ]);
    if (ownerId) {
      emitMemoryChange({
        type: 'delete',
        userId: String(ownerId),
        storeId: storeIdStr,
        sweep: true,
      });
    }
    return dropped ?? 0;
  }
  async function getMemoryStoreStats(
    storeIds: Array<string | MemoryObjectId>,
  ): Promise<Map<string, MemoryStoreStats>> {
    const stats = /* @__PURE__ */ new Map<string, MemoryStoreStats>();
    if (storeIds.length === 0) {
      return stats;
    }
    const rows = await modelOf<MemoryEntryRow>(
      mongoose,
      'MemoryEntry',
    ).aggregate<MemoryStoreStatsRow>([
      { $match: { storeId: { $in: storeIds.map(String) } } },
      {
        $group: {
          _id: '$storeId',
          memoryCount: { $sum: 1 },
          totalTokens: { $sum: { $ifNull: ['$tokenCount', 0] } },
          updatedAt: { $max: '$updated_at' },
        },
      },
    ]);
    for (const row of rows) {
      stats.set(row._id, {
        memoryCount: row.memoryCount,
        totalTokens: row.totalTokens,
        updatedAt: row.updatedAt ?? void 0,
      });
    }
    return stats;
  }
  return {
    createMemoryStore,
    ensureDefaultMemoryStore,
    listMemoryStores,
    getMemoryStore,
    resolveMemoryStoreAccess,
    updateMemoryStore,
    deleteMemoryStore,
    getMemoryStoreStats,
    clearMemoryStore,
  };
}

// runtime/db/src/method/memoryDomain.ts
import { Types as Types3 } from 'mongoose';
import { MEMORY_DOMAIN_KINDS } from '@amor-harness/data-provider';
import type { MemoryDomainKind } from '@amor-harness/data-provider';
import { logger as logger4 } from '@amor-harness/data-schemas';
var MEMORY_DOMAIN_NAME_MAX = 60;
var MEMORY_DOMAIN_DESCRIPTION_MAX = 200;
var DEFAULT_MEMORY_DOMAIN_NAME = 'Default';
var DEFAULT_MEMORY_DOMAIN_DESCRIPTION = 'Facts about the real world.';
var NAME_REQUIRED_REASON2 = 'Memory domain name is required.';
var NAME_TOO_LONG_REASON2 = `Memory domain name exceeds ${MEMORY_DOMAIN_NAME_MAX} characters.`;
var NAME_EXISTS_REASON2 = 'A memory domain with this name already exists.';
var KIND_INVALID_REASON = 'Unknown memory domain kind.';
var DESCRIPTION_REQUIRED_REASON = 'Memory domain description is required.';
var DESCRIPTION_TOO_LONG_REASON = `Memory domain description exceeds ${MEMORY_DOMAIN_DESCRIPTION_MAX} characters.`;
var NOT_FOUND_REASON2 = 'Memory domain not found.';
var DEFAULT_DELETE_REASON2 = 'The default memory domain cannot be deleted.';
var NOT_EMPTY_REASON = 'The memory domain still holds memories.';
var NAME_COLLATION = { locale: 'en', strength: 2 };
var normalizeField = (value: string | null | undefined): string => {
  if (typeof value !== 'string') {
    return '';
  }
  return value
    .normalize('NFKC')
    .replace(/["\\/]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};
var normalizeName2 = normalizeField;
var normalizeDescription = normalizeField;
var isKnownKind = (kind: string | null | undefined): kind is MemoryDomainKind =>
  typeof kind === 'string' && MEMORY_DOMAIN_KINDS.some((known) => known === kind);

interface MemoryDomainQuery {
  _id?: string | MemoryObjectId | { $ne: string };
  storeId?: string;
  name?: string;
}
interface MemoryDomainCount {
  memoryCount: number;
  totalTokens: number;
}
interface MemoryDomainUpdate {
  updated_at?: Date;
  name?: string;
  kind?: MemoryDomainKind;
  description?: string;
}
function createMemoryDomainMethods(mongoose: MemoryMongoose): MemoryDomainMethods {
  async function adoptLegacyMemories(storeId: string, domainId: string): Promise<void> {
    const legacy = { storeId, domainId: { $exists: false } };
    const migrated = await optionalModelOf<MemoryEntryRow>(mongoose, 'MemoryEntry')
      ?.find(legacy)
      .select('key value stable userId')
      .lean();
    await Promise.all([
      optionalModelOf<MemoryEntryRow>(mongoose, 'MemoryEntry')?.updateMany(legacy, {
        $set: { domainId },
      }),
      optionalModelOf<MemoryImageRow>(mongoose, 'MemoryImage')?.updateMany(legacy, {
        $set: { domainId },
      }),
      optionalModelOf<ConversationMemoryRow>(mongoose, 'ConversationMemory')?.updateMany(legacy, {
        $set: { domainId },
      }),
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
  async function ensureDefaultMemoryDomain({
    userId,
    storeId,
  }: EnsureDefaultMemoryDomainParams): Promise<MemoryDomainRow> {
    const MemoryDomain = modelOf<MemoryDomainRow>(mongoose, 'MemoryDomain');
    const storeIdStr = String(storeId);
    const existing = await MemoryDomain.findOne({
      storeId: storeIdStr,
      isDefault: true,
    }).lean();
    if (existing) {
      return existing;
    }
    const now = /* @__PURE__ */ new Date();
    const created = await MemoryDomain.findOneAndUpdate(
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
    ).lean();
    await adoptLegacyMemories(storeIdStr, String(created._id));
    return created;
  }
  async function countsFor(storeId: string): Promise<Map<string, MemoryDomainCount>> {
    const rows = await optionalModelOf<MemoryEntryRow>(mongoose, 'MemoryEntry')?.aggregate<{
      _id: string;
      memoryCount: number;
      totalTokens: number;
    }>([
      { $match: { storeId, domainId: { $type: 'string' } } },
      {
        $group: {
          _id: '$domainId',
          memoryCount: { $sum: 1 },
          totalTokens: { $sum: { $ifNull: ['$tokenCount', 0] } },
        },
      },
    ]);
    return new Map<string, MemoryDomainCount>(
      (rows ?? []).map((row) => [
        row._id,
        { memoryCount: row.memoryCount, totalTokens: row.totalTokens },
      ]),
    );
  }
  async function listMemoryDomains({
    storeId,
  }: {
    storeId: MemoryId;
  }): Promise<MemoryDomainListEntry[]> {
    const storeIdStr = String(storeId);
    const domains = await modelOf<MemoryDomainRow>(mongoose, 'MemoryDomain')
      .find({ storeId: storeIdStr })
      .sort({ isDefault: -1, name: 1 })
      .lean();
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
      return NAME_REQUIRED_REASON2;
    }
    if (name.length > MEMORY_DOMAIN_NAME_MAX) {
      return NAME_TOO_LONG_REASON2;
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
    const query: MemoryDomainQuery = { storeId, name };
    if (excludeDomainId != null) {
      query._id = { $ne: excludeDomainId };
    }
    const duplicate = await modelOf<MemoryDomainRow>(mongoose, 'MemoryDomain')
      .findOne(query)
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
  }: CreateMemoryDomainParams): Promise<MemoryDomainWriteResult> {
    const storeIdStr = String(storeId);
    const trimmed = normalizeName2(name);
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
      return { ok: false, reason: NAME_EXISTS_REASON2 };
    }
    const now = /* @__PURE__ */ new Date();
    try {
      const domain = (
        await modelOf<MemoryDomainRow>(mongoose, 'MemoryDomain').create({
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
      ).toObject();
      return { ok: true, domain };
    } catch (error) {
      logger4.warn(
        `Failed to create memory domain "${trimmed}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return { ok: false, reason: NAME_EXISTS_REASON2 };
    }
  }
  async function updateMemoryDomain({
    storeId,
    domainId,
    name,
    kind,
    description,
  }: UpdateMemoryDomainParams): Promise<MemoryDomainUpdateResult> {
    const storeIdStr = String(storeId);
    const domain = await modelOf<MemoryDomainRow>(mongoose, 'MemoryDomain')
      .findOne({
        _id: domainId,
        storeId: storeIdStr,
      })
      .lean();
    if (!domain) {
      return { ok: false, reason: NOT_FOUND_REASON2 };
    }
    const update: MemoryDomainUpdate = { updated_at: /* @__PURE__ */ new Date() };
    if (name !== void 0) {
      const trimmed = normalizeName2(name);
      const nameError = validateName(trimmed);
      if (nameError) {
        return { ok: false, reason: nameError };
      }
      if (await nameTaken(storeIdStr, trimmed, String(domain._id))) {
        return { ok: false, reason: NAME_EXISTS_REASON2 };
      }
      update.name = trimmed;
    }
    if (kind !== void 0) {
      if (!isKnownKind(kind)) {
        return { ok: false, reason: KIND_INVALID_REASON };
      }
      update.kind = kind;
    }
    if (description !== void 0) {
      const trimmed = normalizeDescription(description);
      const descriptionError = validateDescription(trimmed);
      if (descriptionError) {
        return { ok: false, reason: descriptionError };
      }
      update.description = trimmed;
    }
    const updated = await modelOf<MemoryDomainRow>(mongoose, 'MemoryDomain')
      .findByIdAndUpdate(domain._id, { $set: update }, { new: true })
      .lean();
    return { ok: true, domain: updated };
  }
  async function getMemoryDomainMemories({
    storeId,
    domainId,
  }: MemoryDomainMemoriesParams): Promise<MemoryEntryRow[]> {
    return (
      (await optionalModelOf<MemoryEntryRow>(mongoose, 'MemoryEntry')
        ?.find({
          storeId: String(storeId),
          domainId: String(domainId),
        })
        .select('key value stable')
        .lean()) ?? []
    );
  }
  async function deleteMemoryDomain({
    storeId,
    domainId,
    force = false,
  }: DeleteMemoryDomainParams): Promise<MemoryDomainWriteResult> {
    const storeIdStr = String(storeId);
    const domain = await modelOf<MemoryDomainRow>(mongoose, 'MemoryDomain')
      .findOne({
        _id: domainId,
        storeId: storeIdStr,
      })
      .lean();
    if (!domain) {
      return { ok: false, reason: NOT_FOUND_REASON2 };
    }
    if (domain.isDefault === true) {
      return { ok: false, reason: DEFAULT_DELETE_REASON2 };
    }
    const memories = await getMemoryDomainMemories({ storeId: storeIdStr, domainId: domain._id });
    if (memories.length > 0 && !force) {
      return { ok: false, reason: NOT_EMPTY_REASON };
    }
    const domainIdStr = String(domain._id);
    await Promise.all([
      optionalModelOf<MemoryEntryRow>(mongoose, 'MemoryEntry')?.deleteMany({
        storeId: storeIdStr,
        domainId: domainIdStr,
      }),
      optionalModelOf<MemoryImageRow>(mongoose, 'MemoryImage')?.deleteMany({
        storeId: storeIdStr,
        domainId: domainIdStr,
      }),
      optionalModelOf<ConversationMemoryRow>(mongoose, 'ConversationMemory')?.deleteMany({
        storeId: storeIdStr,
        domainId: domainIdStr,
      }),
    ]);
    emitMemoryChange({
      type: 'delete',
      userId: String(domain.userId),
      storeId: storeIdStr,
      domainId: domainIdStr,
      sweep: true,
    });
    await modelOf<MemoryDomainRow>(mongoose, 'MemoryDomain').deleteOne({ _id: domain._id });
    return { ok: true };
  }
  async function resolveMemoryDomain({
    storeId,
    domain,
  }: ResolveMemoryDomainParams): Promise<MemoryDomainRow | null> {
    const storeIdStr = String(storeId);
    const query: MemoryDomainQuery = { storeId: storeIdStr };
    if (Types3.ObjectId.isValid(domain as string | MemoryObjectId)) {
      query._id = domain as string | MemoryObjectId;
    } else {
      query.name = domain as string;
    }
    const found = await modelOf<MemoryDomainRow>(mongoose, 'MemoryDomain')
      .findOne(query)
      .collation(NAME_COLLATION)
      .lean();
    return found ?? null;
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

// runtime/db/src/method/memoryImage.ts
import { Types as Types4 } from 'mongoose';
import { logger as logger6 } from '@amor-harness/data-schemas';

// runtime/db/src/schema/memoryImageCounter.ts
import { Schema } from 'mongoose';
var memoryImageCounterSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
    unique: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});
var memoryImageCounter_default = memoryImageCounterSchema;

// runtime/db/src/model/tenantIsolation.ts
import { getTenantId, SYSTEM_TENANT_ID } from '@amor-harness/data-schemas';
import { logger as logger5 } from '@amor-harness/data-schemas';
var _strictMode: boolean | undefined;
function isStrict(): boolean {
  return (_strictMode ??= process.env.TENANT_ISOLATION_STRICT === 'true');
}
if (
  process.env.TENANT_ISOLATION_STRICT &&
  process.env.TENANT_ISOLATION_STRICT !== 'true' &&
  process.env.TENANT_ISOLATION_STRICT !== 'false'
) {
  logger5.warn(
    `[TenantIsolation] TENANT_ISOLATION_STRICT="${process.env.TENANT_ISOLATION_STRICT}" is not "true" or "false"; defaulting to non-strict mode.`,
  );
}
var TENANT_ISOLATION_APPLIED = /* @__PURE__ */ Symbol.for('librechat:tenantIsolation');
var VALUE_OPERATORS = ['$set', '$setOnInsert'];
var STRIP_OPERATORS = ['$unset', '$rename'];
function sanitizeTenantIdMutation(update: Record<string, unknown> | null | undefined): void {
  if (!update) {
    return;
  }
  const currentTenantId = getTenantId();
  for (const op of VALUE_OPERATORS) {
    const payload = update[op] as Record<string, unknown> | undefined;
    if (payload && 'tenantId' in payload) {
      if (currentTenantId && payload.tenantId !== currentTenantId) {
        throw new Error('[TenantIsolation] Cross-tenant tenantId mutation is not allowed');
      }
      delete payload.tenantId;
      if (Object.keys(payload).length === 0) {
        delete update[op];
      }
    }
  }
  for (const op of STRIP_OPERATORS) {
    const payload = update[op] as Record<string, unknown> | undefined;
    if (payload && 'tenantId' in payload) {
      delete payload.tenantId;
      if (Object.keys(payload).length === 0) {
        delete update[op];
      }
    }
  }
  if ('tenantId' in update) {
    if (currentTenantId && update.tenantId !== currentTenantId) {
      throw new Error('[TenantIsolation] Cross-tenant tenantId mutation is not allowed');
    }
    delete update.tenantId;
  }
}
function applyTenantIsolation(schema: MongooseSchema): void {
  const s = schema as MongooseSchema & Record<PropertyKey, unknown>;
  if (s[TENANT_ISOLATION_APPLIED]) {
    return;
  }
  s[TENANT_ISOLATION_APPLIED] = true;
  const queryMiddleware = function (this: Query<unknown, unknown>) {
    const tenantId = getTenantId();
    if (!tenantId && isStrict()) {
      throw new Error('[TenantIsolation] Query attempted without tenant context in strict mode');
    }
    if (!tenantId || tenantId === SYSTEM_TENANT_ID) {
      return;
    }
    this.where({ tenantId });
  };
  const updateGuard = function (this: Query<unknown, unknown>) {
    const tenantId = getTenantId();
    if (tenantId === SYSTEM_TENANT_ID) {
      return;
    }
    sanitizeTenantIdMutation(this.getUpdate() as Record<string, unknown> | null | undefined);
    const update = this.getUpdate();
    if (update && Object.keys(update).length === 0) {
      this.where({ _id: { $in: [] } });
      this.setOptions({ upsert: false });
    }
  };
  const replaceGuard = function (this: Query<unknown, unknown>) {
    const tenantId = getTenantId();
    if (tenantId === SYSTEM_TENANT_ID) {
      return;
    }
    const replacement = this.getUpdate() as Record<string, unknown> | null;
    if (!replacement) {
      return;
    }
    if ('tenantId' in replacement && replacement.tenantId !== tenantId) {
      throw new Error('[TenantIsolation] Modifying tenantId via replacement is not allowed');
    }
    if (tenantId && !('tenantId' in replacement)) {
      replacement.tenantId = tenantId;
    }
  };
  schema.pre('find', queryMiddleware);
  schema.pre('findOne', queryMiddleware);
  schema.pre('distinct', queryMiddleware);
  schema.pre('findOneAndUpdate', queryMiddleware);
  schema.pre('findOneAndDelete', queryMiddleware);
  schema.pre('findOneAndReplace', queryMiddleware);
  schema.pre('updateOne', queryMiddleware);
  schema.pre('updateMany', queryMiddleware);
  schema.pre('deleteOne', queryMiddleware);
  schema.pre('deleteMany', queryMiddleware);
  schema.pre('countDocuments', queryMiddleware);
  schema.pre('replaceOne', queryMiddleware);
  schema.pre('findOneAndUpdate', updateGuard);
  schema.pre('updateOne', updateGuard);
  schema.pre('updateMany', updateGuard);
  schema.pre('replaceOne', replaceGuard);
  schema.pre('findOneAndReplace', replaceGuard);
  schema.pre('aggregate', function (this: Aggregate<unknown[]>) {
    const tenantId = getTenantId();
    if (!tenantId && isStrict()) {
      throw new Error(
        '[TenantIsolation] Aggregate attempted without tenant context in strict mode',
      );
    }
    if (!tenantId || tenantId === SYSTEM_TENANT_ID) {
      return;
    }
    this.pipeline().unshift({ $match: { tenantId } });
  });
  schema.pre('save', function (this: HydratedDocument<{ tenantId?: string }>) {
    const tenantId = getTenantId();
    if (!tenantId && isStrict()) {
      throw new Error('[TenantIsolation] Save attempted without tenant context in strict mode');
    }
    if (tenantId && tenantId !== SYSTEM_TENANT_ID) {
      if (!this.tenantId) {
        this.tenantId = tenantId;
      } else if (isStrict() && this.tenantId !== tenantId) {
        throw new Error(
          '[TenantIsolation] Document tenantId does not match current tenant context',
        );
      }
    }
  });
  schema.pre(
    'insertMany',
    function (
      this: Model<unknown>,
      next: (err?: Error) => void,
      docs: Array<{ tenantId?: string }>,
    ) {
      const tenantId = getTenantId();
      if (!tenantId && isStrict()) {
        return next(
          new Error('[TenantIsolation] insertMany attempted without tenant context in strict mode'),
        );
      }
      if (tenantId && tenantId !== SYSTEM_TENANT_ID && Array.isArray(docs)) {
        for (const doc of docs) {
          if (!doc.tenantId) {
            doc.tenantId = tenantId;
          } else if (isStrict() && doc.tenantId !== tenantId) {
            return next(
              new Error(
                '[TenantIsolation] Document tenantId does not match current tenant context',
              ),
            );
          }
        }
      }
      next();
    },
  );
}

// runtime/db/src/schema/memoryImage.ts
import { Schema as Schema2 } from 'mongoose';
var memoryImageSchema = new Schema2({
  userId: {
    type: Schema2.Types.ObjectId,
    ref: 'User',
    index: true,
    required: true,
  },
  /** Memory store this image belongs to; images are isolated per store. */
  storeId: {
    type: String,
    default: void 0,
    index: true,
  },
  /** Memory domain this image belongs to; recall is scoped to the active set. */
  domainId: {
    type: String,
    default: void 0,
    index: true,
  },
  /** Short per-user id for the image path, from the per-user counter. */
  id: {
    type: Number,
  },
  sha256: {
    type: String,
    required: true,
  },
  dhash: {
    type: String,
    required: true,
  },
  mime: {
    type: String,
    required: true,
  },
  width: {
    type: Number,
    default: 0,
  },
  height: {
    type: Number,
    default: 0,
  },
  bytes: {
    type: Number,
    default: 0,
  },
  data: {
    type: Buffer,
    required: true,
  },
  source: {
    type: String,
    enum: ['attachment', 'tool'],
    required: true,
  },
  origin: {
    conversationId: { type: String },
    messageId: { type: String },
    fileId: { type: String },
    toolName: { type: String },
  },
  /** Whether the recall embedding was written; retried on a later ingest when
   *  a previous attempt could not reach the embedding service. */
  embedded: {
    type: Boolean,
    default: false,
  },
  /** When the image was last recalled into a turn; absent = never recalled. */
  lastRecalledAt: {
    type: Date,
    default: void 0,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  tenantId: {
    type: String,
    index: true,
  },
});
memoryImageSchema.index({ userId: 1, storeId: 1, sha256: 1 }, { unique: true });
memoryImageSchema.index({ userId: 1, id: 1 }, { unique: true, sparse: true });
memoryImageSchema.index({ userId: 1, dhash: 1 });
var memoryImage_default = memoryImageSchema;

// runtime/db/src/model/memoryImage.ts
function createMemoryImageModel(mongoose: MemoryMongoose): Model<MemoryImageRow> {
  applyTenantIsolation(memoryImage_default);
  return (
    optionalModelOf<MemoryImageRow>(mongoose, 'MemoryImage') ??
    (mongoose.model('MemoryImage', memoryImage_default) as Model<MemoryImageRow>)
  );
}

// runtime/db/src/method/memoryImage.ts
var partitionFilter2 = (storeId: string | null | undefined): StorePartition => ({
  storeId: storeId ?? null,
});
var META_PROJECTION = '-data -__v';
function createMemoryImageMethods(mongoose: MemoryMongoose): MemoryImageMethods {
  const MemoryImage =
    optionalModelOf<MemoryImageRow>(mongoose, 'MemoryImage') ?? createMemoryImageModel(mongoose);
  const MemoryImageCounter =
    optionalModelOf<MemoryImageCounterRow>(mongoose, 'MemoryImageCounter') ??
    (mongoose.model(
      'MemoryImageCounter',
      memoryImageCounter_default,
    ) as Model<MemoryImageCounterRow>);
  async function nextMemoryImageId(userId: MemoryId): Promise<number> {
    const counter = await MemoryImageCounter.findOneAndUpdate(
      { userId },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    return Number(counter?.seq ?? 1);
  }
  async function upsertMemoryImage({
    userId,
    storeId,
    domainId,
    sha256,
    dhash,
    mime,
    width,
    height,
    bytes,
    data,
    source,
    origin,
    tenantId,
  }: UpsertMemoryImageParams): Promise<UpsertMemoryImageResult> {
    try {
      const existing = await MemoryImage.findOne({ userId, ...partitionFilter2(storeId), sha256 })
        .select(META_PROJECTION)
        .lean();
      if (existing) {
        const id2 = existing.id ?? (await nextMemoryImageId(userId));
        await MemoryImage.updateOne(
          { userId, ...partitionFilter2(storeId), sha256 },
          {
            $set: {
              updatedAt: /* @__PURE__ */ new Date(),
              id: id2,
              ...(domainId != null ? { domainId: String(domainId) } : {}),
            },
          },
        );
        return { ok: true, deduped: 'sha256', image: { ...existing, id: id2 } };
      }
      const id = await nextMemoryImageId(userId);
      await MemoryImage.create({
        userId,
        storeId,
        ...(domainId != null ? { domainId: String(domainId) } : {}),
        id,
        sha256,
        dhash,
        mime,
        width,
        height,
        bytes,
        data,
        source,
        origin,
        tenantId,
        updatedAt: /* @__PURE__ */ new Date(),
      });
      return {
        ok: true,
        image: {
          userId: new Types4.ObjectId(String(userId)),
          storeId,
          id,
          sha256,
          dhash,
          mime,
          width,
          height,
          bytes,
          source,
          origin,
          updatedAt: /* @__PURE__ */ new Date(),
        },
      };
    } catch (error) {
      if (typeof error === 'object' && error != null && 'code' in error && error.code === 11e3) {
        return { ok: true, deduped: 'sha256' };
      }
      logger6.error('[memoryImage] Failed to upsert image', error);
      return { ok: false, reason: 'Failed to store image' };
    }
  }
  async function getMemoryImages({
    userId,
    storeId,
    limit,
  }: GetMemoryImagesParams): Promise<MemoryImageRow[]> {
    return await MemoryImage.find({ userId, ...partitionFilter2(storeId) })
      .select(META_PROJECTION)
      .sort({ updatedAt: -1 })
      .limit(Number(limit) > 0 ? Number(limit) : 0)
      .lean();
  }
  async function getMemoryImage({
    userId,
    storeId,
    sha256,
    id,
  }: GetMemoryImageParams): Promise<MemoryImageRow | null> {
    if (sha256 == null && id == null) {
      return null;
    }
    return await MemoryImage.findOne({
      userId,
      ...(storeId != null ? { storeId } : {}),
      ...(sha256 != null ? { sha256 } : { id }),
    }).lean();
  }
  async function deleteMemoryImage({
    userId,
    storeId,
    sha256,
  }: MemoryImageShaParams): Promise<number> {
    const result = await MemoryImage.deleteOne({ userId, ...partitionFilter2(storeId), sha256 });
    return result.deletedCount ?? 0;
  }
  async function deleteAllUserMemoryImages(userId: MemoryId): Promise<number> {
    const result = await MemoryImage.deleteMany({ userId });
    emitMemoryChange({ type: 'delete', userId: String(userId), sweep: true, image: true });
    return result.deletedCount ?? 0;
  }
  async function markMemoryImagesRecalled({
    userId,
    storeId,
    hashes,
  }: MarkMemoryImagesRecalledParams): Promise<number> {
    if (!Array.isArray(hashes) || hashes.length === 0) {
      return 0;
    }
    const result = await MemoryImage.updateMany(
      { userId, ...partitionFilter2(storeId), sha256: { $in: hashes } },
      { $set: { lastRecalledAt: /* @__PURE__ */ new Date() } },
    );
    return result.modifiedCount ?? 0;
  }
  async function markMemoryImageEmbedded({
    userId,
    storeId,
    sha256,
  }: MemoryImageShaParams): Promise<number> {
    const result = await MemoryImage.updateOne(
      { userId, ...partitionFilter2(storeId), sha256 },
      { $set: { embedded: true } },
    );
    return result.modifiedCount ?? 0;
  }
  async function touchMemoryImage({
    userId,
    storeId,
    sha256,
  }: MemoryImageShaParams): Promise<number> {
    const result = await MemoryImage.updateOne(
      { userId, ...partitionFilter2(storeId), sha256 },
      { $set: { updatedAt: /* @__PURE__ */ new Date() } },
    );
    return result.modifiedCount ?? 0;
  }
  return {
    upsertMemoryImage,
    getMemoryImages,
    getMemoryImage,
    nextMemoryImageId,
    deleteMemoryImage,
    deleteAllUserMemoryImages,
    markMemoryImagesRecalled,
    markMemoryImageEmbedded,
    touchMemoryImage,
  };
}

// runtime/db/src/method/memorySections.ts
function memoryPartId(key: string, section?: string | null): string {
  return `${key}\0${section ?? ''}`;
}
var HEADING_LINE_PATTERN = /^ {0,3}##(?!#)[ \t]+(.*?)[ \t]*#*[ \t]*$/;
var FENCE_LINE_PATTERN = /^ {0,3}(`{3,}|~{3,})/;
function findHeadings(lines: string[]): MemoryHeading[] {
  const headings: MemoryHeading[] = [];
  let openFence: { char: string; length: number } | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const fenceMatch = FENCE_LINE_PATTERN.exec(lines[index]);
    if (fenceMatch != null) {
      const marker = fenceMatch[1];
      if (openFence == null) {
        openFence = { char: marker[0], length: marker.length };
      } else if (marker[0] === openFence.char && marker.length >= openFence.length) {
        openFence = null;
      }
      continue;
    }
    if (openFence != null) {
      continue;
    }
    const headingMatch = HEADING_LINE_PATTERN.exec(lines[index]);
    if (headingMatch != null) {
      headings.push({ index, heading: headingMatch[1].trim() });
    }
  }
  return headings;
}
function scanDocument(value: string): MemoryDocumentScan | null {
  if (typeof value !== 'string') {
    return null;
  }
  const content = memoryBodyOf({ value }).trimEnd();
  if (!content.trim()) {
    return null;
  }
  const lines = content.split('\n');
  const headings = findHeadings(lines);
  if (headings.length < 2) {
    return null;
  }
  return { lines, headings, lead: lines.slice(0, headings[0].index).join('\n').trim() };
}
function splitMemorySections(value: string): MemorySectionSplit | null {
  const document = scanDocument(value);
  if (document == null) {
    return null;
  }
  const { lines, headings, lead } = document;
  const sections: MemorySection[] = [];
  for (let position = 0; position < headings.length; position += 1) {
    const start = position === 0 ? 0 : headings[position].index;
    const end = position + 1 < headings.length ? headings[position + 1].index : lines.length;
    const text = lines.slice(start, end).join('\n').trim();
    if (!text) {
      continue;
    }
    sections.push({ id: String(sections.length), heading: headings[position].heading, text });
  }
  return sections.length > 0 ? { lead, sections } : null;
}
var SECTION_OMISSION = '\u2026\u2026';
function frameMemorySection(
  value: string,
  section: string | null | undefined,
  documentValue: string,
): string {
  if (typeof value !== 'string' || !section) {
    return value;
  }
  const document = splitMemorySections(documentValue);
  if (document == null) {
    return value;
  }
  const index = Number(section);
  if (!Number.isInteger(index) || index < 0) {
    return value;
  }
  const isFirst = index === 0;
  const isLast = index >= document.sections.length - 1;
  const body =
    !isFirst && document.lead && value.startsWith(document.lead)
      ? value.slice(document.lead.length).trim()
      : value;
  const parts: string[] = [];
  if (!isFirst) {
    if (document.lead) {
      parts.push(document.lead);
    }
    parts.push(SECTION_OMISSION);
  }
  parts.push(body);
  if (!isLast) {
    parts.push(SECTION_OMISSION);
  }
  return parts.join('\n\n');
}

// runtime/db/src/methods.ts
function createMemoryMethodSet(
  mongoose: MemoryMongoose,
  deps: MemoryStoreDeps,
  appMongoose: MemoryMongoose = mongoose,
): MemoryMethodSet {
  return {
    ...createMemoryMethods(mongoose, appMongoose),
    ...createMemoryStoreMethods(mongoose, deps),
    ...createMemoryDomainMethods(mongoose),
    ...createMemoryImageMethods(mongoose),
    ...createMemoryVersionMethods(mongoose),
  };
}
export {
  MAX_TAGS_PER_MEMORY,
  MAX_TAG_CHARS,
  SECTION_OMISSION,
  TAG_PREFIX,
  TAG_SEPARATOR,
  appendMemoryValue,
  createMemoryMethodSet,
  emitMemoryChange,
  formatMemoryTime,
  formatTagLine,
  frameMemorySection,
  memoryBodyOf,
  memoryContentOf,
  memoryPartId,
  memoryTagField,
  memoryTagsOf,
  memoryTimeField,
  memoryVectorText,
  mergeTags,
  normalizeMemoryValue,
  normalizeTag,
  onMemoryChange,
  parseMemoryLinkKeys,
  parseTagPayload,
  parseTrailingTags,
  splitMemorySections,
};
