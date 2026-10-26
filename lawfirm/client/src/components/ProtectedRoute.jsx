import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './ui';
import { useT } from '../i18n/I18nProvider';

export const homeFor = (role) => (role === 'client' ? '/portal' : role === 'staff' || role === 'admin' ? '/app' : '/');

// UI-level guard only. Real enforcement happens in Firestore rules and the Express API.
export default function ProtectedRoute({ allow, loginPath }) {
  const { user, role, loading, logout } = useAuth();
  const t = useT();
  const loc = useLocation();
  if (loading) return <div className="center-screen"><Spinner /></div>;
  if (!user) return <Navigate to={loginPath} replace state={{ from: loc.pathname }} />;
  if (!role) {
    return (
      <div className="center-screen"><div className="card stack" style={{ maxWidth: 420, textAlign: 'center' }}>
        <h3>{t('guard.title')}</h3>
        <p className="muted">{t('guard.body')}</p>
        <button className="btn btn-ghost" onClick={logout}>{t('guard.signout')}</button>
      </div></div>
    );
  }
  if (!allow.includes(role)) return <Navigate to={homeFor(role)} replace />;
  return <Outlet />;
}
