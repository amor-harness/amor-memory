import { z } from 'zod';
import { createRequire } from 'node:module';
import { memoryEnv } from '../backend/config.mjs';
const require = createRequire(import.meta.url);
const {
  resolveConfigHeaders,
  createSafeUser,
  GenerationJobManager,
  Tokenizer,
  ADDITIONAL_INSTRUCTIONS_NOTE,
  buildLangfuseConfig,
  buildActiveDomainsBlock,
  buildDomainKindLegend,
  implicitWriteDomain,
  resolveWriteDomain,
} = require('@amor-harness/api');
import { tool } from '@librechat/agents/langchain/tools';
import { Run, Providers, GraphEvents } from '@librechat/agents';
import { HumanMessage } from '@librechat/agents/langchain/messages';
import { Tools, replaceSpecialVars } from '@amor-harness/data-provider';
import type { Agent } from '@amor-harness/data-provider';
import { logger } from '@amor-harness/data-schemas';
import type { AppConfig } from '@amor-harness/data-schemas';
import {
  memoryTagsOf,
  appendMemoryValue,
  memoryContentOf,
  memoryTagField,
  memoryTimeField,
  normalizeMemoryValue,
} from '../db/methods.mjs';

import type { MemoryDomainScope, MemoryDomainTool } from '../domain/domain.mjs';

/** One graph event handler: the event payload belongs to the agents runtime. */
interface AgentsEventHandler {
  handle(event: string, data: unknown): void | Promise<void>;
}

/** The graph the extraction run asks `Run.create` to build. */
interface AgentsGraphConfig {
  type: string;
  signal?: AbortSignal;
  llmConfig: MemoryLLMConfig;
  tools: unknown[];
  instructions?: string;
  additional_instructions?: string;
  toolEnd: boolean;
}

/** Everything `Run.create` accepts for one extraction run. */
interface AgentsRunOptions {
  runId: string;
  graphConfig: AgentsGraphConfig;
  customHandlers?: Record<string, AgentsEventHandler>;
  returnContent: boolean;
  /** Tracing configuration; the runner hands it to the agents runtime. */
  langfuse?: object;
}

/** Per-run stream settings `processStream` reads. */
interface AgentsStreamConfig {
  runName: string;
  configurable: Record<string, string | undefined>;
  signal?: AbortSignal;
  streamMode: 'values';
  recursionLimit: number;
  version: string;
}

interface AgentsRun {
  processStream(inputs: { messages: MemoryChatRow[] }, config: AgentsStreamConfig): Promise<string>;
}

interface AgentsRunFactory {
  create(params: AgentsRunOptions): Promise<AgentsRun>;
}

/** The agents barrel's declarations use extensionless relative imports, which
 *  NodeNext cannot resolve, so the value exports are declared here. */
declare module '@librechat/agents' {
  export const Run: AgentsRunFactory;
  export const Providers: Record<string, string>;
  export const GraphEvents: Record<string, string>;
}

interface MemoryLLMConfig {
  provider?: string;
  model?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  useResponsesApi?: boolean;
  streaming?: boolean;
  disableStreaming?: boolean;
  modelKwargs?: Record<string, unknown>;
  additionalModelRequestFields?: { thinking?: unknown } | null;
  thinking?: { type?: string } | null;
  [key: string]: unknown;
}

interface MemoryUser {
  name?: string;
  [key: string]: unknown;
}

interface MemoryChatRow {
  role?: string;
  content?: unknown;
  additional_kwargs?: unknown;
  tool_calls?: unknown;
  tool_call_id?: unknown;
  name?: string;
  response_metadata?: unknown;
  artifact?: unknown;
}

/** A memory row this module formats. Declared as a type alias, not an
 *  interface, so the db formatters that take an index-signature row
 *  (`MemoryEntryLike`) and the backend row type stay interchangeable. */
type MemoryEntryRow = {
  key: string;
  value: string;
  domainId?: string | null;
  locked?: boolean;
  updated_at?: string | Date | null;
};

interface MemoryTagUsage {
  tag: string;
}

interface FormattedMemoriesParams {
  userId: string;
  storeId: string;
  domainIds?: string[];
  excludeConversationId?: string;
  timezone?: string;
}

interface FormattedMemoriesResult {
  withKeys: string;
  withoutKeys: string;
  totalTokens?: number;
}

type FormattedMemoriesGetter = (
  params: FormattedMemoriesParams,
) => Promise<FormattedMemoriesResult>;

interface SetMemoryParams {
  userId: string;
  key: string;
  value: string;
  tokenCount: number;
  storeId: string;
  domainId?: string;
  defaultDomainId?: string;
  runId?: string;
}

interface SetMemoryResult {
  ok: boolean;
  reason?: string;
  domainId?: string;
  created?: boolean;
}

interface DeleteMemoryParams {
  userId: string;
  key: string;
  storeId: string;
}

interface DeleteMemoryResult {
  ok: boolean;
  reason?: string;
}

interface ConversationMemoryParams {
  userId: string;
  storeId: string;
  domainId?: string;
  created?: boolean;
  turnMessageId?: string;
  key: string;
  conversationId: string;
}

interface EvictionParams {
  userId: string;
  tokenLimit: number;
  tokenCount: number;
}

interface EvictionResult {
  ok: boolean;
  reason?: string;
}

interface MemoryExtractionMethods {
  getFormattedMemories(params: FormattedMemoriesParams): Promise<FormattedMemoriesResult>;
  getMemoryExtractionEntries?(params: {
    userId: string;
    storeId: string;
    domainIds?: string[];
    conversationId?: string;
  }): Promise<MemoryEntryRow[] | null | undefined>;
  setMemory(params: SetMemoryParams): Promise<SetMemoryResult>;
  deleteMemory(params: DeleteMemoryParams): Promise<DeleteMemoryResult>;
  setConversationMemory?(params: ConversationMemoryParams): Promise<{ ok?: boolean }>;
  evictMemoriesToFitCapacity?(params: EvictionParams): Promise<EvictionResult>;
  getUserMemories?(params: { userId: string; storeId: string }): Promise<MemoryEntryRow[]>;
  getStoreTagVocabulary?(params: { storeId: string }): Promise<MemoryTagUsage[]>;
}

interface MemoryExtractionResponse {
  headersSent: boolean;
  write(chunk: string): void;
}

interface MemoryAttachmentMemory {
  key: string;
  type: string;
  storeId: string;
  value?: string;
  tags?: string[];
  tokenCount?: number;
  domainId?: string;
}

interface MemoryAttachment {
  type: string;
  messageId: string;
  conversationId: string;
  memory: MemoryAttachmentMemory;
}

