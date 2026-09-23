import { addDays, todayKey } from './lib/dates';
import { uid, PROJECT_COLORS } from './lib/util';

/** Bump when the sample workspace changes, so demos saved earlier are replaced with the new one. */
export const DEMO_VERSION = 2;

/** App name shown in the demo space, so it isn't mistaken for the owner's workspace. */
export const DEMO_NAME = 'Demo Workspace';

// Made-up sample workspace for the demo space only. None of it is real work.
// Everything here can be edited or deleted like any other task.
export function seedData() {
  const today = todayKey();
  const now = Date.now();
  const day = 86400000;

  const projects = ['Maple Café Website', 'Trailhead App', 'Studio Rebrand', 'Home'].map((name, i) => ({
    id: uid(),
    name,
    createdAt: now,
    order: i + 1,
    color: PROJECT_COLORS[i],
  }));
  const [cafe, trail, studio, home] = projects.map((p) => p.id);

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
    task('Sketch the menu page layout', { projectId: cafe, priority: 'high', addedToToday: true }),
    task('Pick a warm colour palette', {
      projectId: cafe,
      priority: 'medium',
      addedToToday: true,
      notes: 'Cream, espresso brown and one bright accent.\nCheck contrast on buttons.',
    }),
    task('Write opening-hours section', { projectId: cafe, addedToToday: true }),
    task('Design the trail map screen', { projectId: trail, addedToToday: true }),

    // Inbox
    task('Try a darker footer'),
    task('Collect icon references'),
    task('Rename files in the shared folder'),

    // Maple Café Website
    task('Design the online order flow', {
      projectId: cafe,
      priority: 'medium',
      dueDate: addDays(today, 2),
      notes: 'Keep it to three steps\nShow pickup time clearly\nTest on a small phone',
      subtasks: [['Choose items', true], ['Pickup time', false], ['Confirmation', false]],
    }),
    task('Photograph the pastries', { projectId: cafe }),
    task('Build the home page hero', { projectId: cafe }),
    task('Add a gallery section', { projectId: cafe }),
    task('Set up the contact form', { projectId: cafe }),
    task('Try a sticky header', { projectId: cafe, priority: 'low' }),
    task('Create a small style guide', { projectId: cafe, priority: 'high' }),
    task('Gather reference cafés', { projectId: cafe, status: 'done', completedAt: now - 2 * day }),
    task('Agree on the site map', { projectId: cafe, status: 'done', completedAt: now - day }),

    // Trailhead App
    task('Onboarding screens', { projectId: trail }),
    task('Saved trails list', { projectId: trail, dueDate: addDays(today, 2) }),
    task('Clickable prototype for testing', { projectId: trail, dueDate: addDays(today, 4), priority: 'medium' }),
    task('Offline mode message', { projectId: trail }),
    task('Check tap target sizes', { projectId: trail, priority: 'low' }),

    // Studio Rebrand
    task('Choose the new logo direction', { projectId: studio, dueDate: addDays(today, 1), priority: 'high' }),
    task('Update business cards', { projectId: studio }),
    task('Refresh social media banners', { projectId: studio }),
    task('Export the brand kit', { projectId: studio }),

    // Home
    task('Plan weekend groceries', { projectId: home }),

    // Completed inbox task
    task('Clear the desktop screenshots', { status: 'done', completedAt: now - 3 * 3600000 }),
  ];

  return { projects, tasks, trash: [], prefs: { ...defaultPrefs(), demoVersion: DEMO_VERSION } };
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
