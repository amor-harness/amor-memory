/** RPC-backed hooks built on the app's React Query instance. */
import {
  currentApi,
  useMutation as useHostMutation,
  useQuery as useHostQuery,
  useQueryClient,
} from './runtime.js';
import type { QueryResult } from './runtime.js';
import type {
  MemoryDomainKind,
  MemoryEvictionPreviewItem,
  TConversationMemory,
  TMemoryDomain,
  TMemoryStore,
  TMemoryVersion,
  TUserMemory,
} from './sdk.js';

export type TUserMemoryWithDomain = TUserMemory;

export type RpcParamValue = string | number | boolean | null | undefined | readonly string[];

export type RpcParams = Record<string, RpcParamValue>;

export interface RpcQueryOptions {
  enabled?: boolean;
}

export interface MemoriesListResult {
  storeId?: string;
  canWrite?: boolean;
  memories: TUserMemoryWithDomain[];
  totalTokens: number;
  tokenLimit: number | null;
  usagePercentage: number | null;
}

export interface MemoryStoresResult {
  stores: TMemoryStore[];
}

export interface MemoryDomainsResult {
  storeId?: string;
  canWrite?: boolean;
  domains: TMemoryDomain[];
  activeDomainIds?: string[];
}

export interface ConversationMemoriesResult {
  conversationId?: string;
  storeId?: string;
  memories: TConversationMemory[];
}

export interface MemoryVersionResult {
  key?: string;
  versions: TMemoryVersion[];
}

export interface MemoryImageResult {
  dataUrl: string;
  mime?: string;
  width?: number;
  height?: number;
}

export interface UserPreferencesResult {
  memories: boolean;
}

export interface CreateMemoryResult {
  ok?: boolean;
  created?: boolean;
  updated?: boolean;
  memory?: TUserMemory;
  evicted?: MemoryEvictionPreviewItem[];
}

export interface DeleteMemoryResult {
  ok?: boolean;
  deleted?: boolean;
}

export interface RestoreMemoryResult {
  ok?: boolean;
  memory: TUserMemory;
}

export interface MemoryRolePermissions {
  roleName?: string;
  permissions?: Record<string, boolean>;
}

export interface AdminPermissionsResult {
  roles?: MemoryRolePermissions[];
}

export interface MemoryPermissionsUpdate {
  roleName: string;
  updates: Record<string, boolean>;
}

export interface CreateMemoryDomainParams {
  name: string;
  kind: MemoryDomainKind;
  description: string;
  storeId?: string;
}

export interface UpdateMemoryDomainParams {
  domainId: string;
  storeId?: string;
  name: string;
  kind: MemoryDomainKind;
  description: string;
}

