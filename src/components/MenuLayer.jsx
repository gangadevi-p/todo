import { createElement, isValidElement, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { closeMenu, useUI } from '../store';
import { shortcutText } from './bits';

/** Absolutely positioned layer that stays inside the viewport. */
export function Floating({ x, y, rect, placement = 'below', className = '', onKeyDown, autoFocus = true, innerRef, children }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left;
    let top;
    if (rect && placement === 'right') {
      left = rect.right - 2;
      top = rect.top - 5;
      if (left + w > vw - 8) left = rect.left - w + 2;
    } else if (rect) {
      left = rect.left;
      top = rect.bottom + 4;
      if (top + h > vh - 8) top = rect.top - h - 4;
    } else {
      left = x;
      top = y;
    }
    left = Math.max(8, Math.min(left, vw - w - 8));
    top = Math.max(8, Math.min(top, vh - h - 8));
    setPos({ left, top });
  }, [x, y, rect, placement]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  return (
    <div
      ref={(el) => {
        ref.current = el;
        if (innerRef) innerRef.current = el;
      }}
      className={`floating ${className}`}
      tabIndex={-1}
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999, visibility: 'hidden' }}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
}

const renderIcon = (icon) => (isValidElement(icon) ? icon : createElement(icon, { size: 15, strokeWidth: 1.8 }));

function MenuList({ items, x, y, rect, placement, depth = 0, origin, onBack, autoFocus = true }) {
  const [active, setActive] = useState(-1);
  const [sub, setSub] = useState(null);
  const itemRefs = useRef([]);
  const selfRef = useRef(null);
  const selectable = items.flatMap((it, i) => (it.divider || it.header || it.disabled ? [] : [i]));

  const openSub = (i, focus) => {
    const r = itemRefs.current[i].getBoundingClientRect();
    setSub({ index: i, rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom }, focus });
  };

  const choose = (it, i) => {
    if (it.submenu) return openSub(i, true);
    closeMenu();
    it.onSelect?.(origin);
  };

  const onKeyDown = (e) => {
    if (e.target !== selfRef.current) return; // let a focused submenu handle its own keys
    const handled = ['ArrowDown', 'ArrowUp', 'Enter', ' ', 'ArrowRight', 'ArrowLeft', 'Escape', 'Tab'];
    if (!handled.includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = selectable.indexOf(active);
    if (e.key === 'ArrowDown') setActive(selectable[(pos + 1) % selectable.length]);
    else if (e.key === 'ArrowUp') setActive(selectable[pos <= 0 ? selectable.length - 1 : pos - 1]);
    else if (e.key === 'Enter' || e.key === ' ') { if (active >= 0) choose(items[active], active); }
    else if (e.key === 'ArrowRight') { if (active >= 0 && items[active].submenu) openSub(active, true); }
    else if (e.key === 'ArrowLeft' && depth > 0) onBack();
    else if (e.key === 'Escape') (depth > 0 ? onBack() : closeMenu());
    else if (e.key === 'Tab') closeMenu();
  };

  return (
    <>
      <Floating x={x} y={y} rect={rect} placement={placement} className="menu" onKeyDown={onKeyDown} innerRef={selfRef} autoFocus={autoFocus}>
        {items.map((it, i) => {
          if (it.divider) return <div key={i} className="menu-sep" />;
          if (it.header) return <div key={i} className="menu-header">{it.label}</div>;
          return (
            <button
              key={i}
              type="button"
              ref={(el) => { itemRefs.current[i] = el; }}
              className={`menu-item${active === i ? ' active' : ''}${it.danger ? ' danger' : ''}${sub?.index === i ? ' open' : ''}`}
              disabled={it.disabled}
              tabIndex={-1}
              onMouseEnter={() => {
                setActive(i);
                if (it.submenu) openSub(i, false);
                else setSub(null);
              }}
              onClick={() => choose(it, i)}
            >
              <span className="menu-icon">{it.icon ? renderIcon(it.icon) : null}</span>
              <span className="menu-label">{it.label}</span>
              {it.hint && <span className="menu-hint">{it.hint}</span>}
              {it.shortcut && <span className="menu-shortcut">{shortcutText(it.shortcut)}</span>}
              {it.checked && <Check className="menu-check" size={14} strokeWidth={2.2} />}
              {it.submenu && <ChevronRight className="menu-chevron" size={14} />}
            </button>
          );
        })}
      </Floating>
      {sub && (
        <MenuList
          key={sub.index}
          items={items[sub.index].submenu}
          rect={sub.rect}
          placement="right"
          depth={depth + 1}
          origin={origin}
          autoFocus={sub.focus}
          onBack={() => {
            setSub(null);
            selfRef.current?.focus({ preventScroll: true });
          }}
        />
      )}
    </>
  );
}

/** Hosts the single open context menu or popover. */
export function MenuLayer() {
  const menu = useUI((u) => u.menu);

  useEffect(() => {
    if (!menu) return undefined;
    const onDown = (e) => {
      if (!e.target.closest?.('.floating')) closeMenu();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', closeMenu);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', closeMenu);
    };
  }, [menu]);

  if (!menu) return null;
  if (menu.kind === 'popover') {
    return (
      <Floating
        x={menu.x}
        y={menu.y}
        rect={menu.rect}
        className="popover"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            closeMenu();
          }
        }}
      >
        {menu.render(closeMenu)}
      </Floating>
    );
  }
  return <MenuList key={menu.key} items={menu.items} x={menu.x} y={menu.y} rect={menu.rect} origin={{ x: menu.x ?? menu.rect?.left, y: menu.y ?? menu.rect?.bottom }} />;
}

export const rectOf = (el) => {
  const r = el.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
};
