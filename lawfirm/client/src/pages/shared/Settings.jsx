import { Navigate, useParams } from 'react-router-dom';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { auth } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/Shell';
import { PasswordField, useAction, useToast } from '../../components/ui';
import LanguageSelect from '../../components/LanguageSelect';
import { useT } from '../../i18n/I18nProvider';

const TITLES = { profile: 'nav.details', notifications: 'nav.notifications', security: 'nav.security' };

function Details() {
  const { profile } = useAuth(); const [run, busy] = useAction(); const t = useT();
  const save = (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); return run(() => api('/profile/me', { method: 'PATCH', body: { name: f.get('name'), phone: f.get('phone') } }), t('settings.saved')); };
  return (
    <form className="card stack" style={{ maxWidth: 520 }} onSubmit={save}>
      <label className="field"><span>{t('profile.name')}</span><input className="input" name="name" defaultValue={profile?.name} required minLength={2} maxLength={80} /></label>
      <label className="field"><span>{t('settings.email')}</span><input className="input" value={profile?.email || ''} disabled /></label>
      <label className="field"><span>{t('profile.phone')}</span><input className="input" name="phone" type="tel" defaultValue={profile?.phone} maxLength={30} /></label>
      <LanguageSelect id="details-language" />
      <button className="btn btn-gold" disabled={busy}>{t('settings.saveChanges')}</button>
    </form>
  );
}

function Notif() {
  const { profile } = useAuth(); const toast = useToast(); const [run] = useAction(); const t = useT();
  const on = !!profile?.prefs?.browserAlerts && typeof Notification !== 'undefined' && Notification.permission === 'granted';
  const toggle = async () => {
    if (typeof Notification === 'undefined') return toast(t('sec.notSupported'), 'bad');
    if (!on) {
      const p = await Notification.requestPermission();
      if (p !== 'granted') return toast(t('sec.allow'), 'bad');
    }
    run(() => api('/profile/me', { method: 'PATCH', body: { prefs: { browserAlerts: !on } } }), t(on ? 'sec.alertsOff' : 'sec.alertsOn'));
  };
  return (
    <div className="card stack" style={{ maxWidth: 560 }}>
      <h3>{t('sec.alerts')}</h3>
      <p className="muted">{t('sec.alertsBody')}</p>
      <div className="row between"><div><b>{t('sec.browserAlerts')}</b><div className="hint">{t('sec.browserHint')}</div></div>
        <button className={`chip ${on ? 'on' : ''}`} role="switch" aria-checked={on} onClick={toggle}>{on ? t('sec.on') : t('sec.off')}</button></div>
    </div>
  );
}

function Security() {
  const { user, logout } = useAuth(); const [run, busy] = useAction(); const toast = useToast(); const t = useT();
  const hasPassword = user.providerData.some((p) => p.providerId === 'password');
  const change = async (e) => {
    e.preventDefault(); const f = new FormData(e.currentTarget); const form = e.currentTarget;
    if (f.get('next') !== f.get('again')) return toast(t('sec.noMatch'), 'bad');
    const ok = await run(async () => {
      await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(user.email, f.get('current')));
      await updatePassword(auth.currentUser, f.get('next'));
    }, t('sec.changed'));
    if (ok) form.reset();
  };
  const everywhere = async () => { if (!confirm(t('sec.confirmAll'))) return; await run(() => api('/profile/revoke-sessions', { method: 'POST' })); logout(); };
  return (
    <div className="stack" style={{ maxWidth: 520 }}>
      {hasPassword ? (
        <form className="card stack" onSubmit={change}>
          <h3>{t('sec.changePw')}</h3>
          <PasswordField name="current" placeholder={t('sec.current')} autoComplete="current-password" required aria-label={t('sec.current')} />
          <PasswordField name="next" placeholder={t('sec.new')} autoComplete="new-password" required minLength={8} aria-label={t('sec.newAria')} />
          <PasswordField name="again" placeholder={t('sec.repeat')} autoComplete="new-password" required minLength={8} aria-label={t('sec.repeat')} />
          <button className="btn btn-gold" disabled={busy}>{t('sec.update')}</button>
        </form>
      ) : <div className="card"><h3>{t('sec.pwTitle')}</h3><p className="muted">{t('sec.google')}</p></div>}
      <div className="card stack"><h3>{t('sec.devices')}</h3><p className="muted">{t('sec.devicesBody')}</p><button className="btn btn-danger" onClick={everywhere} disabled={busy}>{t('sec.signOutAll')}</button></div>
    </div>
  );
}

export default function Settings() {
  const { tab } = useParams(); const { role } = useAuth(); const t = useT();
  if (!TITLES[tab] || (tab === 'profile' && role !== 'client')) return <Navigate to="notifications" replace />;
  const Body = { profile: Details, notifications: Notif, security: Security }[tab];
  return (<><PageHeader title={t(TITLES[tab])} sub={t('nav.settings')} /><Body /></>);
}
