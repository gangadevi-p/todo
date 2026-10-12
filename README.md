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
| `Ctrl/⌘ 1–6` | Today · Upcoming · All Tasks · Completed · Trash · Q&A |
| `Ctrl/⌘ \` | Collapse the sidebar to icons, or open it again |
| `N` | New task for the current view (in a project's Board: a major task, then a box under the one showing; on Q&A: a new question) |
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
     ├─ Sub-task   the + beside the major task's title adds one, right inside it
     └─ Box        the page + (or N) adds one under the major task showing
         └─ Sub-task   the + on a box, or Enter, adds one
             └─ Nested     Tab on a sub-task nests the next one under it
```

On every Board page (Today, Upcoming, All Tasks, Completed and each project) the chips are the major tasks (gray, the one showing is purple). Its boxes sit side by side below (teal), each holding its sub-tasks (coral) in one column; nested ones are indented.

- The **+** beside a major task's title adds a sub-task straight into that major task, with no box.
- The page **+** and **N** add a major task when the project has none, otherwise a box under the major task showing.
- **Enter** on a sub-task adds the next one at the same level; **Tab** nests it under the item above.
- Nothing opens on hover. Right-click a task (or use its ⋯ grip) and choose **Edit** to open its editor.

## Create tasks from text

Paste a plan and the tasks are made for you. Click the sparkle beside a page's **+**, or just paste it onto the page (outside any text field).

```
Phase 2: Create a Feature Inventory
Goal: Understand everything the developer has built.
* List all existing features — Create a list of every feature you discover.
* Identify incomplete features — Record buttons that do nothing.
Output: A feature inventory describing the current capabilities and gaps.
```

| In the text | Becomes |
| --- | --- |
| `Phase 2: Title` (also Stage, Step, Part, Milestone, Sprint, a `#` heading, or a short line before bullets) | a major task, with that title |
| `Goal:` / `Output:` (also Objective, Deliverable, Outcome, Context, Notes) | the major task's notes |
| a bullet, `Name — description` | a sub-task named `Name`, with `description` as its notes |
| a more indented bullet | a sub-task nested under the one above |

Several phases pasted together make several major tasks. A preview shows what will be created before anything is.

### Any other wording: Read with AI

Text in the format above is read instantly, offline, with no key. For any other wording (meeting notes, a brief, a numbered list, a paragraph) click **Read with AI** in the popup. Claude reads the text and shapes it into the same major tasks, notes and sub-tasks, and the preview shows the result before anything is created. **Use the quick read instead** switches back.

- **Your own key.** The first time, paste an Anthropic API key (from console.anthropic.com). It is saved only in this browser, is never part of **Export data**, and is sent only to Anthropic. **Remove** in the popup deletes it. A key with a spend limit is a good idea.
- **What is sent.** Only the text in the popup, when you click **Read with AI**. Nothing is sent otherwise.
- **Cost.** One reading is a single request to `claude-opus-5-5` (`AI_MODEL` in `src/lib/aiPlan.js`), a few cents for a page of text. Text over 30,000 characters is refused, not cut.
- **No server.** The browser calls `api.anthropic.com` directly; the page's Content-Security-Policy allows that one host and nothing else (`vite.config.mjs`).

## Q&A

**Q&A** in the sidebar keeps the questions the design depends on, each with its answer.

- The page **+** (or **N**) opens a popup. Only the question is required; leave the answer empty and add it later.
- Click a question, or its pencil, to edit it. The trash icon deletes it (you can undo with `Ctrl/⌘ Z`).
- A question without an answer has a dashed edge, and the number next to **Q&A** in the sidebar counts them.
- Q&A is saved with the rest of your data, so **Export data** and **Import data** carry it too.

## Project layout

```
src/store.js      data + UI state, all task/project actions, saving
src/lib/views.js  turns tasks into the groups each view renders
src/components/   sidebar, list, board, editor, menus, overlays
```
