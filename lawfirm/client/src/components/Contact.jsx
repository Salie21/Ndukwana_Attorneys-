import { useState } from 'react';
import { MapPin, Mail, Phone } from 'lucide-react';
import { FIRM, telHref, waHref } from '../lib/firm';
import { SOCIAL_ICONS, WhatsAppIcon } from './Icons';
import { api } from '../lib/api';
import { useAction } from './ui';
import { useT } from '../i18n/I18nProvider';

export function SocialLinks() {
  return (
    <div className="social-row">
      {FIRM.socials.map((s) => { const I = SOCIAL_ICONS[s.id]; return <a key={s.id} href={s.href} target="_blank" rel="noopener noreferrer"><I width={18} height={18} />{s.label}</a>; })}
    </div>
  );
}
export function WhatsAppButton({ children }) { const t = useT(); return <a className="btn btn-wa" href={waHref()} target="_blank" rel="noopener noreferrer"><WhatsAppIcon width={18} height={18} />{children ?? t('contact.whatsapp')}</a>; }
export function CallButton({ children }) { const t = useT(); return <a className="btn btn-call" href={telHref(FIRM.phones[0])}><Phone size={18} />{children ?? t('contact.call')}</a>; }

export function ContactForm() {
  const t = useT();
  const [run, busy] = useAction();
  const [sent, setSent] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = Object.fromEntries(f.entries());
    const ok = await run(() => api('/contact', { method: 'POST', body, auth: false }));
    if (ok) setSent(true);
  };
  if (sent) return <div className="alert ok"><b>{t('contact.sentTitle')}</b> {t('contact.sentBody')}</div>;
  return (
    <form className="stack" onSubmit={submit}>
      <label className="field"><span>{t('contact.name')}</span><input className="input" name="name" required minLength={2} maxLength={80} autoComplete="name" /></label>
      <div className="contact-form-pair">
        <label className="field grow"><span>{t('settings.email')}</span><input className="input" type="email" name="email" required maxLength={120} autoComplete="email" /></label>
        <label className="field grow"><span>{t('contact.phoneOpt')}</span><input className="input" type="tel" name="phone" maxLength={30} autoComplete="tel" /></label>
      </div>
      <label className="field"><span>{t('contact.help')}</span><textarea className="textarea" name="message" required minLength={10} maxLength={3000} /></label>
      <input className="honeypot" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <button className="btn btn-gold" disabled={busy}>{busy ? t('contact.sending') : t('contact.send')}</button>
      <p className="hint">{t('contact.privacy')}</p>
    </form>
  );
}

export function ContactSection() {
  const t = useT();
  return (
    <div className="contact-grid">
      <div className="contact-card">
        <h2>{t('contact.title')}</h2>
        <p className="muted">{t('contact.intro')}</p>
        <div className="contact-location">
          <div className="contact-map">
            <iframe
              title={t('contact.mapTitle')}
              src={`https://maps.google.com/maps?q=${encodeURIComponent(FIRM.address)}&output=embed`}
              loading="lazy"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <div className="location-address"><MapPin size={19} /><span>{FIRM.address}</span></div>
        </div>
        <div className="contact-details">
          <div className="contact-line"><Phone size={19} /><div className="contact-phone-list">{FIRM.phones.map((p) => <a key={p} href={telHref(p)}>{p}</a>)}</div></div>
          <div className="contact-line"><Mail size={19} /><a href={`mailto:${FIRM.email}`}>{FIRM.email}</a></div>
        </div>
        <div className="cta-row"><WhatsAppButton /><CallButton /></div>
        <SocialLinks />
      </div>
      <div className="card"><ContactForm /></div>
    </div>
  );
}

