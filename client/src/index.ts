import type { ReactElement, SVGProps } from 'react';
import { memoryCatalogs } from './locales.js';
import { configure, h } from './runtime.js';
import type { AppUiService, PluginApi } from './runtime.js';
import PortedPanel from './components/MemoryPanel.tsx';
import PortedScopeDialog from './components/MemoryScopeDialog.tsx';
import MemoryArtifacts from './components/MemoryArtifacts.tsx';
import { useRpc } from './data.js';
import type { MemoryDomainsResult, MemoryStoresResult } from './data.js';
import type { OptionWithIcon, TMemoryDomain, TMemoryStore } from './sdk.js';

export const inject: string[] = ['ui', 'app-ui', 'i18n'];

interface AgentMemorySettingsProps {
  useMemory?: boolean;
  memoryStore?: string;
  memoryDomains?: string[];
  stores?: TMemoryStore[];
  domains?: TMemoryDomain[];
  setUseMemory: (useMemory: boolean) => void;
  setMemoryStore: (storeId: string | undefined) => void;
  setMemoryDomains: (domainIds: string[] | undefined) => void;
}

interface AgentMemoryDomain extends TMemoryDomain {
  kindLabel: string;
  isNonReal: boolean;
}

interface HeaderMemoryButtonProps {
  conversationId?: string;
}

