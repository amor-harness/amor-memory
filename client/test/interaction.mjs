// Interaction test: render the ported panel in jsdom and walk store list ->
// memory view, so effects and the RPC shims are exercised, not just markup.
import assert from 'node:assert/strict';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import * as lucide from 'lucide-react';
import { configure, MemoryPanel as Panel } from '../.test/bundle.mjs';

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
ui.PanelContent = ({ isLoading, skeleton, empty, children, className }) =>
  React.createElement('div', { className }, isLoading ? skeleton : (empty ?? children));
ui.PanelFooter = ({ children, className }) => React.createElement('div', { className }, children);
ui.Skeleton = (props) => React.createElement('div', props);
ui.Spinner = (props) => React.createElement('span', props, '…');
ui.TooltipAnchor = ({ render }) => render;
ui.OGDialog = ({ children }) => React.createElement(React.Fragment, null, children);
ui.OGDialogTrigger = ({ children }) => children;
ui.OGDialogTemplate = () => null;
ui.OGDialogContent = ({ children }) => React.createElement('div', null, children);
ui.VirtualList = ({ items, renderItem }) =>
  React.createElement('div', null, items.map(renderItem));
ui.Button = ({ children, ...props }) => React.createElement('button', props, children);
ui.Label = ({ children, ...props }) => React.createElement('span', props, children);
ui.Input = (props) => React.createElement('input', props);
ui.Textarea = (props) => React.createElement('textarea', props);
ui.Switch = (props) =>
  React.createElement('input', { ...props, type: 'checkbox', checked: props.checked });
ui.ControlCombobox = () => null;
ui.MultiSelect = () => null;
ui.Checkbox = (props) =>
  React.createElement('input', { ...props, type: 'checkbox', checked: props.checked });
ui.Radio = (props) => React.createElement('input', { ...props, type: 'radio' });
ui.FieldMessage = ({ children }) => React.createElement('span', null, children);

const api = {
  React,
  icons: new Proxy({}, { get: () => lucide.Database }),
  call: async (method) => {
    if (method === 'memories.stores') {
      return {
        stores: [
          {
            id: 's1',
            name: 'Store One',
            isDefault: true,
            isOwner: true,
            memoryCount: 1,
            totalTokens: 2,
            updated_at: new Date().toISOString(),
          },
        ],
      };
    }
    if (method === 'memories.preferences') {
      return { memories: true };
    }
    if (method === 'memories.list') {
      return {
        memories: [
          {
            key: 'alpha',
            value: 'first value',
            content: 'first value',
            stable: true,
            tokenCount: 2,
            updated_at: '2026-01-02T00:00:00Z',
            domainId: 'd1',
            domainName: 'Default',
            domainKind: 'real',
          },
        ],
        totalTokens: 2,
        canWrite: true,
      };
    }
    if (method === 'memories.domains') {
      return { domains: [{ id: 'd1', name: 'Default', kind: 'real', isDefault: true, memoryCount: 1 }] };
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
const root = createRoot(rootNode);
root.render(React.createElement(Panel));

async function settle() {
  for (let i = 0; i < 6; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

await settle();
assert.ok(rootNode.textContent.includes('Store One'), 'store row missing');

const storeButton = rootNode.querySelector('button[aria-label="Store One"]');
assert.ok(storeButton, 'store row button missing');
storeButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
await settle();

assert.ok(rootNode.textContent.includes('alpha'), 'memory card missing after opening store');
assert.ok(rootNode.textContent.includes('com_ui_memory_stable'), 'stable chip missing');
console.log('memory plugin interaction test: ok');
