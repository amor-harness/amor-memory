// Memory's own Mongo connection and schemas. The plugin host process is
// separate from the API process, so these models are registered on a dedicated
// connection and never collide with the app's models.
import mongoose from 'mongoose';
import type { Connection, Model, Types } from 'mongoose';

const { Schema } = mongoose;

export interface MemoryEntryDocument {
  userId: Types.ObjectId;
  key: string;
  value: string;
  tags?: string[];
  storeId?: string;
  domainId?: string;
  tokenCount?: number;
  stable?: boolean;
  injection?: 'system' | 'additional';
  locked?: boolean;
  lastRecalledAt?: Date;
  updated_at?: Date;
  tenantId?: string;
}

export interface MemoryStoreDocument {
  userId: Types.ObjectId;
  name: string;
  isDefault?: boolean;
  created_at?: Date;
  updated_at?: Date;
  tenantId?: string;
}

export interface MemoryDomainDocument {
  userId: Types.ObjectId;
  storeId: string;
  name: string;
  kind: string;
  description?: string;
  isDefault?: boolean;
  createdBy?: 'user' | 'agent';
  created_at?: Date;
  updated_at?: Date;
  tenantId?: string;
}

export interface MemoryVersionDocument {
  userId: Types.ObjectId;
  memoryId: string;
  key: string;
  value: string;
  tags?: string[];
  storeId?: string;
  domainId?: string;
  tokenCount?: number;
  stable?: boolean;
  injection?: 'system' | 'additional';
  locked?: boolean;
  createdAt?: Date;
  runId?: string;
  tenantId?: string;
}

export interface MemoryImageDocument {
  userId: Types.ObjectId;
  storeId?: string;
  domainId?: string;
  id?: number;
  sha256: string;
  dhash: string;
  mime: string;
  width?: number;
  height?: number;
  bytes?: number;
  data: Buffer;
  source: 'attachment' | 'tool';
  origin?: {
    conversationId?: string;
    messageId?: string;
    fileId?: string;
    toolName?: string;
  };
  embedded?: boolean;
  lastRecalledAt?: Date;
  updatedAt?: Date;
  tenantId?: string;
}

export interface MemoryImageCounterDocument {
  userId: Types.ObjectId;
  seq: number;
}

export interface ConversationMemoryDocument {
  userId: Types.ObjectId;
  conversationId: string;
  storeId?: string;
  domainId?: string;
  source?: 'extracted' | 'recalled';
  recallCount?: number;
  lastRecallTurnId?: string;
  createdByConversation?: boolean;
  turnMessageId?: string;
  key: string;
  updated_at?: Date;
  tenantId?: string;
}

export interface MemoryExtractionPromptDocument {
  userId: Types.ObjectId;
  instructions: string;
  updated_at?: Date;
  tenantId?: string;
}

export interface MemoryModels {
  MemoryEntry: Model<MemoryEntryDocument>;
  MemoryStore: Model<MemoryStoreDocument>;
  MemoryDomain: Model<MemoryDomainDocument>;
  MemoryVersion: Model<MemoryVersionDocument>;
  MemoryImage: Model<MemoryImageDocument>;
  MemoryImageCounter: Model<MemoryImageCounterDocument>;
  ConversationMemory: Model<ConversationMemoryDocument>;
  MemoryExtractionPrompt: Model<MemoryExtractionPromptDocument>;
}

const tenantId = { type: String, index: true };
const objectId = { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true };

const memoryEntrySchema = new Schema({
  userId: objectId,
  key: { type: String, required: true },
  value: { type: String, required: true },
  tags: { type: [String], default: [] },
  storeId: { type: String, index: true },
  domainId: { type: String, index: true },
  tokenCount: { type: Number, default: 0 },
  stable: { type: Boolean, default: false },
  injection: { type: String, enum: ['system', 'additional'], default: 'system' },
  locked: { type: Boolean, default: false },
  lastRecalledAt: Date,
  updated_at: { type: Date, default: Date.now },
  tenantId,
});
memoryEntrySchema.index({ storeId: 1, key: 1 });
memoryEntrySchema.index({ storeId: 1, domainId: 1 });

const memoryStoreSchema = new Schema({
  userId: objectId,
  name: { type: String, required: true, trim: true },
  isDefault: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  tenantId,
});
memoryStoreSchema.index({ userId: 1, name: 1 });

