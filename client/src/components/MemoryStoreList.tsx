import { h, Fragment } from '../runtime.js';
import { useTranslation } from '../runtime.js';
import { useQueryClient } from '../runtime.js';
import { makeIcon } from '../runtime.js';
const Database = makeIcon('database');
const Pencil = makeIcon('pencil');
const Share2 = makeIcon('share');
const Trash = makeIcon('trash');
import { TooltipAnchor } from '../runtime.js';
import { QueryKeys, ResourceType } from '../sdk.js';
import type { TMemoryStore } from '../sdk.js';
import { GenericGrantAccessDialog } from '../runtime.js';
import { useLocalize } from '../runtime.js';
import { getMessageTimestamp, cn } from '../utils.js';

const ACTION_BUTTON_CLASS =
  'inline-flex size-7 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-surface-active hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy';

/** Mirrors the memory card badges so both lists read the same. */
const BADGE_CLASS =
  'shrink-0 rounded-full border border-border-medium bg-surface-tertiary px-2 py-0.5 text-xs font-medium text-text-primary';

/** The default store's badge is a status, so it carries the heavier border a
 *  stable memory's card does. */
const DEFAULT_BADGE_CLASS = cn(BADGE_CLASS, 'border-border-heavy');

interface MemoryStoreRowProps {
  store: TMemoryStore;
  isSelected: boolean;
  /** Owners still need MEMORIES UPDATE to rename or delete. */
  canManage: boolean;
  /** Owners still need MEMORIES SHARE to open the sharing dialog. */
  canShare: boolean;
  onSelect: (store: TMemoryStore) => void;
  onRename: (store: TMemoryStore) => void;
  onDelete: (store: TMemoryStore) => void;
}

function MemoryStoreRow({
  store,
  isSelected,
  canManage,
  canShare,
  onSelect,
  onRename,
  onDelete,
}: MemoryStoreRowProps) {
  const localize = useLocalize();
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const shared = !store.isOwner;
  /** Locale-aware relative time; null for a missing or unusable timestamp. */
  const updated = getMessageTimestamp(store.updated_at, locale)?.relative ?? '';

  return (
    <div
      className={cn(
        /** The action group only shares the title row, so the stat lines below
         *  can span the full card width instead of wrapping early. */
        'relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1 gap-y-0.5 rounded-lg border px-1.5 py-1.5 transition-colors',
        isSelected
          ? 'border-border-heavy bg-surface-active'
          : 'border-border-light bg-surface-secondary/50 hover:bg-surface-hover',
      )}
    >
      {/* Stretched target so the whole card opens the store, bar the actions. */}
      <button
        type="button"
        onClick={() => onSelect(store)}
        aria-current={isSelected ? 'true' : undefined}
        aria-label={store.name}
        className="absolute inset-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy"
      />
      <div className="pointer-events-none col-start-1 row-start-1 flex min-w-0 items-center gap-2 px-1.5 py-0.5">
        <Database className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
        <span className="truncate text-sm font-medium text-text-primary">{store.name}</span>
        {store.isDefault === true && (
          <span className={DEFAULT_BADGE_CLASS}>{localize('com_ui_memory_store_default')}</span>
        )}
        {shared && (
          <span className={BADGE_CLASS}>
            {store.accessLevel === 'editor'
              ? localize('com_ui_role_editor')
              : localize('com_ui_role_viewer')}
          </span>
        )}
        {shared && store.ownerName != null && store.ownerName !== '' && (
          <span className="truncate text-xs text-text-secondary">{store.ownerName}</span>
        )}
      </div>
      <span className="pointer-events-none col-span-2 row-start-2 flex items-center gap-1.5 pl-6 text-xs text-text-secondary">
        <span>
          {localize('com_ui_memories_count', {
            0: store.memoryCount.toLocaleString(locale),
          })}
        </span>
        <span aria-hidden="true">·</span>
        <span>{`${store.totalTokens.toLocaleString(locale)} ${localize('com_ui_tokens')}`}</span>
      </span>
      {updated !== '' && (
        <span className="pointer-events-none col-span-2 row-start-3 pl-6 text-xs text-text-secondary">
          {localize('com_ui_memory_store_updated', { 0: updated })}
        </span>
      )}
      {store.isOwner && (canManage || canShare) && (
        <div className="relative z-10 col-start-2 row-start-1 flex shrink-0 items-center gap-0.5">
          {canManage && (
            <TooltipAnchor
              description={localize('com_ui_rename')}
              side="bottom"
              render={
                <button
                  type="button"
                  className={ACTION_BUTTON_CLASS}
                  aria-label={`${localize('com_ui_rename')}: ${store.name}`}
                  onClick={() => onRename(store)}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </button>
              }
            />
          )}
          {canShare && (
            <GenericGrantAccessDialog
              resourceDbId={store.id}
              resourceName={store.name}
              resourceType={ResourceType.MEMORYSTORE}
              onGrantAccess={() =>
                queryClient.invalidateQueries({ queryKey: [QueryKeys.memoryStores] })
              }
            >
              <TooltipAnchor
                description={localize('com_ui_share')}
                side="bottom"
                render={
                  <button
                    type="button"
                    className={cn(ACTION_BUTTON_CLASS, 'relative')}
                    aria-label={`${localize('com_ui_share')}: ${store.name}`}
                  >
                    <Share2 className="size-4" aria-hidden="true" />
                    {store.isShared && (
                      <span
                        className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-status-info ring-2 ring-presentation"
                        data-testid="memory-store-shared-indicator"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                }
              />
            </GenericGrantAccessDialog>
          )}
          {canManage && store.isDefault !== true && (
            <TooltipAnchor
              description={localize('com_ui_delete')}
              side="bottom"
              render={
                <button
                  type="button"
                  className={cn(ACTION_BUTTON_CLASS, 'hover:text-text-destructive')}
                  aria-label={`${localize('com_ui_delete')}: ${store.name}`}
                  onClick={() => onDelete(store)}
                >
                  <Trash className="size-4" aria-hidden="true" />
                </button>
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

interface MemoryStoreListProps {
  stores: TMemoryStore[];
  selectedStoreId: string | null;
  canManage: boolean;
  canShare: boolean;
  /** A store-name filter is active, so an empty list is not an empty account. */
  isFiltered?: boolean;
  onSelect: (store: TMemoryStore) => void;
  onRename: (store: TMemoryStore) => void;
  onDelete: (store: TMemoryStore) => void;
}

export default function MemoryStoreList({
  stores,
  selectedStoreId,
  canManage,
  canShare,
  isFiltered = false,
  onSelect,
  onRename,
  onDelete,
}: MemoryStoreListProps) {
  const localize = useLocalize();

  if (stores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border-light p-6 text-center">
        <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-surface-tertiary">
          <Database className="size-5 text-text-secondary" aria-hidden="true" />
        </div>
        {isFiltered ? (
          <p className="text-sm text-text-secondary">{localize('com_ui_no_memory_stores_match')}</p>
        ) : (
          <>
            <p className="text-sm font-medium text-text-primary">
              {localize('com_ui_no_memory_stores_title')}
            </p>
            <p className="mt-0.5 text-xs text-text-secondary">
              {localize('com_ui_no_memory_stores')}
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2" role="list" aria-label={localize('com_ui_memory_stores')}>
      {stores.map((store) => (
        <div key={store.id} role="listitem">
          <MemoryStoreRow
            store={store}
            isSelected={store.id === selectedStoreId}
            canManage={canManage}
            canShare={canShare}
            onSelect={onSelect}
            onRename={onRename}
            onDelete={onDelete}
          />
        </div>
      ))}
    </div>
  );
}
