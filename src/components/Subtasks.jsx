import { useLayoutEffect, useRef } from 'react';
import { ListChecks, ListTree, Check, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  addNestedSubtask, addSubtask, addSubtaskAfter, openEditor, openMenu, removeSubtask, setStatsFilter, subtaskKey, toggleSelected, ui, updateSubtask, useUI,
} from '../store';
import { Checkbox } from './bits';
import { TextStyleButton } from './TextStyle';
import { textStyleProps } from '../lib/textStyle';
import { formatTimestamp } from '../lib/dates';
import { useToday } from '../lib/useToday';
import { CompletedDate, DueButton, DueChip } from './DueButton';
import { StrikeButton } from './StrikeButton';
import { NotesLine } from './NotesLine';

/**
 * Focuses a subtask's title field once it's in the DOM — used right after creating one.
 * The same item can be on the page and in the task popup at once: stay in the popup when typing there.
 */
// Browsers without field-sizing need the text field's height set from its content.
const SIZES_ITSELF = typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content');

export const focusSubtask = (id) => {
  const scope = document.activeElement?.closest?.('.preview') || document;
  const selector = `[data-subtask-input="${id}"]`;
  requestAnimationFrame(() => (scope.querySelector(selector) || document.querySelector(selector))?.focus());
};

/**
 * Adds an empty sub-task at the end of a task's list and puts the cursor in it:
 * the major task's "+", the page "+" and the N key all add here. A new sub-task
 * is open work, so the page switches to the Todo tab if Done was showing.
 */
export function addSubtaskTo(taskId) {
  if (ui.get().statsFilter === 'done') setStatsFilter('todo');
  focusSubtask(addSubtask(taskId));
}

/** Right-click on a sub-task or nested task: edit it, tick it, add under or after it, delete it. */
function openSubtaskMenu(task, subtask, anchor) {
  openMenu({
    kind: 'menu',
    ...anchor,
    items: [
      { label: 'Edit', icon: Pencil, onSelect: () => openEditor(task.id, subtask.id) },
      {
        label: subtask.done ? 'Mark as incomplete' : 'Mark as complete',
        icon: subtask.done ? RotateCcw : Check,
        onSelect: () => updateSubtask(task.id, subtask.id, { done: !subtask.done, completedAt: subtask.done ? null : Date.now() }),
      },
      { divider: true },
      { label: 'Add sub-task below', icon: ListChecks, onSelect: () => { const id = addSubtaskAfter(task.id, subtask.id); if (id) focusSubtask(id); } },
      { label: 'Add nested task', icon: ListTree, onSelect: () => focusSubtask(addNestedSubtask(task.id, subtask.id)) },
      { divider: true },
      { label: 'Delete', icon: Trash2, danger: true, onSelect: () => removeSubtask(task.id, subtask.id) },
    ],
  });
}

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

/**
 * `levelId` is this row's ancestor at the sub-task level (the row itself when
 * it is a sub-task). Every sub-task sits at the same level; only Tab nests.
 */
function SubtaskRow({ task, subtask, index, focus, depth = 0, completedOnly = false, todoOnly = false, inPopup = false, levelId = subtask.id }) {
  const selecting = useUI((u) => u.selecting);
  const today = useToday();
  const key = subtaskKey(task.id, subtask.id);
  const picked = useUI((u) => u.selected.has(key));
  const suppressEmptyDelete = useRef(false);
  const textRef = useRef(null);
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || SIZES_ITSELF) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [subtask.title]);

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

  // "+" only ever adds a sub-task, never a nested one: right after this row's sub-task. Only Tab nests.
  const addSubtaskHere = () => {
    const id = addSubtaskAfter(task.id, levelId);
    if (id) focusSubtask(id);
  };

  // Inside the popup a row is being edited there, so it doesn't anchor a popup of its own.
  const anchorProps = inPopup ? {} : { 'data-sub-row': '', 'data-sub-id': subtask.id, 'data-sub-task': task.id };

  return (
    <>
      <div
        className={`sub-row${subtask.done ? ' done' : ''}${subtask.struck ? ' struck' : ''}${picked ? ' picked' : ''}`}
        style={depth ? { '--sub-depth': depth } : undefined}
        {...anchorProps}
        tabIndex={inPopup ? undefined : -1}
        onClick={(e) => {
          if (selecting) toggleSelected(key);
          // Clicking the row itself focuses it, so Delete removes this row.
          else if (!e.target.closest('input, textarea, button')) e.currentTarget.focus();
        }}
        onDoubleClick={(e) => {
          if (!selecting && !inPopup && !e.target.closest('textarea, input, button')) openEditor(task.id, subtask.id);
        }}
        onContextMenu={(e) => {
          if (selecting || inPopup) return;
          e.preventDefault();
          e.stopPropagation();
          openSubtaskMenu(task, subtask, { x: e.clientX, y: e.clientY });
        }}
      >
      {!selecting && (
        <button type="button" className="sub-add-left" aria-label="Add a sub-task" onClick={addSubtaskHere}>
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
        <CompletedDate
          className="sub-completed-at"
          value={subtask.completedAt}
          onChange={selecting ? undefined : (completedAt) => updateSubtask(task.id, subtask.id, { completedAt })}
        />
      )}
      <textarea
        ref={textRef}
        rows={1}
        data-subtask-input={subtask.id}
        className={textStyleProps(subtask.textStyle, subtask.struck).className}
        style={textStyleProps(subtask.textStyle, subtask.struck).style}
        value={subtask.title}
        spellCheck
        readOnly={selecting}
        placeholder="Subtask"
        onChange={(e) => updateSubtask(task.id, subtask.id, { title: e.target.value.replace(/\n/g, ' ') })}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          // A long sub-task wraps; the arrows only leave it from its first or last line.
          const el = e.currentTarget;
          const wrapped = el.clientHeight > (parseFloat(getComputedStyle(el).lineHeight) || 18) * 1.5;
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
          } else if (e.key === 'ArrowUp' && (!wrapped || el.selectionStart === 0)) {
            e.preventDefault();
            focus(index - 1);
          } else if (e.key === 'ArrowDown' && (!wrapped || el.selectionEnd === el.value.length)) {
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
      {!selecting && !inPopup && (
        <button type="button" className="icon-btn sm sub-edit" aria-label="Edit with notes and dates" title="Edit: notes, dates, priority" onClick={() => openEditor(task.id, subtask.id)}>
          <Pencil size={13} />
        </button>
      )}
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
      {!selecting && !inPopup && (
        <NotesLine
          notes={subtask.notes}
          onOpen={() => openEditor(task.id, subtask.id)}
          className="sub-note"
          style={{ '--sub-depth': depth }}
        />
      )}
      {visibleItems(subtask.subtasks || [], completedOnly, todoOnly).map((child, childIndex) => (
        <SubtaskRow key={child.id} task={task} subtask={child} index={childIndex} focus={focus} depth={depth + 1} completedOnly={completedOnly} todoOnly={todoOnly} inPopup={inPopup} levelId={levelId} />
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
      {/* Every sub-task is a row of the same list, in one column; nested items indent under their row. */}
      {visibleItems(items, completedOnly, todoOnly).map((st, i) => (
        <SubtaskRow key={st.id} task={task} subtask={st} index={i} focus={focus} completedOnly={completedOnly} todoOnly={todoOnly} inPopup={inPopup} />
      ))}
    </div>
  );
}
