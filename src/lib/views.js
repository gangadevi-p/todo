import { addDays, diffDays, longDate, upcomingHeading } from './dates';
import { plural } from './util';
import { flattenChecklist } from './checklist';

const byOrder = (a, b) => a.order - b.order;
const byCompletedDesc = (a, b) => (b.completedAt || 0) - (a.completedAt || 0);

export const inToday = (t, today) => t.addedToToday || (!!t.dueDate && t.dueDate <= today);

export const NAV_VIEWS = ['today', 'upcoming', 'all', 'completed', 'trash', 'qa'];

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
function completedChecklistParents(scope, statusOf) {
  return scope.filter((task) =>
    statusOf(task) !== 'done' && flattenChecklist(task.subtasks).some((item) => item.done));
}

function doneGroup(list, checklistParents = []) {
  return {
    id: 'done',
    statusId: 'done',
    title: 'Done',
    tasks: list,
    completedChecklistParents: checklistParents,
    showCompleted: true,
    collapsible: false,
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
  const checklist = flattenChecklist(t.subtasks);
  if (checklist.length) return checklist.filter((s) => s.done).length / checklist.length;
  return 0;
}

/**
 * Todo / done breakdown, checklist-weighted completion, and the nearest due
 * date for a section overview panel.
 */
function progressStats(top, statusOf, today, allTasks = []) {
  // A major task is real work itself, and so is everything inside it: its
  // boxes and every sub-task (checklist item, nested ones too). Count them all.
  const under = (id) => allTasks.filter((t) => t.parentId === id).flatMap((c) => [c, ...under(c.id)]);
  const scope = [...top, ...top.flatMap((t) => under(t.id))];
  const checklist = scope.flatMap((t) => flattenChecklist(t.subtasks));
  const total = scope.length + checklist.length;
  // The overview is a summary of both major tasks and nested tasks, so its
  // priority marker represents their average rather than one due task.
  const priorityValues = scope.flatMap((t) => ({ low: 1, medium: 2, high: 3 }[t.priority] || []));
  const averagePriority = priorityValues.length
    ? ['low', 'medium', 'high'][Math.round(priorityValues.reduce((sum, value) => sum + value, 0) / priorityValues.length) - 1]
    : null;
  const nearestDue = scope
    .filter((t) => statusOf(t) !== 'done' && t.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const days = nearestDue ? diffDays(nearestDue.dueDate, today) : null;
  const label = days == null ? null
    : days < 0 ? `${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} overdue`
      : days === 0 ? 'Last day today'
        : days === 1 ? 'Last day tomorrow'
          : `Last day in ${days} days`;
  return {
    kind: 'progress',
    todo: scope.filter((t) => statusOf(t) === 'todo').length + checklist.filter((st) => !st.done).length,
    done: scope.filter((t) => statusOf(t) === 'done').length + checklist.filter((st) => st.done).length,
    total,
    avgProgress: total
      ? (scope.filter((t) => statusOf(t) === 'done').length + checklist.filter((st) => st.done).length) / total
      : 0,
    deadline: nearestDue ? { date: nearestDue.dueDate, days, label, priority: averagePriority, taskId: nearestDue.id } : null,
  };
}

/**
 * A project or section with several major tasks is easier to scan as a set of
 * headings than as two status buckets. Each heading becomes a board column;
 * its nested tasks and checklist stay inside that column.
 */
function headingBoardGroups(headings, allTasks, addDefaults) {
  return headings.map((heading) => {
    const children = allTasks.filter((t) => t.parentId === heading.id).sort(byOrder);
    const checklistCount = flattenChecklist(heading.subtasks).length;
    return {
      id: `heading:${heading.id}`,
      heading: true,
      headingTask: heading,
      title: heading.title || 'Untitled',
      tasks: children,
      count: children.length + checklistCount,
      checklistTask: checklistCount ? heading : null,
      collapsible: false,
      sortable: true,
      patch: () => ({ ...addDefaults, parentId: heading.id }),
      add: { defaults: { ...addDefaults, parentId: heading.id } },
    };
  });
}

/**
 * A project with several top-level tasks is always a major-task board. That
 * way every major card is visible, including the ones that do not yet have
 * a child task or checklist of their own.
 */
function majorHeadings(headings, allTasks) {
  if (headings.length > 1) return headings;
  const hasStructuredMajor = headings.some((heading) =>
    heading.isHeading || flattenChecklist(heading.subtasks).length || allTasks.some((t) => t.parentId === heading.id));
  return hasStructuredMajor ? headings : [];
}

/** The major task a project page is showing: the picked chip, else the first one (null when the page has no chips). */
export function activeMajorId(model, picked) {
  const majors = model.majorTasks || [];
  return majors.some((t) => t.id === picked) ? picked : majors[0]?.id ?? null;
}

const FILTER_EMPTY_TEXT = {
  todo: 'Nothing left to do here — everything is done.',
  done: 'You have done nothing till now. Start working and finish them off.',
};

/** Narrows a view's groups down to just the tasks matching the overview bar's active tab. */
export function applyStatsFilter(model, filter) {
  const groups = model.groups.map((g) => {
    const tasks = g.statusId && g.statusId !== filter ? [] : g.tasks.filter((t) => t.status === filter);
    // In a major-task board, the group title is also a real task. Keep a
    // heading-only card visible when its own status matches the active tab.
    const headingVisible = Boolean(g.headingTask && g.headingTask.status === filter);
    const canShowChecklistParents = filter === 'done' && (!g.statusId || g.statusId === 'done');
    const parentCandidates = [
      ...(g.completedChecklistParents || []),
      ...(canShowChecklistParents ? g.tasks.filter((task) =>
        task.status !== 'done' && flattenChecklist(task.subtasks).some((item) => item.done)) : []),
    ];
    const completedChecklistParents = canShowChecklistParents
      ? [...new Map(parentCandidates.map((task) => [task.id, task])).values()]
      : [];
    const checklistTask = g.checklistTask && flattenChecklist(g.checklistTask.subtasks)
      .some((item) => filter === 'done' ? item.done : !item.done)
      ? g.checklistTask
      : null;
    const hasVisibleWork = headingVisible || tasks.length > 0 || completedChecklistParents.length > 0 || Boolean(checklistTask);
    // A group with nothing left after filtering has no business still showing
    // an "add" drop zone or a board column's empty placeholder.
    return {
      ...g,
      tasks,
      headingVisible,
      completedChecklistParents,
      checklistTask,
      checklistStatus: filter,
      add: filter === 'todo' && hasVisibleWork ? g.add : null,
      filteredEmpty: !hasVisibleWork,
    };
  });
  const taskIds = groups.flatMap((g) => [
    ...(g.headingVisible ? [g.headingTask.id] : []),
    ...g.tasks.map((t) => t.id),
  ]);
  const total = groups.reduce((count, g) => count + (g.headingVisible ? 1 : 0) + g.tasks.length + (g.completedChecklistParents || []).length, 0);
  return { ...model, groups, taskIds, total, emptyText: total === 0 && model.stats && model.stats.total > 0 ? FILTER_EMPTY_TEXT[filter] : model.emptyText };
}

/**
 * The major tasks that still have something to show under the picked todo /
 * done tab. A finished major task with nothing left to do is listed under
 * "done" only, so struck-off chips don't sit among the active ones.
 */
export function shownMajors(model, statsFilter) {
  const majors = model.majorTasks || [];
  if (!model.majorBoard || !statsFilter) return majors;
  const shown = new Set(applyStatsFilter(model, statsFilter).groups
    .filter((g) => g.headingTask && !g.filteredEmpty)
    .map((g) => g.headingTask.id));
  return majors.filter((t) => shown.has(t.id));
}

/**
 * Turns the raw task list into what a view renders: titled groups of tasks,
 * each knowing how a dropped task should change and where new tasks go.
 */
export function buildView(viewId, { tasks: allTasks, projects, trash = [], qa = [], today, lingering, prefs }) {
  // Sub-tasks (tasks nested under another task via parentId) only ever show
  // indented under their parent, wherever it appears — never as their own
  // top-level row, the same way a checklist item doesn't get one either.
  const tasks = allTasks.filter((t) => !t.parentId);
  // A task checked a moment ago stays in its old place until the linger ends.
  const isOpen = (t) => t.status !== 'done' || t.id in lingering;
  const statusOf = (t) => (t.id in lingering ? lingering[t.id] : t.status);
  const collapsedKey = (gid) => `${viewId}:${gid}`;
  const sectionMode = prefs.sectionModes?.[viewId] === 'list' ? 'list' : 'board';

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
    majorTasks: [],
    // Board pages work in major tasks: chips, then boxes, then sub-tasks.
    majorBoard: false,
    taskIdsOverride: null,
  };

  // A flat, chrome-less list of open tasks, plus a proper "Done" section
  // underneath so a checked-off task stays visible (struck through) instead
  // of vanishing off the page.
  const mainAndDone = (list, doneList, patch, scope) => {
    model.groups = [
      { id: 'main', title: null, tasks: list, sortable: true, patch },
      doneGroup(doneList, completedChecklistParents(scope, statusOf)),
    ];
    model.total = list.length;
  };

  switch (model.kind) {
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
      model.stats = progressStats(scope, statusOf, today, allTasks);
      if (sectionMode === 'board') {
        const majors = [...scope].sort(byOrder);
        model.groups = headingBoardGroups(majors, allTasks, { addedToToday: true });
        model.taskIdsOverride = scope.map((t) => t.id);
        model.majorTasks = majors;
        model.majorBoard = true;
        model.total = list.length;
      } else {
        mainAndDone(list, scope.filter((t) => statusOf(t) === 'done').sort(byCompletedDesc), () => ({ addedToToday: true }), scope);
      }
      break;
    }
    case 'upcoming': {
      const scope = tasks.filter((t) => t.dueDate && t.dueDate > today);
      const list = scope.filter(isOpen);
      model.title = 'Upcoming';
      model.subtitle = list.length ? plural(list.length, 'scheduled task') : 'Tasks with a future last day';
      model.show.due = false;
      model.emptyText = 'Nothing scheduled. Give a task a last day and it will show up here, grouped by day.';
      model.newTaskDefaults = { dueDate: addDays(today, 1) };
      model.deleteScope = 'Upcoming';
      model.mode = sectionMode;
      model.stats = progressStats(scope, statusOf, today, allTasks);
      if (sectionMode === 'board') {
        model.show.due = true;
        const majors = [...scope].sort(byOrder);
        model.groups = headingBoardGroups(majors, allTasks, { dueDate: addDays(today, 1) });
        model.taskIdsOverride = scope.map((t) => t.id);
        model.majorTasks = majors;
        model.majorBoard = true;
        model.total = list.length;
      } else {
        const dates = [...new Set(list.map((t) => t.dueDate))].sort();
        model.groups = dates.map((date) => {
          const h = upcomingHeading(date, today);
          return {
            id: date,
            dateKey: date,
            title: h.title,
            sub: h.sub,
            tasks: list.filter((t) => t.dueDate === date).sort(byOrder),
            sortable: true,
            patch: () => ({ dueDate: date }),
            add: { defaults: { dueDate: date } },
          };
        });
        model.groups.push(doneGroup(
          scope.filter((t) => statusOf(t) === 'done').sort(byCompletedDesc),
          completedChecklistParents(scope, statusOf),
        ));
        model.total = list.length;
      }
      break;
    }
    case 'all': {
      const buckets = [{ id: 'inbox', title: 'No project', projectId: null, icon: 'inbox' }].concat(
        [...projects].sort(byOrder).map((p) => ({ id: p.id, title: p.name, projectId: p.id, color: p.color })));
      model.title = 'All Tasks';
      model.subtitle = plural(tasks.length, 'task');
      model.show.project = false;
      model.emptyText = 'No tasks yet. Add one to a project.';
      model.deleteScope = 'All Tasks';
      model.mode = sectionMode;
      model.stats = progressStats(tasks, statusOf, today, allTasks);
      // All Tasks is deliberately organised by project, never by completion
      // status. Empty projects stay visible so this view is a complete map of
      // the workspace and also provides a quick add point for every project.
      if (sectionMode === 'board') {
        // Every task of every project is a major task here, project by project.
        const rank = new Map([...projects].sort(byOrder).map((p, i) => [p.id, i + 1]));
        const majors = [...tasks].sort((a, b) => ((rank.get(a.projectId) || 0) - (rank.get(b.projectId) || 0)) || byOrder(a, b));
        model.groups = headingBoardGroups(majors, allTasks, {});
        model.taskIdsOverride = tasks.map((t) => t.id);
        model.majorTasks = majors;
        model.majorBoard = true;
      } else {
        model.groups = buckets.map((b) => ({
          id: b.id,
          title: b.title,
          color: b.color,
          icon: b.icon,
          tasks: tasks.filter((t) => (t.projectId || null) === b.projectId).sort(byOrder),
          sortable: true,
          collapsible: true,
          patch: () => ({ projectId: b.projectId }),
          add: { defaults: { projectId: b.projectId } },
        }));
      }
      model.total = tasks.length;
      break;
    }
    case 'completed': {
      const list = tasks.filter((t) => t.status === 'done').sort(byCompletedDesc);
      model.title = 'Completed';
      model.subtitle = list.length ? plural(list.length, 'completed task') : 'Finished work lands here';
      model.show.due = false;
      model.show.today = false;
      model.emptyText = "You didn't complete anything yet — start working, bro.";
      model.deleteScope = 'Completed';
      model.mode = sectionMode;
      model.stats = progressStats(list, statusOf, today, allTasks);
      // Every task here is already done, so there's no "Todo" side to show
      // and nothing to drop onto — just the full, flat list of what's finished.
      if (sectionMode === 'board') {
        model.groups = headingBoardGroups(list, allTasks, {});
        model.taskIdsOverride = list.map((t) => t.id);
        model.majorTasks = list;
        model.majorBoard = true;
      } else {
        model.groups = [{ id: 'main', title: null, tasks: list, showCompleted: true, sortable: false, patch: null }];
      }
      model.total = list.length;
      break;
    }
    case 'trash': {
      model.title = 'Trash';
      model.subtitle = trash.length ? `${plural(trash.length, 'task')} retained for 7 days` : 'Deleted tasks stay here for 7 days';
      model.emptyText = 'Trash is empty.';
      model.total = trash.length;
      model.mode = 'list';
      model.stats = null;
      break;
    }
    case 'qa': {
      const open = qa.filter((q) => !q.answer.trim()).length;
      model.title = 'Q&A';
      model.subtitle = !qa.length
        ? 'Questions and answers to keep for the design'
        : `${plural(qa.length, 'question')}${open ? ` · ${open} waiting for an answer` : ' · all answered'}`;
      model.mode = 'list';
      model.stats = null;
      break;
    }
    case 'project': {
      const pid = viewId.slice('project:'.length);
      const project = projects.find((p) => p.id === pid);
      if (!project) return buildView('today', { tasks, projects, today, lingering, prefs });
      const own = tasks.filter((t) => t.projectId === pid);
      const mode = prefs.projectModes?.[pid] === 'list' ? 'list' : 'board';
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
      model.stats = progressStats(own, statusOf, today, allTasks);
      const statusGroups = [
        // In list mode the page title already reads "<project name>", so the
        // main task group needs no "Todo" label of its own — only Board,
        // whose columns have no such heading above them, still shows one.
        { id: 'todo', statusId: 'todo', title: mode === 'list' ? null : 'Todo', tasks: pick('todo').sort(byOrder), sortable: true },
        { id: 'done', statusId: 'done', title: 'Done', tasks: pick('done').sort(byCompletedDesc), sortable: false },
      ].map((g) => ({
        ...g,
          collapsible: g.statusId === 'done' ? false : mode === 'list',
          showCompleted: g.statusId === 'done',
          completedChecklistParents: g.statusId === 'done' ? completedChecklistParents(own, statusOf) : [],
        patch: () => ({ status: g.statusId }),
        add: g.statusId === 'done' ? null : { defaults: { projectId: pid, status: g.statusId } },
      }));
      if (mode === 'board') {
        // Project → major task → box → sub-task → nested. On a project's
        // Board every top-level task is a major task: a chip under the
        // overview whose boxes (its child tasks) fill the page.
        const majors = [...own].sort(byOrder);
        model.groups = headingBoardGroups(majors, allTasks, { projectId: pid });
        model.taskIdsOverride = own.map((t) => t.id);
        model.majorTasks = majors;
        model.majorBoard = true;
      } else {
        model.groups = statusGroups;
      }
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
  model.taskIds = model.taskIdsOverride || model.groups.flatMap((g) => g.tasks.map((t) => t.id));
  return model;
}
