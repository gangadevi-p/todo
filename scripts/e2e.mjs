// End-to-end check of Nudge using real mouse/keyboard events over the Chrome
// DevTools protocol. It runs against a throwaway data folder, so your own
// tasks are never touched.
//   node scripts/e2e.mjs "C:\path\to\Nudge.exe"        (a packaged build)
//   node scripts/e2e.mjs node_modules\electron\dist\electron.exe .   (from source, after npm run build)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [exe, ...launchArgs] = process.argv.slice(2);
if (!exe) throw new Error('usage: node scripts/e2e.mjs <electron or Nudge.exe> [app path]');
const dataDir = path.join(os.tmpdir(), 'nudge-e2e');
const port = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
};

async function launch() {
  const child = spawn(exe, [...launchArgs, `--user-data-dir=${dataDir}`, `--remote-debugging-port=${port}`], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    try {
      const pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = pages.find((p) => p.type === 'page');
      if (page) return { child, ws: page.webSocketDebuggerUrl };
    } catch {}
  }
  throw new Error('app did not start');
}

function connect(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id;
      pending.set(i, (msg) => (msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)));
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  return new Promise((resolve) => {
    ws.onopen = () => {
      const evalJs = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed');
        return r.result.value;
      };
      const center = (sel, text) =>
        evalJs(`(() => {
          const els = [...document.querySelectorAll(${JSON.stringify(sel)})];
          const el = ${text ? `els.find(e => e.innerText.includes(${JSON.stringify(text)}))` : 'els[0]'};
          if (!el) return null;
          el.scrollIntoView({ block: 'center' });
          const r = el.getBoundingClientRect();
          return { x: r.left + Math.min(r.width / 2, 200), y: r.top + r.height / 2 };
        })()`);
      const api = {
        eval: evalJs,
        async move(sel, text) {
          const c = await center(sel, text);
          if (!c) throw new Error(`not found: ${sel} ${text || ''}`);
          await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y });
        },
        async click(sel, text) {
          const c = await center(sel, text);
          if (!c) throw new Error(`not found: ${sel} ${text || ''}`);
          await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y });
          await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button: 'left', clickCount: 1 });
          await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x, y: c.y, button: 'left', clickCount: 1 });
          await sleep(150);
        },
        async type(text) {
          await send('Input.insertText', { text });
          await sleep(80);
        },
        async selectAll() {
          await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
          await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
        },
        async key(key, modifiers = 0) {
          const codes = { Enter: 13, Escape: 27 };
          const isLetter = key.length === 1;
          const base = {
            key,
            code: isLetter ? `Key${key.toUpperCase()}` : key,
            windowsVirtualKeyCode: isLetter ? key.toUpperCase().charCodeAt(0) : codes[key],
            modifiers,
          };
          await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base, ...(key === 'Enter' ? { text: '\r' } : {}) });
          await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
          await sleep(200);
        },
        close: () => ws.close(),
      };
      resolve(api);
    };
  });
}

const readData = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'nudge-data.json'), 'utf8'));
const settle = () => sleep(900); // saves are debounced by 250ms
// Waits for the saved data to satisfy a condition (the machine can be slow).
const until = async (pred, ms = 8000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if (pred()) return true; } catch {}
    await sleep(200);
  }
  return false;
};

