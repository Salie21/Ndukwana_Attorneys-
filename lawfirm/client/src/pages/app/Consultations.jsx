import { useState } from 'react';
import { collection } from 'firebase/firestore';
import { db } from '../../firebase';
import { useLive } from '../../lib/useLive';
import { millis } from '../../lib/format';
import { PageHeader } from '../../components/Shell';
import CaseCard from '../../components/CaseCard';
import { Empty, Loading } from '../../components/ui';

const TABS = [['pending', 'Awaiting decision'], ['approved', 'Upcoming'], ['completed', 'Completed'], ['closed', 'Declined or cancelled'], ['all', 'Everything']];

export default function Consultations() {
  const [tab, setTab] = useState('pending');
  const [who, setWho] = useState('');
  const { data, loading } = useLive(() => collection(db, 'appointments'), []);
  const staff = [...new Map(data.map((a) => [a.staffId, a.staffName])).entries()];
  const list = data.filter((a) => (tab === 'all' || (tab === 'closed' ? ['declined', 'cancelled'].includes(a.status) : a.status === tab)) && (!who || a.staffId === who))
    .sort((a, b) => millis(a.startsAt) - millis(b.startsAt));
  return (
    <>
      <PageHeader title="All consultations" sub="Every booking across the firm. Approve, reassign or cancel as supervisor." />
      <div className="row wrap" style={{ marginBottom: 16 }}>
        <div className="tabs" style={{ margin: 0 }}>{TABS.map(([id, label]) => <button key={id} className={`tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{label}</button>)}</div>
        <select className="select" style={{ width: 'auto', marginLeft: 'auto' }} value={who} onChange={(e) => setWho(e.target.value)} aria-label="Filter by staff member">
          <option value="">All staff</option>{staff.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div>
      {loading ? <Loading /> : list.length === 0 ? <div className="card"><Empty title="No consultations match" /></div> : <div className="grid cols-2">{list.map((a) => <CaseCard key={a.id} a={a} admin />)}</div>}
    </>
  );
}
