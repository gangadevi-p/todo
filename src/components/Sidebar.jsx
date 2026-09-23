import { useMemo, useRef, useState } from 'react';
import {
  CalendarDays, CircleCheck, CircleHelp, Ellipsis, Eraser, Inbox, Layers, Moon, PanelLeftClose, Pencil, Plus, Search, Sun, Trash2,
} from 'lucide-react';
import {
  askConfirm, confirmDeleteAll, deleteProject, findTask, navigate, openMenu, openNewProject, openSearch, placeProject, renameProject,
  setEditingProject, setHelp, setPref, toast, updateTask, useData, useUI,
} from '../store';
import { inToday, taskProgress } from '../lib/views';
import { drag, endDrag, startProjectDrag } from '../lib/dnd';
import { useToday } from '../lib/useToday';
import { useEffectiveTheme } from '../lib/useTheme';
import { plural } from '../lib/util';
import { Kbd, ProjectDot, ProjectRing } from './bits';
import { rectOf } from './MenuLayer';

const NAV = [
  { id: 'inbox', label: 'Inbox', icon: Inbox, drop: (t) => ({ projectId: null }), dropMsg: 'Moved to Inbox' },
  { id: 'today', label: 'Today', icon: Sun, drop: () => ({ addedToToday: true }), dropMsg: 'Added to Today' },
  { id: 'upcoming', label: 'Upcoming', icon: CalendarDays },
  { id: 'all', label: 'All Tasks', icon: Layers },
  { id: 'completed', label: 'Completed', icon: CircleCheck, drop: () => ({ status: 'done' }), dropMsg: 'Marked complete' },
  { id: 'trash', label: 'Trash', icon: Trash2 },
];

function NameInput({ initial = '', placeholder, onSubmit, onCancel }) {
  const [value, setValue] = useState(initial);
  // Enter/Esc unmount the input, which can also fire blur: only finish once.
  const finished = useRef(false);
  const finish = (fn) => {
    if (finished.current) return;
    finished.current = true;
    fn();
  };
  const done = () => finish(() => (value.trim() ? onSubmit(value.trim()) : onCancel()));
  const cancel = () => finish(onCancel);
  return (
    <input
      className="nav-input"
      autoFocus
      value={value}
      placeholder={placeholder}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={done}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Enter') { e.preventDefault(); done(); }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); }
      }}
    />
  );
}

/** Makes a sidebar item accept dropped tasks. */
function useTaskTarget(patchFor, message) {
  const [over, setOver] = useState(false);
  if (!patchFor) return [false, {}];
  return [
    over,
    {
      onDragOver(e) {
        if (drag.type !== 'task') return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!over) setOver(true);
      },
      onDragLeave(e) {
        if (!e.currentTarget.contains(e.relatedTarget)) setOver(false);
      },
      onDrop(e) {
        setOver(false);
        if (drag.type !== 'task') return;
        e.preventDefault();
        const task = findTask(drag.id);
        if (task) {
          updateTask(task.id, patchFor(task));
          if (message) toast(message);
        }
        endDrag();
      },
    },
  ];
}

function NavItem({ item, active, count }) {
  const [over, dropProps] = useTaskTarget(item.drop, item.dropMsg);
  return (
    <button
      type="button"
      className={`nav-item${active ? ' active' : ''}${over ? ' drop-over' : ''}`}
      onClick={() => navigate(item.id)}
      {...dropProps}
    >
      <item.icon size={16} strokeWidth={1.8} className={`nav-icon nav-icon-${item.id}`} />
      <span className="nav-label">{item.label}</span>
      {count ? <span className="nav-count">{count}</span> : null}
    </button>
  );
}

