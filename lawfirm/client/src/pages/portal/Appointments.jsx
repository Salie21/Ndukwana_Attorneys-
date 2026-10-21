import { useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useLive } from '../../lib/useLive';
import { api } from '../../lib/api';
import { fmtDateTime, millis } from '../../lib/format';
import { PageHeader } from '../../components/Shell';
import { Empty, Loading, Modal, Status, useAction } from '../../components/ui';
import { SlotPicker } from './Book';

export default function Appointments() {
  const { user } = useAuth();
  const [run, busy] = useAction();
  const [resched, setResched] = useState(null);
  const [slot, setSlot] = useState({ date: '', hour: null });
  const [filter, setFilter] = useState('open');
  const { data, loading } = useLive(() => query(collection(db, 'appointments'), where('clientId', '==', user.uid)), [user.uid]);

  const open = (a) => ['pending', 'approved'].includes(a.status);
  const list = data.filter((a) => (filter === 'open' ? open(a) : !open(a))).sort((a, b) => millis(b.startsAt) - millis(a.startsAt));

  const cancel = (a) => confirm('Cancel this consultation?') && run(() => api(`/appointments/${a.id}/cancel`, { method: 'PATCH', body: {} }), 'Consultation cancelled');
  const doResched = async () => {
    const ok = await run(() => api(`/appointments/${resched.id}/reschedule`, { method: 'PATCH', body: { date: slot.date, hour: slot.hour } }), 'Rescheduled. It needs approval again.');
    if (ok) setResched(null);
  };

  return (
    <>
      <PageHeader title="My consultations" sub="Track, reschedule or cancel your bookings.">
        <Link className="btn btn-gold btn-sm" to="/portal/book">New booking</Link>
      </PageHeader>
      <div className="tabs">
        <button className={`tab ${filter === 'open' ? 'on' : ''}`} onClick={() => setFilter('open')}>Upcoming</button>
        <button className={`tab ${filter === 'past' ? 'on' : ''}`} onClick={() => setFilter('past')}>Past and closed</button>
      </div>
      {loading ? <Loading /> : list.length === 0 ? (
        <div className="card"><Empty title={filter === 'open' ? 'No upcoming consultations' : 'Nothing here yet'}>{filter === 'open' && <Link className="btn btn-gold" to="/portal/book">Book a consultation</Link>}</Empty></div>
      ) : (
        <div className="grid">{list.map((a) => (
          <div className="card" key={a.id}>
            <div className="card-head"><div><h3 style={{ fontSize: '1.35rem' }}>{a.caseLabel}</h3><div className="muted">with {a.staffName}</div></div><Status value={a.status} /></div>
            <p><b>{fmtDateTime(a.startsAt)}</b></p>
            <p className="muted" style={{ margin: '8px 0 14px', overflowWrap: 'anywhere' }}>{a.description}</p>
            {a.statusNote && <p className="alert" style={{ marginBottom: 12 }}>Note from the firm: {a.statusNote}</p>}
            <div className="row wrap">
              {open(a) && <><button className="btn btn-ghost btn-sm" onClick={() => { setResched(a); setSlot({ date: '', hour: null }); }}>Reschedule</button>
                <button className="btn btn-danger btn-sm" onClick={() => cancel(a)} disabled={busy}>Cancel</button></>}
              <Link className="btn btn-ghost btn-sm" to="/portal/documents">Upload documents</Link>
            </div>
          </div>
        ))}</div>
      )}
      {resched && (
        <Modal title="Reschedule consultation" onClose={() => setResched(null)}>
          <p className="muted" style={{ marginBottom: 12 }}>Currently {fmtDateTime(resched.startsAt)} with {resched.staffName}. The new time needs approval again.</p>
          <SlotPicker staffId={resched.staffId} value={slot} onChange={setSlot} />
          <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setResched(null)}>Keep current time</button>
            <button className="btn btn-gold" onClick={doResched} disabled={busy || slot.hour == null}>Confirm new time</button>
          </div>
        </Modal>
      )}
    </>
  );
}
