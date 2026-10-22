import { h, Fragment } from '../runtime.js';
import { useMemo, useState, useEffect } from '../runtime.js';
import { matchSorter } from '../utils.js';
import { makeIcon } from '../runtime.js';
const Plus = makeIcon('plus');
const Eraser = makeIcon('eraser');
const ChevronLeft = makeIcon('chevronLeft');
const FolderTree = makeIcon('folderTree');
import { SystemRoles, PermissionTypes, Permissions } from '../sdk.js';
import {
  Button,
  Checkbox,
  Skeleton,
  FilterInput,
  TooltipAnchor,
  OGDialogTrigger,
  ControlCombobox,
  useToastContext,
} from '../runtime.js';
import type { TUserMemory, TMemoryStore, TMemoryDomain } from '../sdk.js';

import {
  useUpdateMemoryPreferencesMutation,
  useMemoryStoresQuery,
  useMemoriesQuery,
  useMemoryDomainsQuery,
  useGetUserQuery,
} from '../data.js';
import type { TUserMemoryWithDomain } from '../data.js';
import { useLocalize, useAuthContext, useHasAccess } from '../runtime.js';
import MemoryDomainDeleteDialog from './MemoryDomainDeleteDialog.tsx';
import MemoryDomainDialog from './MemoryDomainDialog.tsx';
import MemoryStoreDeleteDialog from './MemoryStoreDeleteDialog.tsx';
import MemoryStoreClearDialog from './MemoryStoreClearDialog.tsx';
import MemoryDomainList from './MemoryDomainList.tsx';
import { PanelFooter, PanelContent } from '../runtime.js';
import MemoryCardSkeleton from './MemoryCardSkeleton.tsx';
import MemoryCreateDialog from './MemoryCreateDialog.tsx';
import MemoryStoreDialog from './MemoryStoreDialog.tsx';
import MemoryUsageBadge from './MemoryUsageBadge.tsx';
import MemoryStoreList from './MemoryStoreList.tsx';
import AdminSettings from './AdminSettings.tsx';
import MemoryList from './MemoryList.tsx';
import { cn } from '../utils.js';

/** Mirrors MemoryStoreList rows so the store list keeps its layout while loading. */
function MemoryStoreListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-lg border border-border-light px-3 py-3">
          <Skeleton className="h-4 w-40 rounded" />
        </div>
      ))}
    </div>
  );
}

