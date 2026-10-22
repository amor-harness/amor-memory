import { createRequire } from 'node:module';
import { memoryEnv } from './env.mjs';
import { logger } from '@librechat/data-schemas';
import { memoryContentOf, memoryTagsOf, memoryTagField, memoryTimeField, memoryPartId, frameMemorySection } from '../db/methods.mjs';
import embeddings from './embeddings.mjs';
import vectorStore from './vectorStore.mjs';
import reranker from './reranker.mjs';
import tagVocabulary from './tagVocabulary.mjs';
import lexical from './lexical.mjs';
import links from './links.mjs';
import imageRecall from './imageRecall.mjs';

const require = createRequire(import.meta.url);
const {
  selectRanked,
  selectRecall,
  redundancyStats,
  diffSelection,
  normalizeRecallDates,
  dateSpellings,
} = require('@librechat/api/recall-ranking');
const { searchLexicalMemories } = lexical;
const { annotateLinkedSummaries, consolidateTrailingLinks } = links;
const { recallImageMemories } = imageRecall;


const CANDIDATE_LIMIT = Number(memoryEnv('MEMORY_RAG_CANDIDATES') ?? 15);
const RERANK_LIMIT = Number(memoryEnv('MEMORY_RAG_LIMIT') ?? 3);
/** Cosine floor the vector candidates are screened with before anything else:
 *  it spares the cross-encoder the rows similarity already calls unrelated, and
 *  doubles as the recall floor in a deployment with no reranker sidecar. */
const COSINE_MIN_SCORE = Number(memoryEnv('MEMORY_RAG_MIN_SCORE') ?? 0.7);
/** Top-1 cosine below which the query skips recall altogether. A cost screen,
 *  not a precision gate: it spares the cross-encoder (seconds per query) on
 *  turns that are clearly off-topic, while the per-row screen and the reranker
 *  do the actual picking. The related and off-topic bands overlap, so the cut
 *  is a deliberate trade: a few on-topic turns recall nothing rather than every
 *  marginal turn paying cross-encoder time for an injection nobody needs. */
const GATE_MIN_SCORE = Number(memoryEnv('MEMORY_RAG_GATE_MIN_SCORE') ?? 0.75);

/** How many of the final slots a tag-matched memory is guaranteed to keep. The
 *  cross-encoder only sees the merged candidate set, and its scores drift with
 *  the set — a lexical tag hit is the more reliable evidence of the two, so
 *  it cannot be voted off the island by an ordinal it was never comparable to.
 *  One slot keeps that guarantee cheap; set it to 0 to let the reranker decide
 *  everything. */
const TAG_RESERVED_SLOTS = Number(memoryEnv('MEMORY_TAG_RESERVED_SLOTS') ?? 1);
/** A tag carried by more memories than this is a category, not a cue: it joins
 *  the candidate set, but it may not loosen the similarity thresholds. Measured
 *  on a real store: the generic `文件` tag matched "how do I read a JSON file"
 *  and pulled apartment and mailbox memories into a turn that had nothing to do
 *  with them, while niche tags only ever matched their own topic. Four is still
 *  a category — the boundary matters, because a tag sitting exactly on it
 *  loosens the floor for every memory carrying it: `天气` (four memories) let a
 *  short "what is the weather in Beijing" turn pull three unrelated memories
 *  past the similarity floor, and `深夜` did the same for a sleep memory. Repetition
 *  is unaffected by this cut, which is what keeps the on-topic case: a long
 *  weather result that says `天气` six times still promotes it (see
 *  {@link TAG_MIN_OCCURRENCES}). 0 disables the distinction (every match counts
 *  as specific). */
const TAG_SPECIFIC_MAX_COUNT = Number(memoryEnv('MEMORY_TAG_SPECIFIC_MAX_COUNT') ?? 3);
/** How much of a query a tag has to account for before the hit counts as the
 *  user naming that cue. Scale-free on purpose: in a short message a tag is a
 *  word the turn is about, while in a long tool result the same word is
 *  incidental — a playlist whose first track is called "深夜咖啡馆" is not a
 *  turn about late nights, yet the bare substring pulled three sleep memories
 *  past the similarity floor. Measured on a real store, the incidental matches sat
 *  at 0.9–1.3% while deliberate ones cleared 8%. Below the share, the memory
 *  still joins the candidate set and is judged by its score. 0 disables it. */
const TAG_MIN_DENSITY = Number(memoryEnv('MEMORY_TAG_MIN_DENSITY') ?? 0.02);
/** How often a tag has to appear in the query to count as deliberate when the
 *  density test fails. Repetition is what a long tool result offers instead of
 *  brevity: a weather log that says 天气 four times is about the weather even
 *  though two characters cannot reach 2% of two hundred. A lone occurrence in
 *  long text stays incidental. 0 disables it. */
const TAG_MIN_OCCURRENCES = Number(memoryEnv('MEMORY_TAG_MIN_OCCURRENCES') ?? 3);
/** Whether repetition may promote a tag the store considers a category. On: a
 *  tool result that repeatedly names a broad topic recalls that topic's
 *  memories; off: only already-specific tags are upgradable, so a generic tag
 *  stays a candidate regardless. */
const TAG_OCCURRENCE_PROMOTES_GENERIC =
  memoryEnv('MEMORY_TAG_OCCURRENCE_PROMOTES_GENERIC') !== 'false';
/** Relative floor applied to the cross-encoder's own output inside one candidate
 *  set: a row scoring below this share of the set's best is what "we have three
 *  slots to fill" would otherwise inject. Its absolute scores are not
 *  comparable across candidate sets (the sidecar pads to its longest pair), but
 *  within one set the ranking is meaningful — which is what makes a relative cut
 *  defensible where an absolute floor is not. 0 disables it. */
const RERANK_RELATIVE_MIN = Number(memoryEnv('MEMORY_RERANK_RELATIVE_MIN') ?? 0.4);
/** Floor on a set's best cross-encoder score: below it the set reads as "no
 *  candidate is relevant" and the slots stay empty instead of being padded. Off
 *  by default — the related and unrelated bands were measured overlapping
 *  around 0.13–0.15 for long documents. */
