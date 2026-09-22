import { addDays, completedHeading, diffDays, longDate, toKey, upcomingHeading } from './dates';
import { plural } from './util';

const byOrder = (a, b) => a.order - b.order;
const byCompletedDesc = (a, b) => (b.completedAt || 0) - (a.completedAt || 0);

export const inToday = (t, today) => t.addedToToday || (!!t.dueDate && t.dueDate <= today);

export const NAV_VIEWS = ['inbox', 'today', 'upcoming', 'all', 'completed'];

/** Three status columns for Board view, built from any flat task list. */
function statusBoardGroups(list, statusOf, addDefaults) {
  const pick = (s) => list.filter((t) => statusOf(t) === s);
  return [
    { id: 'todo', statusId: 'todo', title: 'Todo', tasks: pick('todo').sort(byOrder) },
    { id: 'in_progress', statusId: 'in_progress', title: 'In Progress', tasks: pick('in_progress').sort(byOrder) },
    { id: 'done', statusId: 'done', title: 'Done', tasks: pick('done').sort(byCompletedDesc) },
  ].map((g) => ({
    ...g,
    collapsible: false,
    sortable: addDefaults ? g.statusId !== 'done' : false,
    patch: addDefaults ? () => ({ status: g.statusId }) : null,
    add: addDefaults && g.statusId !== 'done' ? { defaults: { ...addDefaults, status: g.statusId } } : null,
  }));
}

/**
 * How "done" a single task is, from 0 to 1: a completed task is 1, an open
 * task with a checklist is however much of that checklist is checked off, and
 * a bare open task (no subtasks) hasn't started.
 */
function taskProgress(t, statusOf) {
  if (statusOf(t) === 'done') return 1;
  if (t.subtasks?.length) return t.subtasks.filter((s) => s.done).length / t.subtasks.length;
  return 0;
}

/** Todo / in-progress / done breakdown plus a checklist-weighted average for a section's overview panel. */
function progressStats(scope, statusOf) {
  const total = scope.length;
  return {
    kind: 'progress',
    todo: scope.filter((t) => statusOf(t) === 'todo').length,
    inProgress: scope.filter((t) => statusOf(t) === 'in_progress').length,
    done: scope.filter((t) => statusOf(t) === 'done').length,
    total,
    avgProgress: total ? scope.reduce((sum, t) => sum + taskProgress(t, statusOf), 0) / total : 0,
  };
}

/**
 * Turns the raw task list into what a view renders: titled groups of tasks,
 * each knowing how a dropped task should change and where new tasks go.
 */
export function buildView(viewId, { tasks, projects, today, lingering, prefs }) {
  // A task checked a moment ago stays in its old place until the linger ends.
  const isOpen = (t) => t.status !== 'done' || t.id in lingering;
  const statusOf = (t) => (t.id in lingering ? lingering[t.id] : t.status);
  const collapsedKey = (gid) => `${viewId}:${gid}`;
  const sectionMode = prefs.sectionModes?.[viewId] === 'board' ? 'board' : 'list';

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

  const single = (list, patch) => {
    model.groups = [{ id: 'main', title: null, tasks: list, sortable: true, patch }];
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
      model.stats = progressStats(scope, statusOf);
      if (sectionMode === 'board') {
        model.groups = statusBoardGroups(list, statusOf, { projectId: null });
        model.total = list.length;
      } else {
        single(list, () => ({ projectId: null }));
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
      model.stats = progressStats(scope, statusOf);
      if (sectionMode === 'board') {
        model.groups = statusBoardGroups(list, statusOf, { addedToToday: true });
        model.total = list.length;
      } else {
        single(list, () => ({ addedToToday: true }));
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
      model.stats = progressStats(scope, statusOf);
      if (sectionMode === 'board') {
        model.show.due = true;
        model.groups = statusBoardGroups(list, statusOf, { dueDate: addDays(today, 1) });
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
      model.stats = progressStats(tasks, statusOf);
      if (sectionMode === 'board') {
        model.show.project = true;
        model.groups = statusBoardGroups(open, statusOf, {});
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
      const openCount = own.filter((t) => t.status !== 'done').length;
      const doneCount = own.length - openCount;

      model.title = project.name;
      model.project = project;
      model.mode = mode;
      model.subtitle = own.length ? `${plural(openCount, 'open task')} · ${doneCount} done` : 'No tasks yet';
      model.emptyText = 'Start with one small task. Priority, dates and notes are all optional.';
      model.newTaskDefaults = { projectId: pid };
      model.deleteScope = `“${project.name}”`;
      model.deleteNote = ' The project itself stays.';
      model.show.project = false;
      model.stats = progressStats(own, statusOf);
      model.groups = [
        { id: 'todo', statusId: 'todo', title: 'Todo', tasks: pick('todo').sort(byOrder), sortable: true },
        { id: 'in_progress', statusId: 'in_progress', title: 'In Progress', tasks: pick('in_progress').sort(byOrder), sortable: true },
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
