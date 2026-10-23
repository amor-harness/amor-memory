// Test-only entry: bundle the ported components with the runtime they use, so
// the Node tests exercise the same code the browser receives.
export { configure } from '../src/runtime.js';
export { default as MemoryCard } from '../src/components/MemoryCard.tsx';
export { default as MemoryPanel } from '../src/components/MemoryPanel.tsx';
export { default as MemoryScopeDialog } from '../src/components/MemoryScopeDialog.tsx';
