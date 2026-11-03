import { CalendarDays, Layers, Menu, Plus, Sun } from 'lucide-react';
import { navigate, openMobileNav, openNewTask } from '../store';

const TABS = [
  { id: 'today', label: 'Today', icon: Sun },
  { id: 'upcoming', label: 'Upcoming', icon: CalendarDays },
  { id: 'new' },
  { id: 'all', label: 'All', icon: Layers },
  { id: 'menu', label: 'Menu', icon: Menu },
];

/** Phone-only bar pinned to the bottom, so the main places and "new task" sit under the thumb. */
export function MobileTabBar({ view }) {
  const press = (id) => {
    if (id === 'new') openNewTask();
    else if (id === 'menu') openMobileNav();
    else navigate(id);
  };
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => (t.id === 'new' ? (
        <button key="new" type="button" className="tab-new" aria-label="New task" onClick={() => press('new')}>
          <Plus size={26} strokeWidth={2.3} />
        </button>
      ) : (
        <button
          key={t.id}
          type="button"
          className={`tab${view === t.id ? ' on' : ''}`}
          aria-current={view === t.id ? 'page' : undefined}
          onClick={() => press(t.id)}
        >
          <t.icon size={22} strokeWidth={view === t.id ? 2.2 : 1.8} />
          <span>{t.label}</span>
        </button>
      )))}
    </nav>
  );
}
