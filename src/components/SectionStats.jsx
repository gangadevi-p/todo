import { CalendarDays } from 'lucide-react';
import { setStatsFilter, useUI } from '../store';
import { PriorityIcon } from './bits';

/** A small "how much is done" overview shown at the top of every section. */
export function SectionStats({ stats }) {
  const statsFilter = useUI((u) => u.statsFilter);
  if (!stats || stats.total === 0) return null;

  const { todo, done, avgProgress, deadline } = stats;
  const pct = Math.round(avgProgress * 100);
  const r = 19;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - avgProgress);

  return (
    <div className="stats-panel">
      <svg className="stats-ring" width="48" height="48" viewBox="0 0 48 48" role="img" aria-label={`${pct}% complete`}>
        <circle cx="24" cy="24" r={r} className="ring-track" />
        <circle
          cx="24" cy="24" r={r}
          className="ring-fill"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 24 24)"
        />
        <text x="24" y="24" className="ring-label" textAnchor="middle" dominantBaseline="central">{pct}%</text>
      </svg>
      <div className="stats-body">
        <div className="stats-breakdown" role="tablist" aria-label="Filter by status">
          <button
            type="button"
            role="tab"
            aria-selected={statsFilter === 'todo'}
            className={`stats-chip chip-todo${statsFilter === 'todo' ? ' on' : ''}`}
            onClick={() => setStatsFilter('todo')}
          >
            <i />{todo} todo
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={statsFilter === 'done'}
            className={`stats-chip chip-done${statsFilter === 'done' ? ' on' : ''}`}
            onClick={() => setStatsFilter('done')}
          >
            <i />{done} done
          </button>
        </div>
      </div>
      {deadline && (
        <div
          className={`stats-deadline${deadline.days < 0 ? ' overdue' : ''}`}
          title={`Nearest open task due ${deadline.date}`}
        >
          {deadline.priority && (
            <span className="stats-deadline-priority" title={`Average ${deadline.priority} priority across tasks`}>
              <PriorityIcon level={deadline.priority} size={14} />
            </span>
          )}
          <CalendarDays size={13} strokeWidth={2} />
          <span>{deadline.label}</span>
        </div>
      )}
    </div>
  );
}
