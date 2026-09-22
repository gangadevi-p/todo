import { addDays, completedHeading, diffDays, longDate, toKey, upcomingHeading } from './dates';
import { avgCompletionMs, formatDuration, remainingWork } from './eta';
import { plural } from './util';

const byOrder = (a, b) => a.order - b.order;
const byCompletedDesc = (a, b) => (b.completedAt || 0) - (a.completedAt || 0);

export const inToday = (t, today) => t.addedToToday || (!!t.dueDate && t.dueDate <= today);

export const NAV_VIEWS = ['inbox', 'today', 'upcoming', 'all', 'completed'];

/** Status columns for Board view, built from any flat task list. */
function statusBoardGroups(list, statusOf, addDefaults) {
  const pick = (s) => list.filter((t) => statusOf(t) === s);
  return [
    { id: 'todo', statusId: 'todo', title: 'Todo', tasks: pick('todo').sort(byOrder) },
    { id: 'done', statusId: 'done', title: 'Done', tasks: pick('done').sort(byCompletedDesc) },
  ].map((g) => ({
    ...g,
    collapsible: false,
    sortable: addDefaults ? g.statusId !== 'done' : false,
    patch: addDefaults ? () => ({ status: g.statusId }) : null,
    add: addDefaults && g.statusId !== 'done' ? { defaults: { ...addDefaults, status: g.statusId } } : null,
  }));
}

/** The persistent "Done" section appended to a list-mode page: dropping a task here marks it done. */
function doneGroup(list) {
  return {
    id: 'done',
    statusId: 'done',
    title: 'Done',
    tasks: list,
    sortable: false,
    patch: () => ({ status: 'done' }),
    add: null,
  };
}

/**
 * How "done" a single task is, from 0 to 1: a completed task is 1, an open
 * task with a checklist is however much of that checklist is checked off, and
 * a bare open task (no subtasks) hasn't started.
 */
export function taskProgress(t, statusOf) {
  if (statusOf(t) === 'done') return 1;
  if (t.subtasks?.length) return t.subtasks.filter((s) => s.done).length / t.subtasks.length;
  return 0;
}

/**
 * Todo / done breakdown plus a checklist-weighted average for a
 * section's overview panel, and an ETA for the work still open in it: this
 * section's own past pace (created → completed) when it has enough history,
 * otherwise the app-wide pace.
 */
function progressStats(scope, statusOf, globalAvgMs) {
  const total = scope.length;
  const sectionAvgMs = avgCompletionMs(scope);
  const avgMs = sectionAvgMs ?? globalAvgMs;
  const remaining = remainingWork(scope.filter((t) => statusOf(t) !== 'done'), (t) => taskProgress(t, statusOf));
  return {
    kind: 'progress',
    todo: scope.filter((t) => statusOf(t) === 'todo').length,
    done: scope.filter((t) => statusOf(t) === 'done').length,
    total,
    avgProgress: total ? scope.reduce((sum, t) => sum + taskProgress(t, statusOf), 0) / total : 0,
    eta: avgMs != null && remaining > 0 ? formatDuration(avgMs * remaining) : null,
    etaBasis: avgMs == null ? null : sectionAvgMs != null ? 'section' : 'global',
  };
}

/**
 * Turns the raw task list into what a view renders: titled groups of tasks,
 * each knowing how a dropped task should change and where new tasks go.
 */
