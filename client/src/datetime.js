/** The memory panel's date-time format: locale-aware, short enough for a card's
 *  metadata row and for one line of a version's history entry. */
export const formatMemoryDateTime = (dateString) =>
  new Date(dateString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const formatterCache = new Map();

function relativeFormatter(locale) {
  const key = locale ?? '';
  if (!formatterCache.has(key)) {
    formatterCache.set(key, new Intl.RelativeTimeFormat(locale ?? undefined, { numeric: 'auto' }));
  }
  return formatterCache.get(key);
}

/** Relative time for a list row; `absolute` for the tooltip. */
export function getMessageTimestamp(value, locale) {
  if (value == null || value === '') {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const formatter = relativeFormatter(locale);
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  let relative;
  if (minutes < 1) {
    relative = formatter.format(0, 'minute');
  } else if (minutes < 60) {
    relative = formatter.format(-minutes, 'minute');
  } else if (minutes < 1440) {
    relative = formatter.format(-Math.round(minutes / 60), 'hour');
  } else if (minutes < 43200) {
    relative = formatter.format(-Math.round(minutes / 1440), 'day');
  } else {
    relative = new Intl.DateTimeFormat(locale ?? undefined, { dateStyle: 'medium' }).format(date);
  }
  return {
    iso: date.toISOString(),
    relative,
    absolute: new Intl.DateTimeFormat(locale ?? undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date),
  };
}
