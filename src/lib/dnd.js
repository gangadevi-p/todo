import { useEffect, useState } from 'react';
import { findTask, hidePreview, placeTask, ui, updateTask, useUI } from '../store';

// HTML5 drag data can't be read during dragover, so the dragged item lives here.
export const drag = { type: null, id: null };

function setGhost(e, label) {
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.textContent = label;
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, 14, 16);
  setTimeout(() => ghost.remove(), 0);
}

export function startTaskDrag(e, task) {
  drag.type = 'task';
  drag.id = task.id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', task.title);
  setGhost(e, task.title);
  hidePreview();
  // Defer so the browser snapshots the row before it dims. Skip if the drag
  // already ended (a very quick drag can finish before the next frame).
  requestAnimationFrame(() => {
    if (drag.type === 'task' && drag.id === task.id) ui.set((u) => ({ ...u, draggingId: task.id, menu: null }));
  });
}

export function startProjectDrag(e, project) {
  drag.type = 'project';
  drag.id = project.id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', project.name);
  setGhost(e, project.name);
}

export function endDrag() {
  drag.type = null;
  drag.id = null;
  ui.set((u) => (u.draggingId ? { ...u, draggingId: null } : u));
}

/** Index among the non-dragged rows inside `container` where a drop would land. */
function dropIndex(container, clientY) {
  const rows = [...container.querySelectorAll('[data-task-row]')].filter((r) => r.dataset.id !== drag.id);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i].getBoundingClientRect();
    if (clientY < r.top + r.height / 2) return i;
  }
  return rows.length;
}

/**
 * Shared drop logic for list groups and board columns. Returns the current
 * drop target plus handlers to spread onto each group's container.
 */
export function useTaskDrop() {
  const [target, setTarget] = useState(null); // { groupId, index }
  const dragging = useUI((u) => u.draggingId);

  useEffect(() => {
    if (!dragging) setTarget(null);
  }, [dragging]);

  const handlers = (group) => {
    if (!group.patch) return {};
    return {
      onDragOver(e) {
        if (drag.type !== 'task') return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const index = group.sortable && !group.collapsed ? dropIndex(e.currentTarget, e.clientY) : null;
        setTarget((t) => (t && t.groupId === group.id && t.index === index ? t : { groupId: group.id, index }));
      },
      onDragLeave(e) {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setTarget((t) => (t?.groupId === group.id ? null : t));
        }
      },
      onDrop(e) {
        e.preventDefault();
        const id = drag.id;
        const t = target;
        setTarget(null);
        if (drag.type !== 'task' || !id) return;
        const task = findTask(id);
        if (!task) return;
        const patch = group.patch(task);
        if (group.sortable && t && t.groupId === group.id && t.index != null) {
          const list = group.tasks.filter((x) => x.id !== id);
          placeTask(id, list[t.index - 1]?.id ?? null, list[t.index]?.id ?? null, patch);
        } else {
          updateTask(id, patch);
        }
        endDrag();
      },
    };
  };

  return { target, handlers };
}
