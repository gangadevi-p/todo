import { useRef, useState } from 'react';
import { Inbox, TriangleAlert } from 'lucide-react';
import { addSubtask, closePopup, findTask, toast, useData } from '../store';
import { uid } from '../lib/util';
import { ProjectDot, StatusIcon } from './bits';
import { F, Field, Popup, ReadOnly } from './Popup';

/** A checklist item on an existing task, created in the same popup as everything else. */
export function NewSubtaskForm({ taskId }) {
  const task = useData((s) => s.tasks.find((t) => t.id === taskId));
  const project = useData((s) => (task?.projectId ? s.projects.find((p) => p.id === task.projectId) : null));
  const [id] = useState(uid);
  const [title, setTitle] = useState('');
  const [done, setDone] = useState(false);
  const titleRef = useRef(null);

  const clean = title.trim();
  const duplicate = task && clean && task.subtasks.some((s) => s.title.trim().toLowerCase() === clean.toLowerCase());

  if (!task) return null;

  const submit = () => {
    if (!clean) {
      titleRef.current?.focus();
      return;
    }
    if (findTask(taskId)) addSubtask(taskId, clean, null, { id, done });
    closePopup();
    toast('Checklist item added');
  };

  const side = (
    <>
      <Field f={F.id}><ReadOnly mono>{id}</ReadOnly></Field>
      <Field f={F.parent} hint="Task ID"><ReadOnly mono>{task.id}</ReadOnly></Field>
    </>
  );

  return (
    <Popup
      title="New subtask"
      subtitle="A step on the task below."
      dirty={Boolean(clean)}
      canSubmit={Boolean(clean)}
      submitLabel="Add subtask"
      onSubmit={submit}
      focusRef={titleRef}
      side={side}
    >
      <Field f={F.parent}>
        <div className="pp-preview">
          {project ? <ProjectDot color={project.color} size={9} /> : <Inbox size={13} strokeWidth={1.9} />}
          <span>{task.title}</span>
        </div>
      </Field>

      <Field f={F.title}>
        <input
          ref={titleRef}
          className="pp-input pp-title-input"
          autoFocus
          value={title}
          spellCheck
          placeholder="e.g. Tablet version"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {duplicate && (
          <div className="pp-warn">
            <TriangleAlert size={13} strokeWidth={2} />
            This task already has a subtask called “{clean}”.
          </div>
        )}
      </Field>

      <Field f={F.status}>
        <div className="pills" role="radiogroup" aria-label="Status">
          {[[false, 'todo', 'Open'], [true, 'done', 'Done']].map(([value, state, label]) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={done === value}
              className={`pill${done === value ? ' on' : ''}`}
              onClick={() => setDone(value)}
            >
              <StatusIcon status={state} size={13} />
              {label}
            </button>
          ))}
        </div>
      </Field>
    </Popup>
  );
}
