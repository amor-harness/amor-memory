/**
 * Cross-memory `@key` links.
 *
 * A memory value may end with a block of `@memory_key` lines declaring other
 * memories it relates to. A line names one link or several separated by spaces
 * (`@a @b`); that syntax has a single definition in `parseMemoryLinkKeys`,
 * shared with the tag module that reads the same trailing block. Recalled
 * values keep those keys — the model follows a link itself, by reading the
 * linked memory's `/memory/<key>.md` file — but the block is displayed one link
 * per line: the name, with a one-line gist of the memory it points at directly
 * beneath it, so the model can tell whether that read is worth its tokens.
 *
 * The functions are pure but for an injected loader, which keeps the parsing,
 * summarizing and rendering rules unit-testable; callers supply how entries are
 * looked up by key.
 */

import { memoryContentOf, parseMemoryLinkKeys } from '../db/methods.mjs';

/** Characters of a linked memory's value kept as its gist. */
const SUMMARY_MAX_CHARS = 50;

/** How a gist line is introduced, directly under the link it belongs to: a
 *  markdown blockquote, so the gist reads as a gloss on the line above it. */
const SUMMARY_QUOTE = '> ';

/** A memory's display title: a level-1 ATX heading line. */
const TITLE_LINE_PATTERN = /^ {0,3}#(?!#)[ \t]+(.*?)[ \t]*#*[ \t]*$/;

/**
 * Splits a memory value into its content and the contiguous block of trailing
 * `@key` link lines (if any). Only lines at the very end count as links; a
 * marker with extra text or one further up is ordinary content. Returns
 * `{ content, keys }` where `content` is the value without the link block —
 * with any trailing blank lines removed, whether or not links were present —
 * and `keys` preserves their written order, reading each line left to right,
 * repeats included. Non-string values yield empty content.
 */
function parseTrailingLinks(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return { content: '', keys: [] };
  }
  const text = value.trimEnd();
  const lines = text.split('\n');
  const keyLines = [];
  let index = lines.length - 1;
  while (index >= 0) {
    const keysOnLine = parseMemoryLinkKeys(lines[index]);
    if (keysOnLine.length === 0) {
      break;
    }
    keyLines.push(keysOnLine);
    index -= 1;
  }
  if (keyLines.length === 0) {
    return { content: text, keys: [] };
  }
  return {
    content: lines
      .slice(0, index + 1)
      .join('\n')
      .trimEnd(),
    keys: keyLines.reverse().flat(),
  };
}

/**
 * Drops a memory's leading display title — the `#` heading it opens with. The
 * gist is rendered under a link that already names the memory, so the title
 * mostly repeats that name and would spend the gist's whole character budget on
 * it; the body is what tells the model whether a read is worth its tokens. A
 * value that holds nothing but its title (and metadata) keeps the title.
 */
function withoutTitle(content) {
  const lines = content.split('\n');
  let index = 0;
  while (index < lines.length && !lines[index].trim()) {
    index += 1;
  }
  if (index === lines.length || !TITLE_LINE_PATTERN.test(lines[index])) {
    return content;
  }
  const body = lines
    .slice(index + 1)
    .join('\n')
    .trim();
  return body || content;
}

/**
 * One-line gist of a memory: its display title is dropped, its own trailing
 * `@key` lines and `tags:` declarations are not part of it, every run of
 * whitespace — newlines included — collapses into a single space, and the text
 * is capped at {@link SUMMARY_MAX_CHARS} characters. A memory longer than the
 * gist it shows ends with an ellipsis. Values that hold nothing but links
 * summarize to an empty string; a value whose title is all it holds keeps the
 * title.
 */
function summarizeValue(value) {
  const { content } = parseTrailingLinks(memoryContentOf({ value }));
  const text = withoutTitle(content).replace(/\s+/g, ' ').trim();
  if (!text) {
    return '';
  }
  return text.length > SUMMARY_MAX_CHARS ? `${text.slice(0, SUMMARY_MAX_CHARS)}…` : text;
}

/**
 * Renders the trailing `@key` block of `value` for display: every link gets its
 * own line — a line that declared several links is split — and the gist of the
 * memory it points at sits directly under it, so each entry reads as one name
 * with one preview line. Links the map does not resolve keep their name line
 * without a preview. Lines elsewhere in the value are never touched, and a
 * value without trailing links comes back as it was.
 */
