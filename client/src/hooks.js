import { useRef } from './runtime.js';

/** A card body that scrolls inside the card instead of growing the thread. */
export const BOUNDED_BODY_CLASS =
  'max-h-[40dvh] overflow-x-hidden overflow-y-auto [contain:paint]';

export { useExpandCollapse } from './runtime.js';

/** Scroll container for a bounded body. The fade lives in CSS, so the hook
 *  only hands out the ref; a scroll listener is unnecessary. */
export default function useBoundedBody() {
  const bodyRef = useRef(null);
  return { bodyRef, bodyStyle: undefined, onScroll: () => {} };
}
