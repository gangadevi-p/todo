import { useUI } from '../store';
import { NewProjectForm } from './NewProject';
import { NewTaskForm } from './NewTask';

/** Hosts whichever create popup is open. A fresh key resets the form each time. */
export function PopupHost() {
  const popup = useUI((u) => u.popup);
  if (!popup) return null;
  if (popup.kind === 'project') return <NewProjectForm key={popup.nonce} />;
  return <NewTaskForm key={popup.nonce} defaults={popup.defaults || {}} />;
}
