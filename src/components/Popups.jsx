import { useUI } from '../store';
import { EditProjectForm } from './EditProject';
import { NewProjectForm } from './NewProject';
import { NewTaskForm } from './NewTask';
import { QAForm } from './QAForm';

/** Hosts whichever create or edit popup is open. A fresh key resets the form each time. */
export function PopupHost() {
  const popup = useUI((u) => u.popup);
  if (!popup) return null;
  if (popup.kind === 'project') return <NewProjectForm key={popup.nonce} />;
  if (popup.kind === 'editProject') return <EditProjectForm key={popup.nonce} projectId={popup.projectId} />;
  if (popup.kind === 'qa') return <QAForm key={popup.nonce} id={popup.id} />;
  return <NewTaskForm key={popup.nonce} defaults={popup.defaults || {}} />;
}
