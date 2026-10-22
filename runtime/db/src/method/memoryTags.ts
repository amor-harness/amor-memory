/**
 * Memory tags.
 *
 * A memory value may end with one or more `tags:a|b` lines declaring the
 * memory's cue anchors. Like a trailing `@key` link, a tag line is metadata:
 * it rides the stored value (the memory document stays the single source of
 * truth, and a user can edit tags straight in the panel or the `/memory`
 * files) but is rendered as a first-class `["tags": ...]` field wherever the
 * memory is injected, instead of being shown as prose. The canonical separator
 * is `|`; commas and the full-width forms are read as separators too, so a
 * declaration written as `tags:a, b` means the same set.
 *
 * Only the contiguous block at the very end of a value is metadata. A `tags:`
 * line that has content after it is ordinary text, so a memory that discusses
 * the syntax itself survives intact. Tag lines and link lines may interleave
 * inside that block; both keep working, and the tag lines are collected from
 * every line of the block. A link line may name one memory (`@key`) or several
 * separated by spaces (`@a @b`); see {@link parseMemoryLinkKeys}.
 *
 * The module is pure: parsing, normalization and rendering only, no I/O, so
 * the write path (which materializes the parsed tags) and every render path
 * share one definition of what a tag is.
 */

/** Introduces a tag line. Matched case-insensitively so `Tags:` works too. */
export const TAG_PREFIX = 'tags:';

/** Separates several tags on one line. */
export const TAG_SEPARATOR = '|';

/**
 * Every separator a declaration may be written with: the canonical `|`, its
 * full-width form, and the commas — half-width, full-width and ideographic — a
 * model or a hand edit reaches for when listing anchors. Only the canonical one
 * is ever written back, but reading all of them keeps one comma-separated
 * declaration from collapsing into a single long tag, which would show as one
 * chip and match nothing at recall time. A tag is a short cue anchor, so a
 * comma inside one is not a meaningful character to preserve.
 */
const TAG_DELIMITER_PATTERN = /[|｜,，、]/;

/** Splits one raw declaration token on every accepted separator. */
function splitTagTokens(raw: string): string[] {
  return typeof raw === 'string' ? raw.split(TAG_DELIMITER_PATTERN) : [];
}

/** Safe bounds: a tag line is user-facing text, so neither the tag length nor
 *  the count may be unbounded — an oversized list would ride every prompt the
 *  memory appears in. Overlong tags are dropped rather than truncated, which
 *  keeps a typo from silently becoming a different tag. */
export const MAX_TAG_CHARS = 32;
export const MAX_TAGS_PER_MEMORY = 24;

/** A tag line is `tags:` followed by at least one non-space character. An
 *  empty payload is not metadata, so a value ending in the literal text
 *  `tags:` keeps that line. */
const TAG_LINE_PATTERN = /^\s*tags:\s*(\S.*)$/i;

/**
 * A link line is nothing but `@key` markers: one per line as before, or several
 * on one line separated by horizontal whitespace (`@a @b`). A key is one or
 * more Unicode letters, digits or underscores, so the CJK and uppercase keys
 * the store actually holds (`@世界观备忘`, `@NPC名册`) parse like any ASCII
 * one; the link alphabet has to cover the key alphabet, or a link to a real
 * memory would silently degrade to prose. A line carrying anything else — a
 * sentence, a comma, punctuation inside a token — is ordinary text, not
 * metadata. The full-width space a model may type counts as a separator, a
 * newline does not: a caller passes one line at a time, so a multi-line string
 * must not read as a single link line.
 *
 * Mirrors the `@key` link syntax in the API layer: a tag line may sit next to a
 * link line inside the same trailing block, so the block scan has to recognize
 * both.
 */
const LINK_KEY_TOKEN = '@[\\p{L}\\p{N}_]+';
const LINK_LINE_PATTERN = new RegExp(`^${LINK_KEY_TOKEN}(?:[^\\S\\n]+${LINK_KEY_TOKEN})*$`, 'u');

