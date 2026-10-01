import { CircleCheck } from 'lucide-react';

/**
 * "Done" mark: strikes the text through without completing the task. Only the
 * checkbox moves a task to the Done tab. Sits in the date / done / colour /
 * delete group on every task, sub-task, nested task and checklist item.
 */
export function StrikeButton({ on, onToggle }) {
  return (
    <button
      type="button"
      className={`icon-btn sm strike-button${on ? ' on' : ''}`}
      aria-label={on ? 'Remove strike-through' : 'Strike off'}
      aria-pressed={Boolean(on)}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <CircleCheck size={14} strokeWidth={1.9} />
    </button>
  );
}
