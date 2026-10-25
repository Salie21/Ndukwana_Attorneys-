import { useState } from 'react';
import { collection } from 'firebase/firestore';
import { db } from '../../firebase';
import { useLive } from '../../lib/useLive';
import { millis } from '../../lib/format';
import { PageHeader } from '../../components/Shell';
import CaseCard from '../../components/CaseCard';
import { Empty, Loading } from '../../components/ui';
import Select from '../../components/Select';
import { useT } from '../../i18n/I18nProvider';

const TABS = [['pending', 'cases.tabPending'], ['approved', 'cases.tabUpcoming'], ['completed', 'cases.tabCompleted'], ['closed', 'cases.tabClosed'], ['all', 'cases.tabAll']];

export default function Consultations() {
  const t = useT();
  const [tab, setTab] = useState('pending');
  const [who, setWho] = useState('');
  const { data, loading } = useLive(() => collection(db, 'appointments'), []);
  const staff = [...new Map(data.map((a) => [a.staffId, a.staffName])).entries()];
  const list = data.filter((a) => (tab === 'all' || (tab === 'closed' ? ['declined', 'cancelled'].includes(a.status) : a.status === tab)) && (!who || a.staffId === who))
    .sort((a, b) => millis(a.startsAt) - millis(b.startsAt));
  return (
    <>
      <PageHeader title={t('cons.title')} sub={t('cons.sub')} />
      <div className="row wrap" style={{ marginBottom: 16 }}>
        <div className="tabs" style={{ margin: 0 }}>{TABS.map(([id, label]) => <button key={id} className={`tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{t(label)}</button>)}</div>
        <Select variant="auto" className="push" value={who} onChange={setWho} aria-label={t('cons.filterStaff')} options={[{ value: '', label: t('cons.allStaff') }, ...staff.map(([id, name]) => ({ value: id, label: name }))]} />
      </div>
      {loading ? <Loading /> : list.length === 0 ? <div className="card"><Empty title={t('cons.none')} /></div> : <div className="grid cols-2">{list.map((a) => <CaseCard key={a.id} a={a} admin />)}</div>}
    </>
  );
}
