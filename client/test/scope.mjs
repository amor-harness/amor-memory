// Render test for the chat header's memory-scope dialog: the ported component
// must show the conversation's domains, recalls and created memories.
import assert from 'node:assert/strict';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import * as lucide from 'lucide-react';
import { configure, MemoryScopeDialog } from '../.test/bundle.mjs';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;

const PassThrough = (props) => React.createElement('div', props, props.children);
const ui = new Proxy({}, { get: (target, key) => target[key] ?? PassThrough });
ui.OGDialog = ({ children }) => React.createElement(React.Fragment, null, children);
ui.OGDialogTemplate = ({ title, description, main }) =>
  React.createElement('section', null, [title, description, main]);
ui.Spinner = () => React.createElement('span', null, '…');
ui.Switch = (props) =>
  React.createElement('input', { ...props, type: 'checkbox', checked: props.checked });

const api = {
  React,
  icons: new Proxy({}, { get: () => lucide.Database }),
  call: async (method) => {
    if (method === 'memories.domains') {
      return {
        domains: [
          { id: 'd1', name: 'Default', kind: 'real', isDefault: true, memoryCount: 2 },
          { id: 'd2', name: 'Island', kind: 'fictional', isDefault: false, memoryCount: 1 },
        ],
        activeDomainIds: ['d1'],
      };
    }
    if (method === 'memories.conversation') {
      return {
        memories: [
          {
            key: 'alpha',
            value: 'first value',
            content: 'first value',
            domainId: 'd1',
            extracted: true,
            recallCount: 3,
            stable: true,
            updated_at: '2026-01-02T00:00:00Z',
          },
        ],
      };
    }
    return {};
  },
};
const translator = {
  t: (key) => key,
  useLocale: () => 'en',
  locale: 'en',
  subscribe: () => () => {},
  getLocale: () => 'en',
};
configure(api, ui, translator);

const rootNode = document.getElementById('root');
createRoot(rootNode).render(
  React.createElement(MemoryScopeDialog, {
    open: true,
    conversationId: 'c1',
    onOpenChange: () => {},
  }),
);
for (let i = 0; i < 8; i += 1) {
  await new Promise((resolve) => setTimeout(resolve, 10));
}
const text = rootNode.textContent;
for (const marker of ['com_ui_memory_scope_title', 'Default', 'Island', 'alpha', 'com_ui_memory_stable']) {
  assert.ok(text.includes(marker), `scope dialog missing ${marker}: ${text.slice(0, 200)}`);
}
console.log('memory plugin scope dialog test: ok');
