import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  CalendarDays, CircleDashed, Copy, Ellipsis, FolderClosed, Inbox, Sun, Trash2, X,
} from 'lucide-react';
import {
  closePanel, deleteTask, duplicateTask, openMenu, selectTask, toggleComplete, updateTask, useData, useUI,
} from '../store';
import { dueLabel, dueLabelLong, formatTimestamp } from '../lib/dates';
import { priorityLabel, statusLabel } from '../lib/util';
import { inToday } from '../lib/views';
import { useToday } from '../lib/useToday';
import { Checkbox, PriorityIcon, ProjectDot, StatusIcon } from './bits';
import { rectOf } from './MenuLayer';
import { SubtaskTree } from './Subtasks';
import { openDatePicker, priorityItems, projectItems, statusItems } from './taskMenu';
import { TextStyleControls } from './TextStyle';
import { textStyleProps } from '../lib/textStyle';
import { flattenChecklist } from '../lib/checklist';

function useAutosize(ref, value) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [ref, value]);
}

export function DetailPanel({ taskId }) {
  const task = useData((s) => s.tasks.find((t) => t.id === taskId));
  const project = useData((s) => (task?.projectId ? s.projects.find((p) => p.id === task.projectId) : null));
  if (!task) return null;
  return (
    <aside className="panel" aria-label="Task details">
      <PanelHeader task={task} project={project} />
      <div className="panel-scroll">
        <PanelBody key={task.id} task={task} project={project} />
      </div>
    </aside>
  );
}

