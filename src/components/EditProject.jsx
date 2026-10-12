import { useRef, useState } from 'react';
import { Check, Trash2, TriangleAlert } from 'lucide-react';
import { Type } from 'lucide-react';
import { closePopup, confirmDeleteProject, updateProject, useData } from '../store';
import { PROJECT_COLORS } from '../lib/util';
import { ProjectDot } from './bits';
import { F, Field, Popup } from './Popup';
import { TextStyleControls } from './TextStyle';

const TEXT_STYLE = { icon: Type, tint: '#8a5cf0', label: 'Name style' };

/** Everything about a project in one popup, opened by clicking its title. Same shell as the create popups. */
export function EditProjectForm({ projectId }) {
  const project = useData((s) => s.projects.find((p) => p.id === projectId));
  const projects = useData((s) => s.projects);
  const nameRef = useRef(null);
  const [name, setName] = useState(project?.name || '');
  const [color, setColor] = useState(project?.color);
  const [textStyle, setTextStyle] = useState(project?.textStyle);
  if (!project) return null;

  const clean = name.trim();
  const taken = clean && projects.some((p) => p.id !== project.id && p.name.trim().toLowerCase() === clean.toLowerCase());
  const dirty = clean !== project.name || color !== project.color || JSON.stringify(textStyle) !== JSON.stringify(project.textStyle);
  const canSubmit = Boolean(clean) && !taken;

  const submit = () => {
    if (!clean) {
      nameRef.current?.focus();
      return;
    }
    if (taken) return;
    updateProject(project.id, { name: clean, color, textStyle });
    closePopup();
  };

  return (
    <Popup
      title="Edit project"
      subtitle="Change its name, color and name style."
      dirty={dirty}
      canSubmit={canSubmit && dirty}
      submitLabel="Save"
      actionWord="save"
      onSubmit={submit}
      focusRef={nameRef}
      hideKeys
      headActions={(
        <button type="button" className="icon-btn" aria-label="Delete project" onClick={() => confirmDeleteProject(project)}>
          <Trash2 size={16} />
        </button>
      )}
    >
      <Field f={F.name}>
        <input
          ref={nameRef}
          className="pp-input pp-title-input"
          autoFocus
          value={name}
          spellCheck
          onFocus={(e) => e.target.select()}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {taken && (
          <div className="pp-warn pp-error">
            <TriangleAlert size={13} strokeWidth={2} />
            A project called “{clean}” already exists. Pick a different name.
          </div>
        )}
      </Field>

      <Field f={F.color}>
        <div className="swatches" role="radiogroup" aria-label="Color">
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              className={`swatch${color === c ? ' on' : ''}`}
              style={{ '--c': c }}
              onClick={() => setColor(c)}
            >
              {color === c && <Check size={13} strokeWidth={3} />}
            </button>
          ))}
        </div>
      </Field>

      <Field f={TEXT_STYLE}>
        <TextStyleControls value={textStyle} onChange={setTextStyle} />
      </Field>

      <Field f={F.project} hint="Preview">
        <div className="pp-preview">
          <ProjectDot color={color} size={9} />
          <span>{clean || 'Project name'}</span>
        </div>
      </Field>
    </Popup>
  );
}