/** Separates several links on one line. */
const LINK_SEPARATOR_PATTERN = /[^\S\n]+/;

/**
 * The memory keys a link line declares, in the order written; empty when the
 * line is not a link line. The single source of truth for the `@key` link
 * syntax: the tag module reads it to find the trailing metadata block, and the
 * recall layer reads it to annotate each link with a gist.
 */
export function parseMemoryLinkKeys(line: string): string[] {
  if (typeof line !== 'string') {
    return [];
  }
  const text = line.trim();
  if (!LINK_LINE_PATTERN.test(text)) {
    return [];
  }
  return text.split(LINK_SEPARATOR_PATTERN).map((token) => token.slice(1));
}

export interface ParsedMemoryTags {
  /** The value without its trailing tag lines; `@key` links are preserved. */
  content: string;
  /** Normalized tags, in the order they were declared, deduplicated. */
  tags: string[];
}

/** Minimal entry shape the tag renderers accept. */
export interface MemoryTagEntry {
  value?: string;
  tags?: string[];
}

/**
 * Canonical form of one tag: Unicode-normalized (full-width → half-width),
 * trimmed, internal whitespace collapsed to a single space, ASCII lowercased,
 * and with a leading `#` dropped (`#coffee` and `Coffee` are one tag). Quotes
 * are removed because the tag is rendered inside a quoted prompt field.
 * Returns an empty string when nothing usable is left.
 */
export function normalizeTag(raw: string): string {
  if (typeof raw !== 'string') {
    return '';
  }
  const normalized = raw
    .normalize('NFKC')
    .replace(/["\\]/g, '')
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return normalized.length > MAX_TAG_CHARS ? '' : normalized;
}

/** Splits one `tags:` payload on every accepted separator and normalizes it. */
export function parseTagPayload(payload: string): string[] {
  return splitTagTokens(payload).map(normalizeTag).filter(Boolean);
}

/** Whether a line is nothing but `@key` markers. */
function isLinkLine(line: string): boolean {
  return LINK_LINE_PATTERN.test(line);
}

/** Whether a line is part of the trailing metadata block. */
function isMetadataLine(line: string): boolean {
  return TAG_LINE_PATTERN.test(line) || LINK_LINE_PATTERN.test(line);
}

/**
 * Merges tag groups into one list: normalized, deduplicated (first occurrence
 * wins, so declaration order is kept), and capped at
 * {@link MAX_TAGS_PER_MEMORY}. Accepts any number of groups, which is how a
 * multi-line declaration and an append both collapse into a single set. Each
 * raw entry is split on the accepted separators first, so a `tags` field
 * materialized before that reading existed — or one edited by hand into
 * `a, b` — heals into its separate tags instead of staying one long chip.
 */
export function mergeTags(...groups: Array<string[] | undefined>): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const raw of group ?? []) {
      for (const token of splitTagTokens(raw)) {
        const tag = normalizeTag(token);
        if (!tag || seen.has(tag)) {
          continue;
        }
        seen.add(tag);
        merged.push(tag);
        if (merged.length === MAX_TAGS_PER_MEMORY) {
          return merged;
        }
      }
    }
  }
  return merged;
}

/**
 * Splits a memory value into its content and the metadata declared by the
 * contiguous block at its end. Every `tags:` line of that block contributes,
 * wherever it sits relative to `@key` lines, so multi-line tag declarations
 * merge into one set. `content` keeps only the body — the caller decides where
 * the links belong — and `links` preserves their line order.
 */
