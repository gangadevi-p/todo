import { memo } from 'react';
import { AlignLeft, CalendarDays, GripVertical, ListChecks, Sun } from 'lucide-react';
import { activateTask, focusTaskTitle, hoverTask, leaveTask, toggleComplete, useUI } from '../store';
import { dueLabel } from '../lib/dates';
import { priorityLabel } from '../lib/util';
import { inToday } from '../lib/views';
import { endDrag, startTaskDrag } from '../lib/dnd';
import { Checkbox, PriorityIcon, ProjectDot } from './bits';
import { openTaskMenu } from './taskMenu';
import { rectOf } from './MenuLayer';

/** Small, quiet metadata shown to the right of a row or under a card title. */
export function TaskMeta({ task, project, show, today }) {
  const doneSubs = task.subtasks.filter((s) => s.done).length;
  const due = show.due && task.dueDate ? dueLabel(task.dueDate, today) : null;
  const open = task.status !== 'done';
  return (
    <>
      {show.today && open && inToday(task, today) && (
        <span className="meta meta-today" title="In Today"><Sun size={13} strokeWidth={2} /></span>
      )}
      {task.notes.trim() && (
        <span className="meta" title="Has notes"><AlignLeft size={13} strokeWidth={1.9} /></span>
      )}
      {task.subtasks.length > 0 && (
        <span className={`meta meta-subs${doneSubs === task.subtasks.length ? ' all' : ''}`} title="Checklist">
          <ListChecks size={13} strokeWidth={1.9} />
          {doneSubs}/{task.subtasks.length}
        </span>
      )}
      {task.priority && (
        <span className="meta" title={`${priorityLabel(task.priority)} priority`}><PriorityIcon level={task.priority} /></span>
      )}
      {due && (
        <span className={`meta meta-due due-${open ? due.tone : 'normal'}`}>
          <CalendarDays size={12} strokeWidth={1.9} />
          {due.text}
        </span>
      )}
      {show.project && project && (
        <span className="meta meta-project">
          <ProjectDot color={project.color} size={7} />
          {project.name}
        </span>
      )}
    </>
  );
}

export const TaskRow = memo(function TaskRow({ task, project, show, today, selected, completing, draggable }) {
  const dragging = useUI((u) => u.draggingId === task.id);
  const fresh = Date.now() - task.createdAt < 900;
  const cls = [
    'row',
    selected && 'selected',
    task.status === 'done' && 'done',
    completing && 'completing',
    dragging && 'dragging',
    fresh && 'fresh',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cls}
      data-task-row
      data-id={task.id}
      draggable={draggable}
      onDragStart={(e) => startTaskDrag(e, task)}
      onDragEnd={endDrag}
      onClick={() => activateTask(task.id)}
      onMouseEnter={() => hoverTask(task.id)}
      onMouseLeave={leaveTask}
      onDoubleClick={() => focusTaskTitle(task.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        openTaskMenu(task, { x: e.clientX, y: e.clientY });
      }}
    >
      {draggable && (
        <span
          className="row-handle"
          title="Drag to move · Click for options"
          onClick={(e) => {
            e.stopPropagation();
            openTaskMenu(task, { rect: rectOf(e.currentTarget) });
          }}
        >
          <GripVertical size={14} strokeWidth={1.8} />
        </span>
      )}
      <Checkbox state={task.status} onToggle={() => toggleComplete(task.id)} />
      <span className="row-title">{task.title || 'Untitled'}</span>
      <span className="row-meta">
        <TaskMeta task={task} project={project} show={show} today={today} />
      </span>
    </div>
  );
});
