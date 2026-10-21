import { collection, doc, limit, orderBy, query, updateDoc } from 'firebase/firestore';
import { Mail } from 'lucide-react';
import { db } from '../../firebase';
import { useLive } from '../../lib/useLive';
import { fmtDateTime } from '../../lib/format';
import { PageHeader } from '../../components/Shell';
import { Empty, Loading, Status } from '../../components/ui';

export default function Inbox() {
  const { data, loading } = useLive(() => query(collection(db, 'contactMessages'), orderBy('createdAt', 'desc'), limit(100)), []);
  return (
    <>
      <PageHeader title="Website enquiries" sub="Messages sent through the public contact form." />
      {loading ? <Loading /> : data.length === 0 ? <div className="card"><Empty title="No enquiries yet" /></div> : (
        <div className="grid">{data.map((m) => (
          <div className="card" key={m.id}>
            <div className="card-head"><div><h3 style={{ fontSize: '1.3rem' }}>{m.name}</h3><div className="muted small">{fmtDateTime(m.createdAt)}</div></div><Status value={m.handled ? 'completed' : 'pending'} /></div>
            <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.message}</p>
            <div className="row wrap" style={{ marginTop: 14 }}>
              <a className="btn btn-ghost btn-sm" href={`mailto:${m.email}`}><Mail size={15} />{m.email}</a>
              {m.phone && <a className="btn btn-ghost btn-sm" href={`tel:${m.phone}`}>{m.phone}</a>}
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => updateDoc(doc(db, 'contactMessages', m.id), { handled: !m.handled })}>{m.handled ? 'Mark as new' : 'Mark as handled'}</button>
            </div>
          </div>))}</div>
      )}
    </>
  );
}