export function buildView(viewId, { tasks: allTasks, projects, today, lingering, prefs }) {
  // Sub-tasks (tasks nested under another task via parentId) only ever show
  // indented under their parent, wherever it appears — never as their own
  // top-level row, the same way a checklist item doesn't get one either.
  const tasks = allTasks.filter((t) => !t.parentId);
  // A task checked a moment ago stays in its old place until the linger ends.
  const isOpen = (t) => t.status !== 'done' || t.id in lingering;
  const statusOf = (t) => (t.id in lingering ? lingering[t.id] : t.status);
  const collapsedKey = (gid) => `${viewId}:${gid}`;
  const sectionMode = prefs.sectionModes?.[viewId] === 'board' ? 'board' : 'list';
  const globalAvgMs = avgCompletionMs(tasks);

  const model = {
    id: viewId,
    kind: viewId.startsWith('project:') ? 'project' : viewId,
    title: '',
    subtitle: '',
    project: null,
    mode: 'list',
    groups: [],
    newTaskDefaults: {},
    deleteScope: '',
    deleteNote: '',
    taskIds: [],
    show: { project: true, due: true, today: true },
    emptyText: '',
    total: 0,
    stats: null,
  };

  // A flat, chrome-less list of open tasks, plus a proper "Done" section
  // underneath so a checked-off task stays visible (struck through) instead
  // of vanishing off the page.
  const mainAndDone = (list, doneList, patch) => {
    model.groups = [{ id: 'main', title: null, tasks: list, sortable: true, patch }, doneGroup(doneList)];
    model.total = list.length;
  };

  switch (model.kind) {
    case 'inbox': {
      const scope = tasks.filter((t) => !t.projectId);
      const list = scope.filter(isOpen).sort(byOrder);
      model.title = 'Inbox';
      model.subtitle = list.length ? plural(list.length, 'task') : 'Quick captures without a project';
      model.show.project = false;
      model.emptyText = 'Inbox is clear. Capture anything with the quick-add shortcut and organise it later.';
      model.deleteScope = 'Inbox';
      model.mode = sectionMode;
      model.stats = progressStats(scope, statusOf, globalAvgMs);
      if (sectionMode === 'board') {
        model.groups = statusBoardGroups(scope, statusOf, { projectId: null });
        model.total = list.length;
      } else {
        mainAndDone(list, scope.filter((t) => statusOf(t) === 'done').sort(byCompletedDesc), () => ({ projectId: null }));
      }
      break;
    }
    case 'today': {
      const scope = tasks.filter((t) => inToday(t, today));
      const list = scope.filter(isOpen).sort(byOrder);
      model.title = 'Today';
      model.subtitle = longDate(today);
      model.show.today = false;
      model.emptyText = 'Nothing planned yet. Drag tasks here, press T on a task, or choose New Task.';
      model.newTaskDefaults = { addedToToday: true };
      model.deleteScope = 'Today';
      model.mode = sectionMode;
      model.stats = progressStats(scope, statusOf, globalAvgMs);
      if (sectionMode === 'board') {
        model.groups = statusBoardGroups(scope, statusOf, { addedToToday: true });
        model.total = list.length;
      } else {
        mainAndDone(list, scope.filter((t) => statusOf(t) === 'done').sort(byCompletedDesc), () => ({ addedToToday: true }));
      }
      break;
    }
    case 'upcoming': {
      const scope = tasks.filter((t) => t.dueDate && t.dueDate > today);
      const list = scope.filter(isOpen);
      model.title = 'Upcoming';
      model.subtitle = list.length ? plural(list.length, 'scheduled task') : 'Tasks with a future due date';
      model.show.due = false;
      model.emptyText = 'Nothing scheduled. Give a task a due date and it will show up here, grouped by day.';
      model.newTaskDefaults = { dueDate: addDays(today, 1) };
      model.deleteScope = 'Upcoming';
      model.mode = sectionMode;
      model.stats = progressStats(scope, statusOf, globalAvgMs);
      if (sectionMode === 'board') {
        model.show.due = true;
        model.groups = statusBoardGroups(scope, statusOf, { dueDate: addDays(today, 1) });
        model.total = list.length;
      } else {
        const dates = [...new Set(list.map((t) => t.dueDate))].sort();
        model.groups = dates.map((date) => {
          const h = upcomingHeading(date, today);
          return {
            id: date,
            title: h.title,
            sub: h.sub,
            tasks: list.filter((t) => t.dueDate === date).sort(byOrder),
            sortable: true,
            patch: () => ({ dueDate: date }),
            add: { defaults: { dueDate: date } },
          };
        });
        model.groups.push(doneGroup(scope.filter((t) => statusOf(t) === 'done').sort(byCompletedDesc)));
        model.total = list.length;
      }
      break;
    }
    case 'all': {
      const open = tasks.filter(isOpen);
      model.title = 'All Tasks';
      model.subtitle = plural(open.length, 'open task');
      model.show.project = false;
      model.emptyText = 'No open tasks. Enjoy the quiet.';
      model.deleteScope = 'All Tasks';
      model.mode = sectionMode;
      model.stats = progressStats(tasks, statusOf, globalAvgMs);
      if (sectionMode === 'board') {
        model.show.project = true;
        model.groups = statusBoardGroups(tasks, statusOf, {});
        model.total = open.length;
      } else {
        const buckets = [{ id: 'inbox', title: 'Inbox', projectId: null, icon: 'inbox' }].concat(
          [...projects].sort(byOrder).map((p) => ({ id: p.id, title: p.name, projectId: p.id, color: p.color })));
        model.groups = buckets
          .map((b) => ({
            id: b.id,
            title: b.title,
            color: b.color,
            icon: b.icon,
            tasks: open.filter((t) => (t.projectId || null) === b.projectId).sort(byOrder),
            sortable: true,
            collapsible: true,
            patch: () => ({ projectId: b.projectId }),
            add: { defaults: { projectId: b.projectId } },
          }))
          .filter((g) => g.tasks.length);
        model.groups.push(doneGroup(tasks.filter((t) => statusOf(t) === 'done').sort(byCompletedDesc)));
        model.total = open.length;
      }
      break;
    }
    case 'completed': {
      const list = tasks.filter((t) => t.status === 'done').sort(byCompletedDesc);
      model.title = 'Completed';
      model.subtitle = list.length ? plural(list.length, 'completed task') : 'Finished work lands here';
      model.show.due = false;
      model.show.today = false;
      model.emptyText = 'Completed tasks will appear here. Check something off to get started.';
      model.deleteScope = 'Completed';
      model.mode = sectionMode;
      model.stats = {
        kind: 'completed',
        total: list.length,
        today: list.filter((t) => diffDays(today, toKey(new Date(t.completedAt || t.createdAt))) === 0).length,
        week: list.filter((t) => {
          const n = diffDays(today, toKey(new Date(t.completedAt || t.createdAt)));
          return n >= 0 && n < 7;
        }).length,
      };
      if (sectionMode === 'board') {
        model.groups = statusBoardGroups(list, statusOf, null);
        model.total = list.length;
      } else {
        const days = [];
        const byDay = new Map();
        for (const t of list) {
          const key = toKey(new Date(t.completedAt || t.createdAt));
          if (!byDay.has(key)) { byDay.set(key, []); days.push(key); }
          byDay.get(key).push(t);
        }
        model.groups = days.map((key) => {
          const h = completedHeading(key, today);
          return { id: key, title: h.title, sub: h.sub, tasks: byDay.get(key), sortable: false, patch: null, locked: true };
        });
        model.total = list.length;
      }
      break;
    }
    case 'project': {
      const pid = viewId.slice('project:'.length);
      const project = projects.find((p) => p.id === pid);
      if (!project) return buildView('inbox', { tasks, projects, today, lingering, prefs });
      const own = tasks.filter((t) => t.projectId === pid);
      const mode = prefs.projectModes?.[pid] === 'board' ? 'board' : 'list';
      const pick = (s) => own.filter((t) => statusOf(t) === s);

      model.title = project.name;
      model.project = project;
      model.mode = mode;
      // The stats panel right below already breaks down open vs. done, so the
      // headline doesn't need its own "X open · Y done" summary too.
      model.subtitle = '';
      model.emptyText = 'Start with one small task. Priority, dates and notes are all optional.';
      model.newTaskDefaults = { projectId: pid };
      model.deleteScope = `“${project.name}”`;
      model.deleteNote = ' The project itself stays.';
      model.show.project = false;
      model.stats = progressStats(own, statusOf, globalAvgMs);
      model.groups = [
        // In list mode the page title already reads "<project name>", so the
        // main task group needs no "Todo" label of its own — only Board,
        // whose columns have no such heading above them, still shows one.
        { id: 'todo', statusId: 'todo', title: mode === 'list' ? null : 'Todo', tasks: pick('todo').sort(byOrder), sortable: true },
        { id: 'done', statusId: 'done', title: 'Done', tasks: pick('done').sort(byCompletedDesc), sortable: false },
      ].map((g) => ({
        ...g,
        collapsible: mode === 'list',
        patch: () => ({ status: g.statusId }),
        add: g.statusId === 'done' ? null : { defaults: { projectId: pid, status: g.statusId } },
      }));
      model.total = own.length;
      break;
    }
    default:
      return buildView('today', { tasks, projects, today, lingering, prefs });
  }

  for (const g of model.groups) {
    g.key = collapsedKey(g.id);
    g.collapsed = Boolean(g.collapsible !== false && g.title && prefs.collapsed?.[g.key]);
  }
  model.flat = model.groups.flatMap((g) => (g.collapsed ? [] : g.tasks));
  // Everything listed on the page: what "Delete all" removes.
  model.taskIds = model.groups.flatMap((g) => g.tasks.map((t) => t.id));
  return model;
}
