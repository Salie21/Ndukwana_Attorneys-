import { createContext, useContext, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { collection, query, where } from 'firebase/firestore';
import { Bell, CalendarDays, CalendarPlus, ChevronDown, ClipboardList, FileText, History, Inbox, LayoutDashboard, ListChecks, LogOut, Menu, MessageSquare, Moon, Settings, Shield, Sun, UserPlus, UserRound, Lock, Phone } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useLive } from '../lib/useLive';
import { api } from '../lib/api';
import { Avatar, useAction } from './ui';
import { FIRM, telHref, waHref } from '../lib/firm';
import { SOCIAL_ICONS, WhatsAppIcon } from './Icons';

const ShellCtx = createContext({ openMenu: () => {}, unread: 0 });
export const useShell = () => useContext(ShellCtx);

const settingsItems = (base, withProfile) => [
  ...(withProfile ? [{ to: `${base}/settings/profile`, label: 'My details', icon: UserRound }] : []),
  { to: `${base}/settings/notifications`, label: 'Notifications', icon: Bell },
  { to: `${base}/settings/security`, label: 'Security', icon: Lock },
];

function navFor(role) {
  if (role === 'client') return [
    { to: '/portal', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/portal/book', label: 'Book a consultation', icon: CalendarPlus },
    { to: '/portal/appointments', label: 'My consultations', icon: CalendarDays },
    { to: '/portal/documents', label: 'Documents', icon: FileText },
    { to: '/portal/notifications', label: 'Notifications', icon: Bell, badge: true },
    { group: 'Settings', icon: Settings, base: '/portal/settings', items: settingsItems('/portal', true) },
  ];
  const team = [
    { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/app/notifications', label: 'Notifications', icon: Bell, badge: true },
    { to: '/app/documents', label: 'Documents', icon: FileText },
    { to: '/app/tasks', label: 'Tasks', icon: ListChecks },
    { to: '/app/cases', label: role === 'admin' ? 'My cases' : 'Assigned cases', icon: ClipboardList },
    { to: '/app/messages', label: 'Messages', icon: MessageSquare },
  ];
  const admin = role === 'admin' ? [
    { label: 'Supervisor' },
    { to: '/app/consultations', label: 'All consultations', icon: CalendarDays },
    { to: '/app/people', label: 'Team & invites', icon: UserPlus },
    { to: '/app/activity', label: 'Activity log', icon: History },
    { to: '/app/inbox', label: 'Website enquiries', icon: Inbox },
    { label: 'Account' },
  ] : [{ label: 'Account' }];
  return [...team, ...admin,
    { group: 'Settings', icon: Settings, base: '/app/settings', items: settingsItems('/app', false) },
    { to: '/app/profile', label: 'Profile', icon: UserRound }];
}

function Group({ item }) {
  const { pathname } = useLocation();
  const active = pathname.startsWith(item.base);
  const [open, setOpen] = useState(active);
  useEffect(() => { if (active) setOpen(true); }, [active]);
  const Icon = item.icon;
  return (
    <div>
      <button className="nav-item" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Icon size={19} />{item.group}<ChevronDown size={16} className={`chev ${open ? 'open' : ''}`} />
      </button>
      {open && <div className="sub">{item.items.map((s) => <NavLink key={s.to} to={s.to}>{s.label}</NavLink>)}</div>}
    </div>
  );
}

export default function Shell({ area }) {
  const { user, role, profile, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  const notes = useLive(() => (user ? query(collection(db, 'notifications'), where('userId', '==', user.uid)) : null), [user?.uid]);
  const unread = notes.data.filter((n) => !n.read).length;
  const team = useLive(() => (area === 'app' ? collection(db, 'team') : null), [area]);
  const nav = navFor(role);
  const label = role === 'admin' ? 'Supervisor' : role === 'staff' ? 'Staff' : 'Client';

  return (
    <ShellCtx.Provider value={{ openMenu: () => setOpen(true), unread, area }}>
      <div className="shell">
        <div className="backdrop" />
        {open && <div className="scrim" onClick={() => setOpen(false)} />}
        <aside className={`sidebar ${role === 'admin' ? 'supervisor-sidebar' : ''} ${open ? 'open' : ''}`} aria-label="Main navigation">
          <Link to={area === 'app' ? '/app' : '/portal'} className="brand">
            <img src="/logo-mark.png" alt="" /><div><b>Ndukwana</b><small>{area === 'app' ? 'Team workspace' : 'Client portal'}</small></div>
          </Link>
          <nav className="nav" tabIndex={0} aria-label="Main navigation" onKeyDown={(e) => {
            if (!['ArrowUp', 'ArrowDown'].includes(e.key) || e.currentTarget.scrollHeight <= e.currentTarget.clientHeight) return;
            e.preventDefault();
            e.currentTarget.scrollBy({ top: e.key === 'ArrowDown' ? 48 : -48, behavior: 'auto' });
          }}>
            {nav.map((it, i) => {
              if (it.group) return <Group key={it.group} item={it} />;
              if (!it.to) return <div key={i} className="nav-label">{it.label}</div>;
              const Icon = it.icon;
              return <NavLink key={it.to} to={it.to} end={it.end}><Icon size={19} />{it.label}{it.badge && unread > 0 && <span className="count">{unread > 99 ? '99+' : unread}</span>}</NavLink>;
            })}
          </nav>
          {area === 'app' && (
            <Link className="team-strip" to="/app/profile" aria-label="View team members">
              <div className="avatars">{team.data.slice(0, 5).map((m) => <Avatar key={m.id} src={m.avatar} name={m.name} size={30} />)}</div>
              <span>{team.data.length} team member{team.data.length === 1 ? '' : 's'}</span>
            </Link>
          )}
          {area === 'portal' && (
            <div>
              <div className="nav-label" style={{ paddingTop: 0 }}>Contact the firm</div>
              <div className="contact-strip">
                <a href={waHref()} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><WhatsAppIcon width={18} height={18} /></a>
                <a href={telHref(FIRM.phones[0])} aria-label="Call the office"><Phone size={17} /></a>
                {FIRM.socials.map((s) => { const I = SOCIAL_ICONS[s.id]; return <a key={s.id} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}><I width={17} height={17} /></a>; })}
              </div>
            </div>
          )}
          <div className="sidebar-foot">
            <div className="me"><Avatar src={profile?.avatar} name={profile?.name} size={36} /><div><b>{profile?.name || 'Account'}</b><small>{label}</small></div></div>
            <button className="logout" onClick={logout}><LogOut size={18} />Log out</button>
          </div>
        </aside>
        <main className="main"><Outlet /></main>
      </div>
    </ShellCtx.Provider>
  );
}

function ThemeToggle() {
  const { profile, role } = useAuth();
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');
  const [run, busy] = useAction();
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme || (role === 'staff' || role === 'admin' ? 'dark' : 'light'));
  }, [profile?.prefs?.theme, role]);
  const toggle = () => run(async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      await api('/profile/me', { method: 'PATCH', body: { prefs: { theme: next } } });
    } catch (error) {
      const previous = next === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = previous;
      setTheme(previous);
      throw error;
    }
  });
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return <button className="icon-btn theme-toggle" type="button" onClick={toggle} disabled={busy} aria-label={label} title={label}>
    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
  </button>;
}

export function PageHeader({ title, sub, children }) {
  const { openMenu, unread, area } = useShell();
  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" onClick={openMenu} aria-label="Open menu"><Menu size={19} /></button>
      <div className="grow"><h1>{title}</h1>{sub && <p className="sub-title">{sub}</p>}</div>
      {children}
      <ThemeToggle />
      <Link className="icon-btn bell" to={area === 'app' ? '/app/notifications' : '/portal/notifications'} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
        <Bell size={18} />{unread > 0 && <span className="dot">{unread > 9 ? '9+' : unread}</span>}
      </Link>
    </header>
  );
}
export { Shield };
