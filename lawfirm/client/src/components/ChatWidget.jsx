import { useEffect, useRef, useState } from 'react';
import { Bot, Send, X } from 'lucide-react';
import { api } from '../lib/api';

const GREETING = 'Hello, I am the Ndukwana Attorneys assistant. I can answer simple questions about the firm, our services and how to book. I cannot give legal advice.';
const QUICK = ['What services do you offer?', 'How do I book a consultation?', 'Where is your office?'];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([{ role: 'assistant', text: GREETING }]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);
  const chat = useRef(null);
  const input = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, open]);

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

  async function send(t) {
    const q = (t ?? text).trim();
    if (!q || busy) return;
    setText('');
    const next = [...msgs, { role: 'user', text: q }];
    setMsgs(next); setBusy(true);
    try {
      // The greeting is not sent; only the last few turns go to the server.
      const history = next.slice(1).slice(-7);
      const { reply } = await api('/chat', { method: 'POST', body: { messages: history }, auth: false });
      setMsgs((m) => [...m, { role: 'assistant', text: reply }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', text: e.message }]);
    } finally { setBusy(false); }
  }

  if (!open) {
    return (
      <div className="fab-stack">
        <button className="fab bot" onClick={() => setOpen(true)} aria-label="Ask the assistant" aria-haspopup="dialog"><Bot size={26} /></button>
      </div>
    );
  }
  return (
    <section ref={chat} className="chatbox" role="dialog" aria-modal="false" aria-labelledby="chat-title">
      <div className="chat-head">
        <Bot size={26} color="#cda65e" />
        <div className="grow"><b id="chat-title">Ask Ndukwana</b><small>Answers from our website. Not legal advice.</small></div>
        <button className="icon-btn" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.3)' }} onClick={() => setOpen(false)} aria-label="Close chat"><X size={18} /></button>
      </div>
      <div className="chat-body" aria-live="polite">
        {msgs.map((m, i) => <div key={i} className={`bub ${m.role === 'user' ? 'me' : 'bot'}`}>{m.text}</div>)}
        {msgs.length === 1 && <div className="quick">{QUICK.map((q) => <button key={q} onClick={() => send(q)}>{q}</button>)}</div>}
        {busy && <div className="bub bot">Typing…</div>}
        <div ref={end} />
      </div>
      <div className="chat-note">Please do not share personal or confidential details here.</div>
      <form className="chat-foot" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input ref={input} className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Type your question" aria-label="Your question" />
        <button className="btn btn-gold" disabled={busy || !text.trim()} aria-label="Send"><Send size={18} /></button>
      </form>
    </section>
  );
}
