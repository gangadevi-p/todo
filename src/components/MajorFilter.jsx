import { Plus } from 'lucide-react';
import { setMajorFilter } from '../store';
import { textStyleProps } from '../lib/textStyle';

/** One chip per major task of a project, right under the overview; only the picked one (the first by default) is shown below. */
export function MajorFilter({ majors, active, onAdd }) {
  if (!majors || majors.length < 2) return null;
  return (
    <div className="major-filter" role="tablist" aria-label="Filter by major task">
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
        <button type="button" className="major-chip major-chip-add" aria-label="Add major task" onClick={onAdd}>
          <Plus size={14} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
