import { h, Fragment } from '../runtime.js';
import { cn, makeIcon, useLocalize } from '../runtime.js';
import {
  MEMORY_DOMAIN_KIND_LABEL_KEYS,
  domainKindBadgeColor,
} from '../constants.js';

const Database = makeIcon('database');

const CHIP_CLASS =
  'inline-flex min-w-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium';

export default function MemoryDomainChip({ domain, showKind = true, showName = true, className }) {
  const localize = useLocalize();
  const kindLabel = localize(MEMORY_DOMAIN_KIND_LABEL_KEYS[domain.kind]);

  return (
    <span
      className={cn(
        CHIP_CLASS,
        !showName && 'shrink-0',
        domainKindBadgeColor(domain.kind),
        className,
      )}
      title={localize(MEMORY_DOMAIN_KIND_LABEL_KEYS[domain.kind])}
      data-testid="memory-domain-chip"
      data-domain-kind={domain.kind}
      data-domain-id={domain.id}
    >
      <Database className="size-3 shrink-0" aria-hidden="true" />
      <span className="flex min-w-0 items-center">
        {showName && <span className="truncate">{domain.name}</span>}
        {showName && showKind && (
          <span className="mx-1 shrink-0 opacity-80" aria-hidden="true">
            ·
          </span>
        )}
        {showKind && <span className="shrink-0 opacity-80">{kindLabel}</span>}
      </span>
    </span>
  );
}
