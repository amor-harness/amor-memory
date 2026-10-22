import { h, Fragment } from '../runtime.js';
import { Label, OGDialog, OGDialogTemplate, useToastContext } from '../runtime.js';
import type { TMemoryDomain } from '../sdk.js';
import { useDeleteMemoryDomainMutation } from '../data.js';
import { useLocalize } from '../runtime.js';

interface MemoryDomainDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: TMemoryDomain | null;
  /** Store the domain lives in; omitted targets the caller's default store. */
  storeId?: string;
  /** Receives the deleted domain id after a successful delete. */
  onDeleted?: (domainId: string) => void;
}

/** Deleting a domain deletes its memories, so a domain that still holds any is
 *  deleted with `force` — which this dialog only sends after the user has been
 *  told exactly how many memories go with it. */
export default function MemoryDomainDeleteDialog({
  open,
  onOpenChange,
  domain,
  storeId,
  onDeleted,
}: MemoryDomainDeleteDialogProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const memoryCount = domain?.memoryCount ?? 0;
  const hasMemories = memoryCount > 0;

  const { mutate: deleteDomain, isLoading } = useDeleteMemoryDomainMutation({
    onSuccess: (_data, variables) => {
      showToast({ message: localize('com_ui_deleted'), status: 'success' });
      onOpenChange(false);
      onDeleted?.(variables.domainId);
    },
    onError: () => {
      showToast({ message: localize('com_ui_error'), status: 'error' });
    },
  });

  const handleDelete = () => {
    if (domain == null) {
      return;
    }
    deleteDomain({ domainId: domain.id, storeId, force: hasMemories });
  };

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogTemplate
        showCloseButton={false}
        title={localize('com_ui_memory_domain_delete')}
        className="w-11/12 max-w-lg"
        main={
          <Label className="text-left text-sm font-medium">
            {hasMemories
              ? localize('com_ui_memory_domain_delete_confirm_count', {
                  0: domain?.name ?? '',
                  1: memoryCount.toLocaleString(),
                })
              : localize('com_ui_memory_domain_delete_confirm', { 0: domain?.name ?? '' })}
          </Label>
        }
        selection={{
          selectHandler: handleDelete,
          selectClasses:
            'bg-surface-destructive text-text-on-status hover:bg-surface-destructive-hover',
          selectText: localize('com_ui_delete'),
          isLoading,
        }}
      />
    </OGDialog>
  );
}
