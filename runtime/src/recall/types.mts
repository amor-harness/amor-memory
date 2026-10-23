/**
 * Types shared by the recall pipeline.
 *
 * The recall modules sit between three boundaries that hand over unstructured
 * values: Postgres rows (`memory_vectors`, `image_vectors`), the host's
 * memory-document loaders, and the `@amor-harness/api/recall-ranking` module the
 * plugin requires at runtime. Each shape is declared once here so the modules
 * can cast at the boundary and stay typed from there inward.
 */

/** One stored memory document as recall reads it: the fields the reconciler,
 *  the link gists and the lexical index need. */
export interface MemoryDocumentRow {
  key: string;
  value: string;
  tags?: string[] | null;
  domainId?: string | null;
  stable?: boolean;
  updated_at?: Date | string | null;
}

/** The scope one lexical index covers: a user's store, optionally by domain. */
export interface LexicalScope {
  userId?: string;
  storeId?: string;
  domainIds?: string[];
}

/** Injected read of every document in a scope, for the lexical channel. */
export type LoadMemoryDocuments = (scope: LexicalScope) => Promise<MemoryDocumentRow[]>;

/** Injected read of memory documents by key: the reconciler and the link gists
 *  resolve a recalled row's authority through it. */
export type LoadEntriesByKeys = (keys: string[]) => Promise<MemoryDocumentRow[]>;

/** One tag and how many memories carry it. */
export interface TagUsage {
  tag: string;
  count: number;
  promoted?: boolean;
}

/** Injected read of a store's tag usage, most used first. */
export type LoadTagVocabulary = (params: {
  storeId?: string | null;
  limit: number;
}) => Promise<TagUsage[]>;

/**
 * One recalled row: a memory part after a channel produced it and before the
 * pipeline rendered it. `value` is what gets injected; `rerankText` is the
 * ranker's budget for the row; the flags are the channel evidence the ranking
 * passes read.
 *
 * A type alias rather than an interface: the shared memory helpers take a
 * `MemoryEntryLike` with an index signature, and only an object type literal
 * gets the implicit index signature that makes this assignable to it.
 */
export type RecallRow = {
  key: string;
  section?: string | null;
  value?: string | null;
  rerankText?: string;
  tags?: string[] | null;
  domainId?: string | null;
  updated_at?: Date | string | null;
  score?: number | null;
  embedding?: number[] | null;
  tagMatch?: boolean;
  tagSpecific?: boolean;
  lexical?: boolean;
  dayTitle?: boolean;
  dayMemory?: boolean;
  dateOnly?: boolean;
  eligible?: boolean;
  incumbent?: boolean;
  queryId?: string;
};

/** One `memory_vectors` row as Postgres returns it. The embedding column is a
 *  pgvector literal unless the caller projects it, so it reaches us unparsed. */
export interface MemoryVectorRow {
  key: string;
  section: string;
  value: string;
  tags: string[] | null;
  domainId: string;
  updated_at: Date;
  score: number | null;
  embedding?: unknown;
}

/** One scored `memory_vectors` row after the store parsed its embedding. */
export interface MemoryVectorHit {
  key: string;
  section: string;
  value: string;
  tags: string[] | null;
  domainId: string;
  updated_at: Date;
  score: number | null;
  embedding?: number[] | null;
  tagMatch?: boolean;
}

/** One `##` section a memory's vector rows are written for. */
export interface MemoryVectorPart {
  section?: string | null;
  vector: number[];
  value: string;
}

/** One `image_vectors` row with its similarity score. */
export interface ImageVectorRow {
  sha256: string;
  domainId: string;
  updated_at: Date;
  score: number | null;
}

/** Result of one Postgres query as these stores read it. */
export interface PostgresResult<Row> {
  rows: Row[];
}

/** The part of a Postgres client the vector stores use. */
export interface PostgresClient {
  query<Row>(sql: string, values?: readonly unknown[]): Promise<PostgresResult<Row>>;
  release(): void;
}

/** The part of a Postgres pool the vector stores use. */
export interface PostgresPool {
  connect(): Promise<PostgresClient>;
}

/** The embedding task an endpoint is called with. */
export type EmbeddingTask = 'query' | 'passage';

/** One recalled image as the caller re-injects it. */
export interface RecalledImage {
  key: string;
  sha256: string;
  id?: number;
  mime?: string;
  url: string;
  width?: number;
  height?: number;
  score?: number;
  updatedAt?: Date;
  dataUrl?: string;
}

