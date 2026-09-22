import { memo } from 'react';
import { AlignLeft, CalendarDays, GripVertical, ListChecks, ListTree, Sun } from 'lucide-react';
import { activateTask, focusTaskTitle, hoverTask, leaveTask, taskKey, toggleComplete, toggleSelected, useChildTasks, useUI } from '../store';
import { dueLabel } from '../lib/dates';
import { priorityLabel } from '../lib/util';
import { inToday } from '../lib/views';
import { endDrag, startTaskDrag } from '../lib/dnd';
import { Checkbox, PriorityIcon, ProjectDot } from './bits';
import { ChildTaskList, useShowChildAdd } from './ChildTasks';
import { openTaskMenu } from './taskMenu';
import { rectOf } from './MenuLayer';
import { SubtaskTree } from './Subtasks';

/** Small, quiet metadata shown to the right of a row or under a card title. */
export function TaskMeta({ task, project, show, today }) {
  const doneSubs = task.subtasks.filter((s) => s.done).length;
  const kids = useChildTasks(task.id);
  const doneKids = kids.filter((c) => c.status === 'done').length;
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
      {kids.length > 0 && (
        <span className={`meta meta-children${doneKids === kids.length ? ' all' : ''}`} title="Sub-tasks">
          <ListTree size={13} strokeWidth={1.9} />
          {doneKids}/{kids.length}
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

export const TaskRow = memo(function TaskRow({ task, project, show, today, draggable, depth = 0, projectsById }) {
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
        <Checkbox
          state={selecting ? (picked ? 'done' : 'todo') : task.status}
          onToggle={() => (selecting ? toggleSelected(key) : toggleComplete(task.id))}
        />
        <span className="row-title">{task.title || 'Untitled'}</span>
        <span className="row-meta">
          <TaskMeta task={task} project={project} show={show} today={today} />
        </span>
      </div>
      {(kids.length > 0 || showChildAdd) && (
        <ChildTaskList task={task} kids={kids} depth={depth + 1} show={show} today={today} projectsById={projectsById} />
      )}
      {task.subtasks.length > 0 && <SubtaskTree task={task} variant="row" />}
    </>
  );
});
