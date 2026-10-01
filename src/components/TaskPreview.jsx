import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CalendarDays, CircleCheck, Inbox, ListChecks, Pencil, Sun } from 'lucide-react';
import {
  childTasks, hidePreview, keepPreview, leaveTask, selectTask, toggleComplete, updateSubtask, useData, useUI,
} from '../store';
import { dueLabel, dueLabelLong } from '../lib/dates';
import { priorityLabel, statusLabel } from '../lib/util';
import { useToday } from '../lib/useToday';
import { Checkbox, PriorityIcon, ProjectDot, StatusIcon } from './bits';
import { textStyleProps } from '../lib/textStyle';

const WIDTH = 340;
const GAP = 10;
const CONTROLS = 150; // width reserved for a row's icon cluster

// Where the pointer last was, so the popup opens beside what's being hovered.
const pointer = { x: -1, y: -1 };
if (typeof window !== 'undefined') {
  window.addEventListener('mousemove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true, capture: true });
}

/**
 * Read-only overview shown beside what you hover. Hovering a task shows that
 * task and all of its sub-tasks; hovering one of its checklist items shows that
 * item alone, with its own nested items. Each one gets its own popup.
 */
export function TaskPreview() {
  const preview = useUI((u) => u.preview);
  const task = useData((s) => (preview ? s.tasks.find((t) => t.id === preview.id) : null));
  if (!preview || !task) return null;
  if (preview.subId) {
    const item = findItem(task.subtasks, preview.subId);
    if (!item) return null;
    return <ItemPreviewCard key={`${task.id}/${item.id}`} task={task} item={item} pinned={preview.pinned} />;
  }
  return <TaskPreviewCard key={task.id} task={task} pinned={preview.pinned} />;
}

function findItem(list = [], id) {
  for (const item of list) {
    if (item.id === id) return item;
    const nested = findItem(item.subtasks, id);
    if (nested) return nested;
  }
  return null;
}

// Outline of everything under a task: nested tasks first, then checklist items, each level indented.
function checklistLines(taskId, items = [], depth = 0) {
  return items.flatMap((it) => [
    {
      key: `s${it.id}`,
      title: it.title,
      done: it.done,
      struck: it.struck,
      due: it.dueDate,
      depth,
      toggle: () => updateSubtask(taskId, it.id, { done: !it.done, completedAt: it.done ? null : Date.now() }),
    },
    ...checklistLines(taskId, it.subtasks, depth + 1),
  ]);
}

function taskLines(task, tasks, depth = 0) {
  const lines = [];
  for (const child of childTasks(task.id, tasks)) {
    lines.push({
      key: `t${child.id}`,
      title: child.title,
      done: child.status === 'done',
      struck: child.struck,
      due: child.dueDate,
      depth,
      toggle: () => toggleComplete(child.id),
    });
    lines.push(...taskLines(child, tasks, depth + 1));
  }
  lines.push(...checklistLines(task.id, task.subtasks, depth));
  return lines;
}

/** Keeps the popup beside its anchor, inside the window, and attached when the page moves. */
function usePlacement(anchorSelector, pinned, deps) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const [tick, setTick] = useState(0);
  const grab = useRef(null); // pointer offset inside the anchor when the popup opened

  // Open right beside the cursor: to its right when there's room, otherwise to
  // its left, level with the hovered text so the mouse can slide straight into it.
  // The offset is kept so a pinned popup follows its anchor when the list moves.
  useLayoutEffect(() => {
    const el = ref.current;
    const anchor = document.querySelector(anchorSelector);
    if (!el || !anchor) {
      hidePreview();
      return;
    }
    const r = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const h = el.offsetHeight;
    if (!grab.current) {
      const inside = pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
      grab.current = inside ? { dx: pointer.x - r.left, dy: pointer.y - r.top } : { dx: r.width / 2, dy: r.height / 2 };
    }
    const px = r.left + grab.current.dx;
    const py = r.top + grab.current.dy;
    // Stay clear of the row's calendar / colour / delete icons on its right: if the popup would
    // cover them, open to the left of the cursor instead so they stay reachable.
    const controlsLeft = r.right - CONTROLS;
    const roomRight = px + GAP + WIDTH <= Math.min(vw - 8, controlsLeft);
    const roomLeft = px - GAP - WIDTH >= 8;
    const useRight = roomRight || (!roomLeft && px + GAP + WIDTH <= vw - 8);
    const left = Math.max(8, Math.min(useRight ? px + GAP : px - GAP - WIDTH, vw - WIDTH - 8));
    const top = Math.max(8, Math.min(Math.max(r.top - 6, py - 24), vh - h - 8));
    setPos({ left, top });
  }, [anchorSelector, tick, ...deps]);

  useEffect(() => {
    const onScroll = (e) => {
      // Scrolling the popup itself (a long list of sub-tasks) must not close it.
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return;
      if (pinned) setTick((t) => t + 1);
      else hidePreview();
    };
    const onResize = () => setTick((t) => t + 1);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [pinned]);

  // A pinned popup closes when you click anywhere that isn't a task or the popup.
  useEffect(() => {
    if (!pinned) return undefined;
    const onDown = (e) => {
      if (!e.target.closest?.('.preview, [data-task-row], [data-sub-row], .floating, .overlay')) hidePreview();
    };
    window.addEventListener('mousedown', onDown, true);
    return () => window.removeEventListener('mousedown', onDown, true);
  }, [pinned]);

  return { ref, pos };
}

function Shell({ placement, pinned, children }) {
  const { ref, pos } = placement;
  return (
    <div
      ref={ref}
      className={`preview${pinned ? ' pinned' : ''}`}
      style={pos ? { left: pos.left, top: pos.top, width: WIDTH } : { left: -9999, top: -9999, width: WIDTH, visibility: 'hidden' }}
      onMouseEnter={keepPreview}
      onMouseLeave={leaveTask}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
}

/** The indented list of sub-tasks, with a progress bar. */
function Outline({ label, lines, today }) {
  const doneCount = lines.filter((l) => l.done).length;
  return (
    <div className="preview-section">
      <div className="section-label">
        <span>{label}</span>
        <span className="preview-count">{doneCount}/{lines.length}</span>
      </div>
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${(doneCount / lines.length) * 100}%` }} />
      </div>
      {lines.map((line) => {
        const due = line.due ? dueLabel(line.due, today) : null;
        return (
          <div
            key={line.key}
            className={`preview-sub${line.done ? ' done' : ''}${line.struck ? ' struck' : ''}`}
            style={line.depth ? { paddingLeft: line.depth * 18 } : undefined}
          >
            <Checkbox size="sm" state={line.done ? 'done' : 'todo'} onToggle={line.toggle} />
            <span className="preview-sub-title">{line.title || 'Untitled'}</span>
            {due && (
              <span className={`preview-sub-due due-${line.done ? 'normal' : due.tone}`}>
                <CalendarDays size={11} strokeWidth={1.9} />
                {due.text}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TaskPreviewCard({ task, pinned }) {
  const today = useToday();
  const project = useData((s) => (task.projectId ? s.projects.find((p) => p.id === task.projectId) : null));
  const tasks = useData((s) => s.tasks);
  const lines = taskLines(task, tasks);
  const placement = usePlacement(`[data-task-row][data-id="${task.id}"]`, pinned, [lines.length, task.notes, task.title]);

  const done = task.status === 'done';
  const hasNotes = task.notes.trim().length > 0;
  const due = task.dueDate ? dueLabelLong(task.dueDate, today) : null;
  const overdue = task.dueDate && task.dueDate < today && !done;
  const style = textStyleProps(task.textStyle, task.struck);

  return (
    <Shell placement={placement} pinned={pinned}>
      <div className="preview-head">
        <span className="preview-crumb">
          {project ? <ProjectDot color={project.color} /> : <Inbox size={13} strokeWidth={1.9} />}
          <span>{project ? project.name : 'Inbox'}</span>
        </span>
        <button type="button" className="preview-edit" aria-label="Edit task" onClick={() => selectTask(task.id, true)}>
          <Pencil size={12} strokeWidth={2.1} />
        </button>
      </div>

      <div className="preview-title-row">
        <Checkbox state={task.status} onToggle={() => toggleComplete(task.id)} />
        <div className={`preview-title${done ? ' done' : ''} ${style.className}`} style={style.style}>{task.title}</div>
      </div>

      <div className="preview-chips">
        <span className="chip">
          <StatusIcon status={task.status} size={13} />
          {statusLabel(task.status)}
        </span>
        {task.priority && (
          <span className="chip">
            <PriorityIcon level={task.priority} />
            {priorityLabel(task.priority)}
          </span>
        )}
        {due && (
          <span className={`chip${overdue ? ' chip-overdue' : ''}`}>
            <CalendarDays size={13} strokeWidth={1.9} />
            {due}
          </span>
        )}
        {task.addedToToday && (
          <span className="chip chip-today">
            <Sun size={13} strokeWidth={2} />
            Today
          </span>
        )}
      </div>

      {hasNotes && (
        <div className="preview-section">
          <div className="section-label">Notes</div>
          <p className="preview-notes">{task.notes.trim()}</p>
        </div>
      )}

      {lines.length > 0 && <Outline label="Sub-tasks" lines={lines} today={today} />}

      {!hasNotes && lines.length === 0 && <div className="preview-empty">No notes or sub-tasks yet.</div>}
    </Shell>
  );
}

/** Overview of one checklist item: its own details and the items nested under it. */
function ItemPreviewCard({ task, item, pinned }) {
  const today = useToday();
  const lines = checklistLines(task.id, item.subtasks);
  const placement = usePlacement(`[data-sub-row][data-sub-id="${item.id}"]`, pinned, [lines.length, item.title]);

  const overdue = item.dueDate && item.dueDate < today && !item.done;
  const style = textStyleProps(item.textStyle, item.struck);
  const toggle = () => updateSubtask(task.id, item.id, { done: !item.done, completedAt: item.done ? null : Date.now() });

  return (
    <Shell placement={placement} pinned={pinned}>
      <div className="preview-head">
        <span className="preview-crumb">
          <ListChecks size={13} strokeWidth={1.9} />
          <span>{task.title}</span>
        </span>
        <button type="button" className="preview-edit" aria-label="Edit task" onClick={() => selectTask(task.id, true)}>
          <Pencil size={12} strokeWidth={2.1} />
        </button>
      </div>

      <div className="preview-title-row">
        <Checkbox state={item.done ? 'done' : 'todo'} onToggle={toggle} />
        <div className={`preview-title${item.done ? ' done' : ''} ${style.className}`} style={style.style}>{item.title || 'Untitled'}</div>
      </div>

      <div className="preview-chips">
        <span className="chip">
          <StatusIcon status={item.done ? 'done' : 'todo'} size={13} />
          {statusLabel(item.done ? 'done' : 'todo')}
        </span>
        {item.dueDate && (
          <span className={`chip${overdue ? ' chip-overdue' : ''}`}>
            <CalendarDays size={13} strokeWidth={1.9} />
            {dueLabelLong(item.dueDate, today)}
          </span>
        )}
        {item.struck && (
          <span className="chip">
            <CircleCheck size={13} strokeWidth={1.9} />
            Struck off
          </span>
        )}
      </div>

      {lines.length > 0 ? <Outline label="Nested" lines={lines} today={today} /> : <div className="preview-empty">No nested items yet.</div>}
    </Shell>
  );
}