interface MemoryArtifactAttachment {
  type: string;
  toolCallId?: string;
  messageId: string;
  conversationId: string;
  [key: string]: unknown;
}

interface MemoryToolEndData {
  output?: {
    artifact?: Record<string, unknown> | null;
    tool_call_id?: string;
  } | null;
}

interface MemoryToolEndMetadata {
  run_id?: string;
  thread_id?: string;
}

type MemoryToolEndCallback = (
  data: MemoryToolEndData,
  metadata?: MemoryToolEndMetadata,
) => void | Promise<void>;

interface MemoryExtractionJob {
  id: string;
  run(signal: AbortSignal): Promise<unknown>;
}

interface RunningMemoryExtraction {
  controller: AbortController;
  job: MemoryExtractionJob;
}

interface MemoryRequest {
  body?: { timezone?: string };
}

/** The agent fields memory-capability resolution reads. */
interface MemoryAgentLike {
  memory_store?: Agent['memory_store'];
  use_memory?: Agent['use_memory'];
  memoryCapabilityEnabled?: boolean;
  tools?: Array<string | { name?: string }> | null;
}

interface BuildMemoryToolParams {
  userId: string;
  storeId: string;
  setMemory: (params: SetMemoryParams) => Promise<SetMemoryResult>;
  getUserMemories?: (params: { userId: string; storeId: string }) => Promise<MemoryEntryRow[]>;
  setConversationMemory?: (params: ConversationMemoryParams) => Promise<{ ok?: boolean }>;
  validKeys?: string[];
  charLimit?: number;
  tokenLimit?: number;
  totalTokens?: number;
  conversationId?: string;
  turnMessageId?: string;
  evictForCapacity?: (memoryTokenCount: number) => Promise<EvictionResult>;
  domains?: MemoryDomainScope;
}

interface CreateDeleteMemoryToolParams {
  userId: string;
  storeId: string;
  deleteMemory: (params: DeleteMemoryParams) => Promise<DeleteMemoryResult>;
  getUserMemories?: (params: { userId: string; storeId: string }) => Promise<MemoryEntryRow[]>;
  validKeys?: string[];
  deletedKeys?: Set<string>;
}

interface CreateAppendMemoryToolParams {
  userId: string;
  storeId: string;
  memoryTool: { func(args: { key: string; value: string }): unknown };
  getUserMemories: (params: { userId: string; storeId: string }) => Promise<MemoryEntryRow[]>;
  validKeys?: string[];
}

interface RequestMemoriesParams {
  req: MemoryRequest;
  userId: string;
  storeId: string;
  domainIds?: string[];
  excludeConversationId?: string;
  getFormattedMemories: FormattedMemoriesGetter;
}

interface MemoryExtractionKeyParts {
  userId: string;
  storeId?: string;
  conversationId: string;
}

interface BuildInlineMemoryContextParams {
  agent: MemoryAgentLike | null | undefined;
  req: MemoryRequest;
  userId: string;
  memoryAvailable: boolean;
  getFormattedMemories: FormattedMemoriesGetter;
}

interface ProcessMemoryParams {
  res: MemoryExtractionResponse;
  userId: string;
  storeId: string;
  setMemory: (params: SetMemoryParams) => Promise<SetMemoryResult>;
  deleteMemory: (params: DeleteMemoryParams) => Promise<DeleteMemoryResult>;
  setConversationMemory?: (params: ConversationMemoryParams) => Promise<{ ok?: boolean }>;
  evictMemoriesToFitCapacity?: (params: EvictionParams) => Promise<EvictionResult>;
  getUserMemories?: (params: { userId: string; storeId: string }) => Promise<MemoryEntryRow[]>;
  getStoreTagVocabulary?: (params: { storeId: string }) => Promise<MemoryTagUsage[]>;
  domains?: MemoryDomainScope;
  domainTools?: MemoryDomainTool[];
  messages: MemoryChatRow[];
  memory?: string;
  messageId: string;
  conversationId?: string;
  validKeys?: string[];
  instructions?: string;
  llmConfig?: MemoryLLMConfig;
  tokenLimit?: number;
  totalTokens?: number;
  streamId?: string | null;
  jobCreatedAt?: Date;
  user?: MemoryUser | null;
  appConfig?: AppConfig;
  tenantId?: string | null;
  signal?: AbortSignal;
  deletedKeys: Set<string>;
}

interface MemoryProcessorConfig {
  validKeys?: string[];
  instructions?: string;
  llmConfig?: MemoryLLMConfig;
  tokenLimit?: number;
}

interface CreateMemoryProcessorParams {
  res: MemoryExtractionResponse;
  userId: string;
  storeId: string;
  messageId: string;
  memoryMethods: MemoryExtractionMethods;
  conversationId?: string;
  config?: MemoryProcessorConfig;
  streamId?: string | null;
  jobCreatedAt?: Date;
  user?: MemoryUser | null;
  appConfig?: AppConfig;
  tenantId?: string | null;
  now?: Date;
  timezone?: string;
  domains?: MemoryDomainScope;
  domainTools?: MemoryDomainTool[];
  resolveDomains?: () => Promise<{
    domains?: MemoryDomainScope;
    domainTools?: MemoryDomainTool[];
  } | null>;
}

interface HandleMemoryArtifactParams {
  res: MemoryExtractionResponse;
  data: MemoryToolEndData;
  metadata?: MemoryToolEndMetadata;
  streamId?: string | null;
  jobCreatedAt?: Date;
  messageId?: string;
  conversationId?: string;
}

interface CreateMemoryCallbackParams {
  res: MemoryExtractionResponse;
  artifactPromises: Promise<MemoryArtifactAttachment | null>[];
  streamId?: string | null;
  jobCreatedAt?: Date;
  messageId?: string;
  conversationId?: string;
}
function normalizeMemoryLLMConfig(llmConfig: MemoryLLMConfig | null | undefined): MemoryLLMConfig {
  const config = { ...(llmConfig ?? {}) };
  if (typeof config.apiKey !== 'string') {
    delete config.apiKey;
  }
  return config;
}
const memoryInstructions =
  'The system automatically stores important information and can update or delete memories based on user requests, enabling dynamic memory management.';
const SET_MEMORY_TOOL_NAME = 'set_memory';
const DELETE_MEMORY_TOOL_NAME = 'delete_memory';
const APPEND_MEMORY_TOOL_NAME = 'append_memory';
const MEMORY_KEY_CHAR_LIMIT = 1e3;
const MEMORY_KEY_PATTERN = /^[a-z0-9_]+$/;
const MEMORY_KEY_FORMAT_HINT =
  'IMPORTANT: Memory keys MUST be lowercase letters, numbers, and underscores only (e.g. "user_name", "coffee_preference", "year_2026"). Never use spaces, uppercase letters, or punctuation in keys.';
