import { useLocalize } from '../runtime.js';
import { h, Fragment } from '../runtime.js';
import { makeIcon } from '../runtime.js';

const Database = makeIcon('database');

export default function MemoryEmptyState({ isFiltered = false }) {
  const localize = useLocalize();
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border-light bg-surface-secondary/50 p-6 text-center">
      <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-surface-tertiary">
        <Database className="size-5 text-text-secondary" aria-hidden="true" />
      </div>
      {isFiltered ? (
        <p className="text-sm text-text-secondary">{localize('com_ui_no_memories_match')}</p>
      ) : (
        <>
          <p className="text-sm font-medium text-text-primary">
            {localize('com_ui_no_memories_title')}
          </p>
          <p className="mt-0.5 text-xs text-text-secondary">{localize('com_ui_no_memories')}</p>
        </>
      )}
    </div>
  );
}
