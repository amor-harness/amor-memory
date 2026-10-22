import { h, Fragment } from '../runtime.js';
import { useMemo, useState, useRef, useCallback } from '../runtime.js';
import { Alert, Spinner } from '../runtime.js';
import type { MemoryArtifact } from '../sdk.js';
import DialogImage from './DialogImage.tsx';
import MemoryDomainChip from './MemoryDomainChip.tsx';
import { useVFSImageSrcQuery, useMemoryDomainsQuery } from '../data.js';
import { extensionForMime } from '../utils.js';
import { useLocalize } from '../runtime.js';

/** When a picture entered memory, in the reader's own date/time format. */
function formatStoredAt(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Titles a recalled image as when it was stored plus its resolution, e.g.
 * `2026年9月10日 00:15:32 (1024×683)`. Falls back to the memory id when the
 * artifact predates the timestamp being recorded.
 */
function imageTitleOf(artifact: MemoryArtifact): string {
  const parts: string[] = [];
  const storedAt = artifact.updatedAt != null ? formatStoredAt(artifact.updatedAt) : null;
  if (storedAt != null) {
    parts.push(storedAt);
  }
  if (artifact.width != null && artifact.height != null) {
    parts.push(`(${artifact.width}×${artifact.height})`);
  }
  return parts.length > 0 ? parts.join(' ') : artifact.key;
}

/** A memory's domain (when the write recorded one) plus its cue anchors, under
 *  its prose. Both the recalled and the updated card render them the same way;
 *  the domain chip leads, so a recalled game-world memory cannot read as a cue
 *  anchor of a real-life one. */
function MemoryDomainAndTags({ artifact }: { artifact: MemoryArtifact }) {
  const { data } = useMemoryDomainsQuery(artifact.storeId);
  const domains = data?.domains;
  const domain =
    artifact.domainId != null
      ? domains?.find((entry) => entry.id === artifact.domainId)
      : undefined;
  const tags = artifact.tags;

  if (domain == null && (tags == null || tags.length === 0)) {
    return null;
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {domain != null && <MemoryDomainChip domain={domain} />}
      {tags?.map((tag) => (
        <span
          key={tag}
          className="rounded-full border border-border-heavy bg-surface-tertiary px-2 py-0.5 text-xs text-text-secondary"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

/** A recalled image memory has no text value; it is shown as its picture,
 *  served through the VFS like any other memory-file image. */
function RecalledMemoryItem({ artifact }: { artifact: MemoryArtifact }) {
  const localize = useLocalize();
  const isImage = artifact.kind === 'image';
  const title = isImage ? imageTitleOf(artifact) : artifact.key;
  const [previewOpen, setPreviewOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { data: imageSrc, isLoading } = useVFSImageSrcQuery(
    isImage && artifact.url != null ? artifact.url : null,
  );
  const hasImage = imageSrc != null && imageSrc !== '';

  /** The thumbnail is a `blob:` URL, so the download saves the bytes the card
   *  already holds under a readable name. */
  const downloadImage = useCallback(() => {
    if (imageSrc == null || imageSrc === '') {
      return;
    }
    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = `memory-image.${extensionForMime(artifact.mime)}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [imageSrc, artifact.mime]);

  return (
    <div className="rounded-lg p-3">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-text-secondary">
        {title}
      </div>
      {isImage ? (
        /** `w-fit` keeps the framed box sized to the picture instead of
         *  stretching to the panel width; `max-w-full` still caps a picture
         *  wider than the card. */
        <div className="w-fit max-w-full overflow-hidden rounded-md border border-border-light bg-surface-tertiary">
          {isLoading && (
            <div className="flex h-20 w-40 items-center justify-center">
              <Spinner className="size-4 text-text-secondary" />
            </div>
          )}
          {!isLoading && hasImage && (
            <button
              ref={triggerRef}
              type="button"
              aria-label={`View ${title} in dialog`}
              aria-haspopup="dialog"
              onClick={() => setPreviewOpen(true)}
              className="relative block cursor-zoom-in p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary"
            >
              <img
                src={imageSrc}
                alt={title}
                loading="lazy"
                className="block h-auto max-h-48 w-auto max-w-full object-contain"
              />
            </button>
          )}
          {!isLoading && !hasImage && (
            <span className="block px-3 py-6 text-xs text-text-secondary">
              {localize('com_ui_memory_image_unavailable')}
            </span>
          )}
        </div>
      ) : (
        <div className="whitespace-pre-wrap text-sm text-text-primary">{artifact.value}</div>
      )}

      {!isImage && <MemoryDomainAndTags artifact={artifact} />}

      {isImage && hasImage && (
        <DialogImage
          isOpen={previewOpen}
          onOpenChange={setPreviewOpen}
          src={imageSrc}
          downloadImage={downloadImage}
          triggerRef={triggerRef}
        />
      )}
    </div>
  );
}

export default function MemoryInfo({ memoryArtifacts }: { memoryArtifacts: MemoryArtifact[] }) {
  const localize = useLocalize();

  const { recalledMemories, updatedMemories, deletedMemories, errorMessages } = useMemo(() => {
    const recalled = memoryArtifacts.filter((art) => art.type === 'recall');
    const updated = memoryArtifacts.filter((art) => art.type === 'update');
    const deleted = memoryArtifacts.filter((art) => art.type === 'delete');
    const errors = memoryArtifacts.filter((art) => art.type === 'error');

    const messages = errors.map((artifact) => {
      try {
        const errorData = JSON.parse(artifact.value as string);

        if (errorData.errorType === 'already_exceeded') {
          return localize('com_ui_memory_already_exceeded', {
            tokens: errorData.tokenCount,
          });
        } else if (errorData.errorType === 'would_exceed') {
          return localize('com_ui_memory_would_exceed', {
            tokens: errorData.tokenCount,
          });
        } else {
          return localize('com_ui_memory_error');
        }
      } catch {
        return localize('com_ui_memory_error');
      }
    });

    return {
      recalledMemories: recalled,
      updatedMemories: updated,
      deletedMemories: deleted,
      errorMessages: messages,
    };
  }, [memoryArtifacts, localize]);

  if (memoryArtifacts.length === 0) {
    return null;
  }

  if (
    recalledMemories.length === 0 &&
    updatedMemories.length === 0 &&
    deletedMemories.length === 0 &&
    errorMessages.length === 0
  ) {
    return null;
  }

  return (
    <div className="space-y-4 p-4">
      {recalledMemories.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-text-primary">
            {localize('com_ui_memory_recalled_items')}
          </h4>
          <div className="space-y-2">
            {recalledMemories.map((artifact) => (
              <RecalledMemoryItem
                key={`recall-${artifact.key}-${artifact.section ?? ''}`}
                artifact={artifact}
              />
            ))}
          </div>
        </div>
      )}

      {updatedMemories.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-text-primary">
            {localize('com_ui_memory_updated_items')}
          </h4>
          <div className="space-y-2">
            {updatedMemories.map((artifact) => (
              <div key={`update-${artifact.key}`} className="rounded-lg p-3">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-text-secondary">
                  {artifact.key}
                </div>
                <div className="whitespace-pre-wrap text-sm text-text-primary">
                  {artifact.content ?? artifact.value}
                </div>
                <MemoryDomainAndTags artifact={artifact} />
              </div>
            ))}
          </div>
        </div>
      )}

      {deletedMemories.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-text-primary">
            {localize('com_ui_memory_deleted_items')}
          </h4>
          <div className="space-y-2">
            {deletedMemories.map((artifact) => (
              <div key={`delete-${artifact.key}`} className="rounded-lg p-3 opacity-60">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-text-secondary">
                  {artifact.key}
                </div>
                <div className="text-sm italic text-text-secondary">
                  {localize('com_ui_memory_deleted')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {errorMessages.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-text-destructive">
            {localize('com_ui_memory_storage_full')}
          </h4>
          <div className="space-y-2">
            {errorMessages.map((errorMessage) => (
              <Alert key={errorMessage} variant="error" icon={false} className="rounded-md p-3">
                {errorMessage}
              </Alert>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
