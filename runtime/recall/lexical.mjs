import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { memoryEnv } from './env.mjs';
/**
 * Lexical candidate channel for memory recall.
 *
 * The vector candidates are the pipeline's only source of recall material, and
 * a store of dated personal notes holds documents the embedding space simply
 * does not retrieve: a memory titled with a date, a proper noun, a file path,
 * a game term. Measured on the 145-memory store this fork runs, the dense
 * top-15 contained none of the acceptable memories for 8 of 40 labeled
 * queries, while bigram BM25 found the ideal one at rank 1–2 for seven of them.
 *
 * So this channel answers one question — *which memories does the turn name in
 * words?* — and returns them as ordinary candidates for the cross-encoder to
 * judge. It never decides membership by itself: a row that lands here still
 * has to win the rerank, exactly like a vector row.
 *
 * Scoring runs on a per-store index built from the memory documents and cached
 * briefly; memory writes invalidate it through the same change events the
 * vector sync listens to, so a memory is lexically recallable on the turn after
 * it is written. Documents are scored whole and the best-matching `##` section
 * is the row that goes forward — a section-level index was measurably worse at
 * finding the document, while the section is what recall injects.
 *
 * Env:
 *   MEMORY_LEXICAL_CANDIDATES (documents this channel adds, default 3; 0 off)
 *   MEMORY_LEXICAL_CACHE_MS (index lifetime, default 300000)
 *   MEMORY_LEXICAL_MAX_DOCS (documents indexed per store, default 2000)
 *   MEMORY_LEXICAL_MAX_CHARS (characters indexed per store, default 2000000)
 *   MEMORY_RECALL_DATES (resolve the days a query names, default on; `false`
 *   leaves the channel to the query's words alone)
 */
import { logger } from '@librechat/data-schemas';
import { onMemoryChange, splitMemorySections } from '../db/methods.mjs';
const {
  buildLexicalIndex,
  dateSpellings,
  lexicalDoc,
  lexicalTerms,
  normalizeRecallDates,
  scoreLexical,
} = require('@librechat/api/recall-ranking');

const CANDIDATE_LIMIT = Number(memoryEnv('MEMORY_LEXICAL_CANDIDATES') ?? 3);
const CACHE_TTL_MS = Number(memoryEnv('MEMORY_LEXICAL_CACHE_MS') ?? 300_000);
/** The index keeps one term-frequency table per document, so its footprint
 *  tracks the store's text, not its row count. A store past either budget is
 *  left to the vector channel rather than truncated: half an index would answer
 *  a query about the missing half with silence. */
const MAX_DOCS = Number(memoryEnv('MEMORY_LEXICAL_MAX_DOCS') ?? 2000);
const MAX_CHARS = Number(memoryEnv('MEMORY_LEXICAL_MAX_CHARS') ?? 2_000_000);
/** Enough room for a user's stores and domain combinations without unbounded
 *  growth; each entry is tens of megabytes on a full store, so this stays small
 *  and the oldest index is dropped when a new one would exceed it. */
const MAX_INDEXES = 8;
/** Days one query may contribute; a range ("10-12 到 10-14") needs two, and
 *  more than that is a list, not a question. */
const MAX_QUERY_DATES = 3;
/** Whether a query's days are resolved and looked for. Off: the channel still
 *  matches words, including a date the turn wrote in full. */
const RESOLVE_DATES = memoryEnv('MEMORY_RECALL_DATES') !== 'false';
/** Sessions of one memory, the shape recall injects and the caller folds. */
const PART_SEPARATOR = '\u0000';

/** `${userId}\0${storeId}\0${domainIds.join(',')}` per indexed scope. */
const indexes = new Map();
let listening = false;

function resolveLimit(limit) {
  return Number.isFinite(limit) ? Number(limit) : CANDIDATE_LIMIT;
}

function scopeKey({ userId, storeId, domainIds }) {
  const domains = Array.isArray(domainIds) ? [...domainIds].sort() : [];
  return [String(userId ?? ''), String(storeId ?? ''), domains.join(',')].join(PART_SEPARATOR);
}

/** One indexed document: what a hit reports plus the parts it can be injected
 *  as. `score` stays null on purpose — this channel has no cosine, and a row
 *  without a similarity must not pretend to have one. */
