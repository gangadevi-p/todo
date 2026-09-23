# Gani's Work

A calm, keyboard-first desktop to-do list for designers. It's built for one thing: quickly capturing, organising and finishing design tasks.

It uses Electron, React and Vite. All data stays on your machine: there's no account, no cloud and no backend.

## Run it

```bash
npm install
npm start          # build the UI and open the desktop app
npm run dev        # desktop app with hot reload while editing (F12 opens DevTools)
npm run dist       # build a Windows installer into release/
```

`npm run dist` creates `release/Gani's Work Setup 1.0.0.exe`, plus a ready-to-run `release/win-unpacked/Gani's Work.exe`. The app isn't code-signed (`scripts/no-sign.cjs` skips signing), so Windows SmartScreen may warn you the first time you run it.

## Where your data lives

Everything is stored in one JSON file (the folder is still named `Nudge`, the app's original internal name, so existing installs keep their data):

- Windows: `%APPDATA%\Nudge\nudge-data.json`
- macOS: `~/Library/Application Support/Nudge/nudge-data.json`

The app copies it to `nudge-data.backup.json` each time it starts. If the file ever gets corrupted, the app sets it aside and falls back to that backup instead of overwriting it.

## Keyboard

| Shortcut | Action |
| --- | --- |
| `Ctrl/⌘ N` | New task popup (works anywhere) |
| `Ctrl/⌘ K` | Search |
| `Ctrl/⌘ 1–5` | Inbox · Today · Upcoming · All Tasks · Completed |
| `Ctrl/⌘ \` | Toggle sidebar |
| `N` | New task popup for the current view |
| `↑ ↓` or `J K` | Move the selection |
| `Enter` | Open the task's details |
| `Space` | Complete or reopen |
| `T` | Add to or remove from Today |
| `1 2 3 0` | Priority: low, medium, high, none |
| `Ctrl/⌘ D` | Duplicate |
| `Del` or `Ctrl/⌘ Backspace` | Delete (you can undo) |
| `Ctrl/⌘ Z` | Undo delete |
| `Esc` | Close the panel or clear the selection |
| `?` | Show all shortcuts |

## How views work

- **Inbox**: tasks without a project. Quick add always puts tasks here.
- **Today**: tasks you added to Today, plus anything due today or overdue.
- **Upcoming**: tasks with a future due date, grouped by day.
- **All Tasks**: every open task, grouped by project.
- **Completed**: finished tasks, grouped by the day you completed them.
- **Projects**: Todo, In Progress and Done, shown as a list or a board.

Right-click any task for every action. You can drag tasks to reorder them, drop them on a board column or group, or drop them on Inbox, Today, Completed or a project in the sidebar.

## Creating things

Every kind of creation opens the same popup: **New task**, **New project** (the + beside Projects) and **New subtask** (Add a checklist item in the detail panel). The + beside a group's count, the New Task button and Ctrl/⌘ N all open it, pre-filled for where you are.

- Only the title (or name) is required. Type it and press Enter.
- The popup shows every detail: title, notes, status, priority, project, due date, add to Today and subtasks, plus the generated ID, created and completed times, project ID and order.
- The expand button at the top right makes it wide, with the details in a second column. Gani's Work remembers your choice.
- It warns about a task with the same name in the same project, and won't let you create two projects with the same name.

## Delete all

Every page (Inbox, Today, Upcoming, All Tasks, Completed and each project) has a **Delete all** button. It asks "Are you sure?" and then deletes every task listed on that page, and you can undo for a few seconds afterwards. The project itself is never deleted by it.

## Project layout

```
electron/        main process (window, JSON persistence) and preload bridge
src/store.js     data + UI state, all task/project actions, persistence
src/lib/views.js turns tasks into the groups each view renders
src/components/  sidebar, list, board, detail panel, menus, overlays
scripts/         dev launcher, icon renderer, Electron smoke test
```
