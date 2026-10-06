import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CalendarDays, CheckSquare, CircleCheck, Columns3, Inbox, Layers, List, PanelLeftOpen, Plus, Sun, Trash2, X } from 'lucide-react';
import {
  confirmDeleteSelection, confirmDeleteTasks, getSpace, markSelectionDone, openMobileNav, openNewTask, parseSelectionKey, renameProject, setPref, setProjectMode,
  updateProject, setSectionMode, setSelecting, useUI,
} from '../store';
import { Board } from './Board';
import { Kbd, ProjectDot } from './bits';
import { MajorFilter } from './MajorFilter';
import { SectionStats } from './SectionStats';
import { TaskList } from './TaskList';
import { TrashView } from './TrashView';
import { TextStyleButton } from './TextStyle';
import { textStyleProps } from '../lib/textStyle';
import { flattenChecklist } from '../lib/checklist';
import { activeMajorId } from '../lib/views';
import { addSubtaskTo } from './Subtasks';

const VIEW_ICONS = { inbox: Inbox, today: Sun, upcoming: CalendarDays, all: Layers, completed: CircleCheck, trash: Trash2 };

const FILTER_EMPTY_TEXT = {
  todo: 'Nothing left to do here — everything is done.',
  done: 'You have done nothing till now. Start working and finish them off.',
};

/** Narrows a view's groups down to just the tasks matching the overview bar's active tab. */
function applyStatsFilter(model, filter) {
  const groups = model.groups.map((g) => {
    const tasks = g.statusId && g.statusId !== filter ? [] : g.tasks.filter((t) => t.status === filter);
    // In a major-task board, the group title is also a real task. Keep a
    // heading-only card visible when its own status matches the active tab.
    const headingVisible = Boolean(g.headingTask && g.headingTask.status === filter);
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
    const hasVisibleWork = headingVisible || tasks.length > 0 || completedChecklistParents.length > 0 || Boolean(checklistTask);
    // A group with nothing left after filtering has no business still showing
    // an "add" drop zone or a board column's empty placeholder.
    return {
      ...g,
      tasks,
      headingVisible,
      completedChecklistParents,
      checklistTask,
      checklistStatus: filter,
      add: filter === 'todo' && hasVisibleWork ? g.add : null,
      filteredEmpty: !hasVisibleWork,
    };
  });
  const taskIds = groups.flatMap((g) => [
    ...(g.headingVisible ? [g.headingTask.id] : []),
    ...g.tasks.map((t) => t.id),
  ]);
  const total = groups.reduce((count, g) => count + (g.headingVisible ? 1 : 0) + g.tasks.length + (g.completedChecklistParents || []).length, 0);
  return { ...model, groups, taskIds, total, emptyText: total === 0 ? FILTER_EMPTY_TEXT[filter] : model.emptyText };
}

/** Narrows a project's groups down to a single major task (and everything nested under it). */
function applyMajorFilter(model, majorId) {
  const groups = model.groups.map((g) => ({
    ...g,
    tasks: g.heading ? g.tasks : g.tasks.filter((t) => t.id === majorId),
    completedChecklistParents: (g.completedChecklistParents || []).filter((t) => t.id === majorId),
  })).filter((g) => !g.heading || g.headingTask.id === majorId);
  return { ...model, groups };
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
      <h1 className={`page-title editable ${textStyleProps(project.textStyle).className}`} style={textStyleProps(project.textStyle).style} onClick={() => setEditing(true)}>
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

  const majorFilter = useUI((u) => u.majorFilter);
  // A project with major tasks always shows exactly one of them: the picked
  // chip, or the first major task when nothing (or a deleted one) is picked.
  const activeMajor = activeMajorId(model, majorFilter);

  const filteredModel = useMemo(
    () => applyStatsFilter(activeMajor ? applyMajorFilter(model, activeMajor) : model, statsFilter),
    [model, statsFilter, activeMajor],
  );

  // With a major task showing, "+" adds a sub-task row to its box, not another major task.
  const newTask = () => (activeMajor ? addSubtaskTo(activeMajor) : openNewTask(model.newTaskDefaults));
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
        onClick={() => setSelecting(true, filteredModel.taskIds)}
      >
        <CheckSquare size={14} strokeWidth={1.9} /> Select all
      </button>
      <button
        type="button"
        className="btn btn-danger-ghost"
        disabled={model.taskIds.length === 0}
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
          <button type="button" className="icon-btn no-drag" aria-label="Show sidebar" onClick={() => (isMobile ? openMobileNav() : setPref('sidebarCollapsed', false))}>
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
                aria-label={activeMajor ? 'New sub-task' : 'New task'}
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
          {view === 'today' && getSpace() === 'demo' && (
            <div className="demo-banner" role="note">
              <strong>This is a demo workspace, not the original.</strong>
              <span>It starts empty. Anything added here stays only in this browser.</span>
            </div>
          )}
          <SectionStats stats={model.stats} />
          {!isTrash && (
            <MajorFilter
              majors={model.majorTasks}
              active={activeMajor}
              onAdd={() => openNewTask({ ...model.newTaskDefaults, isHeading: true })}
            />
          )}
          {isTrash ? <TrashView /> : isBoard ? <Board model={filteredModel} /> : <TaskList model={filteredModel} />}
        </div>
      </div>
    </main>
  );
}
