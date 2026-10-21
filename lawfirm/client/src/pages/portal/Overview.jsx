import { Link } from 'react-router-dom';
import { collection, query, where } from 'firebase/firestore';
import { CalendarPlus, FileText, MessageCircle } from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useLive } from '../../lib/useLive';
import { fmtDateTime, millis } from '../../lib/format';
import { PageHeader } from '../../components/Shell';
import { Empty, Loading, Status } from '../../components/ui';
import { WhatsAppButton, CallButton } from '../../components/Contact';

export default function Overview() {
  const { user, profile } = useAuth();
  const appts = useLive(() => query(collection(db, 'appointments'), where('clientId', '==', user.uid)), [user.uid]);
  const docs = useLive(() => query(collection(db, 'documents'), where('clientId', '==', user.uid)), [user.uid]);
  const upcoming = appts.data.filter((a) => ['pending', 'approved'].includes(a.status)).sort((a, b) => millis(a.startsAt) - millis(b.startsAt));
  const next = upcoming[0];
  return (
    <>
      <PageHeader title={`Welcome${profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}`} sub="Your consultations and documents in one place." />
      <div className="grid" style={{ gap: 22 }}>
        <div className="card" style={{ background: 'linear-gradient(135deg, #2a3c64, #141c31)', color: '#eef0f6', border: '1px solid rgba(205,166,94,.4)' }}>
          {appts.loading ? <Loading /> : next ? (
            <div className="row between wrap"><div><div style={{ color: '#aab3c9', fontSize: '.86rem' }}>Your next consultation</div>
              <h2 style={{ color: '#fff', margin: '4px 0' }}>{fmtDateTime(next.startsAt)}</h2>
              <div style={{ color: '#cdd3e3' }}>{next.caseLabel} with {next.staffName}</div></div><Status value={next.status} /></div>
          ) : (
            <div className="row between wrap"><div><h2 style={{ color: '#fff' }}>No consultation booked</h2><p style={{ color: '#cdd3e3', marginTop: 6 }}>Choose a case type and an attorney, and we will confirm your time.</p></div>
              <Link className="btn btn-gold" to="/portal/book"><CalendarPlus size={18} />Book a consultation</Link></div>
          )}
        </div>
        <div className="grid cols-3">
          <div className="card stat"><b>{upcoming.length}</b><span>open consultation{upcoming.length === 1 ? '' : 's'}</span></div>
          <div className="card stat"><b>{docs.data.length}</b><span>document{docs.data.length === 1 ? '' : 's'} shared</span></div>
          <div className="card stat"><b>{appts.data.filter((a) => a.status === 'pending').length}</b><span>awaiting approval</span></div>
        </div>
        <div className="grid cols-2">
          <div className="card stack"><h3>Share documents</h3><p className="muted">Upload IDs, contracts or letters for your attorney to review ahead of your consultation.</p><div><Link className="btn btn-ghost" to="/portal/documents"><FileText size={17} />Go to documents</Link></div></div>
          <div className="card stack"><h3>Need help right now?</h3><p className="muted">Message or call the firm directly, or use the assistant at the bottom right of the page.</p><div className="row wrap"><WhatsAppButton>WhatsApp</WhatsAppButton><CallButton>Call</CallButton></div></div>
        </div>
      </div>
    </>
  );
}
export { MessageCircle, Empty };
