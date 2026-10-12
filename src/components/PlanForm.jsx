import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ClipboardPaste, Inbox, Sparkles } from 'lucide-react';
import { closePopup, createFromPlan, navigate, openMenu, setMajorFilter, ui, useData } from '../store';
import { parsePlan, planStats } from '../lib/planParse';
import { getApiKey, looksLikeKey, readWithAI, saveApiKey } from '../lib/aiPlan';
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

const IDLE = { status: 'idle', plans: null, error: '' };

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

/**
 * Paste a plan, see what it becomes, create it: one major task per phase, its
 * bullets as sub-tasks. The format is read instantly and offline; "Read with
 * AI" sends any other wording to Claude using the person's own API key.
 */
export function PlanForm({ initialText = '' }) {
  const projects = useData((s) => s.projects);
  const [text, setText] = useState(initialText);
  // On a project's page the plan goes into that project.
  const [projectId, setProjectId] = useState(() => {
    const view = ui.get().view;
    return view.startsWith('project:') ? view.slice('project:'.length) : null;
  });
  const textRef = useRef(null);
  const keyRef = useRef(null);

  const [ai, setAi] = useState(IDLE);
  const [hasKey, setHasKey] = useState(() => Boolean(getApiKey()));
  const [keyOpen, setKeyOpen] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [keyError, setKeyError] = useState('');
  const abortRef = useRef(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const formatPlans = useMemo(() => parsePlan(text), [text]);
  // Text that follows the format ("Phase 1: ..." with bullets) is already read well without AI.
  const confident = formatPlans.some((p) => p.explicit && p.items.length > 0);
  const plans = ai.status === 'done' ? ai.plans : formatPlans;
  const stats = planStats(plans);
  const loading = ai.status === 'loading';
  const project = projects.find((p) => p.id === projectId) || null;

  const onText = (e) => {
    setText(e.target.value);
    // An AI reading belongs to the text it was made from.
    if (ai.status !== 'idle') {
      abortRef.current?.abort();
      setAi(IDLE);
    }
  };

  const runAI = async () => {
    if (!text.trim() || loading) return;
    if (!getApiKey()) {
      setKeyOpen(true);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setAi({ status: 'loading', plans: null, error: '' });
    try {
      const result = await readWithAI(text, { signal: ctrl.signal });
      if (!ctrl.signal.aborted) setAi({ status: 'done', plans: result, error: '' });
    } catch (err) {
      if (ctrl.signal.aborted || err.code === 'aborted') return;
      if (err.code === 'bad-key' || err.code === 'no-key') setKeyOpen(true);
      setAi({ status: 'error', plans: null, error: err.message });
    }
  };

  const saveKey = () => {
    const key = keyDraft.trim();
    if (!looksLikeKey(key)) {
      setKeyError('That does not look like an Anthropic API key. It starts with sk-ant-.');
      return;
    }
    saveApiKey(key);
    setHasKey(true);
    setKeyOpen(false);
    setKeyDraft('');
    setKeyError('');
    if (text.trim()) queueMicrotask(runAI);
  };

  const removeKey = () => {
    saveApiKey('');
    setHasKey(false);
    setKeyOpen(false);
    setAi((cur) => (cur.status === 'error' ? IDLE : cur));
  };

  const submit = () => {
    if (loading) return;
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

  const wantsAI = Boolean(text.trim()) && !confident && ai.status !== 'done';

  return (
    <Popup
      title="Create tasks from text"
      subtitle={`A “Phase” line becomes a major task, its bullets become sub-tasks. ${modKey()}+Enter creates.`}
      dirty={Boolean(text.trim())}
      canSubmit={plans.length > 0 && !loading}
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
          onChange={onText}
        />

        <div className="plan-ai">
          <button
            type="button"
            className={`btn plan-ai-btn${wantsAI ? ' attention' : ''}`}
            disabled={!text.trim() || loading}
            onClick={runAI}
          >
            <Sparkles size={14} strokeWidth={1.9} />
            {loading ? 'Reading…' : ai.status === 'done' ? 'Read again with AI' : 'Read with AI'}
          </button>
          <span className="plan-ai-note">
            {loading && 'Claude is reading your text…'}
            {!loading && ai.status === 'done' && 'Read by Claude. Check the preview, then create.'}
            {!loading && ai.status !== 'done' && wantsAI && 'This is not in the Phase / bullets format. AI can read any wording.'}
            {!loading && ai.status !== 'done' && !wantsAI && (hasKey ? 'Sends this text to Anthropic.' : 'Any wording. Needs your Anthropic API key.')}
          </span>
        </div>

        {ai.status === 'error' && <div className="plan-error" role="alert">{ai.error}</div>}

        {keyOpen && (
          <div className="plan-key">
            <p>
              Paste your Anthropic API key (from console.anthropic.com). It is saved only in this browser, is never
              part of Export data, and goes only to Anthropic.
            </p>
            <div className="plan-key-row">
              <input
                ref={keyRef}
                className="pp-input"
                type="password"
                autoComplete="off"
                autoFocus
                spellCheck={false}
                placeholder="sk-ant-…"
                value={keyDraft}
                onChange={(e) => { setKeyDraft(e.target.value); setKeyError(''); }}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    saveKey();
                  }
                }}
              />
              <button type="button" className="btn btn-primary" onClick={saveKey}>
                {text.trim() ? 'Save and read' : 'Save key'}
              </button>
              <button type="button" className="btn" onClick={() => { setKeyOpen(false); setKeyDraft(''); setKeyError(''); }}>
                Cancel
              </button>
            </div>
            {keyError && <div className="plan-error" role="alert">{keyError}</div>}
          </div>
        )}

        {hasKey && !keyOpen && (
          <div className="plan-key-saved">
            Key saved in this browser.
            <button type="button" className="plan-link" onClick={() => setKeyOpen(true)}>Change</button>
            <button type="button" className="plan-link" onClick={removeKey}>Remove</button>
          </div>
        )}
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
            {ai.status === 'done' && (
              <div className="plan-source">
                <Sparkles size={12} strokeWidth={2} /> Read by AI
                <button type="button" className="plan-link" onClick={() => setAi(IDLE)}>Use the quick read instead</button>
              </div>
            )}
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
              ? 'Nothing to create yet. Start a line with “Phase 1: Title”, put Goal: and Output: lines under it for notes, and bullets for sub-tasks. Or read it with AI.'
              : 'What will be created shows here as you paste.'}
          </p>
        )}
      </Field>
    </Popup>
  );
}
