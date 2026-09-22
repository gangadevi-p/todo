import { useState } from 'react';
import { CalendarArrowUp, ChevronLeft, ChevronRight, Sun, Sunrise, X } from 'lucide-react';
import { MONTHS, WEEKDAYS_SHORT, addDays, fromKey, nextWeekday, shortDate, toKey, todayKey } from '../lib/dates';

export function DatePicker({ value, onChange, onClose }) {
  const today = todayKey();
  const [month, setMonth] = useState(() => {
    const d = fromKey(value || today);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const pick = (key) => {
    onChange(key);
    onClose();
  };

  const tomorrow = addDays(today, 1);
  const nextWeek = nextWeekday(today, 1);
  const quick = [
    { label: 'Today', icon: Sun, key: today, hint: WEEKDAYS_SHORT[fromKey(today).getDay()] },
    { label: 'Tomorrow', icon: Sunrise, key: tomorrow, hint: WEEKDAYS_SHORT[fromKey(tomorrow).getDay()] },
    { label: 'Next week', icon: CalendarArrowUp, key: nextWeek, hint: `Mon, ${shortDate(nextWeek, today)}` },
  ];

  const first = new Date(month);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  // Trim a trailing week that belongs entirely to the next month.
  const visible = cells[35].getMonth() !== month.getMonth() ? cells.slice(0, 35) : cells;

  const shift = (n) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  return (
    <div className="datepicker">
      <div className="dp-quick">
        {quick.map((q) => (
          <button key={q.label} type="button" className={`menu-item${value === q.key ? ' selected' : ''}`} onClick={() => pick(q.key)}>
            <span className="menu-icon"><q.icon size={15} strokeWidth={1.8} /></span>
            <span className="menu-label">{q.label}</span>
            <span className="menu-hint">{q.hint}</span>
          </button>
        ))}
      </div>
      <div className="menu-sep" />
      <div className="dp-head">
        <span className="dp-month">{MONTHS[month.getMonth()]} {month.getFullYear()}</span>
        <button type="button" className="icon-btn sm" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={15} /></button>
        <button type="button" className="icon-btn sm" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={15} /></button>
      </div>
      <div className="dp-grid">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i} className="dp-dow">{d}</span>
        ))}
        {visible.map((d) => {
          const key = toKey(d);
          const cls = [
            'dp-day',
            d.getMonth() !== month.getMonth() && 'muted',
            key < today && 'past',
            key === today && 'today',
            key === value && 'selected',
          ].filter(Boolean).join(' ');
          return (
            <button key={key} type="button" className={cls} onClick={() => pick(key)}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
      {value && (
        <>
          <div className="menu-sep" />
          <button type="button" className="menu-item" onClick={() => pick(null)}>
            <span className="menu-icon"><X size={15} strokeWidth={1.8} /></span>
            <span className="menu-label">Remove due date</span>
          </button>
        </>
      )}
    </div>
  );
}
