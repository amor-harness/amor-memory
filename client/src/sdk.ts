import type { ReactNode } from 'react';

export const Permissions = {
  USE: 'USE',
  CREATE: 'CREATE',
  READ: 'READ',
  UPDATE: 'UPDATE',
  OPT_OUT: 'OPT_OUT',
  SHARE: 'SHARE',
  SHARE_PUBLIC: 'SHARE_PUBLIC',
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

export const PermissionTypes = { MEMORIES: 'MEMORIES' } as const;

export type PermissionType = (typeof PermissionTypes)[keyof typeof PermissionTypes];

export const ResourceType = { MEMORYSTORE: 'memoryStore' } as const;

export type ResourceTypeValue = (typeof ResourceType)[keyof typeof ResourceType];

export const QueryKeys = { memoryStores: 'memoryStores' } as const;

export const SystemRoles = { ADMIN: 'ADMIN', USER: 'USER' } as const;

export type SystemRole = (typeof SystemRoles)[keyof typeof SystemRoles];

export const MEMORY_DOMAIN_KINDS = [
  'real',
  'fictional',
  'project',
  'sandbox',
  'study',
  'work',
] as const;

export type MemoryDomainKind = (typeof MEMORY_DOMAIN_KINDS)[number];

/** Which prompt carries a stable memory every turn. */
export type MemoryInjection = 'system' | 'additional';

export type MemoryKind = 'text' | 'image';

export type MemoryDomainCreatedBy = 'user' | 'agent';

export type MemoryAccessLevel = 'owner' | 'editor' | 'viewer';

/** One saved memory as the panel, the editor and the RPC results expose it. */
export interface TUserMemory {
  key: string;
  value: string;
  /** The value without its trailing tag declaration. */
  content?: string;
  /** Cue anchors declared by the value's trailing `tags:` lines. */
  tags?: string[];
  updated_at: string;
  tokenCount?: number;
  /** Memory store this entry belongs to. */
  storeId?: string;
  /** The context the entry is true in. */
  domainId?: string;
  /** The domain's display name, resolved server-side for listings. */
  domainName?: string;
  stable?: boolean;
  injection?: MemoryInjection;
  locked?: boolean;
  lastRecalledAt?: string;
  recallCount?: number;
  kind?: MemoryKind;
  /** Image rows only: the exact-content hash the delete route takes. */
  sha256?: string;
  /** Image rows only: the VFS URL serving the picture. */
  url?: string;
  mime?: string;
  width?: number;
  height?: number;
}

/** An ephemeral memory the server would evict to fit a new memory at capacity. */
export interface MemoryEvictionPreviewItem {
  key: string;
  value: string;
  storeId?: string;
  tokenCount?: number;
  lastRecalledAt?: string;
}

/** One recorded state of a memory. */
export interface TMemoryVersion {
  id: string;
  key: string;
  value: string;
  tags?: string[];
  domainId?: string;
  tokenCount?: number;
  stable?: boolean;
  injection?: MemoryInjection;
  locked?: boolean;
  createdAt: string;
}

/** A memory store: an isolated container of memories with ACL-granted access. */
export interface TMemoryStore {
  id: string;
  name: string;
  isDefault?: boolean;
  isOwner: boolean;
  ownerName?: string;
  canWrite?: boolean;
  accessLevel?: MemoryAccessLevel;
  isShared?: boolean;
  memoryCount: number;
  totalTokens: number;
  updated_at?: string;
}

/** A memory domain: the context memories in it belong to. */
export interface TMemoryDomain {
  id: string;
  name: string;
  kind: MemoryDomainKind;
  description: string;
  isDefault?: boolean;
  createdBy?: MemoryDomainCreatedBy;
  memoryCount?: number;
  updated_at?: string;
}

/** One of a conversation's memory links: what it wrote, or what it recalled. */
export interface TConversationMemory extends TUserMemory {
  created?: boolean;
  extracted: boolean;
  recallCount: number;
}

/** The attachment a memory recall or write carries on a message. */
export interface MemoryArtifact {
  key: string;
  value?: string;
  tags?: string[];
  section?: string;
  content?: string;
  tokenCount?: number;
  type: 'update' | 'delete' | 'error' | 'recall';
  storeId?: string;
  domainId?: string;
  kind?: MemoryKind;
  url?: string;
  mime?: string;
  width?: number;
  height?: number;
  updatedAt?: string;
}

/** The host's per-message attachment, reduced to the memory payload. */
export interface TAttachment {
  memory?: MemoryArtifact;
}

/** An option for the host's combobox and multiselect primitives. */
export interface OptionWithIcon {
  label: string;
  value: string;
  icon?: ReactNode;
}
