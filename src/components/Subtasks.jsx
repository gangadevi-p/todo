import { useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { addNestedSubtask, addSubtaskAfter, removeSubtask, subtaskKey, toggleSelected, updateSubtask, useUI } from '../store';
import { Checkbox } from './bits';
import { TextStyleButton } from './TextStyle';
import { textStyleProps } from '../lib/textStyle';
import { formatTimestamp } from '../lib/dates';

/** Focuses a subtask's title field once it's in the DOM — used right after creating one. */
export const focusSubtask = (id) => {
  requestAnimationFrame(() => document.querySelector(`[data-subtask-input="${id}"]`)?.focus());
};

function hasCompletedItem(item) {
  return item.done || (item.subtasks || []).some(hasCompletedItem);
}

function SubtaskRow({ task, subtask, index, focus, depth = 0, completedOnly = false }) {
  const selecting = useUI((u) => u.selecting);
  const key = subtaskKey(task.id, subtask.id);
  const picked = useUI((u) => u.selected.has(key));
  const suppressEmptyDelete = useRef(false);

  const addSibling = () => {
    const id = addSubtaskAfter(task.id, subtask.id);
    if (id) focusSubtask(id);
  };
  const addNested = () => {
    suppressEmptyDelete.current = true;
    focusSubtask(addNestedSubtask(task.id, subtask.id));
    // Focusing the new child blurs the parent. Keep an empty parent alive
    // during that hand-off so its new child is not removed with it.
    requestAnimationFrame(() => requestAnimationFrame(() => { suppressEmptyDelete.current = false; }));
  };

  return (
    <>
      <div
        className={`sub-row${subtask.done ? ' done' : ''}${picked ? ' picked' : ''}`}
        style={depth ? { '--sub-depth': depth } : undefined}
        onClick={selecting ? () => toggleSelected(key) : undefined}
      >
      {!selecting && (
        <button type="button" className="sub-add-left" title="Add subtask below" onClick={addSibling}>
          <Plus size={12} strokeWidth={2.2} />
        </button>
      )}
      <Checkbox
        size="sm"
        state={selecting ? (picked ? 'done' : 'todo') : subtask.done ? 'done' : 'todo'}
        onToggle={() => (selecting ? toggleSelected(key) : updateSubtask(task.id, subtask.id, {
          done: !subtask.done,
          completedAt: subtask.done ? null : Date.now(),
        }))}
      />
      {completedOnly && subtask.done && subtask.completedAt && (
        <span className="sub-completed-at">{formatTimestamp(subtask.completedAt, true)}</span>
      )}
      <input
        data-subtask-input={subtask.id}
        className={textStyleProps(subtask.textStyle).className}
        style={textStyleProps(subtask.textStyle).style}
        value={subtask.title}
        spellCheck
        readOnly={selecting}
        placeholder="Subtask"
        onChange={(e) => updateSubtask(task.id, subtask.id, { title: e.target.value })}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Enter') {
            e.preventDefault();
            if (subtask.title.trim()) addSibling();
            else e.currentTarget.blur();
          } else if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            addNested();
          } else if (e.key === 'Backspace' && !subtask.title) {
            e.preventDefault();
            removeSubtask(task.id, subtask.id);
            focus(index - 1);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            focus(index - 1);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            focus(index + 1);
          }
        }}
        onBlur={() => {
          if (!subtask.title.trim() && !suppressEmptyDelete.current) removeSubtask(task.id, subtask.id);
        }}
      />
      {!selecting && (
        <TextStyleButton
          className="sub-style"
          value={subtask.textStyle}
          onChange={(textStyle) => updateSubtask(task.id, subtask.id, { textStyle })}
          label="Style checklist text"
        />
      )}
      {!selecting && (
        <button type="button" className="icon-btn sm sub-del" title="Delete checklist item" onClick={() => removeSubtask(task.id, subtask.id)}>
          <Trash2 size={13} />
        </button>
      )}
      </div>
      {(completedOnly ? (subtask.subtasks || []).filter(hasCompletedItem) : (subtask.subtasks || [])).map((child, childIndex) => (
        <SubtaskRow key={child.id} task={task} subtask={child} index={childIndex} focus={focus} depth={depth + 1} completedOnly={completedOnly} />
      ))}
    </>
  );
}

/**
 * The nested checklist shown under a task row or card once it's expanded.
 * Clicks inside are kept from reaching the row/card, whose own click opens
 * the task — otherwise checking an item or typing would activate it instead.
 */
export function SubtaskTree({ task, variant = 'row', completedOnly = false }) {
  const ref = useRef(null);
  const focus = (i) => {
    const st = task.subtasks[i];
    if (st) ref.current?.querySelector(`[data-subtask-input="${st.id}"]`)?.focus();
  };
  return (
    <div
      className={`subtasks subtasks-inline subtasks-${variant}`}
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {(completedOnly ? task.subtasks.filter(hasCompletedItem) : task.subtasks).map((st, i) => (
        <SubtaskRow key={st.id} task={task} subtask={st} index={i} focus={focus} completedOnly={completedOnly} />
      ))}
    </div>
  );
}