const RERANK_TOP_MIN_SCORE = Number(memoryEnv('MEMORY_RERANK_TOP_MIN_SCORE') ?? 0);
/** Characters of a query the cross-encoder is asked to score. The sidecar is a
 *  listwise 0.6B model that reruns its whole prompt per call with no prefix
 *  cache, and it repeats the query twice — once in the header, once in the
 *  closing `<query>` block — so its cost tracks the prompt's token count. A
 *  digest-derived query can run to thousands of characters, which the semantic
 *  screen does not need. The embedding still
 *  reads the whole query: it is the cheap half of the pair and what the vector
 *  candidates are selected by. 0 disables the cap. */
const RERANK_QUERY_MAX_CHARS = Number(memoryEnv('MEMORY_RERANK_QUERY_MAX_CHARS') ?? 400);
/** Marks the elided middle of a capped query. */
const QUERY_ELLIPSIS = '\n...\n';
/** Characters of each candidate the cross-encoder reads. Its cost grows faster
 *  than linearly in the prompt's tokens (a listwise model scores the whole set
 *  in one pass), and most of a long section is not what decides its relevance:
 *  measured on this store, 15 candidates of 4.5k–7.4k characters took 4.5–8.3
 *  seconds, the same set cut to 300 characters took 2.9–3.6 and kept the same
 *  top-3 in 4 of 5 turns. The injected value is never cut — only the text the
 *  ranker reads. 0 disables the cap. */
const RERANK_TEXT_MAX_CHARS = Number(memoryEnv('MEMORY_RERANK_TEXT_MAX_CHARS') ?? 400);
/** Whether a query's days are resolved and written out for the term-overlap
 *  channel and for the cross-encoder's prompt. Off leaves both to the words the
 *  turn used, a full ISO date included. */
const RECALL_DATES = memoryEnv('MEMORY_RECALL_DATES') !== 'false';

/** Whether the ranking passes run at all. Off keeps the shipped per-query
 *  selection exactly as it was; on moves the final choice after the document
 *  reconciliation, where a memory's real edit time is known and the pool the
 *  ranking reads is wider than the slots it fills. */
const DECAY_ENABLED = memoryEnv('MEMORY_DECAY_ENABLED') === 'true';
/** Half-life of the exponential decay, in days: the age at which the decay
 *  term has halved. */
const DECAY_HALF_LIFE_DAYS = Number(memoryEnv('MEMORY_DECAY_HALF_LIFE_DAYS') ?? 30);
/** Weight an arbitrarily old memory keeps, so decay reorders the pool without
 *  ever dominating the relevance it was scored with. */
const DECAY_FLOOR = Number(memoryEnv('MEMORY_DECAY_FLOOR') ?? 0.4);
const MMR_ENABLED = memoryEnv('MEMORY_MMR_ENABLED') === 'true';
/** Relevance weight of the MMR trade. The redundancy penalty is capped at
 *  `1 - lambda`, so this is also the ceiling on how far diversity can outvote
 *  relevance. */
const MMR_LAMBDA = Number(memoryEnv('MEMORY_MMR_LAMBDA') ?? 0.5);
/** Cosine at or below which two rows count as unrelated. The embedding space
 *  compresses related text into a high band, which is what this stretches. */
const MMR_SIM_FLOOR = Number(memoryEnv('MEMORY_MMR_SIM_FLOOR') ?? 0.7);
/** Stretched similarity at or above which a candidate is a restatement of one
 *  already picked and is passed over even with slots open. Ranking alone cannot
 *  dedupe — with the admitted set at or below the slot count, reordering only
 *  changes which near-duplicate is injected, which is what the store measurement
 *  showed. 0 disables the cut. */
const MMR_DUPLICATE_CUT = Number(memoryEnv('MEMORY_MMR_DUPLICATE_CUT') ?? 0.6);
/** Whether decay decides membership instead of only order. Off, the admitted set
 *  is the caller's raw-score cut and decay can only reorder it — and since the
 *  recalled block is presented chronologically, that reorder is invisible. On,
 *  the cut is applied to the decayed relevance, so a stale candidate that only
 *  qualified on raw score yields its slot to a fresher one. */
const DECAY_ADMISSION = memoryEnv('MEMORY_DECAY_ADMISSION') === 'true';
/** Sections of one memory a single selection may inject; 0 disables the cap. */
const MMR_MAX_PARTS_PER_KEY = Number(memoryEnv('MEMORY_MMR_MAX_PARTS_PER_KEY') ?? 0);
/** Logs what the ranking passes would change while still injecting the
 *  incumbent selection — the observation window that calibrates the defaults.
 *  Set the `MEMORY_DECAY_*` / `MEMORY_MMR_*` flags to the configuration you
 *  intend to ship; this only decides whether the proposed set is injected. */
const SHADOW = memoryEnv('MEMORY_RECALL_SHADOW') === 'true';
const RANKING_ACTIVE = DECAY_ENABLED || MMR_ENABLED || SHADOW;
/** Candidates one query carries into the shared pool. Wider than the slots so
 *  a diversified selection has somewhere to go, narrow enough that one query
 *  cannot spend the whole reconciliation read. */
const POOL_LIMIT = Number(memoryEnv('MEMORY_RECALL_POOL_LIMIT') ?? 8);

/** One recall per text is one reranker call, and its scores are only comparable
 *  inside that call: these ids are what the final selection groups the merged
 *  pool by, so each text's rows are normalized and cut against their own top
 *  rather than against another call's padding. */
const CORE_QUERY_ID = 'core';
const CONTEXT_QUERY_ID = 'context';

/** Orders recalled entries chronologically, oldest first, so the newest memory
 *  is presented last. Entries without a parseable `updated_at` (or missing it)
 *  sort to the end. Accepts Date or ISO-string timestamps and does not mutate
 *  the input array. */
function sortRecalledByTime(entries) {
  if (!Array.isArray(entries) || entries.length <= 1) {
    return entries ?? [];
  }
  const timestamp = (entry) => {
    if (!entry?.updated_at) {
      return Number.POSITIVE_INFINITY;
    }
    const time = new Date(entry.updated_at).getTime();
    return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
  };
  return [...entries].sort((a, b) => timestamp(a) - timestamp(b));
}

/**
 * Caps the text handed to the cross-encoder. Both ends are kept because a
 * digest-derived query leads with the summary and ends with the payload, and
 * either can be what the memory is about. Unlike
 * {@link RERANK_QUERY_MAX_CHARS}, the query the embedding reads is untouched —
 * this is the ranking prompt's budget, not the recall's.
 */