export function useRpc<TData>(
  method: string,
  params: RpcParams = {},
  enabled = true,
): QueryResult<TData> {
  const result = useHostQuery<TData>({
    queryKey: [method, params],
    queryFn: () => currentApi().call<TData>(method, params),
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

export interface MutationOptions<TData, TVariables> {
  invalidate?: boolean;
  onMutate?: (variables: TVariables) => void;
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error) => void;
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables) => void;
}

export interface LocalMutationCallbacks<TData> {
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
  onSettled?: () => void;
}

export interface DataMutation<TData, TVariables> {
  mutate: (variables: TVariables, local?: LocalMutationCallbacks<TData>) => void;
  isLoading: boolean;
  isSuccess: boolean | undefined;
  isError: boolean | undefined;
  error: Error | null | undefined;
  data: TData | undefined;
  reset: (() => void) | undefined;
  /** In-flight mutation variables, when the host mutation exposes them. */
  variables?: TVariables;
}

function useMutation<TData, TVariables>(
  method: string,
  options: MutationOptions<TData, TVariables> = {},
): DataMutation<TData, TVariables> {
  const queryClient = useQueryClient();
  const result = useHostMutation<TData, TVariables>({
    mutationFn: (variables) => currentApi().call<TData>(method, variables as object | undefined),
    onMutate: (variables) => options.onMutate?.(variables),
    onSuccess: (data, variables) => {
      if (options.invalidate !== false) {
        queryClient.invalidateQueries();
      }
      options.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      void variables;
      options.onError?.(error);
    },
    onSettled: (data, error, variables) => options.onSettled?.(data, error, variables),
  });
  return {
    mutate: (variables, local = {}) =>
      result.mutate(variables, {
        onSuccess: local.onSuccess,
        onError: local.onError,
        onSettled: local.onSettled,
      }),
    isLoading: result.isPending,
    isSuccess: result.isSuccess,
    isError: result.isError,
    error: result.error,
    data: result.data,
    reset: result.reset,
  };
}

export function useMemoriesQuery(
  storeId?: string,
  options: RpcQueryOptions = {},
): QueryResult<MemoriesListResult> {
  const params = storeId ? { storeId } : {};
  return useRpc<MemoriesListResult>('memories.list', params, options.enabled !== false);
}

export function useMemoryStoresQuery(): QueryResult<MemoryStoresResult> {
  return useRpc<MemoryStoresResult>('memories.stores', {});
}

export function useMemoryDomainsQuery(
  storeId?: string,
  conversationId?: string,
  options: RpcQueryOptions = {},
): QueryResult<MemoryDomainsResult> {
  const params = {
    ...(storeId ? { storeId } : {}),
    ...(conversationId ? { conversationId } : {}),
  };
  return useRpc<MemoryDomainsResult>('memories.domains', params, options.enabled !== false);
}

export interface GetUserResult {
  personalization: { memories: boolean };
}

export function useGetUserQuery(): { data: GetUserResult | undefined; isLoading: boolean } {
  const result = useRpc<UserPreferencesResult>('memories.preferences', {});
  return {
    data: result.data ? { personalization: { memories: result.data.memories } } : undefined,
    isLoading: result.isLoading,
  };
}

export function useConversationMemoriesQuery(
  conversationId?: string,
  storeId?: string,
  options: RpcQueryOptions = {},
): QueryResult<ConversationMemoriesResult> {
  const params = {
    ...(conversationId ? { conversationId } : {}),
    ...(storeId ? { storeId } : {}),
  };
  return useRpc<ConversationMemoriesResult>(
    'memories.conversation',
    params,
    Boolean(conversationId) && options.enabled !== false,
  );
}

export interface SetActiveDomainsParams {
  conversationId: string;
  storeId?: string;
  domainIds: string[];
}

export interface SetActiveDomainsResult {
  conversationId?: string;
  activeDomainIds: string[];
}

export const useSetMemoryDomainActiveMutation = (
  options: MutationOptions<SetActiveDomainsResult, SetActiveDomainsParams> = {},
) =>
  useMutation<SetActiveDomainsResult, SetActiveDomainsParams>(
    'memories.domains.setActive',
    options,
  );

export interface MemoryVersionsQueryResult {
  data: MemoryVersionResult | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function useMemoryVersionsQuery(
  key?: string,
  storeId?: string,
  options: RpcQueryOptions = {},
): MemoryVersionsQueryResult {
  const result = useRpc<MemoryVersionResult>(
    'memories.versions',
    { key, ...(storeId ? { storeId } : {}) },
    Boolean(key) && options.enabled !== false,
  );
  return { data: result.data, isLoading: result.isLoading, isError: result.isError };
}

export interface VFSImageSource {
  data: string | undefined;
  isLoading: boolean;
}

export function useVFSImageSrcQuery(
  value?: string | null,
  options: RpcQueryOptions = {},
): VFSImageSource {
  const isUrl = typeof value === 'string' && value.startsWith('/memory/images/');
  const enabled = Boolean(value) && options.enabled !== false;
  const result = useRpc<MemoryImageResult>(
    isUrl ? 'memories.image.url' : 'memories.image',
    isUrl ? { url: value } : { sha256: value },
    enabled,
  );
  return { data: result.data?.dataUrl, isLoading: result.isLoading };
}

export interface CreateMemoryParams {
  key: string;
  value: string;
  storeId?: string;
  domainId?: string;
  stable?: boolean;
  injection?: 'system' | 'additional';
  locked?: boolean;
  confirmEvict?: boolean;
}

export interface UpdateMemoryParams {
  key: string;
  value: string;
  storeId?: string;
  stable?: boolean;
  locked?: boolean;
  injection?: 'system' | 'additional';
  originalKey?: string;
  domainId?: string;
}

export interface DeleteMemoryParams {
  key: string;
  storeId?: string;
}

export interface DeleteMemoryImageParams {
  sha256: string;
  storeId?: string;
}

export interface CreateMemoryStoreParams {
  name: string;
}

export interface UpdateMemoryStoreParams {
  storeId: string;
  name: string;
}

export interface DeleteMemoryStoreParams {
  storeId: string;
}

export interface ClearMemoryStoreParams {
  storeId: string;
}

export interface DeleteMemoryDomainParams {
  domainId: string;
  storeId?: string;
  force: boolean;
}

export interface SetMemoryPreferencesParams {
  memories: boolean;
}

export interface RestoreMemoryVersionParams {
  key: string;
  versionId: string;
  storeId?: string;
}

export const useCreateMemoryMutation = (
  options: MutationOptions<CreateMemoryResult, CreateMemoryParams> = {},
) => useMutation<CreateMemoryResult, CreateMemoryParams>('memories.create', options);

export const useUpdateMemoryMutation = (
  options: MutationOptions<CreateMemoryResult, UpdateMemoryParams> = {},
) => useMutation<CreateMemoryResult, UpdateMemoryParams>('memories.update', options);

export const useDeleteMemoryMutation = (
  options: MutationOptions<DeleteMemoryResult, DeleteMemoryParams> = {},
) => useMutation<DeleteMemoryResult, DeleteMemoryParams>('memories.delete', options);

export const useDeleteMemoryImageMutation = (
  options: MutationOptions<DeleteMemoryResult, DeleteMemoryImageParams> = {},
) => useMutation<DeleteMemoryResult, DeleteMemoryImageParams>('memories.images.delete', options);

export const useCreateMemoryStoreMutation = (
  options: MutationOptions<TMemoryStore, CreateMemoryStoreParams> = {},
) => useMutation<TMemoryStore, CreateMemoryStoreParams>('memories.stores.create', options);

export const useUpdateMemoryStoreMutation = (
  options: MutationOptions<TMemoryStore, UpdateMemoryStoreParams> = {},
) => useMutation<TMemoryStore, UpdateMemoryStoreParams>('memories.stores.rename', options);

export const useDeleteMemoryStoreMutation = (
  options: MutationOptions<DeleteMemoryResult, DeleteMemoryStoreParams> = {},
) => useMutation<DeleteMemoryResult, DeleteMemoryStoreParams>('memories.stores.delete', options);

export const useClearMemoryStoreMutation = (
  options: MutationOptions<DeleteMemoryResult, ClearMemoryStoreParams> = {},
) => useMutation<DeleteMemoryResult, ClearMemoryStoreParams>('memories.stores.clear', options);

export const useCreateMemoryDomainMutation = (
  options: MutationOptions<TMemoryDomain, CreateMemoryDomainParams> = {},
) => useMutation<TMemoryDomain, CreateMemoryDomainParams>('memories.domains.create', options);

export const useUpdateMemoryDomainMutation = (
  options: MutationOptions<TMemoryDomain, UpdateMemoryDomainParams> = {},
) => useMutation<TMemoryDomain, UpdateMemoryDomainParams>('memories.domains.update', options);

export const useDeleteMemoryDomainMutation = (
  options: MutationOptions<DeleteMemoryResult, DeleteMemoryDomainParams> = {},
) => useMutation<DeleteMemoryResult, DeleteMemoryDomainParams>('memories.domains.delete', options);

export const useUpdateMemoryPreferencesMutation = (
  options: MutationOptions<UserPreferencesResult, SetMemoryPreferencesParams> = {},
) =>
  useMutation<UserPreferencesResult, SetMemoryPreferencesParams>(
    'memories.preferences.set',
    options,
  );

export const useRestoreMemoryVersionMutation = (
  options: MutationOptions<RestoreMemoryResult, RestoreMemoryVersionParams> = {},
) =>
  useMutation<RestoreMemoryResult, RestoreMemoryVersionParams>(
    'memories.versions.restore',
    options,
  );

export function useUpdateMemoryPermissionsMutation(
  options: MutationOptions<AdminPermissionsResult, MemoryPermissionsUpdate> = {},
): DataMutation<AdminPermissionsResult, MemoryPermissionsUpdate> {
  return useMutation<AdminPermissionsResult, MemoryPermissionsUpdate>(
    'memories.permissions.set',
    options,
  );
}
