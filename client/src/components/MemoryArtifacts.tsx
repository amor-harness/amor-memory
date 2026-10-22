import { h, Fragment } from '../runtime.js';
import { useState, useRef, useMemo, useLayoutEffect } from '../runtime.js';
const Tools = { memory: 'memory' };
import MemoryInfo from './MemoryInfo.tsx';
import useBoundedBody, { BOUNDED_BODY_CLASS } from '../hooks.js';
import { useExpandCollapse } from '../hooks.js';
import { useLocalize } from '../runtime.js';
import { cn } from '../utils.js';

/** Layout-gate predicate for callers that arrange around this component
 * (e.g. the thinking-dot nudge). Must stay in agreement with the memo's
 * collection condition inside the component — both key on
 * `attachment[Tools.memory]`. The component itself guards on its memoized
 * list instead, avoiding a second pass per render. */
export const hasMemoryArtifacts = (attachments?: TAttachment[]): boolean =>
  attachments?.some((attachment) => attachment?.[Tools.memory] != null) ?? false;

export default function MemoryArtifacts({ attachments }: { attachments?: TAttachment[] }) {
  const localize = useLocalize();
  const [showInfo, setShowInfo] = useState(false);
  const { style: expandStyle, ref: expandRef } = useExpandCollapse(showInfo);
  /** The card's content is bounded and scrolls inside the card (the rule every
   *  card body follows — see `useBoundedBody`): a recall can carry a long list of
   *  memories, and growing to all of it at once pushed the thread under the reader.
   *
   *  The scroll container is an inner body, not the card itself: the edge fade is a
   *  mask, and a mask clips its own element's painting to the mask box — it would
   *  take the card's drop shadow with it. Nothing here streams into an open card,
   *  so the body never follows. */
  const { bodyRef, bodyStyle, onScroll } = useBoundedBody({ enabled: showInfo });

  const { hasErrors, memoryArtifacts } = useMemo(() => {
    let hasErrors = false;
    const result: MemoryArtifact[] = [];

    if (!attachments || attachments.length === 0) {
      return { hasErrors, memoryArtifacts: result };
    }

    for (const attachment of attachments) {
      if (attachment?.[Tools.memory] != null) {
        result.push(attachment[Tools.memory]);

        if (!hasErrors && attachment[Tools.memory].type === 'error') {
          hasErrors = true;
        }
      }
    }

    return { hasErrors, memoryArtifacts: result };
  }, [attachments]);

  /** A reply that only recalled ephemeral memories titles the prompt with the
   *  recall label; anything else keeps the write-oriented wording. */
  const recalledOnly =
    memoryArtifacts.length > 0 && memoryArtifacts.every((artifact) => artifact.type === 'recall');

  /** A card that arrives while this component instance is already mounted
   *  (memory extraction persists its attachment after the stream closed, then
   *  the message refetches) must never surface pre-opened: fold it on first
   *  appearance instead of inheriting whatever showInfo the reused instance
   *  happened to hold. */
  const hasArtifacts = memoryArtifacts.length > 0;
  const hadArtifactsRef = useRef(false);
  useLayoutEffect(() => {
    if (hasArtifacts && !hadArtifactsRef.current) {
      setShowInfo(false);
    }
    hadArtifactsRef.current = hasArtifacts;
  }, [hasArtifacts]);

  if (!hasArtifacts) {
    return null;
  }

  let memoryLabel = localize('com_ui_memory_updated');
  if (hasErrors) {
    memoryLabel = localize('com_ui_memory_error');
  } else if (recalledOnly) {
    memoryLabel = localize('com_ui_memory_recalled');
  }

  return (
    <div>
      <div className="flex items-center">
        <div className="inline-block">
          <button
            className={cn(
              'flex items-center gap-1 py-1.5 text-sm font-semibold transition-colors',
              hasErrors ? 'text-status-error' : 'text-text-secondary-alt hover:text-text-primary',
            )}
            type="button"
            onClick={() => setShowInfo((prev) => !prev)}
            aria-expanded={showInfo}
            aria-label={memoryLabel}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="mb-[-1px]"
            >
              <path
                d="M6 3C4.89543 3 4 3.89543 4 5V13C4 14.1046 4.89543 15 6 15L6 3Z"
                fill="currentColor"
              />
              <path
                d="M7 3V15H8.18037L8.4899 13.4523C8.54798 13.1619 8.69071 12.8952 8.90012 12.6858L12.2931 9.29289C12.7644 8.82153 13.3822 8.58583 14 8.58578V3.5C14 3.22386 13.7761 3 13.5 3H7Z"
                fill="currentColor"
              />
              <path
                d="M11.3512 15.5297L9.73505 15.8529C9.38519 15.9229 9.07673 15.6144 9.14671 15.2646L9.46993 13.6484C9.48929 13.5517 9.53687 13.4628 9.60667 13.393L12.9996 10C13.5519 9.44771 14.4473 9.44771 14.9996 10C15.5519 10.5523 15.5519 11.4477 14.9996 12L11.6067 15.393C11.5369 15.4628 11.448 15.5103 11.3512 15.5297Z"
                fill="currentColor"
              />
            </svg>
            {memoryLabel}
          </button>
        </div>
      </div>
      <div style={expandStyle} aria-hidden={!showInfo || undefined}>
        <div className="overflow-hidden" ref={expandRef}>
          <div
            className={cn(
              // The offset lives inside the clipped element: a margin on the
              // 0fr grid item itself still reserves space while collapsed.
              // `lc-card-surface` puts the card on the content-card alpha
              // (`style.css`): its own tone is a role that rule cannot name.
              // `overflow-hidden` keeps the scrolled content off the card's
              // rounded corners.
              'lc-card-surface mt-2 overflow-hidden rounded-xl border border-border-light bg-surface-primary-alt shadow-md',
              showInfo && 'shadow-lg',
            )}
          >
            <div ref={bodyRef} onScroll={onScroll} style={bodyStyle} className={BOUNDED_BODY_CLASS}>
              {/* MemoryInfo stays mounted while artifacts exist so collapse
               * mirrors expand — the grid disclosure hides it via row/opacity
               * instead of unmounting content (which would look instant). */}
              <MemoryInfo memoryArtifacts={memoryArtifacts} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
