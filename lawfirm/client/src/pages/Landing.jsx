import { Link, Outlet } from 'react-router-dom';
import { Avatar } from '../components/ui';
import ChatWidget from '../components/ChatWidget';
import { ContactSection, SocialLinks } from '../components/Contact';
import { FIRM } from '../lib/firm';
import '../styles/landing.css';

export function SiteLayout() {
  return (
    <>
      <header className="site-nav">
        <div className="in">
          <Link to="/" className="brand"><img src="/logo-mark.png" alt="" style={{ width: 40 }} /><div><b>Ndukwana</b><small>Attorneys</small></div></Link>
          <nav className="links" aria-label="Site">
            <a href="/#services">Services</a><a href="/#team">Team</a><a href="/#process">How it works</a><Link to="/contact">Contact</Link>
            <Link className="btn btn-gold btn-sm" to="/login">Client portal</Link>
          </nav>
        </div>
      </header>
      <Outlet />
      <footer className="site-foot">
        <div className="wrap in">
          <span>© {new Date().getFullYear()} {FIRM.name}. {FIRM.address}.</span>
          <SocialLinks />
          <Link to="/staff">Team sign in</Link>
        </div>
      </footer>
      <ChatWidget />
    </>
  );
}

const AREAS = [
  ['Estate planning and administration', 'Wills, planning and the administration of deceased estates. About 60% of our work, handled with care for the families involved.'],
  ['Corporate and commercial law', 'Governance, contracts, regulatory and procurement matters, and compliance advice for businesses and public bodies.'],
  ['Conveyancing', 'Property transfers and the legal documentation behind buying and selling property.'],
  ['Labour and employment', 'Resolving workplace disputes and advising employers and employees.'],
  ['Litigation', 'Civil and property litigation, including default and summary judgments in the magistrates’ and high courts.'],
  ['Agreements, opinions and FICA', 'Drafting agreements, written legal opinions and FICA compliance support.'],
];

const STEPS = [
  ['Create an account', 'Register free with your email or Google.'],
  ['Choose your case type', 'We show the attorneys who handle it.'],
  ['Describe and book', 'Add a short description and pick a time.'],
  ['Get confirmation', 'You are notified when it is approved. Upload documents any time.'],
];

export function Home() {
  return (
    <>
      <section className="hero-site">
        <div className="wrap hero-grid">
          <div>
            <h1>Bespoke legal solutions for every client.</h1>
            <p className="lead">Ndukwana Attorneys is a black female-owned boutique law firm in Johannesburg, serving private and public sector clients across South Africa.</p>
            <div className="row wrap">
              <Link className="btn btn-gold" to="/login">Book a consultation</Link>
              <Link className="btn btn-ghost" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.35)' }} to="/contact">Contact the firm</Link>
            </div>
            <div className="fact-row"><span><b>2018</b>established</span><span><b>Johannesburg</b>Marshalltown office</span></div>
          </div>
          <div className="frame"><img src="/logo-mark.png" alt="Ndukwana Attorneys" /></div>
        </div>
      </section>

      <section className="section" id="services">
        <div className="wrap">
          <div className="section-head"><h2>What we do</h2><p>Focused on the matters that shape families and businesses.</p></div>
          <div className="practice">{AREAS.map(([t, d]) => <article key={t}><h3>{t}</h3><p>{d}</p></article>)}</div>
        </div>
      </section>

      <section className="section alt" id="team">
        <div className="wrap">
          <div className="section-head"><h2>The people you will work with</h2></div>
          <div className="people">
            <div className="person"><Avatar name="Bomikazi Ndukwana" size={64} /><div><h3>Adv. Bomikazi Ndukwana</h3><span className="role">Founder and director</span><p>LLB (University of Zululand) with over six years’ experience as an estate administration attorney and a corporate and civil litigation specialist. Expertise in corporate governance, regulatory and procurement law, and employment law.</p></div></div>
            <div className="person"><Avatar name="Khosi Sihunu" size={64} /><div><h3>Khosi Sihunu</h3><span className="role">Advocate and strategic associate</span><p>Experience in international corporate law and contracts, corporate commercial law, general litigation, drafting court documents and criminal law litigation.</p></div></div>
          </div>
        </div>
      </section>

      <section className="section" id="process">
        <div className="wrap">
          <div className="section-head"><h2>Book online in four steps</h2><p>Your documents and case details stay private in your client account.</p></div>
          <ol className="flow">{STEPS.map(([t, d]) => <li key={t}><b>{t}</b><span>{d}</span></li>)}</ol>
          <div style={{ marginTop: 34 }}><Link className="btn btn-gold" to="/login">Create your account</Link></div>
        </div>
      </section>

      <section className="section alt" id="contact"><div className="wrap"><ContactSection /></div></section>
    </>
  );
}

export function ContactPage() {
  return <section className="section"><div className="wrap"><ContactSection /></div></section>;
}