function toCandidate(document, index, terms, flags = {}) {
  const section = bestSection(document, index, terms);
  /** The ranker reads the memory's identity line too: a dated question is
   *  answered by a section whose body may not repeat the day the title names,
   *  and measured on this store a title in the input moved the right memory
   *  from rank 3 to rank 1. The injected value is untouched. */
  const titled = section.value.startsWith(document.title)
    ? section.value
    : `${document.title}\n${section.value}`;
  return {
    key: document.key,
    section: section.section,
    value: section.value,
    rerankText: titled,
    tags: document.tags,
    domainId: document.domainId,
    updated_at: document.updated_at,
    score: null,
    lexical: true,
    ...(flags.dayTitle ? { dayTitle: true } : {}),
    ...(flags.dayMemory ? { dayMemory: true } : {}),
    ...(flags.dateOnly ? { dateOnly: true } : {}),
  };
}

/**
 * The part of a document the turn's words point at. A documented memory is
 * scored section by section with the same statistics; a memory that is not
 * sectioned is one part. The first section is the fallback because it carries
 * the document lead, so a match on the title lands there.
 */
function bestSection(document, index, terms) {
  if (document.sections.length === 0) {
    return { section: '', value: document.value };
  }
  let best = document.sections[0];
  let bestScore = scoreLexical(index, terms, best.doc);
  for (const section of document.sections.slice(1)) {
    const score = scoreLexical(index, terms, section.doc);
    if (score > bestScore) {
      best = section;
      bestScore = score;
    }
  }
  return { section: best.id, value: best.value };
}

/** The memory's identity line: its `#` title, or the first line it has. */
function firstLine(value) {
  const line = String(value ?? '')
    .split('\n', 1)[0]
    .trim();
  return line;
}

/**
 * Reduces the store's documents to an index. Stable memories are left out:
 * they ride the cacheable system baseline, so a hit here would inject a second
 * copy of what the prompt already carries.
 *
 * Returns null for a store past the size budget — the caller caches that
 * verdict, so an oversized store costs one read per lifetime, not one per turn.
 */
function buildIndex(documents) {
  const entries = new Map();
  const docs = [];
  const titles = [];
  let characters = 0;
  for (const document of documents) {
    if (entries.size >= MAX_DOCS || characters >= MAX_CHARS) {
      logger.warn(
        `[memoryRecall] Lexical index skipped: store exceeds ${MAX_DOCS} documents or ${MAX_CHARS} characters`,
      );
      return null;
    }
    if (!document?.key || document.stable === true) {
      continue;
    }
    const value = typeof document.value === 'string' ? document.value : '';
    if (value.length === 0) {
      continue;
    }
    characters += value.length;
    const doc = lexicalDoc(document.key, value);
    docs.push(doc);
    const title = firstLine(value);
    const titleDoc = lexicalDoc(document.key, title);
    titles.push(titleDoc);
    const split = splitMemorySections(value);
    const sections =
      split == null
        ? []
        : split.sections.map((section) => ({
            id: section.id,
            value: section.text,
            doc: lexicalDoc(`${document.key}${PART_SEPARATOR}${section.id}`, section.text),
          }));
    entries.set(document.key, {
      key: document.key,
      value,
      tags: Array.isArray(document.tags) ? document.tags : [],
      domainId: document.domainId ?? '',
      updated_at: document.updated_at,
      title,
      doc,
      titleDoc,
      sections,
    });
  }
  return {
    at: Date.now(),
    userId: null,
    storeId: null,
    index: buildLexicalIndex(docs),
    /** Titles get their own statistics: a dated question is answered by the
     *  memory whose *identity line* names that day, and a long diary's body
     *  dilutes that signal to nothing. */
    titleIndex: buildLexicalIndex(titles),
    entries,
  };
}

/** Drops one scope, or every scope of a user (and of one store when named). */
function invalidate({ userId, storeId } = {}) {
  const owner = userId == null ? null : String(userId);
  const partition = storeId == null ? null : String(storeId);
  for (const [key, entry] of indexes) {
    if (owner != null && entry.userId !== owner) {
      continue;
    }
    if (partition != null && entry.storeId !== partition) {
      continue;
    }
    indexes.delete(key);
  }
}

