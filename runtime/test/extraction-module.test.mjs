import test from 'node:test';
import assert from 'node:assert/strict';
import * as extraction from '../dist/extraction/index.mjs';

test('the original extraction module compiles and exposes its full surface', () => {
  for (const name of [
    'createMemoryTool',
    'createDeleteMemoryTool',
    'createAppendMemoryTool',
    'createMemoryProcessor',
    'processMemory',
    'scheduleMemoryExtraction',
    'interruptMemoryExtractions',
    'resumeMemoryExtractions',
    'clearMemoryExtractions',
    'getMemoryExtractionKey',
    'formatMemoryEntries',
  ]) {
    assert.equal(typeof extraction[name], 'function', name);
  }
  assert.equal(extraction.SET_MEMORY_TOOL_NAME, 'set_memory');
  assert.equal(extraction.DELETE_MEMORY_TOOL_NAME, 'delete_memory');
  assert.equal(extraction.APPEND_MEMORY_TOOL_NAME, 'append_memory');
});
