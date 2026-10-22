// domainTools
import { z } from "zod";
import { tool } from "@librechat/agents/langchain/tools";
import { MEMORY_DOMAIN_KINDS as MEMORY_DOMAIN_KINDS2 } from "librechat-data-provider";

// memoryDomains
import { MEMORY_DOMAIN_KINDS, MEMORY_DOMAIN_KIND_FRAMING } from "librechat-data-provider";
var toOption = (domain) => {
  const memoryCount = domain.memoryCount;
  return {
    id: String(domain._id),
    name: domain.name,
    kind: domain.kind,
    description: domain.description ?? "",
    ...typeof memoryCount === "number" ? { memoryCount } : {}
  };
};
function domainFraming(kind) {
  return MEMORY_DOMAIN_KIND_FRAMING[kind] ?? "memories of this domain";
}
function domainLabel(domain) {
  return `${domain.name}: ${domain.kind}`;
}
function findDomainByName(active, name) {
  if (typeof name !== "string" || name.trim() === "") {
    return void 0;
  }
  const wanted = name.trim().toLocaleLowerCase();
  return active.find((domain) => domain.name.toLocaleLowerCase() === wanted);
}
function writableDomainsHint(allowed) {
  return allowed.map((entry) => entry.name).join(", ");
}
function implicitWriteDomain(scope) {
  return scope.active.find((domain) => domain.id === scope.defaultDomain.id) ?? scope.active[0] ?? scope.defaultDomain;
}
function resolveWriteDomain(scope, name) {
  if (typeof name !== "string" || name.trim() === "") {
    return { domain: implicitWriteDomain(scope) };
  }
  const allowed = [...scope.active, ...scope.discovered ?? []];
  const domain = findDomainByName(allowed, name);
  if (domain) {
    return { domain };
  }
  const wanted = name.trim().toLocaleLowerCase();
  const isKind = MEMORY_DOMAIN_KINDS.includes(wanted);
  const kindMatches = isKind ? allowed.filter((entry) => entry.kind === wanted) : [];
  const fallback = kindMatches.length === 1 ? kindMatches[0] : implicitWriteDomain(scope);
  const reason = isKind ? `"${name.trim()}" is a domain KIND, not a name` : `"${name.trim()}" is not a domain on this run`;
  return {
    domain: fallback,
    substitution: `${reason}; the memory was filed into "${fallback.name}". Use one of these NAMES: ${writableDomainsHint(
      allowed
    )}.`
  };
}
async function resolveMemoryDomainScope({
  userId,
  storeId,
  conversationDomainIds,
  agentDomainIds,
  readOnly = false,
  methods
}) {
  const all = await methods.listMemoryDomains({ storeId });
  const migratedDefault = readOnly ? null : await methods.ensureDefaultMemoryDomain({ userId, storeId });
  const defaultDomain = migratedDefault ?? all.find((domain) => domain.isDefault === true) ?? null;
  if (!defaultDomain) {
    return {
      storeId,
      defaultDomain: { id: "", name: "", kind: "real", description: "" },
      active: [],
      domainIds: [],
      /** No domains to close: the store stays whole-store readable. */
      enabled: true
    };
  }
  const byId = new Map(all.map((domain) => [String(domain._id), domain]));
  byId.set(String(defaultDomain._id), defaultDomain);
  const defaultOption = toOption(byId.get(String(defaultDomain._id)) ?? defaultDomain);
  const storedSet = Array.isArray(conversationDomainIds);
  const requested = (storedSet ? conversationDomainIds : agentDomainIds) ?? [];
  const active = [];
  const requestedIds = requested.filter((id) => id != null && id !== "");
  if (!storedSet || requestedIds.some((id) => String(id) === defaultOption.id)) {
    active.push(defaultOption);
  }
  for (const id of requestedIds) {
    const domain = byId.get(String(id));
    if (domain && !active.some((entry) => entry.id === String(domain._id))) {
      active.push(toOption(domain));
    }
  }
  return {
    storeId,
    defaultDomain: defaultOption,
    active,
    domainIds: active.map((domain) => domain.id),
    enabled: active.length > 0
  };
}
function buildDomainKindLegend() {
  const lines = MEMORY_DOMAIN_KINDS.map((kind) => `- ${kind}: ${domainFraming(kind)}`);
  return `# Memory domain kinds
${lines.join("\n")}`;
}
function buildActiveDomainsBlock(scope) {
  if (scope.active.length === 0) {
    return "";
  }
  const lines = scope.active.map((domain) => {
    const description = domain.id !== scope.defaultDomain.id && domain.description ? ` ${domain.description}` : "";
    return `- ${domainLabel(domain)}${description}`;
  });
  return `Active memory domains:
${lines.join("\n")}`;
}

