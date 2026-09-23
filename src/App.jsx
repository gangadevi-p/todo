import { useEffect, useMemo, useRef } from 'react';
import {
  closeMobileNav, closePanel, data, deleteTask, duplicateTask, hidePreview, navigate, openNewTask, openSearch, pinPreview, selectTask,
  setHelp, setPref, setSelecting, toggleComplete, toggleToday, ui, undoLast, updateTask, useData, useUI,
} from './store';
import { buildView, NAV_VIEWS } from './lib/views';
import { isTypingTarget } from './lib/util';
import { TodayContext, useTodayClock } from './lib/useToday';
import { useIsMobile } from './lib/useViewport';
import { Sidebar } from './components/Sidebar';
import { MainView } from './components/MainView';
import { DetailPanel } from './components/DetailPanel';
import { MenuLayer } from './components/MenuLayer';
import { ConfirmDialog, SearchPalette, ShortcutsHelp, Toasts } from './components/Overlays';
import { TaskPreview } from './components/TaskPreview';
import { PopupHost } from './components/Popups';

function scrollSelectedIntoView(id) {
  requestAnimationFrame(() => {
    document.querySelector(`[data-task-row][data-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
  });
}

/** Global keyboard handling: capture shortcuts work everywhere; the rest only when not typing. */
function handleKey(e, model) {
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const u = ui.get();

  // A create popup owns the keyboard while it's open.
  if (u.popup) {
    if (mod && key === 'n') e.preventDefault();
    return;
  }

  if (mod && !e.shiftKey && !e.altKey) {
    if (key === 'n') { e.preventDefault(); openNewTask(); return; }
    if (key === 'k' || key === 'f') { e.preventDefault(); openSearch(); return; }
    if (key === '\\') { e.preventDefault(); setPref('sidebarCollapsed', !data.get().prefs.sidebarCollapsed); return; }
    const n = Number(key);
    if (n >= 1 && n <= 5) { e.preventDefault(); navigate(NAV_VIEWS[n - 1]); return; }
  }

  if (u.menu || u.search || u.help || u.confirm) return;
  if (e.defaultPrevented) return;

  const typing = isTypingTarget(e.target);
  if (key === 'Escape') {
    if (typing) { e.target.blur(); return; }
    if (u.selecting) { setSelecting(false); return; }
    if (u.preview) hidePreview();
    else if (u.panelOpen) closePanel();
    else if (u.selectedId) selectTask(null, false);
    return;
  }
  if (u.selecting) return; // the selection toolbar owns done/delete while it's active
  if (typing) return;
  // Let focused buttons keep their native Enter/Space behaviour.
  if ((key === 'Enter' || key === ' ') && e.target.closest?.('button, a, [role="button"]')) return;

  const list = model.flat;
  const selected = u.selectedId ? data.get().tasks.find((t) => t.id === u.selectedId) : null;
  const idx = selected ? list.findIndex((t) => t.id === selected.id) : -1;

  const move = (delta) => {
    if (!list.length) return;
    const next = idx < 0 ? (delta > 0 ? 0 : list.length - 1) : Math.max(0, Math.min(list.length - 1, idx + delta));
    if (u.preview?.pinned) pinPreview(list[next].id);
    else selectTask(list[next].id, false);
    scrollSelectedIntoView(list[next].id);
  };

  const removeSelected = () => {
    const neighbour = list[idx + 1] || list[idx - 1];
    deleteTask(selected.id);
    if (neighbour) selectTask(neighbour.id, u.panelOpen);
  };

  if (mod) {
    if (key === 'z' && !e.shiftKey) { if (undoLast()) e.preventDefault(); return; }
    if (key === 'd' && selected) { e.preventDefault(); const id = duplicateTask(selected.id); if (id) selectTask(id, false); return; }
    // Cmd/Ctrl+Backspace deletes (macOS keyboards have no Delete key).
    if (key === 'Backspace' && selected) { e.preventDefault(); removeSelected(); }
    return;
  }
  if (e.altKey) return;

  switch (key) {
    case 'ArrowDown':
    case 'j':
      e.preventDefault();
      move(1);
      break;
    case 'ArrowUp':
    case 'k':
      e.preventDefault();
      move(-1);
      break;
    case 'Enter':
      if (selected) { e.preventDefault(); selectTask(selected.id, true); }
      break;
    case ' ':
      if (selected) { e.preventDefault(); toggleComplete(selected.id); }
      break;
    case 't':
      if (selected) { e.preventDefault(); toggleToday(selected.id); }
      break;
    case '0': case '1': case '2': case '3':
      if (selected) updateTask(selected.id, { priority: [null, 'low', 'medium', 'high'][Number(key)] });
      break;
    case 'Delete':
      if (selected) {
        e.preventDefault();
        removeSelected();
      }
      break;
    case 'n':
      e.preventDefault();
      openNewTask(model.newTaskDefaults);
      break;
    case '?':
      e.preventDefault();
      setHelp(true);
      break;
    default:
  }
}

export default function App() {
  const today = useTodayClock();
  const tasks = useData((s) => s.tasks);
  const trash = useData((s) => s.trash || []);
  const projects = useData((s) => s.projects);
  const prefs = useData((s) => s.prefs);
  const view = useUI((u) => u.view);
  const lingering = useUI((u) => u.lingering);
  const selectedId = useUI((u) => u.selectedId);
  const panelOpen = useUI((u) => u.panelOpen);
  const platform = useUI((u) => u.platform);

  const model = useMemo(
    () => buildView(view, { tasks, projects, trash, today, lingering, prefs }),
    [view, tasks, trash, projects, today, lingering, prefs],
  );

  // "system" leaves no attribute, so the OS-preference media query in CSS keeps driving it.
  useEffect(() => {
    const theme = prefs.theme;
    if (theme === 'light' || theme === 'dark') document.documentElement.setAttribute('data-theme', theme);
    else document.documentElement.removeAttribute('data-theme');
  }, [prefs.theme]);

  // The view may point at a project that was just deleted.
  useEffect(() => {
    if (model.id !== view) navigate(model.id);
  }, [model.id, view]);

  // Drop the selection if its task disappears (e.g. deleted elsewhere).
  const selectedExists = useData((s) => !selectedId || s.tasks.some((t) => t.id === selectedId));
  useEffect(() => {
    if (!selectedExists) selectTask(null, false);
  }, [selectedExists]);

  const modelRef = useRef(model);
  modelRef.current = model;
  useEffect(() => {
    const onKey = (e) => handleKey(e, modelRef.current);
    const clearOutsideTask = (e) => {
      // Use capture so nested sections cannot stop this from clearing the
      // active row when the person clicks their empty space.
      const staysActive = e.target.closest?.('[data-task-row], .panel, .floating, .modal, [role="dialog"], .task-preview');
      if (!staysActive && ui.get().selectedId) {
        hidePreview();
        selectTask(null, false);
      }
    };
    // Mouse clicks shouldn't leave focus parked on buttons, or Enter/Space
    // would re-trigger them instead of acting on the selected task.
    const onClick = (e) => {
      if (e.detail > 0) e.target.closest?.('button')?.blur();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', clearOutsideTask, true);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', clearOutsideTask, true);
      window.removeEventListener('click', onClick);
    };
  }, []);

  const collapsed = Boolean(prefs.sidebarCollapsed);
  const showPanel = panelOpen && selectedId && selectedExists;
  const isMobile = useIsMobile();
  const mobileNavOpen = useUI((u) => u.mobileNavOpen);
  const sidebarVisible = isMobile ? mobileNavOpen : !collapsed;

  return (
    <TodayContext.Provider value={today}>
      <div className={`app platform-${platform}${collapsed ? ' sidebar-collapsed' : ''}${showPanel ? ' panel-open' : ''}${isMobile ? ' is-mobile' : ''}`}>
        {sidebarVisible && <Sidebar view={model.id} isMobile={isMobile} />}
        {isMobile && mobileNavOpen && <div className="sidebar-scrim" onClick={closeMobileNav} />}
        <div className="workspace">
          <MainView model={model} sidebarCollapsed={isMobile ? !mobileNavOpen : collapsed} isMobile={isMobile} />
          {showPanel && <DetailPanel taskId={selectedId} />}
        </div>
        <PopupHost />
        <SearchPalette />
        <ShortcutsHelp />
        <ConfirmDialog />
        <TaskPreview />
        <MenuLayer />
        <Toasts />
      </div>
    </TodayContext.Provider>
  );
}
