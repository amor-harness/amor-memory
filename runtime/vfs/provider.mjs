import { createRequire } from 'node:module';
import { vfsDelete, vfsDomains, vfsImage, vfsList, vfsSet } from '../backend/vfs.mjs';
import { createMemoryProvider } from './provider-impl.mjs';
import {
  EXTRACTION_PROMPT_FILE,
  getExtractionPrompt,
  setExtractionPrompt,
} from '../backend/extraction-prompt.mjs';

const require = createRequire(import.meta.url);
const { vfsGlobToRegex } = require('@librechat/api');

const baseProvider = createMemoryProvider({
  listMemories: async (userId, storeId) => (await vfsList({ userId, storeId })).memories,
  listDomains: async (userId, storeId) => (await vfsDomains({ userId, storeId })).domains,
  setMemory: (params) => vfsSet(params),
  deleteMemory: (params) => vfsDelete(params),
  getMemoryImage: (params) => vfsImage(params),
});

const userIdOf = (ctx) => ctx?.req?.user?.id;

function extractionEntry(content) {
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
  async list(relPath, ctx) {
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
  async read(relPath, ctx) {
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
  async write(relPath, content, ctx) {
    if (relPath === EXTRACTION_PROMPT_FILE) {
      const value = await setExtractionPrompt({ userId: userIdOf(ctx), instructions: content });
      return { bytes: Buffer.byteLength(value ?? '', 'utf8') };
    }
    return baseProvider.write(relPath, content, ctx);
  },
  async delete(relPath, ctx) {
    if (relPath === EXTRACTION_PROMPT_FILE) {
      await setExtractionPrompt({ userId: userIdOf(ctx), instructions: '' });
      return { ok: true };
    }
    return baseProvider.delete(relPath, ctx);
  },
  async search(params, ctx) {
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
  async glob(params, ctx) {
    const result = await baseProvider.glob(params, ctx);
    if (!vfsGlobToRegex(params.pattern).test(EXTRACTION_PROMPT_FILE)) {
      return result;
    }
    return { ...result, results: [...result.results, EXTRACTION_PROMPT_FILE] };
  },
};

export async function handleProviderOperation({ op, relPath, content, params, ctx }) {
  switch (op) {
    case 'list':
      return memoryProvider.list(relPath, ctx);
    case 'read':
      return memoryProvider.read(relPath, ctx);
    case 'write':
      return memoryProvider.write(relPath, content, ctx);
    case 'search':
      return memoryProvider.search(params, ctx);
    case 'glob':
      return memoryProvider.glob(params, ctx);
    case 'move':
      return memoryProvider.move(relPath, params?.destRelPath, ctx);
    case 'delete':
      return memoryProvider.delete(relPath, ctx);
    default:
      throw new Error(`Unknown memory VFS op "${op}"`);
  }
}
