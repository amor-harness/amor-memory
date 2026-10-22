// runtime/db/src/model/tenantIsolation.ts
import { getTenantId, SYSTEM_TENANT_ID } from "@librechat/data-schemas";
import { logger } from "@librechat/data-schemas";
var _strictMode;
function isStrict() {
  return _strictMode ??= process.env.TENANT_ISOLATION_STRICT === "true";
}
if (process.env.TENANT_ISOLATION_STRICT && process.env.TENANT_ISOLATION_STRICT !== "true" && process.env.TENANT_ISOLATION_STRICT !== "false") {
  logger.warn(
    `[TenantIsolation] TENANT_ISOLATION_STRICT="${process.env.TENANT_ISOLATION_STRICT}" is not "true" or "false"; defaulting to non-strict mode.`
  );
}
var TENANT_ISOLATION_APPLIED = /* @__PURE__ */ Symbol.for("librechat:tenantIsolation");
var VALUE_OPERATORS = ["$set", "$setOnInsert"];
var STRIP_OPERATORS = ["$unset", "$rename"];
function sanitizeTenantIdMutation(update) {
  if (!update) {
    return;
  }
  const currentTenantId = getTenantId();
  for (const op of VALUE_OPERATORS) {
    const payload = update[op];
    if (payload && "tenantId" in payload) {
      if (currentTenantId && payload.tenantId !== currentTenantId) {
        throw new Error("[TenantIsolation] Cross-tenant tenantId mutation is not allowed");
      }
      delete payload.tenantId;
      if (Object.keys(payload).length === 0) {
        delete update[op];
      }
    }
  }
  for (const op of STRIP_OPERATORS) {
    const payload = update[op];
    if (payload && "tenantId" in payload) {
      delete payload.tenantId;
      if (Object.keys(payload).length === 0) {
        delete update[op];
      }
    }
  }
  if ("tenantId" in update) {
    if (currentTenantId && update.tenantId !== currentTenantId) {
      throw new Error("[TenantIsolation] Cross-tenant tenantId mutation is not allowed");
    }
    delete update.tenantId;
  }
}
function applyTenantIsolation(schema) {
  const s = schema;
  if (s[TENANT_ISOLATION_APPLIED]) {
    return;
  }
  s[TENANT_ISOLATION_APPLIED] = true;
  const queryMiddleware = function() {
    const tenantId = getTenantId();
    if (!tenantId && isStrict()) {
      throw new Error("[TenantIsolation] Query attempted without tenant context in strict mode");
    }
    if (!tenantId || tenantId === SYSTEM_TENANT_ID) {
      return;
    }
    this.where({ tenantId });
  };
  const updateGuard = function() {
    const tenantId = getTenantId();
    if (tenantId === SYSTEM_TENANT_ID) {
      return;
    }
    sanitizeTenantIdMutation(this.getUpdate());
    const update = this.getUpdate();
    if (update && Object.keys(update).length === 0) {
      this.where({ _id: { $in: [] } });
      this.setOptions({ upsert: false });
    }
  };
  const replaceGuard = function() {
    const tenantId = getTenantId();
    if (tenantId === SYSTEM_TENANT_ID) {
      return;
    }
    const replacement = this.getUpdate();
    if (!replacement) {
      return;
    }
    if ("tenantId" in replacement && replacement.tenantId !== tenantId) {
      throw new Error("[TenantIsolation] Modifying tenantId via replacement is not allowed");
    }
    if (tenantId && !("tenantId" in replacement)) {
      replacement.tenantId = tenantId;
    }
  };
  schema.pre("find", queryMiddleware);
  schema.pre("findOne", queryMiddleware);
  schema.pre("distinct", queryMiddleware);
  schema.pre("findOneAndUpdate", queryMiddleware);
  schema.pre("findOneAndDelete", queryMiddleware);
  schema.pre("findOneAndReplace", queryMiddleware);
  schema.pre("updateOne", queryMiddleware);
  schema.pre("updateMany", queryMiddleware);
  schema.pre("deleteOne", queryMiddleware);
  schema.pre("deleteMany", queryMiddleware);
  schema.pre("countDocuments", queryMiddleware);
  schema.pre("replaceOne", queryMiddleware);
  schema.pre("findOneAndUpdate", updateGuard);
  schema.pre("updateOne", updateGuard);
  schema.pre("updateMany", updateGuard);
  schema.pre("replaceOne", replaceGuard);
  schema.pre("findOneAndReplace", replaceGuard);
  schema.pre("aggregate", function() {
    const tenantId = getTenantId();
    if (!tenantId && isStrict()) {
      throw new Error(
        "[TenantIsolation] Aggregate attempted without tenant context in strict mode"
      );
    }
    if (!tenantId || tenantId === SYSTEM_TENANT_ID) {
      return;
    }
    this.pipeline().unshift({ $match: { tenantId } });
  });
  schema.pre("save", function() {
    const tenantId = getTenantId();
    if (!tenantId && isStrict()) {
      throw new Error("[TenantIsolation] Save attempted without tenant context in strict mode");
    }
    if (tenantId && tenantId !== SYSTEM_TENANT_ID) {
      if (!this.tenantId) {
        this.tenantId = tenantId;
      } else if (isStrict() && this.tenantId !== tenantId) {
        throw new Error(
          "[TenantIsolation] Document tenantId does not match current tenant context"
        );
      }
    }
  });
  schema.pre("insertMany", function(next, docs) {
    const tenantId = getTenantId();
    if (!tenantId && isStrict()) {
      return next(
        new Error("[TenantIsolation] insertMany attempted without tenant context in strict mode")
      );
    }
    if (tenantId && tenantId !== SYSTEM_TENANT_ID && Array.isArray(docs)) {
      for (const doc of docs) {
        if (!doc.tenantId) {
          doc.tenantId = tenantId;
        } else if (isStrict() && doc.tenantId !== tenantId) {
          return next(
            new Error("[TenantIsolation] Document tenantId does not match current tenant context")
          );
        }
      }
    }
    next();
  });
}

