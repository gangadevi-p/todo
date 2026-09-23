import { useMemo, useSyncExternalStore } from 'react';
import { seedData, defaultPrefs, DEMO_VERSION, DEMO_NAME } from './seed';
import { plural, uid, PROJECT_COLORS } from './lib/util';
import { normalizeTextStyle } from './lib/textStyle';

// ---------------------------------------------------------------------------
// Tiny external stores. `data` is persisted; `ui` is session-only.
// ---------------------------------------------------------------------------

function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    set(next) {
      state = typeof next === 'function' ? next(state) : next;
      listeners.forEach((l) => l());
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export const data = createStore({ projects: [], tasks: [], trash: [], prefs: defaultPrefs() });

export const ui = createStore({
  platform: 'web',
  view: 'today',
  selectedId: null,
  panelOpen: false,
  lingering: {}, // taskId -> status before completion (keeps just-checked rows visible briefly)
  search: false,
  help: false,
  menu: null, // { kind: 'menu' | 'popover', x, y, items | render }
  confirm: null,
  toasts: [],
  editingProjectId: null,
  draggingId: null,
  focusTitle: null, // { id, at } asks the detail panel to focus its title
  preview: null, // { id, pinned } overview popup shown beside a task
  popup: null, // { kind: 'task' | 'project' | 'subtask', nonce, ... } while a create popup is open
  selecting: false, // bulk-select mode: rows/subtasks pick instead of opening or toggling
  selected: new Set(), // keys from taskKey()/subtaskKey() picked while selecting
  statsFilter: 'todo', // 'todo' | 'done' — the active status tab for the current section
  mobileNavOpen: false, // sidebar-as-drawer visibility on narrow screens; unrelated to prefs.sidebarCollapsed
});

export const useData = (sel) => useSyncExternalStore(data.subscribe, () => sel(data.get()));
export const useUI = (sel) => useSyncExternalStore(ui.subscribe, () => sel(ui.get()));

const patchUI = (patch) => ui.set((u) => ({ ...u, ...patch }));

// ---------------------------------------------------------------------------
// Persistence: Electron writes JSON to the user data folder; the plain
// browser build (used for development) falls back to localStorage.
// ---------------------------------------------------------------------------

const bridge = typeof window !== 'undefined' ? window.nudge : undefined;
const LS_KEYS = { owner: 'nudge:data:v1', demo: 'nudge:demo:v1' };
let space = 'owner'; // which workspace is open; set by loadData()
export const getSpace = () => space;
export const TRASH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
let saveTimer = null;

function payload() {
  const { projects, tasks, trash, prefs } = data.get();
  return { version: 2, savedAt: Date.now(), projects, tasks, trash, prefs };
}

function writeNow(sync) {
  clearTimeout(saveTimer);
  saveTimer = null;
  const p = payload();
  if (bridge) sync ? bridge.saveSync(space, p) : bridge.save(space, p);
  else {
    try { localStorage.setItem(LS_KEYS[space], JSON.stringify(p)); } catch {}
  }
}

/** Browser build: seeds the personal space from an exported nudge-data.json. */
export function importOwnerData(obj) {
  if (!obj || !Array.isArray(obj.tasks)) return false;
  try { localStorage.setItem(LS_KEYS.owner, JSON.stringify(obj)); return true; } catch { return false; }
}

/** Writes any pending change right away (used before signing out). */
export function flushSave() {
  if (saveTimer) writeNow(true);
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => writeNow(false), 250);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => { if (saveTimer) writeNow(true); });
}

function normalizeChecklistItem(item = {}) {
  return {
    id: item.id || uid(),
    title: item.title || '',
    done: Boolean(item.done),
    completedAt: item.completedAt || null,
    textStyle: normalizeTextStyle(item.textStyle),
    subtasks: Array.isArray(item.subtasks) ? item.subtasks.map(normalizeChecklistItem) : [],
  };
}

function normalizeTask(t, i) {
  return {
    id: t.id || uid(),
    title: typeof t.title === 'string' ? t.title : 'Untitled',
    notes: t.notes || '',
    status: ['todo', 'done'].includes(t.status) ? t.status : 'todo',
    priority: ['low', 'medium', 'high'].includes(t.priority) ? t.priority : null,
    projectId: t.projectId || null,
    parentId: t.parentId || null,
    isHeading: Boolean(t.isHeading),
    dueDate: t.dueDate || null,
    addedToToday: Boolean(t.addedToToday),
    createdAt: t.createdAt || Date.now(),
    completedAt: t.completedAt || null,
    order: Number.isFinite(t.order) ? t.order : i + 1,
    subtasks: Array.isArray(t.subtasks) ? t.subtasks.map(normalizeChecklistItem) : [],
    textStyle: normalizeTextStyle(t.textStyle),
  };
}

