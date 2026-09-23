import { useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { addSubtaskAfter, indentSubtask, removeSubtask, subtaskKey, toggleSelected, updateSubtask, useUI } from '../store';
import { Checkbox } from './bits';
import { TextStyleButton } from './TextStyle';
import { textStyleProps } from '../lib/textStyle';

/** Focuses a subtask's title field once it's in the DOM — used right after creating one. */
export const focusSubtask = (id) => {
  requestAnimationFrame(() => document.querySelector(`[data-subtask-input="${id}"]`)?.focus());
};

function SubtaskRow({ task, subtask, index, focus, depth = 0 }) {
  const selecting = useUI((u) => u.selecting);
  const key = subtaskKey(task.id, subtask.id);
  const picked = useUI((u) => u.selected.has(key));
  const suppressEmptyDelete = useRef(false);

  const addSibling = () => {
    const id = addSubtaskAfter(task.id, subtask.id);
    if (id) focusSubtask(id);
  };
  const indent = () => {
    suppressEmptyDelete.current = true;
    if (!indentSubtask(task.id, subtask.id)) {
      suppressEmptyDelete.current = false;
      return;
    }
    focusSubtask(subtask.id);
    requestAnimationFrame(() => { suppressEmptyDelete.current = false; });
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
        onToggle={() => (selecting ? toggleSelected(key) : updateSubtask(task.id, subtask.id, { done: !subtask.done }))}
      />
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
            indent();
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
      {(subtask.subtasks || []).map((child, childIndex) => (
        <SubtaskRow key={child.id} task={task} subtask={child} index={childIndex} focus={focus} depth={depth + 1} />
      ))}
    </>
  );
}

/**
 * The nested checklist shown under a task row or card once it's expanded.
 * Clicks inside are kept from reaching the row/card, whose own click opens
 * the task — otherwise checking an item or typing would activate it instead.
 */
export function SubtaskTree({ task, variant = 'row' }) {
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
      {task.subtasks.map((st, i) => (
        <SubtaskRow key={st.id} task={task} subtask={st} index={i} focus={focus} />
      ))}
    </div>
  );
}