function ProjectItem({ project, active, count, progress, editing, onReorderTarget, dropLine }) {
  const [over, dropProps] = useTaskTarget(() => ({ projectId: project.id }), `Moved to ${project.name}`);

  const menuItems = [
    { label: 'Rename', icon: Pencil, onSelect: () => setEditingProject(project.id) },
    { label: 'Delete all tasks', icon: Eraser, danger: true, onSelect: () => confirmDeleteAll(project) },
    { divider: true },
    {
      label: 'Delete project',
      icon: Trash2,
      danger: true,
      onSelect: () =>
        askConfirm({
          title: `Delete “${project.name}”?`,
          body: count
            ? `Its ${plural(count, 'open task')} and any completed tasks will move to Inbox.`
            : 'The project will be removed. Any completed tasks move to Inbox.',
          confirmLabel: 'Delete project',
          onConfirm: () => deleteProject(project.id),
        }),
    },
  ];

  if (editing) {
    return (
      <div className="nav-item editing">
        <ProjectDot color={project.color} />
        <NameInput
          initial={project.name}
          onSubmit={(name) => { renameProject(project.id, name); setEditingProject(null); }}
          onCancel={() => setEditingProject(null)}
        />
      </div>
    );
  }

  return (
    <div className="nav-row" data-project-row data-id={project.id}>
      {dropLine === 'before' && <div className="drop-line nav-drop-line" />}
      <button
        type="button"
        className={`nav-item project-item${active ? ' active' : ''}${over ? ' drop-over' : ''}`}
        draggable
        onDragStart={(e) => startProjectDrag(e, project)}
        onDragEnd={endDrag}
        onClick={() => navigate(`project:${project.id}`)}
        onDoubleClick={() => setEditingProject(project.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          openMenu({ kind: 'menu', x: e.clientX, y: e.clientY, items: menuItems });
        }}
        onDragOver={(e) => {
          if (drag.type === 'project') onReorderTarget(e, project);
          else dropProps.onDragOver?.(e);
        }}
        onDragLeave={dropProps.onDragLeave}
        onDrop={(e) => {
          if (drag.type === 'project') return; // handled by the list
          dropProps.onDrop?.(e);
        }}
      >
        <span className="nav-icon project-icon" title={`${Math.round(progress * 100)}% done`}>
          <ProjectRing color={project.color} progress={progress} />
        </span>
        <span className="nav-label">{project.name}</span>
        {count ? <span className="nav-count">{count}</span> : null}
        <span
          className="nav-more"
          role="button"
          title="Project options"
          onClick={(e) => {
            e.stopPropagation();
            openMenu({ kind: 'menu', rect: rectOf(e.currentTarget), items: menuItems });
          }}
        >
          <Ellipsis size={15} />
        </span>
      </button>
      {dropLine === 'after' && <div className="drop-line nav-drop-line" />}
    </div>
  );
}