function normalize(raw) {
  const projects = (raw.projects || []).map((p, i) => ({
    id: p.id || uid(),
    name: p.name || 'Untitled',
    createdAt: p.createdAt || Date.now(),
    order: Number.isFinite(p.order) ? p.order : i + 1,
    color: p.color || PROJECT_COLORS[i % PROJECT_COLORS.length],
    textStyle: normalizeTextStyle(p.textStyle),
  }));
  const ids = new Set(projects.map((p) => p.id));
  let tasks = (raw.tasks || []).map(normalizeTask).map((t) =>
    t.projectId && !ids.has(t.projectId) ? { ...t, projectId: null } : t);
  const taskIds = new Set(tasks.map((t) => t.id));
  tasks = tasks.map((t) =>
    t.parentId && (t.parentId === t.id || !taskIds.has(t.parentId)) ? { ...t, parentId: null } : t);
  const cutoff = Date.now() - TRASH_RETENTION_MS;
  const trash = (raw.trash || [])
    .map((t, i) => ({
      ...normalizeTask(t, i),
      deletedAt: Number.isFinite(t.deletedAt) ? t.deletedAt : Date.now(),
      trashBatchId: t.trashBatchId || t.id || uid(),
    }))
    .filter((t) => t.deletedAt > cutoff);
  return { projects, tasks, trash, prefs: { ...defaultPrefs(), ...(raw.prefs || {}) } };
}

const APP_TITLE = typeof document !== 'undefined' ? document.title : '';

export async function loadData(which = 'owner') {
  space = which;
  if (typeof document !== 'undefined') document.title = space === 'demo' ? DEMO_NAME : APP_TITLE;
  let raw = null;
  let platform = 'web';
  if (bridge) {
    const res = await bridge.load(space);
    raw = res?.data ?? null;
    platform = res?.platform ?? 'web';
  } else {
    try { raw = JSON.parse(localStorage.getItem(LS_KEYS[space])); } catch {}
  }
  // Only the demo gets sample tasks; a brand-new personal space starts empty.
  // A demo saved from an older sample set is replaced with the current one.
  const empty = { projects: [], tasks: [], trash: [], prefs: defaultPrefs() };
  const stale = space === 'demo' && raw?.prefs?.demoVersion !== DEMO_VERSION;
  const saved = raw && Array.isArray(raw.tasks) && !stale;
  const initial = saved ? normalize(raw) : space === 'demo' ? seedData() : empty;
  data.set(initial);
  if (!saved || initial.trash.length !== (raw.trash || []).length) scheduleSave();

  // The demo always opens on Today, so visitors land on the sample day.
  let view = space === 'demo' ? 'today' : initial.prefs.view || 'today';
  if (view.startsWith('project:') && !initial.projects.some((p) => `project:${p.id}` === view)) view = 'today';
  patchUI({ platform, view, statsFilter: view === 'completed' ? 'done' : 'todo' });
}

function commit(updater) {
  data.set((s) => {
    const next = updater(s);
    const cutoff = Date.now() - TRASH_RETENTION_MS;
    const trash = (next.trash || []).filter((t) => t.deletedAt > cutoff);
    return trash.length === (next.trash || []).length ? next : { ...next, trash };
  });
  scheduleSave();
}

