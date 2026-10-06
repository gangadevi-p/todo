import { CalendarDays } from 'lucide-react';
import { openMenu } from '../store';
import { dueLabel } from '../lib/dates';
import { DatePicker } from './DatePicker';
import { rectOf } from './MenuLayer';

// Clicking the calendar (or a date) opens the calendar; it stays until you pick or click elsewhere.
function pickerProps(value, onChange) {
  return {
    onClick: (e) => {
      e.stopPropagation();
      openMenu({
        kind: 'popover',
        rect: rectOf(e.currentTarget),
        render: (close) => <DatePicker value={value} onChange={onChange} onClose={close} />,
      });
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
