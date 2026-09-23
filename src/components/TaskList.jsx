import { Fragment, useMemo } from 'react';
import { ChevronRight, Inbox, Plus } from 'lucide-react';
import { openNewTask, toggleCollapsed, useData, useUI } from '../store';
import { useTaskDrop } from '../lib/dnd';
import { useToday } from '../lib/useToday';
import { ProjectDot, StatusIcon } from './bits';
import { TaskRow } from './TaskRow';

export function useProjectsById() {
  const projects = useData((s) => s.projects);
  return useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
}

/** Renders rows with a drop indicator at the hovered insertion point. */
export function withDropLine(tasks, draggingId, index, render) {
  let n = 0;
  const out = [];
  for (const t of tasks) {
    if (t.id !== draggingId) {
      if (n === index) out.push(<div key="__drop" className="drop-line" />);
      n += 1;
    }
    out.push(<Fragment key={t.id}>{render(t)}</Fragment>);
  }
  if (index != null && index >= n) out.push(<div key="__drop" className="drop-line" />);
  return out;
}

export function TaskList({ model }) {
  const { target, handlers } = useTaskDrop();
  const projectsById = useProjectsById();
  const draggingId = useUI((u) => u.draggingId);
  const today = useToday();
  const singleGroup = model.groups.length === 1 && !model.groups[0].title;

  return (
    <div className="task-list">
      {model.total === 0 && <EmptyState text={model.emptyText} />}
      {model.groups.map((g) => {
        const checklistParents = g.completedChecklistParents || [];
        const visible = g.tasks.length > 0 || checklistParents.length > 0 || g.add || (draggingId && g.patch);
        if (!visible) return null;
        const isTarget = target?.groupId === g.id;
        const collapsible = Boolean(g.title) && g.collapsible !== false;
        return (
          <section
            key={g.id}
            className={`group${singleGroup ? ' group-single' : ''}${isTarget && (target.index == null || !g.sortable || g.collapsed) ? ' drop-whole' : ''}`}
            {...handlers(g)}
          >
            {g.title && (
              <header
                className={`group-head${collapsible ? ' collapsible' : ''}`}
                onClick={collapsible ? () => toggleCollapsed(g.key) : undefined}
              >
                {collapsible && <ChevronRight className={`chev${g.collapsed ? '' : ' open'}`} size={14} strokeWidth={2} />}
                {g.statusId && <StatusIcon status={g.statusId} size={13} />}
                {g.color && <ProjectDot color={g.color} />}
                {g.icon === 'inbox' && <Inbox size={14} strokeWidth={1.9} className="group-icon" />}
                <span className="group-title">{g.title}</span>
                {g.sub && <span className="group-sub">{g.sub}</span>}
                <span className="group-count">{g.tasks.length + checklistParents.length}</span>
                {g.add && (
                  <button
                    type="button"
                    className="icon-btn sm group-add"
                    title={`New task in ${g.title}`}
                    aria-label={`New task in ${g.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (g.collapsed) toggleCollapsed(g.key);
                      openNewTask(g.add.defaults);
                    }}
                  >
                    <Plus size={15} strokeWidth={2} />
                  </button>
                )}
              </header>
            )}
            {!g.collapsed && (
              <div className="group-body">
                {withDropLine(g.tasks, draggingId, isTarget && g.sortable ? target.index : null, (t) => (
                  <TaskRow
                    task={t}
                    project={projectsById.get(t.projectId)}
                    show={{ ...model.show, completed: Boolean(g.showCompleted) }}
                    today={today}
                    draggable={Boolean(g.patch)}
                    depth={0}
                    projectsById={projectsById}
                    completedChecklistOnly={Boolean(g.showCompleted)}
                  />
                ))}
                {checklistParents.map((task) => (
                  <TaskRow
                    key={`completed-checklist:${task.id}`}
                    task={task}
                    project={projectsById.get(task.projectId)}
                    show={{ ...model.show, completed: true }}
                    today={today}
                    draggable={false}
                    depth={0}
                    projectsById={projectsById}
                    completedChecklistOnly
                  />
                ))}
                {g.tasks.length === 0 && checklistParents.length === 0 && (
                  <div className="group-empty">{g.patch ? 'No tasks · drop one here' : 'No tasks'}</div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function EmptyState({ text }) {
  return (
    <div className="empty">
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
        <rect x="9" y="9" width="26" height="26" rx="7" stroke="currentColor" strokeWidth="1.6" opacity=".55" />
        <path d="M16 22.5l4 4 8-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p>{text}</p>
    </div>
  );
}