function capRerankQuery(query, maxChars = RERANK_QUERY_MAX_CHARS) {
  if (!(maxChars > 0) || typeof query !== 'string' || query.length <= maxChars) {
    return query;
  }
  const budget = Math.max(2, maxChars - QUERY_ELLIPSIS.length);
  const head = Math.ceil(budget * 0.6);
  return `${query.slice(0, head)}${QUERY_ELLIPSIS}${query.slice(-(budget - head))}`;
}

/**
 * What the cross-encoder reads of the query: the text as written, with the days
 * it names spelled out — but only when the turn also found a memory whose title
 * names one of those days and shares a word with the question (`withDates`).
 * That is the case the ranker cannot solve alone: "昨天" has to be grounded
 * against a memory titled `2026-10-20`, and doing so moved the right memory from
 * rank 5 to rank 1 on a "昨天" question and from rank 3 to rank 1 on a weekday
 * question. When no such memory exists the prompt stays as the reader wrote it:
 * spelling the day out for a topic question demotes the memory that answers it.
 */
function rerankQuery(query, timezone, now, withDates = false) {
  if (!RECALL_DATES || !withDates) {
    return capRerankQuery(query);
  }
  const dates = normalizeRecallDates(query, { timezone, now }).dates;
  if (dates.length === 0) {
    return capRerankQuery(query);
  }
  const spellings = dates.flatMap((date) => dateSpellings(date.iso));
  return capRerankQuery(`${query} ${[...new Set(spellings)].join(' ')}`);
}

/**
 * Caps what the cross-encoder reads of each candidate, without touching what
 * the turn will inject. The cap rides the row as `rerankText` — a ranking input
 * the reranker prefers over `value` — so a failed or skipped rerank still
 * leaves the whole memory on the row, and nothing downstream has to put a cut
 * value back together.
 */
function capRerankEntries(entries, maxChars = RERANK_TEXT_MAX_CHARS) {
  if (!(maxChars > 0) || !Array.isArray(entries)) {
    return entries ?? [];
  }
  return entries.map((entry) => {
    /** A row may already carry the text it wants ranked — a term-overlap
     *  candidate leads with its memory's title. The cap applies to that text,
     *  not to `value`, which is what the turn will inject. Measured on this
     *  store, extending the same cap to the tail cost two ideal hits on the
     *  main set and bought nothing, so the section keeps its head only. */
    if (typeof entry.rerankText === 'string') {
      return entry.rerankText.length > maxChars
        ? { ...entry, rerankText: entry.rerankText.slice(0, maxChars) }
        : entry;
    }
    if (typeof entry.value !== 'string' || entry.value.length <= maxChars) {
      return entry;
    }
    return { ...entry, rerankText: entry.value.slice(0, maxChars) };
  });
}

/** The recall block rides the turn's runtime tail, which the agents runtime
 *  merges into the newest user message inside the `<instructions>` envelope; the
 *  system prompt declares that envelope as system-authored and not answerable as
 *  a request, so this header only labels the block. */
const RECALL_HEADER = '# Recalled memories:';

/** A recalled value may be an excerpt rather than a whole memory: a `##`
 *  section of a longer one, and it may link others with `@key`. Both are read
 *  in full from the same place — every memory is also a `<key>.md` file in the
 *  `/memory` mount — so one sentence covers both. */
const LINK_HINT =
  '`## heading` marks one section of a longer memory and `@memory_name` a ' +
  'related memory: call read_file with the path `/memory/memory_name.md` to ' +
  'read one in full.';

/** Formats recalled entries the same numbered/keyed style as memory context so
 *  the model reads them as first-class memory content. Values are injected
 *  verbatim — links included — with {@link LINK_HINT} under the header, and a
 *  memory's cue anchors ride a `["tags": ...]` field after its value rather
 *  than as prose inside it. Each entry leads with the moment the memory was
 *  last written, so the model can tell a fresh fact from a stale one. */
function formatRecalled(entries, domainLabelOf, timezone) {
  if (!entries || entries.length === 0) {
    return '';
  }
  const lines = entries.map((entry, index) => {
    const label = typeof domainLabelOf === 'function' ? domainLabelOf(entry.domainId) : '';
    return (
      `${index + 1}. ["key": "${entry.key}"]` +
      memoryTimeField(entry, timezone) +
      (label ? ` ["domain": "${label}"]` : '') +
      ` ["value": "${memoryContentOf(entry)}"]` +
      memoryTagField(entry) +
      (entry.score != null ? ` [relevance: ${Number(entry.score).toFixed(2)}]` : '')
    );
  });
  return `${RECALL_HEADER}\n${LINK_HINT}\n\n${lines.join('\n\n')}`;
}

/**
 * Merges the tag-matched rows into the vector candidates, one row per part: a
 * part that both matched a tag and scored well keeps the vector row (its score)
 * and is flagged `tagMatch`. A sectioned memory contributes one part per
 * section, and two sections of it stay two rows — only an exact repeat folds.
 * `excluded` carries the keys the turn's context already handles, so neither
 * source can add one back.
 */
function mergeTagHits({ candidates, tagHits, excluded, specificTags }) {
  const specific = specificTags instanceof Set ? specificTags : new Set();
  const mark = (entry, tags) => {
    entry.tagMatch = true;
    entry.tagSpecific = Array.isArray(tags) ? tags.some((tag) => specific.has(tag)) : false;
  };
  const merged = candidates.map((entry) => ({ ...entry, tagMatch: false, tagSpecific: false }));
  const byPart = new Map(merged.map((entry) => [memoryPartId(entry.key, entry.section), entry]));
  for (const hit of tagHits ?? []) {
    if (hit?.key == null || excluded?.has(hit.key)) {
      continue;
    }
    const id = memoryPartId(hit.key, hit.section);
    const existing = byPart.get(id);
    if (existing) {
      mark(existing, hit.tags);
      continue;
    }
    const entry = { ...hit, tagMatch: false, tagSpecific: false };
    mark(entry, hit.tags);
    byPart.set(id, entry);
    merged.push(entry);
  }
  return merged;
}

/**
 * Folds the term-overlap channel's rows into the candidate set, one row per
 * part. A part the vector channel already produced keeps its vector row and its
 * cosine — the two channels frequently name the same memory, and a row with a
 * similarity is strictly more informative than the same row without one. A part
 * only this channel found enters with `lexical: true` and no score: its evidence
 * is the words it shares with the turn, and it is here to be judged by the
 * cross-encoder, not to skip it.
 */
