/**
 * Transport options shared by the memory HTTP clients.
 *
 * The embedding and rerank endpoints speak the same API the hosted Jina
 * service does, so either one can be pointed at a remote deployment instead of
 * the local sidecar. That needs a bearer token, and on a network that cannot
 * reach the host directly, an HTTP proxy. Node's fetch ignores the usual
 * `http_proxy` environment variables, so a proxy has to be wired explicitly
 * through undici's dispatcher.
 *
 * Env: <prefix>_TOKEN, <prefix>_PROXY — e.g. MEMORY_EMBED_TOKEN,
 *      MEMORY_RERANK_PROXY.
 */
import { createRequire } from 'node:module';
import { logger } from '@amor-harness/data-schemas';

const require = createRequire(import.meta.url);

/** Structural view of undici's `ProxyAgent`, which only the host process has. */
type ProxyAgentConstructor = new (proxy: string) => object;

/** Headers and optional undici dispatcher for one endpoint family. */
export interface TransportOptions {
  headers: Record<string, string>;
  dispatcher?: object;
}

const agents = new Map<string, object>();
let proxyAgentClass: ProxyAgentConstructor | null | undefined;

/** Lazy so a build without undici still runs the local-service path. */
function loadProxyAgent(): ProxyAgentConstructor | null {
  try {
    const undici = require('undici') as { ProxyAgent?: ProxyAgentConstructor };
    return undici.ProxyAgent ?? null;
  } catch {
    return null;
  }
}

function proxyAgentFor(proxy: string | undefined): object | undefined {
  if (!proxy) {
    return undefined;
  }
  if (proxyAgentClass === undefined) {
    proxyAgentClass = loadProxyAgent();
  }
  if (!proxyAgentClass) {
    return undefined;
  }
  if (!agents.has(proxy)) {
    agents.set(proxy, new proxyAgentClass(proxy));
  }
  return agents.get(proxy);
}

/**
 * Headers and dispatcher for one endpoint family. `prefix` is the env prefix,
 * so `MEMORY_EMBED` yields `MEMORY_EMBED_TOKEN` / `MEMORY_EMBED_PROXY`.
 */
function transportFor(prefix: string): TransportOptions {
  const token = process.env[`${prefix}_TOKEN`];
  const proxy = process.env[`${prefix}_PROXY`];
  const headers: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
  const dispatcher = proxyAgentFor(proxy);
  return dispatcher ? { headers, dispatcher } : { headers };
}

const exported = { transportFor };

export { transportFor };
export default exported;
