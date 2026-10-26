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
import { FluidHighlight } from './effects';
import { useT } from '../i18n/I18nProvider';

const ShellCtx = createContext({ openMenu: () => {}, unread: 0 });
export const useShell = () => useContext(ShellCtx);

const settingsItems = (base, withProfile, t) => [
  ...(withProfile ? [{ to: `${base}/settings/profile`, label: t('nav.details'), icon: UserRound }] : []),
  { to: `${base}/settings/notifications`, label: t('nav.notifications'), icon: Bell },
  { to: `${base}/settings/security`, label: t('nav.security'), icon: Lock },
];

function navFor(role, t) {
  if (role === 'client') return [
    { to: '/portal', label: t('nav.overview'), icon: LayoutDashboard, end: true },
    { to: '/portal/book', label: t('nav.book'), icon: CalendarPlus },
    { to: '/portal/appointments', label: t('nav.appointments'), icon: CalendarDays },
    { to: '/portal/documents', label: t('nav.documents'), icon: FileText },
    { to: '/portal/notifications', label: t('nav.notifications'), icon: Bell, badge: true },
    { group: t('nav.settings'), icon: Settings, base: '/portal/settings', items: settingsItems('/portal', true, t) },
  ];
  const team = [
    { to: '/app', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/app/notifications', label: t('nav.notifications'), icon: Bell, badge: true },
    { to: '/app/documents', label: t('nav.documents'), icon: FileText },
    { to: '/app/tasks', label: t('nav.tasks'), icon: ListChecks },
    { to: '/app/cases', label: role === 'admin' ? t('nav.casesAdmin') : t('nav.casesStaff'), icon: ClipboardList },
    { to: '/app/messages', label: t('nav.messages'), icon: MessageSquare },
  ];
  const admin = role === 'admin' ? [
    { label: t('nav.supervisor') },
    { to: '/app/consultations', label: t('nav.allConsultations'), icon: CalendarDays },
    { to: '/app/people', label: t('nav.people'), icon: UserPlus },
    { to: '/app/activity', label: t('nav.activity'), icon: History },
    { to: '/app/inbox', label: t('nav.inbox'), icon: Inbox },
    { label: t('nav.account') },
  ] : [{ label: t('nav.account') }];
  return [...team, ...admin,
    { group: t('nav.settings'), icon: Settings, base: '/app/settings', items: settingsItems('/app', false, t) },
    { to: '/app/profile', label: t('nav.profile'), icon: UserRound }];
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
  const t = useT();
  const { user, role, profile, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  const notes = useLive(() => (user ? query(collection(db, 'notifications'), where('userId', '==', user.uid)) : null), [user?.uid]);
  const unread = notes.data.filter((n) => !n.read).length;
  const team = useLive(() => (area === 'app' ? collection(db, 'team') : null), [area]);
  const nav = navFor(role, t);
  const label = role === 'admin' ? t('nav.roleAdmin') : role === 'staff' ? t('nav.roleStaff') : t('nav.roleClient');

  return (
    <ShellCtx.Provider value={{ openMenu: () => setOpen(true), unread, area }}>
      <div className="shell">
        <div className="backdrop" />
        {open && <div className="scrim" onClick={() => setOpen(false)} />}
        <aside className={`sidebar ${role === 'admin' ? 'supervisor-sidebar' : ''} ${open ? 'open' : ''}`} aria-label={t('nav.main')}>
          <Link to={area === 'app' ? '/app' : '/portal'} className="brand">
            <img src="/logo-mark.png" alt="" /><div><b>Ndukwana</b><small>{area === 'app' ? t('nav.teamWorkspace') : t('nav.clientPortal')}</small></div>
          </Link>
          <FluidHighlight as="nav" className="nav" tabIndex={0} aria-label={t('nav.main')} onKeyDown={(e) => {
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
          </FluidHighlight>
          {area === 'app' && (
            <Link className="team-strip" to="/app/profile" aria-label={t('nav.viewTeam')}>
              <div className="avatars">{team.data.slice(0, 5).map((m) => <Avatar key={m.id} src={m.avatar} name={m.name} size={30} />)}</div>
              <span>{team.data.length === 1 ? t('nav.teamCountOne') : t('nav.teamCount', { count: team.data.length })}</span>
            </Link>
          )}
          {area === 'portal' && (
            <div>
              <div className="nav-label" style={{ paddingTop: 0 }}>{t('nav.contactFirm')}</div>
              <div className="contact-strip">
                <a href={waHref()} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><WhatsAppIcon width={18} height={18} /></a>
                <a href={telHref(FIRM.phones[0])} aria-label={t('contact.call')}><Phone size={17} /></a>
                {FIRM.socials.map((s) => { const I = SOCIAL_ICONS[s.id]; return <a key={s.id} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}><I width={17} height={17} /></a>; })}
              </div>
            </div>
          )}
          <div className="sidebar-foot">
            <div className="me"><Avatar src={profile?.avatar} name={profile?.name} size={36} /><div><b>{profile?.name || 'Account'}</b><small>{label}</small></div></div>
            <button className="logout" onClick={logout}><LogOut size={18} />{t('nav.logout')}</button>
          </div>
        </aside>
        <main className="main"><Outlet /></main>
      </div>
    </ShellCtx.Provider>
  );
}

function ThemeToggle() {
  const t = useT();
  const { theme, setTheme } = useAuth();
  const [run, busy] = useAction();
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    run(() => api('/profile/me', { method: 'PATCH', body: { prefs: { theme: next } } }));
  };
  const label = theme === 'dark' ? t('theme.light') : t('theme.dark');
  return <button className="icon-btn theme-toggle" type="button" onClick={toggle} disabled={busy} aria-label={label} title={label}>
    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
  </button>;
}

export function PageHeader({ title, sub, children }) {
  const t = useT();
  const { openMenu, unread, area } = useShell();
  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" onClick={openMenu} aria-label={t('nav.openMenu')}><Menu size={19} /></button>
      <div className="grow"><h1>{title}</h1>{sub && <p className="sub-title">{sub}</p>}</div>
      {children}
      <ThemeToggle />
      <Link className="icon-btn bell" to={area === 'app' ? '/app/notifications' : '/portal/notifications'} aria-label={unread ? t('notif.ariaUnread', { n: unread }) : t('nav.notifications')}>
        <Bell size={18} />{unread > 0 && <span className="dot">{unread > 9 ? '9+' : unread}</span>}
      </Link>
    </header>
  );
}
export { Shield };