/** Rows that hold a seat no ranking pass may take away: a specific tag the
 *  turn named, or the memory whose title names the day it asked about. The day
 *  seat needs the cross-encoder to at least not call it irrelevant — a date in
 *  a filename matches every question about that day, including a weather
 *  question that has nothing to do with the memory. */
function isReservedRow(entry) {
  if (entry.tagSpecific === true) {
    return true;
  }
  return entry.dayMemory === true && entry.score != null && entry.score > 0;
}

function mergeLexicalHits({ candidates, lexicalHits, excluded }) {
  const merged = [...(candidates ?? [])];
  const byPart = new Set(merged.map((entry) => memoryPartId(entry.key, entry.section)));
  for (const hit of lexicalHits ?? []) {
    if (hit?.key == null || excluded?.has(hit.key)) {
      continue;
    }
    const id = memoryPartId(hit.key, hit.section);
    if (byPart.has(id)) {
      continue;
    }
    byPart.add(id);
    merged.push({ ...hit, tagMatch: false, tagSpecific: false, lexical: true });
  }
  return merged;
}

/**
 * The shipped selection, kept for the configurations that do not run the
 * ranking passes at all: rank decides membership, except that up to
 * {@link TAG_RESERVED_SLOTS} specific tag hits are seated first — a lexical
 * tag hit is evidence the cross-encoder cannot weigh, since its scores are only
 * comparable inside one candidate set. Everything else is cut twice: against
 * the candidate set's own best score ({@link RERANK_RELATIVE_MIN}) and, if
 * configured, against {@link RERANK_TOP_MIN_SCORE}.
 */
function selectIncumbent({ ranked, limit }) {
  return selectRanked({
    ranked,
    limit,
    slots: TAG_RESERVED_SLOTS,
    minRatio: RERANK_RELATIVE_MIN,
    topMin: RERANK_TOP_MIN_SCORE,
    reservedOf: isReservedRow,
  });
}

/** The ranking passes as configured, handed to the selector per call so a
 *  `.env` change only needs a restart, never a re-require. */
function rankingOptions() {
  return {
    slots: TAG_RESERVED_SLOTS,
    minRatio: RERANK_RELATIVE_MIN,
    topMin: RERANK_TOP_MIN_SCORE,
    reservedOf: isReservedRow,
    decayAdmission: DECAY_ADMISSION,
    decay: { enabled: DECAY_ENABLED, halfLifeDays: DECAY_HALF_LIFE_DAYS, floor: DECAY_FLOOR },
    mmr: {
      enabled: MMR_ENABLED,
      lambda: MMR_LAMBDA,
      similarityFloor: MMR_SIM_FLOOR,
      duplicateCut: MMR_DUPLICATE_CUT,
      maxPartsPerKey: MMR_MAX_PARTS_PER_KEY,
    },
  };
}

/**
 * The pool one query contributes to the final selection. The membership
 * decision belongs to the query that produced the scores a relative cut is
 * relative to, so it is made here and rides the row as `eligible`: the final
 * selection may reorder these rows but can never add one the query's own
 * thresholds rejected. Up to {@link TAG_RESERVED_SLOTS} tag hits and the query's
 * own top-POOL_LIMIT rows are carried; `incumbent` marks the rows the shipped
 * selection would have injected, which is what the shadow comparison measures
 * against and what gates the auxiliary queries.
 *
 * `queryId` rides along because the cross-encoder's scores are only comparable
 * inside the call that produced them: the final selection normalizes and cuts
 * per group, so a row must say which query's set it came from.
 *
 * Without a cross-encoder there is no set-relative score to cut against, and
 * the shipped tag-first slice is the whole candidate set: the pool is that
 * slice unchanged, so enabling the ranking passes cannot widen it.
 */
function buildRecallPool(ranked, { reranked, queryId = '' }) {
  const ordered = reranked
    ? [...ranked].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
    : ranked;
  const incumbent = reranked
    ? selectIncumbent({ ranked: ordered, limit: RERANK_LIMIT })
    : ordered.slice(0, RERANK_LIMIT);
  const incumbentIds = new Set(incumbent.map((entry) => memoryPartId(entry.key, entry.section)));
  const decorate = (entry, eligible) => ({
    ...entry,
    eligible,
    queryId,
    incumbent: incumbentIds.has(memoryPartId(entry.key, entry.section)),
  });
  if (!reranked) {
    return ordered.slice(0, RERANK_LIMIT).map((entry) => decorate(entry, true));
  }
  const top = ordered.length > 0 ? Number(ordered[0].score) || 0 : 0;
  const cold = RERANK_TOP_MIN_SCORE > 0 && top < RERANK_TOP_MIN_SCORE;
  const floor = RERANK_RELATIVE_MIN > 0 ? top * RERANK_RELATIVE_MIN : Number.NEGATIVE_INFINITY;
  const reserved = ordered
    .filter(isReservedRow)
    .slice(0, Math.min(TAG_RESERVED_SLOTS, RERANK_LIMIT));
  const reservedIds = new Set(reserved.map((entry) => memoryPartId(entry.key, entry.section)));
  const rest = ordered.filter((entry) => !reservedIds.has(memoryPartId(entry.key, entry.section)));
  return [...reserved, ...rest]
    .slice(0, POOL_LIMIT)
    .map((entry) => decorate(entry, !cold && (Number(entry.score) || 0) >= floor));
}

/** Rows the shipped selection would have injected, for the auxiliary gate and
 *  the shadow comparison. */
function incumbentCount(entries) {
  return entries.reduce((count, entry) => (entry?.incumbent === true ? count + 1 : count), 0);
}

/** Reports what the ranking passes would change on this recall without letting
 *  them change it. The injected set stays the incumbent one while this is on. */