const DEFAULT_MEMORY_EXTRACTION_TOOL_ROUNDS = 4;
const MAX_MEMORY_EXTRACTION_TOOL_ROUNDS = 25;
function resolveExtractionToolRounds(raw: string | undefined): number {
  const trimmed = raw?.trim();
  const configured = trimmed ? Number(trimmed) : NaN;
  if (!Number.isFinite(configured)) {
    return DEFAULT_MEMORY_EXTRACTION_TOOL_ROUNDS;
  }
  return Math.min(Math.max(Math.trunc(configured), 1), MAX_MEMORY_EXTRACTION_TOOL_ROUNDS);
}
const MEMORY_EXTRACTION_TOOL_ROUNDS = resolveExtractionToolRounds(
  memoryEnv('MEMORY_EXTRACTION_TOOL_ROUNDS'),
);
const MEMORY_EXTRACTION_RECURSION_LIMIT = MEMORY_EXTRACTION_TOOL_ROUNDS * 2 + 1;
const SET_MEMORY_DESCRIPTION = 'Saves important information into memory.';
const DELETE_MEMORY_DESCRIPTION =
  'Deletes specific memory data using the provided key. For updating existing memories, use the `set_memory` tool instead';
const APPEND_MEMORY_DESCRIPTION =
  'Appends new text lines to the END of an existing memory, keeping the memory content already stored.';
const lockedMemoryRefusal = (key: string, entry?: MemoryEntryRow | null): string | undefined =>
  entry?.locked === true
    ? `Memory "${key}" is locked. It can only be changed from the Memories panel or the /memory files.`
    : void 0;

/** The db value normalizers keep a memory's declared `tags:` and `@key` lines
 *  canonical; both take and return the stored text. */
function normalizedMemoryValue(value: string): string {
  return normalizeMemoryValue(value);
}

function appendedMemoryValue(existingValue: string, addition: string): string {
  return appendMemoryValue(existingValue, addition);
}
function buildMemoryTagInstructions(vocabulary: MemoryTagUsage[] | null | undefined): string {
  const existingTags = (vocabulary ?? []).map((usage) => usage.tag);
  const existing =
    existingTags.length > 0
      ? `Tags already used in this store, most used first \u2014 reuse one whenever it means the same thing, and write new tags in the language these already use: ${existingTags.join(', ')}.`
      : 'This store has no established tags yet: the ones you write become its first.';
  return `# Memory tags
End every memory value with a \`tags:\` line naming its cue anchors, separated by \`|\` \u2014 for example \`tags:coffee|dessert\`.
Several \`tags:\` lines are merged, so \`tags:a|b\` on one line and \`tags:c\` on the next declare one set: {a, b, c}.
Use 3 to 6 tags. A tag names what the memory is about \u2014 a topic, a person, an object, an activity \u2014 never a whole sentence.
${existing}`;
}
const getDefaultInstructions = (
  validKeys: string[] | undefined,
  tokenLimit: number | undefined,
) => `Use the \`set_memory\` tool to save important information, but ONLY when the user has requested you to remember something.

When you want to extend an existing memory with more details, prefer the \`append_memory\` tool: it adds your new text at the END of that memory's current value.

The \`delete_memory\` tool should only be used in two scenarios:
  1. When the user explicitly asks to forget or remove specific information
  2. When updating existing memories, use the \`set_memory\` tool instead of deleting and re-adding the memory.

1. ONLY use memory tools when the user requests memory actions with phrases like:
   - "Remember [that] [I]..."
   - "Don't forget [that] [I]..."
   - "Please remember..."
   - "Store this..."
   - "Forget [that] [I]..."
   - "Delete the memory about..."

2. NEVER store information just because the user mentioned it in conversation.

3. NEVER use memory tools when the user asks you to use other tools or invoke tools in general.

4. Memory tools are ONLY for memory requests, not for general tool usage.

5. If the user doesn't ask you to remember or forget something, DO NOT use any memory tools.

6. Locked memories are read-only.

${
  validKeys && validKeys.length > 0
    ? `
VALID KEYS: ${validKeys.join(', ')}`
    : ''
}

${
  tokenLimit
    ? `
