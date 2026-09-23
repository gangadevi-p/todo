import { useRef, useState } from 'react';
import { Check, TriangleAlert } from 'lucide-react';
import { closePopup, createProject, navigate, nextProjectColor, nextProjectOrder, toast, useData } from '../store';
import { PROJECT_COLORS, uid } from '../lib/util';
import { ProjectDot } from './bits';
import { F, Field, Popup, ReadOnly } from './Popup';

const stamp = (ms) => new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Every field of a project, in one popup. Only the name is required. */
export function NewProjectForm() {
  const projects = useData((s) => s.projects);
  const [id] = useState(uid);
  const [createdAt] = useState(Date.now);
  const [name, setName] = useState('');
  const [color, setColor] = useState(() => nextProjectColor(projects));
  const [order, setOrder] = useState(() => String(nextProjectOrder()));
  const nameRef = useRef(null);

  const clean = name.trim();
  const taken = clean && projects.some((p) => p.name.trim().toLowerCase() === clean.toLowerCase());
  const canSubmit = Boolean(clean) && !taken;

  const submit = () => {
    if (!clean) {
      nameRef.current?.focus();
      return;
    }
    if (taken) return;
    const position = Number(order);
    createProject({ id, name: clean, color, order: order.trim() !== '' && Number.isFinite(position) ? position : undefined });
    closePopup();
    navigate(`project:${id}`);
    toast(`Created project “${clean}”`);
  };

  const side = (
    <>
      <Field f={F.id}><ReadOnly mono>{id}</ReadOnly></Field>
      <Field f={F.created}><ReadOnly>{stamp(createdAt)}</ReadOnly></Field>
      <Field f={F.order} hint="Position">
        <input className="pp-input pp-number" type="number" step="1" value={order} onChange={(e) => setOrder(e.target.value)} />
      </Field>
    </>
  );

  return (
    <Popup
      title="New project"
      subtitle="Only the name is required."
      dirty={Boolean(clean)}
      canSubmit={canSubmit}
      submitLabel="Create project"
      onSubmit={submit}
      focusRef={nameRef}
      side={side}
    >
      <Field f={F.name}>
        <input
          ref={nameRef}
          className="pp-input pp-title-input"
          autoFocus
          value={name}
          spellCheck
          placeholder="e.g. Website redesign"
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

      <Field f={F.project} hint="Preview">
        <div className="pp-preview">
          <ProjectDot color={color} size={9} />
          <span>{clean || 'Project name'}</span>
        </div>
      </Field>
    </Popup>
  );
}
