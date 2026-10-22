// runtime/db/src/method/memoryTags.ts
var TAG_PREFIX = "tags:";
var TAG_SEPARATOR = "|";
var TAG_DELIMITER_PATTERN = /[|｜,，、]/;
function splitTagTokens(raw) {
  return typeof raw === "string" ? raw.split(TAG_DELIMITER_PATTERN) : [];
}
var MAX_TAG_CHARS = 32;
var MAX_TAGS_PER_MEMORY = 24;
var TAG_LINE_PATTERN = /^\s*tags:\s*(\S.*)$/i;
var LINK_KEY_TOKEN = "@[\\p{L}\\p{N}_]+";
var LINK_LINE_PATTERN = new RegExp(`^${LINK_KEY_TOKEN}(?:[^\\S\\n]+${LINK_KEY_TOKEN})*$`, "u");
var LINK_SEPARATOR_PATTERN = /[^\S\n]+/;
function parseMemoryLinkKeys(line) {
  if (typeof line !== "string") {
    return [];
  }
  const text = line.trim();
  if (!LINK_LINE_PATTERN.test(text)) {
    return [];
  }
  return text.split(LINK_SEPARATOR_PATTERN).map((token) => token.slice(1));
}
function normalizeTag(raw) {
  if (typeof raw !== "string") {
    return "";
  }
  const normalized = raw.normalize("NFKC").replace(/["\\]/g, "").replace(/^#+/, "").replace(/\s+/g, " ").trim().toLowerCase();
  return normalized.length > MAX_TAG_CHARS ? "" : normalized;
}
function parseTagPayload(payload) {
  return splitTagTokens(payload).map(normalizeTag).filter(Boolean);
}
function isLinkLine(line) {
  return LINK_LINE_PATTERN.test(line);
}
function isMetadataLine(line) {
  return TAG_LINE_PATTERN.test(line) || LINK_LINE_PATTERN.test(line);
}
function mergeTags(...groups) {
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
function splitTrailingMetadata(value) {
  const text = value.trimEnd();
  const lines = text.split("\n");
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
    content: lines.filter((_, lineIndex) => !dropped.has(lineIndex)).join("\n").trimEnd(),
    tags: mergeTags(...declared.reverse()),
    links: links.reverse()
  };
}
function dedupe(lines) {
  return [...new Set(lines)];
}
function parseTrailingTags(value) {
  if (typeof value !== "string" || !value.trim()) {
    return { content: "", tags: [] };
  }
  const metadata = splitTrailingMetadata(value);
  if (metadata.tags.length === 0) {
    return { content: value.trimEnd(), tags: [] };
  }
  const content = [metadata.content, ...dedupe(metadata.links)].filter(Boolean).join("\n");
  return { content: content.trimEnd(), tags: metadata.tags };
}
function formatTagLine(tags) {
  const merged = mergeTags(tags);
  return merged.length === 0 ? "" : `${TAG_PREFIX}${merged.join(TAG_SEPARATOR)}`;
}
function memoryTagsOf(entry) {
  if (!entry) {
    return [];
  }
  const stored = mergeTags(entry.tags);
  return stored.length > 0 ? stored : parseTrailingTags(entry.value).tags;
}
function memoryContentOf(entry) {
  return parseTrailingTags(entry?.value).content;
}
function memoryBodyOf(entry) {
  const value = entry?.value;
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }
  const content = parseTrailingTags(value).content.trimEnd();
  const lines = content.split("\n");
  let index = lines.length - 1;
  while (index >= 0 && isLinkLine(lines[index].trim())) {
    index -= 1;
  }
  return (index === lines.length - 1 ? content : lines.slice(0, index + 1).join("\n")).trimEnd();
}
function withoutLinkLines(text) {
  return text.split("\n").filter((line) => !isLinkLine(line.trim())).join("\n");
}
function memoryVectorText(entry) {
  const body = withoutLinkLines(memoryBodyOf(entry));
  const tags = memoryTagsOf(entry);
  if (tags.length === 0) {
    return body;
  }
  return [body, formatTagLine(tags)].filter(Boolean).join("\n");
}
function memoryTagField(entry) {
  const tags = memoryTagsOf(entry);
  return tags.length === 0 ? "" : ` ["tags": "${tags.join(", ")}"]`;
}
function mergeLinkLines(lines) {
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
      remaining.length === keys.length ? line : remaining.map((key) => `@${key}`).join(" ")
    );
  }
  return merged;
}
function normalizeMemoryValue(value) {
  if (typeof value !== "string" || !value.trim()) {
    return value;
  }
  const metadata = splitTrailingMetadata(value);
  const bodyLines = metadata.content.split("\n");
  const interiorLinks = bodyLines.filter((line) => isLinkLine(line.trim()));
  if (interiorLinks.length === 0) {
    return value;
  }
  const body = bodyLines.filter((line) => !isLinkLine(line.trim())).join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
  const links = mergeLinkLines([...interiorLinks, ...metadata.links]);
  return [body, ...links, formatTagLine(metadata.tags)].filter(Boolean).join("\n");
}
function appendMemoryValue(existingValue, addition) {
  const existing = splitTrailingMetadata(existingValue);
  const added = splitTrailingMetadata(addition);
  const content = [existing.content, added.content].filter(Boolean).join("\n");
  const links = mergeLinkLines([...existing.links, ...added.links]);
  const tagLine = formatTagLine(mergeTags(existing.tags, added.tags));
  return normalizeMemoryValue([content, ...links, tagLine].filter(Boolean).join("\n"));
}

