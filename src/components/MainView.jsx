import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CalendarDays, CheckSquare, CircleCheck, Columns3, Inbox, Layers, List, PanelLeftOpen, Plus, Sun, Trash2, X } from 'lucide-react';
import {
  confirmDeleteSelection, confirmDeleteTasks, markSelectionDone, openMobileNav, openNewTask, parseSelectionKey, renameProject, setPref, setProjectMode,
  updateProject, setSectionMode, setSelecting, useUI,
} from '../store';
import { Board } from './Board';
import { Kbd, ProjectDot } from './bits';
import { SectionStats } from './SectionStats';
import { TaskList } from './TaskList';
import { TrashView } from './TrashView';
import { TextStyleButton } from './TextStyle';
import { textStyleProps } from '../lib/textStyle';
import { flattenChecklist } from '../lib/checklist';

const VIEW_ICONS = { inbox: Inbox, today: Sun, upcoming: CalendarDays, all: Layers, completed: CircleCheck, trash: Trash2 };

const FILTER_EMPTY_TEXT = {
  todo: 'Nothing left to do here — everything is done.',
  done: 'You have done nothing till now. Start working and finish them off.',
};

/** Narrows a view's groups down to just the tasks matching the overview bar's active tab. */
function applyStatsFilter(model, filter) {
  const groups = model.groups.map((g) => {
    const tasks = g.statusId && g.statusId !== filter ? [] : g.tasks.filter((t) => t.status === filter);
    const canShowChecklistParents = filter === 'done' && (!g.statusId || g.statusId === 'done');
    const parentCandidates = [
      ...(g.completedChecklistParents || []),
      ...(canShowChecklistParents ? g.tasks.filter((task) =>
        task.status !== 'done' && flattenChecklist(task.subtasks).some((item) => item.done)) : []),
    ];
    const completedChecklistParents = canShowChecklistParents
      ? [...new Map(parentCandidates.map((task) => [task.id, task])).values()]
      : [];
    const checklistTask = g.checklistTask && flattenChecklist(g.checklistTask.subtasks)
      .some((item) => filter === 'done' ? item.done : !item.done)
      ? g.checklistTask
      : null;
    const hasVisibleWork = tasks.length > 0 || completedChecklistParents.length > 0 || Boolean(checklistTask);
    // A group with nothing left after filtering has no business still showing
    // an "add" drop zone or a board column's empty placeholder.
    return {
      ...g,
      tasks,
      completedChecklistParents,
      checklistTask,
      checklistStatus: filter,
      add: filter === 'todo' && hasVisibleWork ? g.add : null,
      filteredEmpty: !hasVisibleWork,
    };
  });
  const taskIds = groups.flatMap((g) => g.tasks.map((t) => t.id));
  const total = groups.reduce((count, g) => count + g.tasks.length + (g.completedChecklistParents || []).length, 0);
  return { ...model, groups, taskIds, total, emptyText: total === 0 ? FILTER_EMPTY_TEXT[filter] : model.emptyText };
}

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
      <h1 className={`page-title editable ${textStyleProps(project.textStyle).className}`} style={textStyleProps(project.textStyle).style} title="Click to rename" onClick={() => setEditing(true)}>
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
      className={`page-title page-title-input ${textStyleProps(project.textStyle).className}`}
      style={textStyleProps(project.textStyle).style}
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

export function MainView({ model, sidebarCollapsed, isMobile = false }) {
  const scrollRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const view = useUI((u) => u.view);
  const statsFilter = useUI((u) => u.statsFilter);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setScrolled(false);
  }, [view]);

  const filteredModel = useMemo(() => applyStatsFilter(model, statsFilter), [model, statsFilter]);

  const newTask = () => openNewTask(model.newTaskDefaults);
  const isBoard = model.mode === 'board';
  const isTrash = model.kind === 'trash';
  const setMode = (mode) => (model.project ? setProjectMode(model.project.id, mode) : setSectionMode(model.id, mode));
  const selecting = useUI((u) => u.selecting);
  const selected = useUI((u) => u.selected);

  const pageActions = selecting ? (
    <>
      <span className="select-count">{selected.size ? `${selected.size} selected` : 'Select tasks or subtasks'}</span>
      <button
        type="button"
        className="btn"
        disabled={selected.size === 0}
        onClick={() => markSelectionDone([...selected].map(parseSelectionKey))}
      >
        <Check size={14} strokeWidth={2} /> Mark done
      </button>
      <button
        type="button"
        className="btn btn-danger-ghost"
        disabled={selected.size === 0}
        onClick={() => confirmDeleteSelection([...selected])}
      >
        <Trash2 size={14} strokeWidth={1.9} /> Delete
      </button>
      <button type="button" className="btn" onClick={() => setSelecting(false)}>
        <X size={14} strokeWidth={2} /> Cancel
      </button>
    </>
  ) : isTrash ? null : (
    <>
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
        className="btn"
        disabled={model.taskIds.length === 0}
        title="Select every task on this page, then mark them done or delete them together"
        onClick={() => setSelecting(true, filteredModel.taskIds)}
      >
        <CheckSquare size={14} strokeWidth={1.9} /> Select all
      </button>
      <button
        type="button"
        className="btn btn-danger-ghost"
        disabled={model.taskIds.length === 0}
        title={`Delete every task on this page`}
        onClick={() => confirmDeleteTasks(filteredModel.taskIds, model.deleteScope, model.deleteNote)}
      >
        <Trash2 size={14} strokeWidth={1.9} /> Delete all
      </button>
    </>
  );

  return (
    <main className="main">
      <div className={`topbar drag-region${scrolled ? ' scrolled' : ''}`}>
        {sidebarCollapsed && (
          <button type="button" className="icon-btn no-drag" title="Show sidebar" onClick={() => (isMobile ? openMobileNav() : setPref('sidebarCollapsed', false))}>
            <PanelLeftOpen size={16} strokeWidth={1.8} />
          </button>
        )}
        <div className={`crumb${scrolled ? ' visible' : ''}`}>
          <ViewIcon model={model} size={14} />
          <span>{model.title}</span>
        </div>
      </div>

      <div className="main-scroll" ref={scrollRef} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 40)}>
        <div className={`page view-${model.kind}${isBoard ? ' page-board' : ''}`}>
          <header className="page-head">
            <div className="page-icon"><ViewIcon model={model} size={20} /></div>
            <div className="page-title-line">
              {model.project ? <ProjectTitle key={model.project.id} project={model.project} /> : <h1 className="page-title">{model.title}</h1>}
              {model.project && <TextStyleButton value={model.project.textStyle} onChange={(textStyle) => updateProject(model.project.id, { textStyle })} label="Style project name" />}
              {!isTrash && <button
                type="button"
                className="icon-btn page-add"
                onClick={newTask}
                title="New task"
                aria-label="New task"
              >
                <Plus size={17} strokeWidth={2.2} />
              </button>}
            </div>
            {pageActions && <div className="page-head-actions no-drag">{pageActions}</div>}
            {(model.subtitle || (model.kind === 'inbox' && model.total === 0)) && (
              <p className="page-sub">
                {model.subtitle}
                {model.kind === 'inbox' && model.total === 0 && (
                  <span className="page-hint"> · Quick add <Kbd keys="mod+N" /></span>
                )}
              </p>
            )}
          </header>
          <SectionStats stats={model.stats} />
          {isTrash ? <TrashView /> : isBoard ? <Board model={filteredModel} /> : <TaskList model={filteredModel} />}
        </div>
      </div>
    </main>
  );
}
