import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, CornerDownLeft, Inbox, Search } from 'lucide-react';
import {
  closeConfirm, closeSearch, revealTask, setHelp,
  useData, useUI,
} from '../store';
import { Kbd, ProjectDot, StatusIcon } from './bits';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ onClose, className = '', children, align = 'top', label }) {
  const ref = useRef(null);

  // Name the dialog from its heading, remember where focus was, and give it back on close.
  useEffect(() => {
    const el = ref.current;
    const opener = document.activeElement;
    const heading = el?.querySelector('h1, h2, h3');
    if (el && !label && heading) {
      if (!heading.id) heading.id = `dlg-${Math.random().toString(36).slice(2, 8)}`;
      el.setAttribute('aria-labelledby', heading.id);
    }
    return () => {
      if (opener && opener !== document.body && document.contains(opener)) opener.focus?.({ preventScroll: true });
    };
  }, [label]);

  // Keep Tab inside the dialog while it is open.
  const trapTab = (e) => {
    if (e.key !== 'Tab' || e.defaultPrevented) return;
    const items = [...ref.current.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || !ref.current.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div
      className={`overlay overlay-${align}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={ref} className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={label} onKeyDown={trapTab}>
        {children}
      </div>
    </div>
  );
}

// Search -----------------------------------------------------------------------

function Highlight({ text, query }) {
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (!query || i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

export function SearchPalette() {
  const open = useUI((u) => u.search);
  return open ? <SearchInner /> : null;
}

function SearchInner() {
  const tasks = useData((s) => s.tasks);
  const projects = useData((s) => s.projects);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef(null);
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return tasks
      .map((t) => ({ t, at: t.title.toLowerCase().indexOf(q) }))
      .filter((r) => r.at >= 0)
      .sort((a, b) => (a.t.status === 'done') - (b.t.status === 'done') || (a.at > 0) - (b.at > 0) || a.t.title.localeCompare(b.t.title))
      .slice(0, 50)
      .map((r) => r.t);
  }, [tasks, query]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector('.result.active')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (task) => {
    closeSearch();
    revealTask(task.id);
  };

  return (
    <Modal onClose={closeSearch} className="search" label="Search tasks">
      <div className="search-input">
        <Search size={17} strokeWidth={1.8} />
        <input
          autoFocus
          value={query}
          placeholder="Search tasks…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              closeSearch();
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && results[active]) {
              e.preventDefault();
              choose(results[active]);
            }
          }}
        />
      </div>
      {query.trim() ? (
        results.length ? (
          <div className="results" ref={listRef}>
            {results.map((t, i) => {
              const p = byId.get(t.projectId);
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`result${i === active ? ' active' : ''}${t.status === 'done' ? ' done' : ''}`}
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(t)}
                >
                  <StatusIcon status={t.status} />
                  <span className="result-path">
                    {p ? <ProjectDot color={p.color} size={7} /> : <Inbox size={13} strokeWidth={1.9} />}
                    {p ? p.name : 'No project'}
                    <ChevronRight size={13} className="result-sep" />
                  </span>
                  <span className="result-title">
                    <Highlight text={t.title} query={query.trim()} />
                  </span>
                  {i === active && <CornerDownLeft size={13} className="result-enter" />}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="search-empty">No tasks match “{query.trim()}”</div>
        )
      ) : (
        <div className="search-empty">Type to search task titles across every project.</div>
      )}
    </Modal>
  );
}

// Shortcuts help -----------------------------------------------------------------

const SHORTCUTS = [
  ['Anywhere', [
    ['mod+N', 'New task (popup)'],
    ['mod+K', 'Search'],
    ['mod+1 – 6', 'Today · Upcoming · All · Completed · Trash · Q&A'],
    ['mod+\\', 'Sidebar: icons only / open'],
    ['?', 'Show shortcuts'],
  ]],
  ['Tasks', [
    ['N', 'New task in this view (a new question on Q&A)'],
    ['↑ / ↓', 'Move selection'],
    ['Enter', 'Open the task popup'],
    ['Space', 'Complete / reopen'],
    ['T', 'Add to / remove from Today'],
    ['1 / 2 / 3 / 0', 'Priority low / medium / high / none'],
    ['mod+D', 'Duplicate'],
    ['Del', 'Delete'],
    ['mod+Z', 'Undo delete'],
    ['Esc', 'Close the popup / clear selection'],
  ]],
];

export function ShortcutsHelp() {
  const open = useUI((u) => u.help);
  const ref = useRef(null);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <Modal onClose={() => setHelp(false)} className="help" align="center">
      <div
        ref={ref}
        tabIndex={-1}
        className="help-inner"
        onKeyDown={(e) => {
          if (e.key === 'Escape' || e.key === '?') {
            e.stopPropagation();
            setHelp(false);
          }
        }}
      >
        <h2>Keyboard shortcuts</h2>
        {SHORTCUTS.map(([section, rows]) => (
          <div key={section} className="help-section">
            <div className="section-label">{section}</div>
            {rows.map(([keys, label]) => (
              <div key={keys} className="help-row">
                <span>{label}</span>
                <Kbd keys={keys} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}

// Confirm dialog -------------------------------------------------------------------

export function ConfirmDialog() {
  const confirm = useUI((u) => u.confirm);
  const btnRef = useRef(null);
  useEffect(() => {
    if (confirm) btnRef.current?.focus();
  }, [confirm]);
  if (!confirm) return null;
  const accept = () => {
    closeConfirm();
    confirm.onConfirm();
  };
  return (
    <Modal onClose={closeConfirm} className="confirm" align="center">
      <div
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            closeConfirm();
          }
        }}
      >
        <h2>{confirm.title}</h2>
        <p>{confirm.body}</p>
        <div className="confirm-actions">
          <button type="button" className="btn" onClick={closeConfirm}>Cancel</button>
          <button type="button" className="btn btn-danger" ref={btnRef} onClick={accept}>
            {confirm.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
