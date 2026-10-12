import { openNewTask } from '../store';

/** True on a Board page, where the page works in major tasks and boxes. */
export const isMajorBoard = (model) => Boolean(model.majorBoard) && model.mode === 'board' && model.kind !== 'trash';

/** What the page "+" and N create: a major task first, then a box under the one showing. */
export function addForPage(model, activeMajor) {
  if (!isMajorBoard(model)) return openNewTask(model.newTaskDefaults);
  if (activeMajor) return openNewTask({ parentId: activeMajor });
  // Completed holds only finished work, so it adds an ordinary task.
  if (model.kind === 'completed') return openNewTask(model.newTaskDefaults);
  return openNewTask({ ...model.newTaskDefaults, isHeading: true });
}