function annotateValue(value, summaries) {
  if (typeof value !== 'string' || summaries.size === 0) {
    return value;
  }
  const text = value.trimEnd();
  const lines = text.split('\n');
  const keyLines = [];
  let index = lines.length - 1;
  while (index >= 0) {
    const keysOnLine = parseMemoryLinkKeys(lines[index]);
    if (keysOnLine.length === 0) {
      break;
    }
    keyLines.push(keysOnLine);
    index -= 1;
  }
  if (keyLines.length === 0) {
    return value;
  }
  const block = [];
  for (const keys of keyLines.reverse()) {
    for (const key of keys) {
      block.push(`@${key}`);
      const summary = summaries.get(key);
      if (summary) {
        block.push(`${SUMMARY_QUOTE}${summary}`);
      }
    }
  }
  return [...lines.slice(0, index + 1), ...block].join('\n');
}

/**
 * The trailing `@key` links a stored memory declares, in order. The `tags:`
 * lines are stripped first: a tag line below the links would hide them from the
 * end-of-value scan.
 */
function linksOfMemory(value) {
  return parseTrailingLinks(memoryContentOf({ value })).keys;
}

/**
 * Puts each sectioned memory's trailing `@key` links on the first of its parts
 * in `entries`, and takes them off the others. The links are part of the
 * memory's value, so without this they ride whichever section happened to hold
 * them: repeated when several of its sections are recalled, and absent when the
 * recalled section is another one. The first part carries them, which is also
 * where their gists get rendered.
 *
 * The links land at the very end of that part — behind an omission mark when
 * there is one — because the gist renderer only sees a value's trailing block.
 * A memory recalled whole passes through untouched: its links are already at the
 * end of its own value.
 */
function consolidateTrailingLinks({ entries, documents }) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return entries;
  }
  if (!(documents instanceof Map) || documents.size === 0) {
    return entries;
  }
  const placed = new Set();
  return entries.map((entry) => {
    if (
      entry?.key == null ||
      entry.section == null ||
      entry.section === '' ||
      typeof entry.value !== 'string'
    ) {
      return entry;
    }
    const { content, keys } = parseTrailingLinks(entry.value);
    if (placed.has(entry.key)) {
      return keys.length === 0 ? entry : { ...entry, value: content };
    }
    placed.add(entry.key);
    const document = documents.get(entry.key);
    const memoryKeys = document == null ? [] : linksOfMemory(document.value);
    if (memoryKeys.length === 0) {
      return keys.length === 0 ? entry : { ...entry, value: content };
    }
    return {
      ...entry,
      value: [content, ...memoryKeys.map((key) => `@${key}`)].filter(Boolean).join('\n'),
    };
  });
}

/**
 * Returns copies of `entries` whose trailing `@key` lines each carry a gist of
 * the memory they reference, resolved through `loadEntriesByKeys`. Only copied
 * rows are annotated — the stored memory is never touched — but the copies are
 * what callers inject and surface, so the reply's recalled card shows exactly
 * what the model read. Entries without links, a missing loader, or a failed
 * lookup come back unchanged — as do links whose memory does not resolve or
 * holds nothing but links of its own.
 *
 * @param {Array<{ key?: string; value?: string }>} entries recalled entries
 * @param {(keys: string[]) => Promise<Array<{ key: string; value: string }>>} [loadEntriesByKeys]
 *   resolves a partition's entries by key; optional
 */
async function annotateLinkedSummaries({ entries, loadEntriesByKeys }) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }
  if (typeof loadEntriesByKeys !== 'function') {
    return entries;
  }
  const referenced = new Set();
  for (const entry of entries) {
    for (const key of parseTrailingLinks(entry?.value).keys) {
      referenced.add(key);
    }
  }
  if (referenced.size === 0) {
    return entries;
  }
  let linked;
  try {
    linked = await loadEntriesByKeys([...referenced]);
  } catch {
    return entries;
  }
  if (!Array.isArray(linked) || linked.length === 0) {
    return entries;
  }
  const summaries = new Map();
  for (const entry of linked) {
    if (!entry?.key) {
      continue;
    }
    const summary = summarizeValue(entry.value);
    if (summary) {
      summaries.set(entry.key, summary);
    }
  }
  if (summaries.size === 0) {
    return entries;
  }
  return entries.map((entry) => ({ ...entry, value: annotateValue(entry?.value, summaries) }));
}

const exported = {
  parseTrailingLinks,
  summarizeValue,
  consolidateTrailingLinks,
  annotateLinkedSummaries,
  SUMMARY_MAX_CHARS,
};

export default exported;