export function Sidebar({ view }) {
  const tasks = useData((s) => s.tasks);
  const trash = useData((s) => s.trash || []);
  const projects = useData((s) => s.projects);
  const editingId = useUI((u) => u.editingProjectId);
  const theme = useData((s) => s.prefs.theme);
  const effectiveTheme = useEffectiveTheme(theme);
  const today = useToday();
  const [projectDrop, setProjectDrop] = useState(null); // { id, side }

  const sorted = useMemo(() => [...projects].sort((a, b) => a.order - b.order), [projects]);
  const counts = useMemo(() => {
    const c = { inbox: 0, today: 0, projects: {} };
    for (const t of tasks) {
      if (t.projectId) {
        const p = (c.projects[t.projectId] ??= { open: 0, total: 0, progress: 0 });
        p.total += 1;
        p.progress += taskProgress(t, (x) => x.status);
        if (t.status !== 'done') p.open += 1;
      } else if (t.status !== 'done') {
        c.inbox += 1;
      }
      if (t.status !== 'done' && inToday(t, today)) c.today += 1;
    }
    return c;
  }, [tasks, today]);

  const onReorderTarget = (e, project) => {
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const side = e.clientY < r.top + r.height / 2 ? 'before' : 'after';
    if (projectDrop?.id !== project.id || projectDrop?.side !== side) setProjectDrop({ id: project.id, side });
  };

  const onProjectListDrop = (e) => {
    if (drag.type !== 'project' || !projectDrop) return;
    e.preventDefault();
    const list = sorted.filter((p) => p.id !== drag.id);
    const idx = list.findIndex((p) => p.id === projectDrop.id);
    const at = projectDrop.side === 'before' ? idx : idx + 1;
    placeProject(drag.id, list[at - 1]?.id ?? null, list[at]?.id ?? null);
    setProjectDrop(null);
    endDrag();
  };

  return (
    <nav className="sidebar">
      <div className="sidebar-top drag-region">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 20 20" width="20" height="20">
              <rect x="1" y="1" width="18" height="18" rx="5.5" fill="currentColor" />
              <path d="M6 10.4l2.7 2.7L14.2 7.4" fill="none" stroke="var(--bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="brand-name">Gani's Work</span>
        </div>
        <button type="button" className="icon-btn no-drag sidebar-collapse" title="Hide sidebar (Ctrl \)" onClick={() => setPref('sidebarCollapsed', true)}>
          <PanelLeftClose size={16} strokeWidth={1.8} />
        </button>
      </div>

      <div className="sidebar-scroll">
        <button type="button" className="nav-item search-item" onClick={openSearch}>
          <Search size={16} strokeWidth={1.8} className="nav-icon" />
          <span className="nav-label">Search</span>
          <Kbd keys="mod+K" />
        </button>

        <div className="nav-group">
          {NAV.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              active={view === item.id}
              count={item.id === 'inbox' ? counts.inbox : item.id === 'today' ? counts.today : item.id === 'trash' ? trash.length : 0}
            />
          ))}
        </div>

        <div className="nav-section">
          <span>Projects</span>
          <button type="button" className="icon-btn sm" title="New project" onClick={openNewProject}>
            <Plus size={15} />
          </button>
        </div>

        <div
          className="nav-group projects"
          onDragOver={(e) => { if (drag.type === 'project') e.preventDefault(); }}
          onDrop={onProjectListDrop}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setProjectDrop(null); }}
        >
          {sorted.map((p) => (
            <ProjectItem
              key={p.id}
              project={p}
              active={view === `project:${p.id}`}
              count={counts.projects[p.id]?.open || 0}
              progress={counts.projects[p.id] ? counts.projects[p.id].progress / counts.projects[p.id].total : 0}
              editing={editingId === p.id}
              onReorderTarget={onReorderTarget}
              dropLine={projectDrop?.id === p.id && drag.type === 'project' ? projectDrop.side : null}
            />
          ))}
          {!sorted.length && (
            <button type="button" className="nav-item muted" onClick={openNewProject}>
              <Plus size={15} className="nav-icon" />
              <span className="nav-label">New project</span>
            </button>
          )}
        </div>
      </div>

      <div className="sidebar-foot">
        <div className="nav-item muted theme-row">
          {effectiveTheme === 'dark' ? (
            <Moon size={16} strokeWidth={1.8} className="nav-icon" />
          ) : (
            <Sun size={16} strokeWidth={1.8} className="nav-icon" />
          )}
          <span className="nav-label">{effectiveTheme === 'dark' ? 'Dark theme' : 'Light theme'}</span>
          <button
            type="button"
            className={`switch${effectiveTheme === 'dark' ? ' on' : ''}`}
            role="switch"
            aria-checked={effectiveTheme === 'dark'}
            title="Switch between light and dark theme"
            onClick={() => setPref('theme', effectiveTheme === 'dark' ? 'light' : 'dark')}
          >
            <span />
          </button>
        </div>
        <button type="button" className="nav-item muted" onClick={() => setHelp(true)}>
          <CircleHelp size={16} strokeWidth={1.8} className="nav-icon" />
          <span className="nav-label">Shortcuts</span>
          <Kbd keys="?" />
        </button>
      </div>
    </nav>
  );
}