// runtime/db/src/method/memoryVersion.ts
import { Types } from "mongoose";
import { logger } from "@librechat/data-schemas";
var MAX_MEMORY_VERSIONS = 50;
var sameState = (version, snapshot) => version.key === snapshot.key && version.value === snapshot.value && (version.domainId ?? void 0) === (snapshot.domainId ? String(snapshot.domainId) : void 0);
async function recordMemoryVersion(mongoose, snapshot) {
  try {
    const MemoryVersion = mongoose.models.MemoryVersion;
    const memoryId = String(snapshot.memoryId);
    const kept = await MemoryVersion.find({ memoryId }).sort({ createdAt: -1, _id: -1 }).limit(MAX_MEMORY_VERSIONS).lean();
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
      ...snapshot.storeId ? { storeId: String(snapshot.storeId) } : {},
      ...snapshot.domainId ? { domainId: String(snapshot.domainId) } : {},
      tokenCount: snapshot.tokenCount ?? 0,
      stable: snapshot.stable === true,
      injection: snapshot.injection === "additional" ? "additional" : "system",
      locked: snapshot.locked === true,
      createdAt: /* @__PURE__ */ new Date()
    });
    if (kept.length === MAX_MEMORY_VERSIONS) {
      const keepIds = [
        created._id,
        ...kept.slice(0, MAX_MEMORY_VERSIONS - 1).map((version) => version._id)
      ];
      await MemoryVersion.deleteMany({ memoryId, _id: { $nin: keepIds } });
    }
  } catch (error) {
    logger.error("Failed to record a memory version:", error);
  }
}
async function listMemoryVersions(mongoose, { userId, memoryId, limit }) {
  const MemoryVersion = mongoose.models.MemoryVersion;
  const query = MemoryVersion.find({ userId, memoryId }).sort({ createdAt: -1, _id: -1 });
  if (limit != null && limit > 0) {
    query.limit(limit);
  }
  return await query.lean();
}
async function findMemoryVersion(mongoose, { userId, memoryId, versionId }) {
  if (!Types.ObjectId.isValid(versionId)) {
    return null;
  }
  const MemoryVersion = mongoose.models.MemoryVersion;
  return await MemoryVersion.findOne({
    _id: versionId,
    userId,
    memoryId
  }).lean();
}
async function deleteMemoryVersions(mongoose, filter) {
  const { userId, storeId, memoryIds } = filter;
  const query = {};
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
  await mongoose.models.MemoryVersion.deleteMany(query);
}
async function reassignMemoryVersions(mongoose, { fromMemoryId, toMemoryId }) {
  if (fromMemoryId === toMemoryId) {
    return;
  }
  await mongoose.models.MemoryVersion.updateMany(
    { memoryId: fromMemoryId },
    { $set: { memoryId: toMemoryId } }
  );
}
function createMemoryVersionMethods(mongoose) {
  return {
    getMemoryVersions: (params) => listMemoryVersions(mongoose, params),
    getMemoryVersion: (params) => findMemoryVersion(mongoose, params),
    reassignMemoryVersions: (params) => reassignMemoryVersions(mongoose, params)
  };
}

// runtime/db/src/util/memoryTime.ts
function formatMemoryTime(value, timezone) {
  if (value == null) {
    return void 0;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return void 0;
  }
  const options = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  };
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat("en-CA", {
      ...options,
      ...timezone ? { timeZone: timezone } : {}
    });
  } catch {
    formatter = new Intl.DateTimeFormat("en-CA", options);
  }
  const parts = formatter.formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}
function memoryTimeField(entry, timezone) {
  const time = formatMemoryTime(entry?.updated_at, timezone);
  return time == null ? "" : ` ["updated": "${time}"]`;
}

// runtime/db/src/memoryEvents.ts
var handlers = /* @__PURE__ */ new Set();
function onMemoryChange(handler) {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}
function emitMemoryChange(change) {
  for (const handler of handlers) {
    try {
      const result = handler(change);
      if (result && typeof result.then === "function") {
        result.catch((error) => {
          console.error("[memoryEvents] vector sync handler failed", error);
        });
      }
    } catch (error) {
      console.error("[memoryEvents] vector sync handler threw", error);
    }
  }
}

