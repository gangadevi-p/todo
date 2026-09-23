// Launches the built app against a throwaway data folder, captures a
// screenshot, reopens to check persistence, then quits.
// Run with: npm run smoke  (writes smoke-*.png into the OS temp folder)
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = path.join(os.tmpdir(), 'nudge-smoke');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
app.setPath('userData', dir);

require('../electron/main.cjs');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let round = 0;

app.on('browser-window-created', (_e, win) => {
  win.webContents.on('did-finish-load', async () => {
    round += 1;
    await wait(600);
    // The sign-in screen comes first; the smoke test uses the demo space.
    await win.webContents.executeJavaScript(`[...document.querySelectorAll('.auth-card button')].find((b) => /demo/i.test(b.textContent))?.click()`);
    await wait(1200);
    const shot = path.join(os.tmpdir(), `smoke-${round}.png`);
    fs.writeFileSync(shot, (await win.webContents.capturePage()).toPNG());
    const state = await win.webContents.executeJavaScript(`({
      platform: document.querySelector('.app')?.className,
      rows: document.querySelectorAll('[data-task-row]').length,
      title: document.querySelector('.page-title')?.textContent,
    })`);
    console.log(`round ${round}:`, JSON.stringify(state), '->', shot);

    if (round === 1) {
      // Capture a task via the quick-add shortcut, then reload the window.
      win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'N', modifiers: ['control'] });
      await wait(300);
      await win.webContents.insertText('Smoke test task');
      win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
      await wait(800);
      win.reload();
    } else {
      const saved = JSON.parse(fs.readFileSync(path.join(dir, 'nudge-demo-data.json'), 'utf8'));
      const found = saved.tasks.some((t) => t.title === 'Smoke test task' && !t.projectId);
      console.log(`persisted: ${found} (tasks=${saved.tasks.length}, projects=${saved.projects.length})`);
      app.quit();
    }
  });
});

setTimeout(() => {
  console.error('smoke test timed out');
  app.exit(1);
}, 30000);
