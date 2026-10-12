import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  CalendarDays, ChevronDown, Inbox, ListChecks, Plus, Strikethrough, Sun, Trash2, X,
} from 'lucide-react';
import {
  addNestedSubtask, addSubtask, childTasks, requestDeleteTask, hidePreview, openMenu, removeSubtask,
  toggleComplete, updateSubtask, updateTask, useData, useUI,
} from '../store';
import { dueLabel, dueLabelLong, formatTimestamp } from '../lib/dates';
import { PRIORITIES, priorityLabel, statusLabel } from '../lib/util';
import { useToday } from '../lib/useToday';
import { textStyleProps } from '../lib/textStyle';
import { Checkbox, PriorityIcon, ProjectDot, StatusIcon } from './bits';
import { rectOf } from './MenuLayer';
import { openDatePicker, priorityItems, projectItems, statusItems } from './taskMenu';
import { TextStyleTool } from './TextStyle';
import { CompletedDate } from './DueButton';
import { DatePicker } from './DatePicker';

// The task popup's contents: one compact layout for every task, sub-task and
// nested item. Title and text style on the left; status, priority, last day and
// strike-off on the right; then notes and a count of what is under it. The
// sub-tasks themselves are edited on the page, so the popup stays small.

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

/** A one-line title: saves as you type, never ends up empty, and Enter finishes. */
function RowTitle({ value, onSave, className, style, placeholder, inputRef }) {
  const own = useRef(null);
  const ref = inputRef || own;
  const [text, setText] = useState(value);
  useEffect(() => {
    if (document.activeElement !== ref.current) setText(value);
  }, [value, ref]);
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

const PriorityGlyph = () => <PriorityIcon level="neutral" size={15} />;

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

/**
 * The two-column block every popup shares. Left: the title in a box, then text
 * color, weight and size. Right: status in a box, then priority, last day and
 * strike-off. Tasks and checklist items feed it the same shape of props.
 */
function PopupGrid({
  check, onCheck, done, title, placeholder, onTitle, titleRef,
  textStyle, onTextStyle, struck, onStruck,
  statusIcon, statusText, onStatus,
  priority, onPriority,
  dueText, dueTone, onDue,
}) {
  const style = textStyleProps(textStyle, struck);
  const accent = style.style?.['--title-style-color'];
  return (
    <div className="task-grid">
      <div
        className={`tg-cell tg-box${style.className ? ` ${style.className}` : ''}`}
        style={accent ? { '--title-style-color': accent } : undefined}
      >
        <Checkbox state={check} size="lg" onToggle={onCheck} />
        <RowTitle
          inputRef={titleRef}
          className={`panel-title${done ? ' done' : ''} ${style.className}`}
          style={style.style}
          value={title}
          placeholder={placeholder}
          onSave={onTitle}
        />
      </div>
      <div className="tg-cell tg-flush">
        <button type="button" className="tg-box tg-btn" aria-label="Status" onClick={onStatus}>
          {statusIcon}
          {statusText}
        </button>
      </div>

      <div className="tg-cell">
        <TextStyleTool value={textStyle} onChange={onTextStyle} panel="color" />
      </div>
      <div className="tg-cell">
        <button type="button" className={`tg-btn${priority ? '' : ' empty'}`} aria-label="Priority" onClick={onPriority}>
          {priority ? <PriorityIcon level={priority} /> : <PriorityGlyph />}
          {priority ? priorityLabel(priority) : 'Priority'}
        </button>
      </div>

      <div className="tg-cell">
        <TextStyleTool value={textStyle} onChange={onTextStyle} panel="style" />
      </div>
      <div className="tg-cell">
        <button type="button" className={`tg-btn${dueText ? ` due-${dueTone}` : ' empty'}`} aria-label="Last day" onClick={onDue}>
          <CalendarDays size={14} strokeWidth={1.9} />
          {dueText || 'Last day'}
        </button>
      </div>

      <div className="tg-cell">
        <span className="tg-size-glyph text-style-size-glyph">A+</span>
        <TextStyleTool value={textStyle} onChange={onTextStyle} panel="size" />
      </div>
      <div className="tg-cell">
        <button type="button" className="tg-btn" role="switch" aria-checked={Boolean(struck)} onClick={onStruck}>
          <Strikethrough size={14} strokeWidth={1.9} />
          Strike off
          <span className={`switch${struck ? ' on' : ''}`} aria-hidden="true"><span /></span>
        </button>
      </div>
    </div>
  );
}

/** Popup for a task: title and style, status, priority, last day, notes and a count of what is under it. */
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
  const under = countUnder(task, tasks);
  const menuAt = (e, items) => openMenu({ kind: 'menu', rect: rectOf(e.currentTarget), items });
  const set = (patch) => updateTask(task.id, patch);

  return (
    <>
      <PopupHead
        crumb={(
          <>
            <button type="button" className="prop-btn" aria-label="Change project" onClick={(e) => menuAt(e, projectItems(task))}>
              {project ? <ProjectDot color={project.color} /> : <Inbox size={13} strokeWidth={1.9} />}
              <span>{project ? project.name : 'No project'}</span>
              <ChevronDown size={13} />
            </button>
            {parent && <span className="preview-crumb-parent">› {parent.title}</span>}
          </>
        )}
      >
        <button
          type="button"
          className={`icon-btn sm${planned ? ' on-today' : ''}`}
          aria-label={planned ? 'Remove from Today' : 'Add to Today'}
          onClick={() => set({ addedToToday: !planned })}
        >
          <Sun size={15} strokeWidth={1.9} />
        </button>
        <button type="button" className="icon-btn sm" aria-label="Delete task" onClick={() => requestDeleteTask(task.id)}>
          <Trash2 size={15} />
        </button>
      </PopupHead>

      <div className="preview-body">
        <PopupGrid
          check={task.status}
          onCheck={() => toggleComplete(task.id)}
          done={done}
          title={task.title}
          placeholder="Task title"
          onTitle={(title) => set({ title })}
          titleRef={titleRef}
          textStyle={task.textStyle}
          onTextStyle={(textStyle) => set({ textStyle })}
          struck={task.struck}
          onStruck={() => set({ struck: !task.struck })}
          statusIcon={<StatusIcon status={task.status} />}
          statusText={statusLabel(task.status)}
          onStatus={(e) => menuAt(e, statusItems(task))}
          priority={task.priority}
          onPriority={(e) => menuAt(e, priorityItems(task))}
          dueText={task.dueDate ? dueLabelLong(task.dueDate, today) : null}
          dueTone={done ? 'normal' : due?.tone}
          onDue={(e) => openDatePicker(task, { rect: rectOf(e.currentTarget) })}
        />

        <section className="panel-section">
          <div className="section-label">Notes</div>
          <textarea
            ref={notesRef}
            className="notes"
            value={task.notes}
            placeholder="Add notes, references, ideas…"
            spellCheck
            onChange={(e) => set({ notes: e.target.value })}
          />
        </section>

        <section className="panel-section">
          <ListHead label="Sub-tasks" done={under.done} total={under.total} />
          <AddLine placeholder="Add sub-task" onAdd={(title) => addSubtask(task.id, title)} />
        </section>

        <div className="panel-foot">
          Created {formatTimestamp(task.createdAt)}
          {task.completedAt && (
            <>
              {' · Completed '}
              <CompletedDate
                className="completed-inline"
                withTime={false}
                value={task.completedAt}
                onChange={(completedAt) => set({ completedAt })}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}

/** Popup for one checklist item: the same layout, and a count of the items nested under it. */
export function ItemEditor({ task, item }) {
  const today = useToday();
  const titleRef = useRef(null);
  useFocusOnOpen(titleRef, task.id, item.id);

  const set = (patch) => updateSubtask(task.id, item.id, patch);
  const notesRef = useRef(null);
  useAutosize(notesRef, item.notes || '');
  const menuAt = (e, items) => openMenu({ kind: 'menu', rect: rectOf(e.currentTarget), items });
  const state = item.done ? 'done' : 'todo';
  const due = item.dueDate ? dueLabel(item.dueDate, today) : null;
  const under = countItems(item.subtasks);
  const setDone = (done) => set({ done, completedAt: done ? Date.now() : null });

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
          <Trash2 size={15} />
        </button>
      </PopupHead>

      <div className="preview-body">
        <PopupGrid
          check={state}
          onCheck={() => setDone(!item.done)}
          done={item.done}
          title={item.title}
          placeholder="Sub-task"
          onTitle={(title) => set({ title })}
          titleRef={titleRef}
          textStyle={item.textStyle}
          onTextStyle={(textStyle) => set({ textStyle })}
          struck={item.struck}
          onStruck={() => set({ struck: !item.struck })}
          statusIcon={<StatusIcon status={state} />}
          statusText={statusLabel(state)}
          onStatus={(e) => menuAt(e, ['todo', 'done'].map((id) => ({
            label: statusLabel(id),
            icon: <StatusIcon status={id} />,
            checked: state === id,
            onSelect: () => setDone(id === 'done'),
          })))}
          priority={item.priority || null}
          onPriority={(e) => menuAt(e, PRIORITIES.map((p) => ({
            label: p.label,
            icon: p.id ? <PriorityIcon level={p.id} /> : undefined,
            checked: (item.priority || null) === p.id,
            onSelect: () => set({ priority: p.id }),
          })))}
          dueText={item.dueDate ? dueLabelLong(item.dueDate, today) : null}
          dueTone={item.done ? 'normal' : due?.tone}
          onDue={(e) => openMenu({
            kind: 'popover',
            rect: rectOf(e.currentTarget),
            render: (close) => <DatePicker value={item.dueDate} onChange={(dueDate) => set({ dueDate })} onClose={close} />,
          })}
        />

        <section className="panel-section">
          <div className="section-label">Notes</div>
          <textarea
            ref={notesRef}
            className="notes"
            value={item.notes || ''}
            placeholder="Add notes, references, ideas…"
            spellCheck
            onChange={(e) => set({ notes: e.target.value })}
          />
        </section>

        <section className="panel-section">
          <ListHead label="Nested" done={under.done} total={under.total} />
          <AddLine placeholder="Add nested item" onAdd={(title) => addNestedSubtask(task.id, item.id, title)} />
        </section>

        {item.completedAt && (
          <div className="panel-foot">
            Completed{' '}
            <CompletedDate className="completed-inline" withTime={false} value={item.completedAt} onChange={(completedAt) => set({ completedAt })} />
          </div>
        )}
      </div>
    </>
  );
}
