import { useState } from 'react';
import { MapPin, Mail, Phone, MessageCircle } from 'lucide-react';
import { FIRM, telHref, waHref } from '../lib/firm';
import { SOCIAL_ICONS, WhatsAppIcon } from './Icons';
import { api } from '../lib/api';
import { useAction } from './ui';

export function SocialLinks() {
  return (
    <div className="social-row">
      {FIRM.socials.map((s) => { const I = SOCIAL_ICONS[s.id]; return <a key={s.id} href={s.href} target="_blank" rel="noopener noreferrer"><I width={18} height={18} />{s.label}</a>; })}
    </div>
  );
}
export const WhatsAppButton = ({ children = 'Chat on WhatsApp' }) => <a className="btn btn-wa" href={waHref()} target="_blank" rel="noopener noreferrer"><WhatsAppIcon width={18} height={18} />{children}</a>;
export const CallButton = ({ children = 'Call the office' }) => <a className="btn btn-call" href={telHref(FIRM.phones[0])}><Phone size={18} />{children}</a>;

export function ContactForm() {
  const [run, busy] = useAction();
  const [sent, setSent] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = Object.fromEntries(f.entries());
    const ok = await run(() => api('/contact', { method: 'POST', body, auth: false }));
    if (ok) setSent(true);
  };
  if (sent) return <div className="alert ok"><b>Message sent.</b> The team will reply to your email as soon as possible.</div>;
  return (
    <form className="stack" onSubmit={submit}>
      <label className="field"><span>Your name</span><input className="input" name="name" required minLength={2} maxLength={80} autoComplete="name" /></label>
      <div className="row wrap" style={{ alignItems: 'stretch' }}>
        <label className="field grow"><span>Email</span><input className="input" type="email" name="email" required maxLength={120} autoComplete="email" /></label>
        <label className="field grow"><span>Phone (optional)</span><input className="input" type="tel" name="phone" maxLength={30} autoComplete="tel" /></label>
      </div>
      <label className="field"><span>How can we help?</span><textarea className="textarea" name="message" required minLength={10} maxLength={3000} /></label>
      <input className="honeypot" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <button className="btn btn-gold" disabled={busy}>{busy ? 'Sending…' : 'Send message'}</button>
      <p className="hint">Please do not send confidential documents here. Create a client account to upload them securely.</p>
    </form>
  );
}

export function ContactSection() {
  return (
    <div className="contact-grid">
      <div className="contact-card">
        <h2>Talk to the firm</h2>
        <p className="muted">Send a message, call, or message us on WhatsApp. For a private consultation, book through the client portal.</p>
        <div className="contact-line"><MapPin size={20} /><span>{FIRM.address}</span></div>
        <div className="contact-line"><Phone size={20} /><span>{FIRM.phones.map((p) => <a key={p} href={telHref(p)} style={{ display: 'block' }}>{p}</a>)}</span></div>
        <div className="contact-line"><Mail size={20} /><a href={`mailto:${FIRM.email}`}>{FIRM.email}</a></div>
        <div className="cta-row"><WhatsAppButton /><CallButton /></div>
        <SocialLinks />
      </div>
      <div className="card"><ContactForm /></div>
    </div>
  );
}

export { MessageCircle };
