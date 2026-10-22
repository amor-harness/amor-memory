/** RPC-backed hooks built on the app's React Query instance. */
import {
  currentApi,
  useMutation as useHostMutation,
  useQuery as useHostQuery,
  useQueryClient,
} from './runtime.js';

export function useRpc(method, params, enabled = true) {
  const result = useHostQuery({
    queryKey: [method, params ?? {}],
    queryFn: () => currentApi().call(method, params ?? {}),
    enabled,
  });
  return {
    data: result.data,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
    refetch: result.refetch,
  };
}

function useMutation(method, options = {}) {
  const queryClient = useQueryClient();
  const result = useHostMutation({
    mutationFn: (vars) => currentApi().call(method, vars ?? {}),
    onSuccess: (data) => {
      if (options.invalidate !== false) {
        queryClient.invalidateQueries();
      }
      options.onSuccess?.(data);
    },
    onError: (error) => options.onError?.(error),
  });
  return {
    mutate: (vars, local = {}) =>
      result.mutate(vars, {
        onSuccess: local.onSuccess,
        onError: local.onError,
      }),
    isLoading: result.isPending,
  };
}

export function useMemoriesQuery(storeId, options = {}) {
  const params = storeId ? { storeId } : {};
  const result = useRpc('memories.list', params, options.enabled !== false);
  return {
    data: result.data,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
    refetch: result.refetch,
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
  const result = useMutation('memories.permissions.set', {
    ...options,
    onSuccess: (data) => options.onSuccess?.(data),
  });
  return { ...result, isSuccess: false };
}
