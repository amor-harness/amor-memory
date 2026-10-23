import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** The tokenizer surface the plugin consumes from `@amor-harness/api`. */
interface TokenizerLike {
  getTokenCount(value: string, encoding: string): number;
}

let tokenizer: TokenizerLike | null = null;
try {
  const api = require('@amor-harness/api') as { Tokenizer?: TokenizerLike };
  tokenizer = api.Tokenizer ?? null;
} catch (error) {
  console.error(
    '[memory-plugin] tokenizer unavailable, estimating tokens:',
    error instanceof Error ? error.message : error,
  );
}

export function countTokens(value: string): number {
  if (tokenizer?.getTokenCount) {
    return tokenizer.getTokenCount(value, 'o200k_base');
  }
  return Math.ceil(String(value ?? '').length / 4);
}
