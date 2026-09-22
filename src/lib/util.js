export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export const PROJECT_COLORS = ['#4f7fd9', '#9467c2', '#3f9468', '#d9822b', '#c9508b', '#2f98a8', '#c9a227', '#d4574e'];

export const STATUSES = [
  { id: 'todo', label: 'Todo' },
  { id: 'done', label: 'Done' },
];

export const PRIORITIES = [
  { id: null, label: 'No priority' },
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
];

export const priorityLabel = (p) => PRIORITIES.find((x) => x.id === p)?.label ?? 'No priority';
export const statusLabel = (s) => STATUSES.find((x) => x.id === s)?.label ?? 'Todo';

export const isMac = () => /Mac/i.test(navigator.platform || navigator.userAgent);
export const modKey = () => (isMac() ? '⌘' : 'Ctrl');

export function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
