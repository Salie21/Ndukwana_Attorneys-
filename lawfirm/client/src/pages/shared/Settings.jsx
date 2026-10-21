import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { Moon, Sun } from 'lucide-react';
import { auth } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/Shell';
import { useAction, useToast } from '../../components/ui';

const TITLES = { profile: 'My details', notifications: 'Notifications', appearance: 'Appearance', security: 'Security' };

function Details() {
  const { profile } = useAuth(); const [run, busy] = useAction();
  const save = (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); return run(() => api('/profile/me', { method: 'PATCH', body: { name: f.get('name'), phone: f.get('phone') } }), 'Details saved'); };
  return (
    <form className="card stack" style={{ maxWidth: 520 }} onSubmit={save}>
      <label className="field"><span>Full name</span><input className="input" name="name" defaultValue={profile?.name} required minLength={2} maxLength={80} /></label>
      <label className="field"><span>Email</span><input className="input" value={profile?.email || ''} disabled /></label>
      <label className="field"><span>Phone</span><input className="input" name="phone" type="tel" defaultValue={profile?.phone} maxLength={30} /></label>
      <button className="btn btn-gold" disabled={busy}>Save changes</button>
    </form>
  );
}

function Notif() {
  const { profile } = useAuth(); const toast = useToast(); const [run] = useAction();
  const on = !!profile?.prefs?.browserAlerts && typeof Notification !== 'undefined' && Notification.permission === 'granted';
  const toggle = async () => {
    if (typeof Notification === 'undefined') return toast('This browser does not support alerts.', 'bad');
    if (!on) {
      const p = await Notification.requestPermission();
      if (p !== 'granted') return toast('Allow notifications in your browser settings to turn this on.', 'bad');
    }
    run(() => api('/profile/me', { method: 'PATCH', body: { prefs: { browserAlerts: !on } } }), on ? 'Browser alerts off' : 'Browser alerts on');
  };
  return (
    <div className="card stack" style={{ maxWidth: 560 }}>
      <h3>Alerts</h3>
      <p className="muted">In-app notifications are always on, so you never miss an approval, change or document. You can also get a pop-up while the website is open in this browser.</p>
      <div className="row between"><div><b>Browser alerts</b><div className="hint">Shown only while this site is open.</div></div>
        <button className={`chip ${on ? 'on' : ''}`} role="switch" aria-checked={on} onClick={toggle}>{on ? 'On' : 'Off'}</button></div>
    </div>
  );
}

function Appearance() {
  const { profile, setTheme } = useAuth(); const [run] = useAction();
  const cur = document.documentElement.dataset.theme || 'light';
  const pick = (t) => { setTheme(t); document.documentElement.dataset.theme = t; run(() => api('/profile/me', { method: 'PATCH', body: { prefs: { theme: t } } })); };
  return (
    <div className="card stack" style={{ maxWidth: 520 }}>
      <h3>Theme</h3>
      <div className="row wrap">
        <button className={`pick ${cur === 'light' ? 'on' : ''}`} style={{ width: 'auto' }} onClick={() => pick('light')}><Sun size={18} />Light</button>
        <button className={`pick ${cur === 'dark' ? 'on' : ''}`} style={{ width: 'auto' }} onClick={() => pick('dark')}><Moon size={18} />Dark</button>
      </div>
      <p className="hint">{profile?.prefs?.theme ? 'Saved to your account.' : 'Default for your role.'}</p>
    </div>
  );
}

function Security() {
  const { user, logout } = useAuth(); const [run, busy] = useAction(); const toast = useToast();
  const hasPassword = user.providerData.some((p) => p.providerId === 'password');
  const change = async (e) => {
    e.preventDefault(); const f = new FormData(e.currentTarget); const form = e.currentTarget;
    if (f.get('next') !== f.get('again')) return toast('The new passwords do not match.', 'bad');
    const ok = await run(async () => {
      await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(user.email, f.get('current')));
      await updatePassword(auth.currentUser, f.get('next'));
    }, 'Password changed');
    if (ok) form.reset();
  };
  const everywhere = async () => { if (!confirm('Sign out on every device, including this one?')) return; await run(() => api('/profile/revoke-sessions', { method: 'POST' })); logout(); };
  return (
    <div className="stack" style={{ maxWidth: 520 }}>
      {hasPassword ? (
        <form className="card stack" onSubmit={change}>
          <h3>Change password</h3>
          <input className="input" type="password" name="current" placeholder="Current password" autoComplete="current-password" required aria-label="Current password" />
          <input className="input" type="password" name="next" placeholder="New password (8+ characters)" autoComplete="new-password" required minLength={8} aria-label="New password" />
          <input className="input" type="password" name="again" placeholder="Repeat new password" autoComplete="new-password" required minLength={8} aria-label="Repeat new password" />
          <button className="btn btn-gold" disabled={busy}>Update password</button>
        </form>
      ) : <div className="card"><h3>Password</h3><p className="muted">You sign in with Google, so your password is managed by your Google account.</p></div>}
      <div className="card stack"><h3>Devices</h3><p className="muted">Sign out everywhere if you lost a device or used a shared computer.</p><button className="btn btn-danger" onClick={everywhere} disabled={busy}>Sign out of all devices</button></div>
    </div>
  );
}

export default function Settings() {
  const { tab } = useParams(); const { role } = useAuth();
  if (!TITLES[tab] || (tab === 'profile' && role !== 'client')) return <Navigate to="notifications" replace />;
  const Body = { profile: Details, notifications: Notif, appearance: Appearance, security: Security }[tab];
  return (<><PageHeader title={TITLES[tab]} sub="Settings" /><Body /></>);
}
