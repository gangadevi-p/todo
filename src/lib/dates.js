// Dates are stored as local calendar keys ("YYYY-MM-DD") so a task due on
// Friday stays due on Friday regardless of time zone.

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n) => String(n).padStart(2, '0');

export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => toKey(new Date());

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, n) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

/** Whole days from `b` to `a` (positive when `a` is later). */
export const diffDays = (a, b) => Math.round((fromKey(a) - fromKey(b)) / 86400000);

/** The next given weekday strictly after `key` (1 = Monday). */
export function nextWeekday(key, weekday = 1) {
  const day = fromKey(key).getDay();
  return addDays(key, (weekday - day + 7) % 7 || 7);
}

export function shortDate(key, today = todayKey()) {
  const d = fromKey(key);
  const sameYear = d.getFullYear() === fromKey(today).getFullYear();
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}${sameYear ? '' : `, ${d.getFullYear()}`}`;
}

export function longDate(key) {
  const d = fromKey(key);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Compact label for a due date chip, plus a tone for colouring. */
export function dueLabel(key, today = todayKey()) {
  const n = diffDays(key, today);
  if (n === 0) return { text: 'Today', tone: 'today' };
  if (n === 1) return { text: 'Tomorrow', tone: 'soon' };
  if (n === -1) return { text: 'Yesterday', tone: 'overdue' };
  if (n < 0) return { text: shortDate(key, today), tone: 'overdue' };
  if (n < 7) return { text: WEEKDAYS_SHORT[fromKey(key).getDay()], tone: 'normal' };
  return { text: shortDate(key, today), tone: 'normal' };
}

/** Longer label used in the detail panel: "Tomorrow · Sep 22". */
export function dueLabelLong(key, today = todayKey()) {
  const n = diffDays(key, today);
  const short = shortDate(key, today);
  if (n === 0) return `Today · ${short}`;
  if (n === 1) return `Tomorrow · ${short}`;
  if (n === -1) return `Yesterday · ${short}`;
  if (n > 1 && n < 7) return `${WEEKDAYS[fromKey(key).getDay()]} · ${short}`;
  return `${WEEKDAYS_SHORT[fromKey(key).getDay()]}, ${short}`;
}

/** Heading for a day group in Upcoming. */
export function upcomingHeading(key, today = todayKey()) {
  const n = diffDays(key, today);
  const d = fromKey(key);
  if (n === 1) return { title: 'Tomorrow', sub: shortDate(key, today) };
  if (n < 7) return { title: WEEKDAYS[d.getDay()], sub: shortDate(key, today) };
  return { title: `${WEEKDAYS_SHORT[d.getDay()]}, ${shortDate(key, today)}`, sub: '' };
}

/** Heading for a completion-day group in Completed. */
export function completedHeading(key, today = todayKey()) {
  const n = diffDays(key, today);
  if (n === 0) return { title: 'Today', sub: shortDate(key, today) };
  if (n === -1) return { title: 'Yesterday', sub: shortDate(key, today) };
  if (n > -7) return { title: WEEKDAYS[fromKey(key).getDay()], sub: shortDate(key, today) };
  return { title: `${WEEKDAYS_SHORT[fromKey(key).getDay()]}, ${shortDate(key, today)}`, sub: '' };
}

export function formatTimestamp(ts, includeTime = false) {
  const d = new Date(ts);
  const date = `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  if (!includeTime) return date;
  return `${date} · ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}
