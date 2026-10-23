import { h, Fragment } from '../runtime.js';
import { useCallback, useRef, useState } from '../runtime.js';
import { Spinner, cn, makeIcon, useLocalize } from '../runtime.js';
import { formatMemoryDateTime } from '../datetime.js';
import { extensionForMime } from '../utils.js';
import { useVFSImageSrcQuery } from '../data.js';
import MemoryCardActions from './MemoryCardActions.tsx';
import MemoryDomainChip from './MemoryDomainChip.tsx';
import DialogImage from './DialogImage.tsx';
import type { TMemoryDomain, TUserMemory } from '../sdk.js';

const Lock = makeIcon('lock');

const STATUS_CHIP_CLASS =
  'shrink-0 rounded-full border border-border-heavy bg-surface-tertiary px-2 py-0.5 text-xs font-medium text-text-primary';

const CARD_SURFACE_CLASS = 'bg-surface-secondary/50 hover:bg-surface-hover';

const formatDate = (dateString: string): string =>
  new Date(dateString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

interface MemoryCardProps {
  memory: TUserMemory;
  hasUpdateAccess: boolean;
  storeId?: string;
  readOnly?: boolean;
  domain?: TMemoryDomain | null;
}

export default function MemoryCard({
  memory,
  hasUpdateAccess,
  storeId,
  readOnly = false,
  domain = null,
}: MemoryCardProps) {
  const localize = useLocalize();
  const isImage = memory.kind === 'image';
  const [previewOpen, setPreviewOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { data: imageSrc, isLoading: isImageLoading } = useVFSImageSrcQuery(
    isImage ? memory.sha256 : null,
  );

  const downloadImage = useCallback(() => {
    if (imageSrc == null || imageSrc === '') {
      return;
    }
    const filename = `memory-${memory.key.slice(0, 12)}.${extensionForMime(memory.mime)}`;
    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [imageSrc, memory.key, memory.mime]);

  return (
    <div
      className={cn(
        'rounded-lg px-3 py-2.5 transition-colors',
        memory.stable === true ? 'border border-border-heavy' : 'border border-border-light',
        CARD_SURFACE_CLASS,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex min-w-0 items-center gap-1">
          {memory.locked === true && (
            <span
              className="flex shrink-0 items-center text-status-warning"
              role="img"
              aria-label={localize('com_ui_memory_locked')}
              title={localize('com_ui_memory_locked_desc')}
              data-testid="memory-locked-indicator"
            >
              <Lock className="size-3.5" aria-hidden="true" />
            </span>
          )}
          <span className="truncate text-sm font-semibold text-text-primary">{memory.key}</span>
        </span>
        {isImage && (
          <span className={STATUS_CHIP_CLASS} title={memory.mime}>
            {localize('com_ui_memory_image')}
          </span>
        )}
        {memory.stable === true && (
          <span className={STATUS_CHIP_CLASS} title={localize('com_ui_memory_stable')}>
            {localize('com_ui_memory_stable')}
          </span>
        )}
        {hasUpdateAccess && !readOnly && (
          <div className="ml-auto shrink-0">
            <MemoryCardActions memory={memory} storeId={storeId} readOnly={readOnly} />
          </div>
        )}
      </div>

      {isImage ? (
        <div className="mt-1.5 overflow-hidden rounded-md border border-border-light bg-surface-tertiary">
          {isImageLoading && (
            <div className="flex h-40 w-full items-center justify-center">
              <Spinner className="size-4 text-text-secondary" />
            </div>
          )}
          {!isImageLoading && imageSrc != null && imageSrc !== '' && (
            <button
              ref={triggerRef}
              type="button"
              aria-label={`View ${memory.key} in dialog`}
              aria-haspopup="dialog"
              onClick={() => setPreviewOpen(true)}
              className="relative block w-full cursor-zoom-in p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary"
            >
              <img
                src={imageSrc}
                alt={memory.key}
                loading="lazy"
                className="block h-40 w-full object-cover"
              />
            </button>
          )}
          {!isImageLoading && (imageSrc == null || imageSrc === '') && (
            <div className="flex h-20 w-full items-center justify-center">
              <span className="text-xs text-text-secondary">
                {localize('com_ui_memory_image_unavailable')}
              </span>
            </div>
          )}
        </div>
      ) : (
        <p
          className="mt-1 line-clamp-2 min-w-0 break-words text-sm leading-relaxed text-text-primary"
          title={memory.value}
        >
          {memory.content ?? memory.value}
        </p>
      )}

      {!isImage && (domain != null || (memory.tags != null && memory.tags.length > 0)) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {domain != null && <MemoryDomainChip domain={domain} />}
          {memory.tags?.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border-heavy bg-surface-tertiary px-2 py-0.5 text-xs text-text-secondary"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-1 flex items-center gap-2 text-xs text-text-secondary">
        <span className="shrink-0">{formatDate(memory.updated_at)}</span>
        {isImage && memory.width != null && memory.height != null && (
          <span className="ml-auto shrink-0">
            {memory.width}×{memory.height}
          </span>
        )}
        {!isImage && memory.tokenCount !== undefined && (
          <span className="ml-auto shrink-0">
            {memory.tokenCount}{' '}
            {localize(memory.tokenCount === 1 ? 'com_ui_token' : 'com_ui_tokens')}
          </span>
        )}
      </div>

      {isImage && imageSrc != null && imageSrc !== '' && (
        <DialogImage
          isOpen={previewOpen}
          onOpenChange={setPreviewOpen}
          src={imageSrc}
          downloadImage={downloadImage}
          triggerRef={triggerRef}
          alt={memory.key}
        />
      )}
    </div>
  );
}