function logShadowSelection({ pool, proposed }) {
  const incumbent = pool.filter((entry) => entry.incumbent === true);
  const diff = diffSelection(incumbent, proposed, (entry) =>
    memoryPartId(entry.key, entry.section),
  );
  const before = redundancyStats(incumbent, { similarityFloor: MMR_SIM_FLOOR });
  const after = redundancyStats(proposed, { similarityFloor: MMR_SIM_FLOOR });
  logger.info(
    `[memoryRecall][shadow] ${JSON.stringify({
      pool: pool.length,
      eligible: pool.filter((entry) => entry.eligible !== false).length,
      incumbent: incumbent.map((entry) => entry.key),
      proposed: proposed.map((entry) => entry.key),
      changed: diff.changed,
      swappedIn: diff.swappedIn,
      swappedOut: diff.swappedOut,
      pairs: before.pairs,
      meanSimilarityBefore: Number(before.mean.toFixed(4)),
      meanSimilarityAfter: Number(after.mean.toFixed(4)),
      duplicatePairsBefore: before.duplicates,
      duplicatePairsAfter: after.duplicates,
    })}`,
  );
}

/**
 * Embeds `query`, recalls a broad vector candidate set, then reranks it down to
 * the most relevant ephemeral memories. Returns raw hits
 * ({ key, value, score, updated_at }) or an empty array when disabled / on
 * error so callers never fail a turn because of recall.
 *
 * `contextMemoryKeys` are the keys whose memory already rides this turn's
 * system context: the memories this conversation produced. They are dropped
 * before anything else looks at the candidates, so the next candidate takes
 * the slot.
 *
 * `loadTagVocabulary` reads the store's tags. A tag the query spells out adds
 * its memories to the candidate set outright and lets the query past
 * {@link GATE_MIN_SCORE}: the gate exists to spare the cross-encoder on turns
 * that clearly touch no memory, and a lexical tag hit is that question answered
 * the other way.
 */
async function recallEphemeralMemories({
  userId,
  storeId,
  domainIds,
  query,
  queryId = '',
  timezone,
  contextMemoryKeys,
  loadTagVocabulary,
  loadMemoryDocuments,
}) {
  if (!query || !vectorStore.isEnabled() || !embeddings.isEnabled()) {
    return [];
  }
  try {
    await vectorStore.ensureSchema();
    const vector = await embeddings.embedText(query.slice(0, 1500), 'query');
    const candidates =
      (await vectorStore.searchVectors({
        userId,
        storeId,
        domainIds,
        queryVector: vector,
        limit: CANDIDATE_LIMIT,
        threshold: null,
      })) ?? [];
    /** Memories the turn's context already carries go first: recalling them
     *  back would only spend the cap on what the model is already reading. */
    const eligible =
      contextMemoryKeys != null && contextMemoryKeys.size > 0
        ? candidates.filter((entry) => !contextMemoryKeys.has(entry.key))
        : candidates;
    const matches = tagVocabulary.matchedTagUsages({
      text: query,
      vocabulary: await tagVocabulary.vocabularyFor({ storeId, loadUsage: loadTagVocabulary }),
    });
    const { specific, generic } = tagVocabulary.splitTagMatches(matches, TAG_SPECIFIC_MAX_COUNT);
    const queryChars = query.trim().length;
    const upgradable = TAG_OCCURRENCE_PROMOTES_GENERIC ? [...specific, ...generic] : specific;
    const repeated =
      TAG_MIN_OCCURRENCES > 0
        ? upgradable.filter((tag) => {
            const match = matches.find((entry) => entry.tag === tag);
            return (match?.occurrences ?? 0) >= TAG_MIN_OCCURRENCES;
          })
        : [];
    const deliberate = [
      ...new Set([
        ...(TAG_MIN_DENSITY > 0 && queryChars > 0
          ? specific.filter((tag) => tag.length / queryChars >= TAG_MIN_DENSITY)
          : specific),
        ...repeated,
      ]),
    ];
    const matchedTags = matches.map((match) => match.tag);
    const tagHits =
      matchedTags.length > 0
        ? await vectorStore.searchByTags({
            userId,
            storeId,
            domainIds,
            tags: matchedTags,
            queryVector: vector,
            limit: CANDIDATE_LIMIT,
          })
        : [];
    const merged = mergeTagHits({
      candidates: eligible,
      tagHits,
      excluded: contextMemoryKeys,
      specificTags: new Set(deliberate),
    });
    /** The term-overlap channel: the memories this turn names in words, which
     *  is what finds a dated note or a proper noun the embedding space dropped.
     *  It runs before the gate because a memory whose *title* names the day the
     *  turn asked about is evidence the embedding space cannot see: a short
     *  "9月28日发生了什么" scores below the gate while the day's memory sits
     *  right there. The channel itself is cheap — an index read — and its rows
     *  only join the set as candidates. */
    const lexicalHits = await searchLexicalMemories({
      userId,
      storeId,
      domainIds,
      query,
      timezone,
      excludeKeys: contextMemoryKeys,
      loadDocuments: loadMemoryDocuments,
    });
    /** The closest row is what says whether this query touches memory at all,
     *  independent of the order the store hands the candidates back in. */
    const best = eligible.reduce(
      (max, entry) => (entry.score != null && entry.score > max ? entry.score : max),
      Number.NEGATIVE_INFINITY,
    );
    /** One class of evidence may open the gate: a day named by a memory's own
     *  title. It buys the reranker call, not an injection — the reserved seat
     *  still asks for a shared word and a positive score. */
    const dayEvidence = lexicalHits.some((hit) => hit.dayTitle === true);
    const tagEvidence = merged.some((entry) => entry.tagSpecific === true);
    const gated = best < GATE_MIN_SCORE;
    if (gated && !tagEvidence && !dayEvidence) {
      return [];
    }
    /** Rows that matched a day and nothing else are what this recall runs on
     *  when the day is the only reason it was opened; otherwise they are
     *  dropped, so a topic question that happens to name today does not spend
     *  its candidate list on the day's diary entries. */
    const openedByDay = gated && !tagEvidence && dayEvidence;
    const usable = openedByDay ? lexicalHits : lexicalHits.filter((hit) => hit.dateOnly !== true);
    const pool = mergeLexicalHits({
      candidates: merged,
      lexicalHits: usable,
      excluded: contextMemoryKeys,
    });
    /** Two-stage screening: the vector score drops the rows a similarity
     *  comparison already calls unrelated, and whatever survives goes to the
     *  cross-encoder (or, without one, straight through). A tag-matched row
     *  skips that screen — its evidence was never a score. A term-overlap row
     *  has no score to be screened by and skips it for the same reason. */
    const plausible = pool.filter((entry) => {
      if (entry.tagSpecific === true || entry.lexical === true) {
        return true;
      }
      return entry.score != null && entry.score >= COSINE_MIN_SCORE;
    });
    if (plausible.length === 0) {
      return [];
    }
    /** The cross-encoder only orders what the screen let through. Its scores
     *  are not comparable across candidate sets (the sidecar pads a set to
     *  its longest pair, so the same pair scores differently in a different
     *  set), which rules them out as a floor. Membership is decided above; the
     *  sort here is what turns "scored" into "ranked" — rows whose score went
     *  missing (misaligned answer, see `rerankMemories`) sink to the bottom. */
    if (reranker.isEnabled()) {
      const ranked = await reranker.rerankMemories({
        query: rerankQuery(
          query,
          timezone,
          undefined,
          lexicalHits.some((hit) => hit.dayMemory === true),
        ),
        /** The cap is the ranker's budget, not a cut of the memory: the row
         *  keeps its whole value and the injected text is unchanged. */
        entries: capRerankEntries(plausible),
      });
      /** With the ranking passes off the shipped selection is returned here,
       *  exactly as it always was; on, the query contributes its pool and the
       *  choice is made once, after every query and the document lookup. */
      return RANKING_ACTIVE
        ? buildRecallPool(ranked, { reranked: true, queryId })
        : selectIncumbent({ ranked, limit: RERANK_LIMIT });
    }
    /** Without the cross-encoder the vector score is the only ranking there is,
     *  so tag hits lead: they are the higher-confidence signal of the two. */
    const ordered = [...plausible].sort(
      (a, b) =>
        Number(b.tagSpecific === true) - Number(a.tagSpecific === true) ||
        (Number(b.score) || 0) - (Number(a.score) || 0),
    );
    return RANKING_ACTIVE
      ? buildRecallPool(ordered, { reranked: false, queryId })
      : ordered.slice(0, RERANK_LIMIT);
  } catch (error) {
    logger.error('[memoryRecall] Failed to recall ephemeral memories', error);
    return [];
  }
}

