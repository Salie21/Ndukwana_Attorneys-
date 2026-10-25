import { collection, deleteDoc, doc, query, updateDoc, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Bell, CalendarDays, CheckCheck, FileText, ListChecks, Trash2, UserPlus, Inbox } from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useLive } from '../../lib/useLive';
import { ago, millis } from '../../lib/format';
import { PageHeader } from '../../components/Shell';
import { Empty, Loading, useAction } from '../../components/ui';
import { useT } from '../../i18n/I18nProvider';
import { notifText } from '../../lib/notifText';

const ICONS = { appointment: CalendarDays, document: FileText, task: ListChecks, team: UserPlus, contact: Inbox };

export default function Notifications() {
  const { user } = useAuth();
  const t = useT();
  const nav = useNavigate();
  const [run] = useAction();
  const { data, loading } = useLive(() => query(collection(db, 'notifications'), where('userId', '==', user.uid)), [user.uid]);
  const items = [...data].sort((a, b) => millis(b.createdAt) - millis(a.createdAt));
  const unread = items.filter((n) => !n.read);

  const open = async (n) => {
    if (!n.read) await updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(() => {});
    if (n.link) nav(n.link);
  };
  return (
    <>
      <PageHeader title={t('notif.title')} sub={unread.length ? t('notif.unread', { n: unread.length }) : t('notif.caughtUp')}>
        {unread.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => run(() => Promise.all(unread.map((n) => updateDoc(doc(db, 'notifications', n.id), { read: true }))))}><CheckCheck size={16} />{t('notif.markAll')}</button>}
      </PageHeader>
      <div className="card">
        {loading ? <Loading /> : items.length === 0 ? <Empty title={t('notif.none')}>{t('notif.noneBody')}</Empty> : (
          <div className="list">
            {items.map((n) => { const I = ICONS[n.type] || Bell; const tx = notifText(t, n); return (
              <div key={n.id} className={`list-item ${n.read ? '' : 'unread'}`}>
                <I size={20} color="var(--gold)" style={{ marginTop: 3 }} />
                <button style={{ all: 'unset', cursor: 'pointer', flex: 1, display: 'block' }} onClick={() => open(n)}>
                  <b style={{ display: 'block' }}>{tx.title}</b><span className="muted">{tx.body}</span><span className="muted small" style={{ display: 'block', marginTop: 2 }}>{ago(n.createdAt, t)}</span>
                </button>
                <button className="icon-btn" aria-label={t('notif.delete')} onClick={() => deleteDoc(doc(db, 'notifications', n.id))}><Trash2 size={16} /></button>
              </div>
            ); })}
          </div>
        )}
      </div>
    </>
  );
}
