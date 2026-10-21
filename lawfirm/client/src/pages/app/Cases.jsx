import { useState } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useLive } from '../../lib/useLive';
import { millis } from '../../lib/format';
import { PageHeader } from '../../components/Shell';
import CaseCard from '../../components/CaseCard';
import { Empty, Loading } from '../../components/ui';

const TABS = [['pending', 'Awaiting decision'], ['approved', 'Upcoming'], ['past', 'Past and closed']];

// "Assigned cases": consultations booked with me. Supervisors see everyone's on the next page.
export default function Cases() {
  const { user } = useAuth();
  const [tab, setTab] = useState('pending');
  const { data, loading } = useLive(() => query(collection(db, 'appointments'), where('staffId', '==', user.uid)), [user.uid]);
  const list = data.filter((a) => (tab === 'past' ? ['declined', 'cancelled', 'completed'].includes(a.status) : a.status === tab))
    .sort((a, b) => (tab === 'past' ? millis(b.startsAt) - millis(a.startsAt) : millis(a.startsAt) - millis(b.startsAt)));
  const count = (t) => data.filter((a) => a.status === t).length;
  return (
    <>
      <PageHeader title="Assigned cases" sub="Consultations clients have booked with you." />
      <div className="tabs">{TABS.map(([id, label]) => <button key={id} className={`tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{label}{id !== 'past' && count(id) ? ` (${count(id)})` : ''}</button>)}</div>
      {loading ? <Loading /> : list.length === 0 ? <div className="card"><Empty title="Nothing here">New requests from clients will appear in this list.</Empty></div> : <div className="grid">{list.map((a) => <CaseCard key={a.id} a={a} />)}</div>}
    </>
  );
}