/**
 * Whether the recall pipeline can run at all in this deployment. Callers use
 * it to skip recall work (embedding the turn's text, hitting the vector store)
 * when either half of the pipeline is switched off.
 */
function isRecallEnabled() {
  return vectorStore.isEnabled() && embeddings.isEnabled();
}

/**
 * The vector row is a copy of the memory, and the memory document is the
 * authority on whether that copy still belongs there. A row can outlive its
 * entry — a store cleared while its vector sync could not reach the store, a
 * deletion whose vector delete never landed, a database edited by hand — and a
 * stale copy is injected as a memory the user already deleted, verbatim and
 * forever, because recall reads the row's own `value`. A row is stale in two
 * ways: its memory is gone, or its memory became stable. Stable memories ride
 * the cacheable system baseline and leave the vector store, so a row left
 * behind by a dropped delete would be injected on top of the copy the prompt
 * already carries.
 *
 * So the lookup that re-stamps `updated_at` also decides membership: a key the
 * store cannot resolve, or resolves to a stable memory, is dropped from the
 * recalled set and reported back, so the caller can reclaim its row. The stamp
 * itself comes from the document too: a row's `updated_at` is the *sync* time,
 * which moves on a re-embed without the memory changing.
 *
 * A lookup that fails keeps every entry: an unreachable database is not
 * evidence that the memories are gone, and a turn must never lose its recall
 * to a read error.
 *
 * Returns `{ entries, stale }`.
 */
async function reconcileRecalledEntries({ entries, loadEntriesByKeys }) {
  if (entries.length === 0 || typeof loadEntriesByKeys !== 'function') {
    return { entries, stale: [] };
  }
  let rows;
  try {
    rows = await loadEntriesByKeys(entries.map((entry) => entry.key));
  } catch (error) {
    logger.warn('[memoryRecall] Failed to read recalled memory documents', error);
    return { entries, stale: [] };
  }
  if (!Array.isArray(rows)) {
    return { entries, stale: [] };
  }
  const documents = new Map();
  for (const row of rows) {
    if (row?.key) {
      documents.set(row.key, row);
    }
  }
  const kept = [];
  const stale = [];
  for (const entry of entries) {
    const document = documents.get(entry.key);
    if (document == null || document.stable === true) {
      stale.push(entry.key);
      continue;
    }
    const stamped = document.updated_at ? { ...entry, updated_at: document.updated_at } : entry;
    kept.push(withSectionFraming(stamped, document));
  }
  /** A sectioned memory's `@key` links are moved onto the first of its recalled
   *  parts here, while the documents that hold them are still at hand. */
  return { entries: consolidateTrailingLinks({ entries: kept, documents }), stale };
}

/**
 * Frames a recalled section: the document lead — the title and intro before its
 * first `##` — in front of a later section, and `……` above and/or below where
 * the excerpt skips sections. A later section is stored and embedded without
 * the lead, so it is joined back on here, which is the one place both the
 * model's text and the reply's card read from. The first section already
 * carries the lead, and a memory recalled whole has no section at all, so both
 * pass through with only the omission marks they need.
 */
function withSectionFraming(entry, document) {
  if (entry.section == null || entry.section === '' || typeof entry.value !== 'string') {
    return entry;
  }
  const framed = frameMemorySection(entry.value, entry.section, document.value);
  return framed === entry.value ? entry : { ...entry, value: framed };
}

/** Reclaims the rows of memories that no longer belong in the vector index —
 *  deleted ones and ones that went stable — because the recall just proved them
 *  stale, and the index is corrected once instead of answering the same lookup
 *  on every following turn. Fire-and-forget: the recalled set is already
 *  correct without it, and a failed delete only costs the next reconciliation. */
function dropStaleVectorRows({ userId, storeId, keys }) {
  for (const key of new Set(keys)) {
    Promise.resolve()
      .then(() => vectorStore.deleteVector({ userId, storeId, key }))
      .catch((error) => {
        logger.warn('[memoryRecall] Failed to reclaim a stale memory vector', error);
      });
  }
}

