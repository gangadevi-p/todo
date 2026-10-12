import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CalendarDays, CheckSquare, CircleCheck, Columns3, Layers, List, PanelLeftOpen, Plus, Sun, Trash2, X } from 'lucide-react';
import {
  confirmDeleteSelection, confirmDeleteTasks, getSpace, markSelectionDone, openEditProject, openMobileNav, openNewTask, parseSelectionKey, renameProject, setPref, setProjectMode,
  updateProject, setSectionMode, setSelecting, useUI,
} from '../store';
import { Board } from './Board';
import { Kbd, ProjectDot } from './bits';
import { MajorFilter } from './MajorFilter';
import { SectionStats } from './SectionStats';
import { TaskList, useProjectsById } from './TaskList';
import { TrashView } from './TrashView';
import { TextStyleButton } from './TextStyle';
import { textStyleProps } from '../lib/textStyle';
import { activeMajorId, applyStatsFilter, shownMajors } from '../lib/views';
import { addForPage, isMajorBoard } from '../lib/pageAdd';

const VIEW_ICONS = { today: Sun, upcoming: CalendarDays, all: Layers, completed: CircleCheck, trash: Trash2 };

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
  const Icon = VIEW_ICONS[model.kind] || Layers;
  return <Icon size={size} strokeWidth={1.8} />;
}

function ProjectTitle({ project }) {
  return (
    <h1
      className={`page-title editable ${textStyleProps(project.textStyle).className}`}
      style={textStyleProps(project.textStyle).style}
      title="Click to edit the project"
      onClick={() => openEditProject(project.id)}
    >
      {project.name}
    </h1>
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
  // The chips follow the picked todo / done tab: a finished major task with
  // nothing left to do is listed under "done", not among the active ones.
  const chipModel = useMemo(
    () => ({ ...model, majorTasks: shownMajors(model, statsFilter) }),
    [model, statsFilter],
  );
  // A project with major tasks always shows exactly one of them: the picked
  // chip, or the first major task when nothing (or a deleted one) is picked.
  const activeMajor = activeMajorId(chipModel, majorFilter);

  const filteredModel = useMemo(
    () => applyStatsFilter(activeMajor ? applyMajorFilter(model, activeMajor) : model, statsFilter),
    [model, statsFilter, activeMajor],
  );

  // On a project's Board "+" adds a major task first, then a box under the one showing.
  const newTask = () => addForPage(model, activeMajor);
  const isBoard = model.mode === 'board';
  const isTrash = model.kind === 'trash';
  const projectBoard = isMajorBoard(model);
  const projectsById = useProjectsById();
  const canAddMajor = projectBoard && model.kind !== 'completed';
  // A major task with many boxes widens the whole page to the board; a few keep the centred column.
  const shownGroup = projectBoard ? model.groups.find((g) => g.headingTask && g.headingTask.id === activeMajor) : null;
  const wideBoard = Boolean(shownGroup) && shownGroup.tasks.length + (shownGroup.checklistTask ? 1 : 0) >= 3;
  const noMajors = canAddMajor && model.majorTasks.length === 0;
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
          aria-label="List"
          title="List"
          className={!isBoard ? 'on' : ''}
          onClick={() => setMode('list')}
        >
          <List size={14} strokeWidth={1.9} />
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isBoard}
          aria-label="Board"
          title="Board"
          className={isBoard ? 'on' : ''}
          onClick={() => setMode('board')}
        >
          <Columns3 size={14} strokeWidth={1.9} />
        </button>
      </div>
      <button
        type="button"
        className="btn btn-icon"
        aria-label="Select all"
        title="Select all"
        disabled={model.taskIds.length === 0}
        onClick={() => setSelecting(true, filteredModel.taskIds)}
      >
        <CheckSquare size={14} strokeWidth={1.9} />
      </button>
      <button
        type="button"
        className="btn btn-icon btn-danger-ghost"
        aria-label="Delete all"
        title="Delete all"
        disabled={model.taskIds.length === 0}
        onClick={() => confirmDeleteTasks(filteredModel.taskIds, model.deleteScope, model.deleteNote)}
      >
        <Trash2 size={14} strokeWidth={1.9} />
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
        <div className={`page view-${model.kind}${isBoard ? ' page-board' : ''}${isBoard && wideBoard ? ' page-wide' : ''}`}>
          <header className="page-head">
            <div className="page-icon"><ViewIcon model={model} size={20} /></div>
            <div className="page-title-line">
              {model.project ? <ProjectTitle key={model.project.id} project={model.project} /> : <h1 className="page-title">{model.title}</h1>}
              {!isTrash && <button
                type="button"
                className="icon-btn page-add"
                onClick={newTask}
                aria-label={activeMajor ? 'New box' : canAddMajor ? 'New major task' : 'New task'}
              >
                <Plus size={17} strokeWidth={2.2} />
              </button>}
            </div>
            <SectionStats stats={model.stats} />
            {pageActions && <div className="page-head-actions no-drag">{pageActions}</div>}
            {model.subtitle && (
              <p className="page-sub">
                {model.subtitle}
              </p>
            )}
          </header>
          {view === 'today' && getSpace() === 'demo' && (
            <div className="demo-banner" role="note">
              <strong>This is a demo workspace, not the original.</strong>
              <span>It starts empty. Anything added here stays only in this browser.</span>
            </div>
          )}
          {!isTrash && (
            <MajorFilter
              majors={projectBoard ? chipModel.majorTasks : null}
              active={activeMajor}
              onAdd={canAddMajor ? () => openNewTask({ ...model.newTaskDefaults, isHeading: true }) : undefined}
              projectsById={model.kind === 'all' ? projectsById : null}
            />
          )}
          {isTrash ? <TrashView /> : noMajors ? (
            <div className="major-empty">
              <p>Start with a major task: the big piece of work in this project. Boxes and sub-tasks go inside it.</p>
              <button type="button" className="btn" onClick={() => openNewTask({ ...model.newTaskDefaults, isHeading: true })}>
                <Plus size={14} strokeWidth={2} /> Add major task
              </button>
            </div>
          ) : isBoard ? <Board model={filteredModel} /> : <TaskList model={filteredModel} />}
        </div>
      </div>
    </main>
  );
}
