import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { createTask, setChildTasksOpen, useData } from '../store';
import { TaskRow } from './TaskRow';

/** Whether a task's inline sub-task field was opened from its context menu. */
export function useShowChildAdd(taskId) {
  return useData((s) => Boolean(s.prefs.childTasksOpen?.[taskId]));
}

/**
 * Control in a task's left gutter. It always adds a sub-task, never a nested
 * one: into `addTo` (the card or task this row is a sub-task of), else into
 * this task. Only Tab in the field nests.
 */
export function ChildAddButton({ task, addTo = task.id, className = '' }) {
  return (
    <button
      type="button"
      className={`child-add-button ${className}`.trim()}
      aria-label="Add sub-task"
      onClick={(e) => {
        e.stopPropagation();
        setChildTasksOpen(addTo, true);
      }}
    >
      <Plus size={15} strokeWidth={2.1} />
    </button>
  );
}

/** The inline text field revealed by a task's left-gutter add control. */
export function AddChildTask({ parent, open = false }) {
  const [value, setValue] = useState('');
  // Which task new entries nest under right now: starts at `parent`, and
  // Tab drops it one level deeper onto the last task this field created.
  const [level, setLevel] = useState(parent.id);
  const lastCreated = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setLevel(parent.id);
      lastCreated.current = null;
    }
  }, [open, parent.id]);

  if (!open) return null;

  const submit = (nestDeeper = false) => {
    const clean = value.trim();
    if (!clean) { setChildTasksOpen(parent.id, false); return; }
    const parentId = nestDeeper && lastCreated.current ? lastCreated.current : level;
    const id = createTask({ title: clean, parentId, projectId: parent.projectId, addedToToday: parent.addedToToday });
    lastCreated.current = id;
    if (nestDeeper) setLevel(parentId);
    setValue('');
  };

  return (
    <div className="child-add-row">
      <Plus size={13} strokeWidth={2} className="sub-add-icon" />
      <input
        ref={inputRef}
        placeholder="Sub-task · Tab to nest"
        value={value}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Enter') {
            e.preventDefault();
            submit(false);
          } else if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            submit(true);
          } else if (e.key === 'Escape') {
            setChildTasksOpen(parent.id, false);
          }
        }}
        onBlur={() => {
          if (!value.trim()) setChildTasksOpen(parent.id, false);
        }}
      />
    </div>
  );
}

/** Recursively renders a task's sub-tasks (full tasks of their own, which can have further sub-tasks), indented one level deeper each time. */
export function ChildTaskList({ task, kids, depth, show, today, projectsById, autoFocus = false, addTo }) {
  return (
    <div className="child-tasks" style={{ '--depth': depth }} onClick={(e) => e.stopPropagation()}>
      <AddChildTask parent={task} open={autoFocus} />
      {kids.map((c) => (
        <TaskRow
          key={c.id}
          task={c}
          project={projectsById?.get(c.projectId)}
          show={show}
          today={today}
          draggable={false}
          depth={depth}
          projectsById={projectsById}
          addTo={addTo ?? task.id}
        />
      ))}
    </div>
  );
}
