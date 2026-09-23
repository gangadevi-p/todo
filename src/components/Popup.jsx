import { useEffect, useRef } from 'react';
import {
  CalendarCheck, CalendarDays, CalendarPlus, CircleDashed, CornerDownRight, FolderClosed, Fingerprint, Flag, Link2,
  ListChecks, ListOrdered, Maximize2, Minimize2, Palette, StickyNote, Sun, Tag, TextCursorInput, X,
} from 'lucide-react';
import { closePopup, setPref, ui, useData, useUI } from '../store';
import { Kbd } from './bits';
import { Modal } from './Overlays';

// One icon + tint per field, shared by every create popup so each detail
// always looks the same wherever it appears.
export const F = {
  title: { icon: TextCursorInput, tint: '#64748b', label: 'Title' },
  name: { icon: Tag, tint: '#64748b', label: 'Name' },
  notes: { icon: StickyNote, tint: '#3f9468', label: 'Notes' },
  status: { icon: CircleDashed, tint: '#8a5cf0', label: 'Status' },
  priority: { icon: Flag, tint: '#d9498f', label: 'Priority' },
  project: { icon: FolderClosed, tint: '#4f7fd9', label: 'Project' },
  due: { icon: CalendarDays, tint: '#e07a2b', label: 'Due date' },
  today: { icon: Sun, tint: '#d99a06', label: 'Today' },
  subtasks: { icon: ListChecks, tint: '#1f9aa8', label: 'Subtasks' },
  color: { icon: Palette, tint: '#c9508b', label: 'Color' },
  parent: { icon: CornerDownRight, tint: '#4f7fd9', label: 'Task' },
  id: { icon: Fingerprint, tint: '#7c8aa0', label: 'ID' },
  projectId: { icon: Link2, tint: '#7c8aa0', label: 'Project ID' },
  created: { icon: CalendarPlus, tint: '#7c8aa0', label: 'Created' },
  completed: { icon: CalendarCheck, tint: '#7c8aa0', label: 'Completed' },
  order: { icon: ListOrdered, tint: '#7c8aa0', label: 'Order' },
};

export function Field({ f, hint, top, children }) {
  const Icon = f.icon;
  return (
    <div className={`pp-row${top ? ' top' : ''}`}>
      <div className="pp-label">
        <span className="pp-icon" style={{ '--tint': f.tint }}>
          <Icon size={14} strokeWidth={2} />
        </span>
        <span>
          {f.label}
          {hint && <small>{hint}</small>}
        </span>
      </div>
      <div className="pp-control">{children}</div>
    </div>
  );
}

/** A read-only value (ids, timestamps) shown in the Details column. */
export function ReadOnly({ children, mono, muted }) {
  return <div className={`pp-ro${mono ? ' mono' : ''}${muted ? ' muted' : ''}`}>{children}</div>;
}

/**
 * The shell every create popup shares: header with an expand toggle, a body
 * (main fields + a "Details" column) and a footer with the create button.
 * Expanding makes it wide; the choice is remembered.
 */
export function Popup({ title, subtitle, dirty, canSubmit, submitLabel, onSubmit, focusRef, side, children }) {
  const wide = useData((s) => Boolean(s.prefs.popupWide));
  const menu = useUI((u) => u.menu);
  const wasMenu = useRef(false);

  // Esc closes the popup (a date/project menu, if open, closes first).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !ui.get().menu) {
        e.preventDefault();
        closePopup();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // After a menu closes, put the cursor back so Enter still creates.
  useEffect(() => {
    if (menu) wasMenu.current = true;
    else if (wasMenu.current) {
      wasMenu.current = false;
      focusRef?.current?.focus();
    }
  }, [menu, focusRef]);

  return (
    <Modal onClose={dirty ? () => {} : closePopup} align="center" className={`popup${wide ? ' wide' : ''}`}>
      <div
        className="pp"
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
      >
        <header className="pp-head">
          <div className="pp-title">
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="pp-head-actions">
            <button
              type="button"
              className="icon-btn"
              title={wide ? 'Shrink' : 'Expand'}
              aria-label={wide ? 'Shrink popup' : 'Expand popup'}
              aria-pressed={wide}
              onClick={() => setPref('popupWide', !wide)}
            >
              {wide ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button type="button" className="icon-btn" title="Close" onClick={closePopup}>
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="pp-body">
          <div className="pp-cols">
            <div className="pp-main">{children}</div>
            {side && (
              <aside className="pp-side">
                <div className="pp-side-title">Details</div>
                {side}
              </aside>
            )}
          </div>
        </div>

        <footer className="pp-foot">
          <span className="pp-keys">
            <Kbd keys="Enter" /> create <Kbd keys="Esc" /> cancel
          </span>
          <span className="pp-actions">
            <button type="button" className="btn" onClick={closePopup}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={!canSubmit} onClick={onSubmit}>
              {submitLabel}
            </button>
          </span>
        </footer>
      </div>
    </Modal>
  );
}
