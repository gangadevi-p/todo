import { useMemo } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import {
  confirmEmptyTrash, confirmPermanentlyDeleteTrashBatch, restoreTrashBatch, TRASH_RETENTION_MS, useData,
} from '../store';
import { formatTimestamp } from '../lib/dates';

function daysLeft(deletedAt) {
  return Math.max(0, Math.ceil((deletedAt + TRASH_RETENTION_MS - Date.now()) / 86400000));
}

/** Groups items that were deleted together so restoring a major task restores all of its children. */
function useTrashBatches() {
  const trash = useData((s) => s.trash || []);
  return useMemo(() => {
    const groups = new Map();
    for (const task of trash) {
      const id = task.trashBatchId || task.id;
      const batch = groups.get(id) || { id, tasks: [] };
      batch.tasks.push(task);
      groups.set(id, batch);
    }
    return [...groups.values()]
      .map((batch) => {
        const ids = new Set(batch.tasks.map((t) => t.id));
        const root = batch.tasks.find((t) => !t.parentId || !ids.has(t.parentId)) || batch.tasks[0];
        return { ...batch, root, deletedAt: Math.min(...batch.tasks.map((t) => t.deletedAt)) };
      })
      .sort((a, b) => b.deletedAt - a.deletedAt);
  }, [trash]);
}

export function TrashView() {
  const batches = useTrashBatches();
  if (!batches.length) {
    return <div className="trash-empty">Trash is empty. Deleted tasks stay here for 7 days.</div>;
  }
  return (
    <div className="trash-view">
      <div className="trash-note">
        Deleted tasks are permanently removed after 7 days.
        <button type="button" className="btn btn-danger-ghost" onClick={confirmEmptyTrash}>
          <Trash2 size={14} strokeWidth={1.9} /> Empty Trash
        </button>
      </div>
      <div className="trash-list">
        {batches.map((batch) => {
          const count = batch.tasks.length;
          const remaining = daysLeft(batch.deletedAt);
          return (
            <div className="trash-row" key={batch.id}>
              <div className="trash-row-copy">
                <strong>{batch.root.title || 'Untitled'}</strong>
                <span>
                  Deleted {formatTimestamp(batch.deletedAt)} · {count} task{count === 1 ? '' : 's'} · {remaining} day{remaining === 1 ? '' : 's'} left
                </span>
              </div>
              <div className="trash-row-actions">
                <button type="button" className="btn" onClick={() => restoreTrashBatch(batch.id)}>
                  <RotateCcw size={14} strokeWidth={1.9} /> Restore
                </button>
                <button
                  type="button"
                  className="icon-btn trash-delete"
                  title="Delete permanently"
                  aria-label="Delete permanently"
                  onClick={() => confirmPermanentlyDeleteTrashBatch(batch.id, batch.root.title)}
                >
                  <Trash2 size={15} strokeWidth={1.9} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
