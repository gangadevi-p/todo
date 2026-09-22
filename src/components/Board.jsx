import { memo } from 'react';
import { Plus } from 'lucide-react';
import { activateTask, focusTaskTitle, hoverTask, leaveTask, openNewTask, taskKey, toggleComplete, toggleSelected, useChildTasks, useUI } from '../store';
import { endDrag, startTaskDrag, useTaskDrop } from '../lib/dnd';
import { useToday } from '../lib/useToday';
import { Checkbox, StatusIcon } from './bits';
import { ChildTaskList, useShowChildAdd } from './ChildTasks';
import { SubtaskTree } from './Subtasks';
import { TaskMeta } from './TaskRow';
import { useProjectsById, withDropLine } from './TaskList';
import { openTaskMenu } from './taskMenu';

const Card = memo(function Card({ task, project, show, today, projectsById }) {
  const dragging = useUI((u) => u.draggingId === task.id);
  const selecting = useUI((u) => u.selecting);
  const selected = useUI((u) => u.selectedId === task.id);
  const completing = useUI((u) => task.id in u.lingering && task.status === 'done');
  const key = taskKey(task.id);
  const picked = useUI((u) => u.selected.has(key));
  const kids = useChildTasks(task.id);
  const showChildAdd = useShowChildAdd(task.id);
  const hasMeta = task.priority || task.dueDate || task.subtasks.length || task.notes.trim() || task.addedToToday;
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
        <Checkbox
          state={selecting ? (picked ? 'done' : 'todo') : task.status}
          onToggle={() => (selecting ? toggleSelected(key) : toggleComplete(task.id))}
        />
        <span className="card-title">{task.title || 'Untitled'}</span>
      </div>
      {hasMeta ? (
        <div className="card-meta">
          <TaskMeta task={task} project={project} show={show} today={today} />
        </div>
      ) : null}
      {(kids.length > 0 || showChildAdd) && (
        <ChildTaskList task={task} kids={kids} depth={1} show={show} today={today} projectsById={projectsById} />
      )}
      {task.subtasks.length > 0 && <SubtaskTree task={task} variant="card" />}
    </div>
  );
});

export function Board({ model }) {
  const { target, handlers } = useTaskDrop();
  const projectsById = useProjectsById();
  const draggingId = useUI((u) => u.draggingId);
  const today = useToday();

  return (
    <div className="board">
      {model.groups.map((col) => {
        const isTarget = target?.groupId === col.id;
        return (
          <section key={col.id} className={`column${isTarget ? ' drop-active' : ''}`} {...handlers(col)}>
            <header className="column-head">
              <StatusIcon status={col.statusId} size={13} />
              <span className="group-title">{col.title}</span>
              <span className="group-count">{col.tasks.length}</span>
              {col.add && (
                <button
                  type="button"
                  className="icon-btn sm column-add"
                  title={`New ${col.title.toLowerCase()} task`}
                  onClick={() => openNewTask(col.add.defaults)}
                >
                  <Plus size={15} />
                </button>
              )}
            </header>
            <div className="column-body">
              {withDropLine(col.tasks, draggingId, isTarget && col.sortable ? target.index : null, (t) => (
                <Card
                  task={t}
                  project={projectsById.get(t.projectId)}
                  show={model.show}
                  today={today}
                  projectsById={projectsById}
                />
              ))}
              {col.tasks.length === 0 && <div className="column-empty">No tasks · drop one here</div>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
