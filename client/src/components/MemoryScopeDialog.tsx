import { h, Fragment } from '../runtime.js';
import { useMemo, useState } from '../runtime.js';
import { OGDialog, OGDialogTemplate, Spinner, Switch } from '../runtime.js';
import type { TConversationMemory, TMemoryDomain } from '../sdk.js';
import MemoryDomainChip from './MemoryDomainChip.tsx';
import {
  useMemoryDomainsQuery,
  useConversationMemoriesQuery,
  useSetMemoryDomainActiveMutation,
} from '../data.js';
import { useLocalize } from '../runtime.js';
import type { TranslationKeys } from '../runtime.js';
import { cn } from '../utils.js';

/** The domain a row came from. A domain that no longer exists has no kind to
 *  label, so it degrades to its bare name instead of claiming to be real. */
function DomainLabel({ domain, name }: { domain?: TMemoryDomain; name?: string }) {
  if (domain != null) {
    return <MemoryDomainChip domain={domain} />;
  }
  if (name == null || name === '') {
    return null;
  }
  return (
    <span className="inline-flex min-w-0 items-center rounded-full border border-border-heavy bg-surface-tertiary px-2 py-0.5 text-xs font-medium text-text-secondary">
      <span className="truncate">{name}</span>
    </span>
  );
}

/** One memory of this chat: its key, a summary that expands to the full value
 *  on click, and whether the chat wrote it or only recalled it (how many
 *  times). */
function MemoryScopeRow({
  memory,
  domain,
  /** `recalled`: the row already sits under its domain, so no domain chip and a
   *  single "recalled N times" chip. `created`: the chat's own write, labelled
   *  created or updated. */
  variant,
}: {
  memory: TConversationMemory;
  domain?: TMemoryDomain;
  variant: 'recalled' | 'created';
}) {
  const localize = useLocalize();
  const [expanded, setExpanded] = useState(false);
  const summary = memory.content ?? memory.value ?? '';
  /** Nothing to reveal for an empty value: the row stays inert. */
  const expandable = summary !== '';

  return (
    <li
      className="rounded-lg border border-border-light bg-surface-secondary px-3 py-2"
      data-testid="memory-scope-row"
    >
      <div
        className={cn('flex items-start justify-between gap-3', expandable && 'cursor-pointer')}
        {...(expandable
          ? {
              role: 'button' as const,
              tabIndex: 0,
              'aria-expanded': expanded,
              onClick: () => setExpanded((value) => !value),
              onKeyDown: (event: React.KeyboardEvent) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setExpanded((value) => !value);
                }
              },
            }
          : {})}
      >
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-medium text-text-primary">{memory.key}</span>
            {variant === 'created' && <DomainLabel domain={domain} name={memory.domainName} />}
            {memory.stable === true && (
              <span className="shrink-0 rounded-full border border-border-heavy bg-surface-tertiary px-2 py-0.5 text-xs font-medium text-text-secondary">
                {localize('com_ui_memory_stable')}
              </span>
            )}
          </div>
          {expandable && (
            <p
              className={cn(
                'mt-1 text-xs text-text-secondary [overflow-wrap:anywhere]',
                /** Collapsed shows the first two lines; a click reveals the
                 *  whole value, another click folds it back. */
                !expanded && 'line-clamp-2',
              )}
              data-testid="memory-scope-content"
            >
              {summary}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 font-medium',
              variant === 'created'
                ? 'border-border-heavy bg-surface-tertiary text-text-primary'
                : 'border-border-light text-text-secondary',
            )}
            data-testid={
              variant === 'created' ? 'memory-scope-created-chip' : 'memory-scope-recall-count'
            }
          >
            {variant === 'created'
              ? localize(
                  memory.created === true
                    ? 'com_ui_memory_scope_created'
                    : 'com_ui_memory_scope_updated',
                )
              : localize('com_ui_memory_scope_recall_count', { 0: memory.recallCount })}
          </span>
        </div>
      </div>
    </li>
  );
}

interface MemoryScopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The chat whose memory context is shown; every section is about one
   *  conversation, so nothing is fetched while there is none. */
  conversationId?: string;
}

