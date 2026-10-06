/** Bump when the demo workspace changes, so demos saved earlier are replaced with the new one. */
export const DEMO_VERSION = 5;

/** App name shown in the demo space, so it isn't mistaken for the owner's workspace. */
export const DEMO_NAME = 'Demo Workspace';

// The demo space starts empty: no sample projects or tasks.
export function seedData() {
  return { projects: [], tasks: [], trash: [], prefs: { ...defaultPrefs(), demoVersion: DEMO_VERSION } };
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
