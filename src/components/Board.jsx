import { memo } from 'react';
import { Plus } from 'lucide-react';
import { activateTask, focusTaskTitle, hoverTask, leaveTask, openNewTask, toggleComplete, useUI } from '../store';
import { endDrag, startTaskDrag, useTaskDrop } from '../lib/dnd';
import { useToday } from '../lib/useToday';
import { Checkbox, StatusIcon } from './bits';
import { TaskMeta } from './TaskRow';
import { useProjectsById, withDropLine } from './TaskList';
import { openTaskMenu } from './taskMenu';

const Card = memo(function Card({ task, project, show, today, selected, completing }) {
  const dragging = useUI((u) => u.draggingId === task.id);
  const hasMeta = task.priority || task.dueDate || task.subtasks.length || task.notes.trim() || task.addedToToday;
  const cls = ['card', selected && 'selected', task.status === 'done' && 'done', completing && 'completing', dragging && 'dragging']
    .filter(Boolean).join(' ');
  return (
    <div
      className={cls}
      data-task-row
      data-id={task.id}
      draggable
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
      <div className="card-main">
        <Checkbox state={task.status} onToggle={() => toggleComplete(task.id)} />
        <span className="card-title">{task.title || 'Untitled'}</span>
      </div>
      {hasMeta ? (
        <div className="card-meta">
          <TaskMeta task={task} project={project} show={show} today={today} />
        </div>
      ) : null}
    </div>
  );
});

export function Board({ model }) {
  const { target, handlers } = useTaskDrop();
  const projectsById = useProjectsById();
  const selectedId = useUI((u) => u.selectedId);
  const lingering = useUI((u) => u.lingering);
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
                  selected={t.id === selectedId}
                  completing={t.id in lingering && t.status === 'done'}
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