// Keep an open app tidy too; loading the app and every other saved change also
// prune expired entries through normalize() and commit().
if (typeof window !== 'undefined') {
  window.setInterval(() => {
    const cutoff = Date.now() - TRASH_RETENTION_MS;
    if (data.get().trash?.some((t) => t.deletedAt <= cutoff)) {
      commit((s) => ({ ...s, trash: s.trash.filter((t) => t.deletedAt > cutoff) }));
    }
  }, 15 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Task actions
// ---------------------------------------------------------------------------

const now = () => Date.now();
const maxOrder = (items) => items.reduce((m, x) => Math.max(m, x.order ?? 0), 0);
export const findTask = (id) => data.get().tasks.find((t) => t.id === id);
export const childTasks = (id, tasks) => tasks.filter((t) => t.parentId === id).sort((a, b) => a.order - b.order);

/**
 * A task's direct children, kept referentially stable across renders where
 * nothing relevant changed — filtering fresh on every render (as a bare
 * useData selector would) hands useSyncExternalStore a new array each time
 * and sends React into an infinite update loop.
 */
export function useChildTasks(taskId) {
  const tasks = useData((s) => s.tasks);
  return useMemo(() => childTasks(taskId, tasks), [taskId, tasks]);
}

/** A task's children, grandchildren, etc. — needed so deleting a task doesn't orphan what's nested under it. */
function descendantIds(id, tasks) {
  const out = [];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop();
    for (const t of tasks) {
      if (t.parentId === cur) { out.push(t.id); stack.push(t.id); }
    }
  }
  return out;
}

function applyPatch(task, patch) {
  const next = { ...task, ...patch };
  if ('status' in patch && patch.status !== task.status) {
    next.completedAt = patch.status === 'done' ? now() : null;
  }
  return next;
}

export function createTask(fields = {}) {
  const id = fields.id || uid();
  const title = (fields.title || '').trim() || 'Untitled';
  commit((s) => {
    const task = {
      notes: '',
      status: 'todo',
      priority: null,
      projectId: null,
      parentId: null,
      isHeading: false,
      dueDate: null,
      addedToToday: false,
      completedAt: null,
      subtasks: [],
      textStyle: normalizeTextStyle(),
      ...fields,
      subtasks: Array.isArray(fields.subtasks) ? fields.subtasks.map(normalizeChecklistItem) : [],
      id,
      title,
      createdAt: now(),
      order: Number.isFinite(fields.order) ? fields.order : maxOrder(s.tasks) + 1,
    };
    if (task.status === 'done') task.completedAt = now();
    return { ...s, tasks: [...s.tasks, task] };
  });
  return id;
}

export function updateTask(id, patch) {
  commit((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? applyPatch(t, patch) : t)) }));
}

const lingerTimers = new Map();

function clearLinger(id) {
  clearTimeout(lingerTimers.get(id));
  lingerTimers.delete(id);
  ui.set((u) => {
    if (!(id in u.lingering)) return u;
    const lingering = { ...u.lingering };
    delete lingering[id];
    return { ...u, lingering };
  });
}

export function toggleComplete(id) {
  const task = findTask(id);
  if (!task) return;
  if (task.status === 'done') {
    const previous = ui.get().lingering[id];
    clearLinger(id);
    updateTask(id, { status: previous && previous !== 'done' ? previous : 'todo' });
    return;
  }
  // Keep the checked row in place for a moment before it moves to Completed.
  ui.set((u) => ({ ...u, lingering: { ...u.lingering, [id]: task.status } }));
  clearTimeout(lingerTimers.get(id));
  lingerTimers.set(id, setTimeout(() => clearLinger(id), 1300));
  updateTask(id, { status: 'done' });
}

export function toggleToday(id) {
  const task = findTask(id);
  if (task) updateTask(id, { addedToToday: !task.addedToToday });
}

export function deleteTask(id) {
  const task = findTask(id);
  if (!task) return;
  const { removed, batchId } = moveTasksToTrash([id]);
  const extra = removed.length - 1;
  toast(`Moved “${truncate(task.title, 32)}”${extra ? ` and ${plural(extra, 'sub-task')}` : ''} to Trash`, {
    label: 'Undo · Ctrl+Z',
    run: () => restoreTrashBatch(batchId),
  }, 8000);
}

export function duplicateTask(id) {
  const s = data.get();
  const task = s.tasks.find((t) => t.id === id);
  if (!task) return null;
  const next = s.tasks.filter((t) => t.order > task.order).sort((a, b) => a.order - b.order)[0];
  const copy = {
    ...task,
    id: uid(),
    createdAt: now(),
    order: next ? (task.order + next.order) / 2 : task.order + 1,
    subtasks: task.subtasks.map(cloneChecklistItem),
  };
  commit((st) => ({ ...st, tasks: [...st.tasks, copy] }));
  return copy.id;
}

