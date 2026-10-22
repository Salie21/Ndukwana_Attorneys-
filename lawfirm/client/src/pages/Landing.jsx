import { Link, Outlet } from 'react-router-dom';
import { Briefcase, Building2, FileSignature, Gavel, Home as HomeIcon, Landmark } from 'lucide-react';
import { Avatar } from '../components/ui';
import ChatWidget from '../components/ChatWidget';
import SiteFooter from '../components/SiteFooter';
import LanguageSelect from '../components/LanguageSelect';
import { Reveal, TiltCard } from '../components/effects';
import { ContactSection } from '../components/Contact';
import { useT } from '../i18n/I18nProvider';
import '../styles/landing.css';

export function SiteLayout() {
  const t = useT();
  return (
    <>
      <header className="site-nav">
        <div className="in">
          <Link to="/" className="brand"><img src="/logo-mark.png" alt="" style={{ width: 40 }} /><div><b>Ndukwana</b><small>Attorneys</small></div></Link>
          <nav className="links" aria-label="Site">
            <a href="/#services">{t('site.services')}</a><a href="/#team">{t('site.team')}</a><a href="/#process">{t('site.process')}</a><Link to="/contact">{t('site.contact')}</Link>
            <LanguageSelect compact id="site-language" />
            <Link className="btn btn-gold btn-sm" to="/login">{t('site.portal')}</Link>
          </nav>
        </div>
      </header>
      <Outlet />
      <SiteFooter />
      <ChatWidget />
    </>
  );
}

const AREAS = [
  ['estate', Landmark],
  ['corporate', Building2],
  ['conveyancing', HomeIcon],
  ['labour', Briefcase],
  ['litigation', Gavel],
  ['drafting', FileSignature],
];

const STEPS = ['s1', 's2', 's3', 's4'];

export function Home() {
  const t = useT();
  return (
    <>
      <section className="hero-site">
        <div className="wrap hero-grid">
          <div>
            <h1>{t('hero.title')}</h1>
            <p className="lead">{t('hero.lead')}</p>
            <div className="row wrap hero-actions">
              <Link className="btn btn-gold" to="/login">{t('hero.book')}</Link>
              <Link className="btn btn-ghost" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.35)' }} to="/contact">{t('hero.contact')}</Link>
            </div>
            <div className="fact-row"><span><b>2018</b>{t('hero.est')}</span><span><b>Johannesburg</b>{t('hero.office')}</span></div>
          </div>
          <div className="frame"><img src="/logo-mark.png" alt="Ndukwana Attorneys" /></div>
        </div>
      </section>

      <section className="section" id="services">
        <div className="wrap">
          <Reveal className="section-head"><h2>{t('services.title')}</h2><p>{t('services.sub')}</p></Reveal>
          <div className="practice">
            {AREAS.map(([id, Icon], i) => (
              <Reveal key={id} delay={i * 70}>
                <TiltCard as="article">
                  <span className="practice-icon"><Icon size={22} aria-hidden="true" /></span>
                  <h3>{t(`area.${id}.t`)}</h3>
                  <p>{t(`area.${id}.d`)}</p>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt" id="team">
        <div className="wrap">
          <Reveal className="section-head"><h2>{t('team.title')}</h2></Reveal>
          <div className="people">
            <Reveal><TiltCard className="person"><Avatar name="Bomikazi Ndukwana" size={64} /><div><h3>Adv. Bomikazi Ndukwana</h3><span className="role">{t('team.founder')}</span><p>{t('team.bomikazi')}</p></div></TiltCard></Reveal>
            <Reveal delay={90}><TiltCard className="person"><Avatar name="Khosi Sihunu" size={64} /><div><h3>Khosi Sihunu</h3><span className="role">{t('team.associate')}</span><p>{t('team.khosi')}</p></div></TiltCard></Reveal>
          </div>
        </div>
      </section>

      <section className="section" id="process">
        <div className="wrap">
          <Reveal className="section-head"><h2>{t('process.title')}</h2><p>{t('process.sub')}</p></Reveal>
          <ol className="flow">{STEPS.map((s, i) => <Reveal as="li" key={s} delay={i * 90}><b>{t(`process.${s}.t`)}</b><span>{t(`process.${s}.d`)}</span></Reveal>)}</ol>
          <div style={{ marginTop: 34 }}><Link className="btn btn-gold" to="/login">{t('process.cta')}</Link></div>
        </div>
      </section>

      <section className="section alt" id="contact"><div className="wrap"><ContactSection /></div></section>
    </>
  );
}

export function ContactPage() {
  return <section className="section"><div className="wrap"><ContactSection /></div></section>;
}
