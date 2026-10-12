/**
 * Turns pasted plan text into major tasks.
 *
 *   Phase 2: Create a Feature Inventory          major task (its title)
 *   Goal: Understand everything ...              major task notes
 *   * List all existing features — Create a ... sub-task, with the text after the dash as its notes
 *   Output: A feature inventory ...              major task notes
 *
 * It reads a format, it is not a language model: no key, no network, same
 * result every time. Several phases in one paste become several major tasks.
 */

const PHASE_RE = /^(phase|stage|step|part|milestone|sprint|epic|module|week)[\s\-–—#.]*(\d+|[ivxIVX]+)\b\s*(?:[:\-–—.)]\s*)?(.*)$/i;
const LABEL_RE = /^(goals?|objectives?|aims?|purpose|outputs?|deliverables?|outcomes?|results?|context|summary|description|notes?|why|scope)\s*(?::|\s[-–—]\s|—)\s*(.*)$/i;
const BULLET_RE = /^(?:[-*•·▪‣◦–—]|\d{1,3}[.)])\s+(.*)$/;
const SEPARATOR_RE = /\s[—–]\s|\s-{1,2}\s|—/;

const stripMarks = (s) => s.replace(/\*\*|__/g, '').trim();
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
const trimTitle = (s) => s.replace(/[\s.:;,]+$/, '').trim();

/** One line: what kind it is, and the pieces the parser needs. */
function classify(raw) {
  const indent = raw.match(/^ */)[0].length;
  const body = raw.trim();
  if (!body) return { kind: 'blank' };

  const bullet = body.match(BULLET_RE);
  if (bullet) {
    const text = bullet[1].replace(/^\[[ xX]\]\s*/, '').trim();
    if (text) return { kind: 'bullet', indent, text };
  }

  const hashed = /^#{1,6}\s+/.test(body);
  const flat = stripMarks(body.replace(/^#{1,6}\s+/, ''));

  const phase = flat.match(PHASE_RE);
  // A roman numeral must be capitals, so "Part of the plan ..." stays ordinary text.
  if (phase && (/^\d+$/.test(phase[2]) || /^[IVX]+$/.test(phase[2]))) {
    const rest = trimTitle(phase[3]);
    return { kind: 'heading', explicit: true, title: `${cap(phase[1])} ${phase[2]}${rest ? `: ${rest}` : ''}` };
  }
  if (hashed && flat) return { kind: 'heading', explicit: true, title: trimTitle(flat) };

  const label = flat.match(LABEL_RE);
  if (label) return { kind: 'label', label: cap(label[1]), text: label[2].trim() };

  return { kind: 'plain', text: flat };
}

/** "List all features — Create a list ..." -> title and notes. */
function splitItem(text) {
  const bold = text.match(/^\*\*(.+?)\*\*\s*(?:[:\-–—]+\s*)?(.*)$/) || text.match(/^__(.+?)__\s*(?:[:\-–—]+\s*)?(.*)$/);
  if (bold) return { title: trimTitle(stripMarks(bold[1])), notes: stripMarks(bold[2]) };

  const flat = stripMarks(text);
  const dash = SEPARATOR_RE.exec(flat);
  let cut = dash && dash.index > 0 ? { at: dash.index, len: dash[0].length } : null;

  // "Budgets: set a limit" splits on the colon, but only when what comes first reads like a short name.
  const colon = flat.indexOf(': ');
  if (colon > 0 && (!cut || colon < cut.at)) {
    const left = flat.slice(0, colon);
    if (left.length <= 60 && left.split(/\s+/).length <= 8) cut = { at: colon, len: 2 };
  }
  if (!cut) return { title: trimTitle(flat), notes: '' };
  return { title: trimTitle(flat.slice(0, cut.at)), notes: flat.slice(cut.at + cut.len).trim() };
}

function nextKind(lines, from) {
  for (let j = from + 1; j < lines.length; j += 1) {
    const c = classify(lines[j]);
    if (c.kind !== 'blank') return c.kind;
  }
  return null;
}

/** pasted text -> [{ title, notes, items: [{ title, notes, subtasks }], explicit }] */
export function parsePlan(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  const plans = [];
  let plan = null;
  let target = null; // what a following line continues: { note: index, open } or { item }
  let stack = []; // the bullets currently open, for nesting by indent
  let afterBlank = true;

  const start = (title, explicit) => {
    plan = { title, explicit, notes: [], items: [] };
    plans.push(plan);
    target = null;
    stack = [];
  };
  const addNote = (note, open) => {
    plan.notes.push(note);
    target = { note: plan.notes.length - 1, open };
  };

  lines.forEach((raw, i) => {
    const c = classify(raw);
    if (c.kind === 'blank') {
      afterBlank = true;
      target = null;
      return;
    }

    if (c.kind === 'heading') {
      start(c.title, c.explicit);
    } else if (c.kind === 'label') {
      if (!plan) start('', false);
      stack = [];
      addNote(c.text ? `${c.label}: ${c.text}` : `${c.label}:`, !c.text);
    } else if (c.kind === 'bullet') {
      if (!plan) start('', false);
      if (target && target.note !== undefined && target.open && !afterBlank) {
        // Bullets right under a bare "Output:" belong to that note.
        plan.notes[target.note] += `\n• ${stripMarks(c.text)}`;
      } else {
        const { title, notes } = splitItem(c.text);
        const item = { title, notes, subtasks: [] };
        while (stack.length && stack[stack.length - 1].indent >= c.indent - 1) stack.pop();
        (stack.length ? stack[stack.length - 1].item.subtasks : plan.items).push(item);
        stack.push({ indent: c.indent, item });
        target = { item };
      }
    } else if (!plan) {
      start(trimTitle(c.text), false);
    } else if (target && target.item) {
      target.item.notes = target.item.notes ? `${target.item.notes}\n${c.text}` : c.text;
    } else if (target && target.note !== undefined) {
      plan.notes[target.note] += plan.notes[target.note].endsWith(':') ? ` ${c.text}` : `\n${c.text}`;
      target.open = false;
    } else {
      // After a blank line: a short line leading into bullets or a Goal: starts the next plan.
      const next = nextKind(lines, i);
      const headingLike = afterBlank && c.text.length <= 90 && !/[.!?]$/.test(c.text) && (next === 'bullet' || next === 'label');
      if (headingLike) start(trimTitle(c.text), false);
      else addNote(c.text, false);
    }
    afterBlank = false;
  });

  return plans
    .map((p) => ({
      title: p.title || (p.items.length ? 'Untitled plan' : ''),
      explicit: p.explicit,
      notes: p.notes.join('\n'),
      items: p.items,
    }))
    .filter((p) => p.title);
}

/** True when pasted text clearly is a plan: a "Phase 1: ..." style heading with bullets under it. */
export function looksLikePlan(text) {
  return parsePlan(text).some((p) => p.explicit && p.items.length > 0);
}

const countItems = (items) => items.reduce((n, it) => n + 1 + countItems(it.subtasks || []), 0);

export function planStats(plans) {
  return { majors: plans.length, subtasks: plans.reduce((n, p) => n + countItems(p.items), 0) };
}
