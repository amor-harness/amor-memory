import { h, Fragment } from '../runtime.js';
import { useState, useEffect } from '../runtime.js';
import { PermissionTypes, Permissions } from '../sdk.js';
import { OGDialog, OGDialogTemplate, Button, Label, Spinner, useToastContext } from '../runtime.js';
import type { MemoryEvictionPreviewItem, MemoryInjection } from '../sdk.js';
import { useCreateMemoryMutation, useMemoriesQuery, useMemoryDomainsQuery } from '../data.js';
import { getMemoryKeyError, getMemoryValueError, getMemoryApiErrorMessage } from '../utils.js';
import { useLocalize, useHasAccess } from '../runtime.js';
import MemoryFormFields from './MemoryFormFields.tsx';

interface MemoryCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  triggerRef?: React.MutableRefObject<HTMLButtonElement | null>;
  /** Store the memory is created in; scopes the read and create requests. */
  storeId?: string;
}

export default function MemoryCreateDialog({
  open,
  onOpenChange,
  children,
  triggerRef,
  storeId,
}: MemoryCreateDialogProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();

  const hasCreateAccess = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.CREATE,
  });

  const { data: memData } = useMemoriesQuery(storeId);

  const { mutate: createMemory, isLoading } = useCreateMemoryMutation({
    onSuccess: (data) => {
      showToast({
        message: localize('com_ui_memory_created'),
        status: 'success',
      });
      if (data?.evicted?.length) {
        showToast({
          message: localize('com_ui_memory_evicted_toast', { count: data.evicted.length }),
          status: 'info',
        });
      }
      onOpenChange(false);
      setKey('');
      setValue('');
      setTouched({ key: false, value: false });
      setPendingEvict(null);
      setTimeout(() => {
        triggerRef?.current?.focus();
      }, 0);
    },
    onError: (error: Error) => {
      /** Storage is full and saving would evict the oldest ephemeral memories —
       *  ask the user to confirm before anything is deleted. */
      const capacityError = error as {
        response?: {
          data?: {
            code?: string;
            wouldEvict?: MemoryEvictionPreviewItem[];
            error?: string;
          };
        };
      };
      if (capacityError.response?.data?.code === 'MEMORY_CAPACITY_EVICTION') {
        setPendingEvict(capacityError.response.data.wouldEvict ?? []);
        return;
      }
      showToast({
        message: getMemoryApiErrorMessage(error, localize('com_ui_error')),
        status: 'error',
      });
    },
  });

  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [domainId, setDomainId] = useState<string | undefined>(undefined);
  const [stable, setStable] = useState(false);
  const [injection, setInjection] = useState<MemoryInjection>('system');
  const [locked, setLocked] = useState(false);
  const [touched, setTouched] = useState({ key: false, value: false });
  const [pendingEvict, setPendingEvict] = useState<MemoryEvictionPreviewItem[] | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);

  /** A failed domain list must never block creating a memory: the field simply
   *  does not render and the server files the entry in the default domain. */
  const { data: domainData } = useMemoryDomainsQuery(storeId, undefined, { enabled: open });
  const domains = domainData?.domains ?? [];
  const defaultDomain = domains.find((domain) => domain.isDefault === true);

  /** New memories land in the default domain unless the user says otherwise,
   *  so the select starts on it instead of looking unset. */
  useEffect(() => {
    if (open && domainId == null && defaultDomain != null) {
      setDomainId(defaultDomain.id);
    }
  }, [open, domainId, defaultDomain]);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) {
      setKey('');
      setValue('');
      setDomainId(undefined);
      setTouched({ key: false, value: false });
      setPendingEvict(null);
    }
  }

  const keyError = getMemoryKeyError({ key, memories: memData?.memories, storeId });
  const valueError = getMemoryValueError(value);
  const hasErrors = keyError != null || valueError != null;
  /** Stay quiet on a pristine empty field; validate live once there is something to judge. */
  const showKeyError = touched.key || key !== '';
  const showValueError = touched.value || value !== '';

  const handleSave = () => {
    if (!hasCreateAccess) {
      return;
    }

    if (keyError || valueError) {
      setTouched({ key: true, value: true });
      return;
    }

    createMemory({
      key: key.trim(),
      value: value.trim(),
      storeId,
      ...(domainId != null ? { domainId } : {}),
      stable,
      ...(stable ? { injection } : {}),
      locked,
    });
  };

  /** Confirmed: the user accepted deleting the listed oldest memories. */
  const handleConfirmEvict = () => {
    createMemory({
      key: key.trim(),
      value: value.trim(),
      storeId,
      confirmEvict: true,
      ...(domainId != null ? { domainId } : {}),
      stable,
      ...(stable ? { injection } : {}),
      locked,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey && hasCreateAccess) {
      handleSave();
    }
  };

  return (
    <OGDialog open={open} onOpenChange={onOpenChange} triggerRef={triggerRef}>
      {children}
      <OGDialogTemplate
        title={localize(pendingEvict ? 'com_ui_memory_evict_title' : 'com_ui_create_memory')}
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        className="w-11/12 md:max-w-lg"
        main={
          pendingEvict ? (
            <div className="space-y-3">
              <Label className="text-left text-sm font-medium text-text-primary">
                {localize('com_ui_memory_evict_message')}
              </Label>
              <ul className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-border-light bg-surface-secondary p-3 text-sm text-text-primary">
                {pendingEvict.map((item) => (
                  <li key={item.key} className="break-all">
                    {item.key}
                  </li>
                ))}
              </ul>
              <Label className="text-left text-xs text-text-secondary">
                {localize('com_ui_memory_evict_note')}
              </Label>
            </div>
          ) : (
            /* The same fields the edit dialog edits: key, value, and the
               domain the memory belongs to. */
            <MemoryFormFields
              keyValue={key}
              onKeyChange={setKey}
              onKeyBlur={() => setTouched((prev) => ({ ...prev, key: true }))}
              value={value}
              onValueChange={setValue}
              onValueBlur={() => setTouched((prev) => ({ ...prev, value: true }))}
              onKeyDown={handleKeyPress}
              keyError={keyError}
              valueError={valueError}
              showKeyError={showKeyError}
              showValueError={showValueError}
              showKeyHint
              domains={domains}
              domainId={domainId}
              onDomainChange={setDomainId}
              stable={stable}
              onStableChange={setStable}
              injection={injection}
              onInjectionChange={setInjection}
              locked={locked}
              onLockedChange={setLocked}
            />
          )
        }
        buttons={
          pendingEvict ? (
            <div className="flex w-full justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPendingEvict(null)}
                disabled={isLoading}
              >
                {localize('com_ui_cancel')}
              </Button>
              <Button
                type="button"
                variant="submit"
                onClick={handleConfirmEvict}
                disabled={isLoading}
                className="bg-surface-destructive text-white hover:bg-surface-destructive-hover"
                aria-label={localize('com_ui_memory_evict_confirm_button')}
              >
                {isLoading ? (
                  <Spinner className="size-4" />
                ) : (
                  localize('com_ui_memory_evict_confirm_button')
                )}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="submit"
              onClick={handleSave}
              disabled={isLoading || hasErrors}
              aria-label={localize('com_ui_create_memory')}
            >
              {isLoading ? <Spinner className="size-4" /> : localize('com_ui_create')}
            </Button>
          )
        }
      />
    </OGDialog>
  );
}
