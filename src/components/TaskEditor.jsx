import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  CalendarDays, CircleCheck, CircleDashed, Copy, Ellipsis, FolderClosed, Inbox, ListChecks, Plus, Sun, Trash2, X,
} from 'lucide-react';
import {
  addNestedSubtask, addSubtask, childTasks, deleteTask, duplicateTask, hidePreview, openMenu, removeSubtask, selectTask,
  toggleComplete, updateSubtask, updateTask, useChildTasks, useData, useUI,
} from '../store';
import { dueLabel, dueLabelLong, formatTimestamp } from '../lib/dates';
import { priorityLabel, statusLabel } from '../lib/util';
import { inToday } from '../lib/views';
import { useToday } from '../lib/useToday';
import { textStyleProps } from '../lib/textStyle';
import { Checkbox, PriorityIcon, ProjectDot, StatusIcon } from './bits';
import { rectOf } from './MenuLayer';
import { SubtaskTree } from './Subtasks';
import { openDatePicker, priorityItems, projectItems, statusItems } from './taskMenu';
import { TextStyleButton, TextStyleControls } from './TextStyle';
import { DueButton, DueChip } from './DueButton';
import { StrikeButton } from './StrikeButton';
import { DatePicker } from './DatePicker';

// The task popup's contents: everything about a task (or one checklist item)
// edited in place, including every sub-task and nested item under it.

const clean = (text) => text.replace(/\s+/g, ' ').trim();

function useAutosize(ref, value) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [ref, value]);
}

/** Opened with Enter, the task menu or search: put the cursor at the end of the title. */
function useFocusOnOpen(ref, id, subId = null) {
  const focusTitle = useUI((u) => u.focusTitle);
  useEffect(() => {
    if (!focusTitle || focusTitle.id !== id || (focusTitle.subId ?? null) !== subId) return;
    if (Date.now() - focusTitle.at > 1500) return;
    const el = ref.current;
    el?.focus({ preventScroll: true });
    el?.setSelectionRange(el.value.length, el.value.length);
  }, [focusTitle, id, subId, ref]);
}

/** The big title: saves as you type, never ends up empty, and Enter finishes. */
function TitleField({ inputRef, value, onSave, className, style, placeholder }) {
  const [text, setText] = useState(value);
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setText(value);
  }, [value, inputRef]);
  useAutosize(inputRef, text);
  return (
    <textarea
      ref={inputRef}
      className={className}
      style={style}
      value={text}
      rows={1}
      spellCheck
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        const next = clean(e.target.value);
        if (next) onSave(next);
      }}
      onBlur={() => {
        const next = clean(text);
        if (!next) setText(value);
        else if (next !== value) onSave(next);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}

/** A one-line title inside a list of sub-tasks. */
function RowTitle({ value, onSave, className, style, placeholder }) {
  const ref = useRef(null);
  const [text, setText] = useState(value);
  useEffect(() => {
    if (document.activeElement !== ref.current) setText(value);
  }, [value]);
  return (
    <input
      ref={ref}
      className={className}
      style={style}
      value={text}
      spellCheck
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        const next = clean(e.target.value);
        if (next) onSave(next);
      }}
      onBlur={() => {
        if (!clean(text)) setText(value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}

/** "Add sub-task" field at the end of a list: Enter adds and stays ready for the next one. */
function AddLine({ placeholder, onAdd }) {
  const [text, setText] = useState('');
  return (
    <div className="sub-row add-line">
      <Plus size={14} strokeWidth={2} className="sub-add-icon" />
      <input
        value={text}
        spellCheck
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.key !== 'Enter') return;
          e.preventDefault();
          const next = clean(text);
          if (!next) return;
          onAdd(next);
          setText('');
        }}
      />
    </div>
  );
}

