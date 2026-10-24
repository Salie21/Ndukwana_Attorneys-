import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, RotateCcw, Send, X } from 'lucide-react';
import { api } from '../lib/api';
import { useI18n } from '../i18n/I18nProvider';

const STORE = 'chat:v1';
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const load = () => { try { const v = JSON.parse(sessionStorage.getItem(STORE)); return Array.isArray(v) && v.length ? v : null; } catch { return null; } };
const save = (msgs) => { try { sessionStorage.setItem(STORE, JSON.stringify(msgs.map(({ fresh, ...m }) => m))); } catch { /* storage unavailable */ } };
const FRESH = [{ role: 'assistant', greeting: true }];

// Assistant replies appear word by word with a soft fade. Screen readers get the whole reply at once.
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
  // `greeting` is shown in the current language; real turns are stored exactly as typed or received.
  const [msgs, setMsgs] = useState(() => load() || FRESH);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);
  const chat = useRef(null);
  const input = useRef(null);
  const pending = useRef(null);
  const scrollDown = useCallback(() => end.current?.scrollIntoView({ block: 'end' }), []);

  useEffect(() => { save(msgs); }, [msgs]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, busy, open]);
  useEffect(() => () => pending.current?.abort(), []);

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
    const closeOnEscape = (event) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  // Sends the conversation so far (plus an optional new question) and appends the assistant's answer.
  async function ask(list) {
    setMsgs(list); setBusy(true);
    const ctrl = new AbortController();
    pending.current = ctrl;
    const timer = setTimeout(() => ctrl.abort(), 30000);
    try {
      // Only real turns go to the server: not the greeting, not error notices, the last few only,
      // and the history must start with the visitor's message.
      const history = list.filter((m) => !m.greeting && !m.error && typeof m.text === 'string' && m.text).slice(-7).map(({ role, text: tx }) => ({ role, text: tx }));
      while (history.length && history[0].role !== 'user') history.shift();
      if (!history.length) throw new Error(t('chat.unreachable'));
      const data = await api('/chat', { method: 'POST', body: { messages: history, language: lang }, auth: false, signal: ctrl.signal });
      // A host that returns a web page instead of JSON (wrong API address) lands here.
      if (typeof data?.reply !== 'string' || !data.reply.trim()) throw new Error(t('chat.unreachable'));
      setMsgs((m) => [...m, { role: 'assistant', text: data.reply.trim(), fresh: true }]);
    } catch (e) {
      if (ctrl.signal.aborted && !(e.message || '').includes('too long')) return; // chat was reset or closed
      setMsgs((m) => [...m, { role: 'assistant', text: e.message || t('chat.unreachable'), error: true }]);
    } finally { clearTimeout(timer); setBusy(false); input.current?.focus({ preventScroll: true }); }
  }

  function send(q0) {
    const q = (q0 ?? text).trim();
    if (!q || busy) return;
    setText('');
    ask([...msgs, { role: 'user', text: q }]);
  }
  const retry = () => { if (!busy) ask(msgs.filter((m) => !m.error)); };
  const reset = () => { pending.current?.abort(); setBusy(false); setMsgs(FRESH); setText(''); input.current?.focus({ preventScroll: true }); };
  const settle = (i) => setMsgs((m) => (m[i]?.fresh ? m.map((x, j) => (j === i ? { ...x, fresh: false } : x)) : m));

  if (!open) {
    return (
      <div className="fab-stack">
        <button className="fab bot" onClick={() => setOpen(true)} aria-label={t('chat.open')} aria-haspopup="dialog"><Bot size={26} /></button>
      </div>
    );
  }
  const lastIsError = msgs.at(-1)?.error;
  return (
    <section ref={chat} className="chatbox" role="dialog" aria-modal="false" aria-labelledby="chat-title">
      <div className="chat-head">
        <Bot size={26} color="#cda65e" style={{ flex: 'none' }} />
        <div className="grow" style={{ minWidth: 0 }}><b id="chat-title">{t('chat.title')}</b><small>{t('chat.sub')}</small></div>
        {msgs.length > 1 && <button className="icon-btn chat-icon" onClick={reset} aria-label={t('chat.new')} title={t('chat.new')}><RotateCcw size={16} /></button>}
        <button className="icon-btn chat-icon" onClick={() => setOpen(false)} aria-label={t('chat.close')}><X size={18} /></button>
      </div>
      <div className="chat-body" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`bub ${m.role === 'user' ? 'me' : 'bot'}${m.error ? ' err' : ''}`}>
            {m.greeting ? t('chat.greeting') : m.role === 'user' || m.error ? m.text : <Reply text={m.text} animate={!!m.fresh} onTick={scrollDown} onDone={() => settle(i)} />}
          </div>
        ))}
        {msgs.length === 1 && <div className="quick">{['chat.q1', 'chat.q2', 'chat.q3'].map((k) => <button key={k} onClick={() => send(t(k))}>{t(k)}</button>)}</div>}
        {lastIsError && !busy && <div className="quick"><button onClick={retry}><RotateCcw size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} />{t('chat.retry')}</button></div>}
        {busy && <div className="bub bot typing" role="status" aria-label={t('chat.typing')}><i /><i /><i /></div>}
        <div ref={end} />
      </div>
      <div className="chat-note">{t('chat.note')}</div>
      <form className="chat-foot" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input ref={input} className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder={t('chat.placeholder')} aria-label={t('chat.label')} enterKeyHint="send" autoComplete="off" />
        <button className="btn btn-gold" disabled={busy || !text.trim()} aria-label={t('chat.send')}><Send size={18} /></button>
      </form>
    </section>
  );
}
