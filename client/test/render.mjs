// Render smoke test for the ported panel: the markup must carry the original
// class names, and the panel shell must render without throwing.
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as lucide from 'lucide-react';
import { configure, MemoryCard, MemoryPanel as Panel } from '../.test/bundle.mjs';

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
ui.VirtualList = ({ items, renderItem }) => React.createElement('div', null, items.map(renderItem));
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
      return { stores: [{ id: 's1', name: 'Store', isDefault: true, isOwner: true }] };
    }
    if (method === 'memories.preferences') {
      return { memories: true };
    }
    if (method === 'memories.list') {
      return { memories: [], totalTokens: 0, canWrite: true };
    }
    if (method === 'memories.domains') {
      return { domains: [] };
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

const memory = {
  key: 'alpha',
  value: 'first value',
  content: 'first value',
  tags: ['tag1'],
  stable: true,
  locked: true,
  tokenCount: 3,
  updated_at: '2026-01-02T00:00:00Z',
  domainId: 'd1',
};

const card = renderToStaticMarkup(
  React.createElement(MemoryCard, {
    memory,
    hasUpdateAccess: true,
    storeId: 's1',
    domain: { id: 'd1', name: 'Default', kind: 'real' },
  }),
);
for (const marker of [
  'rounded-lg px-3 py-2.5',
  'border-border-heavy',
  'bg-surface-secondary/50',
  'com_ui_memory_stable',
  'com_ui_memory_locked',
  'tag1',
  'alpha',
]) {
  assert.ok(card.includes(marker), `card markup missing ${marker}`);
}

const panel = renderToStaticMarkup(React.createElement(Panel));
assert.ok(panel.length > 0, 'panel rendered empty');
console.log('memory plugin render test: ok');
