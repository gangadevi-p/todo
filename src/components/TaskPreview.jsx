import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { hidePreview, keepPreview, leaveTask, previewEngaged, useData, useUI } from '../store';
import { ItemEditor, TaskEditor } from './TaskEditor';

const GAP = 10;
const CONTROLS = 150; // width reserved for a row's date / done / colour / delete icons

// Where the pointer last was, so the popup opens beside what's being hovered.
const pointer = { x: -1, y: -1 };
if (typeof window !== 'undefined') {
  window.addEventListener('mousemove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true, capture: true });
}

function findItem(list = [], id) {
  for (const item of list) {
    if (item.id === id) return item;
    const nested = findItem(item.subtasks, id);
    if (nested) return nested;
  }
  return null;
}

/**
 * The task popup. Hovering a task's text opens it beside the cursor as the
 * editor for that task: details, notes and every sub-task and nested task,
 * all editable in place. Hovering a checklist item's text opens the same for
 * that one item. It grows as big as its content needs, up to the window.
 */
export function TaskPreview() {
  const preview = useUI((u) => u.preview);
  const task = useData((s) => (preview ? s.tasks.find((t) => t.id === preview.id) : null));
  const item = task && preview?.subId ? findItem(task.subtasks, preview.subId) : null;
  const missing = Boolean(preview && (!task || (preview.subId && !item)));

  // A task or item deleted while its popup is open takes the popup with it.
  useEffect(() => {
    if (missing) hidePreview();
  }, [missing]);

  if (!preview || missing) return null;
  const anchor = item ? `[data-sub-row][data-sub-id="${item.id}"]` : `[data-task-row][data-id="${task.id}"]`;
  return (
    <Popup key={item ? `${task.id}/${item.id}` : task.id} anchor={anchor}>
      {item ? <ItemEditor task={task} item={item} /> : <TaskEditor task={task} />}
    </Popup>
  );
}

function Popup({ anchor, children }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const grab = useRef(null); // pointer offset inside the anchor when the popup opened
  const tries = useRef(0);

  // Beside the cursor, level with the hovered text, so the mouse can slide
  // straight in: to the right when that leaves the row's icons uncovered,
  // otherwise to the left; below the row when it fits on neither side.
  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const a = document.querySelector(anchor);
    if (!a) {
      // Right after switching views (Enter, search) the row may not be on screen yet.
      if (tries.current < 20) {
        tries.current += 1;
        requestAnimationFrame(place);
      } else {
        hidePreview();
      }
      return;
    }
    tries.current = 0;
    const r = a.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!grab.current) {
      const inside = pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
      grab.current = inside ? { dx: pointer.x - r.left, dy: pointer.y - r.top } : { dx: Math.min(r.width / 2, 120), dy: r.height / 2 };
    }
    const px = r.left + grab.current.dx;
    const py = r.top + grab.current.dy;
    let left = null;
    if (px + GAP + w <= Math.min(vw - 8, r.right - CONTROLS)) left = px + GAP;
    else if (px - GAP - w >= 8) left = px - GAP - w;
    else if (px + GAP + w <= vw - 8) left = px + GAP;
    let top;
    if (left !== null) {
      top = Math.max(r.top - 6, py - 24);
    } else {
      left = px - 24;
      const below = vh - r.bottom - 14;
      top = h <= below || below >= r.top - 14 ? r.bottom + 6 : r.top - 6 - h;
    }
    left = Math.max(8, Math.min(left, vw - w - 8));
    top = Math.max(8, Math.min(top, vh - h - 8));
    setPos((p) => (p && p.left === left && p.top === top ? p : { left, top }));
  }, [anchor]);

  useLayoutEffect(() => {
    place();
  }, [place]);

  useEffect(() => {
    const el = ref.current;
    // Growing or shrinking while you edit (a sub-task added, notes typed) keeps it inside the window.
    const ro = new ResizeObserver(() => place());
    ro.observe(el);
    const onScroll = (e) => {
      // Scrolling the popup itself (a long list of sub-tasks) must not move or close it.
      if (e.target instanceof Node && el.contains(e.target)) return;
      if (previewEngaged()) place();
      else hidePreview();
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
    };
  }, [place]);

  return (
    <div
      ref={ref}
      className="preview"
      role="dialog"
      aria-label="Task"
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999, opacity: 0, pointerEvents: 'none' }}
      onMouseEnter={keepPreview}
      onMouseLeave={leaveTask}
      onBlur={(e) => {
        // Focus leaving the popup (you finished typing): close once the pointer is away too.
        if (!e.currentTarget.contains(e.relatedTarget)) leaveTask();
      }}
    >
      {children}
    </div>
  );
}
