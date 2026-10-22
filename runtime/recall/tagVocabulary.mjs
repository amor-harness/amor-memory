import { memoryEnv } from './env.mjs';
/**
 * Query-side tag matching.
 *
 * A memory's tags are cue anchors, and a cue that appears verbatim in the query
 * is a discrete signal: unlike a cosine score — m3e compresses Chinese scores
 * into a band where related and unrelated overlap — a lexical tag hit is
 * evidence the memory is about what the turn is about. So a hit enters the
 * candidate set directly (see `recall.js`) instead of competing for one of the
 * vector top-N slots, which is what lets a memory whose wording never matches
 * the query still be recalled.
 *
 * The vocabulary is the store's own — the tags its memories already carry — so
 * there is nothing to hand-maintain: it grows with the memories and retires
 * tags when the memories carrying them go away. It is cached briefly because
 * every recall reads it.
 *
 * Env:
 *   MEMORY_TAG_RECALL (master switch, default on)
 *   MEMORY_TAG_VOCABULARY_LIMIT (tags read for matching, default 200)
 *   MEMORY_TAG_QUERY_LIMIT (tags matched per query, default 3)
 *   MEMORY_TAG_VOCABULARY_TTL_MS (cache lifetime, default 60000)
 */

const VOCABULARY_LIMIT = Number(memoryEnv('MEMORY_TAG_VOCABULARY_LIMIT') ?? 200);
const QUERY_MATCH_LIMIT = Number(memoryEnv('MEMORY_TAG_QUERY_LIMIT') ?? 3);
const VOCABULARY_TTL_MS = Number(memoryEnv('MEMORY_TAG_VOCABULARY_TTL_MS') ?? 60000);

/** A tag shorter than this matches too much prose to be evidence. Single
 *  characters stay usable as tags — they simply do not trigger lexical recall,
 *  and vector similarity still finds them. */
const MIN_MATCH_CHARS = 2;

/** storeId → { at, vocabulary } */
const vocabularyCache = new Map();

/** Whether tag-driven recall runs at all. Callers skip the vocabulary read and
 *  the extra query when it is off. */
function isTagRecallEnabled() {
  return memoryEnv('MEMORY_TAG_RECALL') !== 'false';
}

/** The store's tag vocabulary, cached for {@link VOCABULARY_TTL_MS}. A failed
 *  read serves the previous list when there is one, so a hiccup never silently
 *  turns recall back into vector-only. */
async function vocabularyFor({ storeId, loadUsage, now = Date.now() }) {
  if (typeof loadUsage !== 'function' || !isTagRecallEnabled()) {
    return [];
  }
  const cacheKey = storeId == null ? '' : String(storeId);
  const cached = vocabularyCache.get(cacheKey);
  if (cached && now - cached.at < VOCABULARY_TTL_MS) {
    return cached.vocabulary;
  }
  try {
    const vocabulary = (await loadUsage({ storeId, limit: VOCABULARY_LIMIT })) ?? [];
    vocabularyCache.set(cacheKey, { at: now, vocabulary });
    return vocabulary;
  } catch {
    return cached?.vocabulary ?? [];
  }
}

/** Escapes a tag for a word-boundary regex. */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** ASCII-only tags are matched on word boundaries so a tag like `art` does not
 *  fire inside `start`; CJK tags have no boundaries to speak of, so a plain
 *  substring is the right test there. */
const asciiPatternCache = new Map();
const asciiCountPatternCache = new Map();

function asciiPattern(tag) {
  let pattern = asciiPatternCache.get(tag);
  if (!pattern) {
    pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(tag)}([^a-z0-9]|$)`);
    asciiPatternCache.set(tag, pattern);
  }
  return pattern;
}

function containsTag(haystack, tag) {
  if (/^[\x20-\x7e]+$/.test(tag)) {
    return asciiPattern(tag).test(haystack);
  }
  return haystack.includes(tag);
}

/**
 * How many times `tag` appears in `text` (already lowercased). A word that shows
 * up again and again in a tool result is what that result is about, even when
 * the result is long enough that no single occurrence carries much weight — the
 * signal repetition gives, and the reason `recall.js` lets a repeated match
 * count as deliberate where a lone one does not.
 */
function countTagOccurrences(text, tag) {
  if (/^[\x20-\x7e]+$/.test(tag)) {
    let pattern = asciiCountPatternCache.get(tag);
    if (!pattern) {
      pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(tag)}(?=[^a-z0-9]|$)`, 'g');
      asciiCountPatternCache.set(tag, pattern);
    }
    return [...text.matchAll(pattern)].length;
  }
  let occurrences = 0;
  let index = text.indexOf(tag);
  while (index !== -1) {
    occurrences += 1;
    index = text.indexOf(tag, index + tag.length);
  }
  return occurrences;
}

/**
 * The vocabulary tags that appear in `text`, most used first (the order the
 * vocabulary comes in), capped at `limit`: a query that happens to contain
 * several tags should widen the candidate set, not flood it.
 *
 * Each match carries the tag's usage count, because the count is what says
 * whether the hit is evidence or accident. A tag on a couple of memories names
 * a cue the query really is about; a tag on a large share of the store (`文件`,
 * `天气`) is a category the query merely mentions — `怎么读一个 JSON 文件`
 * contains `文件` without being about any of the memories filed under it. That
 * distinction is what `recall.js` uses to decide whether a hit may loosen the
 * similarity thresholds.
 */
function matchedTagUsages({ text, vocabulary, limit = QUERY_MATCH_LIMIT }) {
  if (typeof text !== 'string' || text.length === 0 || limit <= 0) {
    return [];
  }
  const haystack = text.toLowerCase();
  const matched = [];
  for (const usage of vocabulary ?? []) {
    const tag = usage?.tag;
    if (typeof tag !== 'string' || tag.length < MIN_MATCH_CHARS) {
      continue;
    }
    if (!containsTag(haystack, tag)) {
      continue;
    }
    matched.push({
      tag,
      count: Number(usage?.count) || 0,
      occurrences: countTagOccurrences(haystack, tag),
    });
    if (matched.length === limit) {
      break;
    }
  }
  return matched;
}

/** The matched tag names alone, for callers that only need the words. */
function matchQueryTags({ text, vocabulary, limit = QUERY_MATCH_LIMIT }) {
  return matchedTagUsages({ text, vocabulary, limit }).map((match) => match.tag);
}

/** Splits matched tags into the specific ones (rare enough to be evidence) and
 *  the generic ones (a category the query happens to mention). */
function splitTagMatches(matches, maxSpecificCount) {
  const specific = [];
  const generic = [];
  for (const match of matches ?? []) {
    if (maxSpecificCount > 0 && match.count > maxSpecificCount) {
      generic.push(match.tag);
    } else {
      specific.push(match.tag);
    }
  }
  return { specific, generic };
}

/** Test seam: drops the cached vocabularies. */
function resetTagVocabularyCache() {
  vocabularyCache.clear();
}

const exported = {
  isTagRecallEnabled,
  vocabularyFor,
  matchedTagUsages,
  countTagOccurrences,
  matchQueryTags,
  splitTagMatches,
  resetTagVocabularyCache,
  VOCABULARY_LIMIT,
  QUERY_MATCH_LIMIT,
  MIN_MATCH_CHARS,
};

export default exported;