// runtime/db/src/schema/memory.ts
import { Schema } from "mongoose";
var MemoryEntrySchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    index: true,
    required: true
  },
  key: {
    type: String,
    required: true,
    validate: {
      validator: (v) => /^[a-z0-9_]+$/.test(v),
      message: "Key must only contain lowercase letters, numbers, and underscores"
    }
  },
  value: {
    type: String,
    required: true
  },
  /** Cue anchors parsed from the value's trailing `tags:` lines, materialized
   *  at write time so recall can match them without re-parsing every row. The
   *  value keeps the declaration — it is what the panel and the `/memory`
   *  files show — so this is a derived index, never the source of truth. */
  tags: {
    type: [String],
    default: []
  },
  /** Memory store this entry belongs to. Stores are the isolation unit: a run
   *  only ever reads the store its agent selected. */
  storeId: {
    type: String,
    default: void 0,
    index: true
  },
  /** Memory domain this entry belongs to: the context it is true in. A run
   *  only reads and writes the domains it has active, so a game world's
   *  memories never surface as facts about real life. */
  domainId: {
    type: String,
    default: void 0,
    index: true
  },
  tokenCount: {
    type: Number,
    default: 0
  },
  /** Stable memories ride the cacheable stable system baseline; new memories
   *  default to ephemeral (single-turn RAG recall). */
  stable: {
    type: Boolean,
    default: false
  },
  /** Where a stable memory is injected every turn: the cacheable system prompt
   *  (`system`, the default) or the per-turn `additional_instructions` tail,
   *  which a frequently edited memory can use so it never rewrites the cached
   *  prefix. Ephemeral memories ignore it. */
  injection: {
    type: String,
    enum: ["system", "additional"],
    default: "system"
  },
  /** Locked memories are invisible to the memory extractor and refuse every
   *  LLM write path (set/append/delete). Only the Memories panel and the
   *  `/memory` VFS mount may change them, so a user-authored memory survives
   *  automatic extraction and capacity eviction untouched. */
  locked: {
    type: Boolean,
    default: false
  },
  /** When an ephemeral memory was last recalled into a turn's context; absent
   *  means it has never been recalled. Drives capacity eviction: when storage
   *  is full, the least-recently-recalled (never-recalled first) ephemeral
   *  memories are dropped to make room for new ones. */
  lastRecalledAt: {
    type: Date,
    default: void 0
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  tenantId: {
    type: String,
    index: true
  }
});
MemoryEntrySchema.index({ storeId: 1, key: 1 });
MemoryEntrySchema.index({ storeId: 1, domainId: 1 });
var memory_default = MemoryEntrySchema;

// runtime/db/src/model/memory.ts
function createMemoryModel(mongoose) {
  applyTenantIsolation(memory_default);
  return mongoose.models.MemoryEntry || mongoose.model("MemoryEntry", memory_default);
}

