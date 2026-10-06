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
| `Ctrl/⌘ 1–5` | Inbox · Today · Upcoming · All Tasks · Completed |
| `Ctrl/⌘ \` | Toggle sidebar |
| `N` | New task for the current view (a sub-task of the selected major task in a project) |
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

## Major tasks and sub-tasks

In a project with two or more major tasks, chips under the overview pick which major task is shown. The **+** at the end of the chips adds a new major task.

On the Board:

- The **+** beside a major task's title adds a new box under it.
- **Enter** or the **+** on a box's first row adds a sub-task inside that box.
- **Enter** on any other item adds the next one at the same level; **Tab** nests it under the item above.

Nothing opens on hover. Right-click a task (or use its ⋯ grip) and choose **Edit** to open its editor.

## Project layout

```
src/store.js      data + UI state, all task/project actions, saving
src/lib/views.js  turns tasks into the groups each view renders
src/components/   sidebar, list, board, editor, menus, overlays
```
