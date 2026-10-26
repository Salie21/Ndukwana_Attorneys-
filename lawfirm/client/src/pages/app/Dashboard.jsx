import { Link } from 'react-router-dom';
import { collection, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useLive } from '../../lib/useLive';
import { ago, fmtDateTime, millis } from '../../lib/format';
import { PageHeader } from '../../components/Shell';
import { Empty, Loading, Status } from '../../components/ui';
import { useT } from '../../i18n/I18nProvider';
import { apptCase } from '../../lib/firm';

export default function Dashboard() {
  const { user, role, profile } = useAuth();
  const t = useT();
  const admin = role === 'admin';
  const appts = useLive(() => (admin ? collection(db, 'appointments') : query(collection(db, 'appointments'), where('staffId', '==', user.uid))), [user.uid, admin]);
  const tasks = useLive(() => (admin ? collection(db, 'tasks') : query(collection(db, 'tasks'), where('assigneeId', '==', user.uid))), [user.uid, admin]);
  const team = useLive(() => (admin ? collection(db, 'team') : null), [admin]);
  const feed = useLive(() => (admin ? query(collection(db, 'activity'), orderBy('createdAt', 'desc'), limit(8)) : null), [admin]);

  const pending = appts.data.filter((a) => a.status === 'pending');
  const upcoming = appts.data.filter((a) => a.status === 'approved' && millis(a.startsAt) > Date.now()).sort((a, b) => millis(a.startsAt) - millis(b.startsAt));
  const openTasks = tasks.data.filter((tk) => tk.status !== 'done');

  return (
    <>
      <PageHeader title={profile?.name ? t('dash.greeting', { name: profile.name.split(' ')[0] }) : t('dash.greetingAnon')} sub={admin ? t('dash.subAdmin') : t('dash.subStaff')} />
      <div className="grid" style={{ gap: 22 }}>
        <div className="grid cols-3">
          <Link to={admin ? '/app/consultations' : '/app/cases'} className="card stat" style={{ textDecoration: 'none' }}><b>{pending.length}</b><span>{t('dash.pending')}</span></Link>
          <div className="card stat"><b>{upcoming.length}</b><span>{t('dash.upcoming')}</span></div>
          <Link to="/app/tasks" className="card stat" style={{ textDecoration: 'none' }}><b>{openTasks.length}</b><span>{openTasks.length === 1 ? t('dash.openTask') : t('dash.openTasks')}</span></Link>
          {admin && <div className="card stat"><b>{team.data.filter((m) => m.status === 'active').length}</b><span>{t('dash.activeTeam')}</span></div>}
        </div>
        <div className="grid cols-2">
          <div className="card">
            <div className="card-head"><h3>{pending.length ? t('dash.review') : t('dash.next')}</h3><Link className="small" to={admin ? '/app/consultations' : '/app/cases'}>{t('common.viewAll')}</Link></div>
            {appts.loading ? <Loading /> : (pending.length ? pending : upcoming).length === 0 ? <Empty title={t('dash.allClear')}>{t('dash.allClearBody')}</Empty> : (
              <div className="list">{(pending.length ? pending : upcoming).slice(0, 5).map((a) => (
                <div key={a.id} className="list-item"><div className="grow"><b>{a.clientName}</b><div className="muted small">{apptCase(t, a)}{admin ? `, ${a.staffName}` : ''}</div><div className="small">{fmtDateTime(a.startsAt)}</div></div><Status value={a.status} /></div>
              ))}</div>
            )}
          </div>
          {admin ? (
            <div className="card">
              <div className="card-head"><h3>{t('dash.latest')}</h3><Link className="small" to="/app/activity">{t('dash.openLog')}</Link></div>
              {feed.loading ? <Loading /> : feed.data.length === 0 ? <Empty title={t('dash.noActivity')} /> : (
                <div className="list">{feed.data.map((f) => <div key={f.id} className="list-item"><div className="grow"><b className="small">{f.actorName}</b><div className="muted small" style={{ overflowWrap: 'anywhere' }}>{f.summary}</div></div><span className="muted small" style={{ whiteSpace: 'nowrap' }}>{ago(f.createdAt, t)}</span></div>)}</div>
              )}
            </div>
          ) : (
            <div className="card">
              <div className="card-head"><h3>{t('dash.myTasks')}</h3><Link className="small" to="/app/tasks">{t('dash.openBoard')}</Link></div>
              {tasks.loading ? <Loading /> : openTasks.length === 0 ? <Empty title={t('dash.noTasks')} /> : (
                <div className="list">{openTasks.slice(0, 6).map((tk) => <div key={tk.id} className="list-item"><div className="grow"><b>{tk.title}</b>{tk.clientName && <div className="muted small">{t('dash.clientName', { name: tk.clientName })}</div>}</div><Status value={tk.status} /></div>)}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
