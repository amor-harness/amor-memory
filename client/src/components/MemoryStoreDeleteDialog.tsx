import { h, Fragment } from '../runtime.js';
import { Label, OGDialog, OGDialogTemplate, useToastContext } from '../runtime.js';
import type { TMemoryStore } from '../sdk.js';
import { useDeleteMemoryStoreMutation } from '../data.js';
import { useLocalize } from '../runtime.js';

interface MemoryStoreDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: TMemoryStore | null;
  /** Receives the deleted store id after a successful delete. */
  onDeleted?: (storeId: string) => void;
}

export default function MemoryStoreDeleteDialog({
  open,
  onOpenChange,
  store,
  onDeleted,
}: MemoryStoreDeleteDialogProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();

  const { mutate: deleteStore, isLoading } = useDeleteMemoryStoreMutation({
    onSuccess: (_data, variables) => {
      showToast({ message: localize('com_ui_deleted'), status: 'success' });
      onOpenChange(false);
      onDeleted?.(variables.storeId);
    },
    onError: () => {
      showToast({ message: localize('com_ui_error'), status: 'error' });
    },
  });

  const handleDelete = () => {
    if (store == null) {
      return;
    }
    deleteStore({ storeId: store.id });
  };

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogTemplate
        showCloseButton={false}
        title={localize('com_ui_delete_memory_store')}
        className="w-11/12 max-w-lg"
        main={
          <Label className="text-left text-sm font-medium">
            {localize('com_ui_memory_store_delete_confirm', { 0: store?.name ?? '' })}
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