// runtime/db/src/schema/memoryStore.ts
import { Schema as Schema2 } from "mongoose";
var MemoryStoreSchema = new Schema2({
  userId: {
    type: Schema2.Types.ObjectId,
    ref: "User",
    index: true,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  /** The store pre-existing memories were migrated into; never deletable. */
  isDefault: {
    type: Boolean,
    default: false
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  tenantId: {
    type: String,
    index: true
  }
});
MemoryStoreSchema.index({ userId: 1, name: 1 });
var memoryStore_default = MemoryStoreSchema;

// runtime/db/src/model/memoryStore.ts
function createMemoryStoreModel(mongoose) {
  applyTenantIsolation(memoryStore_default);
  return mongoose.models.MemoryStore || mongoose.model("MemoryStore", memoryStore_default);
}

// runtime/db/src/schema/memoryDomain.ts
import { Schema as Schema3 } from "mongoose";
import { MEMORY_DOMAIN_KINDS } from "librechat-data-provider";
var MemoryDomainSchema = new Schema3({
  userId: {
    type: Schema3.Types.ObjectId,
    ref: "User",
    index: true,
    required: true
  },
  storeId: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  /** Fixed vocabulary: how the injected memory text is framed for the model. */
  kind: {
    type: String,
    enum: MEMORY_DOMAIN_KINDS,
    required: true
  },
  description: {
    type: String,
    default: ""
  },
  /** The domain pre-existing memories were migrated into; never deletable. */
  isDefault: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: String,
    enum: ["user", "agent"],
    default: "user"
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  tenantId: {
    type: String,
    index: true
  }
});
MemoryDomainSchema.index({ storeId: 1, name: 1 }, { unique: true });
var memoryDomain_default = MemoryDomainSchema;

// runtime/db/src/model/memoryDomain.ts
function createMemoryDomainModel(mongoose) {
  applyTenantIsolation(memoryDomain_default);
  return mongoose.models.MemoryDomain || mongoose.model("MemoryDomain", memoryDomain_default);
}

// runtime/db/src/schema/memoryImage.ts
import { Schema as Schema4 } from "mongoose";
var memoryImageSchema = new Schema4({
  userId: {
    type: Schema4.Types.ObjectId,
    ref: "User",
    index: true,
    required: true
  },
  /** Memory store this image belongs to; images are isolated per store. */
  storeId: {
    type: String,
    default: void 0,
    index: true
  },
  /** Memory domain this image belongs to; recall is scoped to the active set. */
  domainId: {
    type: String,
    default: void 0,
    index: true
  },
  /** Short per-user id for the image path, from the per-user counter. */
  id: {
    type: Number
  },
  sha256: {
    type: String,
    required: true
  },
  dhash: {
    type: String,
    required: true
  },
  mime: {
    type: String,
    required: true
  },
  width: {
    type: Number,
    default: 0
  },
  height: {
    type: Number,
    default: 0
  },
  bytes: {
    type: Number,
    default: 0
  },
  data: {
    type: Buffer,
    required: true
  },
  source: {
    type: String,
    enum: ["attachment", "tool"],
    required: true
  },
  origin: {
    conversationId: { type: String },
    messageId: { type: String },
    fileId: { type: String },
    toolName: { type: String }
  },
  /** Whether the recall embedding was written; retried on a later ingest when
   *  a previous attempt could not reach the embedding service. */
  embedded: {
    type: Boolean,
    default: false
  },
  /** When the image was last recalled into a turn; absent = never recalled. */
  lastRecalledAt: {
    type: Date,
    default: void 0
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  tenantId: {
    type: String,
    index: true
  }
});
memoryImageSchema.index({ userId: 1, storeId: 1, sha256: 1 }, { unique: true });
memoryImageSchema.index({ userId: 1, id: 1 }, { unique: true, sparse: true });
memoryImageSchema.index({ userId: 1, dhash: 1 });
var memoryImage_default = memoryImageSchema;

// runtime/db/src/model/memoryImage.ts
function createMemoryImageModel(mongoose) {
  applyTenantIsolation(memoryImage_default);
  return mongoose.models.MemoryImage || mongoose.model("MemoryImage", memoryImage_default);
}

// runtime/db/src/schema/conversationMemory.ts
import { Schema as Schema5 } from "mongoose";
var ConversationMemorySchema = new Schema5({
  userId: {
    type: Schema5.Types.ObjectId,
    ref: "User",
    index: true,
    required: true
  },
  conversationId: {
    type: String,
    required: true,
    index: true
  },
  /** Memory store the linked entry lives in (mirrors `MemoryEntry.storeId`). */
  storeId: {
    type: String,
    default: void 0
  },
  /** Memory domain the linked entry belongs to (mirrors its `domainId`). */
  domainId: {
    type: String,
    default: void 0
  },
  /** `extracted` = this conversation created the memory; `recalled` = the
   *  conversation only read it. Only extracted links make the memory "its own"
   *  — which is what keeps a conversation from re-injecting what it wrote, and
   *  what stops a recalled memory from being excluded ever after. */
  source: {
    type: String,
    enum: ["extracted", "recalled"],
    default: "extracted"
  },
  /** Turns of THIS conversation that recalled the memory into context. */
  recallCount: {
    type: Number,
    default: 0
  },
  /** The turn that last moved `recallCount`, so the counter moves once per
   *  turn: a regenerated, retried, or resumed run is the same turn. */
  lastRecallTurnId: {
    type: String,
    default: void 0
  },
  /** True when this conversation CREATED the memory, false when it only
   *  updated one that already existed. Absent on recall links and old rows. */
  createdByConversation: {
    type: Boolean,
    default: void 0
  },
  /** The turn whose extraction last wrote this link, named by that turn's
   *  assistant reply message. Compaction releases the links whose turn sits
   *  before the message the summary retained from; absent on rows written
   *  before this field existed and on `/memory` mount writes. */
  turnMessageId: {
    type: String,
    default: void 0
  },
  key: {
    type: String,
    required: true
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  tenantId: {
    type: String,
    index: true
  }
});
ConversationMemorySchema.index({ userId: 1, conversationId: 1, key: 1 }, { unique: true });
var conversationMemory_default = ConversationMemorySchema;

// runtime/db/src/model/conversationMemory.ts
function createConversationMemoryModel(mongoose) {
  applyTenantIsolation(conversationMemory_default);
  return mongoose.models.ConversationMemory || mongoose.model("ConversationMemory", conversationMemory_default);
}

// runtime/db/src/schema/memoryVersion.ts
import { Schema as Schema6 } from "mongoose";
var MemoryVersionSchema = new Schema6({
  userId: {
    type: Schema6.Types.ObjectId,
    ref: "User",
    index: true,
    required: true
  },
  /** The entry's `_id` as a hex string: the chain's identity. It survives a
   *  rename (the chain moves to the new entry), so a renamed memory keeps the
   *  history it earned under its old key. */
  memoryId: {
    type: String,
    required: true
  },
  /** The key this state was written under — a rename's older states keep the
   *  key they actually had. */
  key: {
    type: String,
    required: true
  },
  value: {
    type: String,
    required: true
  },
  /** Cue anchors derived from the value's trailing `tags:` lines. */
  tags: {
    type: [String],
    default: []
  },
  /** Mirrors the entry's store/domain so purging a store or a user can drop
   *  its history without reading every memory entry first. */
  storeId: {
    type: String,
    default: void 0,
    index: true
  },
  domainId: {
    type: String,
    default: void 0
  },
  tokenCount: {
    type: Number,
    default: 0
  },
  stable: {
    type: Boolean,
    default: false
  },
  /** Where the state's stable memory was injected; restores it with the rest
   *  of the state. */
  injection: {
    type: String,
    enum: ["system", "additional"],
    default: "system"
  },
  locked: {
    type: Boolean,
    default: false
  },
  /** When this state was written — the version's creation time. */
  createdAt: {
    type: Date,
    default: Date.now
  },
  tenantId: {
    type: String,
    index: true
  }
});
MemoryVersionSchema.index({ memoryId: 1, createdAt: -1 });
var memoryVersion_default = MemoryVersionSchema;

// runtime/db/src/model/memoryVersion.ts
function createMemoryVersionModel(mongoose) {
  applyTenantIsolation(memoryVersion_default);
  return mongoose.models.MemoryVersion || mongoose.model("MemoryVersion", memoryVersion_default);
}

// runtime/db/src/index.ts
function createMemoryModels(mongoose) {
  return {
    MemoryEntry: createMemoryModel(mongoose),
    MemoryStore: createMemoryStoreModel(mongoose),
    MemoryDomain: createMemoryDomainModel(mongoose),
    MemoryImage: createMemoryImageModel(mongoose),
    ConversationMemory: createConversationMemoryModel(mongoose),
    MemoryVersion: createMemoryVersionModel(mongoose)
  };
}
export {
  createMemoryModels
};