/** Place a task between two neighbours (by id) and optionally patch it. */
export function placeTask(id, prevId, nextId, patch = {}) {
  commit((s) => {
    let tasks = s.tasks;
    const orderOf = (tid) => tasks.find((t) => t.id === tid)?.order;
    let a = prevId ? orderOf(prevId) : null;
    let b = nextId ? orderOf(nextId) : null;
    if (a != null && b != null && Math.abs(b - a) < 1e-6) {
      // Gaps got too small: renumber everything, preserving the current order.
      const rank = new Map([...tasks].sort((x, y) => x.order - y.order).map((t, i) => [t.id, i + 1]));
      tasks = tasks.map((t) => ({ ...t, order: rank.get(t.id) }));
      a = orderOf(prevId);
      b = orderOf(nextId);
    }
    let order;
    if (a == null && b == null) order = undefined;
    else if (a == null) order = b - 1;
    else if (b == null) order = a + 1;
    else order = (a + b) / 2;
    const full = order === undefined ? patch : { ...patch, order };
    return { ...s, tasks: tasks.map((t) => (t.id === id ? applyPatch(t, full) : t)) };
  });
}

// Subtasks ------------------------------------------------------------------

function cloneChecklistItem(item) {
  return { ...item, id: uid(), subtasks: (item.subtasks || []).map(cloneChecklistItem) };
}

function mapChecklistItem(list, itemId, patch) {
  let changed = false;
  const next = list.map((item) => {
    if (item.id === itemId) {
      changed = true;
      return patch(item);
    }
    if (!item.subtasks?.length) return item;
    const subtasks = mapChecklistItem(item.subtasks, itemId, patch);
    if (subtasks === item.subtasks) return item;
    changed = true;
    return { ...item, subtasks };
  });
  return changed ? next : list;
}

function findChecklistItem(list, itemId, parentId = null) {
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    if (item.id === itemId) return { item, index, parentId };
    const nested = findChecklistItem(item.subtasks || [], itemId, item.id);
    if (nested) return nested;
  }
  return null;
}

function removeChecklistItem(list, itemId, parentId = null) {
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    if (item.id === itemId) {
      return { list: [...list.slice(0, index), ...list.slice(index + 1)], removed: item, index, parentId };
    }
    const nested = removeChecklistItem(item.subtasks || [], itemId, item.id);
    if (nested.removed) {
      return {
        ...nested,
        list: [...list.slice(0, index), { ...item, subtasks: nested.list }, ...list.slice(index + 1)],
      };
    }
  }
  return { list, removed: null, index: -1, parentId: null };
}

function restoreChecklistItem(list, parentId, item, index) {
  if (!parentId) {
    if (findChecklistItem(list, item.id)) return list;
    const next = [...list];
    next.splice(Math.min(index, next.length), 0, item);
    return next;
  }
  return mapChecklistItem(list, parentId, (parent) => {
    if (findChecklistItem(parent.subtasks || [], item.id)) return parent;
    const subtasks = [...(parent.subtasks || [])];
    subtasks.splice(Math.min(index, subtasks.length), 0, item);
    return { ...parent, subtasks };
  });
}

function insertChecklistSibling(list, siblingId, item) {
  for (let index = 0; index < list.length; index += 1) {
    const current = list[index];
    if (current.id === siblingId) {
      return [...list.slice(0, index + 1), item, ...list.slice(index + 1)];
    }
    if (!current.subtasks?.length) continue;
    const subtasks = insertChecklistSibling(current.subtasks, siblingId, item);
    if (subtasks !== current.subtasks) {
      return [...list.slice(0, index), { ...current, subtasks }, ...list.slice(index + 1)];
    }
  }
  return list;
}

function updateSelectedChecklist(list, selectedIds, patch) {
  return list.map((item) => ({
    ...item,
    ...(selectedIds.has(item.id) ? patch(item) : {}),
    subtasks: updateSelectedChecklist(item.subtasks || [], selectedIds, patch),
  }));
}

function deleteSelectedChecklist(list, selectedIds) {
  return list
    .filter((item) => !selectedIds.has(item.id))
    .map((item) => ({ ...item, subtasks: deleteSelectedChecklist(item.subtasks || [], selectedIds) }));
}

function patchSubtasks(taskId, fn) {
  commit((s) => ({
    ...s,
    tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, subtasks: fn(t.subtasks) } : t)),
  }));
}

export function addSubtask(taskId, title = '', index = null, extra = {}) {
  const id = extra.id || uid();
  patchSubtasks(taskId, (list) => {
    const next = [...list];
    next.splice(index == null ? next.length : index, 0, normalizeChecklistItem({ ...extra, id, title }));
    return next;
  });
  return id;
}