// domainTools
var SEARCH_DOMAINS_TOOL_NAME = "search_domains";
var CREATE_DOMAIN_TOOL_NAME = "create_domain";
var ACTIVATE_DOMAIN_TOOL_NAME = "activate_domain";
var DEACTIVATE_DOMAIN_TOOL_NAME = "deactivate_domain";
var MEMORY_DOMAIN_TOOL_NAMES = [
  SEARCH_DOMAINS_TOOL_NAME,
  CREATE_DOMAIN_TOOL_NAME,
  ACTIVATE_DOMAIN_TOOL_NAME,
  DEACTIVATE_DOMAIN_TOOL_NAME
];
var SEARCH_DOMAIN_LIMIT = 5;
var SEARCH_DOMAINS_DESCRIPTION = "Search memory domains by keyword; omit the query to browse all domains.";
var CREATE_DOMAIN_DESCRIPTION = "Create and activate a memory domain.";
var ACTIVATE_DOMAIN_DESCRIPTION = "Activate a memory domain.";
var DEACTIVATE_DOMAIN_DESCRIPTION = "Deactivate a memory domain.";
var NAME_PROPERTY = { type: "string" };
var MEMORY_DOMAIN_TOOL_DEFINITIONS = [
  {
    name: SEARCH_DOMAINS_TOOL_NAME,
    description: SEARCH_DOMAINS_DESCRIPTION,
    parameters: { type: "object", properties: { query: NAME_PROPERTY }, required: [] }
  },
  {
    name: CREATE_DOMAIN_TOOL_NAME,
    description: CREATE_DOMAIN_DESCRIPTION,
    parameters: {
      type: "object",
      properties: {
        name: NAME_PROPERTY,
        kind: { type: "string", enum: [...MEMORY_DOMAIN_KINDS2] },
        description: NAME_PROPERTY
      },
      required: ["name", "kind", "description"]
    }
  },
  {
    name: ACTIVATE_DOMAIN_TOOL_NAME,
    description: ACTIVATE_DOMAIN_DESCRIPTION,
    parameters: { type: "object", properties: { name: NAME_PROPERTY }, required: ["name"] }
  },
  {
    name: DEACTIVATE_DOMAIN_TOOL_NAME,
    description: DEACTIVATE_DOMAIN_DESCRIPTION,
    parameters: { type: "object", properties: { name: NAME_PROPERTY }, required: ["name"] }
  }
];
function describeDomain(domain, activeIds) {
  const count = domain.memoryCount == null ? "" : `, ${domain.memoryCount} memories`;
  const active = activeIds.has(domain.id) ? " [active]" : "";
  return `- ${domainLabel(domain)}${active}${count} \u2014 ${domain.description}`;
}
function scopeLine(scope) {
  const names = scope.active.map((domain) => domain.name).join(", ");
  return names ? `Active memory domains: ${names}` : "No active memory domains.";
}
function matchDomains(domains, query) {
  const needle = typeof query === "string" ? query.trim().toLocaleLowerCase() : "";
  if (needle === "") {
    return domains.slice(0, SEARCH_DOMAIN_LIMIT);
  }
  const words = needle.split(/\s+/).filter(Boolean);
  const scored = domains.map((domain) => {
    const haystack = `${domain.name} ${domain.kind} ${domain.description}`.toLocaleLowerCase();
    const hits = words.filter((word) => haystack.includes(word)).length;
    return { domain, hits };
  }).filter((entry) => entry.hits > 0).sort((a, b) => b.hits - a.hits);
  return scored.slice(0, SEARCH_DOMAIN_LIMIT).map((entry) => entry.domain);
}
function createMemoryDomainTools(deps, names = MEMORY_DOMAIN_TOOL_NAMES) {
  const activeIds = () => new Set(deps.getScope().active.map((domain) => domain.id));
  const searchDomains = tool(
    async ({ query }) => {
      try {
        const domains = await deps.listDomains();
        const matches = matchDomains(domains, query);
        if (matches.length === 0) {
          return "No memory domain matches.";
        }
        const active = activeIds();
        deps.onDomainsFound?.(matches);
        return matches.map((domain) => describeDomain(domain, active)).join("\n");
      } catch {
        return "Could not read memory domains.";
      }
    },
    {
      name: SEARCH_DOMAINS_TOOL_NAME,
      description: SEARCH_DOMAINS_DESCRIPTION,
      schema: z.object({ query: z.string().optional() })
    }
  );
  const createDomain = tool(
    async ({
      name,
      kind,
      description
    }) => {
      const result = await deps.createDomain({ name, kind, description });
      if (!result.ok) {
        return result.reason ?? "Could not create the memory domain.";
      }
      return `Memory domain "${name}" created and activated. ${scopeLine(
        result.scope ?? deps.getScope()
      )}`;
    },
    {
      name: CREATE_DOMAIN_TOOL_NAME,
      description: CREATE_DOMAIN_DESCRIPTION,
      schema: z.object({
        name: z.string(),
        kind: z.enum(MEMORY_DOMAIN_KINDS2),
        description: z.string()
      })
    }
  );
  const activateDomain = tool(
    async ({ name }) => {
      const result = await deps.activateDomain(name);
      if (!result.ok) {
        return result.reason ?? `Could not activate "${name}".`;
      }
      return `Memory domain "${name}" activated. ${scopeLine(result.scope ?? deps.getScope())}`;
    },
    {
      name: ACTIVATE_DOMAIN_TOOL_NAME,
      description: ACTIVATE_DOMAIN_DESCRIPTION,
      schema: z.object({ name: z.string() })
    }
  );
  const deactivateDomain = tool(
    async ({ name }) => {
      const result = await deps.deactivateDomain(name);
      if (!result.ok) {
        return result.reason ?? `Could not deactivate "${name}".`;
      }
      return `Memory domain "${name}" deactivated. ${scopeLine(result.scope ?? deps.getScope())}`;
    },
    {
      name: DEACTIVATE_DOMAIN_TOOL_NAME,
      description: DEACTIVATE_DOMAIN_DESCRIPTION,
      schema: z.object({ name: z.string() })
    }
  );
  return [searchDomains, createDomain, activateDomain, deactivateDomain].filter(
    (entry) => names.includes(entry.name)
  );
}

