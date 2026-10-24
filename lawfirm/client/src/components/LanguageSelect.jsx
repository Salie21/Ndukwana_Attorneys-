import { LANGUAGES } from '../i18n/languages';
import { useI18n } from '../i18n/I18nProvider';

// One picker used on the public site header, the profile page and client settings.
// `compact` is the small icon + dropdown for the header; the full version has a label and help text.
export default function LanguageSelect({ compact = false, id = 'language-select' }) {
  const { lang, setLang, t, status } = useI18n();
  const note = status === 'loading' ? t('lang.loading')
    : status === 'failed' ? t('lang.failed')
      : lang === 'sasl' ? t('lang.sasl')
        : lang !== 'en' ? t('lang.review') : '';

  const select = (
    <select id={id} className="select lang-select" value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t('lang.label')} aria-describedby={note ? `${id}-note` : undefined}>
      {LANGUAGES.map((l) => <option key={l.code} value={l.code} lang={l.code === 'sasl' ? 'en' : l.code}>{l.native}</option>)}
    </select>
  );

  if (compact) {
    return (
      <span className="lang-compact" title={t('lang.label')}>
        {select}
        {note && <span id={`${id}-note`} className="sr-only" role="status">{note}</span>}
      </span>
    );
  }
  return (
    <label className="field">
      <span>{t('lang.label')}</span>
      <span className="hint">{t('lang.help')}</span>
      {select}
      {note && <span id={`${id}-note`} className="hint" role="status">{note}</span>}
    </label>
  );
}
