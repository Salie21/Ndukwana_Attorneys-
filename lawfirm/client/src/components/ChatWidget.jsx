import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Send, X } from 'lucide-react';
import { api } from '../lib/api';
import { useI18n } from '../i18n/I18nProvider';

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Assistant replies appear word by word with a soft fade (the "ai-message" effect).
// Screen readers get the whole reply at once; the animated copy is hidden from them.
function Reply({ text, animate, onTick, onDone }) {
  const parts = useMemo(() => text.split(/(\s+)/), [text]);
  const [shown, setShown] = useState(() => (animate && !prefersReducedMotion() ? 0 : parts.length));
  useEffect(() => {
    if (shown >= parts.length) { if (animate) onDone?.(); return undefined; }
    const id = setTimeout(() => { setShown((n) => n + 1); onTick?.(); }, 22);
    return () => clearTimeout(id);
  }, [shown, parts.length, animate, onTick, onDone]);
  if (shown >= parts.length && !animate) return text;
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{parts.slice(0, shown).map((p, i) => <span key={i} className="wd">{p}</span>)}</span>
    </>
  );
}

export default function ChatWidget() {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  // `greeting` messages are shown in the current language; real turns are stored as typed.
  const [msgs, setMsgs] = useState([{ role: 'assistant', greeting: true }]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);
  const chat = useRef(null);
  const input = useRef(null);
  const scrollDown = () => end.current?.scrollIntoView({ block: 'end' });
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, busy, open]);

  useEffect(() => {
    if (!open) return;
    input.current?.focus({ preventScroll: true });
    const viewport = window.visualViewport;
    const updateViewport = () => {
      if (!viewport || !chat.current) return;
      chat.current.style.setProperty('--chat-viewport-height', `${viewport.height}px`);
      chat.current.style.setProperty('--chat-viewport-top', `${viewport.offsetTop}px`);
    };
    updateViewport();
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    return () => {
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  async function send(q0) {
    const q = (q0 ?? text).trim();
    if (!q || busy) return;
    setText('');
    const next = [...msgs, { role: 'user', text: q }];
    setMsgs(next); setBusy(true);
    try {
      // Only real conversation turns go to the server (not the greeting, not error notices),
      // the last few only, and it must start with the visitor's message.
      let history = next.filter((m) => !m.greeting && !m.error && m.text).slice(-7).map(({ role, text: tx }) => ({ role, text: tx }));
      while (history.length && history[0].role !== 'user') history.shift();
      const { reply } = await api('/chat', { method: 'POST', body: { messages: history, language: lang }, auth: false });
      setMsgs((m) => [...m, { role: 'assistant', text: reply, fresh: true }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', text: e.message, error: true }]);
    } finally { setBusy(false); }
  }

  const settle = (i) => setMsgs((m) => (m[i]?.fresh ? m.map((x, j) => (j === i ? { ...x, fresh: false } : x)) : m));

  if (!open) {
    return (
      <div className="fab-stack">
        <button className="fab bot" onClick={() => setOpen(true)} aria-label={t('chat.open')} aria-haspopup="dialog"><Bot size={26} /></button>
      </div>
    );
  }
  return (
    <section ref={chat} className="chatbox" role="dialog" aria-modal="false" aria-labelledby="chat-title">
      <div className="chat-head">
        <Bot size={26} color="#cda65e" />
        <div className="grow"><b id="chat-title">{t('chat.title')}</b><small>{t('chat.sub')}</small></div>
        <button className="icon-btn" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.3)' }} onClick={() => setOpen(false)} aria-label={t('chat.close')}><X size={18} /></button>
      </div>
      <div className="chat-body" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`bub ${m.role === 'user' ? 'me' : 'bot'}`}>
            {m.greeting ? t('chat.greeting') : m.role === 'user' ? m.text : <Reply text={m.text} animate={!!m.fresh} onTick={scrollDown} onDone={() => settle(i)} />}
          </div>
        ))}
        {msgs.length === 1 && <div className="quick">{['chat.q1', 'chat.q2', 'chat.q3'].map((k) => <button key={k} onClick={() => send(t(k))}>{t(k)}</button>)}</div>}
        {busy && <div className="bub bot typing" role="status" aria-label={t('chat.typing')}><i /><i /><i /></div>}
        <div ref={end} />
      </div>
      <div className="chat-note">{t('chat.note')}</div>
      <form className="chat-foot" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input ref={input} className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder={t('chat.placeholder')} aria-label={t('chat.label')} />
        <button className="btn btn-gold" disabled={busy || !text.trim()} aria-label={t('chat.send')}><Send size={18} /></button>
      </form>
    </section>
  );
}
