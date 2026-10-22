// Memory's own Mongo connection and schemas. The plugin host process is
// separate from the API process, so these models are registered on a dedicated
// connection and never collide with the app's models.
import mongoose from 'mongoose';

const { Schema } = mongoose;

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

let connection = null;
let connecting = null;
let sharedConnection = null;
let appConnection = null;

/** Reuse a connection owned by the database plugin. */
export function configureDatabase(db, appDb = null) {
  sharedConnection = db ?? null;
  appConnection = appDb ?? null;
}

function registerModels(conn) {
  conn.model('MemoryEntry', memoryEntrySchema);
  conn.model('MemoryStore', memoryStoreSchema);
  conn.model('MemoryDomain', memoryDomainSchema);
  conn.model('MemoryVersion', memoryVersionSchema);
  conn.model('MemoryImage', memoryImageSchema);
  conn.model('MemoryImageCounter', memoryImageCounterSchema);
  conn.model('ConversationMemory', conversationMemorySchema);
  conn.model('MemoryExtractionPrompt', memoryExtractionPromptSchema);
}

/** The plugin's own connection. Lazy so importing the backend never opens one. */
export async function connectDb() {
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
      .then((conn) => {
        registerModels(conn);
        connection = conn;
        return conn;
      })
      .catch((error) => {
        connecting = null;
        throw error;
      });
  }
  return connecting;
}

export async function connectAppDb() {
  if (appConnection != null) {
    return appConnection;
  }
  return connectDb();
}

export async function models() {
  const conn = await connectDb();
  return {
    MemoryEntry: conn.model('MemoryEntry'),
    MemoryStore: conn.model('MemoryStore'),
    MemoryDomain: conn.model('MemoryDomain'),
    MemoryVersion: conn.model('MemoryVersion'),
    MemoryImage: conn.model('MemoryImage'),
    MemoryImageCounter: conn.model('MemoryImageCounter'),
    ConversationMemory: conn.model('ConversationMemory'),
    MemoryExtractionPrompt: conn.model('MemoryExtractionPrompt'),
  };
}