TOKEN LIMIT: Maximum ${tokenLimit} tokens per memory value.`
    : ''
}

When in doubt, and the user hasn't asked to remember or forget anything, END THE TURN IMMEDIATELY.`;
const createMemoryTool = ({
  userId,
  storeId,
  setMemory,
  /** Existing-entry loader the write guard reads `locked`/`stable` from. Older
   *  model layers may omit it; writes are then unguarded (legacy behavior). */
  getUserMemories,
  setConversationMemory,
  validKeys,
  charLimit,
  tokenLimit,
  totalTokens = 0,
  conversationId,
  turnMessageId,
  evictForCapacity,
  domains,
}: BuildMemoryToolParams) => {
  let currentTotalTokens = totalTokens;
  let writeChain: Promise<unknown> = Promise.resolve();
  const writtenTokensByKey = /* @__PURE__ */ new Map<string, number>();
  const implicitDomainId = domains ? implicitWriteDomain(domains).id : void 0;
  return tool(
    async ({ key, value, domain }) => {
      const run = async () => {
        try {
          let domainId;
          let domainSubstitution;
          if (domains && typeof domain === 'string' && domain.trim() !== '') {
            const resolved = resolveWriteDomain(domains, domain);
            domainId = resolved.domain.id;
            domainSubstitution = resolved.substitution;
            if (domainSubstitution) {
              logger.warn(`Memory domain resolved by rule: ${domainSubstitution}`);
            }
          }
          if (validKeys && validKeys.length > 0 && !validKeys.includes(key)) {
            logger.warn(
              `Memory Agent failed to set memory: Invalid key "${key}". Must be one of: ${validKeys.join(
                ', ',
              )}`,
            );
            return [`Invalid key "${key}". Must be one of: ${validKeys.join(', ')}`, void 0];
          }
          if (key.length > MEMORY_KEY_CHAR_LIMIT) {
            return [`Key exceeds maximum length of ${MEMORY_KEY_CHAR_LIMIT} characters.`, void 0];
          }
          if (!MEMORY_KEY_PATTERN.test(key)) {
            return [
              'Key must only contain lowercase letters, numbers, and underscores (e.g. "user_name"). Please retry with a valid key.',
              void 0,
            ];
          }
          const normalizedValue = normalizedMemoryValue(value);
          if (getUserMemories) {
            const entries = await getUserMemories({ userId, storeId });
            const refusal = lockedMemoryRefusal(
              key,
              entries.find((entry) => entry.key === key),
            );
            if (refusal) {
              logger.warn(`Memory Agent refused to set memory: ${refusal}`);
              return [refusal, void 0];
            }
          }
          if (charLimit && normalizedValue.length > charLimit) {
            return [`Value exceeds maximum length of ${charLimit} characters.`, void 0];
          }
          const tokenCount = Tokenizer.getTokenCount(normalizedValue, 'o200k_base');
          const baseTotalTokens = currentTotalTokens - (writtenTokensByKey.get(key) ?? 0);
          const overTokens = tokenLimit ? baseTotalTokens + tokenCount - tokenLimit : 0;
          if (overTokens > 0) {
            const errorArtifact = {
              [Tools.memory]: {
                key: 'system',
                type: 'error',
                value: JSON.stringify({
                  errorType: 'already_exceeded',
                  tokenCount: overTokens,
                  totalTokens: baseTotalTokens,
                  tokenLimit,
                }),
                tokenCount: baseTotalTokens,
              },
            };
            if (evictForCapacity) {
              const capacity = await evictForCapacity(tokenCount);
              if (!capacity.ok) {
                return [
                  capacity.reason || 'Memory storage exceeded. Cannot save new memories.',
                  errorArtifact,
                ];
              }
            } else {
              return [`Memory storage exceeded. Cannot save new memories.`, errorArtifact];
            }
          }
          const newTotalTokens = baseTotalTokens + tokenCount;
          const writtenTags = memoryTagsOf({ value: normalizedValue });
          const writtenContent = memoryContentOf({ value: normalizedValue });
          const artifact = {
            [Tools.memory]: {
              key,
              value: normalizedValue,
              ...(writtenContent !== normalizedValue ? { content: writtenContent } : {}),
              ...(writtenTags.length > 0 ? { tags: writtenTags } : {}),
              tokenCount,
              type: 'update',
              ...(storeId ? { storeId } : {}),
              ...(domainId ? { domainId } : {}),
            },
          };
          const result = await setMemory({
            userId,
            key,
            value: normalizedValue,
            tokenCount,
            storeId,
            domainId,
            defaultDomainId: implicitDomainId,
            runId: turnMessageId,
          });
          if (result.ok) {
            const artifactBody = artifact[Tools.memory];
            if (artifactBody != null && artifactBody.domainId == null && result.domainId != null) {
              artifactBody.domainId = result.domainId;
            }
            if (tokenLimit) {
              currentTotalTokens = newTotalTokens;
              writtenTokensByKey.set(key, tokenCount);
            }
            if (conversationId && setConversationMemory) {
              await setConversationMemory({
                userId,
                storeId,
                domainId: domainId ?? implicitDomainId,
                created: result.created,
                ...(turnMessageId ? { turnMessageId } : {}),
                key,
                conversationId,
              }).catch((error) => logger.error('Failed to link conversation memory', error));
            }
            logger.debug(`Memory set for key "${key}" (${tokenCount} tokens) for user "${userId}"`);
            return [
              `Memory set for key "${key}" (${tokenCount} tokens)${domainSubstitution ? `. ${domainSubstitution}` : ''}`,
              artifact,
            ];
          }
          logger.warn(
            `Failed to set memory for key "${key}" for user "${userId}"${result.reason ? `: ${result.reason}` : ''}`,
          );
          return [
            result.reason
              ? `Failed to set memory for key "${key}": ${result.reason}`
              : `Failed to set memory for key "${key}"`,
            void 0,
          ];
        } catch (error) {
          logger.error('Memory Agent failed to set memory', error);
          return [`Error setting memory for key "${key}"`, void 0];
        }
      };
      const resultPromise = writeChain.then(run, run);
      writeChain = resultPromise.catch(() => void 0);
      return resultPromise;
    },
    {
      name: SET_MEMORY_TOOL_NAME,
      description: SET_MEMORY_DESCRIPTION,
      responseFormat: 'content_and_artifact',
      schema: z.object({
        key: z
          .string()
          .describe(
            validKeys && validKeys.length > 0
              ? `The key of the memory value. Must be one of: ${validKeys.join(', ')}`
              : 'The key identifier for this memory. MUST be lowercase letters, numbers, and underscores only (e.g. "user_name", "year_2026")',
          ),
        value: z
          .string()
          .describe(
            'Value MUST be a complete sentence that fully describes the relevant information, followed by a final `tags:` line naming 3-6 short cue anchors separated by `|` (e.g. `tags:coffee|dessert`); several `tags:` lines are merged into one tag set.',
          ),
        ...(domains
          ? {
              domain: z
                .string()
                .optional()
                .describe(
                  'The NAME of the domain to file this memory into, taken from the active domains list \u2014 the part before the colon (e.g. "Default"). Never pass a domain kind.',
                ),
            }
          : {}),
      }),
    },
  );
};
const createDeleteMemoryTool = ({
  userId,
  storeId,
  deleteMemory,
  getUserMemories,
  validKeys,
  deletedKeys,
}: CreateDeleteMemoryToolParams) => {
  return tool(
    async ({ key }) => {
      try {
        if (validKeys && validKeys.length > 0 && !validKeys.includes(key)) {
          logger.warn(
            `Memory Agent failed to delete memory: Invalid key "${key}". Must be one of: ${validKeys.join(
              ', ',
            )}`,
          );
          return [`Invalid key "${key}". Must be one of: ${validKeys.join(', ')}`, void 0];
        }
        if (!MEMORY_KEY_PATTERN.test(key)) {
          return [
            'Key must only contain lowercase letters, numbers, and underscores (e.g. "user_name"). Please retry with a valid key.',
            void 0,
          ];
        }
        if (getUserMemories) {
          const entries = await getUserMemories({ userId, storeId });
          const refusal = lockedMemoryRefusal(
            key,
            entries.find((entry) => entry.key === key),
          );
          if (refusal) {
            logger.warn(`Memory Agent refused to delete memory: ${refusal}`);
            return [refusal, void 0];
          }
        }
        const artifact = {
          [Tools.memory]: {
            key,
            type: 'delete',
            ...(storeId ? { storeId } : {}),
          },
        };
        const result = await deleteMemory({ userId, key, storeId });
        if (result.ok) {
          deletedKeys?.add(key);
          logger.debug(`Memory deleted for key "${key}" for user "${userId}"`);
          return [`Memory deleted for key "${key}"`, artifact];
        }
        logger.warn(
          `Failed to delete memory for key "${key}" for user "${userId}"${result.reason ? `: ${result.reason}` : ''}`,
        );
        return [
          result.reason
            ? `Failed to delete memory for key "${key}": ${result.reason}`
            : `Failed to delete memory for key "${key}"`,
          void 0,
        ];
      } catch (error) {
        logger.error('Memory Agent failed to delete memory', error);
        return [`Error deleting memory for key "${key}"`, void 0];
      }
    },
    {
      name: DELETE_MEMORY_TOOL_NAME,
      description: DELETE_MEMORY_DESCRIPTION,
      responseFormat: 'content_and_artifact',
      schema: z.object({
        key: z
          .string()
          .describe(
            validKeys && validKeys.length > 0
              ? `The key of the memory to delete. Must be one of: ${validKeys.join(', ')}`
              : 'The key identifier of the memory to delete',
          ),
      }),
    },
  );
};
const createAppendMemoryTool = ({
  userId,
  storeId,
  memoryTool,
  getUserMemories,
  validKeys,
}: CreateAppendMemoryToolParams) => {
  return tool(
    async ({ key, value }) => {
      try {
        if (validKeys && validKeys.length > 0 && !validKeys.includes(key)) {
          logger.warn(
            `Memory Agent failed to append memory: Invalid key "${key}". Must be one of: ${validKeys.join(
              ', ',
            )}`,
          );
          return [`Invalid key "${key}". Must be one of: ${validKeys.join(', ')}`, void 0];
        }
        if (key.length > MEMORY_KEY_CHAR_LIMIT) {
          return [`Key exceeds maximum length of ${MEMORY_KEY_CHAR_LIMIT} characters.`, void 0];
        }
        if (!MEMORY_KEY_PATTERN.test(key)) {
          return [
            'Key must only contain lowercase letters, numbers, and underscores (e.g. "user_name"). Please retry with a valid key.',
            void 0,
          ];
        }
        const entries = await getUserMemories({ userId, storeId });
        const existing = entries.find((entry) => entry.key === key);
        const refusal = lockedMemoryRefusal(key, existing);
        if (refusal) {
          return [refusal, void 0];
        }
        const existingValue = existing?.value?.trimEnd();
        if (!existingValue) {
          return [
            `No existing memory found for key "${key}". Use the \`set_memory\` tool to create it first.`,
            void 0,
          ];
        }
        const addition = value.trim();
        if (addition.length === 0) {
          return [
            'No content provided to append. Include the text to add in the "value" parameter.',
            void 0,
          ];
        }
        return await memoryTool.func({ key, value: appendedMemoryValue(existingValue, addition) });
      } catch (error) {
        logger.error('Memory Agent failed to append memory', error);
        return [`Error appending memory for key "${key}"`, void 0];
      }
    },
    {
      name: APPEND_MEMORY_TOOL_NAME,
      description: APPEND_MEMORY_DESCRIPTION,
      responseFormat: 'content_and_artifact',
      schema: z.object({
        key: z
          .string()
          .describe(
            validKeys && validKeys.length > 0
              ? `The key of the existing memory value. Must be one of: ${validKeys.join(', ')}`
              : 'The key of an EXISTING memory to append to. MUST be lowercase letters, numbers, and underscores only (e.g. "user_name", "year_2026")',
          ),
        value: z
          .string()
          .describe(
            'The new text to append as new line(s) at the end of the existing memory value. Do NOT repeat the existing memory content; only supply the additional text.',
          ),
      }),
    },
  );
};
function getMemoryStoreId(agent: MemoryAgentLike | null | undefined): string | undefined {
  const storeId = agent?.memory_store;
  return typeof storeId === 'string' && storeId !== '' ? storeId : void 0;
}
function agentHasMemoryCapability(agent: MemoryAgentLike | null | undefined): boolean {
  if (!agent) {
    return false;
  }
  if (typeof agent.memoryCapabilityEnabled === 'boolean') {
    return agent.memoryCapabilityEnabled;
  }
  return (agent.tools ?? []).some(
    (entry) => (typeof entry === 'string' ? entry : entry?.name) === Tools.memory,
  );
}
async function buildInlineMemoryContext({
  agent,
  req,
  userId,
  memoryAvailable,
  getFormattedMemories,
}: BuildInlineMemoryContextParams): Promise<string> {
  if (!memoryAvailable || !agentHasMemoryCapability(agent)) {
    return '';
  }
  const storeId = getMemoryStoreId(agent);
  if (!storeId) {
    return '';
  }
  try {
    const memories = await getRequestMemories({
      req,
      userId,
      storeId,
      getFormattedMemories,
    });
    return memories.withKeys
      ? `${memoryInstructions}

# Existing memory:
${memories.withKeys}`
      : '';
  } catch (error) {
    logger.error('[memory] Error loading agent memory context', error);
    return '';
  }
}
function isAgentMemoryEnabled(agent?: MemoryAgentLike | null): boolean {
  if (agent?.use_memory === false) {
    return false;
  }
  return typeof agent?.memory_store === 'string' && agent.memory_store !== '';
}
function formatMemoryEntries(
  entries: MemoryEntryRow[],
  domainNames?: Map<string, string>,
  markLocked = false,
  timezone?: string,
): string {
  return entries
    .map((entry, index) => {
      const domain = entry.domainId != null ? domainNames?.get(entry.domainId) : void 0;
      return (
        `${index + 1}. ["key": "${entry.key}"].` +
        memoryTimeField(entry, timezone) +
        (domain != null ? ` ["domain": "${domain}"]` : '') +
        (markLocked && entry.locked === true ? ' ["locked": true]' : '') +
        ` ["value": "${memoryContentOf(entry)}"]` +
        memoryTagField(entry)
      );
    })
    .join('\n\n');
}
const requestMemoriesCache = /* @__PURE__ */ new WeakMap<
  MemoryRequest,
  Map<string, Promise<FormattedMemoriesResult>>
