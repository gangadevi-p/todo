import {
  ArrowRight, CalendarArrowUp, CalendarDays, CalendarX, Copy, Inbox, Minus, PanelRightOpen, RotateCcw, Check, Sun, SunDim, Sunrise, Trash2, CircleDashed,
} from 'lucide-react';
import {
  data, deleteTask, duplicateTask, openMenu, selectTask, toggleComplete, toggleToday, updateTask,
} from '../store';
import { STATUSES, PRIORITIES } from '../lib/util';
import { addDays, nextWeekday, todayKey } from '../lib/dates';
import { PriorityIcon, ProjectDot, StatusIcon } from './bits';
import { DatePicker } from './DatePicker';

export function openDatePicker(task, anchor) {
  openMenu({
    kind: 'popover',
    ...anchor,
    render: (close) => (
      <DatePicker value={task.dueDate} onChange={(dueDate) => updateTask(task.id, { dueDate })} onClose={close} />
    ),
  });
}

export function statusItems(task) {
  return STATUSES.map((s) => ({
    label: s.label,
    icon: <StatusIcon status={s.id} />,
    checked: task.status === s.id,
    onSelect: () => updateTask(task.id, { status: s.id }),
  }));
}

export function priorityItems(task) {
  return PRIORITIES.map((p) => ({
    label: p.label,
    icon: p.id ? <PriorityIcon level={p.id} /> : Minus,
    checked: task.priority === p.id,
    onSelect: () => updateTask(task.id, { priority: p.id }),
  }));
}

export function projectItems(task) {
  const projects = [...data.get().projects].sort((a, b) => a.order - b.order);
  return [
    { label: 'Inbox', icon: Inbox, checked: !task.projectId, onSelect: () => updateTask(task.id, { projectId: null }) },
    ...(projects.length ? [{ divider: true }] : []),
    ...projects.map((p) => ({
      label: p.name,
      icon: <ProjectDot color={p.color} />,
      checked: task.projectId === p.id,
      onSelect: () => updateTask(task.id, { projectId: p.id }),
    })),
  ];
}

function dueItems(task) {
  const today = todayKey();
  const set = (dueDate) => () => updateTask(task.id, { dueDate });
  return [
    { label: 'Today', icon: Sun, checked: task.dueDate === today, onSelect: set(today) },
    { label: 'Tomorrow', icon: Sunrise, checked: task.dueDate === addDays(today, 1), onSelect: set(addDays(today, 1)) },
    { label: 'Next week', icon: CalendarArrowUp, checked: task.dueDate === nextWeekday(today, 1), onSelect: set(nextWeekday(today, 1)) },
    { label: 'Pick a date…', icon: CalendarDays, onSelect: (origin) => openDatePicker(task, origin) },
    ...(task.dueDate ? [{ divider: true }, { label: 'Remove due date', icon: CalendarX, onSelect: set(null) }] : []),
  ];
}

export function taskMenuItems(task) {
  const done = task.status === 'done';
  return [
    { label: 'Edit', icon: PanelRightOpen, shortcut: 'Enter', onSelect: () => selectTask(task.id, true) },
    { label: done ? 'Mark as incomplete' : 'Mark as complete', icon: done ? RotateCcw : Check, shortcut: 'Space', onSelect: () => toggleComplete(task.id) },
    { label: task.addedToToday ? 'Remove from Today' : 'Add to Today', icon: task.addedToToday ? SunDim : Sun, shortcut: 'T', onSelect: () => toggleToday(task.id) },
    { divider: true },
    { label: 'Status', icon: CircleDashed, submenu: statusItems(task) },
    { label: 'Priority', icon: <PriorityIcon level="neutral" />, submenu: priorityItems(task) },
    { label: 'Due date', icon: CalendarDays, submenu: dueItems(task) },
    { label: 'Move to', icon: ArrowRight, submenu: projectItems(task) },
    { divider: true },
    { label: 'Duplicate', icon: Copy, shortcut: 'mod+D', onSelect: () => { const id = duplicateTask(task.id); if (id) selectTask(id, false); } },
    { label: 'Delete', icon: Trash2, shortcut: 'Del', danger: true, onSelect: () => deleteTask(task.id) },
  ];
}

export function openTaskMenu(task, anchor) {
  selectTask(task.id, false);
  openMenu({ kind: 'menu', items: taskMenuItems(task), ...anchor });
}
