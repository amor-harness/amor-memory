import { h, Fragment } from '../runtime.js';
import { useCallback } from '../runtime.js';
import { VirtualList, useLocalize } from '../runtime.js';
import MemoryEmptyState from './MemoryEmptyState.tsx';
import MemoryCard from './MemoryCard.tsx';
import type { TMemoryDomain } from '../sdk.js';
import type { TUserMemoryWithDomain } from '../data.js';

const MEMORY_ROW_ESTIMATE = 120;
const MEMORY_ROW_GAP = 8;

interface MemoryListProps {
  memories: TUserMemoryWithDomain[];
  hasUpdateAccess: boolean;
  isFiltered?: boolean;
  storeId?: string;
  readOnly?: boolean;
  domainsById?: ReadonlyMap<string, TMemoryDomain>;
}

export default function MemoryList({
  memories,
  hasUpdateAccess,
  isFiltered = false,
  storeId,
  readOnly = false,
  domainsById,
}: MemoryListProps) {
  const localize = useLocalize();

  const getItemKey = useCallback(
    (memory: TUserMemoryWithDomain) => `${memory.storeId ?? ''}:${memory.key}`,
    [],
  );

  const renderMemory = useCallback(
    (memory: TUserMemoryWithDomain) => {
      const domain = memory.domainId != null ? (domainsById?.get(memory.domainId) ?? null) : null;
      return (
        <MemoryCard
          memory={memory}
          hasUpdateAccess={hasUpdateAccess}
          storeId={storeId}
          readOnly={readOnly}
          domain={domain}
        />
      );
    },
    [domainsById, hasUpdateAccess, readOnly, storeId],
  );

  if (memories.length === 0) {
    return <MemoryEmptyState isFiltered={isFiltered} />;
  }

  return (
    <VirtualList
      items={memories}
      estimateSize={MEMORY_ROW_ESTIMATE}
      getItemKey={getItemKey}
      gap={MEMORY_ROW_GAP}
      renderItem={renderMemory}
      role="list"
      rowRole="listitem"
      ariaLabel={localize('com_ui_memories')}
    />
  );
}
