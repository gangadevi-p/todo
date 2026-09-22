// Estimating how long the remaining work in a section will take, from how
// long past tasks in that section actually took to finish.

/** Average ms from createdAt to completedAt across finished tasks, or null with too little history to trust. */
export function avgCompletionMs(list) {
  const durations = list
    .filter((t) => t.status === 'done' && t.completedAt && t.createdAt && t.completedAt > t.createdAt)
    .map((t) => t.completedAt - t.createdAt);
  if (durations.length < 2) return null;
  return durations.reduce((a, b) => a + b, 0) / durations.length;
}

/** How much work is left across open tasks: a bare task counts as 1, one that's partly checked off counts less. */
export function remainingWork(openTasks, taskProgress) {
  return openTasks.reduce((sum, t) => sum + (1 - taskProgress(t)), 0);
}

const UNITS = [
  ['year', 365 * 86400000],
  ['month', 30 * 86400000],
  ['week', 7 * 86400000],
  ['day', 86400000],
  ['hour', 3600000],
  ['minute', 60000],
];

/** "3 days", "2 hours", singular-aware. */
export function formatDuration(ms) {
  for (const [label, unitMs] of UNITS) {
    if (ms >= unitMs) {
      const n = Math.round(ms / unitMs);
      return `${n} ${label}${n === 1 ? '' : 's'}`;
    }
  }
  return 'a minute';
}