/** Memory writes keep the index honest without waiting for the lifetime to
 *  lapse: the same events that move the vectors move this cache. */
function listenForChanges() {
  if (listening) {
    return;
  }
  listening = true;
  onMemoryChange(invalidate);
}

function pruneIndexes() {
  const now = Date.now();
  for (const [key, entry] of indexes) {
    if (now - entry.at >= CACHE_TTL_MS) {
      indexes.delete(key);
    }
  }
  while (indexes.size >= MAX_INDEXES) {
    const oldest = indexes.keys().next().value;
    if (oldest == null) {
      break;
    }
    indexes.delete(oldest);
  }
}

async function indexFor({ userId, storeId, domainIds, loadDocuments }) {
  listenForChanges();
  const key = scopeKey({ userId, storeId, domainIds });
  const cached = indexes.get(key);
  if (cached != null && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached;
  }
  const documents = await loadDocuments({ userId, storeId, domainIds });
  if (!Array.isArray(documents)) {
    return null;
  }
  pruneIndexes();
  const entry = buildIndex(documents);
  /** An oversized store keeps a cache entry with no index: the read and the
   *  verdict are the expensive part, and both are valid until a write. */
  const cachedEntry = entry ?? {
    at: Date.now(),
    userId: null,
    storeId: null,
    index: null,
    entries: null,
  };
  cachedEntry.userId = String(userId ?? '');
  cachedEntry.storeId = String(storeId ?? '');
  indexes.set(key, cachedEntry);
  return cachedEntry;
}

/**
 * The days a query names, resolved to calendar days. Off switch: the channel
 * still matches a day the turn wrote out in full, because the words are always
 * scored; only the resolution of relative and CJK forms is skipped.
 */
function resolveQueryDates(query, { timezone, now } = {}) {
  if (!RESOLVE_DATES) {
    return [];
  }
  return normalizeRecallDates(query, { timezone, now: now ?? Date.now() }).dates.slice(
    0,
    MAX_QUERY_DATES,
  );
}

/**
 * The query as the term-overlap channel reads it: the words the turn used plus
 * every spelling of each day it names. Only this channel gets the spelled-out
 * days — the embedding and the cross-encoder see the text as written, so the
 * query keeps meaning exactly what the user typed.
 */
function withDateSpellings(query, dates) {
  if (dates.length === 0) {
    return query;
  }
  const spellings = dates.flatMap((date) => dateSpellings(date.iso));
  return `${query} ${[...new Set(spellings)].join(' ')}`;
}

/** Whether the picked day's title talks about anything the question asked
 *  besides the day itself. */
function sharesWordBeyondDate(entry, key, terms, spellings) {
  const titleDoc = entry.entries.get(key)?.titleDoc;
  if (titleDoc == null) {
    return false;
  }
  return terms.some((term) => !spellings.has(term) && titleDoc.termCounts.has(term));
}

/**
 * Ranks one recall's candidates.
 *
 * Without a named day this is plain BM25 over the documents. With one, the
 * documents that mention that day go first, ordered by how much of the question
 * their *title* carries — the identity line is where a diary names its day, and
 * a long entry's body would bury it — and by full-text relevance after that.
 * The remaining slots are filled by the ordinary ranking.
 */
