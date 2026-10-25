import { useState } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { Plus, Trash2 } from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useLive } from '../../lib/useLive';
import { api } from '../../lib/api';
import { fmtDate, millis } from '../../lib/format';
import { PageHeader } from '../../components/Shell';
import { Loading, Modal, Status, useAction } from '../../components/ui';
import { useMyAppointments } from '../shared/Documents';
import Select from '../../components/Select';
import { useT } from '../../i18n/I18nProvider';

const COLS = ['todo', 'in_progress', 'done'];
const NEXT = { todo: [['in_progress', 'tasks.start']], in_progress: [['done', 'tasks.markDone'], ['todo', 'tasks.backTodo']], done: [['todo', 'tasks.reopen']] };

export default function Tasks() {
  const { user, role } = useAuth();
  const t = useT();
  const [run, busy] = useAction();
  const [adding, setAdding] = useState(false);
  const tasks = useLive(() => (role === 'admin' ? collection(db, 'tasks') : query(collection(db, 'tasks'), where('assigneeId', '==', user.uid))), [user.uid, role]);
  const team = useLive(() => (adding && role === 'admin' ? collection(db, 'team') : null), [adding, role]);
  const appts = useMyAppointments();
  const sorted = [...tasks.data].sort((a, b) => (millis(a.dueDate) || 9e15) - (millis(b.dueDate) || 9e15));

  const move = (tk, status) => run(() => api(`/tasks/${tk.id}`, { method: 'PATCH', body: { status } }));
  const del = (tk) => confirm(t('tasks.confirmDelete', { title: tk.title })) && run(() => api(`/tasks/${tk.id}`, { method: 'DELETE' }), t('tasks.deleted'));
  const create = async (e) => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const body = { title: f.get('title'), description: f.get('description') || undefined, priority: f.get('priority'), dueDate: f.get('dueDate') || undefined, assigneeId: f.get('assigneeId') || undefined, appointmentId: f.get('appointmentId') || undefined };
    if (await run(() => api('/tasks', { method: 'POST', body }), t('tasks.created'))) setAdding(false);
  };

  return (
    <>
      <PageHeader title={t('tasks.title')} sub={role === 'admin' ? t('tasks.subAdmin') : t('tasks.subStaff')}>
        <button className="btn btn-gold btn-sm" onClick={() => setAdding(true)}><Plus size={16} />{t('tasks.new')}</button>
      </PageHeader>
      {tasks.loading ? <Loading /> : (
        <div className="kanban">{COLS.map((id) => {
          const label = t(`tasks.${id}`);
          const items = sorted.filter((tk) => tk.status === id);
          return (
            <section key={id} className="card" aria-label={label}>
              <div className="card-head"><h3 style={{ fontSize: '1.25rem' }}>{label}</h3><span className="badge"><span>{items.length}</span></span></div>
              <div className="stack">
                {items.length === 0 && <p className="muted small">{t('tasks.nothing')}</p>}
                {items.map((tk) => (
                  <article key={tk.id} className="task">
                    <div className="row between"><b style={{ overflowWrap: 'anywhere' }}>{tk.title}</b>{tk.priority === 'high' && <Status value="declined" />}</div>
                    {tk.description && <p className="muted small">{tk.description}</p>}
                    <p className="muted small">{role === 'admin' ? `${tk.assigneeName}. ` : ''}{tk.clientName ? `${t('dash.clientName', { name: tk.clientName })}. ` : ''}{tk.dueDate ? t('tasks.due', { date: fmtDate(tk.dueDate) }) : t('tasks.noDue')}</p>
                    <div className="row wrap">
                      {NEXT[tk.status].map(([s, l]) => <button key={s} className="btn btn-ghost btn-sm" disabled={busy} onClick={() => move(tk, s)}>{t(l)}</button>)}
                      {(tk.createdBy === user.uid || role === 'admin') && <button className="icon-btn" style={{ width: 30, height: 30, marginLeft: 'auto' }} aria-label={t('tasks.deleteAria', { title: tk.title })} onClick={() => del(tk)}><Trash2 size={14} /></button>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}</div>
      )}
      {adding && (
        <Modal title={t('tasks.new')} onClose={() => setAdding(false)}>
          <form className="stack" onSubmit={create}>
            <label className="field"><span>{t('tasks.task')}</span><input className="input" name="title" required minLength={2} maxLength={120} /></label>
            <label className="field"><span>{t('tasks.details')}</span><textarea className="textarea" name="description" maxLength={1000} style={{ minHeight: 80 }} /></label>
            <div className="row wrap" style={{ alignItems: 'stretch' }}>
              <label className="field grow"><span>{t('tasks.dueDate')}</span><input className="input" type="date" name="dueDate" /></label>
              <label className="field grow"><span>{t('tasks.priority')}</span><Select name="priority" defaultValue="normal" options={[{ value: 'low', label: t('tasks.low') }, { value: 'normal', label: t('tasks.normal') }, { value: 'high', label: t('tasks.high') }]} /></label>
            </div>
            {role === 'admin' && (team.loading ? <Loading /> : <label className="field"><span>{t('tasks.assign')}</span><Select name="assigneeId" defaultValue={user.uid} options={team.data.filter((m) => m.status === 'active').map((m) => ({ value: m.id, label: m.name }))} /></label>)}
            <label className="field"><span>{t('tasks.linked')}</span><Select name="appointmentId" defaultValue="" options={[{ value: '', label: t('common.none') }, ...appts.data.filter((a) => !['cancelled', 'declined'].includes(a.status)).map((a) => ({ value: a.id, label: `${a.clientName}, ${fmtDate(a.startsAt)}` }))]} /></label>
            <button className="btn btn-gold" disabled={busy}>{t('tasks.createBtn')}</button>
          </form>
        </Modal>
      )}
    </>
  );
}
