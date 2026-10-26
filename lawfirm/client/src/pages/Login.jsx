import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, GoogleAuthProvider, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PasswordField } from '../components/ui';
import { useT } from '../i18n/I18nProvider';
import { homeFor } from '../components/ProtectedRoute';
import '../styles/auth.css';

const CODES = {
  'auth/invalid-credential': 'auth.invalid', 'auth/user-not-found': 'auth.invalid', 'auth/wrong-password': 'auth.invalid',
  'auth/email-already-in-use': 'auth.inUse', 'auth/weak-password': 'auth.weak', 'auth/invalid-email': 'auth.badEmail',
  'auth/too-many-requests': 'auth.tooMany', 'auth/popup-closed-by-user': 'auth.popup', 'auth/user-disabled': 'auth.disabled',
};
const friendly = (e, t) => (CODES[e.code] ? t(CODES[e.code]) : e.message || t('auth.generic'));

const CardBackground = ({ activeView }) => <div className={`card-bg ${activeView === 'login' ? 'login' : ''}`} />;

const HeroPanel = ({ type, activeView, title, text, buttonText, onToggle }) => (
  <div className={`hero ${type} ${activeView === type ? 'active' : ''}`}>
    <img src="/logo-mark.png" alt="" />
    <h2>{title}</h2>
    <p>{text}</p>
    <button type="button" onClick={onToggle}>{buttonText}</button>
  </div>
);

const GoogleButton = ({ onClick, disabled }) => {
  const t = useT();
  return (
  <>
    <div className="sso">
      <button type="button" onClick={onClick} disabled={disabled}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.100 3.600l6.800-6.800C35.800 2.400 30.300 0 24 0 14.600 0 6.500 5.400 2.600 13.200l7.900 6.100C12.400 13.600 17.700 9.500 24 9.500z" /><path fill="#4285F4" d="M46.500 24.500c0-1.600-.1-3.100-.4-4.500H24v9h12.700c-.6 3-2.300 5.500-4.800 7.200l7.500 5.800c4.400-4.100 7.100-10.100 7.100-17.500z" /><path fill="#FBBC05" d="M10.500 28.700A14.500 14.500 0 0 1 9.500 24c0-1.600.3-3.200.8-4.700l-7.900-6.100A24 24 0 0 0 0 24c0 3.900.9 7.500 2.600 10.800l7.900-6.100z" /><path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.500-5.800c-2.100 1.400-4.800 2.300-8.400 2.300-6.300 0-11.600-4.100-13.500-9.800l-7.900 6.100C6.500 42.600 14.600 48 24 48z" /></svg>
        {t('auth.google')}
      </button>
    </div>
    <div className="divider">{t('auth.or')}</div>
  </>
  );
};

