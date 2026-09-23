import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { createTask, setChildTasksOpen, useData } from '../store';
import { TaskRow } from './TaskRow';

/** Whether a task's inline sub-task field was opened from its context menu. */
export function useShowChildAdd(taskId) {
  return useData((s) => Boolean(s.prefs.childTasksOpen?.[taskId]));
}

/** Hover-only control shown in a task's left gutter. */
export function ChildAddButton({ task, className = '' }) {
  return (
    <button
      type="button"
      className={`child-add-button ${className}`.trim()}
      title="Add sub-task"
      aria-label="Add sub-task"
      onClick={(e) => {
        e.stopPropagation();
        setChildTasksOpen(task.id, true);
      }}
    >
      <Plus size={15} strokeWidth={2.1} />
    </button>
  );
}

/** The inline text field revealed by a task's left-gutter add control. */
export function AddChildTask({ parent, open = false }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const submit = () => {
    const clean = value.trim();
    if (!clean) { setChildTasksOpen(parent.id, false); return; }
    createTask({ title: clean, parentId: parent.id, projectId: parent.projectId, addedToToday: parent.addedToToday });
    setValue('');
  };

  return (
    <div className="child-add-row">
      <Plus size={13} strokeWidth={2} className="sub-add-icon" />
      <input
        ref={inputRef}
        placeholder="Sub-task"
        value={value}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
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
export function ChildTaskList({ task, kids, depth, show, today, projectsById, autoFocus = false }) {
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
        />
      ))}
    </div>
  );
}
