import { h, Fragment } from '../runtime.js';
import { useState, useEffect, useMemo, useCallback } from '../runtime.js';
import { makeIcon } from '../runtime.js';
const History = makeIcon('history');
const ChevronLeft = makeIcon('chevronLeft');
import { PermissionTypes, Permissions } from '../sdk.js';
import { OGDialog, OGDialogTemplate, Button, Spinner, useToastContext } from '../runtime.js';
import type { MemoryInjection, TUserMemory } from '../sdk.js';
import { useUpdateMemoryMutation, useMemoriesQuery, useMemoryDomainsQuery } from '../data.js';
import { useLocalize, useHasAccess } from '../runtime.js';
import MemoryVersionList from './MemoryVersionList.tsx';
import { formatMemoryDateTime } from '../datetime.js';
import MemoryFormFields from './MemoryFormFields.tsx';
import MemoryUsageBadge from './MemoryUsageBadge.tsx';

interface MemoryEditDialogProps {
  memory: TUserMemory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  triggerRef?: React.MutableRefObject<HTMLButtonElement | null>;
  /** Store the memory belongs to; scopes the read and update requests. */
  storeId?: string;
}

export default function MemoryEditDialog({
  memory,
  open,
  onOpenChange,
  children,
  triggerRef,
  storeId,
}: MemoryEditDialogProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { data: memData } = useMemoriesQuery(storeId);

  const hasUpdateAccess = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.UPDATE,
  });

  const { mutate: updateMemory, isLoading } = useUpdateMemoryMutation({
    onMutate: () => {
      onOpenChange(false);
      setTimeout(() => {
        triggerRef?.current?.focus();
      }, 0);
    },
    onSuccess: () => {
      showToast({
        message: localize('com_ui_saved'),
        status: 'success',
      });
    },
    onError: (error: Error) => {
      let errorMessage = localize('com_ui_error');

      if (typeof error === 'object' && 'response' in error) {
        const failure = error as Error & {
          response?: { status?: number; data?: { error?: string } };
        };
        const responseMessage = failure.response?.data?.error;
        if (responseMessage) {
          errorMessage = responseMessage;

          // Check for duplicate key error
          if (failure.response?.status === 409 || responseMessage.includes('already exists')) {
            errorMessage = localize('com_ui_memory_key_exists');
          }
          // Check for key validation error (lowercase and underscores only)
          else if (responseMessage.includes('lowercase letters, numbers, and underscores')) {
            errorMessage = localize('com_ui_memory_key_validation');
          }
          // Stable-memory protections (delete/rename guard) surfaced as a hint
          else if (responseMessage.includes('stable')) {
            errorMessage = localize('com_ui_memory_stable_guard');
          }
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      showToast({
        message: errorMessage,
        status: 'error',
      });
    },
  });

  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [originalKey, setOriginalKey] = useState('');
  const [stable, setStable] = useState(false);
  /** Which prompt carries the memory while it is stable; only sent while
   *  stable is on. */
  const [injection, setInjection] = useState<MemoryInjection>('system');
  const [locked, setLocked] = useState(false);
  const [domainId, setDomainId] = useState<string | undefined>(undefined);
  const [originalDomainId, setOriginalDomainId] = useState<string | undefined>(undefined);
  /** The footer's left slot swaps the dialog between the editor and the
   *  memory's recorded history; reopening always starts on the editor. */
  const [showHistory, setShowHistory] = useState(false);

  /** Wipes the editor back to what the memory currently holds. */
  const loadMemory = useCallback((source: TUserMemory) => {
    setKey(source.key);
    setValue(source.value);
    setOriginalKey(source.key);
    setStable(source.stable === true);
    setInjection(source.injection === 'additional' ? 'additional' : 'system');
    setLocked(source.locked === true);
    setDomainId(source.domainId);
    setOriginalDomainId(source.domainId);
  }, []);

  /** The domain list only matters while the dialog is open, and a failure to
   *  load it must never block editing: the field simply does not render. */
  const { data: domainData } = useMemoryDomainsQuery(storeId, undefined, { enabled: open });
  const domains = domainData?.domains ?? [];

  useEffect(() => {
    if (memory) {
      loadMemory(memory);
    }
  }, [memory, loadMemory]);

  /** Every open starts from the stored memory, never from whatever a cancelled
   *  edit left in state. Adjusting during render — as the create dialog does —
   *  keeps the abandoned value out of the first painted frame. */
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      if (memory) {
        loadMemory(memory);
      }
    } else {
      setShowHistory(false);
    }
  }

  const handleSave = () => {
    if (!hasUpdateAccess || !memory) {
      return;
    }

    if (!key.trim() || !value.trim()) {
      showToast({
        message: localize('com_ui_field_required'),
        status: 'error',
      });
      return;
    }

    updateMemory({
      key: key.trim(),
      value: value.trim(),
      storeId,
      stable,
      locked,
      /** The injection point only rides the edit while the memory is stable:
       *  an ephemeral memory is never carried in either prompt. */
      ...(stable ? { injection } : {}),
      ...(originalKey !== key.trim() && { originalKey }),
      /** Only a changed domain rides the update: sending the unchanged one
       *  would be a pointless reassignment of every edited memory. */
      ...(domainId != null && domainId !== originalDomainId && { domainId }),
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey && hasUpdateAccess) {
      handleSave();
    }
  };

  // Calculate memory-specific usage: available = tokenLimit - (totalTokens - thisMemoryTokens)
  const memoryUsage = useMemo(() => {
    if (!memory?.tokenCount || !memData?.tokenLimit) {
      return null;
    }
    const availableForMemory = memData.tokenLimit - (memData.totalTokens ?? 0) + memory.tokenCount;
    const percentage = Math.round((memory.tokenCount / availableForMemory) * 100);
    return { availableForMemory, percentage };
  }, [memory?.tokenCount, memData?.tokenLimit, memData?.totalTokens]);

  /** A restore that changes the key lands on a different card, so this dialog
   *  has nothing left to edit and closes. */
  const handleRestored = (restored: TUserMemory) => {
    if (restored.key !== memory?.key) {
      onOpenChange(false);
    }
  };

  const historyButtonClass = 'h-9 gap-1.5 px-3';

  /** The footer's left slot toggles between the editor and the history; the
   *  same button turns into the way back once the history is showing. */
  const historyButton = showHistory ? (
    <Button
      type="button"
      variant="outline"
      className={historyButtonClass}
      aria-label={localize('com_ui_back')}
      onClick={() => setShowHistory(false)}
    >
      <ChevronLeft className="size-4" aria-hidden="true" />
      {localize('com_ui_back')}
    </Button>
  ) : (
    <Button
      type="button"
      variant="outline"
      className={historyButtonClass}
      aria-label={localize('com_ui_agent_version_history')}
      onClick={() => setShowHistory(true)}
    >
      <History className="size-4" aria-hidden="true" />
      {localize('com_ui_agent_version_history')}
    </Button>
  );

  const editorTitle = hasUpdateAccess
    ? localize('com_ui_edit_memory')
    : localize('com_ui_view_memory');

  return (
    <OGDialog open={open} onOpenChange={onOpenChange} triggerRef={triggerRef}>
      {children}
      <OGDialogTemplate
        title={showHistory ? localize('com_ui_agent_version_history') : editorTitle}
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        className="w-11/12 md:max-w-lg"
        main={
          showHistory && memory ? (
            <MemoryVersionList
              memory={memory}
              storeId={storeId}
              canRestore={hasUpdateAccess}
              onRestored={handleRestored}
            />
          ) : (
            <div className="space-y-4">
              {/* Memory metadata */}
              {memory && (
                <div className="flex items-center justify-between rounded-lg border border-border-light bg-surface-secondary px-3 py-2">
                  {/* Token count - Left */}
                  {memory.tokenCount !== undefined ? (
                    <span className="text-xs text-text-secondary">
                      {memory.tokenCount.toLocaleString()}{' '}
                      {localize(memory.tokenCount === 1 ? 'com_ui_token' : 'com_ui_tokens')}
                    </span>
                  ) : (
                    <div />
                  )}

                  {/* Date - Center */}
                  <span className="text-xs text-text-secondary">
                    {formatMemoryDateTime(memory.updated_at)}
                  </span>

                  {/* Usage badge - Right (memory-specific) */}
                  {memoryUsage ? (
                    <MemoryUsageBadge
                      percentage={memoryUsage.percentage}
                      tokenLimit={memData?.tokenLimit ?? 0}
                      tooltipCurrent={memory.tokenCount}
                      tooltipMax={memoryUsage.availableForMemory}
                    />
                  ) : (
                    <div />
                  )}
                </div>
              )}

              {/* Key, value and the domain the memory belongs to — the same
                  fields the create dialog renders, from the shared form. */}
              <MemoryFormFields
                keyValue={key}
                onKeyChange={setKey}
                value={value}
                onValueChange={setValue}
                onKeyDown={handleKeyPress}
                disabled={!hasUpdateAccess}
                domains={domains}
                domainId={domainId}
                onDomainChange={setDomainId}
                stable={stable}
                onStableChange={setStable}
                injection={injection}
                onInjectionChange={setInjection}
                locked={locked}
                onLockedChange={setLocked}
                flagsDisabled={!hasUpdateAccess}
                domainDisabled={!hasUpdateAccess}
              />
            </div>
          )
        }
        leftButtons={memory != null ? historyButton : null}
        buttons={
          hasUpdateAccess && !showHistory ? (
            <Button
              type="button"
              variant="submit"
              onClick={handleSave}
              aria-label={localize('com_ui_save')}
              disabled={isLoading || !key.trim() || !value.trim()}
            >
              {isLoading ? <Spinner className="size-4" /> : localize('com_ui_save')}
            </Button>
          ) : null
        }
      />
    </OGDialog>
  );
}
