import type { Types } from 'mongoose';
import type { MemoryDomainScope } from '../domain/domain.mjs';

/** An identifier the RPC layer may hand over as a string or an ObjectId. */
export type MemoryUserId = string | Types.ObjectId;

/** One `memoryentries` document as a lean query returns it. */
export interface MemoryEntryRow {
  _id: Types.ObjectId;
  userId?: Types.ObjectId | string;
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
}

/** One `memorystores` document as a lean query returns it. */
export interface MemoryStoreRow {
  _id: Types.ObjectId;
  userId?: Types.ObjectId | string;
  name: string;
  isDefault?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

/** One `memorydomains` document as a lean query returns it. */
export interface MemoryDomainRow {
  _id: Types.ObjectId;
  userId?: Types.ObjectId | string;
  storeId?: string;
  name: string;
  kind: string;
  description?: string | null;
  isDefault?: boolean;
  createdBy?: string;
  memoryCount?: number;
  totalTokens?: number;
  created_at?: Date;
  updated_at?: Date;
}

/** One `memoryversions` document as a lean query returns it. */
export interface MemoryVersionRow {
  _id: Types.ObjectId;
  userId?: Types.ObjectId | string;
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
}

/** One `memoryimages` document as a lean query returns it. */
export interface MemoryImageRow {
  _id: Types.ObjectId;
  userId?: Types.ObjectId | string;
  storeId?: string | null;
  domainId?: string | null;
  id?: number;
  sha256: string;
  dhash?: string;
  mime?: string;
  width?: number;
  height?: number;
  bytes?: number;
  data?: Buffer;
  source?: string;
  origin?: ImageOrigin;
  embedded?: boolean;
  lastRecalledAt?: Date;
  updatedAt?: Date;
}

/** The optional provenance an image row carries. */
export interface ImageOrigin {
  conversationId?: string;
  messageId?: string;
  fileId?: string;
  toolName?: string;
}

/** One `conversationmemories` link as a lean query returns it. */
export interface ConversationMemoryRow {
  _id?: Types.ObjectId;
  userId?: Types.ObjectId | string;
  conversationId?: string;
  storeId?: string | null;
  domainId?: string | null;
  key: string;
  source?: string;
  recallCount?: number;
  createdByConversation?: boolean;
  updated_at?: Date;
}

/** One row of a per-store `n`/`tokens` aggregate. */
export interface StoreStatsRow {
  _id?: string | null;
  n?: number;
  tokens?: number;
}

/** One group-by count returned by the entry aggregate. */
export interface CountRow {
  _id?: string | null;
  n?: number;
}

/** One tag-vocabulary aggregate row. */
export interface TagCountRow {
  _id: string;
  count: number;
}

/** The readable/writable store access shape shared by the backend modules. */
export interface MemoryStoreAccess {
  store: MemoryStoreRow;
  ownerId: string;
  isOwner: boolean;
}

/** A store lookup that only exposes the fields other modules need. */
export interface MemoryStoreAccessResult {
  storeId: string;
  ownerId: string;
  canWrite: boolean;
}

/** The role document permission map the app stores under `permissions.MEMORIES`. */
export interface MemoryPermissionBits {
  USE?: boolean;
  CREATE?: boolean;
  UPDATE?: boolean;
  READ?: boolean;
  OPT_OUT?: boolean;
  SHARE?: boolean;
  SHARE_PUBLIC?: boolean;
}

/** One app role row, projected to its memory permission bits. */
export interface AppRoleRow {
  name?: string;
  permissions?: { MEMORIES?: MemoryPermissionBits | null } | null;
  MEMORIES?: MemoryPermissionBits | null;
}

/** The user projection `memory preferences` reads. */
export interface AppUserRow {
  _id?: Types.ObjectId;
  personalization?: { memories?: boolean | null } | null;
}

/** One conversation row as `memory domains` reads it. */
export interface AppConversationRow {
  _id: Types.ObjectId;
  conversationId?: string;
  user?: string;
  activeDomainIds?: unknown[] | null;
}

/** One `aclentries` grant as the store modules read it. */
export interface AclEntryRow {
  resourceId?: Types.ObjectId | string;
  permBits?: number;
}

/** One app user document, projected to its display name. */
export interface UserNameRow {
  _id?: Types.ObjectId;
  name?: string;
}

/** The app's agent document, as far as image filing reads it. */
export interface AgentRow {
  memory_store?: string;
  use_memory?: boolean;
}

/** The failure shape shared by the write-oriented backend operations. */
export interface MemoryFailure {
  ok: false;
  status: number;
  error: string;
}

/** The scope the injection planner accepts. */
export type MemoryInjectionScope = MemoryDomainScope;

/** The prepared prompt fragments returned to the host planner. */
export interface PreparedInjection {
  stableContext?: string;
  dynamicContext?: string;
}

export type { MemoryDomainScope };
