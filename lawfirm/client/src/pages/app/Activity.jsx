import { useState } from 'react';
import { collection, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase';
import { useLive } from '../../lib/useLive';
import { fmtDateTime } from '../../lib/format';
import { PageHeader } from '../../components/Shell';
import { Empty, Loading } from '../../components/ui';
import Select from '../../components/Select';
import { useT } from '../../i18n/I18nProvider';

export default function Activity() {
  const t = useT();
  const [who, setWho] = useState('');
  const { data, loading } = useLive(() => query(collection(db, 'activity'), orderBy('createdAt', 'desc'), limit(200)), []);
  const people = [...new Map(data.map((a) => [a.actorId, a.actorName])).entries()];
  const rows = data.filter((a) => !who || a.actorId === who);
  return (
    <>
      <PageHeader title={t('act.title')} sub={t('act.sub')}>
        <Select variant="auto" value={who} onChange={setWho} aria-label={t('act.filter')} options={[{ value: '', label: t('act.everyone') }, ...people.map(([id, n]) => ({ value: id, label: n }))]} />
      </PageHeader>
      <div className="card">
        {loading ? <Loading /> : rows.length === 0 ? <Empty title={t('act.none')}>{t('act.noneBody')}</Empty> : (
          <div className="table-wrap"><table><thead><tr><th>{t('act.when')}</th><th>{t('act.person')}</th><th>{t('act.what')}</th></tr></thead>
            <tbody>{rows.map((a) => <tr key={a.id}><td className="small" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(a.createdAt)}</td><td><b className="small">{a.actorName}</b><div className="muted small">{a.actorRole}</div></td><td style={{ overflowWrap: 'anywhere' }}>{a.summary}</td></tr>)}</tbody></table></div>
        )}
      </div>
    </>
  );
}
