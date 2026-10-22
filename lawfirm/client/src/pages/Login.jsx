import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, GoogleAuthProvider, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PasswordField } from '../components/ui';
import { homeFor } from '../components/ProtectedRoute';
import '../styles/auth.css';

const friendly = (e) => ({
  'auth/invalid-credential': 'The email or password is incorrect.',
  'auth/user-not-found': 'The email or password is incorrect.',
  'auth/wrong-password': 'The email or password is incorrect.',
  'auth/email-already-in-use': 'An account with this email already exists. Log in instead.',
  'auth/weak-password': 'Use a password with at least 8 characters.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/user-disabled': 'This account has been deactivated. Contact the firm.',
}[e.code] || e.message || 'Something went wrong. Please try again.');

const CardBackground = ({ activeView }) => <div className={`card-bg ${activeView === 'login' ? 'login' : ''}`} />;

const HeroPanel = ({ type, activeView, title, text, buttonText, onToggle }) => (
  <div className={`hero ${type} ${activeView === type ? 'active' : ''}`}>
    <img src="/logo-mark.png" alt="" />
    <h2>{title}</h2>
    <p>{text}</p>
    <button type="button" onClick={onToggle}>{buttonText}</button>
  </div>
);

const GoogleButton = ({ onClick, disabled }) => (
  <>
    <div className="sso">
      <button type="button" onClick={onClick} disabled={disabled}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.100 3.600l6.800-6.800C35.800 2.400 30.300 0 24 0 14.600 0 6.500 5.400 2.600 13.200l7.900 6.100C12.400 13.600 17.700 9.500 24 9.500z" /><path fill="#4285F4" d="M46.500 24.500c0-1.600-.1-3.100-.4-4.500H24v9h12.700c-.6 3-2.300 5.500-4.800 7.200l7.500 5.800c4.400-4.100 7.100-10.100 7.100-17.500z" /><path fill="#FBBC05" d="M10.500 28.700A14.500 14.500 0 0 1 9.500 24c0-1.600.3-3.200.8-4.700l-7.900-6.100A24 24 0 0 0 0 24c0 3.900.9 7.500 2.600 10.800l7.900-6.100z" /><path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.500-5.800c-2.100 1.400-4.800 2.300-8.400 2.300-6.300 0-11.600-4.100-13.500-9.800l-7.900 6.100C6.500 42.600 14.600 48 24 48z" /></svg>
        Continue with Google
      </button>
    </div>
    <div className="divider">or use your email address</div>
  </>
);

export default function Login({ mode = 'client' }) {
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
    if (isStaff && role === 'client') { await signOut(auth); throw new Error('This sign-in is for the firm’s team. Clients sign in on the client portal.'); }
    if (!isStaff && (role === 'staff' || role === 'admin')) return nav('/app', { replace: true });
    if (!role) throw new Error('Your account is not set up yet. Staff need an invite code from an administrator.');
    nav(from && from.startsWith(homeFor(role)) ? from : homeFor(role), { replace: true });
  }

  const guard = (fn) => async (e) => {
    e?.preventDefault?.(); setError(''); setInfo(''); setBusy(true);
    try { await fn(e && e.currentTarget && e.currentTarget.elements ? new FormData(e.currentTarget) : null); }
    catch (err) { setError(friendly(err)); } finally { setBusy(false); }
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
    if (!email) return setError('Enter your email address first, then choose “Forgot password?”.');
    setError('');
    try { await sendPasswordResetEmail(auth, email); } catch { /* do not reveal whether the account exists */ }
    setInfo('If an account exists for that email, a reset link is on its way.');
  };

  const messages = (
    <>{error && <div className="alert bad" role="alert">{error}</div>}{info && <div className="alert ok" role="status">{info}</div>}</>
  );

  return (
    <div className="auth-page">
      <div className="auth-top">
        <Link to="/">← Back to website</Link>
        {isStaff ? <Link to="/login">Client portal</Link> : <Link to="/staff">Team sign in</Link>}
      </div>
      <div className="card-auth">
        <CardBackground activeView={activeView} />
        <HeroPanel type="register" activeView={activeView} title="Welcome back"
          text={isStaff ? 'Log in to manage consultations, cases and your team.' : 'Log in to review your consultations, documents and updates.'} buttonText="LOG IN" onToggle={toggleView} />

        <div className={`form register ${activeView === 'register' ? 'active' : ''}`}>
          <h2>{isStaff ? 'Join the team' : 'Create account'}</h2>
          {!isStaff && <GoogleButton onClick={onGoogle} disabled={busy} />}
          <form onSubmit={onRegister}>
            <input className="input" name="name" placeholder="Full name" autoComplete="name" required minLength={2} maxLength={80} aria-label="Full name" />
            <input className="input" type="email" name="email" placeholder="Email address" autoComplete="email" required aria-label="Email address" />
            {!isStaff && <input className="input" type="tel" name="phone" placeholder="Phone (optional)" autoComplete="tel" maxLength={30} aria-label="Phone" />}
            {isStaff && <input className="input" name="title" placeholder="Job title (e.g. Candidate attorney)" maxLength={80} aria-label="Job title" />}
            {isStaff && <input className="input" name="code" placeholder="Invite code from your administrator" required autoComplete="off" aria-label="Invite code" />}
            <PasswordField name="password" placeholder="Password (8+ characters)" autoComplete="new-password" required minLength={8} aria-label="Password" />
            {activeView === 'register' && messages}
            <button className="btn btn-gold" disabled={busy}>{busy ? 'Please wait…' : 'SIGN UP'}</button>
          </form>
          <p className="alt mobile-toggle">Already registered? <button className="link" type="button" onClick={toggleView}>Log in</button></p>
        </div>

        <HeroPanel type="login" activeView={activeView} title={isStaff ? 'Hello, colleague' : 'Hello there'}
          text={isStaff ? 'New to the workspace? Use the invite code you were given to sign up.' : 'Create a free account to book consultations and share documents securely.'} buttonText="SIGN UP" onToggle={toggleView} />

        <div className={`form login ${activeView === 'login' ? 'active' : ''}`}>
          <h2>{isStaff ? 'Team log in' : 'Log in'}</h2>
          {!isStaff && <GoogleButton onClick={onGoogle} disabled={busy} />}
          <form onSubmit={onLogin}>
            <input className="input" type="email" name="email" placeholder="Email" autoComplete="email" required aria-label="Email" />
            <PasswordField name="password" placeholder="Password" autoComplete="current-password" required aria-label="Password" />
            <button className="link alt" type="button" onClick={onReset} style={{ justifySelf: 'center' }}>Forgot password?</button>
            {activeView === 'login' && messages}
            <button className="btn btn-gold" disabled={busy}>{busy ? 'Please wait…' : 'LOG IN'}</button>
          </form>
          <p className="alt mobile-toggle">New here? <button className="link" type="button" onClick={toggleView}>Create an account</button></p>
        </div>
      </div>
    </div>
  );
}
