import { useEffect, useState } from 'react';
import { collection } from 'firebase/firestore';
import { Copy } from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useLive } from '../../lib/useLive';
import { api } from '../../lib/api';
import { CASE_TYPES, caseLabel } from '../../lib/firm';
import { fmtDate } from '../../lib/format';
import { PageHeader } from '../../components/Shell';
import { Avatar, Loading, Modal, Status, useAction, useToast } from '../../components/ui';

export default function People() {
  const { user } = useAuth();
  const toast = useToast();
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
  const revoke = async (id) => { if (await run(() => api(`/admin/invites/${id}`, { method: 'DELETE' }), 'Invite revoked')) loadInvites(); };
  const setStatus = (m, status) => confirm(`${status === 'disabled' ? 'Deactivate' : 'Reactivate'} ${m.name}?`) && run(() => api(`/admin/users/${m.id}`, { method: 'PATCH', body: { status } }), 'Updated');
  const saveSpecs = async () => { if (await run(() => api(`/admin/users/${editing.id}`, { method: 'PATCH', body: { specialties: specs } }), 'Case types saved')) setEditing(null); };

  return (
    <>
      <PageHeader title="Team and invites" sub="Staff can only sign up with a one-time invite code from you." />
      <div className="grid" style={{ gap: 22 }}>
        <div className="grid cols-2" style={{ alignItems: 'start' }}>
          <form className="card stack" onSubmit={createInvite}>
            <h3>Invite someone</h3>
            <label className="field"><span>Role</span><select className="select" name="role" defaultValue="staff"><option value="staff">Staff member</option><option value="admin">Supervisor (full access)</option></select></label>
            <label className="field"><span>Their email (optional, locks the code to that address)</span><input className="input" type="email" name="email" maxLength={120} /></label>
            <label className="field"><span>Note to yourself (optional)</span><input className="input" name="note" maxLength={120} placeholder="e.g. Candidate attorney, starts 1 Nov" /></label>
            <button className="btn btn-gold" disabled={busy}>Create invite code</button>
            <p className="hint">Codes work once and expire after 7 days. Send the code privately, then they sign up at the team sign-in page.</p>
          </form>
          <div className="card">
            <div className="card-head"><h3>Invites</h3></div>
            {!invites ? <Loading /> : invites.length === 0 ? <p className="muted">No invites yet.</p> : (
              <div className="list">{invites.slice(0, 8).map((i) => {
                const state = i.used ? 'completed' : i.revoked ? 'cancelled' : i.expiresAt < Date.now() ? 'declined' : 'pending';
                return <div key={i.id} className="list-item"><div className="grow"><b>{i.role === 'admin' ? 'Supervisor' : 'Staff'}{i.note ? `, ${i.note}` : ''}</b><div className="muted small">{i.email || 'Any email'}. Created {fmtDate(i.createdAt)}</div></div>
                  <Status value={state} />{state === 'pending' && <button className="btn btn-ghost btn-sm" onClick={() => revoke(i.id)} disabled={busy}>Revoke</button>}</div>;
              })}</div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Team members</h3></div>
          {team.loading ? <Loading /> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Name</th><th>Role</th><th>Case types</th><th>Status</th><th /></tr></thead>
              <tbody>{team.data.map((m) => (
                <tr key={m.id}>
                  <td><div className="row"><Avatar src={m.avatar} name={m.name} size={34} /><div><b>{m.name}</b><div className="muted small">{m.title}</div></div></div></td>
                  <td>{m.role === 'admin' ? 'Supervisor' : 'Staff'}</td>
                  <td className="small">{(m.specialties || []).map(caseLabel).join(', ') || <span className="muted">None set</span>}</td>
                  <td><Status value={m.status} /></td>
                  <td><div className="row wrap">
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(m); setSpecs(m.specialties || []); }}>Case types</button>
                    {m.id !== user.uid && (m.status === 'active' ? <button className="btn btn-danger btn-sm" onClick={() => setStatus(m, 'disabled')} disabled={busy}>Deactivate</button> : <button className="btn btn-ghost btn-sm" onClick={() => setStatus(m, 'active')} disabled={busy}>Reactivate</button>)}
                  </div></td>
                </tr>))}</tbody>
            </table></div>
          )}
        </div>
      </div>
      {code && (
        <Modal title="Invite code created" onClose={() => setCode(null)}>
          <p className="muted">Copy it now. For security it cannot be shown again.</p>
          <div className="alert" style={{ fontSize: '1.5rem', letterSpacing: '0.1em', textAlign: 'center', margin: '14px 0', fontWeight: 800 }}>{code}</div>
          <button className="btn btn-gold" onClick={() => navigator.clipboard.writeText(code).then(() => toast('Code copied'))}><Copy size={16} />Copy code</button>
        </Modal>
      )}
      {editing && (
        <Modal title={`Case types for ${editing.name}`} onClose={() => setEditing(null)}>
          <div className="chips">{CASE_TYPES.filter((c) => c.id !== 'other').map((c) => <button type="button" key={c.id} className={`chip ${specs.includes(c.id) ? 'on' : ''}`} aria-pressed={specs.includes(c.id)} onClick={() => setSpecs(specs.includes(c.id) ? specs.filter((s) => s !== c.id) : [...specs, c.id])}>{c.label}</button>)}</div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}><button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn btn-gold" onClick={saveSpecs} disabled={busy}>Save</button></div>
        </Modal>
      )}
    </>
  );
}
