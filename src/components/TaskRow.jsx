import { memo } from 'react';
import { CalendarDays, GripVertical, Trash2 } from 'lucide-react';
import { activateTask, deleteTask, focusTaskTitle, hoverTask, leaveTask, taskKey, toggleComplete, toggleSelected, updateTask, useChildTasks, useUI } from '../store';
import { dueLabel, formatTimestamp } from '../lib/dates';
import { priorityLabel } from '../lib/util';
import { endDrag, startTaskDrag } from '../lib/dnd';
import { Checkbox, PriorityIcon } from './bits';
import { ChildAddButton, ChildTaskList, useShowChildAdd } from './ChildTasks';
import { openTaskMenu } from './taskMenu';
import { rectOf } from './MenuLayer';
import { SubtaskTree } from './Subtasks';
import { textStyleProps } from '../lib/textStyle';
import { TextStyleButton } from './TextStyle';
import { flattenChecklist } from '../lib/checklist';

/** Checklist and child-task progress, kept beside the task title rather than right-aligned with other metadata. */
export function TaskProgress({ task, kids = [] }) {
  const checklist = flattenChecklist(task.subtasks);
  const doneSubs = checklist.filter((s) => s.done).length;
  const doneKids = kids.filter((c) => c.status === 'done').length;
  if (!checklist.length && !kids.length) return null;
  return (
    <span className="task-progress">
      {checklist.length > 0 && (
        <span className={`task-progress-item${doneSubs === checklist.length ? ' all' : ''}`} title="Checklist">
          {doneSubs}/{checklist.length}
        </span>
      )}
      {kids.length > 0 && (
        <span className={`task-progress-item children${doneKids === kids.length ? ' all' : ''}`} title="Sub-tasks">
          {doneKids}/{kids.length}
        </span>
      )}
    </span>
  );
}

/** Small, quiet metadata shown to the right of a row or under a card title. */
export function TaskMeta({ task, show, today, hidePriority = false }) {
  const due = show.due && task.dueDate ? dueLabel(task.dueDate, today) : null;
  const open = task.status !== 'done';
  return (
    <>
      {!hidePriority && task.priority && (
        <span className="meta" title={`${priorityLabel(task.priority)} priority`}><PriorityIcon level={task.priority} /></span>
      )}
      {due && (
        <span className={`meta meta-due due-${open ? due.tone : 'normal'}`}>
          <CalendarDays size={12} strokeWidth={1.9} />
          {due.text}
        </span>
      )}
      {show.completed && task.completedAt && (
        <span className="meta meta-completed" title={`Completed ${formatTimestamp(task.completedAt, true)}`}>
          <CalendarDays size={12} strokeWidth={1.9} />
          {formatTimestamp(task.completedAt, true)}
        </span>
      )}
    </>
  );
}

/** Priority badge kept beside a card's title, on the same line, regardless of hover. */
export function TaskPriority({ task }) {
  if (!task.priority) return null;
  return (
    <span className="meta card-priority" title={`${priorityLabel(task.priority)} priority`}>
      <PriorityIcon level={task.priority} />
    </span>
  );
}

export const TaskRow = memo(function TaskRow({ task, show, today, draggable, depth = 0, projectsById, completedChecklistOnly = false }) {
  const dragging = useUI((u) => u.draggingId === task.id);
  const selecting = useUI((u) => u.selecting);
  const selected = useUI((u) => u.selectedId === task.id);
  const completing = useUI((u) => task.id in u.lingering && task.status === 'done');
  const key = taskKey(task.id);
  const picked = useUI((u) => u.selected.has(key));
  const kids = useChildTasks(task.id);
  const showChildAdd = useShowChildAdd(task.id);
  const nested = depth > 0;
  const fresh = Date.now() - task.createdAt < 900;
  const cls = [
    'row',
    nested && 'row-nested',
    selected && 'selected',
    picked && 'picked',
    task.status === 'done' && 'done',
    completing && 'completing',
    dragging && 'dragging',
    fresh && 'fresh',
  ].filter(Boolean).join(' ');

  return (
    <>
      <div
        className={cls}
        style={nested ? { '--depth': depth } : undefined}
        data-task-row
        data-id={task.id}
        draggable={draggable && !selecting && !nested}
        onDragStart={(e) => startTaskDrag(e, task)}
        onDragEnd={endDrag}
        onClick={() => (selecting ? toggleSelected(key) : activateTask(task.id))}
        onMouseEnter={() => hoverTask(task.id)}
        onMouseLeave={leaveTask}
        onDoubleClick={() => !selecting && focusTaskTitle(task.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          if (!selecting) openTaskMenu(task, { x: e.clientX, y: e.clientY });
        }}
      >
        {draggable && !selecting && !nested && (
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
        {!selecting && <ChildAddButton task={task} />}
        <Checkbox
          state={selecting ? (picked ? 'done' : 'todo') : task.status}
          onToggle={() => (selecting ? toggleSelected(key) : toggleComplete(task.id))}
        />
        <span className="row-title-line">
          <span className="row-title">
            <span className={`task-title-text ${textStyleProps(task.textStyle).className}`} style={textStyleProps(task.textStyle).style}>{task.title || 'Untitled'}</span>
          </span>
          <TaskProgress task={task} kids={kids} />
        </span>
        <span className="row-meta">
          <TaskMeta task={task} show={show} today={today} />
        </span>
        {!selecting && (
          <TextStyleButton
            className="row-style"
            value={task.textStyle}
            onChange={(textStyle) => updateTask(task.id, { textStyle })}
            label="Style task text"
          />
        )}
        {!selecting && (
          <button
            type="button"
            className="icon-btn sm row-delete"
            title="Delete task"
            aria-label="Delete task"
            onClick={(e) => {
              e.stopPropagation();
              deleteTask(task.id);
            }}
          >
            <Trash2 size={14} strokeWidth={1.9} />
          </button>
        )}
      </div>
      <ChildTaskList
        task={task}
        kids={kids}
        depth={depth + 1}
        show={show}
        today={today}
        projectsById={projectsById}
        autoFocus={showChildAdd}
      />
      {task.subtasks.length > 0 && <SubtaskTree task={task} variant="row" completedOnly={completedChecklistOnly} />}
    </>
  );
});
