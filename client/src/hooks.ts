import { useRef } from './runtime.js';
import type { CSSProperties, RefObject, UIEvent } from './runtime.js';

/** A card body that scrolls inside the card instead of growing the thread. */
export const BOUNDED_BODY_CLASS = 'max-h-[40dvh] overflow-x-hidden overflow-y-auto [contain:paint]';

export { useExpandCollapse } from './runtime.js';

export interface UseBoundedBodyOptions {
  enabled?: boolean;
}

export interface BoundedBody {
  bodyRef: RefObject<HTMLDivElement>;
  bodyStyle: CSSProperties | undefined;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
}

/** Scroll container for a bounded body. The fade lives in CSS, so the hook
 *  only hands out the ref; a scroll listener is unnecessary. */
export default function useBoundedBody(_options: UseBoundedBodyOptions = {}): BoundedBody {
  const bodyRef = useRef<HTMLDivElement>(null);
  return { bodyRef, bodyStyle: undefined, onScroll: () => {} };
}