/** The image columns an image recall projects from `memoryimages`. `lean()`
 *  hands the stored bytes back as BSON Binary, which proxies Buffer's base64
 *  encoding, so only that read is declared here. */
export interface MemoryImageLeanRow {
  sha256: string;
  id?: number;
  mime?: string;
  width?: number;
  height?: number;
  data?: { toString(encoding: 'base64'): string };
  embedded?: boolean;
  updatedAt?: Date;
}

/** What one image-recall pass returns. */
export interface ImageRecallResult {
  entries: RecalledImage[];
  text: string;
}

/** One memory document reduced to the terms the lexical channel scores. */
export interface LexicalDoc {
  key: string;
  termCounts: Map<string, number>;
  length: number;
}

/** BM25 statistics over one document set. */
export interface LexicalIndex {
  docs: LexicalDoc[];
  idf: Map<string, number>;
  avgLength: number;
}

/** One calendar day a recall query names. */
export interface RecallDate {
  iso: string;
  label: string;
  daysAgo: number;
}

/** The days one query names, as the ranking module resolves them. */
export interface RecallDates {
  dates: RecallDate[];
}

/** Options the day resolution reads. */
export interface ResolveDateOptions {
  now?: Date | number;
  timezone?: string;
}

/** One candidate as the ranking primitives see it. Extra fields ride along. */
export interface RankableRow {
  key: string;
  section?: string | null;
  score?: number | null;
  tagMatch?: boolean;
  tagSpecific?: boolean;
  queryId?: string;
  eligible?: boolean;
  embedding?: number[] | null;
  updated_at?: Date | string | null;
}

/** Time-decay weights for the ranking passes. */
export interface DecayConfig {
  enabled: boolean;
  halfLifeDays: number;
  floor: number;
}

/** Maximal-marginal-relevance weights for the ranking passes. */
export interface MmrConfig {
  enabled: boolean;
  lambda: number;
  similarityFloor: number;
  duplicateCut: number;
  maxPartsPerKey: number;
}

/** Options of the shipped per-query selection. */
export interface SelectRankedOptions<T extends RankableRow> {
  ranked: T[];
  limit: number;
  slots?: number;
  minRatio?: number;
  topMin?: number;
  reservedOf?: (entry: T) => boolean;
}

/** Options of the generalized selection. */
export interface SelectRecallOptions<T extends RankableRow> {
  entries: T[];
  limit: number;
  slots?: number;
  reservedOf?: (entry: T) => boolean;
  decay?: Partial<DecayConfig>;
  mmr?: Partial<MmrConfig>;
  groupOf?: (entry: T) => string;
  minRatio?: number;
  topMin?: number;
  decayAdmission?: boolean;
  now?: number;
  ageOf?: (entry: T, now: number) => number;
  partIdOf?: (entry: T) => string;
}

/** How redundant one selection is. */
export interface RedundancyStats {
  pairs: number;
  mean: number;
  duplicates: number;
}

/** Which parts a proposed selection would swap in and out. */
export interface SelectionDiff {
  changed: boolean;
  swappedIn: string[];
  swappedOut: string[];
}

/**
 * The surface `@amor-harness/api/recall-ranking` exposes. It is required at
 * runtime, where the call returns `any`; this is the shape the recall modules
 * rely on.
 */
export interface RecallRankingModule {
  buildLexicalIndex(docs: LexicalDoc[]): LexicalIndex;
  dateSpellings(iso: string): string[];
  lexicalDoc(key: string, text: string): LexicalDoc;
  lexicalTerms(text: string): string[];
  normalizeRecallDates(query: string, options?: ResolveDateOptions): RecallDates;
  scoreLexical(index: LexicalIndex, terms: Iterable<string>, doc: LexicalDoc): number;
  selectRanked<T extends RankableRow>(options: SelectRankedOptions<T>): T[];
  selectRecall<T extends RankableRow>(options: SelectRecallOptions<T>): T[];
  redundancyStats(
    entries: RankableRow[],
    options?: { similarityFloor?: number; duplicateAt?: number },
  ): RedundancyStats;
  diffSelection<T extends RankableRow>(
    incumbent: T[],
    proposed: T[],
    partId?: (entry: T) => string,
  ): SelectionDiff;
}