function PopupHead({ crumb, children }) {
  return (
    <div className="preview-head">
      <div className="preview-crumb">{crumb}</div>
      <div className="preview-actions">
        {children}
        <button type="button" className="icon-btn sm" aria-label="Close" onClick={hidePreview}>
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

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

const PriorityGlyph = () => <PriorityIcon level="neutral" size={15} />;

function StrikeSwitch({ on, onToggle }) {
  return (
    <>
      <button type="button" className={`switch switch-accent${on ? ' on' : ''}`} role="switch" aria-checked={Boolean(on)} aria-label="Strike off" onClick={onToggle}>
        <span />
      </button>
      <span className="prop-note">{on ? 'Text is struck through; the task stays where it is' : ''}</span>
    </>
  );
}

/** Done / total over everything under a task: nested tasks and checklist items, all levels. */
function countUnder(task, tasks) {
  let done = 0;
  let total = 0;
  const items = (list = []) => list.forEach((it) => { total += 1; if (it.done) done += 1; items(it.subtasks); });
  const walk = (t) => {
    childTasks(t.id, tasks).forEach((c) => { total += 1; if (c.status === 'done') done += 1; walk(c); });
    items(t.subtasks);
  };
  walk(task);
  return { done, total };
}

function countItems(list) {
  let done = 0;
  let total = 0;
  const items = (l = []) => l.forEach((it) => { total += 1; if (it.done) done += 1; items(it.subtasks); });
  items(list);
  return { done, total };
}

function ListHead({ label, done, total }) {
  return (
    <>
      <div className="section-label">
        <span>{label}</span>
        {total > 0 && <span className="preview-count">{done}/{total}</span>}
      </div>
      {total > 0 && (
        <div className="progress" aria-hidden="true">
          <span style={{ width: `${(done / total) * 100}%` }} />
        </div>
      )}
    </>
  );
}

/** A nested task (a full task of its own) as an editable line, with everything under it. */
function NestedTaskLine({ task, depth }) {
  const today = useToday();
  const done = task.status === 'done';
  const style = textStyleProps(task.textStyle, task.struck);
  return (
    <>
      <div
        className={`sub-row nested-task-row${done ? ' done' : ''}${task.struck ? ' struck' : ''}`}
        style={depth ? { '--sub-depth': depth } : undefined}
      >
        <Checkbox size="sm" state={task.status} onToggle={() => toggleComplete(task.id)} />
        <RowTitle
          className={style.className}
          style={style.style}
          value={task.title}
          placeholder="Task"
          onSave={(title) => updateTask(task.id, { title })}
        />
        {task.dueDate
          ? <DueChip value={task.dueDate} today={today} done={done} onChange={(dueDate) => updateTask(task.id, { dueDate })} />
          : <DueButton value={null} onChange={(dueDate) => updateTask(task.id, { dueDate })} />}
        <StrikeButton on={task.struck} onToggle={() => updateTask(task.id, { struck: !task.struck })} />
        <TextStyleButton className="sub-style" value={task.textStyle} onChange={(textStyle) => updateTask(task.id, { textStyle })} label="Style task text" />
        <button type="button" className="icon-btn sm sub-del" aria-label="Delete task" onClick={() => deleteTask(task.id)}>
          <Trash2 size={13} />
        </button>
      </div>
      {task.subtasks.length > 0 && (
        <div className="nested-checklist" style={{ '--nest': depth + 1 }}>
          <SubtaskTree task={task} variant="panel" inPopup />
        </div>
      )}
      <NestedTasks parent={task} depth={depth + 1} />
    </>
  );
}

function NestedTasks({ parent, depth = 0 }) {
  const kids = useChildTasks(parent.id);
  return kids.map((kid) => <NestedTaskLine key={kid.id} task={kid} depth={depth} />);
}

/** Popup for a task: its details, notes, and every sub-task and nested task under it. */
export function TaskEditor({ task }) {
  const today = useToday();
  const project = useData((s) => (task.projectId ? s.projects.find((p) => p.id === task.projectId) : null));
  const parent = useData((s) => (task.parentId ? s.tasks.find((t) => t.id === task.parentId) : null));
  const tasks = useData((s) => s.tasks);
  const titleRef = useRef(null);
  const notesRef = useRef(null);
  useFocusOnOpen(titleRef, task.id);
  useAutosize(notesRef, task.notes);

  const done = task.status === 'done';
  const planned = task.addedToToday;
  const due = task.dueDate ? dueLabel(task.dueDate, today) : null;
  const style = textStyleProps(task.textStyle, task.struck);
  const under = countUnder(task, tasks);
  const menuAt = (e, items) => openMenu({ kind: 'menu', rect: rectOf(e.currentTarget), items });

  return (
    <>
      <PopupHead
        crumb={(
          <>
            {project ? <ProjectDot color={project.color} /> : <Inbox size={13} strokeWidth={1.9} />}
            <span>{project ? project.name : 'Inbox'}</span>
            {parent && <span className="preview-crumb-parent">› {parent.title}</span>}
          </>
        )}
      >
        <button
          type="button"
          className={`icon-btn sm${planned ? ' on-today' : ''}`}
          aria-label={planned ? 'Remove from Today' : inToday(task, today) ? 'Last day today · pin to Today' : 'Add to Today'}
          onClick={() => updateTask(task.id, { addedToToday: !planned })}
        >
          <Sun size={15} strokeWidth={1.9} />
        </button>
        <button
          type="button"
          className="icon-btn sm"
          aria-label="More"
          onClick={(e) => menuAt(e, [
            { label: 'Duplicate', icon: Copy, shortcut: 'mod+D', onSelect: () => { const id = duplicateTask(task.id); if (id) selectTask(id, false); } },
            { divider: true },
            { label: 'Delete task', icon: Trash2, shortcut: 'Del', danger: true, onSelect: () => deleteTask(task.id) },
          ])}
        >
          <Ellipsis size={15} />
        </button>
      </PopupHead>

      <div className="preview-body">
        <div className="panel-title-row">
          <Checkbox state={task.status} size="lg" onToggle={() => toggleComplete(task.id)} />
          <TitleField
            inputRef={titleRef}
            className={`panel-title${done ? ' done' : ''} ${style.className}`}
            style={style.style}
            value={task.title}
            placeholder="Task title"
            onSave={(title) => updateTask(task.id, { title })}
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
          <PropRow icon={CalendarDays} label="Last day">
            <button
              type="button"
              className={`prop-btn${task.dueDate ? ` due-${done ? 'normal' : due.tone}` : ' empty'}`}
              onClick={(e) => openDatePicker(task, { rect: rectOf(e.currentTarget) })}
            >
              {task.dueDate ? dueLabelLong(task.dueDate, today) : 'No date'}
            </button>
            {task.dueDate && (
              <button type="button" className="icon-btn sm prop-clear" aria-label="Remove last day" onClick={() => updateTask(task.id, { dueDate: null })}>
                <X size={13} />
              </button>
            )}
          </PropRow>
          <PropRow icon={Sun} label="Today">
            <button
              type="button"
              className={`switch${planned ? ' on' : ''}`}
              role="switch"
              aria-checked={planned}
              aria-label="Planned for today"
              onClick={() => updateTask(task.id, { addedToToday: !planned })}
            >
              <span />
            </button>
            <span className="prop-note">
              {planned ? 'Planned for today' : task.dueDate && task.dueDate <= today && !done ? 'Shows in Today — its last day is here' : ''}
            </span>
          </PropRow>
          <PropRow icon={CircleCheck} label="Strike off">
            <StrikeSwitch on={task.struck} onToggle={() => updateTask(task.id, { struck: !task.struck })} />
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

        <section className="panel-section">
          <ListHead label="Sub-tasks" done={under.done} total={under.total} />
          <NestedTasks parent={task} />
          {task.subtasks.length > 0 && <SubtaskTree task={task} variant="panel" inPopup />}
          <AddLine placeholder="Add sub-task" onAdd={(title) => addSubtask(task.id, title)} />
        </section>

        <div className="panel-foot">
          Created {formatTimestamp(task.createdAt)}
          {task.completedAt ? ` · Completed ${formatTimestamp(task.completedAt)}` : ''}
        </div>
      </div>
    </>
  );
}

/** Popup for one checklist item: its details and every item nested under it. */
export function ItemEditor({ task, item }) {
  const today = useToday();
  const titleRef = useRef(null);
  useFocusOnOpen(titleRef, task.id, item.id);

  const set = (patch) => updateSubtask(task.id, item.id, patch);
  const style = textStyleProps(item.textStyle, item.struck);
  const due = item.dueDate ? dueLabel(item.dueDate, today) : null;
  const under = countItems(item.subtasks);

  return (
    <>
      <PopupHead
        crumb={(
          <>
            <ListChecks size={13} strokeWidth={1.9} />
            <span>{task.title}</span>
          </>
        )}
      >
        <button
          type="button"
          className="icon-btn sm"
          aria-label={item.subtasks?.length ? 'Delete this item and everything under it' : 'Delete item'}
          onClick={() => removeSubtask(task.id, item.id)}
        >
          <Trash2 size={14} />
        </button>
      </PopupHead>

      <div className="preview-body">
        <div className="panel-title-row">
          <Checkbox
            state={item.done ? 'done' : 'todo'}
            size="lg"
            onToggle={() => set({ done: !item.done, completedAt: item.done ? null : Date.now() })}
          />
          <TitleField
            inputRef={titleRef}
            className={`panel-title${item.done ? ' done' : ''} ${style.className}`}
            style={style.style}
            value={item.title}
            placeholder="Sub-task"
            onSave={(title) => set({ title })}
          />
        </div>

        <div className="props">
          <div className="prop text-style-prop">
            <TextStyleControls value={item.textStyle} onChange={(textStyle) => set({ textStyle })} />
          </div>
          <PropRow icon={CalendarDays} label="Last day">
            <button
              type="button"
              className={`prop-btn${item.dueDate ? ` due-${item.done ? 'normal' : due.tone}` : ' empty'}`}
              onClick={(e) => openMenu({
                kind: 'popover',
                rect: rectOf(e.currentTarget),
                render: (close) => <DatePicker value={item.dueDate} onChange={(dueDate) => set({ dueDate })} onClose={close} />,
              })}
            >
              {item.dueDate ? dueLabelLong(item.dueDate, today) : 'No date'}
            </button>
            {item.dueDate && (
              <button type="button" className="icon-btn sm prop-clear" aria-label="Remove last day" onClick={() => set({ dueDate: null })}>
                <X size={13} />
              </button>
            )}
          </PropRow>
          <PropRow icon={CircleCheck} label="Strike off">
            <StrikeSwitch on={item.struck} onToggle={() => set({ struck: !item.struck })} />
          </PropRow>
        </div>

        <section className="panel-section">
          <ListHead label="Nested" done={under.done} total={under.total} />
          {item.subtasks.length > 0 && <SubtaskTree task={task} items={item.subtasks} variant="panel" inPopup />}
          <AddLine placeholder="Add nested item" onAdd={(title) => addNestedSubtask(task.id, item.id, title)} />
        </section>

        {item.completedAt && <div className="panel-foot">Completed {formatTimestamp(item.completedAt)}</div>}
      </div>
    </>
  );
}
