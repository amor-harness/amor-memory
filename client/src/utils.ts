import type { TUserMemory } from './sdk.js';
import type { TranslationKeys } from './runtime.js';

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const extensionForMime = (mime: string | null | undefined): string =>
  (mime != null ? EXTENSION_BY_MIME[mime] : undefined) ?? 'png';

export type MatchSorterKey<T> = keyof T | ((item: T) => unknown);

export interface MatchSorterOptions<T> {
  keys?: ReadonlyArray<MatchSorterKey<T>>;
}

/** Substring filter standing in for match-sorter in the store search. */
export function matchSorter<T>(
  items: T[],
  query: string,
  options: MatchSorterOptions<T> = {},
): T[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return items;
  }
  const keys = options.keys ?? [];
  return items.filter((item) =>
    keys.some((key) => {
      const value = typeof key === 'function' ? key(item) : item[key];
      return String(value ?? '')
        .toLowerCase()
        .includes(needle);
    }),
  );
}

export const MEMORY_KEY_PATTERN = /^[a-z0-9_]+$/;

export interface MemoryKeyValidationInput {
  key: string;
  memories?: readonly TUserMemory[];
  storeId?: string;
  originalKey?: string;
}

const sameStore = (memory: TUserMemory, storeId?: string): boolean =>
  (memory.storeId ?? undefined) === (storeId ?? undefined);

export function getMemoryKeyError({
  key,
  memories,
  storeId,
  originalKey,
}: MemoryKeyValidationInput): TranslationKeys | null {
  const trimmed = key.trim();
  if (!trimmed) {
    return 'com_ui_field_required';
  }
  if (!MEMORY_KEY_PATTERN.test(trimmed)) {
    return 'com_ui_memory_key_validation';
  }
  if (trimmed === originalKey) {
    return null;
  }
  const isTaken = memories?.some((memory) => memory.key === trimmed && sameStore(memory, storeId));
  return isTaken === true ? 'com_ui_memory_key_exists' : null;
}

export function getMemoryValueError(value: string): TranslationKeys | null {
  return value.trim() ? null : 'com_ui_field_required';
}

export interface MemoryApiErrorShape {
  response?: { data?: { error?: unknown } };
  message?: unknown;
}

export function getMemoryApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null) {
    return fallback;
  }
  const candidate = error as MemoryApiErrorShape;
  const message = candidate.response?.data?.error ?? candidate.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export { cn } from './runtime.js';

export { getMessageTimestamp } from './datetime.js';
