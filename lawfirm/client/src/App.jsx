import { Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import Shell from './components/Shell';
import { Spinner } from './components/ui';
import { ContactPage, Home, SiteLayout } from './pages/Landing';
import Login from './pages/Login';
import Notifications from './pages/shared/Notifications';
import Documents from './pages/shared/Documents';
import Settings from './pages/shared/Settings';
import Profile from './pages/shared/Profile';
import Overview from './pages/portal/Overview';
import Book from './pages/portal/Book';
import Appointments from './pages/portal/Appointments';
import Dashboard from './pages/app/Dashboard';
import Cases from './pages/app/Cases';
import Tasks from './pages/app/Tasks';
import Messages from './pages/app/Messages';
import Consultations from './pages/app/Consultations';
import People from './pages/app/People';
import Activity from './pages/app/Activity';
import Inbox from './pages/app/Inbox';

export default function App() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname}>
    <Suspense fallback={<div className="center-screen"><Spinner /></div>}>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<Home />} />
          <Route path="contact" element={<ContactPage />} />
        </Route>
        <Route path="login" element={<Login mode="client" />} />
        <Route path="staff" element={<Login mode="staff" />} />

        <Route element={<ProtectedRoute allow={['client']} loginPath="/login" />}>
          <Route path="portal" element={<Shell area="portal" />}>
            <Route index element={<Overview />} />
            <Route path="book" element={<Book />} />
            <Route path="appointments" element={<Appointments />} />
            <Route path="documents" element={<Documents />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings/:tab" element={<Settings />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allow={['staff', 'admin']} loginPath="/staff" />}>
          <Route path="app" element={<Shell area="app" />}>
            <Route index element={<Dashboard />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="documents" element={<Documents />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="cases" element={<Cases />} />
            <Route path="messages" element={<Messages />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings/:tab" element={<Settings />} />
            <Route element={<ProtectedRoute allow={['admin']} loginPath="/staff" />}>
              <Route path="consultations" element={<Consultations />} />
              <Route path="people" element={<People />} />
              <Route path="activity" element={<Activity />} />
              <Route path="inbox" element={<Inbox />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
  );
}
