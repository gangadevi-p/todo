import { useState, useSyncExternalStore } from 'react';
import { ChevronRight, StickyNote } from 'lucide-react';

// Which notes are open, remembered per browser. They start closed so a page
// full of notes reads as titles first; a chevron opens the ones you want.
const KEY = 'todo.openNotes';
const read = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));
  } catch {
    return new Set();
  }
};
let openIds = read();
const listeners = new Set();
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
function toggleOpen(id) {
  openIds = new Set(openIds);
  if (openIds.has(id)) openIds.delete(id);
  else openIds.add(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...openIds]));
  } catch { /* storage unavailable: it just won't be remembered */ }
  listeners.forEach((fn) => fn());
}

/** The notes written on a task or sub-task, tucked under its title behind a chevron. Click the text to edit. */
export function NotesLine({ id, notes, onOpen, className = '', style }) {
  const [local, setLocal] = useState(false);
  const remembered = useSyncExternalStore(subscribe, () => (id ? openIds.has(id) : false));
  const open = id ? remembered : local;
  const text = (notes || '').trim();
  if (!text) return null;
  return (
    <div className={`notes-line${open ? ' open' : ''} ${className}`.trim()} style={style}>
      <button
        type="button"
        className="notes-toggle"
        aria-expanded={open}
        aria-label={open ? 'Hide notes' : 'Show notes'}
        onClick={(e) => {
          e.stopPropagation();
          if (id) toggleOpen(id);
          else setLocal((v) => !v);
        }}
      >
        <ChevronRight size={12} strokeWidth={2.2} className="notes-chev" />
        <StickyNote size={12} strokeWidth={1.9} />
        <span>Notes</span>
      </button>
      {open && (
        <div
          className="notes-body"
          role="note"
          title="Click to edit notes"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
}