export default function activate(api: PluginApi): void {
  const { React } = api;
  const { useState } = React;
  const ui = api.consume('ui');
  const appUi = api.consume('app-ui');
  const i18n = api.consume('i18n');
  if (ui == null) {
    throw new Error('memory plugin requires the ui service');
  }
  const hostUi = ui;
  if (i18n == null) {
    throw new Error('memory plugin requires the i18n service');
  }
  const requiredAppUi: Array<
    keyof Pick<
      AppUiService,
      | 'GenericGrantAccessDialog'
      | 'useAuthContext'
      | 'useExpandCollapse'
      | 'useHasAccess'
      | 'useToastContext'
    >
  > = [
    'GenericGrantAccessDialog',
    'useAuthContext',
    'useExpandCollapse',
    'useHasAccess',
    'useToastContext',
  ];
  for (const name of requiredAppUi) {
    if (appUi?.[name] == null) {
      throw new Error(`memory plugin requires app-ui.${name}`);
    }
  }
  const translator = i18n.forScope(memoryCatalogs);
  configure(api, hostUi, translator, appUi);
  const t = translator.t;

  const STORE_TAG_CLASS =
    'shrink-0 rounded-full border border-border-heavy bg-surface-tertiary px-2 py-0.5 text-xs font-medium text-text-primary';
  const STORE_OWNER_TAG_CLASS =
    'shrink-0 rounded-full border border-status-success-border bg-status-success-subtle px-2 py-0.5 text-xs font-medium text-status-success';

  function storeTag(store: TMemoryStore): ReactElement | undefined {
    if (store.isDefault && store.isOwner) {
      return h('span', { key: 'default', className: STORE_TAG_CLASS }, t('settings.storeDefault'));
    }
    if (!store.isOwner && store.ownerName) {
      return h('span', { key: 'owner', className: STORE_OWNER_TAG_CLASS }, store.ownerName);
    }
    return undefined;
  }

  function AgentMemorySettings(props: AgentMemorySettingsProps): ReactElement {
    translator.useLocale();
    const { Switch, ControlCombobox, MultiSelect, Label } = hostUi;
    const { data: storesData } = useRpc<MemoryStoresResult>('memories.stores', {});
    const storeId =
      typeof props.memoryStore === 'string' && props.memoryStore !== ''
        ? props.memoryStore
        : undefined;
    const { data: domainsData } = useRpc<MemoryDomainsResult>(
      'memories.domains',
      { storeId },
      storeId != null,
    );
    const stores = storesData?.stores ?? props.stores ?? [];
    const domains: AgentMemoryDomain[] = (domainsData?.domains ?? props.domains ?? []).map(
      (domain) => ({
        ...domain,
        kindLabel: t(`com_ui_memory_domain_kind_${domain.kind}`),
        isNonReal: ['fictional', 'sandbox', 'study'].includes(domain.kind),
      }),
    );
    const selected = stores.find((store) => store.id === props.memoryStore);
    const storeItems: OptionWithIcon[] = stores.map((store) => ({
      label: store.name,
      value: store.id,
      icon: storeTag(store),
    }));
    storeItems.push({ label: t('settings.clear'), value: '' });
    const domainItems: OptionWithIcon[] = domains.map((domain) => ({
      label: `${domain.name} · ${domain.kindLabel}${
        domain.isNonReal ? ` (${t('settings.domainNotReal')})` : ''
      }`,
      value: domain.id,
    }));
    const domainNameOf = (id: string): string =>
      domains.find((domain) => domain.id === id)?.name ?? id;

    return h('div', { className: 'mb-3' }, [
      h('div', { key: 'row', className: 'mb-1 flex items-center justify-between gap-2' }, [
        h(
          Label,
          {
            key: 'label',
            htmlFor: 'use-memory-switch',
            className: 'block text-[11px] font-medium uppercase tracking-wide text-text-secondary',
          },
          t('settings.useMemory'),
        ),
        h(Switch, {
          key: 'switch',
          id: 'use-memory-switch',
          checked: props.useMemory !== false,
          onCheckedChange: (checked) => props.setUseMemory(checked),
          'aria-label': t('settings.useMemory'),
        }),
      ]),
      h(
        'p',
        { key: 'info', className: 'text-xs leading-relaxed text-text-secondary' },
        t('settings.useMemoryInfo'),
      ),
      props.useMemory !== false
        ? h('div', { key: 'store', className: 'mt-2 flex flex-col' }, [
            h(ControlCombobox, {
              key: 'combobox',
              isCollapsed: false,
              ariaLabel: t('settings.store'),
              selectedValue: props.memoryStore ?? '',
              displayValue: selected?.name,
              setValue: (value) => props.setMemoryStore(value || undefined),
              selectPlaceholder: t('settings.selectStore'),
              searchPlaceholder: t('settings.searchStores'),
              items: storeItems,
              className: 'h-9 border-border-light',
              containerClassName: 'px-0',
              iconSide: 'right',
              iconAlign: 'inline',
              iconClassName: 'h-auto w-auto gap-1 overflow-visible rounded-none',
              SelectIcon: selected ? storeTag(selected) : undefined,
            }),
            h(
              'p',
              { key: 'hint', className: 'mt-1 text-xs leading-relaxed text-text-secondary' },
              t('settings.storeRequired'),
            ),
            domainItems.length > 1
              ? h('div', { key: 'domains', className: 'mt-2 flex flex-col' }, [
                  h(MultiSelect, {
                    key: 'multiselect',
                    items: domainItems,
                    selectedValues: props.memoryDomains ?? [],
                    setSelectedValues: (values) =>
                      props.setMemoryDomains(values.length > 0 ? values : undefined),
                    label: t('settings.domains'),
                    placeholder: t('settings.domainDefaultOnly'),
                    renderSelectedValues: (values, placeholder) =>
                      values.length === 0
                        ? (placeholder ?? '')
                        : values.map((value) => domainNameOf(value)).join(', '),
                    className: 'w-full',
                    selectClassName:
                      'rounded-lg py-1.5 text-xs max-md:w-full max-md:[&>span]:block',
                    itemClassName: 'text-xs',
                    labelClassName:
                      'mb-1 block text-[11px] font-medium uppercase tracking-wide text-text-secondary',
                    popoverClassName: '!min-w-max max-w-[min(90vw,40rem)]',
                  }),
                  h(
                    'p',
                    {
                      key: 'domain-hint',
                      className: 'mt-1 text-xs leading-relaxed text-text-secondary',
                    },
                    t('settings.domainAgentsHint'),
                  ),
                ])
              : null,
          ])
        : null,
    ]);
  }

  /** The original message-card glyph: a small memory/page mark, not a brain. */
  function MemoryArtifactIcon(props: SVGProps<SVGSVGElement>): ReactElement {
    return h(
      'svg',
      {
        width: 20,
        height: 20,
        viewBox: '0 0 18 18',
        fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg',
        className: 'mb-[-1px]',
        'aria-hidden': true,
        ...props,
      },
      [
        h('path', {
          key: 'a',
          d: 'M6 3C4.89543 3 4 3.89543 4 5V13C4 14.1046 4.89543 15 6 15L6 3Z',
          fill: 'currentColor',
        }),
        h('path', {
          key: 'b',
          d: 'M7 3V15H8.18037L8.4899 13.4523C8.54798 13.1619 8.69071 12.8952 8.90012 12.6858L12.2931 9.29289C12.7644 8.82153 13.3822 8.58583 14 8.58578V3.5C14 3.22386 13.7761 3 13.5 3H7Z',
          fill: 'currentColor',
        }),
        h('path', {
          key: 'c',
          d: 'M11.3512 15.5297L9.73505 15.8529C9.38519 15.9229 9.07673 15.6144 9.14671 15.2646L9.46993 13.6484C9.48929 13.5517 9.53687 13.4628 9.60667 13.393L12.9996 10C13.5519 9.44771 14.4473 9.44771 14.9996 10C15.5519 10.5523 15.5519 11.4477 14.9996 12L11.6067 15.393C11.5369 15.4628 11.448 15.5103 11.3512 15.5297Z',
          fill: 'currentColor',
        }),
      ],
    );
  }

  function HeaderMemoryButton(props: HeaderMemoryButtonProps): ReactElement | null {
    translator.useLocale();
    const [open, setOpen] = useState(false);
    if (!props.conversationId) {
      return null;
    }
    return h(React.Fragment, null, [
      h(
        'button',
        {
          key: 'button',
          type: 'button',
          title: t('header.scope'),
          'aria-label': t('header.scope'),
          onClick: () => setOpen(true),
          className:
            'inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border-light bg-presentation/75 text-text-primary backdrop-blur-xl transition-all ease-in-out hover:bg-surface-tertiary',
        },
        h(api.icons.database, { key: 'icon', className: 'size-[18px]', 'aria-hidden': true }),
      ),
      open
        ? h(PortedScopeDialog, {
            key: 'dialog',
            open: true,
            conversationId: props.conversationId,
            onOpenChange: setOpen,
          })
        : null,
    ]);
  }

  api.ui.register('chat.header.actions', HeaderMemoryButton);
  api.ui.register('agent.settings.memory', AgentMemorySettings);
  api.ui.register('chat.message.cards', MemoryArtifacts);
  api.ui.panel({
    id: 'memories',
    title: () => t('navTitle'),
    icon: 'database',
    component: PortedPanel,
  });
}
