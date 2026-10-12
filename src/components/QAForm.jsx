import { useLayoutEffect, useRef, useState } from 'react';
import { MessageCircleQuestion, MessageSquareText, Trash2 } from 'lucide-react';
import { addQA, closePopup, confirmDeleteQA, updateQA, useData } from '../store';
import { modKey } from '../lib/util';
import { Field, Popup } from './Popup';

const QUESTION = { icon: MessageCircleQuestion, tint: '#64748b', label: 'Question' };
const ANSWER = { icon: MessageSquareText, tint: '#3f9468', label: 'Answer' };

/** Grows a textarea with its content (measured again next frame: the popup is still laying out on first render). */
function useAutoGrow(ref, value, min) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => {
      el.style.height = '0px';
      el.style.height = `${Math.max(el.scrollHeight, min)}px`;
    };
    fit();
    const raf = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(raf);
  }, [ref, value, min]);
}

/** Add a question and its answer, or edit one. Only the question is required: the answer can come later. */
export function QAForm({ id = null }) {
  const item = useData((s) => (id ? (s.qa || []).find((q) => q.id === id) || null : null));
  const [question, setQuestion] = useState(item?.question || '');
  const [answer, setAnswer] = useState(item?.answer || '');
  const questionRef = useRef(null);
  const answerRef = useRef(null);
  useAutoGrow(questionRef, question, 40);
  useAutoGrow(answerRef, answer, 96);

  if (id && !item) return null;

  const q = question.trim();
  const a = answer.trim();
  const isNew = !item;
  const dirty = isNew ? Boolean(q || a) : q !== item.question || a !== item.answer;

  const submit = () => {
    if (!q) {
      questionRef.current?.focus();
      return;
    }
    if (isNew) addQA({ question: q, answer: a });
    else if (dirty) updateQA(item.id, { question: q, answer: a });
    closePopup();
  };

  return (
    <Popup
      title={isNew ? 'New question' : 'Edit question'}
      subtitle={`Only the question is required. ${modKey()}+Enter saves.`}
      dirty={dirty}
      canSubmit={Boolean(q) && dirty}
      submitLabel={isNew ? 'Add question' : 'Save'}
      onSubmit={submit}
      focusRef={questionRef}
      hideKeys
      headActions={item && (
        <button type="button" className="icon-btn" aria-label="Delete question" onClick={() => confirmDeleteQA(item)}>
          <Trash2 size={16} />
        </button>
      )}
    >
      <Field f={QUESTION} top>
        <textarea
          ref={questionRef}
          className="pp-notes qa-question-input"
          autoFocus
          rows={1}
          value={question}
          spellCheck
          placeholder="What do you need to know?"
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            // Enter moves on to the answer; Ctrl+Enter (handled by the popup) saves.
            if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
              e.preventDefault();
              answerRef.current?.focus();
            }
          }}
        />
      </Field>

      <Field f={ANSWER} hint="Optional" top>
        <textarea
          ref={answerRef}
          className="pp-notes"
          value={answer}
          spellCheck
          placeholder="Write the answer, or leave it for later"
          onChange={(e) => setAnswer(e.target.value)}
        />
      </Field>
    </Popup>
  );
}
