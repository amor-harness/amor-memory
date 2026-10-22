const EXTENSION_BY_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const extensionForMime = (mime) => EXTENSION_BY_MIME[mime] ?? 'png';

/** Substring filter standing in for match-sorter in the store search. */
export function matchSorter(items, query, options = {}) {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return items;
  }
  const keys = options.keys ?? [];
  return items.filter((item) =>
    keys.some((key) => {
      const value = typeof key === 'function' ? key(item) : item[key];
      return String(value ?? '').toLowerCase().includes(needle);
    }),
  );
}

export const MEMORY_KEY_PATTERN = /^[a-z0-9_]+$/;

const sameStore = (memory, storeId) => (memory.storeId ?? undefined) === (storeId ?? undefined);

export function getMemoryKeyError({ key, memories, storeId, originalKey }) {
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
  const isTaken = memories?.some(
    (memory) => memory.key === trimmed && sameStore(memory, storeId),
  );
  return isTaken === true ? 'com_ui_memory_key_exists' : null;
}

export function getMemoryValueError(value) {
  return value.trim() ? null : 'com_ui_field_required';
}

export function getMemoryApiErrorMessage(error, fallback) {
  const message = error?.response?.data?.error ?? error?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export { cn } from './runtime.js';

export { getMessageTimestamp } from './datetime.js';
