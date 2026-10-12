# Gani's Work

A calm, keyboard-first to-do list for designers. It's built for one thing: quickly capturing, organising and finishing design tasks.

It's a website built with React and Vite, published with GitHub Pages:

- **Your space:** https://gangadevi-p.github.io/todo/#owner (sign in with your user name and password)
- **Demo space:** https://gangadevi-p.github.io/todo/ (starts empty, no sign-in)

## Publishing

Every push to `main` on `gangadevi-p/todo` builds the site and publishes it (`.github/workflows/deploy-pages.yml`). It's live about a minute later. An open tab keeps the old version until you reload it with `Ctrl+Shift+R`.

## Working on it locally

```bash
npm install
npm run dev        # http://localhost:5183, opens straight into your space
npm run build      # the production site, into dist/
```

## Where your data lives

Your tasks are saved in the browser you use (localStorage), so each browser has its own copy. To move them to another browser, use **Export data** in the sidebar, then **Import data** in the other browser.

The sign-in is a screen lock for that browser, not an online account: only a salted hash of the password is stored, next to the tasks.

## Keyboard

| Shortcut | Action |
| --- | --- |
| `Ctrl/⌘ N` | New task popup (works anywhere) |
| `Ctrl/⌘ K` | Search |
| `Ctrl/⌘ 1–5` | Today · Upcoming · All Tasks · Completed · Trash |
| `Ctrl/⌘ \` | Toggle sidebar |
| `N` | New task for the current view (in a project's Board: a major task, then a box under the one showing) |
| `↑ ↓` or `J K` | Move the selection |
| `Enter` | Open the task's editor |
| `Space` | Complete or reopen |
| `T` | Add to or remove from Today |
| `1 2 3 0` | Priority: low, medium, high, none |
| `Ctrl/⌘ D` | Duplicate |
| `Del` or `Ctrl/⌘ Backspace` | Delete (you can undo) |
| `Ctrl/⌘ Z` | Undo delete |
| `Esc` | Close the editor or clear the selection |
| `?` | Show all shortcuts |

## Project, major task, box, sub-task

```
Project            sidebar → New project (opens on its Board)
 └─ Major task     a chip under the overview; the + after the chips adds one
     └─ Box        the + beside the major task's title adds one
         └─ Sub-task   the + on a box, or Enter, adds one
             └─ Nested     Tab on a sub-task nests the next one under it
```

On every Board page (Today, Upcoming, All Tasks, Completed and each project) the chips are the major tasks (gray, the one showing is purple). Its boxes sit side by side below (teal), each holding its sub-tasks (coral) in one column; nested ones are indented.

- The page **+** and **N** add a major task when the project has none, otherwise a box under the major task showing.
- **Enter** on a sub-task adds the next one at the same level; **Tab** nests it under the item above.
- Nothing opens on hover. Right-click a task (or use its ⋯ grip) and choose **Edit** to open its editor.

## Project layout

```
src/store.js      data + UI state, all task/project actions, saving
src/lib/views.js  turns tasks into the groups each view renders
src/components/   sidebar, list, board, editor, menus, overlays
```