/**
 * The same part can be reached by more than one query of one recall — the
 * turn's own text and the digest of the conversation it continues often point
 * at the same note. One row per part is kept, and no order is decided here: the
 * merged set is stamped from the memory documents and sorted as a single
 * timeline further down. Two sections of one memory are two parts and both
 * survive.
 *
 * The score is taken from the query that produced it: a repeat inside one
 * query's set folds to the better of the two, while a repeat across queries
 * keeps the first query's row (the core, merged first) and only gains flags
 * from the later one. Scores from different calls are not comparable, so a
 * cross-call maximum would be a number with no meaning — and would drag the
 * wrong `queryId` along with it for the per-group normalization.
 */
function mergeRecallHits(sets) {
  const merged = new Map();
  for (const set of sets) {
    for (const entry of set ?? []) {
      if (entry?.key == null) {
        continue;
      }
      const id = memoryPartId(entry.key, entry.section);
      const existing = merged.get(id);
      if (existing == null) {
        merged.set(id, entry);
        continue;
      }
      /** Both verdicts are a yes from any query that reached the part: the pool
       *  carries the union, not the majority. */
      const incumbent = existing.incumbent === true || entry.incumbent === true;
      const eligible = existing.eligible !== false || entry.eligible !== false;
      /** Inside one query's set the scores are comparable, so a repeat folds
       *  to the better one. Across queries they are not — the sidecar pads each
       *  call to its own longest pair — so the first query to reach a part (the
       *  core, merged first) keeps the score and the cut verdict that came with
       *  it, and a later query only adds flags. Otherwise the final selection
       *  would normalize one call's number inside another call's group. */
      const sameGroup = existing.queryId === entry.queryId;
      const replaces =
        sameGroup &&
        entry.score != null &&
        (existing.score == null || entry.score > existing.score);
      const next = replaces
        ? { ...existing, score: entry.score, eligible: entry.eligible, incumbent }
        : { ...existing, eligible, incumbent };
      if (
        replaces ||
        next.incumbent !== existing.incumbent ||
        next.eligible !== existing.eligible
      ) {
        merged.set(id, next);
      }
    }
  }
  return [...merged.values()];
}

/**
 * Text-memory half of the pipeline: vector candidates, rerank, chronological
 * ordering, exclusion, link gists and formatting.
 *
 * The recall has one core and one auxiliary. `query` is the core: the text
 * that IS the turn — the user's message. It is recalled first and owns the
 * slots. `contextQuery` (the conversation the turn continues) is the
 * auxiliary: it is consulted only while slots are open, and on its own terms —
 * same gate, same screen — so a core that answered the turn is never crowded
 * out by a text that merely describes it. Everything lands in one chronological
 * timeline.
 */
async function recallTextMemories({
  userId,
  storeId,
  domainIds,
  domainLabelOf,
  timezone,
  query,
  contextQuery,
  excludeKeys,
  loadEntriesByKeys,
  contextMemoryKeys,
  loadTagVocabulary,
  loadMemoryDocuments,
  collectDiagnostics = false,
}) {
  const core = typeof query === 'string' ? query.trim() : '';
  /** The texts that only speak for the turn instead of being it. The digest
   *  says what the subject is, so it may not displace the turn's own content.
   *  It carries its own id: one recall per text is one reranker call, and those
   *  scores are only comparable inside the call that produced them. */
  const fillers = [
    {
      text: typeof contextQuery === 'string' ? contextQuery.trim() : '',
      options: { queryId: CONTEXT_QUERY_ID },
    },
  ].filter((filler) => filler.text.length > 0);
  if (!core && fillers.length === 0) {
    return { entries: [], text: '' };
  }
  if (!isRecallEnabled()) {
    return { entries: [], text: '' };
  }
  const recallQuery = (text, override) =>
    recallEphemeralMemories({
      userId,
      storeId,
      domainIds,
      query: text,
      queryId: CORE_QUERY_ID,
      timezone,
      contextMemoryKeys,
      loadTagVocabulary,
      loadMemoryDocuments,
      ...override,
    });
  /** One core, then the digest only while slots are open. A turn's own content
   *  is what the recall is for, so it is never crowded out by a text that only
   *  describes it: the digest answers the case the core left unanswered, which
   *  is also what keeps its known noise out of a turn that recalled plenty on
   *  its own. */
  let hits = core ? mergeRecallHits([await recallQuery(core)]) : [];
  for (const filler of fillers) {
    /** The gate reads the shipped selection's verdict, not the pool size: a
     *  core that already fills every slot needs no auxiliary, which is the
     *  rule the shipped path expressed as "hits.length >= RERANK_LIMIT". */
    if ((RANKING_ACTIVE ? incumbentCount(hits) : hits.length) >= RERANK_LIMIT) {
      break;
    }
    /** A digest and an unrelated memory sit close together in the embedding
     *  space — both are conversational prose — so cosine alone cannot tell a
     *  continuing subject from a stray one, which is exactly the job the
     *  cross-encoder exists for. */
    const extra = await recallQuery(filler.text, filler.options);
    if (extra.length > 0) {
      hits = RANKING_ACTIVE
        ? mergeRecallHits([hits, extra]).slice(0, POOL_LIMIT)
        : mergeRecallHits([hits, extra]).slice(0, RERANK_LIMIT);
    }
  }
  if (hits.length === 0) {
    return { entries: [], text: '' };
  }
  const { entries: reconciled, stale } = await reconcileRecalledEntries({
    entries: hits,
    loadEntriesByKeys,
  });
  dropStaleVectorRows({ userId, storeId, keys: stale });
  /** The final choice. With the ranking passes off the per-query stage already
   *  chose and this is the shipped path unchanged: a chronological timeline
   *  with the run's already-injected keys filtered out. On, the choice happens
   *  here — after the document lookup has stamped every row with the memory's
   *  real edit time and with the whole pool in hand — and the exclusion is
   *  applied before it, so a row the run already injected cannot spend a slot.
   *  Shadow runs compute the proposed choice, report it and inject the
   *  incumbent one. */
  let chosen;
  let diagnostics;
  if (!RANKING_ACTIVE) {
    const ordered = sortRecalledByTime(reconciled);
    chosen = excludeKeys?.size ? ordered.filter((entry) => !excludeKeys.has(entry.key)) : ordered;
  } else {
    const pool = excludeKeys?.size
      ? reconciled.filter((entry) => !excludeKeys.has(entry.key))
      : reconciled;
    const proposed = selectRecall({
      entries: pool,
      limit: RERANK_LIMIT,
      partIdOf: (entry) => memoryPartId(entry.key, entry.section),
      /** One group per recall query: the merged pool holds several cross-encoder
       *  calls, and those scores are only comparable inside their own call. */
      groupOf: (entry) => entry.queryId ?? '',
      ...rankingOptions(),
    });
    if (SHADOW) {
      logShadowSelection({ pool, proposed });
      /** The incumbent is reproduced as the shipped path produced it: its own
       *  merge cap first, then the run exclusion, then the timeline. Ranking
       *  changes nothing while the observation window is open. */
      const incumbent = pool.filter((entry) => entry.incumbent === true).slice(0, RERANK_LIMIT);
      const kept = excludeKeys?.size
        ? incumbent.filter((entry) => !excludeKeys.has(entry.key))
        : incumbent;
      chosen = sortRecalledByTime(kept);
    } else {
      chosen = sortRecalledByTime(proposed);
    }
    if (collectDiagnostics) {
      const redundancy = redundancyStats(chosen, { similarityFloor: MMR_SIM_FLOOR });
      diagnostics = {
        pool: pool.length,
        eligible: pool.filter((entry) => entry.eligible !== false).length,
        selected: chosen.length,
        pairs: redundancy.pairs,
        meanSimilarity: Number(redundancy.mean.toFixed(4)),
        duplicatePairs: redundancy.duplicates,
      };
    }
  }
  /** A ranking input is not memory content: the vectors ride the pool so the
   *  redundancy pass can read them and are dropped here, before anything that
   *  renders or persists a row ever sees one. */
  /** A recalled value can link other memories: every link gets a one-line gist
   *  of the memory it points at, so the model knows what a follow-up read would
   *  bring. The gists ride the rows themselves — the reply's recalled card
   *  renders the same text the model reads — and the caller's stamps only use
   *  the keys. */
  /** A recalled value keeps its `tags:` lines, but the link scanner reads only
   *  the very end of a value: a trailing tag line would hide a genuine `@key`
   *  link above it and that link would lose its gist. Stripping the tag lines
   *  here — before the scan, after scoring — keeps both features working on a
   *  value that declares both. The tags are resolved onto the row at the same
   *  time, so a row stays renderable on its own even when the vector store
   *  handed back no tags. */
  const kept = chosen.map((entry) => {
    const clean = { ...entry };
    delete clean.embedding;
    delete clean.eligible;
    delete clean.incumbent;
    delete clean.queryId;
    delete clean.lexical;
    delete clean.rerankText;
    delete clean.dayMemory;
    delete clean.dayTitle;
    delete clean.dateOnly;
    return { ...clean, value: memoryContentOf(entry), tags: memoryTagsOf(entry) };
  });
  const entries = await annotateLinkedSummaries({ entries: kept, loadEntriesByKeys });
  return { entries, text: formatRecalled(entries, domainLabelOf, timezone), diagnostics };
}