// runtime/db/src/method/memory.ts
import { logger as logger2 } from "@librechat/data-schemas";
var partitionFilter = (storeId) => ({
  storeId: storeId ?? null
});
var storeIdOf = (storeId) => storeId ? String(storeId) : void 0;
var domainFilter = (domainIds) => {
  const ids = (domainIds ?? []).map(String).filter((id) => id !== "");
  return ids.length > 0 ? { domainId: { $in: ids } } : {};
};
var LOCKED_UPDATE_REASON = "Cannot update a locked memory. Unlock it in the Memories panel first.";
var LOCKED_DELETE_REASON = "Cannot delete a locked memory. Unlock it in the Memories panel first.";
var isLocked = (entry) => entry?.locked === true;
var injectionOf = (value) => value === "additional" ? "additional" : "system";
function createMemoryMethods(mongoose, appMongoose = mongoose) {
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
    locked
  }) {
    try {
      if (key?.toLowerCase() === "nothing") {
        return { ok: false };
      }
      const MemoryEntry = mongoose.models.MemoryEntry;
      const existingMemory = await MemoryEntry.findOne({
        userId,
        key,
        ...partitionFilter(storeId)
      });
      if (existingMemory) {
        throw new Error("Memory with this key already exists");
      }
      const now = /* @__PURE__ */ new Date();
      const tags = parseTrailingTags(value).tags;
      const created = await MemoryEntry.create({
        userId,
        key,
        value,
        tags,
        tokenCount,
        ...storeId ? { storeId } : {},
        ...domainId || defaultDomainId ? { domainId: String(domainId ?? defaultDomainId) } : {},
        ...typeof stable === "boolean" ? { stable } : {},
        ...injection != null ? { injection } : {},
        ...typeof locked === "boolean" ? { locked } : {},
        /** A just-created memory counts as just-used: its last-recall stamp is
         *  its creation time, so capacity eviction drops older memories first. */
        lastRecalledAt: now,
        updated_at: now
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
        locked: created.locked === true
      });
      emitMemoryChange({
        type: "create",
        userId: String(userId),
        key,
        storeId: storeIdOf(storeId),
        domainId: storeIdOf(domainId) ?? storeIdOf(defaultDomainId),
        value,
        tags,
        stable: stable === true
      });
      return {
        ok: true,
        created: true,
        ...created?.domainId != null ? { domainId: String(created.domainId) } : {}
      };
    } catch (error) {
      throw new Error(
        `Failed to create memory: ${error instanceof Error ? error.message : "Unknown error"}`
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
    allowLocked = false
  }) {
    try {
      if (key?.toLowerCase() === "nothing") {
        return { ok: false };
      }
      const MemoryEntry = mongoose.models.MemoryEntry;
      if (!allowLocked) {
        const existing = await MemoryEntry.findOne({
          userId,
          key,
          ...partitionFilter(storeId)
        }).select("locked").lean();
        if (isLocked(existing)) {
          return { ok: false, reason: LOCKED_UPDATE_REASON };
        }
      }
      const now = /* @__PURE__ */ new Date();
      const tags = parseTrailingTags(value).tags;
      const existed = await MemoryEntry.exists({ userId, key, ...partitionFilter(storeId) }) != null;
      const updated = await MemoryEntry.findOneAndUpdate(
        { userId, key, ...partitionFilter(storeId) },
        {
          $set: {
            value,
            tags,
            tokenCount,
            ...storeId ? { storeId } : {},
            ...domainId ? { domainId: String(domainId) } : {},
            ...typeof stable === "boolean" ? { stable } : {},
            ...injection != null ? { injection } : {},
            ...typeof locked === "boolean" ? { locked } : {},
            updated_at: now
          },
          /** New memories default to ephemeral; stable is only ever set by an
           *  explicit opt-in so a plain edit never silently demotes a stable
           *  memory. An explicit stability override rides `$set` instead, and
           *  must not repeat on `$setOnInsert` (same-path conflict). The same
           *  applies to `locked` and `injection`. `lastRecalledAt` seeds on
           *  insert only — a just-created memory counts as just-used — and is
           *  never refreshed by an edit. */
          $setOnInsert: {
            ...typeof stable === "boolean" ? {} : { stable: false },
            ...injection != null ? {} : { injection: "system" },
            ...typeof locked === "boolean" ? {} : { locked: false },
            /** A brand-new memory lands in the caller's default domain; an
             *  edit never moves one, so an append keeps its own domain. */
            ...domainId || !defaultDomainId ? {} : { domainId: String(defaultDomainId) },
            lastRecalledAt: now
          }
        },
        {
          upsert: true,
          new: true
        }
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
          locked: updated.locked === true
        });
      }
      emitMemoryChange({
        type: "set",
        userId: String(userId),
        key,
        storeId: storeIdOf(storeId),
        domainId: storeIdOf(domainId) ?? storeIdOf(updated?.domainId) ?? storeIdOf(defaultDomainId),
        value,
        tags,
        stable: updated?.stable === true
      });
      return {
        ok: true,
        created: !existed,
        ...updated?.domainId != null ? { domainId: String(updated.domainId) } : {}
      };
    } catch (error) {
      throw new Error(
        `Failed to set memory: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
  async function deleteMemory({
    userId,
    key,
    storeId,
    allowStable = false,
    allowLocked = false
  }) {
    try {
      const MemoryEntry = mongoose.models.MemoryEntry;
      const match = { userId, key, ...partitionFilter(storeId) };
      const existing = await MemoryEntry.findOne(match).lean();
      if (existing) {
        if (!allowLocked && isLocked(existing)) {
          return { ok: false, reason: LOCKED_DELETE_REASON };
        }
        if (!allowStable && existing.stable === true) {
          return {
            ok: false,
            reason: "Cannot delete a stable memory. Disable stable memory before deleting."
          };
        }
      }
      const result = await MemoryEntry.findOneAndDelete(match);
      if (result) {
        await deleteMemoryVersions(mongoose, { userId, memoryIds: [String(result._id)] });
        emitMemoryChange({
          type: "delete",
          userId: String(userId),
          key,
          storeId: storeIdOf(storeId)
        });
      }
      return { ok: !!result };
    } catch (error) {
      throw new Error(
        `Failed to delete memory: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
  async function setMemoryStable({
    userId,
    key,
    storeId,
    stable
  }) {
    try {
      const MemoryEntry = mongoose.models.MemoryEntry;
      const result = await MemoryEntry.findOneAndUpdate(
        { userId, key, ...partitionFilter(storeId) },
        { $set: { stable } },
        { new: true }
      );
      if (result) {
        emitMemoryChange({
          type: "stable",
          userId: String(userId),
          key,
          storeId: storeIdOf(storeId),
          stable: result.stable === true,
          value: result.value
        });
      }
      return { ok: !!result };
    } catch (error) {
      throw new Error(
        `Failed to update memory stability: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
  async function getAllUserMemories(userId) {
    try {
      const MemoryEntry = mongoose.models.MemoryEntry;
      return await MemoryEntry.find({ userId }).lean();
    } catch (error) {
      throw new Error(
        `Failed to get all memories: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
  async function getUserMemories({
    userId,
    storeId,
    domainIds,
    excludeKeys,
    stableOnly
  }) {
    try {
      const MemoryEntry = mongoose.models.MemoryEntry;
      const query = {
        userId,
        ...partitionFilter(storeId),
        ...domainFilter(domainIds)
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
        `Failed to get memories: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
  async function getMemoryEntriesByKeys({
    userId,
    storeId,
    domainIds,
    keys
  }) {
    try {
      const MemoryEntry = mongoose.models.MemoryEntry;
      if (!keys || keys.length === 0) {
        return [];
      }
      return await MemoryEntry.find({
        userId,
        key: { $in: keys },
        ...partitionFilter(storeId),
        ...domainFilter(domainIds)
      }).lean();
    } catch (error) {
      throw new Error(
        `Failed to get memories by key: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
  async function getFormattedMemories({
    userId,
    storeId,
    domainIds,
    excludeConversationId,
    timezone
  }) {
    try {
      let excludeKeys;
      if (excludeConversationId) {
        excludeKeys = await getConversationMemoryKeys({
          userId,
          conversationId: excludeConversationId
        });
      }
      const memories = await getUserMemories({ userId, storeId, domainIds, excludeKeys });
      if (!memories || memories.length === 0) {
        return { withKeys: "", withoutKeys: "", totalTokens: 0 };
      }
      const sortedMemories = memories.sort(
        (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      );
      const totalTokens = sortedMemories.reduce((sum, memory) => {
        return sum + (memory.tokenCount || 0);
      }, 0);
      const withKeys = sortedMemories.map(
        (memory, index) => `${index + 1}. ["key": "${memory.key}"].` + memoryTimeField(memory, timezone) + ` ["value": "${memoryContentOf(memory)}"]` + memoryTagField(memory)
      ).join("\n\n");
      const withoutKeys = sortedMemories.map(
        (memory, index) => `${index + 1}.${memoryTimeField(memory, timezone)} ${memoryContentOf(memory)}`
      ).join("\n\n");
      return { withKeys, withoutKeys, totalTokens };
    } catch (error) {
      logger2.error("Failed to get formatted memories:", error);
      return { withKeys: "", withoutKeys: "", totalTokens: 0 };
    }
  }
  async function getStoreTagVocabulary({
    storeId,
    limit,
    promoteAt = 2
  }) {
    try {
      const MemoryEntry = mongoose.models.MemoryEntry;
      const cap = typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? limit : void 0;
      const rows = await MemoryEntry.aggregate([
        { $match: { ...partitionFilter(storeId), tags: { $exists: true, $ne: [] } } },
        { $unwind: "$tags" },
        { $group: { _id: "$tags", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        ...cap != null ? [{ $limit: cap }] : []
      ]);
      return rows.map((row) => ({
        tag: row._id,
        count: row.count,
        promoted: row.count >= promoteAt
      }));
    } catch (error) {
      logger2.error("Failed to read the store tag vocabulary:", error);
      return [];
    }
  }
  async function deleteAllUserMemories(userId) {
    try {
      const MemoryEntry = mongoose.models.MemoryEntry;
      const result = await MemoryEntry.deleteMany({ userId });
      await deleteMemoryVersions(mongoose, { userId });
      emitMemoryChange({ type: "delete", userId: String(userId), sweep: true });
      return result.deletedCount;
    } catch (error) {
      throw new Error(
        `Failed to delete all user memories: ${error instanceof Error ? error.message : "Unknown error"}`
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
    key
  }) {
    try {
      const ConversationMemory = mongoose.models.ConversationMemory;
      await ConversationMemory.findOneAndUpdate(
        { userId, conversationId, ...partitionFilter(storeId), key },
        {
          $set: {
            updated_at: /* @__PURE__ */ new Date(),
            /** This link records the conversation EXTRACTING the memory, which
             *  also upgrades a row it had only recalled before. */
            source: "extracted",
            ...typeof created === "boolean" ? { createdByConversation: created } : {},
            ...domainId ? { domainId: String(domainId) } : {},
            ...turnMessageId ? { turnMessageId } : {}
          }
        },
        { upsert: true, new: true }
      );
      return { ok: true };
    } catch (error) {
      throw new Error(
        `Failed to link conversation memory: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
  async function getConversationMemoryKeys({
    userId,
    conversationId
  }) {
    try {
      const ConversationMemory = mongoose.models.ConversationMemory;
      const links = await ConversationMemory.find({
        userId,
        conversationId,
        /** Rows written before `source` existed are extraction links. */
        source: { $ne: "recalled" }
      }).lean();
      return Array.from(new Set(links.map((link) => link.key)));
    } catch (error) {
      logger2.error("Failed to get conversation memory keys:", error);
      return [];
    }
  }
  async function getConversationMemoryDetails({
    userId,
    conversationId
  }) {
    try {
      const ConversationMemory = mongoose.models.ConversationMemory;
      const links = await ConversationMemory.find({
        userId,
        conversationId
      }).lean();
      if (links.length === 0) {
        return [];
      }
      const MemoryEntry = mongoose.models.MemoryEntry;
      const entries = await MemoryEntry.find({
        userId,
        $or: links.map((link) => ({ key: link.key, ...partitionFilter(link.storeId) }))
      }).lean();
      return entries.flatMap((entry) => {
        const link = links.find(
          (candidate) => candidate.key === entry.key && (candidate.storeId ?? null) === (entry.storeId ?? null)
        );
        if (!link) {
          return [];
        }
        return [
          {
            entry,
            /** A memory a conversation both extracted and recalled stays
             *  "extracted": it is still the conversation's own. */
            source: link.source === "recalled" ? "recalled" : "extracted",
            recallCount: link.recallCount ?? 0,
            ...link.createdByConversation != null ? { createdByConversation: link.createdByConversation } : {}
          }
        ];
      });
    } catch (error) {
      logger2.error("Failed to get conversation memory details:", error);
      return [];
    }
  }
  async function getConversationMemories({
    userId,
    conversationId,
    before
  }) {
    try {
      const ConversationMemory = mongoose.models.ConversationMemory;
      const links = await ConversationMemory.find({
        userId,
        conversationId
      }).lean();
      if (!links || links.length === 0) {
        return [];
      }
      const MemoryEntry = mongoose.models.MemoryEntry;
      const query = {
        userId,
        /** Match each link's (storeId, key) exactly — the same key can exist in
         *  different partitions, and each link records its own partition. */
        $or: links.map((link) => ({ key: link.key, ...partitionFilter(link.storeId) }))
      };
      if (before) {
        query.updated_at = { $lte: before };
      }
      return await MemoryEntry.find(query).lean();
    } catch (error) {
      logger2.error("Failed to get conversation memories:", error);
      return [];
    }
  }
  async function deleteConversationMemories({
    userId,
    conversationId
  }) {
    try {
      const ConversationMemory = mongoose.models.ConversationMemory;
      const ids = Array.isArray(conversationId) ? conversationId : [conversationId];
      const result = await ConversationMemory.deleteMany({ userId, conversationId: { $in: ids } });
      return result.deletedCount ?? 0;
    } catch (error) {
      throw new Error(
        `Failed to delete conversation memories: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
  async function deleteAllConversationMemories(userId) {
    try {
      const ConversationMemory = mongoose.models.ConversationMemory;
      const result = await ConversationMemory.deleteMany({ userId });
      return result.deletedCount ?? 0;
    } catch (error) {
      throw new Error(
        `Failed to delete all conversation memories: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
  async function loadMessageCreatedAt({
    userId,
    conversationId,
    messageIds
  }) {
    const times = /* @__PURE__ */ new Map();
    if (messageIds.length === 0) {
      return times;
    }
    const appConnection = appMongoose.connection ?? appMongoose;
    const rows = await appConnection.collection('messages').find(
      { user: String(userId), conversationId, messageId: { $in: messageIds } },
      { projection: { messageId: 1, createdAt: 1 } }
    ).toArray();
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
    retainedFromMessageId
  }) {
    try {
      const ConversationMemory = mongoose.models.ConversationMemory;
      const links = await ConversationMemory.find({
        userId,
        conversationId
      }).lean();
      if (links.length === 0) {
        return 0;
      }
      const anchors = [
        ...new Set(
          links.flatMap((link) => link.turnMessageId == null ? [] : [link.turnMessageId])
        )
      ];
      const times = retainedFromMessageId == null ? /* @__PURE__ */ new Map() : await loadMessageCreatedAt({
        userId,
        conversationId,
        messageIds: [...anchors, retainedFromMessageId]
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
        _id: { $in: released.map((link) => link._id) }
      });
      return result.deletedCount ?? 0;
    } catch (error) {
      throw new Error(
        `Failed to delete compacted conversation memories: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
  async function getMemoryInjectionEntries({
    userId,
    storeId,
    domainIds,
    excludeConversationId,
    stableOnly
  }) {
    try {
      let excludeKeys;
      if (excludeConversationId) {
        excludeKeys = await getConversationMemoryKeys({
          userId,
          conversationId: excludeConversationId
        });
      }
      return getUserMemories({ userId, storeId, domainIds, excludeKeys, stableOnly });
    } catch (error) {
      logger2.error("Failed to get memory injection entries:", error);
      return [];
    }
  }
  async function getMemoryExtractionEntries({
    userId,
    storeId,
    domainIds,
    conversationId
  }) {
    try {
      let entries;
      if (!conversationId) {
        entries = await getUserMemories({ userId, storeId, domainIds, stableOnly: true });
      } else {
        const [convKeys, all] = await Promise.all([
          getConversationMemoryKeys({ userId, conversationId }),
          getUserMemories({ userId, storeId, domainIds })
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
      logger2.error("Failed to get memory extraction entries:", error);
      return [];
    }
  }
  async function markMemoriesRecalled({
    userId,
    storeId,
    conversationId,
    turnId,
    keys
  }) {
    try {
      if (!Array.isArray(keys) || keys.length === 0) {
        return;
      }
      const MemoryEntry = mongoose.models.MemoryEntry;
      await MemoryEntry.updateMany(
        { userId, key: { $in: keys }, ...partitionFilter(storeId) },
        { $set: { lastRecalledAt: /* @__PURE__ */ new Date() } }
      );
      if (conversationId) {
        const ConversationMemory = mongoose.models.ConversationMemory;
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
                  $setOnInsert: { source: "recalled" }
                },
                { upsert: true }
              );
            }
            return ConversationMemory.updateOne(
              filter,
              [
                {
                  $set: {
                    updated_at: now,
                    source: { $ifNull: ["$source", "recalled"] },
                    lastRecallTurnId: turnId,
                    recallCount: {
                      $cond: [
                        { $eq: ["$lastRecallTurnId", turnId] },
                        { $ifNull: ["$recallCount", 0] },
                        { $add: [{ $ifNull: ["$recallCount", 0] }, 1] }
                      ]
                    }
                  }
                }
              ],
              { upsert: true }
            );
          })
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to mark memories recalled: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
  const evictionTime = (entry) => entry.lastRecalledAt ? new Date(entry.lastRecalledAt).getTime() : 0;
  const entryUpdatedTime = (entry) => entry.updated_at ? new Date(entry.updated_at).getTime() : 0;
  const compareForEviction = (a, b) => {
    const byRecall = evictionTime(a) - evictionTime(b);
    return byRecall !== 0 ? byRecall : entryUpdatedTime(a) - entryUpdatedTime(b);
  };
  async function evictMemoriesToFitCapacity({
    userId,
    storeId,
    tokenLimit,
    tokenCount,
    dryRun = false
  }) {
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
      const ephemeral = memories.filter((memory) => memory.stable !== true && memory.locked !== true).sort(compareForEviction);
      const evictableTokens = ephemeral.reduce((sum, memory) => sum + (memory.tokenCount || 0), 0);
      if (evictableTokens < overBy) {
        return {
          ok: false,
          reason: `This memory exceeds the available capacity of ${tokenLimit} tokens. Even after removing every removable memory it still cannot be stored.`
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
          ...memory.storeId ? { storeId: String(memory.storeId) } : {},
          tokenCount: memory.tokenCount,
          ...memory.lastRecalledAt ? { lastRecalledAt: memory.lastRecalledAt } : {}
        });
        freed += memory.tokenCount || 0;
        if (!dryRun) {
          await deleteMemory({ userId, key: memory.key, storeId: memory.storeId });
        }
      }
      return { ok: true, evicted };
    } catch (error) {
      throw new Error(
        `Failed to evict memories for capacity: ${error instanceof Error ? error.message : "Unknown error"}`
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
    deleteAllConversationMemories
  };
}

// runtime/db/src/method/memoryStore.ts
import { Types as Types2 } from "mongoose";
import { PermissionBits, ResourceType } from "librechat-data-provider";
import { logger as logger3 } from "@librechat/data-schemas";
var MEMORY_STORE_NAME_MAX = 80;
var DEFAULT_MEMORY_STORE_NAME = "Default";
var NAME_REQUIRED_REASON = "Memory store name is required.";
var NAME_TOO_LONG_REASON = `Memory store name exceeds ${MEMORY_STORE_NAME_MAX} characters.`;
var NAME_EXISTS_REASON = "A memory store with this name already exists.";
var NOT_FOUND_REASON = "Memory store not found.";
var FORBIDDEN_REASON = "Only the memory store owner can change it.";
var DEFAULT_DELETE_REASON = "The default memory store cannot be deleted.";
var idOf = (value) => value.toString();
var normalizeName = (name) => typeof name === "string" ? name.trim() : "";
function createMemoryStoreMethods(mongoose, deps) {
  const isOwner = (store, userId) => idOf(store.userId) === userId;
  async function permissionBitsFor(userId, storeIds) {
    if (storeIds.length === 0) {
      return /* @__PURE__ */ new Map();
    }
    const principals = await deps.getUserPrincipals({ userId });
    return deps.getEffectivePermissionsForResources(
      principals,
      ResourceType.MEMORYSTORE,
      storeIds
    );
  }
  const canWrite = (bits) => (bits & PermissionBits.EDIT) !== 0;
  async function migrateLegacyMemories(userId, storeId) {
    const legacy = { userId, storeId: { $exists: false } };
    const migrated = await mongoose.models.MemoryEntry?.find(legacy).select("key value stable").lean();
    await Promise.all([
      mongoose.models.MemoryEntry?.updateMany(legacy, { $set: { storeId } }),
      mongoose.models.MemoryImage?.updateMany(legacy, { $set: { storeId } }),
      mongoose.models.ConversationMemory?.updateMany(legacy, { $set: { storeId } })
    ]);
    for (const entry of migrated ?? []) {
      emitMemoryChange({
        type: "set",
        userId: String(userId),
        key: entry.key,
        storeId,
        value: entry.value,
        stable: entry.stable === true
      });
    }
  }
  async function ensureDefaultMemoryStore(userId) {
    const MemoryStore = mongoose.models.MemoryStore;
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
          updated_at: now
        }
      },
      { upsert: true, new: true }
    ).lean();
    await migrateLegacyMemories(userId, String(created._id));
    return created;
  }
  async function createMemoryStore({
    userId,
    name
  }) {
    const trimmed = normalizeName(name);
    if (trimmed === "") {
      return { ok: false, reason: NAME_REQUIRED_REASON };
    }
    if (trimmed.length > MEMORY_STORE_NAME_MAX) {
      return { ok: false, reason: NAME_TOO_LONG_REASON };
    }
    const MemoryStore = mongoose.models.MemoryStore;
    const duplicate = await MemoryStore.findOne({ userId, name: trimmed }).lean();
    if (duplicate) {
      return { ok: false, reason: NAME_EXISTS_REASON };
    }
    const now = /* @__PURE__ */ new Date();
    const store = (await MemoryStore.create({
      userId,
      name: trimmed,
      isDefault: false,
      created_at: now,
      updated_at: now
    })).toObject();
    return { ok: true, store };
  }
  async function listMemoryStores(userId) {
    const MemoryStore = mongoose.models.MemoryStore;
    const userIdStr = idOf(userId);
    const principals = await deps.getUserPrincipals({ userId });
    const sharedIds = await deps.findAccessibleResources(
      principals,
      ResourceType.MEMORYSTORE,
      PermissionBits.VIEW
    );
    const stores = await MemoryStore.find({
      $or: [{ userId }, { _id: { $in: sharedIds } }]
    }).sort({ isDefault: -1, name: 1 }).lean();
    const bitsByStore = await deps.getEffectivePermissionsForResources(
      principals,
      ResourceType.MEMORYSTORE,
      stores.map((store) => store._id)
    );
    const owned = stores.filter((store) => idOf(store.userId) === userIdStr);
    const shared = stores.filter((store) => idOf(store.userId) !== userIdStr);
    const toAccess = (store, owner) => ({
      store,
      isOwner: owner,
      permissionBits: bitsByStore.get(String(store._id)) ?? 0
    });
    return [
      ...owned.map((store) => toAccess(store, true)),
      ...shared.map((store) => toAccess(store, false))
    ];
  }
  async function getMemoryStore({
    storeId,
    userId
  }) {
    const MemoryStore = mongoose.models.MemoryStore;
    const query = { _id: storeId };
    if (userId != null) {
      query.userId = userId;
    }
    return await MemoryStore.findOne(query).lean();
  }
  async function resolveMemoryStoreAccess({
    storeId,
    userId
  }) {
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
        canWrite: canWrite(bits)
      };
    } catch (error) {
      logger3.error("Failed to resolve memory store access:", error);
      return null;
    }
  }
  async function updateMemoryStore({
    storeId,
    userId,
    name
  }) {
    const trimmed = normalizeName(name);
    if (trimmed === "") {
      return { ok: false, reason: NAME_REQUIRED_REASON };
    }
    if (trimmed.length > MEMORY_STORE_NAME_MAX) {
      return { ok: false, reason: NAME_TOO_LONG_REASON };
    }
    const MemoryStore = mongoose.models.MemoryStore;
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
      _id: { $ne: store._id }
    }).lean();
    if (duplicate) {
      return { ok: false, reason: NAME_EXISTS_REASON };
    }
    const updated = await MemoryStore.findByIdAndUpdate(
      store._id,
      { $set: { name: trimmed, updated_at: /* @__PURE__ */ new Date() } },
      { new: true }
    ).lean();
    return { ok: true, store: updated };
  }
  async function deleteMemoryStore({
    storeId,
    userId
  }) {
    const MemoryStore = mongoose.models.MemoryStore;
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
      mongoose.models.MemoryEntry?.deleteMany(memoryQuery),
      mongoose.models.MemoryImage?.deleteMany(memoryQuery),
      mongoose.models.ConversationMemory?.deleteMany(memoryQuery),
      /** The memories' recorded history goes with them. */
      deleteMemoryVersions(mongoose, { storeId: storeIdStr }),
      /** Domains belong to the store: they go with it. */
      mongoose.models.MemoryDomain?.deleteMany(memoryQuery)
    ]);
    emitMemoryChange({
      type: "delete",
      userId: String(store.userId),
      storeId: storeIdStr,
      sweep: true
    });
    await MemoryStore.deleteOne({ _id: store._id });
    return { ok: true };
  }
  async function clearMemoryStore({
    storeId
  }) {
    const storeIdStr = idOf(storeId);
    const memoryQuery = { storeId: storeIdStr };
    const [owner, dropped] = await Promise.all([
      mongoose.models.MemoryStore.findOne({ _id: storeId }).select("userId").lean(),
      mongoose.models.MemoryEntry?.countDocuments(memoryQuery)
    ]);
    const ownerId = owner?.userId;
    await Promise.all([
      mongoose.models.MemoryEntry?.deleteMany(memoryQuery),
      mongoose.models.MemoryImage?.deleteMany(memoryQuery),
      mongoose.models.ConversationMemory?.deleteMany(memoryQuery),
      /** The memories' recorded history goes with them. */
      deleteMemoryVersions(mongoose, { storeId: storeIdStr }),
      /** Clear removes the store's contents, and domains are part of them: an
       *  emptied domain left behind would still show up in the panel and the
       *  `/memory` mount. */
      mongoose.models.MemoryDomain?.deleteMany(memoryQuery)
    ]);
    if (ownerId) {
      emitMemoryChange({
        type: "delete",
        userId: String(ownerId),
        storeId: storeIdStr,
        sweep: true
      });
    }
    return dropped ?? 0;
  }
  async function getMemoryStoreStats(storeIds) {
    const stats = /* @__PURE__ */ new Map();
    if (storeIds.length === 0) {
      return stats;
    }
    const rows = await mongoose.models.MemoryEntry.aggregate([
      { $match: { storeId: { $in: storeIds.map(String) } } },
      {
        $group: {
          _id: "$storeId",
          memoryCount: { $sum: 1 },
          totalTokens: { $sum: { $ifNull: ["$tokenCount", 0] } },
          updatedAt: { $max: "$updated_at" }
        }
      }
    ]);
    for (const row of rows) {
      stats.set(row._id, {
        memoryCount: row.memoryCount,
        totalTokens: row.totalTokens,
        updatedAt: row.updatedAt ?? void 0
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
    clearMemoryStore
  };
}

// runtime/db/src/method/memoryDomain.ts
import { Types as Types3 } from "mongoose";
import { MEMORY_DOMAIN_KINDS } from "librechat-data-provider";
import { logger as logger4 } from "@librechat/data-schemas";
var MEMORY_DOMAIN_NAME_MAX = 60;
var MEMORY_DOMAIN_DESCRIPTION_MAX = 200;
var DEFAULT_MEMORY_DOMAIN_NAME = "Default";
var DEFAULT_MEMORY_DOMAIN_DESCRIPTION = "Facts about the real world.";
var NAME_REQUIRED_REASON2 = "Memory domain name is required.";
var NAME_TOO_LONG_REASON2 = `Memory domain name exceeds ${MEMORY_DOMAIN_NAME_MAX} characters.`;
var NAME_EXISTS_REASON2 = "A memory domain with this name already exists.";
var KIND_INVALID_REASON = "Unknown memory domain kind.";
var DESCRIPTION_REQUIRED_REASON = "Memory domain description is required.";
var DESCRIPTION_TOO_LONG_REASON = `Memory domain description exceeds ${MEMORY_DOMAIN_DESCRIPTION_MAX} characters.`;
var NOT_FOUND_REASON2 = "Memory domain not found.";
var DEFAULT_DELETE_REASON2 = "The default memory domain cannot be deleted.";
var NOT_EMPTY_REASON = "The memory domain still holds memories.";
var NAME_COLLATION = { locale: "en", strength: 2 };
var normalizeField = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  return value.normalize("NFKC").replace(/["\\/]/g, "").replace(/\s+/g, " ").trim();
};
var normalizeName2 = normalizeField;
var normalizeDescription = normalizeField;
var isKnownKind = (kind) => typeof kind === "string" && MEMORY_DOMAIN_KINDS.includes(kind);
function createMemoryDomainMethods(mongoose) {
  async function adoptLegacyMemories(storeId, domainId) {
    const legacy = { storeId, domainId: { $exists: false } };
    const migrated = await mongoose.models.MemoryEntry?.find(legacy).select("key value stable userId").lean();
    await Promise.all([
      mongoose.models.MemoryEntry?.updateMany(legacy, { $set: { domainId } }),
      mongoose.models.MemoryImage?.updateMany(legacy, { $set: { domainId } }),
      mongoose.models.ConversationMemory?.updateMany(legacy, { $set: { domainId } })
    ]);
    for (const entry of migrated ?? []) {
      emitMemoryChange({
        type: "set",
        userId: String(entry.userId),
        key: entry.key,
        storeId,
        domainId,
        value: entry.value,
        stable: entry.stable === true
      });
    }
  }
  async function ensureDefaultMemoryDomain({
    userId,
    storeId
  }) {
    const MemoryDomain = mongoose.models.MemoryDomain;
    const storeIdStr = String(storeId);
    const existing = await MemoryDomain.findOne({
      storeId: storeIdStr,
      isDefault: true
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
          kind: "real",
          description: DEFAULT_MEMORY_DOMAIN_DESCRIPTION,
          isDefault: true,
          createdBy: "user",
          created_at: now,
          updated_at: now
        }
      },
      { upsert: true, new: true }
    ).lean();
    await adoptLegacyMemories(storeIdStr, String(created._id));
    return created;
  }
  async function countsFor(storeId) {
    const rows = await mongoose.models.MemoryEntry?.aggregate([
      { $match: { storeId, domainId: { $type: "string" } } },
      {
        $group: {
          _id: "$domainId",
          memoryCount: { $sum: 1 },
          totalTokens: { $sum: { $ifNull: ["$tokenCount", 0] } }
        }
      }
    ]);
    return new Map(
      (rows ?? []).map((row) => [
        row._id,
        { memoryCount: row.memoryCount, totalTokens: row.totalTokens }
      ])
    );
  }
  async function listMemoryDomains({
    storeId
  }) {
    const storeIdStr = String(storeId);
    const domains = await mongoose.models.MemoryDomain.find({ storeId: storeIdStr }).sort({ isDefault: -1, name: 1 }).lean();
    const counts = await countsFor(storeIdStr);
    return domains.map((domain) => {
      const count = counts.get(String(domain._id));
      return {
        ...domain,
        memoryCount: count?.memoryCount ?? 0,
        totalTokens: count?.totalTokens ?? 0
      };
    });
  }
  function validateName(name) {
    if (name === "") {
      return NAME_REQUIRED_REASON2;
    }
    if (name.length > MEMORY_DOMAIN_NAME_MAX) {
      return NAME_TOO_LONG_REASON2;
    }
    return null;
  }
  function validateDescription(description) {
    if (description === "") {
      return DESCRIPTION_REQUIRED_REASON;
    }
    if (description.length > MEMORY_DOMAIN_DESCRIPTION_MAX) {
      return DESCRIPTION_TOO_LONG_REASON;
    }
    return null;
  }
  async function nameTaken(storeId, name, excludeDomainId) {
    const query = { storeId, name };
    if (excludeDomainId != null) {
      query._id = { $ne: excludeDomainId };
    }
    const duplicate = await mongoose.models.MemoryDomain.findOne(query).collation(NAME_COLLATION).lean();
    return duplicate != null;
  }
  async function createMemoryDomain({
    userId,
    storeId,
    name,
    kind,
    description,
    createdBy = "user"
  }) {
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
      const domain = (await mongoose.models.MemoryDomain.create({
        userId,
        storeId: storeIdStr,
        name: trimmed,
        kind,
        description: trimmedDescription,
        isDefault: false,
        createdBy,
        created_at: now,
        updated_at: now
      })).toObject();
      return { ok: true, domain };
    } catch (error) {
      logger4.warn(`Failed to create memory domain "${trimmed}": ${error.message}`);
      return { ok: false, reason: NAME_EXISTS_REASON2 };
    }
  }
  async function updateMemoryDomain({
    storeId,
    domainId,
    name,
    kind,
    description
  }) {
    const storeIdStr = String(storeId);
    const domain = await mongoose.models.MemoryDomain.findOne({
      _id: domainId,
      storeId: storeIdStr
    }).lean();
    if (!domain) {
      return { ok: false, reason: NOT_FOUND_REASON2 };
    }
    const update = { updated_at: /* @__PURE__ */ new Date() };
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
    const updated = await mongoose.models.MemoryDomain.findByIdAndUpdate(
      domain._id,
      { $set: update },
      { new: true }
    ).lean();
    return { ok: true, domain: updated };
  }
  async function getMemoryDomainMemories({
    storeId,
    domainId
  }) {
    return await mongoose.models.MemoryEntry?.find({
      storeId: String(storeId),
      domainId: String(domainId)
    }).select("key value stable").lean() ?? [];
  }
  async function deleteMemoryDomain({
    storeId,
    domainId,
    force = false
  }) {
    const storeIdStr = String(storeId);
    const domain = await mongoose.models.MemoryDomain.findOne({
      _id: domainId,
      storeId: storeIdStr
    }).lean();
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
      mongoose.models.MemoryEntry?.deleteMany({ storeId: storeIdStr, domainId: domainIdStr }),
      mongoose.models.MemoryImage?.deleteMany({ storeId: storeIdStr, domainId: domainIdStr }),
      mongoose.models.ConversationMemory?.deleteMany({
        storeId: storeIdStr,
        domainId: domainIdStr
      })
    ]);
    emitMemoryChange({
      type: "delete",
      userId: String(domain.userId),
      storeId: storeIdStr,
      domainId: domainIdStr,
      sweep: true
    });
    await mongoose.models.MemoryDomain.deleteOne({ _id: domain._id });
    return { ok: true };
  }
  async function resolveMemoryDomain({
    storeId,
    domain
  }) {
    const storeIdStr = String(storeId);
    const query = { storeId: storeIdStr };
    if (Types3.ObjectId.isValid(domain)) {
      query._id = domain;
    } else {
      query.name = domain;
    }
    const found = await mongoose.models.MemoryDomain.findOne(query).collation(NAME_COLLATION).lean();
    return found ?? null;
  }
  return {
    ensureDefaultMemoryDomain,
    listMemoryDomains,
    createMemoryDomain,
    updateMemoryDomain,
    deleteMemoryDomain,
    resolveMemoryDomain,
    getMemoryDomainMemories
  };
}

// runtime/db/src/method/memoryImage.ts
import { Types as Types4 } from "mongoose";
import { logger as logger6 } from "@librechat/data-schemas";

// runtime/db/src/schema/memoryImageCounter.ts
import { Schema } from "mongoose";
var memoryImageCounterSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
    unique: true
  },
  seq: {
    type: Number,
    default: 0
  }
});
var memoryImageCounter_default = memoryImageCounterSchema;

// runtime/db/src/model/tenantIsolation.ts
import { getTenantId, SYSTEM_TENANT_ID } from "@librechat/data-schemas";
import { logger as logger5 } from "@librechat/data-schemas";
var _strictMode;
function isStrict() {
  return _strictMode ??= process.env.TENANT_ISOLATION_STRICT === "true";
}
if (process.env.TENANT_ISOLATION_STRICT && process.env.TENANT_ISOLATION_STRICT !== "true" && process.env.TENANT_ISOLATION_STRICT !== "false") {
  logger5.warn(
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

// runtime/db/src/schema/memoryImage.ts
import { Schema as Schema2 } from "mongoose";
var memoryImageSchema = new Schema2({
  userId: {
    type: Schema2.Types.ObjectId,
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

// runtime/db/src/method/memoryImage.ts
var partitionFilter2 = (storeId) => ({ storeId: storeId ?? null });
var META_PROJECTION = "-data -__v";
function createMemoryImageMethods(mongoose) {
  const MemoryImage = mongoose.models.MemoryImage ?? createMemoryImageModel(mongoose);
  const MemoryImageCounter = mongoose.models.MemoryImageCounter ?? mongoose.model("MemoryImageCounter", memoryImageCounter_default);
  async function nextMemoryImageId(userId) {
    const counter = await MemoryImageCounter.findOneAndUpdate(
      { userId },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
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
    tenantId
  }) {
    try {
      const existing = await MemoryImage.findOne({ userId, ...partitionFilter2(storeId), sha256 }).select(META_PROJECTION).lean();
      if (existing) {
        const id2 = existing.id ?? await nextMemoryImageId(userId);
        await MemoryImage.updateOne(
          { userId, ...partitionFilter2(storeId), sha256 },
          {
            $set: {
              updatedAt: /* @__PURE__ */ new Date(),
              id: id2,
              ...domainId != null ? { domainId: String(domainId) } : {}
            }
          }
        );
        return { ok: true, deduped: "sha256", image: { ...existing, id: id2 } };
      }
      const id = await nextMemoryImageId(userId);
      await MemoryImage.create({
        userId,
        storeId,
        ...domainId != null ? { domainId: String(domainId) } : {},
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
        updatedAt: /* @__PURE__ */ new Date()
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
          updatedAt: /* @__PURE__ */ new Date()
        }
      };
    } catch (error) {
      if (error?.code === 11e3) {
        return { ok: true, deduped: "sha256" };
      }
      logger6.error("[memoryImage] Failed to upsert image", error);
      return { ok: false, reason: "Failed to store image" };
    }
  }
  async function getMemoryImages({
    userId,
    storeId,
    limit
  }) {
    return await MemoryImage.find({ userId, ...partitionFilter2(storeId) }).select(META_PROJECTION).sort({ updatedAt: -1 }).limit(Number(limit) > 0 ? Number(limit) : 0).lean();
  }
  async function getMemoryImage({
    userId,
    storeId,
    sha256,
    id
  }) {
    if (sha256 == null && id == null) {
      return null;
    }
    return await MemoryImage.findOne({
      userId,
      ...storeId != null ? { storeId } : {},
      ...sha256 != null ? { sha256 } : { id }
    }).lean();
  }
  async function deleteMemoryImage({
    userId,
    storeId,
    sha256
  }) {
    const result = await MemoryImage.deleteOne({ userId, ...partitionFilter2(storeId), sha256 });
    return result.deletedCount ?? 0;
  }
  async function deleteAllUserMemoryImages(userId) {
    const result = await MemoryImage.deleteMany({ userId });
    emitMemoryChange({ type: "delete", userId: String(userId), sweep: true, image: true });
    return result.deletedCount ?? 0;
  }
  async function markMemoryImagesRecalled({
    userId,
    storeId,
    hashes
  }) {
    if (!Array.isArray(hashes) || hashes.length === 0) {
      return 0;
    }
    const result = await MemoryImage.updateMany(
      { userId, ...partitionFilter2(storeId), sha256: { $in: hashes } },
      { $set: { lastRecalledAt: /* @__PURE__ */ new Date() } }
    );
    return result.modifiedCount ?? 0;
  }
  async function markMemoryImageEmbedded({
    userId,
    storeId,
    sha256
  }) {
    const result = await MemoryImage.updateOne(
      { userId, ...partitionFilter2(storeId), sha256 },
      { $set: { embedded: true } }
    );
    return result.modifiedCount ?? 0;
  }
  async function touchMemoryImage({
    userId,
    storeId,
    sha256
  }) {
    const result = await MemoryImage.updateOne(
      { userId, ...partitionFilter2(storeId), sha256 },
      { $set: { updatedAt: /* @__PURE__ */ new Date() } }
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
    touchMemoryImage
  };
}

// runtime/db/src/method/memorySections.ts
function memoryPartId(key, section) {
  return `${key}\0${section ?? ""}`;
}
var HEADING_LINE_PATTERN = /^ {0,3}##(?!#)[ \t]+(.*?)[ \t]*#*[ \t]*$/;
var FENCE_LINE_PATTERN = /^ {0,3}(`{3,}|~{3,})/;
function findHeadings(lines) {
  const headings = [];
  let openFence = null;
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
function scanDocument(value) {
  if (typeof value !== "string") {
    return null;
  }
  const content = memoryBodyOf({ value }).trimEnd();
  if (!content.trim()) {
    return null;
  }
  const lines = content.split("\n");
  const headings = findHeadings(lines);
  if (headings.length < 2) {
    return null;
  }
  return { lines, headings, lead: lines.slice(0, headings[0].index).join("\n").trim() };
}
function splitMemorySections(value) {
  const document = scanDocument(value);
  if (document == null) {
    return null;
  }
  const { lines, headings, lead } = document;
  const sections = [];
  for (let position = 0; position < headings.length; position += 1) {
    const start = position === 0 ? 0 : headings[position].index;
    const end = position + 1 < headings.length ? headings[position + 1].index : lines.length;
    const text = lines.slice(start, end).join("\n").trim();
    if (!text) {
      continue;
    }
    sections.push({ id: String(sections.length), heading: headings[position].heading, text });
  }
  return sections.length > 0 ? { lead, sections } : null;
}
var SECTION_OMISSION = "\u2026\u2026";
function frameMemorySection(value, section, documentValue) {
  if (typeof value !== "string" || !section) {
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
  const body = !isFirst && document.lead && value.startsWith(document.lead) ? value.slice(document.lead.length).trim() : value;
  const parts = [];
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
  return parts.join("\n\n");
}

// runtime/db/src/methods.ts
function createMemoryMethodSet(mongoose, deps, appMongoose = mongoose) {
  return {
    ...createMemoryMethods(mongoose, appMongoose),
    ...createMemoryStoreMethods(mongoose, deps),
    ...createMemoryDomainMethods(mongoose),
    ...createMemoryImageMethods(mongoose),
    ...createMemoryVersionMethods(mongoose)
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
  splitMemorySections
};
