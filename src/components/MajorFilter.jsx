import { Plus } from 'lucide-react';
import { setMajorFilter } from '../store';
import { textStyleProps } from '../lib/textStyle';

/**
 * A project's major tasks as chips under the overview; only the picked one
 * (the first by default) is shown below. The "+" at the end adds a major task
 * and is there even when the project has none yet.
 */
export function MajorFilter({ majors, active, onAdd }) {
  if (!majors) return null;
  const empty = majors.length === 0;
  return (
    <div className="major-filter" role="tablist" aria-label="Major tasks">
      {majors.map((task) => {
        const { color } = textStyleProps(task.textStyle).style || {};
        return (
          <button
            key={task.id}
            type="button"
            role="tab"
            aria-selected={active === task.id}
            className={`major-chip${active === task.id ? ' on' : ''}${task.status === 'done' ? ' done' : ''}`}
            style={color ? { '--chip-color': color } : undefined}
            onClick={() => setMajorFilter(task.id)}
          >
            {color && <i />}
            <span className="major-chip-title">{task.title || 'Untitled'}</span>
          </button>
        );
      })}
      {onAdd && (
        <button type="button" className={`major-chip major-chip-add${empty ? ' empty' : ''}`} aria-label="Add major task" onClick={onAdd}>
          <Plus size={14} strokeWidth={2} />
          {empty && 'Major task'}
        </button>
      )}
    </div>
  );
}