// domainRuntime
var toOption2 = (domain) => ({
  id: String(domain._id),
  name: domain.name,
  kind: domain.kind,
  description: domain.description ?? "",
  ...typeof domain.memoryCount === "number" ? { memoryCount: domain.memoryCount } : {}
});
function memoryDomainToolDefinitions() {
  return MEMORY_DOMAIN_TOOL_DEFINITIONS.map((definition) => ({
    name: definition.name,
    description: definition.description,
    parameters: definition.parameters
  }));
}
function isMemoryDomainToolName(name) {
  return MEMORY_DOMAIN_TOOL_NAMES.includes(name);
}
async function createMemoryDomainRuntime({
  userId,
  storeId,
  canWrite,
  agentDomainIds,
  toolNames = MEMORY_DOMAIN_TOOL_NAMES,
  extraDomains,
  deps
}) {
  const resolve = async () => resolveMemoryDomainScope({
    userId,
    storeId,
    conversationDomainIds: await deps.getConversationDomainIds(),
    agentDomainIds,
    readOnly: !canWrite,
    methods: deps.methods
  });
  const withExtras = (base) => {
    for (const domain of extraDomains ?? []) {
      if (base.active.some((entry) => entry.id === domain.id)) {
        continue;
      }
      base.active.push(domain);
      base.domainIds.push(domain.id);
    }
    if (base.active.length > 0) {
      base.enabled = true;
    }
    return base;
  };
  let scope = withExtras(await resolve());
  const discovered = [];
  const rememberDiscovered = (domains) => {
    for (const domain of domains) {
      const known = [...scope.active, ...discovered].some((entry) => entry.id === domain.id);
      if (!known) {
        discovered.push(domain);
      }
    }
    scope.discovered = discovered;
  };
  const listDomains = async () => {
    const domains = await deps.methods.listMemoryDomains({ storeId });
    return domains.map((domain) => toOption2(domain));
  };
  const applyActive = async (domainIds) => {
    await deps.setConversationDomainIds(domainIds);
    scope = await resolve();
    return scope;
  };
  const withScope = (next) => ({ ok: true, scope: next });
  const tools = createMemoryDomainTools(
    {
      getScope: () => scope,
      listDomains,
      onDomainsFound: rememberDiscovered,
      createDomain: async ({ name, kind, description }) => {
        if (!canWrite) {
          return { ok: false, reason: "This memory store is read-only." };
        }
        const created = await deps.methods.createMemoryDomain({
          userId,
          storeId,
          name,
          kind,
          description,
          createdBy: "agent"
        });
        if (!created.ok || !created.domain) {
          return { ok: false, reason: created.reason };
        }
        const option = toOption2(created.domain);
        if (!toolNames.includes(ACTIVATE_DOMAIN_TOOL_NAME)) {
          rememberDiscovered([option]);
          return withScope(scope);
        }
        const next = await applyActive([...scope.domainIds, option.id]);
        return withScope(next);
      },
      activateDomain: async (name) => {
        const all = await listDomains();
        const wanted = all.find(
          (domain) => domain.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase()
        );
        if (!wanted) {
          return { ok: false, reason: `No memory domain named "${name}".` };
        }
        if (scope.domainIds.includes(wanted.id)) {
          return withScope(scope);
        }
        const next = await applyActive([...scope.domainIds, wanted.id]);
        return withScope(next);
      },
      deactivateDomain: async (name) => {
        const all = await listDomains();
        const wanted = all.find(
          (domain) => domain.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase()
        );
        if (!wanted) {
          return { ok: false, reason: `No memory domain named "${name}".` };
        }
        const next = await applyActive(scope.domainIds.filter((id) => id !== wanted.id));
        return withScope(next);
      }
    },
    toolNames
  );
  return {
    scope,
    tools,
    definitions: memoryDomainToolDefinitions(),
    block: buildActiveDomainsBlock(scope)
  };
}
export {
  ACTIVATE_DOMAIN_TOOL_NAME,
  CREATE_DOMAIN_TOOL_NAME,
  DEACTIVATE_DOMAIN_TOOL_NAME,
  MEMORY_DOMAIN_TOOL_DEFINITIONS,
  MEMORY_DOMAIN_TOOL_NAMES,
  SEARCH_DOMAINS_TOOL_NAME,
  buildActiveDomainsBlock,
  buildDomainKindLegend,
  createMemoryDomainRuntime,
  createMemoryDomainTools,
  domainFraming,
  domainLabel,
  findDomainByName,
  implicitWriteDomain,
  isMemoryDomainToolName,
  memoryDomainToolDefinitions,
  resolveMemoryDomainScope,
  resolveWriteDomain
};
