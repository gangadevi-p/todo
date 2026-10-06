import { useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { addNestedSubtask, addSubtaskAfter, removeSubtask, subtaskKey, toggleSelected, updateSubtask, useUI } from '../store';
import { Checkbox } from './bits';
import { TextStyleButton } from './TextStyle';
import { textStyleProps } from '../lib/textStyle';
import { formatTimestamp } from '../lib/dates';
import { useToday } from '../lib/useToday';
import { DueButton, DueChip } from './DueButton';
import { StrikeButton } from './StrikeButton';

/**
 * Focuses a subtask's title field once it's in the DOM — used right after creating one.
 * The same item can be on the page and in the task popup at once: stay in the popup when typing there.
 */
export const focusSubtask = (id) => {
  const scope = document.activeElement?.closest?.('.preview') || document;
  const selector = `[data-subtask-input="${id}"]`;
  requestAnimationFrame(() => (scope.querySelector(selector) || document.querySelector(selector))?.focus());
};

function hasCompletedItem(item) {
  return item.done || (item.subtasks || []).some(hasCompletedItem);
}

function hasTodoItem(item) {
  return !item.done || (item.subtasks || []).some(hasTodoItem);
}

function visibleItems(items, completedOnly, todoOnly) {
  if (completedOnly) return items.filter(hasCompletedItem);
  if (todoOnly) return items.filter(hasTodoItem);
  return items;
}

function SubtaskRow({ task, subtask, index, focus, depth = 0, completedOnly = false, todoOnly = false, inPopup = false, laneHead = false }) {
  const selecting = useUI((u) => u.selecting);
  const today = useToday();
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

  // On the board, a box's first row adds into that box ("+" or Enter); new boxes come from the major task's "+".
  const addNext = laneHead ? addNested : addSibling;

  // Inside the popup a row is being edited there, so it doesn't anchor a popup of its own.
  const anchorProps = inPopup ? {} : { 'data-sub-row': '', 'data-sub-id': subtask.id };

  return (
    <>
      <div
        className={`sub-row${subtask.done ? ' done' : ''}${subtask.struck ? ' struck' : ''}${picked ? ' picked' : ''}`}
        style={depth ? { '--sub-depth': depth } : undefined}
        {...anchorProps}
        onClick={selecting ? () => toggleSelected(key) : undefined}
      >
      {!selecting && (
        <button type="button" className="sub-add-left" aria-label={laneHead ? 'Add a sub-task in this box' : depth ? 'Add another nested task' : 'Add another sub-task'} onClick={addNext}>
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
        className={textStyleProps(subtask.textStyle, subtask.struck).className}
        style={textStyleProps(subtask.textStyle, subtask.struck).style}
        value={subtask.title}
        spellCheck
        readOnly={selecting}
        placeholder="Subtask"
        onChange={(e) => updateSubtask(task.id, subtask.id, { title: e.target.value })}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Enter') {
            e.preventDefault();
            if (subtask.title.trim()) addNext();
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
      {subtask.dueDate
        ? <DueChip value={subtask.dueDate} today={today} done={subtask.done} onChange={selecting ? undefined : (dueDate) => updateSubtask(task.id, subtask.id, { dueDate })} />
        : !selecting && <DueButton value={null} onChange={(dueDate) => updateSubtask(task.id, subtask.id, { dueDate })} />}
      {!selecting && (
        <StrikeButton on={subtask.struck} onToggle={() => updateSubtask(task.id, subtask.id, { struck: !subtask.struck })} />
      )}
      {!selecting && (
        <TextStyleButton
          className="sub-style"
          value={subtask.textStyle}
          onChange={(textStyle) => updateSubtask(task.id, subtask.id, { textStyle })}
          label="Style checklist text"
        />
      )}
      {!selecting && (
        <button type="button" className="icon-btn sm sub-del" aria-label={subtask.subtasks?.length ? 'Delete this item and everything under it' : 'Delete checklist item'} onClick={() => removeSubtask(task.id, subtask.id)}>
          <Trash2 size={13} />
        </button>
      )}
      </div>
      {visibleItems(subtask.subtasks || [], completedOnly, todoOnly).map((child, childIndex) => (
        <SubtaskRow key={child.id} task={task} subtask={child} index={childIndex} focus={focus} depth={depth + 1} completedOnly={completedOnly} todoOnly={todoOnly} inPopup={inPopup} />
      ))}
    </>
  );
}

/**
 * The nested checklist shown under a task row or card once it's expanded.
 * Clicks inside are kept from reaching the row/card, whose own click opens
 * the task — otherwise checking an item or typing would activate it instead.
 */
export function SubtaskTree({ task, items = task.subtasks, variant = 'row', completedOnly = false, todoOnly = false, inPopup = false }) {
  const ref = useRef(null);
  const focus = (i) => {
    const st = items[i];
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
      {visibleItems(items, completedOnly, todoOnly).map((st, i) => {
        const row = <SubtaskRow key={st.id} task={task} subtask={st} index={i} focus={focus} completedOnly={completedOnly} todoOnly={todoOnly} inPopup={inPopup} laneHead={variant === 'board'} />;
        // On the board each top-level item gets its own lane, its nested items stacked beneath it.
        return variant === 'board' ? <div key={st.id} className="sub-lane">{row}</div> : row;
      })}
    </div>
  );
}
