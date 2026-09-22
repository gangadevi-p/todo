import { useEffect, useRef, useState } from 'react';
import { CalendarDays, CircleCheck, Columns3, Inbox, Layers, List, PanelLeftOpen, Plus, Sun, Trash2 } from 'lucide-react';
import { confirmDeleteTasks, openNewTask, renameProject, setPref, setProjectMode, setSectionMode, useUI } from '../store';
import { Board } from './Board';
import { Kbd, ProjectDot } from './bits';
import { SectionStats } from './SectionStats';
import { TaskList } from './TaskList';

const VIEW_ICONS = { inbox: Inbox, today: Sun, upcoming: CalendarDays, all: Layers, completed: CircleCheck };

function ViewIcon({ model, size = 15 }) {
  if (model.project) return <ProjectDot color={model.project.color} size={size >= 20 ? 12 : 9} />;
  const Icon = VIEW_ICONS[model.kind] || Inbox;
  return <Icon size={size} strokeWidth={1.8} />;
}

function ProjectTitle({ project }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(project.name);
  useEffect(() => setValue(project.name), [project.name]);
  if (!editing) {
    return (
      <h1 className="page-title editable" title="Click to rename" onClick={() => setEditing(true)}>
        {project.name}
      </h1>
    );
  }
  const commit = () => {
    if (value.trim()) renameProject(project.id, value);
    else setValue(project.name);
    setEditing(false);
  };
  return (
    <input
      className="page-title page-title-input"
      autoFocus
      value={value}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          e.stopPropagation();
          setValue(project.name);
          setEditing(false);
        }
      }}
    />
  );
}

export function MainView({ model, sidebarCollapsed }) {
  const scrollRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const view = useUI((u) => u.view);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setScrolled(false);
  }, [view]);

  const newTask = () => openNewTask(model.newTaskDefaults);
  const isBoard = model.mode === 'board';
  const setMode = (mode) => (model.project ? setProjectMode(model.project.id, mode) : setSectionMode(model.id, mode));

  return (
    <main className="main">
      <div className={`topbar drag-region${scrolled ? ' scrolled' : ''}`}>
        {sidebarCollapsed && (
          <button type="button" className="icon-btn no-drag" title="Show sidebar (Ctrl \)" onClick={() => setPref('sidebarCollapsed', false)}>
            <PanelLeftOpen size={16} strokeWidth={1.8} />
          </button>
        )}
        <div className={`crumb${scrolled ? ' visible' : ''}`}>
          <ViewIcon model={model} size={14} />
          <span>{model.title}</span>
        </div>
        <div className="topbar-actions no-drag">
          <div className="segmented" role="tablist" aria-label="Layout">
            <button
              type="button"
              role="tab"
              aria-selected={!isBoard}
              className={!isBoard ? 'on' : ''}
              onClick={() => setMode('list')}
            >
              <List size={14} strokeWidth={1.9} /> List
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isBoard}
              className={isBoard ? 'on' : ''}
              onClick={() => setMode('board')}
            >
              <Columns3 size={14} strokeWidth={1.9} /> Board
            </button>
          </div>
          <button
            type="button"
            className="btn btn-danger-ghost"
            disabled={model.taskIds.length === 0}
            title={`Delete every task on this page`}
            onClick={() => confirmDeleteTasks(model.taskIds, model.deleteScope, model.deleteNote)}
          >
            <Trash2 size={14} strokeWidth={1.9} /> Delete all
          </button>
          <button type="button" className="btn btn-primary" onClick={newTask} title="New task (N)">
            <Plus size={15} strokeWidth={2.2} /> New Task
          </button>
        </div>
      </div>

      <div className="main-scroll" ref={scrollRef} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 40)}>
        <div className={`page view-${model.kind}${isBoard ? ' page-board' : ''}`}>
          <header className="page-head">
            <div className="page-icon"><ViewIcon model={model} size={20} /></div>
            {model.project ? <ProjectTitle key={model.project.id} project={model.project} /> : <h1 className="page-title">{model.title}</h1>}
            <p className="page-sub">
              {model.subtitle}
              {model.kind === 'inbox' && model.total === 0 && (
                <span className="page-hint"> · Quick add <Kbd keys="mod+N" /></span>
              )}
            </p>
          </header>
          <SectionStats stats={model.stats} />
          {isBoard ? <Board model={model} /> : <TaskList model={model} />}
        </div>
      </div>
    </main>
  );
}