>();
function getRequestMemories({
  req,
  userId,
  storeId,
  domainIds,
  excludeConversationId,
  getFormattedMemories,
}: RequestMemoriesParams): Promise<FormattedMemoriesResult> {
  let partitions = requestMemoriesCache.get(req);
  if (!partitions) {
    partitions = /* @__PURE__ */ new Map();
    requestMemoriesCache.set(req, partitions);
  }
  const domainKey = (domainIds ?? []).join(',');
  const partitionKey = `${storeId ?? ''}::${domainKey}`;
  let cached = partitions.get(partitionKey);
  if (!cached) {
    const timezone = req?.body?.timezone;
    cached = getFormattedMemories({
      userId,
      storeId,
      ...(domainIds ? { domainIds } : {}),
      ...(excludeConversationId != null ? { excludeConversationId } : {}),
      ...(timezone ? { timezone } : {}),
    });
    partitions.set(partitionKey, cached);
  }
  return cached;
}
class BasicToolEndHandler {
  callback?: MemoryToolEndCallback;
  constructor(callback?: MemoryToolEndCallback) {
    this.callback = callback;
  }
  handle(
    event: string,
    data: MemoryToolEndData | null | undefined,
    metadata?: MemoryToolEndMetadata,
  ): void {
    if (!metadata) {
      console.warn(`Graph or metadata not found in ${event} event`);
      return;
    }
    const toolEndData = data;
    if (!toolEndData?.output) {
      console.warn('No output found in tool_end event');
      return;
    }
    this.callback?.(toolEndData, metadata);
  }
}
async function processMemory({
  res,
  userId,
  storeId,
  setMemory,
  deleteMemory,
  setConversationMemory,
  evictMemoriesToFitCapacity,
  getUserMemories,
  getStoreTagVocabulary,
  domains,
  domainTools,
  messages,
  memory,
  messageId,
  conversationId,
  validKeys,
  instructions,
  llmConfig,
  tokenLimit,
  totalTokens = 0,
  streamId = null,
  jobCreatedAt,
  user,
  appConfig,
  tenantId,
  signal,
  deletedKeys,
}: ProcessMemoryParams): Promise<(MemoryArtifactAttachment | null)[] | undefined> {
  try {
    const memoryTool = createMemoryTool({
      userId,
      storeId,
      tokenLimit,
      setMemory,
      ...(getUserMemories ? { getUserMemories } : {}),
      setConversationMemory,
      validKeys,
      totalTokens,
      conversationId,
      turnMessageId: messageId,
      domains,
      ...(evictMemoriesToFitCapacity && tokenLimit
        ? {
            evictForCapacity: (memoryTokenCount) =>
              evictMemoriesToFitCapacity({
                userId,
                tokenLimit,
                tokenCount: memoryTokenCount,
              }),
          }
        : {}),
    });
    const deleteMemoryTool = createDeleteMemoryTool({
      userId,
      storeId,
      validKeys,
      deleteMemory,
      deletedKeys,
      ...(getUserMemories ? { getUserMemories } : {}),
    });
    const memoryTools: unknown[] = [memoryTool, deleteMemoryTool];
    if (domainTools != null && domainTools.length > 0) {
      memoryTools.push(...domainTools);
    }
    if (getUserMemories) {
      memoryTools.push(
        createAppendMemoryTool({
          userId,
          storeId,
          memoryTool,
          getUserMemories,
          validKeys,
        }),
      );
    }
    const currentMemoryTokens = totalTokens;
    const domainToolNames =
      domainTools != null && domainTools.length > 0
        ? domainTools.map((domainTool) => domainTool.name).join('/')
        : '';
    const domainsBlock =
      domains && domains.active.length > 0
        ? `${buildActiveDomainsBlock(domains)}
Assign every new memory to one of these domains with the \`domain\` parameter, passing the NAME that comes before the colon \u2014 the kind after it is not a domain name.${domainToolNames ? ` If you want a memory to be created in another domain, call ${domainToolNames} to search for or create that domain.` : ''}`
        : '';
    const kindLegend = domains && domains.active.length > 0 ? buildDomainKindLegend() : '';
    let memoryStatus = `# Existing memory:
${memory ?? 'No existing memories'}`;
    if (tokenLimit) {
      const remainingTokens = tokenLimit - currentMemoryTokens;
      memoryStatus = `# Memory Status:
Current memory usage: ${currentMemoryTokens} tokens
Token limit: ${tokenLimit} tokens
Remaining capacity: ${remainingTokens} tokens

# Existing memory:
${memory ?? 'No existing memories'}`;
    }
    const vocabulary = getStoreTagVocabulary
      ? await getStoreTagVocabulary({ storeId }).catch(() => [])
      : [];
    memoryStatus = `${memoryStatus}

${buildMemoryTagInstructions(vocabulary)}`;
    const defaultLLMConfig = {
      provider: Providers.OPENAI,
      model: 'gpt-4.1-mini',
      temperature: 0.4,
      streaming: false,
      disableStreaming: true,
    };
    const finalLLMConfig: MemoryLLMConfig = {
      ...defaultLLMConfig,
      ...normalizeMemoryLLMConfig(llmConfig),
      maxRetries: 0,
      /**
       * Ensure streaming is always disabled for memory processing
       */
      streaming: false,
      disableStreaming: true,
    };
    if ('model' in finalLLMConfig && /\bgpt-[5-9](?:\.\d+)?\b/i.test(finalLLMConfig.model ?? '')) {
      delete finalLLMConfig.temperature;
      if ('maxTokens' in finalLLMConfig && finalLLMConfig.maxTokens != null) {
        const modelKwargs: Record<string, unknown> = finalLLMConfig.modelKwargs ?? {};
        const paramName =
          finalLLMConfig.useResponsesApi === true ? 'max_output_tokens' : 'max_completion_tokens';
        modelKwargs[paramName] = finalLLMConfig.maxTokens;
        delete finalLLMConfig.maxTokens;
        finalLLMConfig.modelKwargs = modelKwargs;
      }
    }
    const bedrockConfig = finalLLMConfig;
    if (
      llmConfig?.provider === Providers.BEDROCK &&
      bedrockConfig.additionalModelRequestFields?.thinking != null &&
      bedrockConfig.temperature != null
    ) {
      finalLLMConfig.temperature = 1;
    }
    const anthropicConfig = finalLLMConfig;
    if (
      llmConfig?.provider === Providers.ANTHROPIC &&
      anthropicConfig.thinking?.type === 'enabled' &&
      anthropicConfig.temperature != null
    ) {
      delete finalLLMConfig.temperature;
    }
    resolveConfigHeaders({
      llmConfig: finalLLMConfig,
      user: user ? createSafeUser(user) : void 0,
      body: { conversationId, messageId },
    });
    const artifactPromises: Promise<MemoryArtifactAttachment | null>[] = [];
    const memoryCallback = createMemoryCallback({
      res,
      artifactPromises,
      streamId,
      jobCreatedAt,
      messageId,
      conversationId,
    });
    const customHandlers = {
      [GraphEvents.TOOL_END]: new BasicToolEndHandler(memoryCallback),
    };
    const isBedrock = llmConfig?.provider === Providers.BEDROCK;
    let graphInstructions: string | undefined = [
      instructions,
      /** The conversation it reads can carry `<instructions>` blocks — the
       *  per-turn runtime tail replayed from history, and the turn a timer or a
       *  background subagent persisted — so the extractor is told what the
       *  conversation model is told: that content is system-authored, never the
       *  user's own words. Without it a replayed recall block reads as something
       *  the user said, and gets extracted back as a new memory. */
      ADDITIONAL_INSTRUCTIONS_NOTE,
      kindLegend,
      domainsBlock,
      memoryStatus,
    ]
      .filter(Boolean)
      .join('\n\n');
    let graphAdditionalInstructions = void 0;
    let processedMessages: MemoryChatRow[] = messages;
    if (isBedrock) {
      const combinedInstructions = graphInstructions ?? '';
      if (messages.length > 0) {
        const firstMessage = messages[0];
        const originalContent =
          typeof firstMessage.content === 'string' ? firstMessage.content : '';
        if (typeof firstMessage.content !== 'string') {
          logger.warn(
            'Bedrock memory processing: First message has non-string content, using empty string',
          );
        }
        const bedrockUserMessage = new HumanMessage(
          `${combinedInstructions}

${originalContent}`,
        );
        processedMessages = [bedrockUserMessage, ...messages.slice(1)];
      } else {
        processedMessages = [new HumanMessage(combinedInstructions)];
      }
      graphInstructions = void 0;
      graphAdditionalInstructions = void 0;
    }
    const runId = `${messageId}:memory`;
    const run = await Run.create({
      runId,
      graphConfig: {
        type: 'standard',
        signal,
        llmConfig: finalLLMConfig,
        tools: memoryTools,
        instructions: graphInstructions,
        additional_instructions: graphAdditionalInstructions,
        toolEnd: true,
      },
      customHandlers,
      returnContent: true,
      /** Mirror the main agent run's Langfuse wiring so memory extraction is
       *  traced too. The deterministic id is derived from the same message id
       *  the main run uses, so extraction lands in the conversation's trace. */
      langfuse: buildLangfuseConfig({
        appConfig,
        runId: messageId,
        tenantId,
      }),
    });
    const config: AgentsStreamConfig = {
      runName: 'MemoryRun',
      configurable: {
        user_id: userId,
        thread_id: conversationId,
        provider: llmConfig?.provider,
      },
      /** Mirror the main agent run: the per-call `signal` (callerSignal) is
       *  what the SDK observes to cancel an in-flight LLM call — `signal` in
       *  `graphConfig` alone is not sufficient for mid-generation abort. */
      signal,
      streamMode: 'values',
      /** One superstep per node: agent, tools, agent, … — the extractor gets
       *  `MEMORY_EXTRACTION_TOOL_ROUNDS` tool rounds plus its closing answer. */
      recursionLimit: MEMORY_EXTRACTION_RECURSION_LIMIT,
      version: 'v2',
    };
    const inputs = {
      messages: processedMessages,
    };
    const content = await run.processStream(inputs, config);
    if (content) {
      logger.debug('[MemoryAgent] Processed successfully', {
        userId,
        conversationId,
        messageId,
        provider: llmConfig?.provider,
      });
    } else {
      logger.debug('[MemoryAgent] Returned no content', { userId, conversationId, messageId });
    }
    return await Promise.all(artifactPromises);
  } catch (error) {
    logger.error(
      `[MemoryAgent] Failed to process memory | userId: ${userId} | conversationId: ${conversationId} | messageId: ${messageId}`,
      { error },
    );
  }
}
async function createMemoryProcessor({
  res,
  userId,
  storeId,
  messageId,
  memoryMethods,
  conversationId,
  config = {},
  streamId = null,
  jobCreatedAt,
  user,
  appConfig,
  tenantId,
  now,
  timezone,
  domains,
  domainTools,
  resolveDomains,
}: CreateMemoryProcessorParams): Promise<
  [
    string,
    (
      messages: MemoryChatRow[],
      signal?: AbortSignal,
    ) => Promise<(MemoryArtifactAttachment | null)[] | undefined>,
    () => string[],
  ]
