import { useMemo, useRef } from './runtime.js';

/** A card body that scrolls inside the card instead of growing the thread. */
export const BOUNDED_BODY_CLASS =
  'max-h-[40dvh] overflow-x-hidden overflow-y-auto [contain:paint]';

/** The disclosure geometry: the row takes 0fr closed and 1fr open, animated. */
export function useExpandCollapse(isExpanded) {
  const ref = useRef(null);
  const style = useMemo(
    () => ({
      display: 'grid',
      gridTemplateRows: isExpanded ? '1fr' : '0fr',
      transition: 'grid-template-rows 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    }),
    [isExpanded],
  );
  return { style, ref };
}

/** Scroll container for a bounded body. The fade lives in CSS, so the hook
 *  only hands out the ref; a scroll listener is unnecessary. */
export default function useBoundedBody() {
  const bodyRef = useRef(null);
  return { bodyRef, bodyStyle: undefined, onScroll: () => {} };
}
