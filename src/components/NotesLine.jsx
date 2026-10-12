import { StickyNote } from 'lucide-react';

/** The notes written on a task or sub-task, shown right under its title. Click them to edit. */
export function NotesLine({ notes, onOpen, className = '', style }) {
  const text = (notes || '').trim();
  if (!text) return null;
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
      <StickyNote size={12} strokeWidth={1.9} />
      <span>{text}</span>
    </div>
  );
}