function PanelHeader({ task, project }) {
  const today = useToday();
  const planned = task.addedToToday;
  return (
    <div className="panel-head drag-region">
      <div className="panel-crumb">
        {project ? <ProjectDot color={project.color} /> : <Inbox size={14} strokeWidth={1.9} />}
        <span>{project ? project.name : 'Inbox'}</span>
      </div>
      <div className="panel-actions">
        <button
          type="button"
          className={`icon-btn${planned ? ' on-today' : ''}`}
          title={planned ? 'Remove from Today' : inToday(task, today) ? 'Due today · pin to Today' : 'Add to Today'}
          onClick={() => updateTask(task.id, { addedToToday: !planned })}
        >
          <Sun size={16} strokeWidth={1.9} />
        </button>
        <button
          type="button"
          className="icon-btn"
          title="More"
          onClick={(e) =>
            openMenu({
              kind: 'menu',
              rect: rectOf(e.currentTarget),
              items: [
                { label: 'Duplicate', icon: Copy, shortcut: 'mod+D', onSelect: () => { const id = duplicateTask(task.id); if (id) selectTask(id, true); } },
                { divider: true },
                { label: 'Delete task', icon: Trash2, shortcut: 'Del', danger: true, onSelect: () => deleteTask(task.id) },
              ],
            })
          }
        >
          <Ellipsis size={16} />
        </button>
        <button type="button" className="icon-btn" title="Close" onClick={closePanel}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

const PriorityGlyph = () => <PriorityIcon level="neutral" size={15} />;

function PropRow({ icon: Icon, label, children }) {
  return (
    <div className="prop">
      <span className="prop-label">
        <Icon size={15} strokeWidth={1.8} />
        {label}
      </span>
      <div className="prop-value">{children}</div>
    </div>
  );
}

function PanelBody({ task, project }) {
  const today = useToday();
  const focusTitle = useUI((u) => u.focusTitle);
  const titleRef = useRef(null);
  const notesRef = useRef(null);
  const [title, setTitle] = useState(task.title);

  // Keep the local title in sync if it changes elsewhere (e.g. undo).
  useEffect(() => {
    if (document.activeElement !== titleRef.current) setTitle(task.title);
  }, [task.title]);

  useEffect(() => {
    if (focusTitle?.id !== task.id || Date.now() - focusTitle.at > 1000) return;
    const el = titleRef.current;
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
  }, [focusTitle, task.id]);

  useAutosize(titleRef, title);
  useAutosize(notesRef, task.notes);

  const commitTitle = () => {
    const clean = title.replace(/\s+/g, ' ').trim();
    if (!clean) setTitle(task.title);
    else if (clean !== task.title) updateTask(task.id, { title: clean });
  };

  const menuAt = (e, items) => openMenu({ kind: 'menu', rect: rectOf(e.currentTarget), items });
  const due = task.dueDate ? dueLabel(task.dueDate, today) : null;

  return (
    <div className="panel-body">
      <div className="panel-title-row">
        <Checkbox state={task.status} size="lg" onToggle={() => toggleComplete(task.id)} />
        <textarea
          ref={titleRef}
          className={`panel-title${task.status === 'done' ? ' done' : ''} ${textStyleProps(task.textStyle).className}`}
          style={textStyleProps(task.textStyle).style}
          value={title}
          rows={1}
          spellCheck
          placeholder="Task title"
          onChange={(e) => {
            setTitle(e.target.value);
            const clean = e.target.value.replace(/\s+/g, ' ').trim();
            if (clean) updateTask(task.id, { title: clean });
          }}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
      </div>

      <div className="props">
        <div className="prop text-style-prop">
          <TextStyleControls value={task.textStyle} onChange={(textStyle) => updateTask(task.id, { textStyle })} />
        </div>
        <PropRow icon={CircleDashed} label="Status">
          <button type="button" className="prop-btn" onClick={(e) => menuAt(e, statusItems(task))}>
            <StatusIcon status={task.status} />
            {statusLabel(task.status)}
          </button>
        </PropRow>
        <PropRow icon={FolderClosed} label="Project">
          <button type="button" className="prop-btn" onClick={(e) => menuAt(e, projectItems(task))}>
            {project ? <ProjectDot color={project.color} /> : <Inbox size={14} strokeWidth={1.9} />}
            {project ? project.name : 'Inbox'}
          </button>
        </PropRow>
        <PropRow icon={PriorityGlyph} label="Priority">
          <button type="button" className={`prop-btn${task.priority ? '' : ' empty'}`} onClick={(e) => menuAt(e, priorityItems(task))}>
            {task.priority && <PriorityIcon level={task.priority} />}
            {task.priority ? priorityLabel(task.priority) : 'None'}
          </button>
        </PropRow>
        <PropRow icon={CalendarDays} label="Due date">
          <button
            type="button"
            className={`prop-btn${task.dueDate ? ` due-${task.status === 'done' ? 'normal' : due.tone}` : ' empty'}`}
            onClick={(e) => openDatePicker(task, { rect: rectOf(e.currentTarget) })}
          >
            {task.dueDate ? dueLabelLong(task.dueDate, today) : 'No date'}
          </button>
          {task.dueDate && (
            <button type="button" className="icon-btn sm prop-clear" title="Remove due date" onClick={() => updateTask(task.id, { dueDate: null })}>
              <X size={13} />
            </button>
          )}
        </PropRow>
        <PropRow icon={Sun} label="Today">
          <button
            type="button"
            className={`switch${task.addedToToday ? ' on' : ''}`}
            role="switch"
            aria-checked={task.addedToToday}
            onClick={() => updateTask(task.id, { addedToToday: !task.addedToToday })}
          >
            <span />
          </button>
          <span className="prop-note">
            {task.addedToToday ? 'Planned for today' : task.dueDate && task.dueDate <= today && task.status !== 'done' ? 'Shows in Today — it’s due' : ''}
          </span>
        </PropRow>
      </div>

      <section className="panel-section">
        <div className="section-label">Notes</div>
        <textarea
          ref={notesRef}
          className="notes"
          value={task.notes}
          placeholder="Add notes, references, ideas…"
          spellCheck
          onChange={(e) => updateTask(task.id, { notes: e.target.value })}
        />
      </section>

      <Checklist task={task} />

      <div className="panel-foot">
        Created {formatTimestamp(task.createdAt)}
        {task.completedAt ? ` · Completed ${formatTimestamp(task.completedAt)}` : ''}
      </div>
    </div>
  );
}

function Checklist({ task }) {
  const checklist = flattenChecklist(task.subtasks);
  const total = checklist.length;
  const done = checklist.filter((s) => s.done).length;

  return (
    <section className="panel-section">
      <div className="section-label">
        <span>Checklist</span>
      </div>
      {total > 0 && (
        <div className="progress" aria-hidden="true">
          <span style={{ width: `${(done / total) * 100}%` }} />
        </div>
      )}
      <SubtaskTree task={task} variant="panel" />
    </section>
  );
}