export default function MemoryPanel() {
  const localize = useLocalize();
  const { user } = useAuthContext();
  const { data: userData } = useGetUserQuery();
  const { data: storesData, isLoading: storesLoading } = useMemoryStoresQuery();
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const { data: memData, isLoading: memoriesLoading } = useMemoriesQuery(
    selectedStoreId ?? undefined,
    { enabled: selectedStoreId != null },
  );
  const { showToast } = useToastContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [storeSearchQuery, setStoreSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);
  const [storeToRename, setStoreToRename] = useState<TMemoryStore | null>(null);
  const [storeToDelete, setStoreToDelete] = useState<TMemoryStore | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [referenceSavedMemories, setReferenceSavedMemories] = useState(true);
  /** The store's domains are a second view inside the memory view: the panel
   *  shows the memories, then their domains, without leaving the store. */
  const [showDomains, setShowDomains] = useState(false);
  const [domainDialogOpen, setDomainDialogOpen] = useState(false);
  const [domainToEdit, setDomainToEdit] = useState<TMemoryDomain | null>(null);
  const [domainToDelete, setDomainToDelete] = useState<TMemoryDomain | null>(null);
  /** `null` = every domain of the store. */
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);

  const { data: domainsData, isLoading: domainsLoading } = useMemoryDomainsQuery(
    selectedStoreId ?? undefined,
    undefined,
    { enabled: selectedStoreId != null },
  );

  const updateMemoryPreferencesMutation = useUpdateMemoryPreferencesMutation({
    onSuccess: () => {
      showToast({
        message: localize('com_ui_preferences_updated'),
        status: 'success',
      });
    },
    onError: () => {
      showToast({
        message: localize('com_ui_error_updating_preferences'),
        status: 'error',
      });
      setReferenceSavedMemories((prev) => !prev);
    },
  });

  useEffect(() => {
    if (userData?.personalization?.memories !== undefined) {
      setReferenceSavedMemories(userData.personalization.memories);
    }
  }, [userData?.personalization?.memories]);

  const handleMemoryToggle = (checked: boolean) => {
    setReferenceSavedMemories(checked);
    updateMemoryPreferencesMutation.mutate({ memories: checked });
  };

  const hasReadAccess = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.READ,
  });

  const hasUpdateAccess = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.UPDATE,
  });

  const hasCreateAccess = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.CREATE,
  });

  const hasOptOutAccess = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.OPT_OUT,
  });

  const hasShareAccess = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.SHARE,
  });

  const stores = useMemo(() => {
    const list = storesData?.stores ?? [];
    /** Owned stores lead the list; the backend keeps a stable order within each group. */
    return [...list].sort((a, b) => Number(b.isOwner) - Number(a.isOwner));
  }, [storesData]);

  const filteredStores = useMemo(() => {
    if (storeSearchQuery.trim() === '') {
      return stores;
    }
    return matchSorter(stores, storeSearchQuery, { keys: ['name', 'ownerName'] });
  }, [stores, storeSearchQuery]);

  const selectedStore = useMemo(
    () => stores.find((store) => store.id === selectedStoreId) ?? null,
    [stores, selectedStoreId],
  );

  const domains: TMemoryDomain[] = useMemo(() => domainsData?.domains ?? [], [domainsData]);

  /** A card's domain chip needs the kind, which the memory row does not carry. */
  const domainsById = useMemo(
    () => new Map(domains.map((domain) => [domain.id, domain])),
    [domains],
  );

  /** The domain filter: every domain of the store, each with its memory count. */
  const domainFilterItems: OptionWithIcon[] = useMemo(
    () => [
      { label: localize('com_ui_memory_domain_all'), value: '' },
      ...domains.map((domain) => ({
        label: `${domain.name} · ${localize('com_ui_memories_count', {
          0: domain.memoryCount ?? 0,
        })}`,
        value: domain.id,
      })),
    ],
    [domains, localize],
  );

  const selectedDomain = useMemo(
    () => domains.find((domain) => domain.id === selectedDomainId) ?? null,
    [domains, selectedDomainId],
  );

  /** A domain deleted elsewhere (or belonging to another store) must not leave
   *  the memory list filtered by something that no longer exists. */
  useEffect(() => {
    if (selectedDomainId != null && !domainsLoading && selectedDomain == null) {
      setSelectedDomainId(null);
    }
  }, [selectedDomainId, selectedDomain, domainsLoading]);

  /** A store deleted elsewhere must not leave the panel on a dangling memory list. */
  useEffect(() => {
    if (selectedStoreId != null && stores.length > 0 && selectedStore == null) {
      setSelectedStoreId(null);
    }
  }, [selectedStoreId, stores, selectedStore]);

  const memories: TUserMemoryWithDomain[] = useMemo(() => {
    const list: TUserMemoryWithDomain[] = memData?.memories ?? [];
    /** Stable memories lead the list; within each group sort newest first. */
    return [...list].sort((a, b) => {
      const stableDelta = Number(b.stable === true) - Number(a.stable === true);
      if (stableDelta !== 0) {
        return stableDelta;
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [memData]);

  const domainMemories = useMemo(
    () =>
      selectedDomainId == null
        ? memories
        : memories.filter((memory) => memory.domainId === selectedDomainId),
    [memories, selectedDomainId],
  );

  const filteredMemories = useMemo(() => {
    if (searchQuery.trim() === '') {
      return domainMemories;
    }
    return matchSorter(domainMemories, searchQuery, {
      /** Tags are matched as one searchable string: match-sorter reads a key's
       *  value as text, so the array is joined rather than handed over as is. */
      keys: ['key', 'value', (memory: TUserMemory) => (memory.tags ?? []).join(' ')],
    });
  }, [domainMemories, searchQuery]);

  if (!hasReadAccess) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <div className="text-center">
          <p className="text-sm text-text-secondary">{localize('com_ui_no_read_access')}</p>
        </div>
      </div>
    );
  }

  const tokenLimit = memData?.tokenLimit ?? null;
  const showUsageBadge = tokenLimit != null;
  const isMemoryView = selectedStore != null;
  const isDomainView = isMemoryView && showDomains;
  /** Shared stores are writable for editors; the server can revoke it per store. */
  const canWrite = selectedStore?.canWrite !== false && memData?.canWrite !== false;

  const handleSelectStore = (store: TMemoryStore) => {
    setSearchQuery('');
    setStoreSearchQuery('');
    setSelectedDomainId(null);
    setShowDomains(false);
    setSelectedStoreId(store.id);
  };

  const handleBackToStores = () => {
    setSearchQuery('');
    setStoreSearchQuery('');
    setSelectedDomainId(null);
    setShowDomains(false);
    setSelectedStoreId(null);
  };

  /** Opening a domain from the domain list filters the memories by it. */
  const handleSelectDomain = (domain: TMemoryDomain) => {
    setSelectedDomainId(domain.id);
    setSearchQuery('');
    setShowDomains(false);
  };

  const handleStoreDeleted = (storeId: string) => {
    if (storeId === selectedStoreId) {
      setSelectedStoreId(null);
    }
  };

  const memoryToggle = hasOptOutAccess ? (
    <Button
      size="sm"
      variant="outline"
      className={cn(
        isMemoryView && showUsageBadge && 'ml-auto',
        isMemoryView && !showUsageBadge && 'w-full',
        !isMemoryView && !hasCreateAccess && 'w-full',
        referenceSavedMemories && 'bg-surface-hover hover:bg-surface-hover',
      )}
      onClick={() => handleMemoryToggle(!referenceSavedMemories)}
      aria-label={localize('com_ui_use_memory')}
      aria-pressed={referenceSavedMemories}
      disabled={updateMemoryPreferencesMutation.isLoading}
    >
      <Checkbox
        checked={referenceSavedMemories}
        tabIndex={-1}
        aria-hidden="true"
        aria-label={localize('com_ui_use_memory')}
        className="pointer-events-none"
      />
      {localize('com_ui_use_memory')}
    </Button>
  ) : null;

  /** Inside a store the global toggle gives way to a store-scoped clear action. */
  const clearStoreControl =
    canWrite && hasUpdateAccess && memories.length > 0 ? (
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 gap-1.5 bg-transparent"
        onClick={() => setClearDialogOpen(true)}
        aria-label={localize('com_ui_memory_store_clear')}
      >
        <Eraser className="size-4" aria-hidden="true" />
        {localize('com_ui_memory_store_clear')}
      </Button>
    ) : null;

  return (
    <div
      role="region"
      aria-label={localize('com_ui_memories')}
      className="flex h-full w-full flex-col overflow-hidden pt-2"
    >
      {/* Sticky header: back + store name + create, or the store-list controls */}
      <div className="shrink-0 space-y-2 px-3 pb-2">
        {isDomainView ? (
          <div className="flex items-center gap-2">
            <TooltipAnchor
              description={localize('com_ui_back')}
              side="bottom"
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0 bg-transparent"
                  aria-label={localize('com_ui_back')}
                  onClick={() => setShowDomains(false)}
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </Button>
              }
            />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">
              {localize('com_ui_memory_domains')}
            </span>
            {hasCreateAccess && canWrite && (
              <TooltipAnchor
                description={localize('com_ui_memory_domain_create')}
                side="bottom"
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0 bg-transparent"
                    aria-label={localize('com_ui_memory_domain_create')}
                    onClick={() => setDomainDialogOpen(true)}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </Button>
                }
              />
            )}
          </div>
        ) : isMemoryView ? (
          <>
            <div className="flex items-center gap-2">
              <TooltipAnchor
                description={localize('com_ui_back_to_memory_stores')}
                side="bottom"
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0 bg-transparent"
                    aria-label={localize('com_ui_back_to_memory_stores')}
                    onClick={handleBackToStores}
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </Button>
                }
              />
              <span
                className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary"
                title={selectedStore.name}
              >
                {selectedStore.name}
              </span>
              {/* Browsing a store's domains is a read: a shared store's viewer
                  sees them too, while the domain view keeps every write action
                  behind `canManage`. */}
              {domains.length > 0 && (
                <TooltipAnchor
                  description={localize('com_ui_memory_domains')}
                  side="bottom"
                  render={
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 shrink-0 bg-transparent"
                      aria-label={localize('com_ui_memory_domains')}
                      onClick={() => setShowDomains(true)}
                    >
                      <FolderTree className="size-4" aria-hidden="true" />
                    </Button>
                  }
                />
              )}
              {hasCreateAccess && canWrite && (
                <MemoryCreateDialog
                  open={createDialogOpen}
                  onOpenChange={setCreateDialogOpen}
                  storeId={selectedStore.id}
                >
                  <OGDialogTrigger asChild>
                    <TooltipAnchor
                      description={localize('com_ui_create_memory')}
                      side="bottom"
                      render={
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-9 shrink-0 bg-transparent"
                          aria-label={localize('com_ui_create_memory')}
                          onClick={() => setCreateDialogOpen(true)}
                        >
                          <Plus className="size-4" aria-hidden="true" />
                        </Button>
                      }
                    />
                  </OGDialogTrigger>
                </MemoryCreateDialog>
              )}
            </div>

            <FilterInput
              inputId="memory-search"
              label={localize('com_ui_memories_filter')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              containerClassName="w-full"
            />

            {/* The domain filter is only meaningful once a store holds more
                than one: a single domain is the whole list. */}
            {domains.length > 1 && (
              <ControlCombobox
                isCollapsed={false}
                ariaLabel={localize('com_ui_memory_domain_filter')}
                selectedValue={selectedDomainId ?? ''}
                displayValue={selectedDomain?.name ?? localize('com_ui_memory_domain_all')}
                setValue={(value) => setSelectedDomainId(value === '' ? null : value)}
                selectPlaceholder={localize('com_ui_memory_domain_all')}
                searchPlaceholder={localize('com_ui_search_memory_domains')}
                items={domainFilterItems}
                className="h-9 border-border-light"
                containerClassName="w-full px-0"
              />
            )}

            {(showUsageBadge || clearStoreControl != null) && (
              <div className="flex items-center justify-between gap-2">
                {showUsageBadge && (
                  <MemoryUsageBadge
                    percentage={memData?.usagePercentage ?? 0}
                    tokenLimit={tokenLimit}
                    totalTokens={memData?.totalTokens ?? 0}
                  />
                )}
                {clearStoreControl}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              {memoryToggle}
              {hasCreateAccess && (
                <TooltipAnchor
                  description={localize('com_ui_create_memory_store')}
                  side="bottom"
                  render={
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 shrink-0 bg-transparent"
                      aria-label={localize('com_ui_create_memory_store')}
                      onClick={() => setStoreDialogOpen(true)}
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </Button>
                  }
                />
              )}
            </div>
            <FilterInput
              inputId="memory-store-search"
              label={localize('com_ui_search_memory_stores')}
              value={storeSearchQuery}
              onChange={(e) => setStoreSearchQuery(e.target.value)}
              containerClassName="w-full"
            />
          </>
        )}
      </div>

      {isMemoryView && !canWrite && (
        <p className="shrink-0 px-3 pb-2 text-xs text-text-secondary">
          {localize('com_ui_memory_store_shared_readonly')}
        </p>
      )}

      {/* Only the list scrolls */}
      {isDomainView ? (
        <PanelContent
          isLoading={domainsLoading}
          skeleton={<MemoryStoreListSkeleton />}
          className="px-3 pb-3"
        >
          <MemoryDomainList
            domains={domains}
            canManage={hasUpdateAccess && canWrite}
            onSelect={handleSelectDomain}
            onEdit={setDomainToEdit}
            onDelete={setDomainToDelete}
          />
        </PanelContent>
      ) : isMemoryView ? (
        <PanelContent
          isLoading={memoriesLoading}
          skeleton={<MemoryCardSkeleton />}
          className="px-3 pb-3"
        >
          <MemoryList
            memories={filteredMemories}
            hasUpdateAccess={hasUpdateAccess}
            isFiltered={searchQuery.length > 0}
            storeId={selectedStore.id}
            readOnly={!canWrite}
            domainsById={domainsById}
          />
        </PanelContent>
      ) : (
        <PanelContent
          isLoading={storesLoading}
          skeleton={<MemoryStoreListSkeleton />}
          className="px-3 pb-3"
        >
          <MemoryStoreList
            stores={filteredStores}
            selectedStoreId={selectedStoreId}
            canManage={hasUpdateAccess}
            canShare={hasShareAccess}
            isFiltered={storeSearchQuery.trim() !== ''}
            onSelect={handleSelectStore}
            onRename={setStoreToRename}
            onDelete={setStoreToDelete}
          />
        </PanelContent>
      )}

      <AdminSettings />

      <MemoryStoreDialog open={storeDialogOpen} onOpenChange={setStoreDialogOpen} />
      <MemoryStoreDialog
        open={storeToRename != null}
        onOpenChange={(open) => {
          if (!open) {
            setStoreToRename(null);
          }
        }}
        store={storeToRename}
      />
      <MemoryStoreClearDialog
        open={clearDialogOpen}
        onOpenChange={setClearDialogOpen}
        store={selectedStore}
      />
      <MemoryDomainDialog
        open={domainDialogOpen}
        onOpenChange={setDomainDialogOpen}
        storeId={selectedStore?.id}
      />
      <MemoryDomainDialog
        open={domainToEdit != null}
        onOpenChange={(open) => {
          if (!open) {
            setDomainToEdit(null);
          }
        }}
        storeId={selectedStore?.id}
        domain={domainToEdit}
      />
      <MemoryDomainDeleteDialog
        open={domainToDelete != null}
        onOpenChange={(open) => {
          if (!open) {
            setDomainToDelete(null);
          }
        }}
        domain={domainToDelete}
        storeId={selectedStore?.id}
        onDeleted={(domainId) => {
          if (domainId === selectedDomainId) {
            setSelectedDomainId(null);
          }
        }}
      />
      <MemoryStoreDeleteDialog
        open={storeToDelete != null}
        onOpenChange={(open) => {
          if (!open) {
            setStoreToDelete(null);
          }
        }}
        store={storeToDelete}
        onDeleted={handleStoreDeleted}
      />
    </div>
  );
}
