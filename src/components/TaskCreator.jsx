import { useId, useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronDown, Circle, Flag, Plus, X } from 'lucide-react';
import './task-creator.css';

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const dateKey = (date) => date.toISOString().slice(0, 10);
const today = () => dateKey(new Date());
const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return dateKey(date);
};

/**
 * A self-contained task-creation component.
 *
 * `onCreate` receives `{ title, subtitle, status, priority, dueDate }`.
 * Pass existingTitles to prevent duplicate task names in a list or project.
 */
export function TaskCreator({ onCreate, existingTitles = [], className = '' }) {
  const titleId = useId();
  const subtitleId = useId();
  const dueId = useId();
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState(today());
  const [submitted, setSubmitted] = useState(false);

  const cleanTitle = title.trim();
  const duplicate = useMemo(
    () => existingTitles.some((item) => item.trim().toLowerCase() === cleanTitle.toLowerCase()),
    [cleanTitle, existingTitles],
  );
  const titleError = !cleanTitle
    ? 'Add a task title.'
    : cleanTitle.length > 120
      ? 'Keep the title to 120 characters or fewer.'
      : duplicate
        ? 'A task with this title already exists.'
        : '';
  const subtitleError = subtitle.trim().length > 240 ? 'Keep the subtitle to 240 characters or fewer.' : '';
  const dueError = dueDate && dueDate < today() ? 'Choose today or a future date.' : '';
  const canCreate = !titleError && !subtitleError && !dueError;

  const submit = (event) => {
    event.preventDefault();
    setSubmitted(true);
    if (!canCreate) return;
    onCreate?.({
      title: cleanTitle,
      subtitle: subtitle.trim(),
      status: 'todo',
      priority,
      dueDate: dueDate || null,
    });
    setTitle('');
    setSubtitle('');
    setPriority('medium');
    setDueDate(today());
    setSubmitted(false);
  };

  return (
    <form className={`task-creator ${className}`} onSubmit={submit} noValidate>
      <header className="task-creator__header">
        <div>
          <p className="task-creator__eyebrow">New task</p>
          <h2>Create a task</h2>
        </div>
        <span className="task-creator__todo"><Circle size={14} /> Todo</span>
      </header>

      <div className="task-creator__field">
        <label htmlFor={titleId}>Title <span aria-hidden="true">*</span></label>
        <input
          id={titleId}
          value={title}
          maxLength={121}
          autoFocus
          placeholder="What needs to be done?"
          aria-invalid={Boolean(submitted && titleError)}
          aria-describedby={submitted && titleError ? `${titleId}-error` : undefined}
          onChange={(event) => setTitle(event.target.value)}
        />
        {submitted && titleError && <p id={`${titleId}-error`} className="task-creator__error">{titleError}</p>}
      </div>

      <div className="task-creator__field">
        <label htmlFor={subtitleId}>Subtitle <small>Optional</small></label>
        <textarea
          id={subtitleId}
          rows="2"
          value={subtitle}
          maxLength={241}
          placeholder="Add a little context…"
          aria-invalid={Boolean(submitted && subtitleError)}
          aria-describedby={submitted && subtitleError ? `${subtitleId}-error` : undefined}
          onChange={(event) => setSubtitle(event.target.value)}
        />
        {submitted && subtitleError && <p id={`${subtitleId}-error`} className="task-creator__error">{subtitleError}</p>}
      </div>

      <div className="task-creator__details">
        <fieldset className="task-creator__field task-creator__priority">
          <legend><Flag size={14} /> Priority</legend>
          <div role="radiogroup" aria-label="Task priority" className="task-creator__priority-options">
            {PRIORITIES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={priority === option.value}
                data-priority={option.value}
                className={priority === option.value ? 'is-selected' : ''}
                onClick={() => setPriority(option.value)}
              >
                <i aria-hidden="true" /> {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="task-creator__field">
          <label htmlFor={dueId}><CalendarDays size={14} /> Due date</label>
          <div className="task-creator__date-control">
            <select value={dueDate} aria-label="Quick due-date choice" onChange={(event) => setDueDate(event.target.value)}>
              <option value={today()}>Today</option>
              <option value={tomorrow()}>Tomorrow</option>
              <option value="">No due date</option>
              <option value="custom">Custom date…</option>
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </div>
          {dueDate === 'custom' && (
            <input
              type="date"
              min={today()}
              aria-label="Custom due date"
              onChange={(event) => setDueDate(event.target.value)}
            />
          )}
          {submitted && dueError && <p className="task-creator__error">{dueError}</p>}
        </div>
      </div>

      <footer className="task-creator__footer">
        <span>Fields marked <b>*</b> are required.</span>
        <button type="submit" className="task-creator__submit">
          <Plus size={16} /> Create task
        </button>
      </footer>
    </form>
  );
}
