import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { CASE_TYPES } from '../../lib/firm';
import { PageHeader } from '../../components/Shell';
import { Avatar, Empty, Loading, useAction } from '../../components/ui';

const pad = (n) => String(n).padStart(2, '0');
// Today in South Africa, as YYYY-MM-DD, so the date picker never offers a past day.
export const todayZA = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' });
export const isWeekend = (s) => { const d = new Date(`${s}T12:00:00+02:00`).getUTCDay(); return d === 0 || d === 6; };

// Reusable date + time slot picker (used when booking and rescheduling).
export function SlotPicker({ staffId, value, onChange }) {
  const [avail, setAvail] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!staffId || !value.date || isWeekend(value.date)) { setAvail(null); return; }
    let live = true; setAvail(null); setErr('');
    api(`/appointments/availability?staffId=${encodeURIComponent(staffId)}&date=${value.date}`).then((r) => live && setAvail(r)).catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [staffId, value.date]);
  const now = Date.now();
  return (
    <div className="stack">
      <label className="field"><span>Date (Monday to Friday)</span>
        <input className="input" type="date" min={todayZA()} value={value.date} onChange={(e) => onChange({ date: e.target.value, hour: null })} required /></label>
      {value.date && isWeekend(value.date) && <p className="error-text">Consultations are only available on weekdays.</p>}
      {err && <p className="error-text">{err}</p>}
      {value.date && !isWeekend(value.date) && !avail && !err && <Loading />}
      {avail && (
        <div className="field"><span>Time (South African time)</span>
          <div className="slots">{avail.hours.map((h) => {
            const past = new Date(`${value.date}T${pad(h)}:00:00+02:00`).getTime() < now + 3600000;
            const off = avail.taken.includes(h) || past;
            return <button type="button" key={h} className={`slot ${value.hour === h ? 'on' : ''}`} disabled={off} aria-pressed={value.hour === h} onClick={() => onChange({ ...value, hour: h })}>{pad(h)}:00</button>;
          })}</div>
        </div>
      )}
    </div>
  );
}

const STEPS = ['Case type', 'Attorney', 'Details', 'Date and time'];

export default function Book() {
  const nav = useNavigate();
  const [run, busy] = useAction();
  const [step, setStep] = useState(0);
  const [caseType, setCaseType] = useState('');
  const [staff, setStaff] = useState(null);
  const [staffError, setStaffError] = useState('');
  const [staffId, setStaffId] = useState('');
  const [description, setDescription] = useState('');
  const [slot, setSlot] = useState({ date: '', hour: null });

  useEffect(() => {
    if (!caseType) return;
    let active = true;
    setStaff(null); setStaffId(''); setStaffError('');
    api(`/profile/staff?caseType=${encodeURIComponent(caseType)}`)
      .then((result) => { if (active) setStaff(Array.isArray(result) ? result : []); })
      .catch((error) => { if (active) { setStaff([]); setStaffError(error.message || 'Could not load attorneys. Please try again.'); } });
    return () => { active = false; };
  }, [caseType]);

  const chosen = useMemo(() => staff?.find((s) => s.uid === staffId), [staff, staffId]);
  const canNext = [!!caseType, !!staffId, description.trim().length >= 10, slot.date && slot.hour != null][step];

  const submit = async () => {
    const ok = await run(() => api('/appointments', { method: 'POST', body: { caseType, staffId, description: description.trim(), date: slot.date, hour: slot.hour } }), 'Request sent. You will be notified once it is approved.');
    if (ok) nav('/portal/appointments');
  };

  return (
    <>
      <PageHeader title="Book a consultation" sub="Tell us about your matter and choose who you would like to see." />
      <div className="steps booking-steps">{STEPS.map((s, i) => <span key={s} className={`step ${i === step ? 'on' : i < step ? 'done' : ''}`}>{s}</span>)}</div>
      <div className="card stack booking-card">
        {step === 0 && (
          <><h3>What is your matter about?</h3>
            <div className="picker">{CASE_TYPES.map((c) => (
              <button key={c.id} type="button" className={`pick ${caseType === c.id ? 'on' : ''}`} aria-pressed={caseType === c.id} onClick={() => { setCaseType(c.id); setStep(1); }}>
                <div><b>{c.label}</b><div className="muted small">{c.hint}</div></div></button>))}</div></>
        )}
        {step === 1 && (
          <><h3>Choose your attorney</h3>
            {!staff ? <Loading /> : staffError ? <div className="alert bad" role="alert">{staffError}</div> : staff.length === 0 ? <Empty title="No one is available for this case type yet">Choose “Other / not sure yet”, or contact the firm on WhatsApp or by phone and we will help.</Empty> : (
              <div className="picker">{staff.map((s) => (
                <button key={s.uid} type="button" className={`pick ${staffId === s.uid ? 'on' : ''}`} aria-pressed={staffId === s.uid} onClick={() => setStaffId(s.uid)}>
                  <Avatar src={s.avatar} name={s.name} size={48} /><div><b>{s.name}</b><div className="muted small">{s.title}</div>{s.bio && <div className="muted small" style={{ marginTop: 4 }}>{s.bio}</div>}</div></button>))}</div>
            )}</>
        )}
        {step === 2 && (
          <><h3>Describe your matter</h3>
            <label className="field"><span>A few sentences help the attorney prepare</span>
              <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} minLength={10} maxLength={2000} placeholder="For example: my father passed away in August and I need help reporting his estate." /></label>
            <p className="hint">{description.length}/2000. This is private to you and your attorney. You can upload documents after booking.</p></>
        )}
        {step === 3 && (
          <><h3>Pick a date and time</h3><SlotPicker staffId={staffId} value={slot} onChange={setSlot} />
            {canNext && <div className="alert">You are requesting <b>{chosen?.name}</b> on <b>{slot.date}</b> at <b>{String(slot.hour).padStart(2, '0')}:00</b>. The attorney will confirm it.</div>}</>
        )}
        <div className="row between booking-actions">
          <button className="btn btn-ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || busy}>Back</button>
          {step < 3 ? <button className="btn btn-gold" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>Continue</button>
            : <button className="btn btn-gold" onClick={submit} disabled={!canNext || busy}>{busy ? 'Sending…' : 'Request consultation'}</button>}
        </div>
      </div>
    </>
  );
}
