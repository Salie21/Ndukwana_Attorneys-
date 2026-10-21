import { useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, limit, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { Hash, Send } from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useLive } from '../../lib/useLive';
import { fmtTime } from '../../lib/format';
import { PageHeader } from '../../components/Shell';
import { Avatar, useToast } from '../../components/ui';

// In-app team chat (Firestore, realtime). Only staff and supervisors can read or write it.
export default function Messages() {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [chat, setChat] = useState('general');
  const [text, setText] = useState('');
  const end = useRef(null);
  const team = useLive(() => collection(db, 'team'), []);
  const msgs = useLive(() => query(collection(db, 'chats', chat, 'messages'), orderBy('createdAt', 'desc'), limit(100)), [chat]);
  const ordered = useMemo(() => [...msgs.data].reverse(), [msgs.data]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [ordered.length, chat]);

  const dmId = (uid) => ['dm', ...[user.uid, uid].sort()].join('_');
  const others = team.data.filter((m) => m.id !== user.uid && m.status === 'active');
  const title = chat === 'general' ? 'General' : others.find((m) => dmId(m.id) === chat)?.name || 'Direct message';

  async function send(e) {
    e.preventDefault();
    const t = text.trim(); if (!t) return;
    setText('');
    try { await addDoc(collection(db, 'chats', chat, 'messages'), { uid: user.uid, name: profile?.name || 'Team member', text: t, createdAt: serverTimestamp() }); }
    catch { setText(t); toast('Message not sent. Please try again.', 'bad'); }
  }

  return (
    <>
      <PageHeader title="Messages" sub="Private to the firm’s team. Clients cannot see this." />
      <div className="chat-wrap">
        <aside className="card" aria-label="Conversations">
          <button className={`chan ${chat === 'general' ? 'on' : ''}`} onClick={() => setChat('general')}><Hash size={18} color="var(--gold)" />General</button>
          <div className="nav-label muted" style={{ color: 'var(--muted)' }}>Direct messages</div>
          <div style={{ overflowY: 'auto' }}>{others.map((m) => <button key={m.id} className={`chan ${chat === dmId(m.id) ? 'on' : ''}`} onClick={() => setChat(dmId(m.id))}><Avatar src={m.avatar} name={m.name} size={26} />{m.name}</button>)}
            {others.length === 0 && <p className="muted small" style={{ padding: 10 }}>Invite colleagues to start a conversation.</p>}</div>
        </aside>
        <section className="card" aria-label={title}>
          <h4 style={{ paddingBottom: 10, borderBottom: '1px solid var(--line)' }}>{title}</h4>
          <div className="msgs" aria-live="polite">
            {ordered.length === 0 && !msgs.loading && <p className="muted" style={{ textAlign: 'center', padding: 30 }}>No messages yet. Say hello.</p>}
            {ordered.map((m) => (
              <div key={m.id} className={`msg ${m.uid === user.uid ? 'mine' : ''}`}>
                <Avatar src={team.data.find((t) => t.id === m.uid)?.avatar} name={m.name} size={30} />
                <div className="bubble"><small>{m.uid === user.uid ? 'You' : m.name}, {fmtTime(m.createdAt)}</small>{m.text}</div>
              </div>
            ))}
            <div ref={end} />
          </div>
          <form className="composer" onSubmit={send}>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder={`Message ${title}`} aria-label="Message" />
            <button className="btn btn-gold" disabled={!text.trim()} aria-label="Send"><Send size={18} /></button>
          </form>
        </section>
      </div>
    </>
  );
}
