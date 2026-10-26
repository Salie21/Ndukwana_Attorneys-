import { useEffect, useState } from 'react';
import { collection } from 'firebase/firestore';
import { Copy } from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useLive } from '../../lib/useLive';
import { api } from '../../lib/api';
import { CASE_TYPES, caseText } from '../../lib/firm';
import { fmtDate } from '../../lib/format';
import { PageHeader } from '../../components/Shell';
import { Avatar, Loading, Modal, Status, useAction, useToast } from '../../components/ui';
import Select from '../../components/Select';
import { useT } from '../../i18n/I18nProvider';

export default function People() {
  const { user } = useAuth();
  const toast = useToast();
  const t = useT();
  const [run, busy] = useAction();
  const team = useLive(() => collection(db, 'team'), []);
  const [invites, setInvites] = useState(null);
  const [code, setCode] = useState(null);
  const [editing, setEditing] = useState(null);
  const [specs, setSpecs] = useState([]);

  const loadInvites = () => api('/admin/invites').then(setInvites).catch((e) => toast(e.message, 'bad'));
  useEffect(() => { loadInvites(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const createInvite = async (e) => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const r = await run(() => api('/admin/invites', { method: 'POST', body: { role: f.get('role'), email: f.get('email') || undefined, note: f.get('note') || undefined } }));
    if (r) { setCode(r.code); loadInvites(); e.currentTarget?.reset?.(); }
  };
  const revoke = async (id) => { if (await run(() => api(`/admin/invites/${id}`, { method: 'DELETE' }), t('people.revoked'))) loadInvites(); };
  const setStatus = (m, status) => confirm(t(status === 'disabled' ? 'people.confirmDeactivate' : 'people.confirmReactivate', { name: m.name })) && run(() => api(`/admin/users/${m.id}`, { method: 'PATCH', body: { status } }), t('people.updated'));
  const saveSpecs = async () => { if (await run(() => api(`/admin/users/${editing.id}`, { method: 'PATCH', body: { specialties: specs } }), t('people.specsSaved'))) setEditing(null); };

  return (
    <>
      <PageHeader title={t('people.title')} sub={t('people.sub')} />
      <div className="grid" style={{ gap: 22 }}>
        <div className="grid cols-2" style={{ alignItems: 'start' }}>
          <form className="card stack" onSubmit={createInvite}>
            <h3>{t('people.invite')}</h3>
            <label className="field"><span>{t('people.role')}</span><Select name="role" defaultValue="staff" options={[{ value: 'staff', label: t('people.roleStaff') }, { value: 'admin', label: t('people.roleAdmin') }]} /></label>
            <label className="field"><span>{t('people.theirEmail')}</span><input className="input" type="email" name="email" maxLength={120} /></label>
            <label className="field"><span>{t('people.note')}</span><input className="input" name="note" maxLength={120} placeholder={t('people.notePh')} /></label>
            <button className="btn btn-gold" disabled={busy}>{t('people.create')}</button>
            <p className="hint">{t('people.codeHint')}</p>
          </form>
          <div className="card">
            <div className="card-head"><h3>{t('people.invites')}</h3></div>
            {!invites ? <Loading /> : invites.length === 0 ? <p className="muted">{t('people.noInvites')}</p> : (
              <div className="list">{invites.slice(0, 8).map((i) => {
                const state = i.used ? 'completed' : i.revoked ? 'cancelled' : i.expiresAt < Date.now() ? 'declined' : 'pending';
                return <div key={i.id} className="list-item"><div className="grow"><b>{i.role === 'admin' ? t('people.supervisor') : t('people.staff')}{i.note ? `, ${i.note}` : ''}</b><div className="muted small">{i.email || t('people.anyEmail')}. {t('people.created', { date: fmtDate(i.createdAt) })}</div></div>
                  <Status value={state} />{state === 'pending' && <button className="btn btn-ghost btn-sm" onClick={() => revoke(i.id)} disabled={busy}>{t('people.revoke')}</button>}</div>;
              })}</div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>{t('people.members')}</h3></div>
          {team.loading ? <Loading /> : (
            <div className="table-wrap"><table>
              <thead><tr><th>{t('people.colName')}</th><th>{t('people.colRole')}</th><th>{t('people.colCases')}</th><th>{t('people.colStatus')}</th><th /></tr></thead>
              <tbody>{team.data.map((m) => (
                <tr key={m.id}>
                  <td><div className="row"><Avatar src={m.avatar} name={m.name} size={34} /><div><b>{m.name}</b><div className="muted small">{m.title}</div></div></div></td>
                  <td>{m.role === 'admin' ? t('people.supervisor') : t('people.staff')}</td>
                  <td className="small">{(m.specialties || []).map((id) => caseText(t, id)).join(', ') || <span className="muted">{t('people.noneSet')}</span>}</td>
                  <td><Status value={m.status} /></td>
                  <td><div className="row wrap">
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(m); setSpecs(m.specialties || []); }}>{t('people.caseTypes')}</button>
                    {m.id !== user.uid && (m.status === 'active' ? <button className="btn btn-danger btn-sm" onClick={() => setStatus(m, 'disabled')} disabled={busy}>{t('people.deactivate')}</button> : <button className="btn btn-ghost btn-sm" onClick={() => setStatus(m, 'active')} disabled={busy}>{t('people.reactivate')}</button>)}
                  </div></td>
                </tr>))}</tbody>
            </table></div>
          )}
        </div>
      </div>
      {code && (
        <Modal title={t('people.codeTitle')} onClose={() => setCode(null)}>
          <p className="muted">{t('people.codeCopyNow')}</p>
          <div className="alert" style={{ fontSize: '1.5rem', letterSpacing: '0.1em', textAlign: 'center', margin: '14px 0', fontWeight: 800 }}>{code}</div>
          <button className="btn btn-gold" onClick={() => navigator.clipboard.writeText(code).then(() => toast(t('people.copied')))}><Copy size={16} />{t('people.copy')}</button>
        </Modal>
      )}
      {editing && (
        <Modal title={t('people.specsFor', { name: editing.name })} onClose={() => setEditing(null)}>
          <div className="chips">{CASE_TYPES.filter((c) => c.id !== 'other').map((c) => <button type="button" key={c.id} className={`chip ${specs.includes(c.id) ? 'on' : ''}`} aria-pressed={specs.includes(c.id)} onClick={() => setSpecs(specs.includes(c.id) ? specs.filter((s) => s !== c.id) : [...specs, c.id])}>{caseText(t, c.id)}</button>)}</div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}><button className="btn btn-ghost" onClick={() => setEditing(null)}>{t('common.cancel')}</button><button className="btn btn-gold" onClick={saveSpecs} disabled={busy}>{t('common.save')}</button></div>
        </Modal>
      )}
    </>
  );
}
