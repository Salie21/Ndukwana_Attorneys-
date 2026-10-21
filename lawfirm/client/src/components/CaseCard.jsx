import { useState } from 'react';
import { collection } from 'firebase/firestore';
import { db } from '../firebase';
import { useLive } from '../lib/useLive';
import { api } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import { Modal, Status, useAction } from './ui';

// One consultation as seen by staff or a supervisor: approve, decline, complete, cancel, reassign.
export default function CaseCard({ a, admin = false }) {
  const [run, busy] = useAction();
  const [declining, setDeclining] = useState(false);
  const [reassign, setReassign] = useState(false);
  const [note, setNote] = useState('');
  const [target, setTarget] = useState('');
  const team = useLive(() => (reassign ? collection(db, 'team') : null), [reassign]);

  const status = (s, n) => run(() => api(`/appointments/${a.id}/status`, { method: 'PATCH', body: { status: s, note: n || undefined } }), `Consultation ${s}`);
  const cancel = () => confirm('Cancel this consultation? The client will be notified.') && run(() => api(`/appointments/${a.id}/cancel`, { method: 'PATCH', body: {} }), 'Consultation cancelled');
  const doReassign = async () => { if (await run(() => api(`/appointments/${a.id}/reassign`, { method: 'PATCH', body: { staffId: target } }), 'Reassigned')) setReassign(false); };
  const open = ['pending', 'approved'].includes(a.status);

  return (
    <div className="card">
      <div className="card-head"><div><h3 style={{ fontSize: '1.35rem' }}>{a.clientName}</h3><div className="muted">{a.caseLabel}{admin ? `, with ${a.staffName}` : ''}</div></div><Status value={a.status} /></div>
      <p><b>{fmtDateTime(a.startsAt)}</b></p>
      <p className="muted" style={{ margin: '8px 0 14px', overflowWrap: 'anywhere' }}>{a.description}</p>
      <div className="row wrap">
        {a.status === 'pending' && <><button className="btn btn-gold btn-sm" disabled={busy} onClick={() => status('approved')}>Approve</button>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setDeclining(true)}>Decline</button></>}
        {a.status === 'approved' && <button className="btn btn-gold btn-sm" disabled={busy} onClick={() => status('completed')}>Mark completed</button>}
        {open && admin && <button className="btn btn-ghost btn-sm" onClick={() => setReassign(true)}>Reassign</button>}
        {open && <button className="btn btn-danger btn-sm" disabled={busy} onClick={cancel}>Cancel</button>}
      </div>
      {declining && (
        <Modal title="Decline consultation" onClose={() => setDeclining(false)}>
          <label className="field"><span>Message for the client (optional)</span><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} style={{ minHeight: 80 }} placeholder="e.g. I am in court that morning. Please pick another time." /></label>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="btn btn-ghost" onClick={() => setDeclining(false)}>Back</button>
            <button className="btn btn-danger" disabled={busy} onClick={async () => { if (await status('declined', note)) setDeclining(false); }}>Decline</button>
          </div>
        </Modal>
      )}
      {reassign && (
        <Modal title="Reassign consultation" onClose={() => setReassign(false)}>
          <label className="field"><span>New attorney (the time slot must be free for them)</span>
            <select className="select" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Select a team member</option>
              {team.data.filter((m) => m.status === 'active' && m.id !== a.staffId).map((m) => <option key={m.id} value={m.id}>{m.name}{m.title ? `, ${m.title}` : ''}</option>)}
            </select></label>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="btn btn-ghost" onClick={() => setReassign(false)}>Back</button>
            <button className="btn btn-gold" disabled={busy || !target} onClick={doReassign}>Reassign</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
