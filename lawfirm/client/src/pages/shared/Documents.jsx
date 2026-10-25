import { useEffect, useRef, useState } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { Download, ExternalLink, Eye, FileText, Trash2, Upload } from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useLive } from '../../lib/useLive';
import { api } from '../../lib/api';
import { caseText } from '../../lib/firm';
import { fmtDate, fmtSize, millis } from '../../lib/format';
import { PageHeader } from '../../components/Shell';
import { Empty, Loading, Modal, useAction, useToast } from '../../components/ui';
import Select from '../../components/Select';
import { useT } from '../../i18n/I18nProvider';

export function useMyAppointments() {
  const { user, role } = useAuth();
  return useLive(() => {
    const c = collection(db, 'appointments');
    if (role === 'client') return query(c, where('clientId', '==', user.uid));
    if (role === 'staff') return query(c, where('staffId', '==', user.uid));
    return c; // admin
  }, [user.uid, role]);
}

export default function Documents() {
  const { user, role } = useAuth();
  const toast = useToast();
  const t = useT();
  const [run, busy] = useAction();
  const fileRef = useRef(null);
  const [apptId, setApptId] = useState('');
  const [preview, setPreview] = useState(null);
  const appts = useMyAppointments();
  const docs = useLive(() => {
    const c = collection(db, 'documents');
    if (role === 'client') return query(c, where('clientId', '==', user.uid));
    if (role === 'staff') return query(c, where('staffId', '==', user.uid));
    return c;
  }, [user.uid, role]);

  const open = appts.data.filter((a) => !['cancelled', 'declined'].includes(a.status)).sort((a, b) => millis(b.startsAt) - millis(a.startsAt));
  const list = [...docs.data].sort((a, b) => millis(b.createdAt) - millis(a.createdAt));

  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
  }, [preview]);

  async function upload(e) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return toast(t('docs.chooseFile'), 'bad');
    if (file.size > 10 * 1024 * 1024) return toast(t('docs.tooBig'), 'bad');
    const form = new FormData(); form.append('appointmentId', apptId); form.append('file', file);
    const ok = await run(() => api('/documents', { method: 'POST', form }), t('docs.uploaded'));
    if (ok) { fileRef.current.value = ''; }
  }
  // Files are served by the API only after it checks permission, so the request carries the login token.
  const download = (d) => run(async () => {
    const res = await api(`/documents/${d.id}/file`, { raw: true });
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a'); a.href = url; a.download = d.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  });
  const previewable = (d) => d.contentType === 'application/pdf' || d.contentType?.startsWith('image/');
  const openPreview = (d) => run(async () => {
    const res = await api(`/documents/${d.id}/file`, { raw: true });
    return { doc: d, url: URL.createObjectURL(await res.blob()) };
  }).then((result) => {
    if (result && typeof result === 'object') setPreview(result);
  });
  const remove = (d) => confirm(t('docs.confirmDelete', { name: d.name })) && run(() => api(`/documents/${d.id}`, { method: 'DELETE' }), t('docs.deleted'));

  return (
    <>
      <PageHeader title={t('docs.title')} sub={role === 'client' ? t('docs.subClient') : t('docs.subStaff')} />
      <div className="grid cols-2" style={{ gridTemplateColumns: 'minmax(280px, 380px) 1fr', alignItems: 'start' }}>
        <form className="card stack" onSubmit={upload}>
          <h3>{t('docs.upload')}</h3>
          <label className="field"><span>{t('docs.which')}</span>
            <Select value={apptId} onChange={setApptId} required placeholder={t('docs.select')} options={open.map((a) => ({ value: a.id, label: `${caseText(t, a.caseType)} – ${fmtDate(a.startsAt)} (${role === 'client' ? a.staffName : a.clientName})` }))} />
          </label>
          {open.length === 0 && !appts.loading && <p className="hint">{role === 'client' ? t('docs.bookFirst') : t('docs.noOpen')}</p>}
          <label className="field"><span>{t('docs.file')}</span><input ref={fileRef} className="input" type="file" accept=".pdf,.doc,.docx,.xlsx,.jpg,.jpeg,.png" required /></label>
          <p className="hint">{t('docs.fileHint')}</p>
          <button className="btn btn-gold" disabled={busy || !apptId}><Upload size={17} />{busy ? t('docs.uploading') : t('docs.uploadBtn')}</button>
        </form>
        <div className="card">
          <p className="hint">{t('docs.previewHint')}</p>
          {docs.loading ? <Loading /> : list.length === 0 ? <Empty title={t('docs.none')}>{t('docs.noneBody')}</Empty> : (
            <div className="list">{list.map((d) => (
              <div key={d.id} className="list-item">
                <FileText size={22} color="var(--gold)" style={{ marginTop: 2 }} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <b style={{ overflowWrap: 'anywhere' }}>{d.name}</b>
                  <div className="muted small">{fmtSize(d.size)} · {fmtDate(d.createdAt)} · {t('docs.by', { name: d.uploadedByName })}{role !== 'client' && ` · ${t('docs.client', { name: d.clientName })}`}</div>
                  {role !== 'client' && d.driveStatus === 'failed' && <div className="error-text small">{t('docs.driveFail')}</div>}
                </div>
                {role !== 'client' && d.driveLink && <a className="icon-btn" href={d.driveLink} target="_blank" rel="noopener noreferrer" aria-label={t('docs.openDrive', { name: d.name })}><ExternalLink size={16} /></a>}
                {previewable(d) && <button className="icon-btn" aria-label={t('docs.previewAria', { name: d.name })} title={t('docs.preview')} onClick={() => openPreview(d)} disabled={busy}><Eye size={16} /></button>}
                <button className="icon-btn" aria-label={t('docs.downloadAria', { name: d.name })} onClick={() => download(d)} disabled={busy}><Download size={16} /></button>
                {(d.uploadedBy === user.uid || role === 'admin') && <button className="icon-btn" aria-label={t('docs.deleteAria', { name: d.name })} onClick={() => remove(d)} disabled={busy}><Trash2 size={16} /></button>}
              </div>
            ))}</div>
          )}
        </div>
      </div>
      {preview && <Modal title={preview.doc.name} onClose={() => setPreview(null)} className="preview-modal">
        {preview.doc.contentType === 'application/pdf'
          ? <iframe className="document-preview-frame" src={preview.url} title={t('docs.previewOf', { name: preview.doc.name })} sandbox="allow-scripts" />
          : <img className="document-preview-image" src={preview.url} alt={t('docs.previewOf', { name: preview.doc.name })} />}
      </Modal>}
    </>
  );
}
