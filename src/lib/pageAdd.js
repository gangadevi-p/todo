import { openNewTask } from '../store';

/** True on a project's Board, where the page works in major tasks and boxes. */
export const isProjectBoard = (model) => Boolean(model.project) && model.mode === 'board' && model.kind !== 'trash';

/** What the page "+" and N create: a major task first, then a box under the one showing. */
export function addForPage(model, activeMajor) {
  if (!isProjectBoard(model)) return openNewTask(model.newTaskDefaults);
  if (activeMajor) return openNewTask({ ...model.newTaskDefaults, parentId: activeMajor });
  return openNewTask({ ...model.newTaskDefaults, isHeading: true });
}
