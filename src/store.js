import { useSyncExternalStore } from 'react';
import { seedData, defaultPrefs } from './seed';
import { uid, PROJECT_COLORS } from './lib/util';

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

export const data = createStore({ projects: [], tasks: [], prefs: defaultPrefs() });

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
});

export const useData = (sel) => useSyncExternalStore(data.subscribe, () => sel(data.get()));
export const useUI = (sel) => useSyncExternalStore(ui.subscribe, () => sel(ui.get()));

const patchUI = (patch) => ui.set((u) => ({ ...u, ...patch }));

// ---------------------------------------------------------------------------
// Persistence: Electron writes JSON to the user data folder; the plain
// browser build (used for development) falls back to localStorage.
// ---------------------------------------------------------------------------

const bridge = typeof window !== 'undefined' ? window.nudge : undefined;
const LS_KEY = 'nudge:data:v1';
let saveTimer = null;

function payload() {
  const { projects, tasks, prefs } = data.get();
  return { version: 1, savedAt: Date.now(), projects, tasks, prefs };
}

function writeNow(sync) {
  clearTimeout(saveTimer);
  saveTimer = null;
  const p = payload();
  if (bridge) sync ? bridge.saveSync(p) : bridge.save(p);
  else {
    try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch {}
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => writeNow(false), 250);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => { if (saveTimer) writeNow(true); });
}

function normalizeTask(t, i) {
  return {
    id: t.id || uid(),
    title: typeof t.title === 'string' ? t.title : 'Untitled',
    notes: t.notes || '',
    status: ['todo', 'in_progress', 'done'].includes(t.status) ? t.status : 'todo',
    priority: ['low', 'medium', 'high'].includes(t.priority) ? t.priority : null,
    projectId: t.projectId || null,
    dueDate: t.dueDate || null,
    addedToToday: Boolean(t.addedToToday),
    createdAt: t.createdAt || Date.now(),
    completedAt: t.completedAt || null,
    order: Number.isFinite(t.order) ? t.order : i + 1,
    subtasks: Array.isArray(t.subtasks)
      ? t.subtasks.map((s) => ({ id: s.id || uid(), title: s.title || '', done: Boolean(s.done) }))
      : [],
  };
}

function normalize(raw) {
  const projects = (raw.projects || []).map((p, i) => ({
    id: p.id || uid(),
    name: p.name || 'Untitled',
    createdAt: p.createdAt || Date.now(),
    order: Number.isFinite(p.order) ? p.order : i + 1,
    color: p.color || PROJECT_COLORS[i % PROJECT_COLORS.length],
  }));
  const ids = new Set(projects.map((p) => p.id));
  const tasks = (raw.tasks || []).map(normalizeTask).map((t) =>
    t.projectId && !ids.has(t.projectId) ? { ...t, projectId: null } : t);
  return { projects, tasks, prefs: { ...defaultPrefs(), ...(raw.prefs || {}) } };
}

export async function loadData() {
  let raw = null;
  let platform = 'web';
  if (bridge) {
    const res = await bridge.load();
    raw = res?.data ?? null;
    platform = res?.platform ?? 'web';
  } else {
    try { raw = JSON.parse(localStorage.getItem(LS_KEY)); } catch {}
  }
  const initial = raw && Array.isArray(raw.tasks) ? normalize(raw) : seedData();
  data.set(initial);
  if (!raw) scheduleSave();

  let view = initial.prefs.view || 'today';
  if (view.startsWith('project:') && !initial.projects.some((p) => `project:${p.id}` === view)) view = 'today';
  patchUI({ platform, view });
}

function commit(updater) {
  data.set(updater);
  scheduleSave();
}

// ---------------------------------------------------------------------------
// Task actions
// ---------------------------------------------------------------------------

const now = () => Date.now();
const maxOrder = (items) => items.reduce((m, x) => Math.max(m, x.order ?? 0), 0);
export const findTask = (id) => data.get().tasks.find((t) => t.id === id);

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
      dueDate: null,
      addedToToday: false,
      completedAt: null,
      subtasks: [],
      ...fields,
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
  commit((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
  const u = ui.get();
  if (u.selectedId === id) patchUI({ selectedId: null, panelOpen: false });
  hidePreview();
  toast(`Deleted “${truncate(task.title, 32)}”`, {
    label: 'Undo',
    run: () => commit((s) => ({ ...s, tasks: [...s.tasks, task] })),
  });
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
    subtasks: task.subtasks.map((st) => ({ ...st, id: uid() })),
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
    next.splice(index == null ? next.length : index, 0, { id, title, done: Boolean(extra.done) });
    return next;
  });
  return id;
}

export const updateSubtask = (taskId, subId, patch) =>
  patchSubtasks(taskId, (list) => list.map((st) => (st.id === subId ? { ...st, ...patch } : st)));

export const removeSubtask = (taskId, subId) =>
  patchSubtasks(taskId, (list) => list.filter((st) => st.id !== subId));

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

/** Removes many tasks at once. Undoable. */
export function deleteTasks(ids) {
  const set = new Set(ids);
  const removed = data.get().tasks.filter((t) => set.has(t.id));
  if (!removed.length) return;
  hidePreview();
  commit((s) => ({ ...s, tasks: s.tasks.filter((t) => !set.has(t.id)) }));
  const u = ui.get();
  if (removed.some((t) => t.id === u.selectedId)) patchUI({ selectedId: null, panelOpen: false });
  toast(
    `Deleted ${removed.length} task${removed.length === 1 ? '' : 's'}`,
    { label: 'Undo', run: () => commit((s) => ({ ...s, tasks: [...s.tasks, ...removed] })) },
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
    body: `This will delete all ${n} task${n === 1 ? '' : 's'} in ${scope}.${note} You can undo right after.`,
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
  commit((s) => ({
    ...s,
    projects: s.projects.filter((p) => p.id !== id),
    tasks: s.tasks.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)),
  }));
  if (ui.get().view === `project:${id}`) navigate('inbox');
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
  patchUI({ view, selectedId: null, panelOpen: false, menu: null, preview: null });
  setPref('view', view);
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
export const openNewSubtask = (taskId) => openPopup({ kind: 'subtask', taskId });
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
  if (action?.label === 'Undo') lastUndo = { id, run: action.run };
  setTimeout(() => dismissToast(id), ms);
}

export function dismissToast(id) {
  ui.set((u) => ({ ...u, toasts: u.toasts.filter((t) => t.id !== id) }));
  if (lastUndo?.id === id) lastUndo = null;
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