function splitTrailingMetadata(value: string): {
  content: string;
  tags: string[];
  links: string[];
} {
  const text = value.trimEnd();
  const lines = text.split('\n');
  const dropped = new Set<number>();
  const declared: string[][] = [];
  const links: string[] = [];
  let index = lines.length - 1;
  while (index >= 0) {
    const line = lines[index].trim();
    if (!isMetadataLine(line)) {
      break;
    }
    dropped.add(index);
    const tagMatch = TAG_LINE_PATTERN.exec(line);
    if (tagMatch) {
      declared.push(parseTagPayload(tagMatch[1]));
    } else {
      links.push(line);
    }
    index -= 1;
  }
  if (dropped.size === 0) {
    return { content: text, tags: [], links: [] };
  }
  return {
    content: lines
      .filter((_, lineIndex) => !dropped.has(lineIndex))
      .join('\n')
      .trimEnd(),
    tags: mergeTags(...declared.reverse()),
    links: links.reverse(),
  };
}

/** Keeps the first occurrence of each line, in order. */
function dedupe(lines: string[]): string[] {
  return [...new Set(lines)];
}

/**
 * Splits a memory value into its content and the tags declared by the
 * contiguous metadata block at its end. `content` keeps the link lines
 * verbatim and drops only the tag lines, so the injected text still carries
 * its `@key` links; values that declare no tags come back untouched, byte for
 * byte.
 */
export function parseTrailingTags(value: string | null | undefined): ParsedMemoryTags {
  if (typeof value !== 'string' || !value.trim()) {
    return { content: '', tags: [] };
  }
  const metadata = splitTrailingMetadata(value);
  if (metadata.tags.length === 0) {
    return { content: value.trimEnd(), tags: [] };
  }
  const content = [metadata.content, ...dedupe(metadata.links)].filter(Boolean).join('\n');
  return { content: content.trimEnd(), tags: metadata.tags };
}

/** Canonical single `tags:a|b` line, or an empty string for no tags. */
export function formatTagLine(tags: string[] | undefined): string {
  const merged = mergeTags(tags);
  return merged.length === 0 ? '' : `${TAG_PREFIX}${merged.join(TAG_SEPARATOR)}`;
}

/**
 * The authoritative tag set of a stored entry: the materialized `tags` field
 * when it holds anything, otherwise the tags parsed out of the value. Entries
 * written before tags were materialized — and values edited by hand outside
 * the write path — stay readable.
 */
export function memoryTagsOf(entry: MemoryTagEntry | null | undefined): string[] {
  if (!entry) {
    return [];
  }
  const stored = mergeTags(entry.tags);
  return stored.length > 0 ? stored : parseTrailingTags(entry.value).tags;
}

/** A memory's value with its tag lines removed — what every prompt injects. */
export function memoryContentOf(entry: MemoryTagEntry | null | undefined): string {
  return parseTrailingTags(entry?.value).content;
}

/**
 * A memory's prose: its value without the metadata — neither the `tags:`
 * declarations nor the trailing `@key` links. Links are navigation, not
 * content, so they must not reach an embedding: a memory that names ten
 * relatives would otherwise be about them. This is what every embedder starts
 * from.
 *
 * The tag lines come off first. A `tags:` line written under the links hides
 * them from an end-of-value scan, and a blank line between the two separates
 * them for the metadata block scanner as well, so the links are taken off the
 * already tag-stripped text instead of the raw value.
 */
export function memoryBodyOf(entry: MemoryTagEntry | null | undefined): string {
  const value = entry?.value;
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }
  const content = parseTrailingTags(value).content.trimEnd();
  const lines = content.split('\n');
  let index = lines.length - 1;
  while (index >= 0 && isLinkLine(lines[index].trim())) {
    index -= 1;
  }
  return (index === lines.length - 1 ? content : lines.slice(0, index + 1).join('\n')).trimEnd();
}

/** Text without any line that is nothing but `@key` markers. A link is
 *  navigation wherever it sits — a memory that names ten relatives must not
 *  become a vector about them — so the embedder drops every such line, not only
 *  the trailing block. */
function withoutLinkLines(text: string): string {
  return text
    .split('\n')
    .filter((line) => !isLinkLine(line.trim()))
    .join('\n');
}

/**
 * What a memory is embedded from: its prose, with every `@key` link line
 * removed, followed by its canonical tag line. For a memory with no metadata
 * this is the stored value; for a tagged one it differs only when the tag set
 * moved away from what the value declares, so the vector keeps naming the
 * memory's cue anchors in their current spelling.
 */
