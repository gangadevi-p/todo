import { Check } from 'lucide-react';
import { modKey } from '../lib/util';

/** Rounded-square checkbox. `state` is todo | done. */
export function Checkbox({ state = 'todo', onToggle, size = 'md', title }) {
  return (
    <button
      type="button"
      className={`check check-${size}`}
      data-state={state}
      aria-label={state === 'done' ? 'Mark as incomplete' : 'Mark as complete'}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onToggle?.();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Check strokeWidth={3.2} />
    </button>
  );
}

/** Static version of the checkbox, used as a status glyph in menus. */
export function StatusIcon({ status, size = 14 }) {
  return (
    <span className="status-icon" data-state={status} style={{ width: size, height: size }}>
      <Check strokeWidth={3.4} />
    </span>
  );
}

/** Three signal bars, filled according to priority. */
export function PriorityIcon({ level, size = 14 }) {
  const n = { low: 1, medium: 2, high: 3, neutral: 3 }[level] || 0;
  return (
    <svg className={`prio prio-${level || 'none'}`} width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <rect key={i} x={2 + i * 4.5} y={10 - i * 3.5} width="3" height={4 + i * 3.5} rx="1" className={i < n ? 'on' : 'off'} />
      ))}
    </svg>
  );
}

export function ProjectDot({ color, size = 8 }) {
  return <span className="project-dot" style={{ background: color, width: size, height: size }} />;
}

/** Small ring showing a project's overall completion, in its own color. */
export function ProjectRing({ color, progress = 0, size = 16 }) {
  const r = (size - 3) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg className="project-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        stroke={color}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - progress)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

/** Renders a shortcut like "mod+K" as platform-aware key caps. */
export function Kbd({ keys }) {
  const parts = keys.split('+').map((k) => (k === 'mod' ? modKey() : k));
  return (
    <span className="kbd-group">
      {parts.map((k, i) => (
        <kbd key={i}>{k}</kbd>
      ))}
    </span>
  );
}

export function shortcutText(keys) {
  return keys
    .split('+')
    .map((k) => (k === 'mod' ? modKey() : k))
    .join(modKey() === '⌘' ? '' : ' ');
}
