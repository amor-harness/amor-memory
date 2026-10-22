/** Mirrors the app's domain vocabulary so a kind reads the same in both UIs. */
export const MEMORY_DOMAIN_KIND_LABEL_KEYS = {
  real: 'com_ui_memory_domain_kind_real',
  fictional: 'com_ui_memory_domain_kind_fictional',
  project: 'com_ui_memory_domain_kind_project',
  sandbox: 'com_ui_memory_domain_kind_sandbox',
  study: 'com_ui_memory_domain_kind_study',
  work: 'com_ui_memory_domain_kind_work',
};

export const MEMORY_DOMAIN_NON_REAL_KINDS = ['fictional', 'sandbox'];

export const isNonRealDomainKind = (kind) => MEMORY_DOMAIN_NON_REAL_KINDS.includes(kind);

/** Same class strings as `client/src/common/domains.ts`. */
export const DOMAIN_KIND_BADGE_COLORS = {
  real: 'border border-blue-500/30 bg-blue-500/15 text-blue-600 dark:text-blue-400',
  fictional: 'border border-purple-500/30 bg-purple-500/15 text-purple-600 dark:text-purple-400',
  project: 'border border-teal-500/30 bg-teal-500/15 text-teal-600 dark:text-teal-400',
  sandbox: 'border border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400',
  study: 'border border-cyan-500/30 bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
  work: 'border border-indigo-500/30 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
};

export const domainKindBadgeColor = (kind) =>
  DOMAIN_KIND_BADGE_COLORS[kind] ?? DOMAIN_KIND_BADGE_COLORS.real;
