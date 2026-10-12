import { useEffect } from 'react';
import { hidePreview, useData, useUI } from '../store';
import { ItemEditor, TaskEditor } from './TaskEditor';

function findItem(list = [], id) {
  for (const item of list) {
    if (item.id === id) return item;
    const nested = findItem(item.subtasks, id);
    if (nested) return nested;
  }
  return null;
}

/**
 * The task popup: the editor for a task (details, notes and every sub-task
 * and nested task, all editable in place), or for one checklist item. It
 * never opens on hover, only from the pencil, a double-click, Enter, the
 * right-click menu or search. It opens in the middle of the window over a
 * light scrim, like the create popup, and grows as big as its content needs.
 */
export function TaskPreview() {
  const preview = useUI((u) => u.preview);
  const task = useData((s) => (preview ? s.tasks.find((t) => t.id === preview.id) : null));
  const item = task && preview?.subId ? findItem(task.subtasks, preview.subId) : null;
  const missing = Boolean(preview && (!task || (preview.subId && !item)));

  // A task or item deleted while its popup is open takes the popup with it.
  useEffect(() => {
    if (missing) hidePreview();
  }, [missing]);

  if (!preview || missing) return null;
  return (
    <>
      <div className="preview-scrim" aria-hidden="true" />
      <div key={item ? `${task.id}/${item.id}` : task.id} className="preview" role="dialog" aria-label="Task">
        {item ? <ItemEditor task={task} item={item} /> : <TaskEditor task={task} />}
      </div>
    </>
  );
}