> {
  const { validKeys, instructions, llmConfig, tokenLimit } = config;
  const deletedKeys = new Set<string>();
  const finalInstructions = replaceSpecialVars({
    text: `${instructions || getDefaultInstructions(validKeys, tokenLimit)}

${MEMORY_KEY_FORMAT_HINT}`,
    user: user && user.name ? { name: user.name } : null,
    now,
    timezone,
  });
  const [{ withKeys, withoutKeys }, { totalTokens }] = await Promise.all([
    memoryMethods.getFormattedMemories({
      userId,
      storeId,
      domainIds: domains?.domainIds,
      excludeConversationId: conversationId,
      ...(timezone ? { timezone } : {}),
    }),
    memoryMethods.getFormattedMemories({
      userId,
      storeId,
      domainIds: domains?.domainIds,
      ...(timezone ? { timezone } : {}),
    }),
  ]);
  const resolveExtractionView = async () => {
    const resolved = resolveDomains ? await resolveDomains().catch(() => null) : null;
    const view = resolved?.domains ?? domains;
    if (view != null && !view.enabled) {
      return { domains: view, domainTools: void 0, extractorMemory: '' };
    }
    const extractionEntries = await memoryMethods.getMemoryExtractionEntries?.({
      userId,
      storeId,
      domainIds: view?.domainIds,
      conversationId,
    });
    const extractorMemory = extractionEntries
      ? formatMemoryEntries(
          [...extractionEntries].sort(
            (a, b) => new Date(a.updated_at ?? 0).getTime() - new Date(b.updated_at ?? 0).getTime(),
          ),
          /** Each existing memory is labelled with its domain, so an update can
           *  be filed into the same world instead of being re-guessed. Locked
           *  entries are marked so the extractor can leave them alone, and each
           *  entry leads with its update time so a stale fact is recognizable
           *  as one. */
          view ? new Map(view.active.map((domain) => [domain.id, domain.name] as const)) : void 0,
          true,
          timezone,
        )
      : withKeys;
    return { domains: view, domainTools: resolved?.domainTools ?? domainTools, extractorMemory };
  };
  return [
    withoutKeys,
    async function (messages: MemoryChatRow[], signal?: AbortSignal) {
      try {
        const extractionView = await resolveExtractionView();
        if (extractionView.domains != null && !extractionView.domains.enabled) {
          return void 0;
        }
        return await processMemory({
          res,
          userId,
          storeId,
          messages,
          signal,
          deletedKeys,
          validKeys,
          llmConfig,
          messageId,
          tokenLimit,
          streamId,
          jobCreatedAt,
          conversationId,
          memory: extractionView.extractorMemory,
          totalTokens: totalTokens || 0,
          instructions: finalInstructions,
          domains: extractionView.domains,
          domainTools: extractionView.domainTools,
          setMemory: memoryMethods.setMemory,
          deleteMemory: memoryMethods.deleteMemory,
          setConversationMemory: memoryMethods.setConversationMemory,
          evictMemoriesToFitCapacity: memoryMethods.evictMemoriesToFitCapacity,
          getUserMemories: memoryMethods.getUserMemories,
          getStoreTagVocabulary: memoryMethods.getStoreTagVocabulary,
          user,
          appConfig,
          tenantId,
        });
      } catch (error) {
        logger.error('Memory Agent failed to process memory', error);
      }
    },
    () => [...deletedKeys],
  ];
}
async function handleMemoryArtifact({
  res,
  data,
  metadata,
  streamId = null,
  jobCreatedAt,
  messageId,
  conversationId,
}: HandleMemoryArtifactParams): Promise<MemoryArtifactAttachment | null> {
  const output = data?.output;
  if (!output) {
    return null;
  }
  if (!output.artifact) {
    return null;
  }
  const memoryArtifact = output.artifact[Tools.memory];
  if (!memoryArtifact) {
    return null;
  }
  const attachment = {
    type: Tools.memory,
    toolCallId: output.tool_call_id,
    messageId: messageId ?? metadata?.run_id ?? '',
    conversationId: conversationId ?? metadata?.thread_id ?? '',
    [Tools.memory]: memoryArtifact,
  };
  if (!res.headersSent) {
    return attachment;
  }
  if (streamId) {
    GenerationJobManager.emitChunk(
      streamId,
      { event: 'attachment', data: attachment },
      { expectedCreatedAt: jobCreatedAt },
    );
  } else {
    res.write(`event: attachment
data: ${JSON.stringify(attachment)}

`);
  }
  return attachment;
}
function createMemoryCallback({
  res,
  artifactPromises,
  streamId = null,
  jobCreatedAt,
  messageId,
  conversationId,
}: CreateMemoryCallbackParams): MemoryToolEndCallback {
  return async (data, metadata) => {
    const output = data?.output;
    const memoryArtifact = output?.artifact?.[Tools.memory];
    if (memoryArtifact == null) {
      return;
    }
    artifactPromises.push(
      handleMemoryArtifact({
        res,
        data,
        metadata,
        streamId,
        jobCreatedAt,
        messageId,
        conversationId,
      }).catch((error) => {
        logger.error('Error processing memory artifact content:', error);
        return null;
      }),
    );
  };
}
const runningExtractions = /* @__PURE__ */ new Map<string, RunningMemoryExtraction>();
const extractionQueues = /* @__PURE__ */ new Map<string, MemoryExtractionJob[]>();
const pausedExtractionKeys = /* @__PURE__ */ new Set<string>();
function getMemoryExtractionKey({
  userId,
  storeId,
  conversationId,
}: MemoryExtractionKeyParts): string {
  return `${String(userId)}:${storeId ?? ''}:${conversationId}`;
}
function startMemoryExtraction(key: string, job: MemoryExtractionJob): void {
  const controller = new AbortController();
  const running = { controller, job };
  runningExtractions.set(key, running);
  Promise.resolve()
    .then(() => job.run(controller.signal))
    .catch((error) => {
      if (controller.signal.aborted) {
        logger.debug('[MemoryExtraction] interrupted', { key, jobId: job.id });
      } else {
        logger.error('[MemoryExtraction] failed', { key, jobId: job.id, error });
      }
    })
    .finally(() => {
      if (runningExtractions.get(key) === running) {
        runningExtractions.delete(key);
        dequeueNextExtraction(key);
      }
    });
}
function dequeueNextExtraction(key: string): void {
  if (pausedExtractionKeys.has(key) || runningExtractions.has(key)) {
    return;
  }
  const next = extractionQueues.get(key)?.shift();
  if (next) {
    startMemoryExtraction(key, next);
  }
}
function enqueueExtraction(key: string, job: MemoryExtractionJob): void {
  const queue = extractionQueues.get(key) ?? [];
  queue.push(job);
  extractionQueues.set(key, queue);
}
function scheduleMemoryExtraction(key: string, job: MemoryExtractionJob): void {
  if (pausedExtractionKeys.delete(key)) {
    dequeueNextExtraction(key);
  }
  const running = runningExtractions.get(key);
  if (running) {
    enqueueExtraction(key, job);
    return;
  }
  startMemoryExtraction(key, job);
}
function interruptMemoryExtractions(key: string): void {
  pausedExtractionKeys.add(key);
  const running = runningExtractions.get(key);
  if (running) {
    running.controller.abort();
    runningExtractions.delete(key);
    enqueueExtraction(key, running.job);
  }
}
function resumeMemoryExtractions(key: string): void {
  pausedExtractionKeys.delete(key);
  dequeueNextExtraction(key);
}
function clearMemoryExtractions(userId: string, conversationIds?: string | string[]): void {
  const userPrefix = `${String(userId)}:`;
  const ids = conversationIds
    ? new Set(
        (Array.isArray(conversationIds) ? conversationIds : [conversationIds]).map((id) =>
          String(id),
        ),
      )
    : null;
  const matches = (key: string) => {
    if (!key.startsWith(userPrefix)) {
      return false;
    }
    if (!ids) {
      return true;
    }
    return ids.has(key.slice(key.lastIndexOf(':') + 1));
  };
  for (const key of runningExtractions.keys()) {
    if (matches(key)) {
      runningExtractions.get(key)?.controller.abort();
      runningExtractions.delete(key);
    }
  }
  for (const key of extractionQueues.keys()) {
    if (matches(key)) {
      extractionQueues.delete(key);
    }
  }
  for (const key of pausedExtractionKeys) {
    if (matches(key)) {
      pausedExtractionKeys.delete(key);
    }
  }
}
function resetMemoryExtractionState(): void {
  runningExtractions.clear();
  extractionQueues.clear();
  pausedExtractionKeys.clear();
}
export type {
  MemoryAttachment,
  MemoryArtifactAttachment,
  MemoryChatRow,
  MemoryExtractionMethods,
  MemoryExtractionResponse,
  MemoryLLMConfig,
  MemoryUser,
};
export {
  APPEND_MEMORY_TOOL_NAME,
  BasicToolEndHandler,
  DELETE_MEMORY_TOOL_NAME,
  MEMORY_EXTRACTION_RECURSION_LIMIT,
  MEMORY_EXTRACTION_TOOL_ROUNDS,
  SET_MEMORY_TOOL_NAME,
  agentHasMemoryCapability,
  buildInlineMemoryContext,
  buildMemoryTagInstructions,
  clearMemoryExtractions,
  createAppendMemoryTool,
  createDeleteMemoryTool,
  createMemoryCallback,
  createMemoryProcessor,
  createMemoryTool,
  formatMemoryEntries,
  getMemoryExtractionKey,
  getMemoryStoreId,
  getRequestMemories,
  interruptMemoryExtractions,
  isAgentMemoryEnabled,
  memoryInstructions,
  processMemory,
  resetMemoryExtractionState,
  resolveExtractionToolRounds,
  resumeMemoryExtractions,
  scheduleMemoryExtraction,
};