const memoryDomainSchema = new Schema({
  userId: objectId,
  storeId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  kind: { type: String, required: true },
  description: { type: String, default: '' },
  isDefault: { type: Boolean, default: false },
  createdBy: { type: String, enum: ['user', 'agent'], default: 'user' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  tenantId,
});
memoryDomainSchema.index({ storeId: 1, name: 1 }, { unique: true });

const memoryVersionSchema = new Schema({
  userId: objectId,
  memoryId: { type: String, required: true },
  key: { type: String, required: true },
  value: { type: String, required: true },
  tags: { type: [String], default: [] },
  storeId: { type: String, index: true },
  domainId: String,
  tokenCount: { type: Number, default: 0 },
  stable: { type: Boolean, default: false },
  injection: { type: String, enum: ['system', 'additional'], default: 'system' },
  locked: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  runId: { type: String, index: true },
  tenantId,
});
memoryVersionSchema.index({ memoryId: 1, createdAt: -1 });

const memoryImageSchema = new Schema({
  userId: objectId,
  storeId: { type: String, index: true },
  domainId: { type: String, index: true },
  id: Number,
  sha256: { type: String, required: true },
  dhash: { type: String, required: true },
  mime: { type: String, required: true },
  width: { type: Number, default: 0 },
  height: { type: Number, default: 0 },
  bytes: { type: Number, default: 0 },
  data: { type: Buffer, required: true },
  source: { type: String, enum: ['attachment', 'tool'], required: true },
  origin: {
    conversationId: String,
    messageId: String,
    fileId: String,
    toolName: String,
  },
  embedded: { type: Boolean, default: false },
  lastRecalledAt: Date,
  updatedAt: { type: Date, default: Date.now },
  tenantId,
});
memoryImageSchema.index({ userId: 1, storeId: 1, sha256: 1 }, { unique: true });
memoryImageSchema.index({ userId: 1, id: 1 }, { unique: true, sparse: true });
memoryImageSchema.index({ userId: 1, dhash: 1 });

const memoryImageCounterSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

const memoryExtractionPromptSchema = new Schema({
  userId: { ...objectId, unique: true },
  instructions: { type: String, default: '' },
  updated_at: { type: Date, default: Date.now },
  tenantId,
});

const conversationMemorySchema = new Schema({
  userId: objectId,
  conversationId: { type: String, required: true, index: true },
  storeId: String,
  domainId: String,
  source: { type: String, enum: ['extracted', 'recalled'], default: 'extracted' },
  recallCount: { type: Number, default: 0 },
  lastRecallTurnId: String,
  createdByConversation: Boolean,
  turnMessageId: String,
  key: { type: String, required: true },
  updated_at: { type: Date, default: Date.now },
  tenantId,
});
conversationMemorySchema.index({ userId: 1, conversationId: 1, key: 1 }, { unique: true });

let connection: Connection | null = null;
let connecting: Promise<Connection> | null = null;
let sharedConnection: Connection | null = null;
let appConnection: Connection | null = null;

/** Reuse a connection owned by the database plugin. */
export function configureDatabase(db: Connection | null, appDb: Connection | null = null): void {
  sharedConnection = db ?? null;
  appConnection = appDb ?? null;
}

function registerModels(conn: Connection): void {
  conn.model<MemoryEntryDocument>('MemoryEntry', memoryEntrySchema);
  conn.model<MemoryStoreDocument>('MemoryStore', memoryStoreSchema);
  conn.model<MemoryDomainDocument>('MemoryDomain', memoryDomainSchema);
  conn.model<MemoryVersionDocument>('MemoryVersion', memoryVersionSchema);
  conn.model<MemoryImageDocument>('MemoryImage', memoryImageSchema);
  conn.model<MemoryImageCounterDocument>('MemoryImageCounter', memoryImageCounterSchema);
  conn.model<ConversationMemoryDocument>('ConversationMemory', conversationMemorySchema);
  conn.model<MemoryExtractionPromptDocument>(
    'MemoryExtractionPrompt',
    memoryExtractionPromptSchema,
  );
}

/** The plugin's own connection. Lazy so importing the backend never opens one. */
export async function connectDb(): Promise<Connection> {
  if (sharedConnection != null) {
    if (connection !== sharedConnection) {
      registerModels(sharedConnection);
      connection = sharedConnection;
    }
    return sharedConnection;
  }
  if (connection != null) {
    return connection;
  }
  if (connecting == null) {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      throw new Error('MONGO_URI is not set in the plugin host');
    }
    connecting = mongoose
      .createConnection(uri)
      .asPromise()
      .then((conn: Connection) => {
        registerModels(conn);
        connection = conn;
        return conn;
      })
      .catch((error: unknown) => {
        connecting = null;
        throw error;
      });
  }
  return connecting;
}

export async function connectAppDb(): Promise<Connection> {
  if (appConnection != null) {
    return appConnection;
  }
  return connectDb();
}

export async function models(): Promise<MemoryModels> {
  const conn = await connectDb();
  if (!conn.models.MemoryEntry) {
    registerModels(conn);
  }
  return {
    MemoryEntry: conn.model<MemoryEntryDocument>('MemoryEntry'),
    MemoryStore: conn.model<MemoryStoreDocument>('MemoryStore'),
    MemoryDomain: conn.model<MemoryDomainDocument>('MemoryDomain'),
    MemoryVersion: conn.model<MemoryVersionDocument>('MemoryVersion'),
    MemoryImage: conn.model<MemoryImageDocument>('MemoryImage'),
    MemoryImageCounter: conn.model<MemoryImageCounterDocument>('MemoryImageCounter'),
    ConversationMemory: conn.model<ConversationMemoryDocument>('ConversationMemory'),
    MemoryExtractionPrompt: conn.model<MemoryExtractionPromptDocument>('MemoryExtractionPrompt'),
  };
}
