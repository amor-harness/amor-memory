import { h, Fragment } from '../runtime.js';
import { useMemo } from '../runtime.js';
import { makeIcon } from '../runtime.js';
const Undo2 = makeIcon('undo');
import { Button, Spinner, TooltipAnchor, useToastContext } from '../runtime.js';
import type { TUserMemory } from '../sdk.js';
import { useMemoryVersionsQuery, useRestoreMemoryVersionMutation } from '../data.js';
import { formatMemoryDateTime } from '../datetime.js';
import { useLocalize } from '../runtime.js';
import { cn } from '../utils.js';

interface MemoryVersionListProps {
  memory: TUserMemory;
  /** Store the memory belongs to; scopes the history and restore requests. */
  storeId?: string;
  /** Shared stores are read-only: the history is shown without the restore
   *  action. */
  canRestore: boolean;
  /** Called with the memory as restored. The dialog closes itself when the
   *  restore also changed the memory's key. */
  onRestored: (memory: TUserMemory) => void;
}

const iconButtonClass = cn(
  'flex size-7 shrink-0 items-center justify-center rounded-md',
  'text-text-secondary transition-colors duration-150',
  'hover:bg-surface-hover hover:text-text-primary',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy',
);

export default function MemoryVersionList({
  memory,
  storeId,
  canRestore,
  onRestored,
}: MemoryVersionListProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { data, isLoading, isError } = useMemoryVersionsQuery(memory.key, storeId);
  const versions = useMemo(() => data?.versions ?? [], [data]);

  const {
    mutate: restoreVersion,
    isLoading: isRestoring,
    variables,
  } = useRestoreMemoryVersionMutation({
    onSuccess: (result) => {
      showToast({
        message: localize('com_ui_agent_version_restore_success'),
        status: 'success',
      });
      onRestored(result.memory);
    },
    onError: () => {
      showToast({
        message: localize('com_ui_agent_version_restore_error'),
        status: 'error',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-24 items-center justify-center">
        <Spinner className="size-4 text-text-secondary" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="py-6 text-center text-sm text-text-secondary">
        {localize('com_ui_agent_version_error')}
      </p>
    );
  }

  if (versions.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-text-secondary">
        {localize('com_ui_agent_version_empty')}
      </p>
    );
  }

  return (
    <ul className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
      {versions.map((version) => {
        /** The newest state that still matches the entry is the live one; any
         *  earlier row is a candidate for restoring. */
        const isCurrent = version.key === memory.key && version.value === memory.value;
        const isThisRestoring = isRestoring && variables?.versionId === version.id;
        return (
          <li
            key={version.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border px-3 py-2',
              isCurrent
                ? 'border-border-heavy bg-surface-secondary'
                : 'border-border-light bg-surface-secondary/50',
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-text-primary">
                  {version.key}
                </span>
                {isCurrent && (
                  <span className="shrink-0 rounded-full border border-border-heavy bg-surface-tertiary px-2 py-0.5 text-xs font-medium text-text-primary">
                    {localize('com_ui_agent_version_current')}
                  </span>
                )}
              </div>
              <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-text-secondary">
                {version.value}
              </p>
              <span className="mt-1 block text-xs text-text-secondary">
                {formatMemoryDateTime(version.createdAt)}
              </span>
            </div>

            {canRestore && (
              <TooltipAnchor
                description={localize('com_ui_agent_version_restore')}
                side="top"
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={iconButtonClass}
                    aria-label={localize('com_ui_agent_version_restore')}
                    disabled={isCurrent || isRestoring}
                    onClick={() =>
                      restoreVersion({ key: memory.key, versionId: version.id, storeId })
                    }
                  >
                    {isThisRestoring ? (
                      <Spinner className="size-3.5" />
                    ) : (
                      <Undo2 className="size-3.5" aria-hidden="true" />
                    )}
                  </Button>
                }
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
