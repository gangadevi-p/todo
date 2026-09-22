import { Clock } from 'lucide-react';

/** A small "how much is done" overview shown at the top of every section. */
export function SectionStats({ stats }) {
  if (!stats || stats.total === 0) return null;

  if (stats.kind === 'completed') {
    return (
      <div className="stats-panel stats-completed">
        <div className="stat">
          <span className="stat-num">{stats.today}</span>
          <span className="stat-label">Today</span>
        </div>
        <div className="stat">
          <span className="stat-num">{stats.week}</span>
          <span className="stat-label">This week</span>
        </div>
        <div className="stat">
          <span className="stat-num">{stats.total}</span>
          <span className="stat-label">All time</span>
        </div>
      </div>
    );
  }

  const { todo, done, total, avgProgress } = stats;
  const pct = Math.round(avgProgress * 100);
  const r = 19;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - avgProgress);

  return (
    <div className="stats-panel">
      <svg className="stats-ring" width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r={r} className="ring-track" />
        <circle
          cx="24" cy="24" r={r}
          className="ring-fill"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 24 24)"
        />
      </svg>
      <div className="stats-body">
        <div className="stats-headline">
          <strong>{done}</strong> of {total} done
          <span className="stats-pct" title="Average progress, counting checked-off subtasks on open tasks">{pct}% avg</span>
        </div>
        <div className="stats-breakdown">
          <span className="stats-chip chip-todo"><i />{todo} todo</span>
          <span className="stats-chip chip-done"><i />{done} done</span>
        </div>
      </div>
      {stats.eta && (
        <div
          className="stats-eta"
          title={stats.etaBasis === 'section' ? 'Estimated from this section’s own pace' : 'Estimated from your overall pace, this section doesn’t have enough finished tasks yet'}
        >
          <Clock size={13} strokeWidth={2} />
          <span>{stats.eta} left</span>
        </div>
      )}
    </div>
  );
}