/** Add a checklist item directly beneath another checklist item. */
export function addNestedSubtask(taskId, parentSubtaskId, title = '', extra = {}) {
  const id = extra.id || uid();
  const item = normalizeChecklistItem({ ...extra, id, title });
  patchSubtasks(taskId, (list) => mapChecklistItem(list, parentSubtaskId, (parent) => ({
    ...parent,
    subtasks: [...(parent.subtasks || []), item],
  })));
  return id;
}

/** Add a checklist item directly after another item at the same depth. */
export function addSubtaskAfter(taskId, siblingId, title = '', extra = {}) {
  const task = findTask(taskId);
  if (!task || !findChecklistItem(task.subtasks, siblingId)) return null;
  const id = extra.id || uid();
  const item = normalizeChecklistItem({ ...extra, id, title });
  patchSubtasks(taskId, (list) => insertChecklistSibling(list, siblingId, item));
  return id;
}


export const updateSubtask = (taskId, subId, patch) =>
  patchSubtasks(taskId, (list) => mapChecklistItem(list, subId, (item) => ({ ...item, ...patch })));

export function removeSubtask(taskId, subId) {
  const task = findTask(taskId);
  const found = task ? findChecklistItem(task.subtasks, subId) : null;
  if (!found) return;
  const { item: removed, index, parentId } = found;
  patchSubtasks(taskId, (list) => removeChecklistItem(list, subId).list);
  toast(`Deleted checklist item “${truncate(removed.title || 'Untitled', 28)}”`, {
    label: 'Undo · Ctrl+Z', run: () => patchSubtasks(taskId, (list) => restoreChecklistItem(list, parentId, removed, index)),
  }, 8000);
}

// ---------------------------------------------------------------------------
// Bulk selection: pick any mix of tasks and subtasks, then mark them all
// done or delete them together.
// ---------------------------------------------------------------------------

export const taskKey = (id) => `task:${id}`;
export const subtaskKey = (taskId, id) => `sub:${taskId}:${id}`;

export function parseSelectionKey(key) {
  const [kind, a, b] = key.split(':');
  return kind === 'task' ? { kind: 'task', id: a } : { kind: 'subtask', taskId: a, id: b };
}

/**
 * Enter or leave bulk-select mode. When task IDs are supplied, enter with
 * every task in the current page already selected (the Select button's
 * expected behaviour); callers can still toggle individual rows afterwards.
 */
export function setSelecting(on, taskIds = []) {
  patchUI({ selecting: on, selected: on ? new Set(taskIds.map(taskKey)) : new Set() });
}

