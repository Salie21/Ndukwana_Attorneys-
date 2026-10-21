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

const COLS = [['todo', 'To do'], ['in_progress', 'In progress'], ['done', 'Done']];
const NEXT = { todo: [['in_progress', 'Start']], in_progress: [['done', 'Mark done'], ['todo', 'Back to to do']], done: [['todo', 'Reopen']] };

export default function Tasks() {
  const { user, role } = useAuth();
  const [run, busy] = useAction();
  const [adding, setAdding] = useState(false);
  const tasks = useLive(() => (role === 'admin' ? collection(db, 'tasks') : query(collection(db, 'tasks'), where('assigneeId', '==', user.uid))), [user.uid, role]);
  const team = useLive(() => (adding && role === 'admin' ? collection(db, 'team') : null), [adding, role]);
  const appts = useMyAppointments();
  const sorted = [...tasks.data].sort((a, b) => (millis(a.dueDate) || 9e15) - (millis(b.dueDate) || 9e15));

  const move = (t, status) => run(() => api(`/tasks/${t.id}`, { method: 'PATCH', body: { status } }));
  const del = (t) => confirm(`Delete “${t.title}”?`) && run(() => api(`/tasks/${t.id}`, { method: 'DELETE' }), 'Task deleted');
  const create = async (e) => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const body = { title: f.get('title'), description: f.get('description') || undefined, priority: f.get('priority'), dueDate: f.get('dueDate') || undefined, assigneeId: f.get('assigneeId') || undefined, appointmentId: f.get('appointmentId') || undefined };
    if (await run(() => api('/tasks', { method: 'POST', body }), 'Task created')) setAdding(false);
  };

  return (
    <>
      <PageHeader title="Tasks" sub={role === 'admin' ? 'Everything the team is working on.' : 'Your to-do list, including work assigned to you.'}>
        <button className="btn btn-gold btn-sm" onClick={() => setAdding(true)}><Plus size={16} />New task</button>
      </PageHeader>
      {tasks.loading ? <Loading /> : (
        <div className="kanban">{COLS.map(([id, label]) => {
          const items = sorted.filter((t) => t.status === id);
          return (
            <section key={id} className="card" aria-label={label}>
              <div className="card-head"><h3 style={{ fontSize: '1.25rem' }}>{label}</h3><span className="badge"><span>{items.length}</span></span></div>
              <div className="stack">
                {items.length === 0 && <p className="muted small">Nothing here.</p>}
                {items.map((t) => (
                  <article key={t.id} className="task">
                    <div className="row between"><b style={{ overflowWrap: 'anywhere' }}>{t.title}</b>{t.priority === 'high' && <Status value="declined" />}</div>
                    {t.description && <p className="muted small">{t.description}</p>}
                    <p className="muted small">{role === 'admin' ? `${t.assigneeName}. ` : ''}{t.clientName ? `Client: ${t.clientName}. ` : ''}{t.dueDate ? `Due ${fmtDate(t.dueDate)}` : 'No due date'}</p>
                    <div className="row wrap">
                      {NEXT[t.status].map(([s, l]) => <button key={s} className="btn btn-ghost btn-sm" disabled={busy} onClick={() => move(t, s)}>{l}</button>)}
                      {(t.createdBy === user.uid || role === 'admin') && <button className="icon-btn" style={{ width: 30, height: 30, marginLeft: 'auto' }} aria-label={`Delete ${t.title}`} onClick={() => del(t)}><Trash2 size={14} /></button>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}</div>
      )}
      {adding && (
        <Modal title="New task" onClose={() => setAdding(false)}>
          <form className="stack" onSubmit={create}>
            <label className="field"><span>Task</span><input className="input" name="title" required minLength={2} maxLength={120} /></label>
            <label className="field"><span>Details (optional)</span><textarea className="textarea" name="description" maxLength={1000} style={{ minHeight: 80 }} /></label>
            <div className="row wrap" style={{ alignItems: 'stretch' }}>
              <label className="field grow"><span>Due date</span><input className="input" type="date" name="dueDate" /></label>
              <label className="field grow"><span>Priority</span><select className="select" name="priority" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>
            </div>
            {role === 'admin' && (team.loading ? <Loading /> : <label className="field"><span>Assign to</span><select className="select" name="assigneeId" defaultValue={user.uid}>{team.data.filter((m) => m.status === 'active').map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>)}
            <label className="field"><span>Linked consultation (optional)</span><select className="select" name="appointmentId" defaultValue=""><option value="">None</option>{appts.data.filter((a) => !['cancelled', 'declined'].includes(a.status)).map((a) => <option key={a.id} value={a.id}>{a.clientName}, {fmtDate(a.startsAt)}</option>)}</select></label>
            <button className="btn btn-gold" disabled={busy}>Create task</button>
          </form>
        </Modal>
      )}
    </>
  );
}