/**
 * Full recall for one turn: text memories and image memories, each with its
 * own gate and its own space, presented as separate blocks. `excludeKeys`
 * carries every key already injected in this run — text keys directly,
 * image keys prefixed — so neither half can repeat a hit.
 *
 * `query` is the turn's own content — the user's message: the text half recalls
 * it as its core, and every hit lands in one chronologically ordered block. The
 * image half reads it too.
 *
 * `images` carries the machine-readable hits (URL, mime, optional data URL);
 * `text` is what the model reads. Never throws: a failed half yields nothing.
 * `loadEntriesByKeys` resolves memories by key from the documents: it decides
 * which recalled rows still exist (a row whose memory is gone is dropped and
 * reclaimed, see {@link reconcileRecalledEntries}) and resolves the memories a
 * recalled entry links, so each link can carry a one-line gist of its target.
 * `contextMemoryKeys` excludes the memories the turn's own context already
 * carries; `loadTagVocabulary` reads the store's tags so a query that names one
 * recalls its memories outright. `loadMemoryDocuments` reads the store's
 * documents for the term-overlap channel, which is what finds a memory the
 * embedding space does not retrieve; without it that channel stays off.
 *
 * `contextQuery` is the conversation digest, the text half's auxiliary
 * (see {@link recallTextMemories}). The image half does not read it — the
 * digest names a subject in prose, which is not what finds a picture.
 */
async function prepareRecalledMemories({
  userId,
  storeId,
  domainIds,
  domainLabelOf,
  timezone,
  query,
  contextQuery,
  excludeKeys,
  loadEntriesByKeys,
  includeImageData = true,
  contextMemoryKeys,
  loadTagVocabulary,
  loadMemoryDocuments,
  collectDiagnostics = false,
}) {
  /** A turn that only continues an earlier subject still has a query:
   *  `contextQuery`. */
  if (!query && !contextQuery) {
    return { entries: [], images: [], text: '' };
  }
  const [memories, images] = await Promise.all([
    recallTextMemories({
      userId,
      storeId,
      domainIds,
      domainLabelOf,
      timezone,
      query,
      contextQuery,
      excludeKeys,
      loadEntriesByKeys,
      contextMemoryKeys,
      loadTagVocabulary,
      loadMemoryDocuments,
      collectDiagnostics,
    }),
    recallImageMemories({
      userId,
      storeId,
      domainIds,
      /** The image half reads the same text: a description of the moment finds
       *  the picture the moment was about. */
      query,
      excludeKeys,
      includeDataUrls: includeImageData,
    }),
  ]);
  return {
    entries: memories.entries,
    images: images.entries,
    text: [memories.text, images.text].filter(Boolean).join('\n\n'),
    ...(memories.diagnostics ? { diagnostics: memories.diagnostics } : {}),
  };
}

/** The selection with this deployment's thresholds as defaults, so a caller
 *  that passes none keeps the shipped behavior. */
function selectRankedForCaller(params) {
  return selectRanked({
    slots: TAG_RESERVED_SLOTS,
    minRatio: RERANK_RELATIVE_MIN,
    topMin: RERANK_TOP_MIN_SCORE,
    reservedOf: isReservedRow,
    ...params,
  });
}

const exported = {
  recallEphemeralMemories,
  prepareRecalledMemories,
  isRecallEnabled,
  formatRecalled,
  RECALL_HEADER,
  sortRecalledByTime,
  mergeTagHits,
  mergeLexicalHits,
  selectRanked: selectRankedForCaller,
  capRerankQuery,
  capRerankEntries,
  rerankQuery,
};

export default exported;
