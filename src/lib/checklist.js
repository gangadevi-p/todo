/** Return every checklist item, including items nested under another item. */
export function flattenChecklist(items = []) {
  return items.flatMap((item) => [item, ...flattenChecklist(item.subtasks || [])]);
}
