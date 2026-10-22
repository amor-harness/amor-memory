/** RPC-backed stand-ins for the app's React Query hooks, shaped so the ported
 *  panel code can stay close to the original. */
import { currentApi, setInvalidateAll, useEffect, useState } from './runtime.js';

let revision = 0;
const listeners = new Set();

export function bump() {
  revision += 1;
  for (const listener of listeners) {
    listener();
  }
}

setInvalidateAll(bump);

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function useRevision() {
  const [value, setValue] = useState(revision);
  useEffect(() => subscribe(() => setValue(revision)), []);
  return value;
}

export function useRpc(method, params, enabled = true) {
  const api = currentApi();
  const version = useRevision();
  const [state, setState] = useState({ data: undefined, isLoading: enabled, isError: false, error: null });
  const paramsKey = JSON.stringify(params ?? {});

  useEffect(() => {
    if (!enabled) {
      setState({ data: undefined, isLoading: false, isError: false, error: null });
      return undefined;
    }
    let cancelled = false;
    setState((current) => ({ ...current, isLoading: true }));
    api
      .call(method, params ?? {})
      .then((data) => {
        if (!cancelled) {
          setState({ data, isLoading: false, isError: false, error: null });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({ data: undefined, isLoading: false, isError: true, error });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [method, paramsKey, enabled, version]);

  return state;
}

function useMutation(method, options = {}) {
  const api = currentApi();
  const [isLoading, setLoading] = useState(false);
  const mutate = (vars, local = {}) => {
    setLoading(true);
    api
      .call(method, vars ?? {})
      .then((data) => {
        setLoading(false);
        bump();
        options.onSuccess?.(data);
        local.onSuccess?.(data);
      })
      .catch((error) => {
        setLoading(false);
        options.onError?.(error);
        local.onError?.(error);
      });
  };
  return { mutate, isLoading };
}

export function useMemoriesQuery(storeId, options = {}) {
  const params = storeId ? { storeId } : {};
  const result = useRpc('memories.list', params, options.enabled !== false);
  return {
    data: result.data,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
    refetch: () => bump(),
  };
}

export function useMemoryStoresQuery() {
  const result = useRpc('memories.stores', {});
  return { data: result.data, isLoading: result.isLoading, isError: result.isError };
}

export function useMemoryDomainsQuery(storeId, conversationId, options = {}) {
  const params = { ...(storeId ? { storeId } : {}), ...(conversationId ? { conversationId } : {}) };
  const result = useRpc('memories.domains', params, options.enabled !== false);
  return { data: result.data, isLoading: result.isLoading, isError: result.isError };
}

export function useGetUserQuery() {
  const result = useRpc('memories.preferences', {});
  return {
    data: result.data ? { personalization: { memories: result.data.memories } } : undefined,
    isLoading: result.isLoading,
  };
}

export function useConversationMemoriesQuery(conversationId, storeId, options = {}) {
  const params = {
    ...(conversationId ? { conversationId } : {}),
    ...(storeId ? { storeId } : {}),
  };
  const result = useRpc(
    'memories.conversation',
    params,
    Boolean(conversationId) && options.enabled !== false,
  );
  return { data: result.data, isLoading: result.isLoading, isError: result.isError };
}

export function useSetMemoryDomainActiveMutation(options) {
  return useMutation('memories.domains.setActive', options);
}

export function useMemoryVersionsQuery(key, storeId, options = {}) {
  const result = useRpc(
    'memories.versions',
    { key, ...(storeId ? { storeId } : {}) },
    Boolean(key) && options.enabled !== false,
  );
  return { data: result.data, isLoading: result.isLoading };
}

export function useVFSImageSrcQuery(value, options = {}) {
  const isUrl = typeof value === 'string' && value.startsWith('/memory/images/');
  const enabled = Boolean(value) && options.enabled !== false;
  const result = useRpc(
    isUrl ? 'memories.image.url' : 'memories.image',
    isUrl ? { url: value } : { sha256: value },
    enabled,
  );
  return { data: result.data?.dataUrl, isLoading: result.isLoading };
}

export const useCreateMemoryMutation = (options) => useMutation('memories.create', options);
export const useUpdateMemoryMutation = (options) => useMutation('memories.update', options);
export const useDeleteMemoryMutation = (options) => useMutation('memories.delete', options);
export const useDeleteMemoryImageMutation = (options) => useMutation('memories.images.delete', options);
export const useCreateMemoryStoreMutation = (options) => useMutation('memories.stores.create', options);
export const useUpdateMemoryStoreMutation = (options) => useMutation('memories.stores.rename', options);
export const useDeleteMemoryStoreMutation = (options) => useMutation('memories.stores.delete', options);
export const useClearMemoryStoreMutation = (options) => useMutation('memories.stores.clear', options);
export const useCreateMemoryDomainMutation = (options) => useMutation('memories.domains.create', options);
export const useUpdateMemoryDomainMutation = (options) => useMutation('memories.domains.update', options);
export const useDeleteMemoryDomainMutation = (options) => useMutation('memories.domains.delete', options);
export const useUpdateMemoryPreferencesMutation = (options) =>
  useMutation('memories.preferences.set', options);
export const useRestoreMemoryVersionMutation = (options) =>
  useMutation('memories.versions.restore', options);

export function useUpdateMemoryPermissionsMutation(options = {}) {
  const api = currentApi();
  const [state, setState] = useState({ isLoading: false, isSuccess: false });
  const mutate = (vars) => {
    setState({ isLoading: true, isSuccess: false });
    api
      .call('memories.permissions.set', {
        roleName: vars.roleName,
        updates: vars.updates,
      })
      .then(() => {
        setState({ isLoading: false, isSuccess: true });
        options.onSuccess?.();
      })
      .catch((error) => {
        setState({ isLoading: false, isSuccess: false });
        options.onError?.(error);
      });
  };
  return { ...state, mutate };
}
