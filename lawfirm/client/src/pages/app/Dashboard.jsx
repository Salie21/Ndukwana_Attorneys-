import { Link } from 'react-router-dom';
import { collection, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useLive } from '../../lib/useLive';
import { ago, fmtDateTime, millis } from '../../lib/format';
import { PageHeader } from '../../components/Shell';
import { Empty, Loading, Status } from '../../components/ui';

export default function Dashboard() {
  const { user, role, profile } = useAuth();
  const admin = role === 'admin';
  const appts = useLive(() => (admin ? collection(db, 'appointments') : query(collection(db, 'appointments'), where('staffId', '==', user.uid))), [user.uid, admin]);
  const tasks = useLive(() => (admin ? collection(db, 'tasks') : query(collection(db, 'tasks'), where('assigneeId', '==', user.uid))), [user.uid, admin]);
  const team = useLive(() => (admin ? collection(db, 'team') : null), [admin]);
  const feed = useLive(() => (admin ? query(collection(db, 'activity'), orderBy('createdAt', 'desc'), limit(8)) : null), [admin]);

  const pending = appts.data.filter((a) => a.status === 'pending');
  const upcoming = appts.data.filter((a) => a.status === 'approved' && millis(a.startsAt) > Date.now()).sort((a, b) => millis(a.startsAt) - millis(b.startsAt));
  const openTasks = tasks.data.filter((t) => t.status !== 'done');

  return (
    <>
      <PageHeader title={`Good day${profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}`} sub={admin ? 'A firm-wide view of consultations, tasks and team activity.' : 'What needs your attention today.'} />
      <div className="grid" style={{ gap: 22 }}>
        <div className="grid cols-3">
          <Link to={admin ? '/app/consultations' : '/app/cases'} className="card stat" style={{ textDecoration: 'none' }}><b>{pending.length}</b><span>consultation requests awaiting a decision</span></Link>
          <div className="card stat"><b>{upcoming.length}</b><span>approved consultations coming up</span></div>
          <Link to="/app/tasks" className="card stat" style={{ textDecoration: 'none' }}><b>{openTasks.length}</b><span>open task{openTasks.length === 1 ? '' : 's'}</span></Link>
          {admin && <div className="card stat"><b>{team.data.filter((m) => m.status === 'active').length}</b><span>active team members</span></div>}
        </div>
        <div className="grid cols-2">
          <div className="card">
            <div className="card-head"><h3>{pending.length ? 'Requests to review' : 'Next consultations'}</h3><Link className="small" to={admin ? '/app/consultations' : '/app/cases'}>View all</Link></div>
            {appts.loading ? <Loading /> : (pending.length ? pending : upcoming).length === 0 ? <Empty title="All clear">New consultation requests will show up here.</Empty> : (
              <div className="list">{(pending.length ? pending : upcoming).slice(0, 5).map((a) => (
                <div key={a.id} className="list-item"><div className="grow"><b>{a.clientName}</b><div className="muted small">{a.caseLabel}{admin ? `, ${a.staffName}` : ''}</div><div className="small">{fmtDateTime(a.startsAt)}</div></div><Status value={a.status} /></div>
              ))}</div>
            )}
          </div>
          {admin ? (
            <div className="card">
              <div className="card-head"><h3>Latest team activity</h3><Link className="small" to="/app/activity">Open log</Link></div>
              {feed.loading ? <Loading /> : feed.data.length === 0 ? <Empty title="No activity yet" /> : (
                <div className="list">{feed.data.map((f) => <div key={f.id} className="list-item"><div className="grow"><b className="small">{f.actorName}</b><div className="muted small" style={{ overflowWrap: 'anywhere' }}>{f.summary}</div></div><span className="muted small" style={{ whiteSpace: 'nowrap' }}>{ago(f.createdAt)}</span></div>)}</div>
              )}
            </div>
          ) : (
            <div className="card">
              <div className="card-head"><h3>My open tasks</h3><Link className="small" to="/app/tasks">Open board</Link></div>
              {tasks.loading ? <Loading /> : openTasks.length === 0 ? <Empty title="No open tasks" /> : (
                <div className="list">{openTasks.slice(0, 6).map((t) => <div key={t.id} className="list-item"><div className="grow"><b>{t.title}</b>{t.clientName && <div className="muted small">Client: {t.clientName}</div>}</div><Status value={t.status} /></div>)}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
