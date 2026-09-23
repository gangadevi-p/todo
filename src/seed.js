import { addDays, todayKey } from './lib/dates';
import { uid, PROJECT_COLORS } from './lib/util';

// A small, realistic starting workspace so the app never opens empty.
// Everything here can be edited or deleted like any other task.
export function seedData() {
  const today = todayKey();
  const now = Date.now();
  const day = 86400000;

  const projects = ['Athera', 'CueUp', 'Portfolio', 'Personal'].map((name, i) => ({
    id: uid(),
    name,
    createdAt: now,
    order: i + 1,
    color: PROJECT_COLORS[i],
  }));
  const [athera, cueup, portfolio, personal] = projects.map((p) => p.id);

  let order = 0;
  const task = (title, extra = {}) => ({
    id: uid(),
    title,
    notes: '',
    status: 'todo',
    priority: null,
    projectId: null,
    dueDate: null,
    addedToToday: false,
    createdAt: now - (40 - order) * 60000,
    completedAt: null,
    order: ++order,
    subtasks: [],
    ...extra,
    ...(extra.subtasks ? { subtasks: extra.subtasks.map(([t, done]) => ({ id: uid(), title: t, done })) } : {}),
  });

  const tasks = [
    // Today
    task('Define homepage hierarchy', { projectId: athera, priority: 'high', addedToToday: true }),
    task('Explore typography options', {
      projectId: athera,
      priority: 'medium',
      addedToToday: true,
      notes: 'Pair a serif display face with a neutral sans for UI.\nCheck weights at small sizes.',
    }),
    task('Review product card states', { projectId: athera, addedToToday: true }),
    task('Create mobile navigation', { projectId: cueup, addedToToday: true }),

    // Inbox
    task('Explore alternative navigation'),
    task('Check contrast ratio'),
    task('Fix prototype transition'),

    // Athera
    task('Create furniture product card variants', {
      projectId: athera,
      priority: 'medium',
      dueDate: addDays(today, 2),
      notes: 'Try 3 layouts\nConsider image-heavy variant\nCheck mobile behavior',
      subtasks: [['Desktop version', true], ['Tablet version', false], ['Mobile version', false]],
    }),
    task('Define visual direction', { projectId: athera }),
    task('Create homepage wireframe', { projectId: athera }),
    task('Design product listing', { projectId: athera }),
    task('Design product details', { projectId: athera }),
    task('Explore navigation', { projectId: athera, priority: 'low' }),
    task('Build design system', { projectId: athera, priority: 'high' }),
    task('Competitive analysis', { projectId: athera, status: 'done', completedAt: now - 2 * day }),
    task('Define user flow', { projectId: athera, status: 'done', completedAt: now - day }),

    // CueUp
    task('Mobile navigation states', { projectId: cueup }),
    task('Create mobile screens', { projectId: cueup, dueDate: addDays(today, 2) }),
    task('Prepare prototype', { projectId: cueup, dueDate: addDays(today, 4), priority: 'medium' }),
    task('Finalize empty states', { projectId: cueup }),
    task('Review accessibility', { projectId: cueup, priority: 'low' }),

    // Portfolio
    task('Finalize typography', { projectId: portfolio, dueDate: addDays(today, 1), priority: 'high' }),
    task('Fix navigation spacing', { projectId: portfolio }),
    task('Fix card spacing', { projectId: portfolio }),
    task('Export assets', { projectId: portfolio }),

    // Personal
    task('Sort inspiration screenshots', { projectId: personal }),

    // Completed inbox task
    task('Review competitor screens', { status: 'done', completedAt: now - 3 * 3600000 }),
  ];

  return { projects, tasks, trash: [], prefs: defaultPrefs() };
}

export function defaultPrefs() {
  return {
    view: 'today',
    projectModes: {},
    sectionModes: {},
    collapsed: {},
    childTasksOpen: {},
    sidebarCollapsed: false,
    theme: 'system',
  };
}
