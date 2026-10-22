import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let tokenizer = null;
try {
  tokenizer = require('@librechat/api').Tokenizer;
} catch (error) {
  console.error('[memory-plugin] tokenizer unavailable, estimating tokens:', error.message);
}

export function countTokens(value) {
  if (tokenizer?.getTokenCount) {
    return tokenizer.getTokenCount(value, 'o200k_base');
  }
  return Math.ceil(String(value ?? '').length / 4);
}
