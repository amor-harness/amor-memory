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
import { logger } from '@librechat/data-schemas';

const agents = new Map();
let proxyAgentClass;

/** Lazy so a build without undici still runs the local-service path. */
function proxyAgentFor(proxy) {
  if (!proxy) {
    return undefined;
  }
  if (proxyAgentClass === undefined) {
    proxyAgentClass = ProxyAgent ?? null;
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
function transportFor(prefix) {
  const token = process.env[`${prefix}_TOKEN`];
  const proxy = process.env[`${prefix}_PROXY`];
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  const dispatcher = proxyAgentFor(proxy);
  return dispatcher ? { headers, dispatcher } : { headers };
}

const exported = { transportFor };

export { transportFor };
export default exported;