/**
 * The memory context of one chat: the domains it reads and writes, what it has
 * recalled (and how often), and everything linked to it. The conversation-side
 * counterpart of the Memories panel, which manages the store as a whole.
 */
export default function MemoryScopeDialog({
  open,
  onOpenChange,
  conversationId,
}: MemoryScopeDialogProps) {
  const localize = useLocalize();
  const enabled = open && Boolean(conversationId);

  const {
    data: domainData,
    isLoading: domainsLoading,
    isError: domainsError,
  } = useMemoryDomainsQuery(undefined, conversationId, { enabled });
  const {
    data: conversationData,
    isLoading: memoriesLoading,
    isError: memoriesError,
  } = useConversationMemoriesQuery(conversationId, undefined, { enabled });

  const setActive = useSetMemoryDomainActiveMutation();

  const domains = domainData?.domains ?? [];
  const memories = conversationData?.memories ?? [];

  const domainById = useMemo(
    () => new Map(domains.map((domain) => [domain.id, domain])),
    [domains],
  );
  /** One palette assignment for the dialog, so a domain's chip agrees with the
   *  memory cards behind the dialog. */
  const defaultDomain = useMemo(
    () => domains.find((domain) => domain.isDefault === true),
    [domains],
  );

  /** A conversation that stored an active set owns it — including an empty one,
   *  which means every domain was closed. Only a conversation that never chose
   *  falls back to the default domain, the same floor the runtime uses. */
  const activeIds = useMemo(() => {
    const stored = domainData?.activeDomainIds;
    const ids = new Set(stored ?? []);
    if (stored == null && defaultDomain != null) {
      ids.add(defaultDomain.id);
    }
    return ids;
  }, [domainData?.activeDomainIds, defaultDomain]);

  const recalled = useMemo(() => memories.filter((memory) => memory.recallCount > 0), [memories]);

  /** Recalled memories grouped by the domain they came from, in the domain
   *  list's own order; a row whose domain is gone sorts last. */
  const recalledGroups = useMemo(() => {
    const groups = new Map<string, TConversationMemory[]>();
    for (const memory of recalled) {
      const key = memory.domainId ?? '';
      const rows = groups.get(key) ?? [];
      rows.push(memory);
      groups.set(key, rows);
    }
    const order = new Map(domains.map((domain, index) => [domain.id, index]));
    const rank = (domainId: string) =>
      domainId === '' ? Number.MAX_SAFE_INTEGER : (order.get(domainId) ?? domains.length);
    return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b));
  }, [recalled, domains]);

  /** This section answers "what did THIS chat write?": recalled memories are
   *  already listed by domain above, so only the conversation's own entries
   *  belong here (newest first). */
  const createdMemories = useMemo(
    () =>
      memories
        .filter((memory) => memory.extracted)
        .sort(
          (a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime(),
        ),
    [memories],
  );

  const toggleDomain = (domain: TMemoryDomain, next: boolean) => {
    if (conversationId == null) {
      return;
    }
    const ids = new Set(activeIds);
    if (next) {
      ids.add(domain.id);
    } else {
      ids.delete(domain.id);
    }
    setActive.mutate({ conversationId, domainIds: [...ids] });
  };

  const spinner = <Spinner className="my-2 size-4" />;
  const errorLine = (
    <p className="text-xs text-text-secondary" role="alert">
      {localize('com_ui_error')}
    </p>
  );
  const emptyLine = (key: TranslationKeys) => (
    <p className="text-xs text-text-secondary">{localize(key)}</p>
  );

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogTemplate
        title={localize('com_ui_memory_scope_title')}
        description={localize('com_ui_memory_scope_description')}
        showCloseButton
        /* The dialog is capped and never scrolls itself: its body owns the one
         *  scroll region, so a long memory list does not stack a second
         *  scrollbar inside the dialog's own. */
        className="flex max-h-[90vh] w-11/12 flex-col overflow-hidden md:max-w-2xl"
        headerClassName="shrink-0"
        mainClassName="min-h-0 flex-1 overflow-y-auto"
        footerClassName="shrink-0"
        main={
          <div className="space-y-5 pr-1" data-testid="memory-scope-dialog">
            <section aria-labelledby="memory-scope-domains">
              <h3 id="memory-scope-domains" className="text-sm font-semibold text-text-primary">
                {localize('com_ui_memory_scope_active_domains')}
              </h3>
              <p className="mt-0.5 text-xs text-text-secondary">
                {localize('com_ui_memory_scope_active_hint')}
              </p>
              <div className="mt-2 space-y-1.5">
                {domainsLoading
                  ? spinner
                  : domainsError
                    ? errorLine
                    : domains.length === 0
                      ? emptyLine('com_ui_memory_scope_no_domains')
                      : domains.map((domain) => {
                          const active = activeIds.has(domain.id);
                          return (
                            <div
                              key={domain.id}
                              className="flex items-center justify-between gap-3 rounded-lg border border-border-light bg-surface-secondary px-3 py-2"
                              data-testid="memory-scope-domain-row"
                            >
                              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                <MemoryDomainChip domain={domain} />
                                <span className="text-xs text-text-secondary">
                                  {localize('com_ui_memories_count', {
                                    0: domain.memoryCount ?? 0,
                                  })}
                                </span>
                              </div>
                              <Switch
                                size="small"
                                className="shrink-0"
                                checked={active}
                                disabled={setActive.isLoading}
                                aria-label={localize(
                                  active
                                    ? 'com_ui_memory_scope_deactivate'
                                    : 'com_ui_memory_scope_activate',
                                )}
                                onCheckedChange={(next) => toggleDomain(domain, next)}
                              />
                            </div>
                          );
                        })}
              </div>
            </section>

            <section aria-labelledby="memory-scope-recalled">
              <h3 id="memory-scope-recalled" className="text-sm font-semibold text-text-primary">
                {localize('com_ui_memory_scope_recalled_by_domain')}
              </h3>
              <div className="mt-2 space-y-3">
                {memoriesLoading
                  ? spinner
                  : memoriesError
                    ? errorLine
                    : recalledGroups.length === 0
                      ? emptyLine('com_ui_memory_scope_no_recalls')
                      : recalledGroups.map(([domainId, rows]) => (
                          <div key={domainId === '' ? 'unassigned' : domainId}>
                            <div className="mb-1 flex items-center gap-2">
                              <DomainLabel
                                domain={domainId === '' ? undefined : domainById.get(domainId)}
                                name={
                                  domainId === ''
                                    ? (defaultDomain?.name ??
                                      localize('com_ui_memory_store_default'))
                                    : domainById.get(domainId)?.name
                                }
                              />
                              <span className="text-xs text-text-secondary">
                                {localize('com_ui_memories_count', { 0: rows.length })}
                              </span>
                            </div>
                            <ul className="space-y-1.5">
                              {rows.map((memory) => (
                                <MemoryScopeRow
                                  key={memory.key}
                                  variant="recalled"
                                  memory={memory}
                                  domain={
                                    memory.domainId != null
                                      ? domainById.get(memory.domainId)
                                      : undefined
                                  }
                                />
                              ))}
                            </ul>
                          </div>
                        ))}
              </div>
            </section>

            <section aria-labelledby="memory-scope-all">
              <h3 id="memory-scope-all" className="text-sm font-semibold text-text-primary">
                {localize('com_ui_memory_scope_conversation')}
              </h3>
              {memoriesLoading ? (
                <div className="mt-2">{spinner}</div>
              ) : memoriesError ? (
                <div className="mt-2">{errorLine}</div>
              ) : createdMemories.length === 0 ? (
                <div className="mt-2">{emptyLine('com_ui_memory_scope_empty')}</div>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {createdMemories.map((memory) => (
                    <MemoryScopeRow
                      key={memory.key}
                      variant="created"
                      memory={memory}
                      domain={memory.domainId != null ? domainById.get(memory.domainId) : undefined}
                    />
                  ))}
                </ul>
              )}
            </section>
          </div>
        }
      />
    </OGDialog>
  );
}
