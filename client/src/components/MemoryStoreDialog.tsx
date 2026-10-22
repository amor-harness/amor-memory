import { h, Fragment } from '../runtime.js';
import { useState, useEffect } from '../runtime.js';
import {
  OGDialog,
  OGDialogTemplate,
  Button,
  Label,
  Input,
  Spinner,
  useToastContext,
} from '../runtime.js';
import type { TMemoryStore } from '../sdk.js';
import { useCreateMemoryStoreMutation, useUpdateMemoryStoreMutation } from '../data.js';
import { useLocalize } from '../runtime.js';

interface MemoryStoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present to rename that store; omitted to create a new one. */
  store?: TMemoryStore | null;
}

export default function MemoryStoreDialog({
  open,
  onOpenChange,
  store = null,
}: MemoryStoreDialogProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const isRename = store != null;
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) {
      setName(store?.name ?? '');
    }
  }, [open, store]);

  const handleSuccess = (message: string) => {
    showToast({ message, status: 'success' });
    onOpenChange(false);
  };

  const handleError = (error: Error) => {
    const failure = error as { response?: { status?: number; data?: { error?: string } } };
    const message = failure.response?.data?.error;
    const isDuplicate =
      failure.response?.status === 409 || (message != null && message.includes('already exists'));
    showToast({
      message: isDuplicate ? localize('com_ui_memory_store_name_exists') : localize('com_ui_error'),
      status: 'error',
    });
  };

  const { mutate: createStore, isLoading: isCreating } = useCreateMemoryStoreMutation({
    onSuccess: () => handleSuccess(localize('com_ui_memory_store_created')),
    onError: handleError,
  });

  const { mutate: updateStore, isLoading: isUpdating } = useUpdateMemoryStoreMutation({
    onSuccess: () => handleSuccess(localize('com_ui_memory_store_renamed')),
    onError: handleError,
  });

  const isLoading = isCreating || isUpdating;
  const trimmedName = name.trim();
  const submitLabel = isRename ? localize('com_ui_save') : localize('com_ui_create');

  const handleSave = () => {
    if (trimmedName === '' || isLoading) {
      return;
    }
    if (store != null) {
      updateStore({ storeId: store.id, name: trimmedName });
      return;
    }
    createStore({ name: trimmedName });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogTemplate
        showCloseButton={false}
        title={isRename ? localize('com_ui_rename') : localize('com_ui_create_memory_store')}
        className="w-11/12 md:max-w-lg"
        main={
          <div className="space-y-2">
            <Label htmlFor="memory-store-name" className="text-sm font-medium text-text-primary">
              {localize('com_ui_name')}
            </Label>
            <Input
              id="memory-store-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={localize('com_ui_name')}
              className="w-full"
            />
          </div>
        }
        buttons={
          <Button
            type="button"
            variant="submit"
            onClick={handleSave}
            disabled={isLoading || trimmedName === ''}
            aria-label={submitLabel}
          >
            {isLoading ? <Spinner className="size-4" /> : submitLabel}
          </Button>
        }
      />
    </OGDialog>
  );
}