fs.rmSync(dataDir, { recursive: true, force: true });
let { child, ws } = await launch();
let app = await connect(ws);
try {
  await sleep(1500);
  check('app opens with starter tasks', (await app.eval('document.querySelectorAll("[data-task-row]").length')) > 0);
  // Select all is intentionally safe to check first: Cancel leaves the starter
  // workspace untouched for the rest of this end-to-end flow.
  const currentRows = await app.eval('document.querySelectorAll("[data-task-row]").length');
  await app.click('.btn', 'Select all');
  check('Select all selects every task in the current section', await app.eval(`(() => {
    const count = document.querySelector('.select-count')?.innerText;
    const picked = document.querySelectorAll('[data-task-row].picked').length;
    const enabled = [...document.querySelectorAll('.topbar-actions .btn')]
      .filter((b) => /Mark done|Delete/.test(b.innerText))
      .every((b) => !b.disabled);
    return count === ${JSON.stringify(`${currentRows} selected`)} && picked === ${currentRows} && enabled;
  })()`));
  await app.click('.btn', 'Cancel');
  const projectId = (name) => readData().projects.find((p) => p.name === name).id;
  const countIn = (pid) => readData().tasks.filter((x) => x.projectId === pid).length;
  const cafe = projectId('Maple Café Website');

  const trashTarget = await app.eval(`(() => {
    const row = document.querySelector('[data-task-row]');
    return { id: row.dataset.id, title: row.querySelector('.row-title')?.innerText };
  })()`);
  await app.click('.row-delete');
  check('Delete moves a task into Trash', await until(() => !readData().tasks.some((t) => t.id === trashTarget.id) && readData().trash.some((t) => t.id === trashTarget.id)));
  await app.click('.nav-item', 'Trash');
  check('Trash shows the deleted task', await app.eval(`document.querySelector('.trash-row-copy strong')?.innerText === ${JSON.stringify(trashTarget.title)}`));
  await app.click('.trash-row .btn', 'Restore');
  check('Restore returns the task from Trash', await until(() => readData().tasks.some((t) => t.id === trashTarget.id) && !readData().trash.some((t) => t.id === trashTarget.id)));

  await app.click('.nav-item', 'All Tasks');
  check('All Tasks lists Inbox and every project, not a separate status group', await app.eval(`(() => {
    const heads = [...document.querySelectorAll('.group-head')].map((h) => h.querySelector('.group-title')?.innerText);
    return ${JSON.stringify(['Inbox', ...readData().projects.map((p) => p.name)])}.every((name) => heads.includes(name)) && !heads.includes('Done');
  })()`));

  await app.click('.nav-item', 'Maple Café Website');
  await app.click('.segmented button', 'Board');
  check('Board keeps status columns when a project has only one major task', await app.eval(`(() => {
    const heads = [...document.querySelectorAll('.column-head .group-title')].map((el) => el.innerText);
    return heads.includes('Todo') && heads.includes('Done') && !document.querySelector('.column-checklist');
  })()`));
  await app.click('.segmented button', 'List');

  // 1. Delete all + "Are you sure?" on every page --------------------------------------
  const pages = ['Inbox', 'Today', 'Upcoming', 'All Tasks', 'Completed', 'Maple Café Website', 'Trailhead App', 'Studio Rebrand', 'Home'];
  const total = readData().tasks.length;
  for (const name of pages) {
    await app.click('.nav-item', name);
    const hasBtn = await app.eval('!!document.querySelector(".btn-danger-ghost")');
    const enabled = await app.eval('!!document.querySelector(".btn-danger-ghost") && !document.querySelector(".btn-danger-ghost").disabled');
    let asks = true;
    if (enabled) {
      await app.click('.btn-danger-ghost');
      const title = await app.eval('document.querySelector(".confirm h2")?.innerText');
      const body = await app.eval('document.querySelector(".confirm p")?.innerText');
      asks = title === 'Are you sure?' && /delete all \d+ task/i.test(body || '');
      await app.click('.confirm .btn:not(.btn-danger)');
    }
    await settle();
    check(`${name}: Delete all button${enabled ? ' asks "Are you sure?"' : ' (empty page, disabled)'} and Cancel keeps tasks`,
      hasBtn && asks && readData().tasks.length === total);
  }

  await app.click('.nav-item', 'Completed');
  const doneBefore = readData().tasks.filter((x) => x.status === 'done').length;
  await app.click('.btn-danger-ghost');
  await app.click('.confirm .btn-danger');
  await settle();
  check('Delete all on Completed clears it', doneBefore > 0 && (await until(() => readData().tasks.filter((x) => x.status === 'done').length === 0)), `${doneBefore} removed`);
  await app.click('.toast-action', 'Undo');
  check('Undo brings them back', await until(() => readData().tasks.filter((x) => x.status === 'done').length === doneBefore));

  // 2. New Task popup: all the details ---------------------------------------------------------
  await app.click('.nav-item', 'Inbox');
  await app.click('.btn-primary', 'New Task');
  check('New Task opens a popup', await app.eval('!!document.querySelector(".popup")'));
  const labels = await app.eval('[...document.querySelectorAll(".pp-label")].map(l => l.innerText.split("\\n")[0])');
  const wanted = ['Title', 'Notes', 'Status', 'Priority', 'Project', 'Due date', 'Subtasks'];
  check('popup shows every task detail', wanted.every((w) => labels.includes(w)), labels.join(', '));
  check('no detail appears twice', new Set(labels).size === labels.length);
  check('no Details column for a new task', await app.eval('!document.querySelector(".pp-side")'));
  check('every field has its own icon', (await app.eval('new Set([...document.querySelectorAll(".pp-icon")].map(i => i.innerHTML)).size')) >= 7);

  // A hidden test window can freeze CSS transitions, so measure without them.
  await app.eval(`document.head.insertAdjacentHTML('beforeend', '<style>.popup{transition:none!important}</style>')`);
  const narrow = await app.eval('document.querySelector(".popup").offsetWidth');
  await app.click('.pp-head button[aria-pressed]');
  await sleep(900);
  const wide = await app.eval('document.querySelector(".popup").offsetWidth');
  const vw = await app.eval('innerWidth');
  check('expand makes the popup broad', wide > narrow + 150, `${narrow}px -> ${wide}px in a ${vw}px window`);
  await app.key('Escape');
  await app.click('.btn-primary', 'New Task');
  await sleep(400);
  check('expanded size is remembered', (await app.eval('document.querySelector(".popup").offsetWidth')) === wide);

  await app.type('E2E popup task');
  await app.click('.popup .pill', 'In Progress');
  await app.click('.popup .pill', 'High');
  await app.click('.popup .pill', 'Tomorrow');
  await app.click('.pp-notes');
  await app.type('note from e2e');
  await app.click('.pp-sub-add input');
  await app.type('first step');
  await app.key('Enter');
  await app.type('second step');
  await app.click('.pp-foot .btn-primary');
  await until(() => readData().tasks.some((x) => x.title === 'E2E popup task'));
  let t = readData().tasks.find((x) => x.title === 'E2E popup task');
  check('task saved with every field', !!t && t.status === 'in_progress' && t.priority === 'high' && !!t.dueDate
    && t.notes === 'note from e2e' && t.subtasks.length === 2 && !!t.createdAt && t.completedAt === null,
    t && `${t.status}, ${t.priority}, due ${t.dueDate}, notes '${t.notes}', ${t.subtasks.length} steps`);
  check('popup closes after create', await app.eval('!document.querySelector(".popup")'));

  // 3. Duplicate task warning -------------------------------------------------------------------
  await app.click('.btn-primary', 'New Task');
  await app.type('e2e POPUP task');
  check('duplicate title is flagged', await app.eval('!!document.querySelector(".pp-warn")'));
  await app.key('Escape');

  // 4. "+" in a group opens the popup with that group's settings ---------------------------------
  await app.click('.nav-item', 'Maple Café Website');
  check('no inline "New task" rows remain', await app.eval('!document.querySelector(".composer, .composer-idle")'));
  // Mark the In Progress header's + so a real click can target it.
  await app.eval(`(() => {
    const head = [...document.querySelectorAll('.group-head')].find((h) => h.innerText.includes('In Progress'));
    head.querySelector('.group-add').setAttribute('data-e2e', 'in-progress-add');
  })()`);
  await app.click('[data-e2e="in-progress-add"]');
  await sleep(300);
  check('+ opens the popup, pre-filled for that group', await app.eval(`(() => {
    const on = [...document.querySelectorAll('.popup .pill.on')].map(p => p.innerText.trim());
    return !!document.querySelector('.popup') && on.includes('In Progress') && document.querySelector('.pill-select').innerText.includes('Maple Café Website');
  })()`));
  await app.type('E2E group task');
  await app.key('Enter');
  await until(() => readData().tasks.some((x) => x.title === 'E2E group task'));
  t = readData().tasks.find((x) => x.title === 'E2E group task');
  check('task created in that group', !!t && t.projectId === cafe && t.status === 'in_progress');

  // 5. Ctrl+N ---------------------------------------------------------------------------------
  await app.key('n', 2);
  check('Ctrl+N opens the same popup', await app.eval('!!document.querySelector(".popup") && document.querySelector(".pp-title h2").innerText === "New task"'));
  await app.key('Escape');

  // 6. New project popup ----------------------------------------------------------------------
  await app.click('.nav-section .icon-btn');
  check('new project opens a popup', await app.eval('document.querySelector(".pp-title h2")?.innerText === "New project"'));
  const projLabels = await app.eval('[...document.querySelectorAll(".pp-label")].map(l => l.innerText.split("\\n")[0])');
  check('project popup shows name, color, id, created, order', ['Name', 'Color', 'ID', 'Created', 'Order'].every((w) => projLabels.includes(w)), projLabels.join(', '));
  // The New Task popup earlier left the shared "wide" pref on, so this popup opens wide too.
  check('wide layout puts Details in a second column', await app.eval('getComputedStyle(document.querySelector(".pp-cols")).gridTemplateColumns.split(" ").length === 2'));
  const projId = await app.eval('document.querySelector(".pp-ro.mono").innerText');
  await app.type('maple');
  check('duplicate project name is blocked', (await app.eval('!!document.querySelector(".pp-error")')) && (await app.eval('document.querySelector(".pp-foot .btn-primary").disabled')));
  await app.selectAll();
  await app.type('E2E Project');
  await app.key('Enter');
  await until(() => readData().projects.some((p) => p.name === 'E2E Project'));
  const np = readData().projects.find((p) => p.name === 'E2E Project');
  check('project created with the shown id', !!np && np.id === projId && !!np.createdAt && Number.isFinite(np.order), np && `order ${np.order}`);
  check('lands on the new project page', await app.eval('document.querySelector(".page-title")?.innerText === "E2E Project"'));

  // 7. New subtask popup ----------------------------------------------------------------------
  await app.click('.nav-item', 'Inbox');
  await app.click('[data-task-row]', 'E2E popup task');
  await app.click('.preview .preview-edit');
  await app.click('.sub-add-btn');
  check('new subtask opens a popup', await app.eval('document.querySelector(".pp-title h2")?.innerText === "New subtask"'));
  const subId = await app.eval('document.querySelector(".pp-ro.mono").innerText');
  await app.type('Tablet version');
  await app.key('Enter');
  await until(() => readData().tasks.find((x) => x.title === 'E2E popup task')?.subtasks.some((s) => s.title === 'Tablet version'));
  t = readData().tasks.find((x) => x.title === 'E2E popup task');
  check('subtask added with the shown id', t.subtasks.some((s) => s.id === subId && s.title === 'Tablet version' && s.done === false), `${t.subtasks.length} steps`);
  await app.key('Escape');

  // 8. Delete all on a project + Undo ------------------------------------------------------------
  await app.click('.nav-item', 'Maple Café Website');
  const before = countIn(cafe);
  await app.click('.btn-danger-ghost');
  await app.click('.confirm .btn-danger');
  check('Delete all clears the project (project stays)', (await until(() => countIn(cafe) === 0)) && readData().projects.some((p) => p.id === cafe));
  await app.click('.toast-action', 'Undo');
  check('Undo restores every task', await until(() => countIn(cafe) === before), `${countIn(cafe)} tasks`);

  // 9. Persistence across restart --------------------------------------------------------------
  const saved = readData().tasks.length;
  app.close();
  child.kill();
  await sleep(1500);
  ({ child, ws } = await launch());
  app = await connect(ws);
  await sleep(1500);
  const shown = await app.eval('window.nudge.load().then(r => r.data.tasks.length)');
  check('tasks survive closing and reopening', shown === saved, `${shown}/${saved}`);
} catch (err) {
  console.log('ERROR', err.message);
  results.push(false);
} finally {
  try { app.close(); } catch {}
  child.kill();
}
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
