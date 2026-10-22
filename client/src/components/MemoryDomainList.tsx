import { h, Fragment } from '../runtime.js';
import { useMemo } from '../runtime.js';
import { useTranslation } from '../runtime.js';
import { makeIcon } from '../runtime.js';
const FolderTree = makeIcon('folderTree');
const Pencil = makeIcon('pencil');
const Trash = makeIcon('trash');
import { TooltipAnchor } from '../runtime.js';
import type { TMemoryDomain } from '../sdk.js';
import { useLocalize } from '../runtime.js';
import MemoryDomainChip from './MemoryDomainChip.tsx';
import { cn } from '../utils.js';

const ACTION_BUTTON_CLASS =
  'inline-flex size-7 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-surface-active hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy';

/** Mirrors the store list's default badge. */
const DEFAULT_BADGE_CLASS =
  'shrink-0 rounded-full border border-border-heavy bg-surface-tertiary px-2 py-0.5 text-xs font-medium text-text-primary';

interface MemoryDomainRowProps {
  domain: TMemoryDomain;
  /** Owners still need MEMORIES UPDATE to rename or delete a domain. */
  canManage: boolean;
  onSelect: (domain: TMemoryDomain) => void;
  onEdit: (domain: TMemoryDomain) => void;
  onDelete: (domain: TMemoryDomain) => void;
}

function MemoryDomainRow({ domain, canManage, onSelect, onEdit, onDelete }: MemoryDomainRowProps) {
  const localize = useLocalize();
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  return (
    <div
      className={cn(
        'relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1 gap-y-0.5 rounded-lg border px-1.5 py-1.5 transition-colors',
        'border-border-light bg-surface-secondary/50 hover:bg-surface-hover',
      )}
    >
      {/* Stretched target so the whole card filters the memory list by domain. */}
      <button
        type="button"
        onClick={() => onSelect(domain)}
        aria-label={domain.name}
        className="absolute inset-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy"
      />
      <div className="pointer-events-none col-start-1 row-start-1 flex min-w-0 items-center gap-2 px-1.5 py-0.5">
        <FolderTree className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
        <span className="truncate text-sm font-medium text-text-primary">{domain.name}</span>
        {domain.isDefault === true && (
          <span className={DEFAULT_BADGE_CLASS}>{localize('com_ui_default')}</span>
        )}
        <MemoryDomainChip domain={domain} showName={false} />
      </div>
      <span className="pointer-events-none col-span-2 row-start-2 pl-6 text-xs text-text-secondary">
        {localize('com_ui_memories_count', {
          0: (domain.memoryCount ?? 0).toLocaleString(locale),
        })}
      </span>
      {canManage && domain.isDefault !== true && (
        <div className="relative z-10 col-start-2 row-start-1 flex shrink-0 items-center gap-0.5">
          <TooltipAnchor
            description={localize('com_ui_rename')}
            side="bottom"
            render={
              <button
                type="button"
                className={ACTION_BUTTON_CLASS}
                aria-label={`${localize('com_ui_rename')}: ${domain.name}`}
                onClick={() => onEdit(domain)}
              >
                <Pencil className="size-4" aria-hidden="true" />
              </button>
            }
          />
          <TooltipAnchor
            description={localize('com_ui_delete')}
            side="bottom"
            render={
              <button
                type="button"
                className={cn(ACTION_BUTTON_CLASS, 'hover:text-text-destructive')}
                aria-label={`${localize('com_ui_delete')}: ${domain.name}`}
                onClick={() => onDelete(domain)}
              >
                <Trash className="size-4" aria-hidden="true" />
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}

interface MemoryDomainListProps {
  domains: TMemoryDomain[];
  /** Owners still need MEMORIES UPDATE to create, edit or delete. */
  canManage: boolean;
  /** A domain-name filter is active, so an empty list is not an empty store. */
  isFiltered?: boolean;
  onSelect: (domain: TMemoryDomain) => void;
  onEdit: (domain: TMemoryDomain) => void;
  onDelete: (domain: TMemoryDomain) => void;
}

export default function MemoryDomainList({
  domains,
  canManage,
  isFiltered = false,
  onSelect,
  onEdit,
  onDelete,
}: MemoryDomainListProps) {
  const localize = useLocalize();
  /** One palette assignment for the whole list, so a domain keeps its color
   *  here and in the cards that render its memories. */

  if (domains.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border-light p-6 text-center">
        <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-surface-tertiary">
          <FolderTree className="size-5 text-text-secondary" aria-hidden="true" />
        </div>
        {isFiltered ? (
          <p className="text-sm text-text-secondary">
            {localize('com_ui_no_memory_domains_match')}
          </p>
        ) : (
          <>
            <p className="text-sm font-medium text-text-primary">
              {localize('com_ui_no_memory_domains_title')}
            </p>
            <p className="mt-0.5 text-xs text-text-secondary">
              {localize('com_ui_no_memory_domains')}
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2" role="list" aria-label={localize('com_ui_memory_domains')}>
      {domains.map((domain) => (
        <div key={domain.id} role="listitem">
          <MemoryDomainRow
            domain={domain}
            canManage={canManage}
            onSelect={onSelect}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      ))}
    </div>
  );
}
