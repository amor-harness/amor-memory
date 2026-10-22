import { h, Fragment } from '../runtime.js';
import { Label, OGDialog, OGDialogTemplate, useToastContext } from '../runtime.js';
import type { TMemoryStore } from '../sdk.js';
import { useClearMemoryStoreMutation } from '../data.js';
import { useLocalize } from '../runtime.js';

interface MemoryStoreClearDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: TMemoryStore | null;
}

export default function MemoryStoreClearDialog({
  open,
  onOpenChange,
  store,
}: MemoryStoreClearDialogProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();

  const { mutate: clearStore, isLoading } = useClearMemoryStoreMutation({
    onSuccess: () => {
      showToast({ message: localize('com_ui_deleted'), status: 'success' });
      onOpenChange(false);
    },
    onError: () => {
      showToast({ message: localize('com_ui_error'), status: 'error' });
    },
  });

  const handleClear = () => {
    if (store == null) {
      return;
    }
    clearStore({ storeId: store.id });
  };

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogTemplate
        showCloseButton={false}
        title={localize('com_ui_memory_store_clear')}
        className="w-11/12 max-w-lg"
        main={
          <Label className="text-left text-sm font-medium">
            {localize('com_ui_memory_store_clear_confirm', { 0: store?.name ?? '' })}
          </Label>
        }
        selection={{
          selectHandler: handleClear,
          selectClasses:
            'bg-surface-destructive text-text-on-status hover:bg-surface-destructive-hover',
          selectText: localize('com_ui_clear'),
          isLoading,
        }}
      />
    </OGDialog>
  );
}
