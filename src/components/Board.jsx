import { memo } from 'react';
import { Inbox, Plus, Trash2 } from 'lucide-react';
import { activateTask, deleteTask, focusTaskTitle, hoverTask, leaveTask, openNewTask, taskKey, toggleComplete, toggleSelected, updateTask, useChildTasks, useUI } from '../store';
import { endDrag, startTaskDrag, useTaskDrop } from '../lib/dnd';
import { useToday } from '../lib/useToday';
import { Checkbox, ProjectDot, StatusIcon } from './bits';
import { AddChildTask, ChildAddButton, ChildTaskList, useShowChildAdd } from './ChildTasks';
import { SubtaskTree } from './Subtasks';
import { TaskMeta, TaskPriority, TaskProgress } from './TaskRow';
import { EmptyState, useProjectsById, withDropLine } from './TaskList';
import { openTaskMenu } from './taskMenu';
import { textStyleProps } from '../lib/textStyle';
import { TextStyleButton } from './TextStyle';

const Card = memo(function Card({ task, show, today, projectsById, checklistStatus }) {
  const dragging = useUI((u) => u.draggingId === task.id);
  const selecting = useUI((u) => u.selecting);
  const selected = useUI((u) => u.selectedId === task.id);
  const completing = useUI((u) => task.id in u.lingering && task.status === 'done');
  const key = taskKey(task.id);
  const picked = useUI((u) => u.selected.has(key));
  const kids = useChildTasks(task.id);
  const showChildAdd = useShowChildAdd(task.id);
  const hasMeta = Boolean(show.due && task.dueDate);
  const cls = [
    'card', selected && 'selected', picked && 'picked', task.status === 'done' && 'done', completing && 'completing', dragging && 'dragging',
  ].filter(Boolean).join(' ');
  return (
    <div
      className={cls}
      data-task-row
      data-id={task.id}
      draggable={!selecting}
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
      <div className="card-main">
        {!selecting && <ChildAddButton task={task} className="card-child-add" />}
        <Checkbox
          state={selecting ? (picked ? 'done' : 'todo') : task.status}
          onToggle={() => (selecting ? toggleSelected(key) : toggleComplete(task.id))}
        />
        <span className="card-title-line">
          <span className="card-title">
            <span className={`task-title-text ${textStyleProps(task.textStyle).className}`} style={textStyleProps(task.textStyle).style}>{task.title || 'Untitled'}</span>
          </span>
          <TaskProgress task={task} kids={kids} />
          <TaskPriority task={task} />
        </span>
        {!selecting && (
          <span className="card-actions">
            <TextStyleButton
              className="card-style"
              value={task.textStyle}
              onChange={(textStyle) => updateTask(task.id, { textStyle })}
              label="Style task text"
            />
            <button
              type="button"
              className="icon-btn sm card-delete"
              title="Delete task"
              aria-label="Delete task"
              onClick={(e) => {
                e.stopPropagation();
                deleteTask(task.id);
              }}
            >
              <Trash2 size={14} strokeWidth={1.9} />
            </button>
          </span>
        )}
      </div>
      {hasMeta ? (
        <div className="card-meta">
          <TaskMeta task={task} show={show} today={today} hidePriority />
        </div>
      ) : null}
      <ChildTaskList
        task={task}
        kids={kids}
        depth={1}
        show={show}
        today={today}
        projectsById={projectsById}
        autoFocus={showChildAdd}
      />
      {task.subtasks.length > 0 && <SubtaskTree task={task} variant="card" completedOnly={checklistStatus === 'done'} todoOnly={checklistStatus === 'todo'} />}
    </div>
  );
});

function HeadingAddField({ task }) {
  const open = useShowChildAdd(task.id);
  return <AddChildTask parent={task} open={open} />;
}

export function Board({ model }) {
  const { target, handlers } = useTaskDrop();
  const projectsById = useProjectsById();
  const draggingId = useUI((u) => u.draggingId);
  const statsFilter = useUI((u) => u.statsFilter);
  const today = useToday();

  // Genuinely empty columns still show their "add" affordance (e.g. a brand
  // new project); only a filter narrowing everything away should replace the
  // board with a plain message instead of a wall of empty columns.
  if (statsFilter && !model.groups.some((g) => g.tasks.length > 0 || g.checklistTask)) {
    return <EmptyState text={model.emptyText} />;
  }

  return (
    <div className="board">
      {model.groups.map((col) => {
        if (col.filteredEmpty) return null;
        const isTarget = target?.groupId === col.id;
        const useCardGrid = !col.heading && col.tasks.length > 1;
        return (
          <section key={col.id} className={`column${useCardGrid ? ' column-card-grid' : ''}${isTarget ? ' drop-active' : ''}`} {...handlers(col)}>
            <header className="column-head">
              {col.statusId ? <StatusIcon status={col.statusId} size={13} /> : col.heading ? (
                <button
                  type="button"
                  className="icon-btn sm column-major-add"
                  title="Add major heading"
                  aria-label="Add major heading"
                  onClick={() => openNewTask({ ...model.newTaskDefaults, isHeading: true })}
                >
                  <Plus size={15} />
                </button>
              ) : col.color ? <ProjectDot color={col.color} /> : <Inbox size={14} strokeWidth={1.9} className="group-icon" />}
              <span className={`group-title ${textStyleProps(col.headingTask?.textStyle).className}`} style={textStyleProps(col.headingTask?.textStyle).style}>{col.title}</span>
              <span className="group-count">{col.count ?? col.tasks.length}</span>
              {col.heading && <TextStyleButton
                className="column-style"
                value={col.headingTask.textStyle}
                onChange={(textStyle) => updateTask(col.headingTask.id, { textStyle })}
                label="Style heading text"
              />}
              {col.add && !col.heading && (
                <button
                  type="button"
                  className="icon-btn sm column-add"
                  title={col.heading ? `New sub-task in ${col.title}` : `New ${col.title.toLowerCase()} task`}
                  onClick={() => openNewTask(col.add.defaults)}
                >
                  <Plus size={15} />
                </button>
              )}
            </header>
            <div className="column-body">
              {col.heading && <HeadingAddField task={col.headingTask} />}
              {withDropLine(col.tasks, draggingId, isTarget && col.sortable ? target.index : null, (t) => (
                <Card
                  task={t}
                  show={{ ...model.show, completed: col.checklistStatus === 'done' }}
                  today={today}
                  projectsById={projectsById}
                  checklistStatus={col.checklistStatus}
                />
              ))}
              {col.checklistTask && (
                <div className="column-checklist">
                  <SubtaskTree task={col.checklistTask} variant="board" completedOnly={col.checklistStatus === 'done'} todoOnly={col.checklistStatus === 'todo'} />
                </div>
              )}
              {col.tasks.length === 0 && !col.checklistTask && <div className="column-empty">No sub-tasks · add one</div>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
