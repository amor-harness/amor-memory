import { h, Fragment } from '../runtime.js';
import {
  ControlCombobox,
  FieldMessage,
  Input,
  Label,
  Radio,
  Switch,
  Textarea,
} from '../runtime.js';
import type { MemoryInjection, OptionWithIcon, TMemoryDomain } from '../sdk.js';
import type React from '../runtime.js';

import type { TranslationKeys } from '../runtime.js';
import { MEMORY_DOMAIN_KIND_LABEL_KEYS } from '../constants.js';
import { useLocalize } from '../runtime.js';

export interface MemoryFormFieldsProps {
  keyValue: string;
  onKeyChange: (value: string) => void;
  onKeyBlur?: () => void;
  value: string;
  onValueChange: (value: string) => void;
  onValueBlur?: () => void;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  disabled?: boolean;
  /** Live validation messages; the edit dialog has none and omits them. */
  keyError?: TranslationKeys | null;
  valueError?: TranslationKeys | null;
  /** Tells the caller whether to render the error line, so a pristine field
   *  stays quiet until the user has touched it. */
  showKeyError?: boolean;
  showValueError?: boolean;
  /** Show the "lowercase letters, numbers, underscores" hint under the key. */
  showKeyHint?: boolean;
  /** Domains the memory can be filed under. Absent or empty hides the field
   *  entirely: a failed domain list must never block editing. */
  domains?: TMemoryDomain[];
  /** Currently selected domain id. */
  domainId?: string;
  onDomainChange?: (domainId: string) => void;
  /** Disables the domain selector (a read-only store still shows the domain). */
  domainDisabled?: boolean;
  /** Ride the stable system baseline instead of per-turn recall. */
  stable?: boolean;
  onStableChange?: (stable: boolean) => void;
  /** Which prompt carries a stable memory every turn. */
  injection?: MemoryInjection;
  onInjectionChange?: (injection: MemoryInjection) => void;
  /** Hide the memory from the extractor and refuse every LLM write path. */
  locked?: boolean;
  onLockedChange?: (locked: boolean) => void;
  /** Disables both flags (a read-only store still shows them). */
  flagsDisabled?: boolean;
}

/** One boolean memory flag (stable / locked) rendered as a switch row, with an
 *  optional extra control stacked underneath within the same card. */
function MemoryFlagToggle({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  footer,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled: boolean;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border-medium bg-surface-secondary px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium text-text-primary">{label}</span>
          <span className="text-xs text-text-secondary">{description}</span>
        </div>
        <Switch
          size="small"
          aria-label={label}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          className="shrink-0"
        />
      </div>
      {footer}
    </div>
  );
}

/**
 * The fields every memory dialog edits — key, value, the domain it belongs to,
 * and its stable / locked flags. Shared by create and edit so the two dialogs
 * cannot drift apart: the create dialog adds validation messages, the edit
 * dialog adds its metadata line, but the fields themselves are defined once,
 * here.
 */
