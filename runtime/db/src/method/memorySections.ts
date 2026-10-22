/**
 * Memory sections.
 *
 * A long memory may be written as a markdown document: a lead — the text before
 * the first `##`, an optional `#` title included — followed by `##` sections.
 * The recall pipeline embeds and recalls one section at a time, so a memory that
 * outgrew the embedding window is still reachable by what one of its parts
 * says, and a hit injects only that part.
 *
 * The lead belongs to the first section: it is merged into that section and
 * embedded with it, so the document's framing is searchable where it introduces
 * the document. Every later section is embedded on its own — repeating the lead
 * in each of their vectors would blur them into one another — and the lead is
 * joined back on at render time, so a recalled later section still reads
 * `# title` … intro … `## section` ….
 *
 * Only `##` (level 2) splits, and a document needs at least two of them to be
 * sectioned at all: with a single `##` there is nothing to choose between, so
 * the memory stays whole. `#` heads the document and `###` and deeper stay
 * inside their section. A `##` or `#` inside a fenced code block is code, not a
 * heading, so a memory that quotes markdown survives the split.
 */

import { memoryBodyOf } from './memoryTags';

export interface MemorySection {
  /** 0-based position in the document; identifies the part in the vector row. */
  id: string;
  /** The heading text without its markers. */
  heading: string;
  /** The section as written. The first section opens with the document lead;
   *  every later one starts at its own `##` heading. This is what is embedded
   *  and injected. */
  text: string;
}

export interface MemorySections {
  /** Everything before the first `##`: the document title and intro. Carried by
   *  the first section's text; recall joins it onto the later sections it
   *  injects. Never part of a later section's embedding. */
  lead: string;
  sections: MemorySection[];
}

/**
 * Identity of one embedded part of a memory: its key plus its section. A
 * memory recalled whole is `key\u0000`; a sectioned memory contributes one id
 * per section. Recall uses it to fold exact repeats without collapsing two
 * sections of the same memory into one.
 */
export function memoryPartId(key: string, section?: string | null): string {
  return `${key}\u0000${section ?? ''}`;
}

/** A level-2 ATX heading: `##`, then whitespace, then a non-empty title. An
 *  optional closing run of `#` is not part of the title. */
const HEADING_LINE_PATTERN = /^ {0,3}##(?!#)[ \t]+(.*?)[ \t]*#*[ \t]*$/;

/** Opening or closing fence of a fenced code block, with its marker run. */
const FENCE_LINE_PATTERN = /^ {0,3}(`{3,}|~{3,})/;

/** Line index and title of every `##` heading outside a code fence. A fenced
 *  block hides them: a `##` a memory quotes is code. */
function findHeadings(lines: string[]): Array<{ index: number; heading: string }> {
  const headings: Array<{ index: number; heading: string }> = [];
  let openFence: { char: string; length: number } | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const fenceMatch = FENCE_LINE_PATTERN.exec(lines[index]);
    if (fenceMatch != null) {
      const marker = fenceMatch[1];
      if (openFence == null) {
        openFence = { char: marker[0], length: marker.length };
      } else if (marker[0] === openFence.char && marker.length >= openFence.length) {
        openFence = null;
      }
      continue;
    }
    if (openFence != null) {
      continue;
    }
    const headingMatch = HEADING_LINE_PATTERN.exec(lines[index]);
    if (headingMatch != null) {
      headings.push({ index, heading: headingMatch[1].trim() });
    }
  }
  return headings;
}

/**
 * The document's prose lines, its `##` headings and its lead, or `null` when
 * there is nothing to section. The value's trailing metadata is stripped first:
 * `tags:` declarations and `@key` links are navigation, not section content, so
 * they never reach a section's text (or its embedding).
 */
function scanDocument(
  value: string | null | undefined,
): { lines: string[]; headings: Array<{ index: number; heading: string }>; lead: string } | null {
  if (typeof value !== 'string') {
    return null;
  }
  const content = memoryBodyOf({ value }).trimEnd();
  if (!content.trim()) {
    return null;
  }
  const lines = content.split('\n');
  const headings = findHeadings(lines);
  /** One heading is one part: there is no second part to recall instead of the
   *  whole memory, so the memory stays whole. */
  if (headings.length < 2) {
    return null;
  }
  return { lines, headings, lead: lines.slice(0, headings[0].index).join('\n').trim() };
}

/**
 * Splits a stored memory value into its `##` sections and the lead that frames
 * them, or returns `null` when the value has fewer than two `##` headings — the
 * caller then keeps the memory whole. The first section's text opens with the
 * lead (the title and intro), every later one starts at its own heading.
 * Section ids are the resulting positions, `0`, `1`, … so they stay unique
 * however the headings repeat.
 */
export function splitMemorySections(value: string | null | undefined): MemorySections | null {
  const document = scanDocument(value);
  if (document == null) {
    return null;
  }
  const { lines, headings, lead } = document;
  const sections: MemorySection[] = [];
  for (let position = 0; position < headings.length; position += 1) {
    const start = position === 0 ? 0 : headings[position].index;
    const end = position + 1 < headings.length ? headings[position + 1].index : lines.length;
    const text = lines.slice(start, end).join('\n').trim();
    if (!text) {
      continue;
    }
    sections.push({ id: String(sections.length), heading: headings[position].heading, text });
  }
  return sections.length > 0 ? { lead, sections } : null;
}

/** Marks the content an excerpt leaves out, so a section is never read as the
 *  whole memory. */
export const SECTION_OMISSION = '……';

/**
 * Frames one recalled section for injection: the document lead in front of a
 * section that does not already carry it, and {@link SECTION_OMISSION} above
 * and/or below wherever the excerpt skips content — above when earlier sections
 * were left out, below when later ones were. A later section is stored and
 * embedded without the lead, so both the lead and the marks are joined on here,
 * which is the one place the model's text and the reply's card read from.
 *
 * `value` is the stored section text and `documentValue` the whole memory the
 * row came from. A value that is not a section of a sectioned document — a
 * memory recalled whole, or a document that lost its second heading — comes
 * back untouched.
 */
export function frameMemorySection(
  value: string,
  section: string,
  documentValue: string | null | undefined,
): string {
  if (typeof value !== 'string' || !section) {
    return value;
  }
  const document = splitMemorySections(documentValue);
  if (document == null) {
    return value;
  }
  const index = Number(section);
  if (!Number.isInteger(index) || index < 0) {
    return value;
  }
  const isFirst = index === 0;
  const isLast = index >= document.sections.length - 1;
  /** A row written before later sections dropped the lead still opens with it;
   *  strip it so the lead is placed once, at the top. */
  const body =
    !isFirst && document.lead && value.startsWith(document.lead)
      ? value.slice(document.lead.length).trim()
      : value;
  const parts: string[] = [];
  if (!isFirst) {
    if (document.lead) {
      parts.push(document.lead);
    }
    parts.push(SECTION_OMISSION);
  }
  parts.push(body);
  if (!isLast) {
    parts.push(SECTION_OMISSION);
  }
  return parts.join('\n\n');
}
