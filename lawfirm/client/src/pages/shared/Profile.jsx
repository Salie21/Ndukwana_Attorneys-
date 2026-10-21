import { useRef, useState } from 'react';
import { collection } from 'firebase/firestore';
import { Camera } from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useLive } from '../../lib/useLive';
import { api } from '../../lib/api';
import { CASE_TYPES, caseLabel } from '../../lib/firm';
import { resizeImage } from '../../lib/format';
import { PageHeader } from '../../components/Shell';
import { Avatar, Loading, Status, useAction, useToast } from '../../components/ui';

export default function Profile() {
  const { profile, user } = useAuth();
  const toast = useToast(); const [run, busy] = useAction();
  const fileRef = useRef(null);
  const [specs, setSpecs] = useState(null);
  const [bookable, setBookable] = useState(null);
  const team = useLive(() => collection(db, 'team'), []);
  const mySpecs = specs ?? profile?.specialties ?? [];
  const myBookable = bookable ?? profile?.bookable !== false;

  const save = (e) => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    return run(() => api('/profile/me', { method: 'PATCH', body: { name: f.get('name'), title: f.get('title'), phone: f.get('phone'), bio: f.get('bio'), specialties: mySpecs, bookable: myBookable } }), 'Profile saved');
  };
  const onAvatar = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try { const avatar = await resizeImage(file); await run(() => api('/profile/me', { method: 'PATCH', body: { avatar } }), 'Photo updated'); }
    catch (err) { toast(err.message, 'bad'); } finally { e.target.value = ''; }
  };
  const toggle = (id) => setSpecs(mySpecs.includes(id) ? mySpecs.filter((s) => s !== id) : [...mySpecs, id]);

  return (
    <>
      <PageHeader title="Profile" sub="This is how your colleagues, and clients booking you, see you." />
      <div className="grid" style={{ gap: 22 }}>
        <form className="card stack" onSubmit={save}>
          <div className="profile-hero">
            <div style={{ position: 'relative' }}>
              <Avatar src={profile?.avatar} name={profile?.name} size={96} />
              <button type="button" className="icon-btn" style={{ position: 'absolute', right: -6, bottom: -6, background: 'var(--gold)', color: '#1a2238' }} onClick={() => fileRef.current.click()} aria-label="Change photo"><Camera size={16} /></button>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onAvatar} />
            </div>
            <div><h3>{profile?.name}</h3><p className="muted">{user.email}</p></div>
          </div>
          <div className="grid cols-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <label className="field"><span>Full name</span><input className="input" name="name" defaultValue={profile?.name} required minLength={2} maxLength={80} /></label>
            <label className="field"><span>Job title</span><input className="input" name="title" defaultValue={profile?.title} maxLength={80} placeholder="e.g. Candidate attorney" /></label>
            <label className="field"><span>Phone</span><input className="input" name="phone" type="tel" defaultValue={profile?.phone} maxLength={30} /></label>
          </div>
          <label className="field"><span>Short bio (shown to clients when they choose an attorney)</span><textarea className="textarea" name="bio" defaultValue={profile?.bio} maxLength={600} style={{ minHeight: 90 }} /></label>
          <div className="field"><span>Case types you handle</span>
            <div className="chips">{CASE_TYPES.filter((c) => c.id !== 'other').map((c) => <button type="button" key={c.id} className={`chip ${mySpecs.includes(c.id) ? 'on' : ''}`} aria-pressed={mySpecs.includes(c.id)} onClick={() => toggle(c.id)}>{c.label}</button>)}</div>
            <span className="hint">Clients only see you when they pick one of these case types.</span>
          </div>
          <label className="row"><input type="checkbox" checked={myBookable} onChange={(e) => setBookable(e.target.checked)} /><span>Clients can book consultations with me</span></label>
          <div><button className="btn btn-gold" disabled={busy}>Save profile</button></div>
        </form>

        <div className="card" id="team">
          <div className="card-head"><h3>Team members</h3><span className="muted small">{team.data.length} in the workspace</span></div>
          {team.loading ? <Loading /> : (
            <div className="grid cols-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {team.data.map((m) => (
                <div key={m.id} className="member">
                  <Avatar src={m.avatar} name={m.name} size={48} />
                  <div style={{ minWidth: 0 }}>
                    <b>{m.name}</b>
                    <div className="muted small">{m.title || (m.role === 'admin' ? 'Supervisor' : 'Staff')}</div>
                    {(m.specialties || []).length > 0 && <div className="muted small">{m.specialties.map(caseLabel).join(', ')}</div>}
                  </div>
                  {m.status === 'disabled' && <Status value="disabled" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
