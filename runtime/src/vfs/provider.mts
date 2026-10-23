import { createRequire } from 'node:module';
import { vfsDelete, vfsDomains, vfsImage, vfsList, vfsSet } from '../backend/vfs.mjs';
import { createMemoryProvider } from './provider-impl.mjs';
import {
  EXTRACTION_PROMPT_FILE,
  getExtractionPrompt,
  setExtractionPrompt,
} from '../backend/extraction-prompt.mjs';

const require = createRequire(import.meta.url);
const { vfsGlobToRegex } = require('@amor-harness/api');

const baseProvider = createMemoryProvider({
  listMemories: async (userId, storeId) => (await vfsList({ userId, storeId })).memories,
  listDomains: async (userId, storeId) => (await vfsDomains({ userId, storeId })).domains,
  setMemory: (params) =>
    vfsSet({
      userId: params.userId,
      key: params.key,
      value: params.value,
      allowLocked: params.allowLocked,
      storeId: params.storeId,
      domainId: params.domainId,
      conversationId: params.conversationId,
    }),
  deleteMemory: (params) =>
    vfsDelete({
      userId: params.userId,
      key: params.key,
      allowLocked: params.allowLocked,
      storeId: params.storeId,
    }),
  getMemoryImage: async (params) => {
    const row = await vfsImage({
      userId: params.userId,
      storeId: params.storeId,
      id: params.id,
      sha256: params.sha256,
    });
    if (row?.data == null) {
      return null;
    }
    return {
      data: row.data,
      ...(row.bytes != null ? { bytes: row.bytes } : {}),
      ...(row.mime != null ? { mime: row.mime } : {}),
      ...(row.updatedAt != null ? { updatedAt: row.updatedAt } : {}),
    };
  },
});

type VfsContext = Parameters<typeof baseProvider.list>[1];
type VfsSearchParams = Parameters<typeof baseProvider.search>[0];

const userIdOf = (ctx: VfsContext): string | undefined => ctx?.req?.user?.id;

function extractionEntry(content: string | null | undefined) {
  return {
    name: EXTRACTION_PROMPT_FILE,
    type: 'file',
    mimeType: 'text/markdown',
    size: Buffer.byteLength(content ?? '', 'utf8'),
  };
}

/** The `/memory` VFS provider now runs inside the memory plugin. The app keeps
 *  only a proxy that forwards VFS operations over the kernel RPC. */
export const memoryProvider = {
  ...baseProvider,
  async list(relPath: string, ctx: VfsContext) {
    const listing = await baseProvider.list(relPath, ctx);
    if (listing == null || relPath !== '') {
      return listing;
    }
    if (listing.entries.some((entry) => entry.name === EXTRACTION_PROMPT_FILE)) {
      return listing;
    }
    const content = await getExtractionPrompt({ userId: userIdOf(ctx) });
    return { ...listing, entries: [...listing.entries, extractionEntry(content)] };
  },
  async read(relPath: string, ctx: VfsContext) {
    if (relPath === EXTRACTION_PROMPT_FILE) {
      const content = await getExtractionPrompt({ userId: userIdOf(ctx) });
      return {
        status: 'text',
        content,
        bytes: Buffer.byteLength(content, 'utf8'),
        mimeType: 'text/markdown',
      };
    }
    return baseProvider.read(relPath, ctx);
  },
  async write(relPath: string, content: string, ctx: VfsContext) {
    if (relPath === EXTRACTION_PROMPT_FILE) {
      const value = await setExtractionPrompt({ userId: userIdOf(ctx), instructions: content });
      return { bytes: Buffer.byteLength(value ?? '', 'utf8') };
    }
    return baseProvider.write(relPath, content, ctx);
  },
  async delete(relPath: string, ctx: VfsContext) {
    if (relPath === EXTRACTION_PROMPT_FILE) {
      await setExtractionPrompt({ userId: userIdOf(ctx), instructions: '' });
      return { ok: true };
    }
    return baseProvider.delete(relPath, ctx);
  },
  async search(params: VfsSearchParams, ctx: VfsContext) {
    const result = await baseProvider.search(params, ctx);
    const content = await getExtractionPrompt({ userId: userIdOf(ctx) });
    if (content === '') {
      return result;
    }
    const rx = new RegExp(params.pattern);
    const lines = content
      .split('\n')
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => rx.test(line))
      .map(({ line, index }) => `${EXTRACTION_PROMPT_FILE}:${index + 1}:${line}`);
    return {
      ...result,
      results: [...result.results, ...lines].slice(0, params.maxResults),
    };
  },
  async glob(params: VfsSearchParams, ctx: VfsContext) {
    const result = await baseProvider.glob(params, ctx);
    if (!vfsGlobToRegex(params.pattern).test(EXTRACTION_PROMPT_FILE)) {
      return result;
    }
    return { ...result, results: [...result.results, EXTRACTION_PROMPT_FILE] };
  },
};

export interface ProviderOperation {
  op: string;
  relPath?: string;
  content?: string;
  params?: VfsSearchParams & { destRelPath?: string };
  ctx?: VfsContext;
}

export async function handleProviderOperation({
  op,
  relPath = '',
  content = '',
  params,
  ctx,
}: ProviderOperation): Promise<unknown> {
  const context: VfsContext = ctx ?? {};
  const searchParams: VfsSearchParams = params ?? { pattern: '', maxResults: 0 };
  switch (op) {
    case 'list':
      return memoryProvider.list(relPath, context);
    case 'read':
      return memoryProvider.read(relPath, context);
    case 'write':
      return memoryProvider.write(relPath, content, context);
    case 'search':
      return memoryProvider.search(searchParams, context);
    case 'glob':
      return memoryProvider.glob(searchParams, context);
    case 'move':
      return memoryProvider.move(relPath, params?.destRelPath ?? '', context);
    case 'delete':
      return memoryProvider.delete(relPath, context);
    default:
      throw new Error(`Unknown memory VFS op "${op}"`);
  }
}
