import { useState } from 'react';
import { collection } from 'firebase/firestore';
import { db } from '../firebase';
import { useLive } from '../lib/useLive';
import { api } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import { Modal, Status, useAction } from './ui';
import Select from './Select';
import { useT } from '../i18n/I18nProvider';
import { apptCase } from '../lib/firm';

// One consultation as seen by staff or a supervisor: approve, decline, complete, cancel, reassign.
export default function CaseCard({ a, admin = false }) {
  const t = useT();
  const [run, busy] = useAction();
  const [declining, setDeclining] = useState(false);
  const [reassign, setReassign] = useState(false);
  const [note, setNote] = useState('');
  const [target, setTarget] = useState('');
  const team = useLive(() => (reassign ? collection(db, 'team') : null), [reassign]);

  const status = (s, n) => run(() => api(`/appointments/${a.id}/status`, { method: 'PATCH', body: { status: s, note: n || undefined } }), t(`card.done${s[0].toUpperCase()}${s.slice(1)}`));
  const cancel = () => confirm(t('card.confirmCancel')) && run(() => api(`/appointments/${a.id}/cancel`, { method: 'PATCH', body: {} }), t('card.doneCancelled'));
  const doReassign = async () => { if (await run(() => api(`/appointments/${a.id}/reassign`, { method: 'PATCH', body: { staffId: target } }), t('card.doneReassigned'))) setReassign(false); };
  const open = ['pending', 'approved'].includes(a.status);

  return (
    <div className="card">
      <div className="card-head"><div><h3 style={{ fontSize: '1.35rem' }}>{a.clientName}</h3><div className="muted">{admin ? t('card.with', { type: apptCase(t, a), staff: a.staffName }) : apptCase(t, a)}</div></div><Status value={a.status} /></div>
      <p><b>{fmtDateTime(a.startsAt)}</b></p>
      <p className="muted" style={{ margin: '8px 0 14px', overflowWrap: 'anywhere' }}>{a.description}</p>
      <div className="row wrap">
        {a.status === 'pending' && <><button className="btn btn-gold btn-sm" disabled={busy} onClick={() => status('approved')}>{t('card.approve')}</button>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setDeclining(true)}>{t('card.decline')}</button></>}
        {a.status === 'approved' && <button className="btn btn-gold btn-sm" disabled={busy} onClick={() => status('completed')}>{t('card.complete')}</button>}
        {open && admin && <button className="btn btn-ghost btn-sm" onClick={() => setReassign(true)}>{t('card.reassign')}</button>}
        {open && <button className="btn btn-danger btn-sm" disabled={busy} onClick={cancel}>{t('card.cancel')}</button>}
      </div>
      {declining && (
        <Modal title={t('card.declineTitle')} onClose={() => setDeclining(false)}>
          <label className="field"><span>{t('card.declineNote')}</span><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} style={{ minHeight: 80 }} placeholder={t('card.declinePh')} /></label>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="btn btn-ghost" onClick={() => setDeclining(false)}>{t('common.back')}</button>
            <button className="btn btn-danger" disabled={busy} onClick={async () => { if (await status('declined', note)) setDeclining(false); }}>{t('card.decline')}</button>
          </div>
        </Modal>
      )}
      {reassign && (
        <Modal title={t('card.reassignTitle')} onClose={() => setReassign(false)}>
          <label className="field"><span>{t('card.newAttorney')}</span>
            <Select value={target} onChange={setTarget} placeholder={t('card.selectMember')} options={team.data.filter((m) => m.status === 'active' && m.id !== a.staffId).map((m) => ({ value: m.id, label: `${m.name}${m.title ? `, ${m.title}` : ''}` }))} /></label>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="btn btn-ghost" onClick={() => setReassign(false)}>{t('common.back')}</button>
            <button className="btn btn-gold" disabled={busy || !target} onClick={doReassign}>{t('card.reassign')}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
