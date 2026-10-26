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
import { useT } from '../../i18n/I18nProvider';
import { apptCase } from '../../lib/firm';

export default function Appointments() {
  const { user } = useAuth();
  const t = useT();
  const [run, busy] = useAction();
  const [resched, setResched] = useState(null);
  const [slot, setSlot] = useState({ date: '', hour: null });
  const [filter, setFilter] = useState('open');
  const { data, loading } = useLive(() => query(collection(db, 'appointments'), where('clientId', '==', user.uid)), [user.uid]);

  const open = (a) => ['pending', 'approved'].includes(a.status);
  const list = data.filter((a) => (filter === 'open' ? open(a) : !open(a))).sort((a, b) => millis(b.startsAt) - millis(a.startsAt));

  const cancel = (a) => confirm(t('appt.confirmCancel')) && run(() => api(`/appointments/${a.id}/cancel`, { method: 'PATCH', body: {} }), t('appt.cancelled'));
  const doResched = async () => {
    const ok = await run(() => api(`/appointments/${resched.id}/reschedule`, { method: 'PATCH', body: { date: slot.date, hour: slot.hour } }), t('appt.rescheduled'));
    if (ok) setResched(null);
  };

  return (
    <>
      <PageHeader title={t('appt.title')} sub={t('appt.sub')}>
        <Link className="btn btn-gold btn-sm" to="/portal/book">{t('appt.new')}</Link>
      </PageHeader>
      <div className="tabs">
        <button className={`tab ${filter === 'open' ? 'on' : ''}`} onClick={() => setFilter('open')}>{t('appt.upcoming')}</button>
        <button className={`tab ${filter === 'past' ? 'on' : ''}`} onClick={() => setFilter('past')}>{t('appt.past')}</button>
      </div>
      {loading ? <Loading /> : list.length === 0 ? (
        <div className="card"><Empty title={filter === 'open' ? t('appt.noneUpcoming') : t('appt.noneYet')}>{filter === 'open' && <Link className="btn btn-gold" to="/portal/book">{t('ov.book')}</Link>}</Empty></div>
      ) : (
        <div className="grid">{list.map((a) => (
          <div className="card" key={a.id}>
            <div className="card-head"><div><h3 style={{ fontSize: '1.35rem' }}>{apptCase(t, a)}</h3><div className="muted">{t('appt.with', { staff: a.staffName })}</div></div><Status value={a.status} /></div>
            <p><b>{fmtDateTime(a.startsAt)}</b></p>
            <p className="muted" style={{ margin: '8px 0 14px', overflowWrap: 'anywhere' }}>{a.description}</p>
            {a.statusNote && <p className="alert" style={{ marginBottom: 12 }}>{t('appt.note', { note: a.statusNote })}</p>}
            <div className="row wrap">
              {open(a) && <><button className="btn btn-ghost btn-sm" onClick={() => { setResched(a); setSlot({ date: '', hour: null }); }}>{t('appt.reschedule')}</button>
                <button className="btn btn-danger btn-sm" onClick={() => cancel(a)} disabled={busy}>{t('appt.cancel')}</button></>}
              <Link className="btn btn-ghost btn-sm" to="/portal/documents">{t('appt.upload')}</Link>
            </div>
          </div>
        ))}</div>
      )}
      {resched && (
        <Modal title={t('appt.reschedTitle')} onClose={() => setResched(null)}>
          <p className="muted" style={{ marginBottom: 12 }}>{t('appt.current', { when: fmtDateTime(resched.startsAt), staff: resched.staffName })}</p>
          <SlotPicker staffId={resched.staffId} value={slot} onChange={setSlot} />
          <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setResched(null)}>{t('appt.keep')}</button>
            <button className="btn btn-gold" onClick={doResched} disabled={busy || slot.hour == null}>{t('appt.confirmNew')}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
