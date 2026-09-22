import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { createTask, useData } from '../store';
import { TaskRow } from './TaskRow';

/** Whether the "add a sub-task" field should be showing for a task with none yet — set only from the right-click menu, since there's no row control for it any more. */
export function useShowChildAdd(taskId) {
  return useData((s) => Boolean(s.prefs.childTasksOpen?.[taskId]));
}

/** One-line "+" that reveals a plain text field for a new sub-task, in place — not a field left sitting open under the list. */
function AddChildTask({ parent, autoFocus }) {
  const [adding, setAdding] = useState(Boolean(autoFocus));
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  if (!adding) {
    return (
      <button type="button" className="child-add-trigger" onClick={(e) => { e.stopPropagation(); setAdding(true); }}>
        <Plus size={12} strokeWidth={2.2} />
        <span>Add sub-task</span>
      </button>
    );
  }

  const submit = () => {
    const clean = value.trim();
    if (!clean) { setAdding(false); return; }
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
            setAdding(false);
          }
        }}
        onBlur={() => {
          if (!value.trim()) setAdding(false);
        }}
      />
    </div>
  );
}

/** Recursively renders a task's sub-tasks (full tasks of their own, which can have further sub-tasks), indented one level deeper each time. */
export function ChildTaskList({ task, kids, depth, show, today, projectsById }) {
  return (
    <div className="child-tasks" style={{ '--depth': depth }} onClick={(e) => e.stopPropagation()}>
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
      <AddChildTask parent={task} autoFocus={kids.length === 0} />
    </div>
  );
}
