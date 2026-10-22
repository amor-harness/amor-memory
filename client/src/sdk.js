/** Minimal stand-ins for the data-provider value imports the panel reads.
 *  Permission enums only travel into `useHasAccess`, which the plugin resolves
 *  from the RPC result, so their values are never branched on here. */
const passthrough = new Proxy(
  {},
  {
    get: (_target, key) => String(key),
  },
);

export const Permissions = passthrough;
export const PermissionTypes = passthrough;
export const ResourceType = passthrough;
export const QueryKeys = passthrough;
export const SystemRoles = passthrough;

export const MEMORY_DOMAIN_KINDS = ['real', 'fictional', 'project', 'sandbox', 'study', 'work'];