function selectCandidates(entry, text, { cap, dates }) {
  const terms = [...new Set(lexicalTerms(text))];
  const scored = entry.index.docs.map((doc) => ({
    key: doc.key,
    score: scoreLexical(entry.index, terms, doc),
  }));
  const byScore = (left, right) => right.score - left.score;
  const spellings = new Set(dates.flatMap((date) => dateSpellings(date.iso)));
  if (spellings.size === 0) {
    return scored
      .filter((hit) => hit.score > 0)
      .sort(byScore)
      .slice(0, cap);
  }
  const scoreOf = new Map(scored.map((row) => [row.key, row.score]));
  const titleDocOf = (key) => {
    if (entry.titleIndex == null) {
      return null;
    }
    return entry.entries.get(key)?.titleDoc ?? null;
  };
  const titleScore = (key) => {
    const titleDoc = titleDocOf(key);
    return titleDoc == null ? 0 : scoreLexical(entry.titleIndex, terms, titleDoc);
  };
  const titled = [];
  const dated = [];
  const rest = [];
  for (const doc of entry.index.docs) {
    const row = { key: doc.key, score: scoreOf.get(doc.key) ?? 0 };
    if (![...spellings].some((term) => doc.termCounts.has(term))) {
      rest.push(row);
      continue;
    }
    /** A day in the title is the memory's own framing of that day; a day in
     *  the body is a mention. Only the former may hold the reserved seat. */
    const titleDoc = titleDocOf(doc.key);
    const titleNames =
      titleDoc != null && [...spellings].some((term) => titleDoc.termCounts.has(term));
    (titleNames ? titled : dated).push(row);
  }
  titled.sort(
    (left, right) => titleScore(right.key) - titleScore(left.key) || right.score - left.score,
  );
  dated.sort(byScore);
  const picks = [...titled, ...dated].slice(0, cap);
  if (picks.length < cap) {
    picks.push(
      ...rest
        .filter((hit) => hit.score > 0)
        .sort(byScore)
        .slice(0, cap - picks.length),
    );
  }
  if (titled.length > 0) {
    /** A titled day is enough to spend one reranker call on this turn; it is
     *  not enough to inject. Only a title that also shares a word with the
     *  question may hold the reserved seat — a date in a filename matches every
     *  question about that day, and the seat would otherwise inject a diary
     *  entry into a weather question. The sharing row may be a later titled
     *  one: the title that best answers "昨天夜班" need not be the one the date
     *  ranking put first. */
    picks[0].dayTitle = true;
    const daySpeech = titled.find((row) => sharesWordBeyondDate(entry, row.key, terms, spellings));
    if (daySpeech != null) {
      daySpeech.dayMemory = true;
    }
  }
  return picks;
}

/**
 * The documents a turn names, as recall candidates. `loadDocuments` is injected
 * by the caller (the same document access the rest of recall already gets), so
 * this module never reaches for the database itself. Returns an empty list on
 * any failure: a recall must not fail because its second channel did.
 */
async function searchLexicalMemories({
  userId,
  storeId,
  domainIds,
  query,
  limit,
  excludeKeys,
  timezone,
  now,
  loadDocuments,
}) {
  const cap = resolveLimit(limit);
  if (!(cap > 0) || typeof loadDocuments !== 'function') {
    return [];
  }
  if (typeof query !== 'string' || query.trim().length === 0) {
    return [];
  }
  try {
    const entry = await indexFor({ userId, storeId, domainIds, loadDocuments });
    if (entry?.index == null) {
      return [];
    }
    const excluded = excludeKeys instanceof Set ? excludeKeys : new Set();
    const dates = resolveQueryDates(query, { timezone, now });
    const searchText = withDateSpellings(query, dates);
    const hits = selectCandidates(entry, searchText, {
      cap: cap + excluded.size,
      dates,
    });
    if (hits.length === 0) {
      return [];
    }
    const terms = [...new Set(lexicalTerms(searchText))];
    const spellings = new Set(dates.flatMap((date) => dateSpellings(date.iso)));
    const candidates = [];
    for (const hit of hits) {
      if (excluded.has(hit.key)) {
        continue;
      }
      const document = entry.entries.get(hit.key);
      if (document == null) {
        continue;
      }
      /** A row whose only link to the turn is the day is gate evidence: it
       *  says "this turn is about a day the store holds", and the caller keeps
       *  it only when nothing else opened the recall. It is not pool material —
       *  a topic question that happens to name today must not have its candidate
       *  list filled with the day's diary entries. */
      const dateOnly =
        dates.length > 0 &&
        !terms.some((term) => !spellings.has(term) && document.doc.termCounts.has(term));
      candidates.push(
        toCandidate(document, entry.index, terms, {
          dayTitle: hit.dayTitle === true,
          dayMemory: hit.dayMemory === true,
          dateOnly,
        }),
      );
      if (candidates.length >= cap) {
        break;
      }
    }
    return candidates;
  } catch (error) {
    logger.warn('[memoryRecall] Failed to score the lexical channel', error);
    return [];
  }
}

export function resetLexicalIndexes() {
  indexes.clear();
}

const exported = {
  searchLexicalMemories,
  /** Test-facing reset; production relies on TTL plus change events. */
  resetLexicalIndexes,
};

export default exported;
