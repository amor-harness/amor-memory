import { h, Fragment } from '../runtime.js';
import { useRef, useState } from '../runtime.js';
import {
  Button,
  Label,
  OGDialog,
  OGDialogTemplate,
  OGDialogTrigger,
  Spinner,
  TooltipAnchor,
  TrashIcon,
  cn,
  useLocalize,
  useToastContext,
} from '../runtime.js';
import { makeIcon } from '../runtime.js';
import { useDeleteMemoryImageMutation, useDeleteMemoryMutation } from '../data.js';
import MemoryEditDialog from './MemoryEditDialog.tsx';

const Pencil = makeIcon('pencil');

export default function MemoryCardActions({ memory, storeId, readOnly = false }) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const triggerRef = useRef(null);
  const isImage = memory.kind === 'image';

  const { mutate: deleteMemory, isLoading: isDeleting } = useDeleteMemoryMutation();
  const { mutate: deleteMemoryImage, isLoading: isDeletingImage } = useDeleteMemoryImageMutation();

  const buttonBaseClass = cn(
    'flex size-7 items-center justify-center rounded-md',
    'transition-colors duration-150',
    'text-text-secondary hover:text-text-primary',
    'hover:bg-surface-active',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy',
  );

  const confirmDelete = () => {
    const onSuccess = () => {
      showToast({ message: localize('com_ui_deleted'), status: 'success' });
      setDeleteOpen(false);
    };
    const onError = (error) => {
      let message = localize('com_ui_error');
      if (error?.message?.includes('stable')) {
        message = localize('com_ui_memory_stable_guard');
      }
      showToast({ message, status: 'error' });
    };

    if (isImage) {
      deleteMemoryImage({ sha256: memory.sha256 ?? memory.key, storeId }, { onSuccess, onError });
      return;
    }

    deleteMemory({ key: memory.key, storeId }, { onSuccess, onError });
  };

  if (readOnly) {
    return null;
  }

  return (
    <div className="flex items-center gap-0.5">
      {!isImage && (
        <MemoryEditDialog
          open={editOpen}
          memory={memory}
          storeId={storeId}
          onOpenChange={setEditOpen}
          triggerRef={triggerRef}
        >
          <OGDialogTrigger asChild>
            <TooltipAnchor
              description={localize('com_ui_edit_memory')}
              side="top"
              render={
                <Button
                  ref={triggerRef}
                  variant="ghost"
                  size="icon"
                  className={buttonBaseClass}
                  aria-label={localize('com_ui_edit')}
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                </Button>
              }
            />
          </OGDialogTrigger>
        </MemoryEditDialog>
      )}

      <OGDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <OGDialogTrigger asChild>
          <TooltipAnchor
            description={localize('com_ui_delete_memory')}
            side="top"
            render={
              <Button
                variant="ghost"
                size="icon"
                className={buttonBaseClass}
                aria-label={localize('com_ui_delete')}
                onClick={() => setDeleteOpen(true)}
              >
                {isDeleting || isDeletingImage ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <TrashIcon className="size-3.5" aria-hidden="true" />
                )}
              </Button>
            }
          />
        </OGDialogTrigger>
        <OGDialogTemplate
          showCloseButton={false}
          title={localize(isImage ? 'com_ui_delete_memory_image' : 'com_ui_delete_memory')}
          className="w-11/12 max-w-lg"
          main={
            <Label className="text-left text-sm font-medium">
              {isImage
                ? localize('com_ui_delete_memory_image_confirm')
                : localize('com_ui_delete_confirm_strong', { title: memory.key })}
            </Label>
          }
          selection={{
            selectHandler: confirmDelete,
            selectClasses: 'bg-surface-destructive text-white hover:bg-surface-destructive-hover',
            selectText: localize('com_ui_delete'),
          }}
        />
      </OGDialog>
    </div>
  );
}
