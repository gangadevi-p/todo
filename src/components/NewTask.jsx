import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, Inbox, Minus, Plus, TriangleAlert, X } from 'lucide-react';
import {
  closePopup, createTask, openMenu, revealTask, selectTask, toast, useData,
} from '../store';
import { addDays, dueLabelLong, nextWeekday, todayKey } from '../lib/dates';
import { PRIORITIES, STATUSES, uid } from '../lib/util';
import { Checkbox, PriorityIcon, ProjectDot, StatusIcon } from './bits';
import { DatePicker } from './DatePicker';
import { rectOf } from './MenuLayer';
import { F, Field, Popup } from './Popup';

/** Every field of a task, in one popup. Only the title is required. */
export function NewTaskForm({ defaults }) {
  const projects = useData((s) => s.projects);
  const tasks = useData((s) => s.tasks);

  const [id] = useState(uid);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState(defaults.status || 'todo');
  const [priority, setPriority] = useState(defaults.priority || null);
  const [projectId, setProjectId] = useState(defaults.projectId || null);
  const parentId = defaults.parentId || null;
  const [dueDate, setDueDate] = useState(defaults.dueDate || null);
  const addedToToday = Boolean(defaults.addedToToday);
  const [subtasks, setSubtasks] = useState([]);
  const [subDraft, setSubDraft] = useState('');

  const titleRef = useRef(null);
  const notesRef = useRef(null);

  const project = projects.find((p) => p.id === projectId) || null;
  const name = title.trim();
  const duplicate = useMemo(
    () => (name ? tasks.find((t) => (t.projectId || null) === projectId && t.title.trim().toLowerCase() === name.toLowerCase()) : null),
    [tasks, name, projectId],
  );
  const dirty = Boolean(name || notes.trim() || subtasks.length || subDraft.trim());

  // Grow the notes box with its content (measured again next frame: the popup
  // is still laying out on first render).
  useLayoutEffect(() => {
    const el = notesRef.current;
    if (!el) return undefined;
    const fit = () => {
      el.style.height = '0px';
      el.style.height = `${Math.max(el.scrollHeight, 64)}px`;
    };
    fit();
    const raf = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(raf);
  }, [notes]);

  const submit = () => {
    if (!name) {
      titleRef.current?.focus();
      return;
    }
    const draft = subDraft.trim();
    const steps = [...subtasks, ...(draft ? [{ id: uid(), title: draft, done: false }] : [])];
    createTask({
      id,
      title: name,
      notes: notes.trim(),
      status,
      priority,
      projectId,
      parentId,
      isHeading: Boolean(defaults.isHeading),
      dueDate,
      addedToToday,
      subtasks: steps,
    });
    closePopup();
    selectTask(id, false);
    toast(`Added to ${project ? project.name : 'Inbox'}`, { label: 'View', run: () => revealTask(id) });
  };

  const pickProject = (e) =>
    openMenu({
      kind: 'menu',
      rect: rectOf(e.currentTarget),
      items: [
        { label: 'Inbox', icon: Inbox, checked: !projectId, onSelect: () => setProjectId(null) },
        ...(projects.length ? [{ divider: true }] : []),
        ...[...projects].sort((a, b) => a.order - b.order).map((p) => ({
          label: p.name,
          icon: <ProjectDot color={p.color} />,
          checked: projectId === p.id,
          onSelect: () => setProjectId(p.id),
        })),
      ],
    });

  const pickDate = (e) =>
    openMenu({
      kind: 'popover',
      rect: rectOf(e.currentTarget),
      render: (close) => <DatePicker value={dueDate} onChange={setDueDate} onClose={close} />,
    });

  const today = todayKey();
  const quickDates = [
    ['Today', today],
    ['Tomorrow', addDays(today, 1)],
    ['Next week', nextWeekday(today, 1)],
  ];
  const customDate = dueDate && !quickDates.some(([, k]) => k === dueDate);

  const addStep = () => {
    const t = subDraft.trim();
    if (!t) return;
    setSubtasks((list) => [...list, { id: uid(), title: t, done: false }]);
    setSubDraft('');
  };

  return (
    <Popup
      title="New task"
      subtitle="Only the title is required."
      dirty={dirty}
      canSubmit={Boolean(name)}
      submitLabel="Create task"
      onSubmit={submit}
      focusRef={titleRef}
    >
      <Field f={F.title}>
        <input
          ref={titleRef}
          className="pp-input pp-title-input"
          autoFocus
          value={title}
          spellCheck
          placeholder="What needs to be done?"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {duplicate && (
          <div className="pp-warn">
            <TriangleAlert size={13} strokeWidth={2} />
            A task named “{duplicate.title}” already exists in {project ? project.name : 'Inbox'}.
          </div>
        )}
      </Field>

      <Field f={F.status}>
        <div className="pills" role="radiogroup" aria-label="Status">
          {STATUSES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={status === s.id}
              className={`pill${status === s.id ? ' on' : ''}`}
              onClick={() => setStatus(s.id)}
            >
              <StatusIcon status={s.id} size={13} />
              {s.label}
            </button>
          ))}
        </div>
      </Field>

      <Field f={F.priority}>
        <div className="pills" role="radiogroup" aria-label="Priority">
          {PRIORITIES.map((p) => (
            <button
              key={p.id || 'none'}
              type="button"
              role="radio"
              aria-checked={priority === p.id}
              data-level={p.id || 'none'}
              className={`pill${priority === p.id ? ' on' : ''}`}
              onClick={() => setPriority(p.id)}
            >
              {p.id ? <PriorityIcon level={p.id} /> : <Minus size={13} strokeWidth={2} />}
              {p.id ? p.label : 'None'}
            </button>
          ))}
        </div>
      </Field>

      <Field f={F.notes} hint="Optional" top>
        <textarea
          ref={notesRef}
          className="pp-notes"
          value={notes}
          spellCheck
          placeholder="Add notes, references, ideas…"
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>

      <Field f={F.subtasks} hint="Optional" top>
        <div className="pp-subs">
          {subtasks.map((st) => (
            <div key={st.id} className={`pp-sub${st.done ? ' done' : ''}`}>
              <Checkbox
                size="sm"
                state={st.done ? 'done' : 'todo'}
                onToggle={() => setSubtasks((list) => list.map((x) => (x.id === st.id ? { ...x, done: !x.done } : x)))}
              />
              <span className="pp-sub-title">{st.title}</span>
              <button
                type="button"
                className="icon-btn sm"
                title="Remove"
                onClick={() => setSubtasks((list) => list.filter((x) => x.id !== st.id))}
              >
                <X size={13} />
              </button>
            </div>
          ))}
          <div className="pp-sub pp-sub-add">
            <Plus size={14} strokeWidth={2} />
            <input
              value={subDraft}
              spellCheck
              placeholder={subtasks.length ? 'Add another step' : 'Add a step, e.g. Desktop version'}
              onChange={(e) => setSubDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (subDraft.trim()) addStep();
                  else submit();
                } else if (e.key === 'Backspace' && !subDraft && subtasks.length) {
                  e.preventDefault();
                  setSubDraft(subtasks[subtasks.length - 1].title);
                  setSubtasks((list) => list.slice(0, -1));
                }
              }}
            />
          </div>
        </div>
      </Field>

      <Field f={F.due} hint="Finish by">
        <div className="pills">
          {quickDates.map(([label, key]) => (
            <button
              key={label}
              type="button"
              className={`pill${dueDate === key ? ' on' : ''}`}
              onClick={() => setDueDate(dueDate === key ? null : key)}
            >
              {label}
            </button>
          ))}
          <button type="button" className={`pill${customDate ? ' on' : ''}`} onClick={pickDate}>
            <CalendarDays size={13} strokeWidth={1.9} />
            {customDate ? dueLabelLong(dueDate) : 'Pick a date'}
          </button>
          {dueDate && (
            <button type="button" className="icon-btn sm" title="Clear date" onClick={() => setDueDate(null)}>
              <X size={13} />
            </button>
          )}
        </div>
      </Field>

      <Field f={F.project}>
        <button type="button" className="pill pill-select" onClick={pickProject}>
          {project ? <ProjectDot color={project.color} /> : <Inbox size={13} strokeWidth={1.9} />}
          {project ? project.name : 'Inbox'}
          <ChevronDown size={13} className="pill-chev" />
        </button>
      </Field>
    </Popup>
  );
}
