import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './ui';

export const homeFor = (role) => (role === 'client' ? '/portal' : role === 'staff' || role === 'admin' ? '/app' : '/');

// UI-level guard only. Real enforcement happens in Firestore rules and the Express API.
export default function ProtectedRoute({ allow, loginPath }) {
  const { user, role, loading, logout } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="center-screen"><Spinner /></div>;
  if (!user) return <Navigate to={loginPath} replace state={{ from: loc.pathname }} />;
  if (!role) {
    return (
      <div className="center-screen"><div className="card stack" style={{ maxWidth: 420, textAlign: 'center' }}>
        <h3>Finishing your account</h3>
        <p className="muted">Your account is not set up yet. If you were invited as a team member, use the invite code on the team sign-up page.</p>
        <button className="btn btn-ghost" onClick={logout}>Sign out</button>
      </div></div>
    );
  }
  if (!allow.includes(role)) return <Navigate to={homeFor(role)} replace />;
  return <Outlet />;
}