export function toggleSelected(key) {
  ui.set((u) => {
    const next = new Set(u.selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return { ...u, selected: next };
  });
}

/** Marks every selected task done and checks off every selected subtask, in one commit. */
export function markSelectionDone(entries) {
  const taskIds = new Set(entries.filter((e) => e.kind === 'task').map((e) => e.id));
  const subByTask = new Map();
  for (const e of entries) {
    if (e.kind !== 'subtask') continue;
    if (!subByTask.has(e.taskId)) subByTask.set(e.taskId, new Set());
    subByTask.get(e.taskId).add(e.id);
  }
  commit((s) => ({
    ...s,
    tasks: s.tasks.map((t) => {
      let next = taskIds.has(t.id) ? applyPatch(t, { status: 'done' }) : t;
      const subIds = subByTask.get(t.id);
      if (subIds) next = { ...next, subtasks: updateSelectedChecklist(next.subtasks, subIds, () => ({ done: true })) };
      return next;
    }),
  }));
  setSelecting(false);
}

/** Deletes every selected task (undoable, like "Delete all") and removes every selected subtask. */
export function deleteSelection(entries) {
  const taskIds = entries.filter((e) => e.kind === 'task').map((e) => e.id);
  const subEntries = entries.filter((e) => e.kind === 'subtask');
  if (taskIds.length) deleteTasks(taskIds);
  if (subEntries.length) {
    commit((s) => ({
      ...s,
      tasks: s.tasks.map((t) => {
        const ids = subEntries.filter((e) => e.taskId === t.id).map((e) => e.id);
        return ids.length ? { ...t, subtasks: deleteSelectedChecklist(t.subtasks, new Set(ids)) } : t;
      }),
    }));
  }
  setSelecting(false);
}

export function confirmDeleteSelection(keys) {
  const entries = keys.map(parseSelectionKey);
  const n = entries.length;
  if (!n) return;
  askConfirm({
    title: 'Are you sure?',
    body: `This will delete ${n} selected item${n === 1 ? '' : 's'}. You can undo right after with Ctrl+Z.`,
    confirmLabel: `Delete ${n}`,
    onConfirm: () => deleteSelection(entries),
  });
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const nextProjectColor = (projects) => {
  const used = new Set(projects.map((p) => p.color));
  return PROJECT_COLORS.find((c) => !used.has(c)) || PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
};
export const nextTaskOrder = () => maxOrder(data.get().tasks) + 1;
export const nextProjectOrder = () => maxOrder(data.get().projects) + 1;

export function createProject({ id = uid(), name, color, order } = {}) {
  commit((s) => ({
    ...s,
    projects: [
      ...s.projects,
      {
        id,
        name: (name || '').trim() || 'Untitled',
        createdAt: now(),
        order: Number.isFinite(order) ? order : maxOrder(s.projects) + 1,
        color: color || nextProjectColor(s.projects),
        textStyle: normalizeTextStyle(),
      },
    ],
  }));
  return id;
}

export function renameProject(id, name) {
  const clean = name.trim();
  if (!clean) return;
  commit((s) => ({ ...s, projects: s.projects.map((p) => (p.id === id ? { ...p, name: clean } : p)) }));
}

export function updateProject(id, patch) {
  commit((s) => ({ ...s, projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
}

/** Moves a batch of tasks to Trash, always keeping each major task's descendants together. */
function moveTasksToTrash(ids) {
  const all = data.get().tasks;
  const set = new Set(ids.flatMap((id) => [id, ...descendantIds(id, all)]));
  const removed = all.filter((t) => set.has(t.id));
  if (!removed.length) return { removed: [], batchId: null };
  const batchId = uid();
  const deletedAt = now();
  hidePreview();
  commit((s) => ({
    ...s,
    tasks: s.tasks.filter((t) => !set.has(t.id)),
    trash: [...(s.trash || []), ...removed.map((t) => ({ ...t, deletedAt, trashBatchId: batchId }))],
  }));
  const u = ui.get();
  if (removed.some((t) => t.id === u.selectedId)) patchUI({ selectedId: null, panelOpen: false });
  return { removed, batchId };
}

/** Restore every task that was deleted together, including nested tasks. */
export function restoreTrashBatch(batchId) {
  if (!batchId) return;
  commit((s) => {
    const restored = (s.trash || []).filter((t) => t.trashBatchId === batchId);
    if (!restored.length) return s;
    const existing = new Set(s.tasks.map((t) => t.id));
    return {
      ...s,
      tasks: [...s.tasks, ...restored.filter((t) => !existing.has(t.id)).map(({ deletedAt, trashBatchId, ...t }) => t)],
      trash: s.trash.filter((t) => t.trashBatchId !== batchId),
    };
  });
  toast('Restored from Trash');
}

export function permanentlyDeleteTrashBatch(batchId) {
  commit((s) => ({ ...s, trash: (s.trash || []).filter((t) => t.trashBatchId !== batchId) }));
}

export function confirmPermanentlyDeleteTrashBatch(batchId, title) {
  askConfirm({
    title: `Delete “${truncate(title, 32)}” permanently?`,
    body: 'This cannot be undone.',
    confirmLabel: 'Delete permanently',
    onConfirm: () => permanentlyDeleteTrashBatch(batchId),
  });
}

export function confirmEmptyTrash() {
  const count = data.get().trash?.length || 0;
  if (!count) return;
  askConfirm({
    title: 'Empty Trash?',
    body: `This will permanently delete ${count} task${count === 1 ? '' : 's'}. This cannot be undone.`,
    confirmLabel: 'Empty Trash',
    onConfirm: () => commit((s) => ({ ...s, trash: [] })),
  });
}

/** Moves many tasks to Trash, including anything nested under them. Undoable. */
export function deleteTasks(ids) {
  const { removed, batchId } = moveTasksToTrash(ids);
  if (!removed.length) return;
  toast(
    `Moved ${removed.length} task${removed.length === 1 ? '' : 's'} to Trash`,
    { label: 'Undo · Ctrl+Z', run: () => restoreTrashBatch(batchId) },
    8000,
  );
}

/** Asks "Are you sure?" before clearing a page, since it removes many tasks in one go. */
export function confirmDeleteTasks(ids, scope, note = '') {
  const n = ids.length;
  if (!n) {
    toast(`There are no tasks in ${scope} to delete`);
    return;
  }
  askConfirm({
    title: 'Are you sure?',
    body: `This will delete all ${n} task${n === 1 ? '' : 's'} in ${scope}.${note} You can undo with Ctrl+Z or from Trash.`,
    confirmLabel: n === 1 ? 'Delete task' : `Delete all ${n}`,
    onConfirm: () => deleteTasks(ids),
  });
}

/** Every task in a project, including completed ones (the project itself stays). */
export function confirmDeleteAll(project) {
  const ids = data.get().tasks.filter((t) => t.projectId === project.id).map((t) => t.id);
  confirmDeleteTasks(ids, `“${project.name}”`, ' The project itself stays.');
}

export function deleteProject(id) {
  const before = data.get();
  const project = before.projects.find((p) => p.id === id);
  if (!project) return;
  const taskIds = new Set(before.tasks.filter((t) => t.projectId === id).map((t) => t.id));
  commit((s) => ({
    ...s,
    projects: s.projects.filter((p) => p.id !== id),
    tasks: s.tasks.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)),
  }));
  if (ui.get().view === `project:${id}`) navigate('inbox');
  toast(`Deleted project “${truncate(project.name, 32)}”`, {
    label: 'Undo · Ctrl+Z',
    run: () => {
      commit((s) => ({
        ...s,
        projects: s.projects.some((p) => p.id === project.id) ? s.projects : [...s.projects, project],
        tasks: s.tasks.map((t) => (taskIds.has(t.id) ? { ...t, projectId: project.id } : t)),
      }));
      toast(`Restored project “${truncate(project.name, 32)}”`);
    },
  }, 8000);
}

export function placeProject(id, prevId, nextId) {
  commit((s) => {
    const orderOf = (pid) => s.projects.find((p) => p.id === pid)?.order;
    const a = prevId ? orderOf(prevId) : null;
    const b = nextId ? orderOf(nextId) : null;
    let order;
    if (a == null && b == null) return s;
    if (a == null) order = b - 1;
    else if (b == null) order = a + 1;
    else order = (a + b) / 2;
    return { ...s, projects: s.projects.map((p) => (p.id === id ? { ...p, order } : p)) };
  });
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

export function setPref(key, value) {
  commit((s) => ({ ...s, prefs: { ...s.prefs, [key]: value } }));
}

export function setProjectMode(projectId, mode) {
  const { projectModes } = data.get().prefs;
  setPref('projectModes', { ...projectModes, [projectId]: mode });
}

export function setSectionMode(viewId, mode) {
  const { sectionModes } = data.get().prefs;
  setPref('sectionModes', { ...sectionModes, [viewId]: mode });
}

export function setChildTasksOpen(taskId, open) {
  const { childTasksOpen } = data.get().prefs;
  setPref('childTasksOpen', { ...(childTasksOpen || {}), [taskId]: open });
}

export function toggleCollapsed(key) {
  const { collapsed } = data.get().prefs;
  const next = { ...collapsed };
  if (next[key]) delete next[key];
  else next[key] = true;
  setPref('collapsed', next);
}

// ---------------------------------------------------------------------------
// UI actions
// ---------------------------------------------------------------------------

export function navigate(view) {
  clearPreviewTimers();
  patchUI({
    view, selectedId: null, panelOpen: false, menu: null, preview: null,
    statsFilter: view === 'completed' ? 'done' : 'todo', mobileNavOpen: false,
  });
  setPref('view', view);
}

/** The sidebar-as-drawer shown on narrow screens, independent of the desktop sidebarCollapsed pref. */
export const openMobileNav = () => patchUI({ mobileNavOpen: true });
export const closeMobileNav = () => patchUI({ mobileNavOpen: false });

/** Narrows the current page to either Todo or Done. */
export function setStatsFilter(kind) {
  ui.set((u) => ({ ...u, statsFilter: kind }));
}

export function selectTask(id, open = true) {
  if (open) clearPreviewTimers();
  patchUI({ selectedId: id, panelOpen: open ? true : ui.get().panelOpen, ...(open ? { preview: null } : {}) });
}

// Task overview popup ---------------------------------------------------------
// Hovering a task shows a read-only overview beside it; clicking pins it open.
// The popup's Edit button opens the full editor (the side panel).

let showTimer = null;
let hideTimer = null;

export function clearPreviewTimers() {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  showTimer = null;
  hideTimer = null;
}

const previewBlocked = (u) => u.panelOpen || u.draggingId || u.menu || u.search || u.help || u.confirm || u.popup;

export function hoverTask(id) {
  clearTimeout(hideTimer);
  const u = ui.get();
  if (previewBlocked(u) || u.preview?.pinned || u.preview?.id === id) return;
  clearTimeout(showTimer);
  // Once one preview is showing, moving to the next task feels instant.
  showTimer = setTimeout(() => {
    if (!previewBlocked(ui.get()) && !ui.get().preview?.pinned) patchUI({ preview: { id, pinned: false } });
  }, u.preview ? 120 : 380);
}

export function leaveTask() {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  if (!ui.get().preview || ui.get().preview.pinned) return;
  hideTimer = setTimeout(hidePreview, 200);
}

export function keepPreview() {
  clearTimeout(hideTimer);
}

export function hidePreview() {
  clearPreviewTimers();
  ui.set((u) => (u.preview ? { ...u, preview: null } : u));
}

export function pinPreview(id) {
  clearPreviewTimers();
  patchUI({ selectedId: id, preview: { id, pinned: true } });
}

/** Clicking a task: switch the editor if it's open, otherwise pin the overview. */
export function activateTask(id) {
  if (ui.get().panelOpen) selectTask(id, true);
  else pinPreview(id);
}

export const closePanel = () => patchUI({ panelOpen: false });
export const focusTaskTitle = (id) => {
  clearPreviewTimers();
  patchUI({ selectedId: id, panelOpen: true, preview: null, focusTitle: { id, at: Date.now() } });
};

// Every kind of creation (task, project, subtask) happens in one popup.
function openPopup(popup) {
  clearPreviewTimers();
  patchUI({ popup: { nonce: Date.now(), ...popup }, search: false, help: false, menu: null, preview: null });
}
export const openNewTask = (defaults = {}) => openPopup({ kind: 'task', defaults });
export const openNewProject = () => openPopup({ kind: 'project' });
export const closePopup = () => patchUI({ popup: null });

export const openSearch = () => patchUI({ search: true, popup: null, help: false, menu: null });
export const closeSearch = () => patchUI({ search: false });
export const setHelp = (help) => patchUI({ help, menu: null });

export const openMenu = (menu) => {
  clearPreviewTimers();
  patchUI({ menu: { key: Date.now(), ...menu }, preview: null });
};
export const closeMenu = () => patchUI({ menu: null });

export const askConfirm = (confirm) => patchUI({ confirm });
export const closeConfirm = () => patchUI({ confirm: null });

export const setEditingProject = (id) => patchUI({ editingProjectId: id });

/** Jump to the view a task lives in, then select it. */
export function revealTask(id) {
  const task = findTask(id);
  if (!task) return;
  const view = task.projectId ? `project:${task.projectId}` : task.status === 'done' ? 'completed' : 'inbox';
  if (task.projectId) {
    const key = `${view}:done`;
    if (task.status === 'done' && data.get().prefs.collapsed[key]) toggleCollapsed(key);
  }
  navigate(view);
  patchUI({ selectedId: id, panelOpen: true });
}

// Toasts ---------------------------------------------------------------------

let lastUndo = null;

export function toast(message, action, ms = 4500) {
  const id = uid();
  ui.set((u) => ({ ...u, toasts: [...u.toasts.slice(-2), { id, message, action }] }));
  if (action?.label?.startsWith('Undo')) lastUndo = { id, run: action.run };
  setTimeout(() => dismissToast(id), ms);
}

export function dismissToast(id) {
  ui.set((u) => ({ ...u, toasts: u.toasts.filter((t) => t.id !== id) }));
}

export function runToastAction(t) {
  t.action?.run();
  if (lastUndo?.id === t.id) lastUndo = null;
  ui.set((u) => ({ ...u, toasts: u.toasts.filter((x) => x.id !== t.id) }));
}

export function undoLast() {
  if (!lastUndo) return false;
  const { id, run } = lastUndo;
  lastUndo = null;
  run();
  ui.set((u) => ({ ...u, toasts: u.toasts.filter((x) => x.id !== id) }));
  return true;
}

function truncate(s, n) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