export default function Login({ mode = 'client' }) {
  const t = useT();
  const isStaff = mode === 'staff';
  const [activeView, setActiveView] = useState('login');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const { refresh } = useAuth();
  const nav = useNavigate();
  const from = useLocation().state?.from;
  const toggleView = () => { setError(''); setInfo(''); setActiveView((v) => (v === 'login' ? 'register' : 'login')); };

  async function finish(expectStaff) {
    let role = await refresh();
    if (!role && !expectStaff) { // account created but profile step failed earlier – complete it now
      const u = auth.currentUser;
      await api('/auth/register-client', { method: 'POST', body: { name: u.displayName || u.email.split('@')[0] } });
      role = await refresh();
    }
    if (isStaff && role === 'client') { await signOut(auth); throw new Error(t('auth.staffOnly')); }
    if (!isStaff && (role === 'staff' || role === 'admin')) return nav('/app', { replace: true });
    if (!role) throw new Error(t('auth.notSetup'));
    nav(from && from.startsWith(homeFor(role)) ? from : homeFor(role), { replace: true });
  }

  const guard = (fn) => async (e) => {
    e?.preventDefault?.(); setError(''); setInfo(''); setBusy(true);
    try { await fn(e && e.currentTarget && e.currentTarget.elements ? new FormData(e.currentTarget) : null); }
    catch (err) { setError(friendly(err, t)); } finally { setBusy(false); }
  };

  const onLogin = guard(async (f) => {
    await signInWithEmailAndPassword(auth, f.get('email').trim(), f.get('password'));
    await finish(isStaff);
  });
  const onRegister = guard(async (f) => {
    const cred = await createUserWithEmailAndPassword(auth, f.get('email').trim(), f.get('password'));
    try {
      if (isStaff) await api('/auth/register-staff', { method: 'POST', body: { name: f.get('name'), code: f.get('code'), title: f.get('title') || undefined } });
      else await api('/auth/register-client', { method: 'POST', body: { name: f.get('name'), phone: f.get('phone') || undefined } });
    } catch (err) {
      await cred.user.delete().catch(() => {}); // no half-created accounts (e.g. a bad invite code)
      throw err;
    }
    await finish(isStaff);
  });
  const onGoogle = guard(async () => { await signInWithPopup(auth, new GoogleAuthProvider()); await finish(false); });
  const onReset = async () => {
    const email = document.querySelector('.form.login input[name=email]')?.value?.trim();
    if (!email) return setError(t('auth.enterEmail'));
    setError('');
    try { await sendPasswordResetEmail(auth, email); } catch { /* do not reveal whether the account exists */ }
    setInfo(t('auth.resetSent'));
  };

  const messages = (
    <>{error && <div className="alert bad" role="alert">{error}</div>}{info && <div className="alert ok" role="status">{info}</div>}</>
  );

  return (
    <div className="auth-page">
      <div className="auth-top">
        <Link to="/">{t('auth.back')}</Link>
        {isStaff && <Link to="/login">{t('auth.clientPortal')}</Link>}
      </div>
      <div className="card-auth">
        <CardBackground activeView={activeView} />
        <HeroPanel type="register" activeView={activeView} title={t('auth.welcomeBack')}
          text={isStaff ? t('auth.welcomeStaff') : t('auth.welcomeClient')} buttonText={t('auth.loginBtn')} onToggle={toggleView} />

        <div className={`form register ${activeView === 'register' ? 'active' : ''}`}>
          <h2>{isStaff ? t('auth.joinTeam') : t('auth.createAccount')}</h2>
          {!isStaff && <GoogleButton onClick={onGoogle} disabled={busy} />}
          <form onSubmit={onRegister}>
            <input className="input" name="name" placeholder={t('auth.fullName')} autoComplete="name" required minLength={2} maxLength={80} aria-label={t('auth.fullName')} />
            <input className="input" type="email" name="email" placeholder={t('auth.emailAddress')} autoComplete="email" required aria-label={t('auth.emailAddress')} />
            {!isStaff && <input className="input" type="tel" name="phone" placeholder={t('auth.phoneOpt')} autoComplete="tel" maxLength={30} aria-label={t('auth.phone')} />}
            {isStaff && <input className="input" name="title" placeholder={t('auth.jobTitlePh')} maxLength={80} aria-label={t('auth.jobTitle')} />}
            {isStaff && <input className="input" name="code" placeholder={t('auth.codePh')} required autoComplete="off" aria-label={t('auth.code')} />}
            <PasswordField name="password" placeholder={t('auth.passwordNew')} autoComplete="new-password" required minLength={8} aria-label={t('auth.password')} />
            {activeView === 'register' && messages}
            <button className="btn btn-gold" disabled={busy}>{busy ? t('auth.wait') : t('auth.signupBtn')}</button>
          </form>
          <p className="alt mobile-toggle">{t('auth.already')} <button className="link" type="button" onClick={toggleView}>{t('auth.login')}</button></p>
        </div>

        <HeroPanel type="login" activeView={activeView} title={isStaff ? t('auth.helloColleague') : t('auth.helloThere')}
          text={isStaff ? t('auth.newStaff') : t('auth.newClient')} buttonText={t('auth.signupBtn')} onToggle={toggleView} />

        <div className={`form login ${activeView === 'login' ? 'active' : ''}`}>
          <h2>{isStaff ? t('auth.teamLogin') : t('auth.login')}</h2>
          {!isStaff && <GoogleButton onClick={onGoogle} disabled={busy} />}
          <form onSubmit={onLogin}>
            <input className="input" type="email" name="email" placeholder={t('auth.email')} autoComplete="email" required aria-label={t('auth.email')} />
            <PasswordField name="password" placeholder={t('auth.password')} autoComplete="current-password" required aria-label={t('auth.password')} />
            <button className="link alt" type="button" onClick={onReset} style={{ justifySelf: 'center' }}>{t('auth.forgot')}</button>
            {activeView === 'login' && messages}
            <button className="btn btn-gold" disabled={busy}>{busy ? t('auth.wait') : t('auth.loginBtn')}</button>
          </form>
          <p className="alt mobile-toggle">{t('auth.newHere')} <button className="link" type="button" onClick={toggleView}>{t('auth.create')}</button></p>
        </div>
      </div>
    </div>
  );
}
