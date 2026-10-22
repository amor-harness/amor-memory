/**
 * The update time every prompt-side memory injection carries: a memory's
 * `updated_at` is what tells the model whether a fact is fresh or stale, and a
 * relative phrase ("2 days ago") would freeze at the moment the prompt was
 * built — prompt text outlives the turn, the instant does not.
 */

/** `YYYY-MM-DD HH:mm` in the caller's zone. A zone the runtime rejects falls
 *  back to its own local zone, the same way the run's own clock line does, so
 *  a bad client value never costs the entry its timestamp. */
export function formatMemoryTime(
  value: Date | string | number | null | undefined,
  timezone?: string,
): string | undefined {
  if (value == null) {
    return undefined;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  };
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      ...options,
      ...(timezone ? { timeZone: timezone } : {}),
    });
  } catch {
    formatter = new Intl.DateTimeFormat('en-CA', options);
  }
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

/** The `["updated": "..."]` prompt field for an entry, placed right after its
 *  key. Empty when the row carries no usable timestamp, so an entry with none
 *  renders exactly as it did before the field existed. */
export function memoryTimeField(
  entry: { updated_at?: Date | string | null } | null | undefined,
  timezone?: string,
): string {
  const time = formatMemoryTime(entry?.updated_at, timezone);
  return time == null ? '' : ` ["updated": "${time}"]`;
}
