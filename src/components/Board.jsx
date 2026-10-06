import { memo } from 'react';
import { Inbox, Plus, Trash2 } from 'lucide-react';
import { addSubtask, deleteTask, openNewTask, taskKey, toggleComplete, toggleSelected, updateTask, useChildTasks, useUI } from '../store';
import { endDrag, startTaskDrag, useTaskDrop } from '../lib/dnd';
import { useToday } from '../lib/useToday';
import { Checkbox, ProjectDot, StatusIcon } from './bits';
import { AddChildTask, ChildAddButton, ChildTaskList, useShowChildAdd } from './ChildTasks';
import { focusSubtask, SubtaskTree } from './Subtasks';
import { TaskMeta, TaskPriority, TaskProgress } from './TaskRow';
import { EmptyState, useProjectsById, withDropLine } from './TaskList';
import { openTaskMenu } from './taskMenu';
import { textStyleProps } from '../lib/textStyle';
import { TextStyleButton } from './TextStyle';
import { DueButton, DueChip } from './DueButton';
import { StrikeButton } from './StrikeButton';

const Card = memo(function Card({ task, show, today, projectsById, checklistStatus }) {
  const dragging = useUI((u) => u.draggingId === task.id);
  const selecting = useUI((u) => u.selecting);
  const selected = useUI((u) => u.selectedId === task.id);
  const completing = useUI((u) => task.id in u.lingering && task.status === 'done');
  const key = taskKey(task.id);
  const picked = useUI((u) => u.selected.has(key));
  const kids = useChildTasks(task.id);
  const showChildAdd = useShowChildAdd(task.id);
  const hasMeta = Boolean(show.completed && task.completedAt);
  const showDue = Boolean(show.due && task.dueDate);
  const cls = [
    'card', selected && 'selected', picked && 'picked', task.status === 'done' && 'done', task.struck && 'struck', completing && 'completing', dragging && 'dragging',
  ].filter(Boolean).join(' ');
  // Clicking a task does nothing; its popup opens from the task menu's Edit or Enter. Bulk-select still picks cards.
  return (
    <div
      className={cls}
      data-task-row
      data-id={task.id}
      draggable={!selecting}
      onDragStart={(e) => startTaskDrag(e, task)}
      onDragEnd={endDrag}
      onClick={selecting ? () => toggleSelected(key) : undefined}
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
            <span
              className={`task-title-text ${textStyleProps(task.textStyle, task.struck).className}`}
              style={textStyleProps(task.textStyle, task.struck).style}
            >{task.title || 'Untitled'}</span>
          </span>
          <TaskProgress task={task} kids={kids} />
          <TaskPriority task={task} />
        </span>
        {!selecting && (
          <span className="card-actions">
            {showDue
              ? <DueChip value={task.dueDate} today={today} done={task.status === 'done'} onChange={(dueDate) => updateTask(task.id, { dueDate })} />
              : <DueButton value={task.dueDate} onChange={(dueDate) => updateTask(task.id, { dueDate })} />}
            <StrikeButton on={task.struck} onToggle={() => updateTask(task.id, { struck: !task.struck })} />
            <TextStyleButton
              className="card-style"
              value={task.textStyle}
              onChange={(textStyle) => updateTask(task.id, { textStyle })}
              label="Style task text"
            />
            <button
              type="button"
              className="icon-btn sm card-delete"
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
          <TaskMeta task={task} show={show} today={today} hidePriority hideDue />
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
  if (statsFilter && !model.groups.some((g) => g.headingVisible || g.tasks.length > 0 || g.checklistTask)) {
    return <EmptyState text={model.emptyText} />;
  }

  // Major headings use the same responsive board grid as other groups. Their
  // children stay inside each group, so a long tree grows downward instead
  // of creating a horizontal lane.
  const lanes = model.groups.some((g) => g.heading);

  return (
    <div className={`board${lanes ? ' board-lanes' : ''}`}>
      {model.groups.map((col) => {
        if (col.filteredEmpty) return null;
        const isTarget = target?.groupId === col.id;
        const useCardGrid = !col.heading && col.tasks.length > 1;
        // Every major task takes a full row of the board and lays its
        // sub-tasks out as a grid of boxes of their own.
        const wide = Boolean(col.heading);
        return (
          <section key={col.id} className={`column${col.heading ? ' column-lane' : ''}${wide ? ' column-wide' : ''}${useCardGrid ? ' column-card-grid' : ''}${isTarget ? ' drop-active' : ''}`} {...handlers(col)}>
            <header
              className="column-head"
              {...(col.heading ? { 'data-task-row': '', 'data-id': col.headingTask.id } : {})}
            >
              {col.statusId ? <StatusIcon status={col.statusId} size={13} /> : col.heading ? (
                <button
                  type="button"
                  className="icon-btn sm column-major-add"
                  aria-label={`Add sub-task to ${col.title}`}
                  onClick={() => focusSubtask(addSubtask(col.headingTask.id))}
                >
                  <Plus size={15} />
                </button>
              ) : col.color ? <ProjectDot color={col.color} /> : <Inbox size={14} strokeWidth={1.9} className="group-icon" />}
              {col.heading && (
                <Checkbox
                  state={col.headingTask.status}
                  onToggle={() => toggleComplete(col.headingTask.id)}
                />
              )}
              <span
                className={`group-title${col.heading && col.headingTask.status === 'done' ? ' done' : ''}${col.heading && col.headingTask.struck ? ' struck' : ''} ${textStyleProps(col.headingTask?.textStyle, col.headingTask?.struck).className}`}
                style={textStyleProps(col.headingTask?.textStyle, col.headingTask?.struck).style}
              >{col.title}</span>
              {(col.count ?? col.tasks.length) > 0 && <span className="group-count">{col.count ?? col.tasks.length}</span>}
              {col.heading && (col.headingTask.dueDate
                ? <DueChip value={col.headingTask.dueDate} today={today} done={col.headingTask.status === 'done'} onChange={(dueDate) => updateTask(col.headingTask.id, { dueDate })} />
                : <DueButton value={null} onChange={(dueDate) => updateTask(col.headingTask.id, { dueDate })} />)}
              {col.heading && <StrikeButton on={col.headingTask.struck} onToggle={() => updateTask(col.headingTask.id, { struck: !col.headingTask.struck })} />}
              {col.heading && <TextStyleButton
                className="column-style"
                value={col.headingTask.textStyle}
                onChange={(textStyle) => updateTask(col.headingTask.id, { textStyle })}
                label="Style heading text"
              />}
              {col.heading && (
                <button
                  type="button"
                  className="icon-btn sm column-delete"
                  aria-label="Delete major task"
                  onClick={() => deleteTask(col.headingTask.id)}
                >
                  <Trash2 size={14} strokeWidth={1.9} />
                </button>
              )}
              {col.add && !col.heading && (
                <button
                  type="button"
                  className="icon-btn sm column-add"
                  aria-label={col.heading ? `New sub-task in ${col.title}` : `New ${col.title.toLowerCase()} task`}
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
              {col.tasks.length === 0 && !col.checklistTask && (
                col.heading
                  ? <div className="column-empty column-heading-empty" aria-label="No subtasks" />
                  : <div className="column-empty">No sub-tasks · add one</div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
