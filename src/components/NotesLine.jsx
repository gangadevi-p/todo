import { useState, useSyncExternalStore } from 'react';
import { ChevronRight } from 'lucide-react';

// Which notes are open, remembered per browser. They start closed so a page
// full of notes reads as titles first; a chevron beside the title opens them.
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

const useNoteOpen = (id) => useSyncExternalStore(subscribe, () => openIds.has(id));

/** The chevron that sits right after a title when it has notes. It only shows or hides them. */
export function NotesToggle({ id, notes }) {
  const open = useNoteOpen(id);
  if (!(notes || '').trim()) return null;
  return (
    <button
      type="button"
      className={`notes-chev-btn${open ? ' open' : ''}`}
      aria-expanded={open}
      aria-label={open ? 'Hide notes' : 'Show notes'}
      title={open ? 'Hide notes' : 'Show notes'}
      onClick={(e) => {
        e.stopPropagation();
        toggleOpen(id);
      }}
    >
      <ChevronRight size={13} strokeWidth={2.2} />
    </button>
  );
}

/** The notes written on a task or sub-task, right under its title once its chevron is open. Click them to edit. */
export function NotesLine({ id, notes, onOpen, className = '', style }) {
  const open = useNoteOpen(id);
  const text = (notes || '').trim();
  if (!text || !open) return null;
  return (
    <div
      className={`notes-line ${className}`.trim()}
      style={style}
      role="note"
      title="Click to edit notes"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <span>{text}</span>
    </div>
  );
}