export default function MemoryFormFields({
  keyValue,
  onKeyChange,
  onKeyBlur,
  value,
  onValueChange,
  onValueBlur,
  onKeyDown,
  disabled = false,
  keyError,
  valueError,
  showKeyError = false,
  showValueError = false,
  showKeyHint = false,
  domains,
  domainId,
  onDomainChange,
  domainDisabled = false,
  stable = false,
  onStableChange,
  injection = 'system',
  onInjectionChange,
  locked = false,
  onLockedChange,
  flagsDisabled = false,
}: MemoryFormFieldsProps) {
  const localize = useLocalize();

  /** The domain list is part of the store's identity, so the option label
   *  carries the kind — "Fictional" is what makes a game world unmistakable. */
  const domainItems: OptionWithIcon[] = (domains ?? []).map((domain) => ({
    value: domain.id,
    label: `${domain.name} · ${localize(MEMORY_DOMAIN_KIND_LABEL_KEYS[domain.kind])}`,
  }));
  const selectedDomain = (domains ?? []).find((domain) => domain.id === domainId);

  /** The injection point only matters while the memory is stable: an ephemeral
   *  memory is recalled per-turn by relevance and never carried in either
   *  prompt. */
  const injectionOptions = [
    { value: 'system', label: localize('com_ui_memory_injection_system') },
    { value: 'additional', label: localize('com_ui_memory_injection_additional') },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="memory-key" className="text-sm font-medium text-text-primary">
          {localize('com_ui_key')}
        </Label>
        <Input
          id="memory-key"
          aria-label={localize('com_ui_key')}
          value={keyValue}
          onChange={(event) => onKeyChange(event.target.value)}
          onBlur={onKeyBlur}
          onKeyDown={onKeyDown}
          placeholder={localize('com_ui_enter_key')}
          className="w-full"
          disabled={disabled}
          aria-invalid={showKeyError && keyError != null}
          aria-describedby={keyError != null ? 'memory-key-message' : undefined}
        />
        {/** `FieldMessage` reserves its `lines` worth of height up front, so an
         *  empty one is a visible gap between the field and what follows. Render
         *  it only when it actually carries something. */}
        {((showKeyError && keyError != null) || showKeyHint) && (
          <FieldMessage
            id="memory-key-message"
            message={showKeyError && keyError ? localize(keyError) : null}
            hint={showKeyHint ? localize('com_ui_memory_key_hint') : undefined}
            lines={2}
          />
        )}
      </div>

      {domainItems.length > 0 && onDomainChange != null && (
        <div className="space-y-2">
          <Label htmlFor="memory-domain" className="text-sm font-medium text-text-primary">
            {localize('com_ui_memory_domain')}
          </Label>
          <ControlCombobox
            isCollapsed={false}
            ariaLabel={localize('com_ui_memory_domain')}
            selectedValue={domainId ?? ''}
            displayValue={selectedDomain?.name}
            setValue={onDomainChange}
            selectPlaceholder={localize('com_ui_select_memory_domain')}
            searchPlaceholder={localize('com_ui_search_memory_domains')}
            items={domainItems}
            className="h-9 border-border-light"
            containerClassName="px-0"
            disabled={domainDisabled}
            /** The dialog traps focus, so the popover renders in place; no
             *  ancestor in `OGDialogTemplate` clips it. */
            portal={false}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="memory-value" className="text-sm font-medium text-text-primary">
          {localize('com_ui_value')}
        </Label>
        <Textarea
          id="memory-value"
          aria-label={localize('com_ui_value')}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onBlur={onValueBlur}
          onKeyDown={onKeyDown}
          placeholder={localize('com_ui_enter_value')}
          className="min-h-[150px] w-full resize-none rounded-lg border border-border-light bg-surface-secondary/50 px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-heavy disabled:cursor-not-allowed disabled:opacity-50"
          rows={8}
          disabled={disabled}
          aria-invalid={showValueError && valueError != null}
          aria-describedby={valueError != null ? 'memory-value-message' : undefined}
        />
        {showValueError && valueError != null && (
          <FieldMessage id="memory-value-message" message={localize(valueError)} />
        )}
      </div>

      {onStableChange != null && (
        <MemoryFlagToggle
          label={localize('com_ui_memory_stable')}
          description={localize('com_ui_memory_stable_desc')}
          checked={stable}
          onCheckedChange={onStableChange}
          disabled={flagsDisabled}
          footer={
            stable && onInjectionChange != null ? (
              <div className="flex flex-col gap-2">
                <span id="memory-injection-label" className="text-xs font-medium text-text-primary">
                  {localize('com_ui_memory_injection')}
                </span>
                <Radio
                  options={injectionOptions}
                  value={injection}
                  onChange={(value) => onInjectionChange(value as MemoryInjection)}
                  disabled={flagsDisabled}
                  fullWidth
                  aria-labelledby="memory-injection-label"
                />
              </div>
            ) : null
          }
        />
      )}

      {onLockedChange != null && (
        <MemoryFlagToggle
          label={localize('com_ui_memory_locked')}
          description={localize('com_ui_memory_locked_desc')}
          checked={locked}
          onCheckedChange={onLockedChange}
          disabled={flagsDisabled}
        />
      )}
    </div>
  );
}
