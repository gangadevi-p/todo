import { useUI } from '../store';
import { NewProjectForm } from './NewProject';
import { NewSubtaskForm } from './NewSubtask';
import { NewTaskForm } from './NewTask';

/** Hosts whichever create popup is open. A fresh key resets the form each time. */
export function PopupHost() {
  const popup = useUI((u) => u.popup);
  if (!popup) return null;
  if (popup.kind === 'project') return <NewProjectForm key={popup.nonce} />;
  if (popup.kind === 'subtask') return <NewSubtaskForm key={popup.nonce} taskId={popup.taskId} />;
  return <NewTaskForm key={popup.nonce} defaults={popup.defaults || {}} />;
}