export function memoryVectorText(entry: MemoryTagEntry | null | undefined): string {
  const body = withoutLinkLines(memoryBodyOf(entry));
  const tags = memoryTagsOf(entry);
  if (tags.length === 0) {
    return body;
  }
  return [body, formatTagLine(tags)].filter(Boolean).join('\n');
}

/**
 * The `["tags": "a, b"]` prompt field for an entry, placed right after its
 * value so an untagged memory renders byte for byte as it did before tags
 * existed. Empty when the memory declares no tags.
 */
export function memoryTagField(entry: MemoryTagEntry | null | undefined): string {
  const tags = memoryTagsOf(entry);
  return tags.length === 0 ? '' : ` ["tags": "${tags.join(', ')}"]`;
}

/**
 * Merges the link lines of two values by key, keeping declaration order and
 * dropping a key already declared earlier — whether it sat alone or beside
 * other links. Line-level deduplication is not enough: an addition that repeats
 * a key already declared on a shared line (`@a @b`) would append it again and
 * the key would render twice. A line whose keys are all already declared
 * disappears, a partially repeated line keeps only its new keys, and a line
 * with nothing repeated is kept verbatim.
 */
function mergeLinkLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const line of lines) {
    const keys = parseMemoryLinkKeys(line);
    const remaining: string[] = [];
    for (const key of keys) {
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      remaining.push(key);
    }
    if (remaining.length === 0) {
      continue;
    }
    merged.push(
      remaining.length === keys.length ? line : remaining.map((key) => `@${key}`).join(' '),
    );
  }
  return merged;
}

/**
 * Moves every standalone `@key` link line of a memory value into the trailing
 * metadata block, so the block ends the value instead of splitting its prose.
 * A link line is navigation wherever it sits — the same rule
 * {@link memoryBodyOf} and {@link withoutLinkLines} already apply when they
 * build an embedding — so a value a model reconstructed by inserting new text
 * between an existing memory's link lines is healed instead of stored with a
 * link block in the middle. Link names are kept verbatim; whether a link
 * resolves is not this function's business.
 *
 * The trailing `tags:` lines still define the tag set, exactly as
 * {@link splitTrailingMetadata} reads them — only links are relocated. A value
 * whose links already trail comes back byte for byte, so a write that needs no
 * healing never churns.
 */
export function normalizeMemoryValue(value: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    return value;
  }
  const metadata = splitTrailingMetadata(value);
  const bodyLines = metadata.content.split('\n');
  const interiorLinks = bodyLines.filter((line) => isLinkLine(line.trim()));
  if (interiorLinks.length === 0) {
    return value;
  }
  const body = bodyLines
    .filter((line) => !isLinkLine(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
  const links = mergeLinkLines([...interiorLinks, ...metadata.links]);
  return [body, ...links, formatTagLine(metadata.tags)].filter(Boolean).join('\n');
}

/**
 * Appends text to a memory value with the metadata block kept at the end.
 * Without this, appending to a tagged memory would push its `tags:` lines into
 * the middle, where they are no longer metadata: the tags would be read as
 * prose and lost to recall, and the same would happen to its `@key` links.
 * The addition's own tags and links are folded into the block, the links merge
 * by key, and the tags merge into one line. The result is then normalized so a
 * link line the addition (or the existing value) carried before its prose ends
 * up in the trailing block rather than mid-value.
 */
export function appendMemoryValue(existingValue: string, addition: string): string {
  const existing = splitTrailingMetadata(existingValue);
  const added = splitTrailingMetadata(addition);
  const content = [existing.content, added.content].filter(Boolean).join('\n');
  const links = mergeLinkLines([...existing.links, ...added.links]);
  const tagLine = formatTagLine(mergeTags(existing.tags, added.tags));
  return normalizeMemoryValue([content, ...links, tagLine].filter(Boolean).join('\n'));
}
