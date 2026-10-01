import { CalendarDays } from 'lucide-react';
import { clearPreviewTimers, closeMenu, hidePreview, openMenu, ui } from '../store';
import { dueLabel } from '../lib/dates';
import { DatePicker } from './DatePicker';
import { rectOf } from './MenuLayer';

// Hovering the calendar (or a date) opens just the calendar, never the task
// overview. Clicking it keeps the calendar open until you click elsewhere.
let hoverTimer = null;
let closeTimer = null;
let openKey = null;
let pinned = false;

const isOpen = () => openKey !== null && ui.get().menu?.key === openKey;

function scheduleClose() {
  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    if (pinned || !isOpen()) return;
    closeMenu();
  }, 250);
}

function openPicker(el, value, onChange, pin) {
  clearTimeout(closeTimer);
  const key = `due-${Date.now()}`;
  openKey = key;
  pinned = pin;
  openMenu({
    key,
    kind: 'popover',
    rect: rectOf(el),
    autoFocus: pin,
    render: (close) => (
      <div onMouseEnter={() => clearTimeout(closeTimer)} onMouseLeave={scheduleClose}>
        <DatePicker value={value} onChange={onChange} onClose={close} />
      </div>
    ),
  });
}

function pickerProps(value, onChange) {
  return {
    onClick: (e) => {
      e.stopPropagation();
      clearTimeout(hoverTimer);
      if (isOpen()) pinned = true;
      else openPicker(e.currentTarget, value, onChange, true);
    },
    onMouseEnter: (e) => {
      const el = e.currentTarget;
      clearTimeout(closeTimer);
      clearPreviewTimers();
      hidePreview();
      if (isOpen()) return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => openPicker(el, value, onChange, false), 120);
    },
    onMouseLeave: () => {
      clearTimeout(hoverTimer);
      scheduleClose();
    },
  };
}

/** Calendar icon for an item with no last day yet. Once a date is set, DueChip takes its place. */
export function DueButton({ value, onChange, className = '' }) {
  return (
    <button
      type="button"
      className={`icon-btn sm due-button ${className}`.trim()}
      aria-label="Set last day"
      {...pickerProps(value, onChange)}
    >
      <CalendarDays size={14} strokeWidth={1.9} />
    </button>
  );
}

/**
 * The date itself, toned like the chips on task rows. Click it to change or remove the date.
 * Without `onChange` (bulk-select mode) it is plain text, so a click still selects the row.
 */
export function DueChip({ value, today, done = false, onChange }) {
  const due = dueLabel(value, today);
  const className = `meta meta-due due-chip due-${done ? 'normal' : due.tone}`;
  const content = (
    <>
      <CalendarDays size={12} strokeWidth={1.9} />
      <span className="due-text">{due.text}</span>
    </>
  );
  if (!onChange) return <span className={className}>{content}</span>;
  return (
    <button type="button" className={className} aria-label={`Last day ${due.text}. Change`} {...pickerProps(value, onChange)}>
      {content}
    </button>
  );
}
