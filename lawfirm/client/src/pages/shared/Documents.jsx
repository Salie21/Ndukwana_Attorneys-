import { useEffect, useRef, useState } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { Download, ExternalLink, Eye, FileText, Trash2, Upload } from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useLive } from '../../lib/useLive';
import { api } from '../../lib/api';
import { caseLabel } from '../../lib/firm';
import { fmtDate, fmtSize, millis } from '../../lib/format';
import { PageHeader } from '../../components/Shell';
import { Empty, Loading, Modal, useAction, useToast } from '../../components/ui';

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
    if (!file) return toast('Choose a file first.', 'bad');
    if (file.size > 10 * 1024 * 1024) return toast('That file is larger than 10 MB.', 'bad');
    const form = new FormData(); form.append('appointmentId', apptId); form.append('file', file);
    const ok = await run(() => api('/documents', { method: 'POST', form }), 'Document uploaded');
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
  const remove = (d) => confirm(`Delete “${d.name}”?`) && run(() => api(`/documents/${d.id}`, { method: 'DELETE' }), 'Document deleted');

  return (
    <>
      <PageHeader title="Documents" sub={role === 'client' ? 'Upload documents for your attorney to review. Only you and your attorney can see them.' : 'Documents from your clients'} />
      <div className="grid cols-2" style={{ gridTemplateColumns: 'minmax(280px, 380px) 1fr', alignItems: 'start' }}>
        <form className="card stack" onSubmit={upload}>
          <h3>Upload a document</h3>
          <label className="field"><span>Which consultation is it for?</span>
            <select className="select" value={apptId} onChange={(e) => setApptId(e.target.value)} required>
              <option value="">Select a consultation</option>
              {open.map((a) => <option key={a.id} value={a.id}>{caseLabel(a.caseType)} – {fmtDate(a.startsAt)} ({role === 'client' ? a.staffName : a.clientName})</option>)}
            </select>
          </label>
          {open.length === 0 && !appts.loading && <p className="hint">{role === 'client' ? 'Book a consultation first, then you can attach documents to it.' : 'No open consultations to attach documents to.'}</p>}
          <label className="field"><span>File</span><input ref={fileRef} className="input" type="file" accept=".pdf,.doc,.docx,.xlsx,.jpg,.jpeg,.png" required /></label>
          <p className="hint">PDF, Word, Excel, JPG or PNG. Up to 10 MB.</p>
          <button className="btn btn-gold" disabled={busy || !apptId}><Upload size={17} />{busy ? 'Uploading…' : 'Upload'}</button>
        </form>
        <div className="card">
          <p className="hint">PDFs and images can be previewed here. Word and Excel files can be downloaded.</p>
          {docs.loading ? <Loading /> : list.length === 0 ? <Empty title="No documents yet">Uploaded files will be listed here.</Empty> : (
            <div className="list">{list.map((d) => (
              <div key={d.id} className="list-item">
                <FileText size={22} color="var(--gold)" style={{ marginTop: 2 }} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <b style={{ overflowWrap: 'anywhere' }}>{d.name}</b>
                  <div className="muted small">{fmtSize(d.size)} · {fmtDate(d.createdAt)} · by {d.uploadedByName}{role !== 'client' && ` · client: ${d.clientName}`}</div>
                  {role !== 'client' && d.driveStatus === 'failed' && <div className="error-text small">Google Drive copy failed. The file is still safe in private storage.</div>}
                </div>
                {role !== 'client' && d.driveLink && <a className="icon-btn" href={d.driveLink} target="_blank" rel="noopener noreferrer" aria-label={`Open ${d.name} in Google Drive`}><ExternalLink size={16} /></a>}
                {previewable(d) && <button className="icon-btn" aria-label={`Preview ${d.name}`} title="Preview" onClick={() => openPreview(d)} disabled={busy}><Eye size={16} /></button>}
                <button className="icon-btn" aria-label={`Download ${d.name}`} onClick={() => download(d)} disabled={busy}><Download size={16} /></button>
                {(d.uploadedBy === user.uid || role === 'admin') && <button className="icon-btn" aria-label={`Delete ${d.name}`} onClick={() => remove(d)} disabled={busy}><Trash2 size={16} /></button>}
              </div>
            ))}</div>
          )}
        </div>
      </div>
      {preview && <Modal title={preview.doc.name} onClose={() => setPreview(null)} className="preview-modal">
        {preview.doc.contentType === 'application/pdf'
          ? <iframe className="document-preview-frame" src={preview.url} title={`Preview of ${preview.doc.name}`} sandbox="allow-scripts" />
          : <img className="document-preview-image" src={preview.url} alt={`Preview of ${preview.doc.name}`} />}
      </Modal>}
    </>
  );
}
