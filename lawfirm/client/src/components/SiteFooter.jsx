import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone } from 'lucide-react';
import { FIRM, telHref, waHref } from '../lib/firm';
import { SOCIAL_ICONS, WhatsAppIcon } from './Icons';
import { Reveal } from './effects';
import { useT } from '../i18n/I18nProvider';

// Footer laid out like SmoothUI's "footer simple": brand + social icons, link columns, copyright bar,
// each block fading in one after the other.
export default function SiteFooter() {
  const t = useT();
  return (
    <footer className="site-foot">
      <div className="wrap">
        <div className="foot-grid">
          <Reveal className="foot-brand" delay={0}>
            <Link to="/" className="brand"><img src="/logo-mark.png" alt="" style={{ width: 40 }} /><div><b>Ndukwana</b><small>Attorneys</small></div></Link>
            <p>{t('footer.about')}</p>
            <div className="foot-social">
              {FIRM.socials.map((s) => { const I = SOCIAL_ICONS[s.id]; return <a key={s.id} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}><I width={18} height={18} /></a>; })}
              <a href={waHref()} target="_blank" rel="noopener noreferrer" aria-label={t('footer.whatsapp')}><WhatsAppIcon width={18} height={18} /></a>
            </div>
          </Reveal>

          <Reveal className="foot-col" delay={120}>
            <h4>{t('footer.firm')}</h4>
            <ul>
              <li><a href="/#services">{t('site.services')}</a></li>
              <li><a href="/#team">{t('site.team')}</a></li>
              <li><a href="/#process">{t('site.process')}</a></li>
              <li><Link to="/contact">{t('site.contact')}</Link></li>
              <li><Link to="/login">{t('site.portal')}</Link></li>
            </ul>
          </Reveal>

          <Reveal className="foot-col" delay={240}>
            <h4>{t('footer.reach')}</h4>
            <ul className="foot-contact">
              <li><MapPin size={16} aria-hidden="true" /><span>{FIRM.address}</span></li>
              {FIRM.phones.map((p) => <li key={p}><Phone size={16} aria-hidden="true" /><a href={telHref(p)}>{p}</a></li>)}
              <li><Mail size={16} aria-hidden="true" /><a href={`mailto:${FIRM.email}`}>{FIRM.email}</a></li>
            </ul>
          </Reveal>
        </div>

        <Reveal className="foot-bar" delay={360}>
          <span>© {new Date().getFullYear()} {FIRM.name}. {t('footer.rights')}</span>
        </Reveal>
      </div>
    </footer>
  );
}
