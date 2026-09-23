import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CalendarDays, Inbox, Pencil, Sun } from 'lucide-react';
import {
  hidePreview, keepPreview, leaveTask, selectTask, toggleComplete, updateSubtask, useData, useUI,
} from '../store';
import { dueLabelLong } from '../lib/dates';
import { priorityLabel, statusLabel } from '../lib/util';
import { useToday } from '../lib/useToday';
import { Checkbox, PriorityIcon, ProjectDot, StatusIcon } from './bits';
import { textStyleProps } from '../lib/textStyle';
import { flattenChecklist } from '../lib/checklist';

const WIDTH = 340;
const GAP = 10;
const MAX_CHECKLIST = 6;

/** Read-only overview of a task, shown beside its row or card. */
export function TaskPreview() {
  const preview = useUI((u) => u.preview);
  const task = useData((s) => (preview ? s.tasks.find((t) => t.id === preview.id) : null));
  if (!preview || !task) return null;
  return <PreviewCard key={task.id} task={task} pinned={preview.pinned} />;
}

function PreviewCard({ task, pinned }) {
  const today = useToday();
  const project = useData((s) => (task.projectId ? s.projects.find((p) => p.id === task.projectId) : null));
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const [tick, setTick] = useState(0);

  // Sit beside the task: to its right when there's room, otherwise over the
  // right end of the row. Always kept inside the window.
  useLayoutEffect(() => {
    const el = ref.current;
    const anchor = document.querySelector(`[data-task-row][data-id="${task.id}"]`);
    if (!el || !anchor) {
      hidePreview();
      return;
    }
    const r = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const h = el.offsetHeight;
    const left = Math.max(8, Math.min(r.right + GAP, vw - WIDTH - 8));
    const top = Math.max(8, Math.min(r.top - 6, vh - h - 8));
    setPos({ left, top });
  }, [task.id, tick, task.notes, task.subtasks.length, task.title]);

  // Keep the popup attached to the row when the list moves underneath it.
  useEffect(() => {
    const onScroll = () => (pinned ? setTick((t) => t + 1) : hidePreview());
    const onResize = () => setTick((t) => t + 1);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [pinned]);

  // A pinned popup closes when you click anywhere that isn't a task or the popup.
  useEffect(() => {
    if (!pinned) return undefined;
    const onDown = (e) => {
      if (!e.target.closest?.('.preview, [data-task-row], .floating, .overlay')) hidePreview();
    };
    window.addEventListener('mousedown', onDown, true);
    return () => window.removeEventListener('mousedown', onDown, true);
  }, [pinned]);

  const done = task.status === 'done';
  const checklist = flattenChecklist(task.subtasks);
  const doneSubs = checklist.filter((s) => s.done).length;
  const shown = checklist.slice(0, MAX_CHECKLIST);
  const hasNotes = task.notes.trim().length > 0;
  const due = task.dueDate ? dueLabelLong(task.dueDate, today) : null;
  const overdue = task.dueDate && task.dueDate < today && !done;

  return (
    <div
      ref={ref}
      className={`preview${pinned ? ' pinned' : ''}`}
      style={pos ? { left: pos.left, top: pos.top, width: WIDTH } : { left: -9999, top: -9999, width: WIDTH, visibility: 'hidden' }}
      onMouseEnter={keepPreview}
      onMouseLeave={leaveTask}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="preview-head">
        <span className="preview-crumb">
          {project ? <ProjectDot color={project.color} /> : <Inbox size={13} strokeWidth={1.9} />}
          <span>{project ? project.name : 'Inbox'}</span>
        </span>
        <button
          type="button"
          className="preview-edit"
          title="Edit task (Enter)"
          onClick={() => selectTask(task.id, true)}
        >
          <Pencil size={12} strokeWidth={2.1} /> Edit
        </button>
      </div>

      <div className="preview-title-row">
        <Checkbox state={task.status} onToggle={() => toggleComplete(task.id)} />
        <div className={`preview-title${done ? ' done' : ''} ${textStyleProps(task.textStyle).className}`} style={textStyleProps(task.textStyle).style}>{task.title}</div>
      </div>

      <div className="preview-chips">
        <span className="chip">
          <StatusIcon status={task.status} size={13} />
          {statusLabel(task.status)}
        </span>
        {task.priority && (
          <span className="chip">
            <PriorityIcon level={task.priority} />
            {priorityLabel(task.priority)}
          </span>
        )}
        {due && (
          <span className={`chip${overdue ? ' chip-overdue' : ''}`}>
            <CalendarDays size={13} strokeWidth={1.9} />
            {due}
          </span>
        )}
        {task.addedToToday && (
          <span className="chip chip-today">
            <Sun size={13} strokeWidth={2} />
            Today
          </span>
        )}
      </div>

      {hasNotes && (
        <div className="preview-section">
          <div className="section-label">Notes</div>
          <p className="preview-notes">{task.notes.trim()}</p>
        </div>
      )}

      {checklist.length > 0 && (
        <div className="preview-section">
          <div className="section-label">
            <span>Checklist</span>
          </div>
          <div className="progress" aria-hidden="true">
            <span style={{ width: `${(doneSubs / checklist.length) * 100}%` }} />
          </div>
          {shown.map((st) => (
            <div key={st.id} className={`preview-sub${st.done ? ' done' : ''}`}>
              <Checkbox size="sm" state={st.done ? 'done' : 'todo'} onToggle={() => updateSubtask(task.id, st.id, { done: !st.done })} />
              <span>{st.title || 'Untitled'}</span>
            </div>
          ))}
          {checklist.length > shown.length && (
            <div className="preview-more">+{checklist.length - shown.length} more</div>
          )}
        </div>
      )}

      {!hasNotes && checklist.length === 0 && (
        <div className="preview-empty">No notes or checklist yet.</div>
      )}
    </div>
  );
}
