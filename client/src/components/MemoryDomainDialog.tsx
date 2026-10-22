import { h, Fragment } from '../runtime.js';
import { useState, useEffect } from '../runtime.js';
import {
  OGDialog,
  OGDialogTemplate,
  Button,
  Input,
  Label,
  Spinner,
  useToastContext,
} from '../runtime.js';
import { MEMORY_DOMAIN_KINDS } from '../sdk.js';
import type { MemoryDomainKind, TMemoryDomain } from '../sdk.js';
import { MEMORY_DOMAIN_KIND_LABEL_KEYS, domainKindBadgeColor } from '../constants.js';
import { useCreateMemoryDomainMutation, useUpdateMemoryDomainMutation } from '../data.js';
import { useLocalize } from '../runtime.js';
import { cn } from '../utils.js';

const KIND_BUTTON_CLASS =
  'rounded-full border border-transparent px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy';
/** The selected option is tinted like an unselected one and gains a ring in its
 *  own hue (`ring-current` follows the palette's text color), so each option
 *  shows the color its domain chip will use without a second palette entry. */
const KIND_BUTTON_SELECTED_CLASS = 'ring-2 ring-current font-semibold';

interface MemoryDomainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Store the domain lives in; omitted targets the caller's default store. */
  storeId?: string;
  /** Present to edit that domain; omitted to create a new one. */
  domain?: TMemoryDomain | null;
}

export default function MemoryDomainDialog({
  open,
  onOpenChange,
  storeId,
  domain = null,
}: MemoryDomainDialogProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const isEdit = domain != null;
  const [name, setName] = useState('');
  const [kind, setKind] = useState<MemoryDomainKind>('real');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    setName(domain?.name ?? '');
    setKind(domain?.kind ?? 'real');
    setDescription(domain?.description ?? '');
  }, [open, domain]);

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
      message: isDuplicate
        ? localize('com_ui_memory_domain_name_exists')
        : localize('com_ui_error'),
      status: 'error',
    });
  };

  const { mutate: createDomain, isLoading: isCreating } = useCreateMemoryDomainMutation({
    onSuccess: () => handleSuccess(localize('com_ui_memory_domain_created')),
    onError: handleError,
  });

  const { mutate: updateDomain, isLoading: isUpdating } = useUpdateMemoryDomainMutation({
    onSuccess: () => handleSuccess(localize('com_ui_memory_domain_updated')),
    onError: handleError,
  });

  const isLoading = isCreating || isUpdating;
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  const canSubmit = trimmedName !== '' && trimmedDescription !== '' && !isLoading;
  const submitLabel = isEdit ? localize('com_ui_save') : localize('com_ui_create');

  const handleSave = () => {
    if (!canSubmit) {
      return;
    }
    if (domain != null) {
      updateDomain({
        domainId: domain.id,
        storeId,
        name: trimmedName,
        kind,
        description: trimmedDescription,
      });
      return;
    }
    createDomain({ storeId, name: trimmedName, kind, description: trimmedDescription });
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
        title={
          isEdit ? localize('com_ui_memory_domain_edit') : localize('com_ui_memory_domain_create')
        }
        className="w-11/12 md:max-w-lg"
        main={
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="memory-domain-name" className="text-sm font-medium text-text-primary">
                {localize('com_ui_name')}
              </Label>
              <Input
                id="memory-domain-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={localize('com_ui_name')}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label
                id="memory-domain-kind-label"
                className="text-sm font-medium text-text-primary"
              >
                {localize('com_ui_memory_domain_kind')}
              </Label>
              <div
                role="radiogroup"
                aria-labelledby="memory-domain-kind-label"
                className="flex flex-wrap gap-1.5"
              >
                {MEMORY_DOMAIN_KINDS.map((option) => {
                  const selected = option === kind;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setKind(option)}
                      className={cn(
                        KIND_BUTTON_CLASS,
                        domainKindBadgeColor(option),
                        selected && KIND_BUTTON_SELECTED_CLASS,
                      )}
                    >
                      {localize(MEMORY_DOMAIN_KIND_LABEL_KEYS[option])}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="memory-domain-description"
                className="text-sm font-medium text-text-primary"
              >
                {localize('com_ui_description')}
              </Label>
              <Input
                id="memory-domain-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={localize('com_ui_memory_domain_description_placeholder')}
                className="w-full"
              />
            </div>
          </div>
        }
        buttons={
          <Button
            type="button"
            variant="submit"
            onClick={handleSave}
            disabled={!canSubmit}
            aria-label={submitLabel}
          >
            {isLoading ? <Spinner className="size-4" /> : submitLabel}
          </Button>
        }
      />
    </OGDialog>
  );
}
