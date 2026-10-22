import { createRequire } from "node:module";
import { memoryTagsOf } from "../db/methods.mjs";
const require = createRequire(import.meta.url);
const { vfsGlobToRegex, matchLines } = require("@librechat/api");


const MEMORY_EXT = ".md";
const MEMORY_INDEX_FILE = "INDEX.yaml";
const MEMORY_IMAGES_DIR = "images";
const MEMORY_INDEX_TAG_LIMIT = 100;
const MEMORY_IMAGE_PATH_PATTERN = /^images\/(\d{1,18}|[a-f0-9]{64})\.(png|jpe?g|gif|webp)$/;
function imageTargetOf(relPath) {
  const match = MEMORY_IMAGE_PATH_PATTERN.exec(relPath);
  if (!match) {
    return null;
  }
  const [, segment] = match;
  return segment.length === 64 ? { sha256: segment } : { id: Number(segment) };
}
function epochMs(value) {
  if (value == null) {
    return void 0;
  }
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : void 0;
}
const keyOf = (relPath) => {
  if (!relPath.endsWith(MEMORY_EXT)) {
    return null;
  }
  const key = relPath.slice(0, -MEMORY_EXT.length);
  return key.length > 0 && !key.includes("/") ? key : null;
};
const domainSegment = (name) => name.replace(/[/\\]/g, "").trim();
const foldersOf = (domains) => domains.map((domain) => domainSegment(domain.name)).filter((folder) => folder.length > 0).join(", ");
function memoryPathOf(relPath) {
  const segments = relPath.split("/");
  if (segments.length === 1) {
    const key = keyOf(segments[0]);
    return key == null ? null : { key };
  }
  if (segments.length === 2) {
    const [folder, file] = segments;
    const key = keyOf(file);
    if (!folder || key == null) {
      return null;
    }
    return { domain: folder, key };
  }
  return null;
}
function timezoneOf(ctx) {
  return ctx.req?.body?.timezone;
}
function dayFormatter(timezone) {
  const options = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  };
  if (timezone) {
    try {
      return new Intl.DateTimeFormat("en-CA", { ...options, timeZone: timezone });
    } catch {
    }
  }
  return new Intl.DateTimeFormat("en-CA", options);
}
function dayKey(formatter, value) {
  const parts = formatter.formatToParts(new Date(value));
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  const year = byType.get("year");
  const month = byType.get("month");
  const day = byType.get("day");
  return year && month && day ? `${year}-${month}-${day}` : void 0;
}
function compareByCodePoint(a, b) {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}
function summarizeMemoryIndex(memories, timezone, prefixOf) {
  const formatter = dayFormatter(timezone);
  const nowKey = dayKey(formatter, Date.now());
  const stable = [];
  const touchedToday = [];
  const tagCounts = /* @__PURE__ */ new Map();
  const nameOf = (memory) => `${prefixOf?.(memory) ?? ""}${memory.key}`;
  for (const memory of memories) {
    for (const tag of new Set(memoryTagsOf(memory))) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    if (memory.stable === true) {
      stable.push(nameOf(memory));
      continue;
    }
    const updated = epochMs(memory.updated_at);
    if (updated != null && nowKey != null && dayKey(formatter, updated) === nowKey) {
      touchedToday.push({ key: nameOf(memory), updated });
    }
  }
  stable.sort();
  touchedToday.sort((a, b) => b.updated - a.updated);
  const tags = [...tagCounts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || compareByCodePoint(a.tag, b.tag)).slice(0, MEMORY_INDEX_TAG_LIMIT);
  return { stable, today: touchedToday.map((entry) => entry.key), tags };
}
function buildMemoryIndexYaml(stableKeys, todayKeys, tags = []) {
  const lines = [
    "# Memory index (read-only).",
    '# "stable": memories on the stable baseline \u2014 injected every turn.',
    '# "today": ephemeral memories created or modified today.',
    '# "tags": cue anchors this store already uses, most used first. A new memory',
    "#   should reuse one of these when it means the same thing instead of writing",
    "#   a near-duplicate.",
    "",
    "stable:"
  ];
  if (stableKeys.length === 0) {
    lines.push("  []");
  } else {
    for (const key of stableKeys) {
      lines.push(`  - ${key}`);
    }
  }
  lines.push("", "today:");
  if (todayKeys.length === 0) {
    lines.push("  []");
  } else {
    for (const key of todayKeys) {
      lines.push(`  - ${key}`);
    }
  }
  lines.push("", "tags:");
  if (tags.length === 0) {
    lines.push("  []");
  } else {
    for (const { tag } of tags) {
      lines.push(`  - ${tag}`);
    }
  }
  return `${lines.join("\n")}
`;
}
function createMemoryProvider(deps = {}) {
  const userIdOf = (ctx) => ctx.req?.user?.id ?? null;
  const domainsOf = async (userId, ctx) => {
    if (!deps.listDomains) {
      return [];
    }
    return deps.listDomains(userId, ctx.memoryStoreId);
  };
  const findDomainFolder = (domains, folder) => domains.find((domain) => domainSegment(domain.name) === folder);
  const folderOf = (domains, domainId) => {
    if (domainId == null) {
      return "";
    }
    const domain = domains.find((entry) => entry.id === domainId);
    return domain ? domainSegment(domain.name) : "";
  };
  const relPathOf = (domains, memory) => {
    const folder = folderOf(domains, memory.domainId);
    return folder ? `${folder}/${memory.key}${MEMORY_EXT}` : `${memory.key}${MEMORY_EXT}`;
  };
  const fileEntry = (memory) => {
    const mtime = epochMs(memory.updated_at);
    const entry = {
      name: `${memory.key}${MEMORY_EXT}`,
      type: "file",
      mimeType: "text/markdown",
      /* The entry's real content size is computable from the row; the
       * modification time comes from the stored `updated_at`. */
      size: Buffer.byteLength(memory.value, "utf8")
    };
    if (mtime != null) {
      entry.mtime = mtime;
    }
    return entry;
  };
  const locate = (memories, domains, target) => {
    if (!target.domain) {
      return memories.find((memory) => memory.key === target.key);
    }
    const domain = findDomainFolder(domains, target.domain);
    if (!domain) {
      return void 0;
    }
    return memories.find((memory) => memory.key === target.key && memory.domainId === domain.id);
  };
  return {
    name: "memory",
    readonly: false,
    async list(relPath, ctx) {
      const userId = userIdOf(ctx);
      if (!userId || !deps.listMemories) {
        return { directory: relPath, entries: [] };
      }
      const memories = await deps.listMemories(userId, ctx.memoryStoreId);
      const domains = await domainsOf(userId, ctx);
      const index = summarizeMemoryIndex(memories, timezoneOf(ctx), (memory) => {
        const folder = folderOf(domains, memory.domainId);
        return folder ? `${folder}/` : "";
      });
      const indexEntry = {
        name: MEMORY_INDEX_FILE,
        type: "file",
        mimeType: "text/yaml",
        size: Buffer.byteLength(
          buildMemoryIndexYaml(index.stable, index.today, index.tags),
          "utf8"
        )
      };
      if (relPath === "") {
        const entries = domains.length > 0 ? domains.map((domain2) => ({
          name: domainSegment(domain2.name),
          type: "dir"
        })) : memories.map(fileEntry);
        entries.push(indexEntry);
        return { directory: "", entries };
      }
      const domain = findDomainFolder(domains, relPath);
      if (!domain) {
        return null;
      }
      return {
        directory: relPath,
        entries: memories.filter((memory) => memory.domainId === domain.id).map(fileEntry)
      };
    },
    /**
     * Raw bytes for one indexed image: this is the channel the image endpoint
     * and the chat's markdown renderer use to fetch
     * `/memory/images/<id>.<ext>`.
     */
    async readBytes(relPath, ctx) {
      const userId = userIdOf(ctx);
      const target = imageTargetOf(relPath);
      if (!userId || !target || !deps.getMemoryImage) {
        return null;
      }
      const image = await deps.getMemoryImage({ userId, storeId: ctx.memoryStoreId, ...target });
      if (!image?.data) {
        return null;
      }
      const mtime = epochMs(image.updatedAt);
      return {
        buffer: Buffer.from(image.data.toString("base64"), "base64"),
        mimeType: image.mime ?? "image/png",
        ...mtime != null && { mtime }
      };
    },
    /**
     * Version metadata for the image endpoint's HEAD probe: `null` when the
     * image is gone, `undefined` when no version can be reported.
     */
    async stat(relPath, ctx) {
      const userId = userIdOf(ctx);
      const target = imageTargetOf(relPath);
      if (!userId || !target || !deps.getMemoryImage) {
        return void 0;
      }
      const image = await deps.getMemoryImage({ userId, storeId: ctx.memoryStoreId, ...target });
      if (!image?.data) {
        return null;
      }
      const mtime = epochMs(image.updatedAt);
      return { size: image.bytes, ...mtime != null && { mtime } };
    },
    async read(relPath, ctx) {
      const userId = userIdOf(ctx);
      if (!userId) {
        return { status: "denied", reason: "A logged-in user is required to read memories." };
      }
      const imageTarget = imageTargetOf(relPath);
      if (imageTarget) {
        if (!deps.getMemoryImage) {
          return { status: "missing" };
        }
        const image = await deps.getMemoryImage({
          userId,
          storeId: ctx.memoryStoreId,
          ...imageTarget
        });
        if (!image?.data) {
          return { status: "missing" };
        }
        const base64 = image.data.toString("base64");
        const mtime = epochMs(image.updatedAt);
        return {
          status: "image",
          mimeType: image.mime ?? "image/png",
          bytes: image.bytes ?? Buffer.from(base64, "base64").length,
          base64,
          ...mtime != null && { mtime }
        };
      }
      if (relPath === MEMORY_INDEX_FILE) {
        if (!deps.listMemories) {
          return { status: "missing" };
        }
        const memories2 = await deps.listMemories(userId, ctx.memoryStoreId);
        const domains = await domainsOf(userId, ctx);
        const index = summarizeMemoryIndex(memories2, timezoneOf(ctx), (memory2) => {
          const folder = folderOf(domains, memory2.domainId);
          return folder ? `${folder}/` : "";
        });
        const content = buildMemoryIndexYaml(index.stable, index.today, index.tags);
        return { status: "text", content, bytes: Buffer.byteLength(content, "utf8") };
      }
      const target = memoryPathOf(relPath);
      if (!target || !deps.listMemories) {
        return { status: "missing" };
      }
      const memories = await deps.listMemories(userId, ctx.memoryStoreId);
      const memory = locate(memories, await domainsOf(userId, ctx), target);
      if (!memory) {
        return { status: "missing" };
      }
      return {
        status: "text",
        content: memory.value,
        bytes: Buffer.byteLength(memory.value, "utf8")
      };
    },
    async write(relPath, content, ctx) {
      const userId = userIdOf(ctx);
      if (!userId) {
        throw new Error("A logged-in user is required to write memories.");
      }
      if (imageTargetOf(relPath)) {
        throw new Error(
          "Indexed images are read-only. Delete one from the Memories panel instead."
        );
      }
      if (relPath === MEMORY_INDEX_FILE) {
        throw new Error("INDEX.yaml is read-only. Change stable memories from the Memories panel.");
      }
      const target = memoryPathOf(relPath);
      if (!target) {
        throw new Error(
          `"${relPath}" is not a valid memory file. Use a "<key>.md" file, or "<domain>/<key>.md" to write into a domain.`
        );
      }
      const domains = await domainsOf(userId, ctx);
      let domainId;
      if (target.domain) {
        const domain = findDomainFolder(domains, target.domain);
        if (!domain) {
          throw new Error(
            domains.length === 0 ? `"${relPath}" is not a valid memory file. Use a "<key>.md" file name without "/" in the key.` : `Unknown memory domain folder "${target.domain}". Create the domain first.`
          );
        }
        domainId = domain.id;
      } else if (deps.listMemories) {
        const memories = await deps.listMemories(userId, ctx.memoryStoreId);
        if (domains.length > 0 && !locate(memories, domains, target)) {
          throw new Error(
            `"${relPath}" names no memory domain. Write "<domain>/<key>.md" using one of: ${foldersOf(domains)}.`
          );
        }
      }
      if (!deps.setMemory) {
        throw new Error("Memory writing is not configured for this agent.");
      }
      const result = await deps.setMemory({
        userId,
        key: target.key,
        value: content,
        allowLocked: true,
        storeId: ctx.memoryStoreId,
        conversationId: ctx.conversationId,
        ...domainId != null ? { domainId } : {}
      });
      if (!result?.ok) {
        throw new Error(result?.reason ?? `Failed to set memory "${target.key}".`);
      }
      return { bytes: Buffer.byteLength(content, "utf8") };
    },
    async delete(relPath, ctx) {
      const userId = userIdOf(ctx);
      if (!userId) {
        throw new Error("A logged-in user is required to delete memories.");
      }
      if (imageTargetOf(relPath)) {
        throw new Error(
          "Indexed images are read-only here. Delete one from the Memories panel instead."
        );
      }
      if (relPath === MEMORY_INDEX_FILE) {
        throw new Error("INDEX.yaml is a read-only index and cannot be deleted.");
      }
      const target = memoryPathOf(relPath);
      if (!target) {
        throw new Error(`"${relPath}" is not a valid memory file.`);
      }
      if (deps.listMemories) {
        const memories = await deps.listMemories(userId, ctx.memoryStoreId);
        const memory = locate(memories, await domainsOf(userId, ctx), target);
        if (memory?.stable === true) {
          throw new Error(
            `Memory "${target.key}" is stable. Remove it from stable in the Memories panel before deleting.`
          );
        }
      }
      if (!deps.deleteMemory) {
        throw new Error("Memory deletion is not configured for this agent.");
      }
      const result = await deps.deleteMemory({
        userId,
        key: target.key,
        allowLocked: true,
        storeId: ctx.memoryStoreId
      });
      if (!result?.ok) {
        throw new Error(result?.reason ?? `Failed to delete memory "${target.key}".`);
      }
      return { ok: true };
    },
    /** Moves a memory file. Within one folder it is a rename; across folders
     *  the destination folder IS the new domain, so the move re-assigns the
     *  memory's domain (`setMemory` with that `domainId`) and only then drops
     *  the old key when the name changed too. */
    async move(relPath, destRelPath, ctx) {
      const userId = userIdOf(ctx);
      if (!userId) {
        throw new Error("A logged-in user is required to move memories.");
      }
      if (imageTargetOf(relPath) || imageTargetOf(destRelPath)) {
        throw new Error("Indexed images are read-only and cannot be moved.");
      }
      if (relPath === MEMORY_INDEX_FILE || destRelPath === MEMORY_INDEX_FILE) {
        throw new Error("INDEX.yaml is a read-only index and cannot be moved.");
      }
      const sourceTarget = memoryPathOf(relPath);
      if (!sourceTarget) {
        throw new Error(
          `"${relPath}" is not a valid memory file. Use a "<key>.md" file, or "<domain>/<key>.md".`
        );
      }
      const destTarget = memoryPathOf(destRelPath);
      if (!destTarget) {
        throw new Error(
          `"${destRelPath}" is not a valid memory file. Use a "<key>.md" file, or "<domain>/<key>.md".`
        );
      }
      if (sourceTarget.key === destTarget.key && (sourceTarget.domain ?? "") === (destTarget.domain ?? "")) {
        return { ok: true };
      }
      if (!deps.listMemories || !deps.setMemory || !deps.deleteMemory) {
        throw new Error("Memory moving is not configured for this agent.");
      }
      const memories = await deps.listMemories(userId, ctx.memoryStoreId);
      const domains = await domainsOf(userId, ctx);
      if (destTarget.domain && domains.length === 0) {
        throw new Error(
          `"${destRelPath}" is not a valid memory file. Use a "<key>.md" file name without "/" in the key.`
        );
      }
      const source = locate(memories, domains, sourceTarget);
      if (!source) {
        throw new Error(`Memory "${sourceTarget.key}" does not exist.`);
      }
      let destDomainId = source.domainId;
      if (destTarget.domain) {
        const destDomain = findDomainFolder(domains, destTarget.domain);
        if (!destDomain) {
          throw new Error(
            `Unknown memory domain folder "${destTarget.domain}". Create the domain first.`
          );
        }
        destDomainId = destDomain.id;
      }
      const renamed = sourceTarget.key !== destTarget.key;
      const moved = destDomainId !== source.domainId;
      if (!renamed && !moved) {
        return { ok: true };
      }
      if (renamed && source.stable === true) {
        throw new Error(
          `Memory "${sourceTarget.key}" is stable. Remove it from stable in the Memories panel before renaming.`
        );
      }
      const setResult = await deps.setMemory({
        userId,
        key: destTarget.key,
        value: source.value,
        allowLocked: true,
        storeId: ctx.memoryStoreId,
        conversationId: ctx.conversationId,
        ...destDomainId != null ? { domainId: destDomainId } : {}
      });
      if (!setResult?.ok) {
        throw new Error(setResult?.reason ?? `Failed to set memory "${destTarget.key}".`);
      }
      if (!renamed) {
        return { ok: true };
      }
      const deleteResult = await deps.deleteMemory({
        userId,
        key: sourceTarget.key,
        allowLocked: true,
        storeId: ctx.memoryStoreId
      });
      if (!deleteResult?.ok) {
        throw new Error(deleteResult?.reason ?? `Failed to delete memory "${sourceTarget.key}".`);
      }
      return { ok: true };
    },
    async search(params, ctx) {
      const userId = userIdOf(ctx);
      if (!userId || !deps.listMemories) {
        return { results: [], truncated: false };
      }
      const rx = new RegExp(params.pattern);
      const globRx = params.glob ? vfsGlobToRegex(params.glob) : null;
      const memories = await deps.listMemories(userId, ctx.memoryStoreId);
      const domains = await domainsOf(userId, ctx);
      const scope = params.path && params.path.length > 0 ? params.path : null;
      let scopeDomainId;
      let scopeKey = null;
      if (scope) {
        const parsed = memoryPathOf(scope);
        if (parsed) {
          scopeKey = parsed.key;
          if (parsed.domain) {
            const domain = findDomainFolder(domains, parsed.domain);
            if (!domain) {
              return { results: [], truncated: false };
            }
            scopeDomainId = domain.id;
          }
        } else {
          const domain = findDomainFolder(domains, scope.replace(/\/+$/, ""));
          if (!domain) {
            return { results: [], truncated: false };
          }
          scopeDomainId = domain.id;
        }
      }
      const results = [];
      let truncated = false;
      for (const memory of memories) {
        if (scopeDomainId != null && memory.domainId !== scopeDomainId) {
          continue;
        }
        if (scopeKey != null && memory.key !== scopeKey) {
          continue;
        }
        if (results.length >= params.maxResults) {
          truncated = true;
          break;
        }
        const name = relPathOf(domains, memory);
        if (globRx && !globRx.test(name)) {
          continue;
        }
        const lines = matchLines(memory.value, name, rx);
        for (const line of lines) {
          if (results.length >= params.maxResults) {
            truncated = true;
            break;
          }
          results.push(line);
        }
      }
      return { results, truncated };
    },
    async glob(params, ctx) {
      const userId = userIdOf(ctx);
      if (!userId || !deps.listMemories) {
        return { results: [], truncated: false };
      }
      const rx = vfsGlobToRegex(params.pattern);
      const memories = await deps.listMemories(userId, ctx.memoryStoreId);
      const domains = await domainsOf(userId, ctx);
      const results = [];
      let truncated = false;
      for (const memory of memories) {
        if (results.length >= params.maxResults) {
          truncated = true;
          break;
        }
        const name = relPathOf(domains, memory);
        if (rx.test(name)) {
          results.push(name);
        }
      }
      if (results.length < params.maxResults && rx.test(MEMORY_INDEX_FILE)) {
        results.push(MEMORY_INDEX_FILE);
      }
      return { results, truncated };
    }
  };
}
export {
  MEMORY_EXT,
  MEMORY_IMAGES_DIR,
  MEMORY_INDEX_FILE,
  MEMORY_INDEX_TAG_LIMIT,
  createMemoryProvider
};
