import { useMemo, useRef, useState } from 'react';
import { ChevronDown, ClipboardPaste, Inbox } from 'lucide-react';
import { closePopup, createFromPlan, navigate, openMenu, setMajorFilter, ui, useData } from '../store';
import { parsePlan, planStats } from '../lib/planParse';
import { modKey, plural } from '../lib/util';
import { ProjectDot } from './bits';
import { rectOf } from './MenuLayer';
import { F, Field, Popup } from './Popup';

const PLAN = { icon: ClipboardPaste, tint: '#64748b', label: 'Plan' };
const PREVIEW = { ...F.subtasks, label: 'Preview' };

const EXAMPLE = `Phase 1: Name of the major task
Goal: what this phase is for
* First sub-task — its notes
* Second sub-task — its notes
Output: what you end up with`;

function PlanItems({ items }) {
  return (
    <ul className="plan-items">
      {items.map((it, i) => (
        <li key={i} className="plan-item">
          <span className="plan-item-title">{it.title || 'Untitled'}</span>
          {it.notes && <span className="plan-item-notes">{it.notes}</span>}
          {it.subtasks.length > 0 && <PlanItems items={it.subtasks} />}
        </li>
      ))}
    </ul>
  );
}

/** Paste a plan, see what it becomes, create it: one major task per phase, its bullets as sub-tasks. */
export function PlanForm({ initialText = '' }) {
  const projects = useData((s) => s.projects);
  const [text, setText] = useState(initialText);
  // On a project's page the plan goes into that project.
  const [projectId, setProjectId] = useState(() => {
    const view = ui.get().view;
    return view.startsWith('project:') ? view.slice('project:'.length) : null;
  });
  const textRef = useRef(null);

  const plans = useMemo(() => parsePlan(text), [text]);
  const stats = planStats(plans);
  const project = projects.find((p) => p.id === projectId) || null;

  const submit = () => {
    if (!plans.length) {
      textRef.current?.focus();
      return;
    }
    const ids = createFromPlan(plans, projectId);
    closePopup();
    // Show what was just made: its project's board, or All Tasks, on the first new major task.
    navigate(project ? `project:${project.id}` : 'all');
    setMajorFilter(ids[0]);
  };

  const pickProject = (e) =>
    openMenu({
      kind: 'menu',
      rect: rectOf(e.currentTarget),
      items: [
        { label: 'No project', icon: Inbox, checked: !projectId, onSelect: () => setProjectId(null) },
        ...(projects.length ? [{ divider: true }] : []),
        ...[...projects].sort((a, b) => a.order - b.order).map((p) => ({
          label: p.name,
          icon: <ProjectDot color={p.color} />,
          checked: projectId === p.id,
          onSelect: () => setProjectId(p.id),
        })),
      ],
    });

  return (
    <Popup
      title="Create tasks from text"
      subtitle={`A “Phase” line becomes a major task, its bullets become sub-tasks. ${modKey()}+Enter creates.`}
      dirty={Boolean(text.trim())}
      canSubmit={plans.length > 0}
      submitLabel={plans.length ? `Create ${plural(stats.majors, 'major task')}` : 'Create'}
      onSubmit={submit}
      focusRef={textRef}
      hideKeys
    >
      <Field f={PLAN} hint="Paste here" top>
        <textarea
          ref={textRef}
          className="pp-notes plan-input"
          autoFocus
          value={text}
          spellCheck={false}
          placeholder={EXAMPLE}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>

      <Field f={F.project}>
        <button type="button" className="pill pill-select" onClick={pickProject}>
          {project ? <ProjectDot color={project.color} /> : <Inbox size={13} strokeWidth={1.9} />}
          {project ? project.name : 'No project'}
          <ChevronDown size={13} className="pill-chev" />
        </button>
      </Field>

      <Field f={PREVIEW} hint={plans.length ? `${plural(stats.majors, 'major task')}, ${plural(stats.subtasks, 'sub-task')}` : undefined} top>
        {plans.length ? (
          <div className="plan-preview">
            {plans.map((p, i) => (
              <section key={i} className="plan-card">
                <div className="plan-major">{p.title}</div>
                {p.notes && <p className="plan-notes">{p.notes}</p>}
                {p.items.length > 0 && <PlanItems items={p.items} />}
              </section>
            ))}
          </div>
        ) : (
          <p className="plan-hint">
            {text.trim()
              ? 'Nothing to create yet. Start a line with “Phase 1: Title”, put Goal: and Output: lines under it for notes, and bullets for sub-tasks.'
              : 'What will be created shows here as you paste.'}
          </p>
        )}
      </Field>
    </Popup>
  );
}
