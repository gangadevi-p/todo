import { useMemo } from 'react';
import { MessageCircleQuestion, Pencil, Plus, Trash2 } from 'lucide-react';
import { confirmDeleteQA, openQA, useData } from '../store';
import { formatTimestamp } from '../lib/dates';

const NO_QA = [];

/** The Q&A page: every question noted for the design, newest first, with its answer under it. */
export function QAView() {
  const qa = useData((s) => s.qa || NO_QA);
  const items = useMemo(() => [...qa].sort((a, b) => b.createdAt - a.createdAt), [qa]);

  if (!items.length) {
    return (
      <div className="qa-empty">
        <MessageCircleQuestion size={22} strokeWidth={1.6} />
        <p>Note a question here, then write the answer when you have it. Keep everything the design depends on in one place.</p>
        <button type="button" className="btn" onClick={() => openQA()}>
          <Plus size={14} strokeWidth={2} /> Add question
        </button>
      </div>
    );
  }

  return (
    <div className="qa-list">
      {items.map((q) => {
        const answered = Boolean(q.answer.trim());
        return (
          <article key={q.id} className={`qa-item${answered ? '' : ' unanswered'}`} onClick={() => openQA(q.id)}>
            <div className="qa-line">
              <span className="qa-mark" aria-hidden="true">Q</span>
              <p className="qa-question">{q.question}</p>
              <div className="qa-actions">
                <button
                  type="button"
                  className="icon-btn sm"
                  aria-label="Edit question and answer"
                  onClick={(e) => { e.stopPropagation(); openQA(q.id); }}
                >
                  <Pencil size={14} strokeWidth={1.9} />
                </button>
                <button
                  type="button"
                  className="icon-btn sm qa-delete"
                  aria-label="Delete question"
                  onClick={(e) => { e.stopPropagation(); confirmDeleteQA(q); }}
                >
                  <Trash2 size={14} strokeWidth={1.9} />
                </button>
              </div>
            </div>
            <div className="qa-line">
              <span className="qa-mark answer" aria-hidden="true">A</span>
              {answered ? (
                <p className="qa-answer">{q.answer}</p>
              ) : (
                <button
                  type="button"
                  className="qa-add-answer"
                  onClick={(e) => { e.stopPropagation(); openQA(q.id); }}
                >
                  No answer yet. Add it
                </button>
              )}
            </div>
            <div className="qa-meta">Added {formatTimestamp(q.createdAt)}</div>
          </article>
        );
      })}
    </div>
  );
}
