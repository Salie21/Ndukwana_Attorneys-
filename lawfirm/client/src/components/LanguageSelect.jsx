import { LANGUAGES } from '../i18n/languages';
import { useI18n } from '../i18n/I18nProvider';
import Select from './Select';

// One picker used on the public site header, the profile page and client settings.
// `compact` is the small pill for the header; the full version has a label and help text.
export default function LanguageSelect({ compact = false, id = 'language-select' }) {
  const { lang, setLang, t } = useI18n();
  const note = lang === 'sasl' ? t('lang.sasl') : lang !== 'en' ? t('lang.review') : '';
  const options = LANGUAGES.map((l) => ({ value: l.code, label: l.native, lang: l.code === 'sasl' ? 'en' : l.code }));
  const select = (
    <Select id={id} variant={compact ? 'pill' : 'field'} value={lang} onChange={setLang} options={options} minMenuWidth={compact ? 220 : 0}
      aria-label={t('lang.label')} aria-describedby={note ? `${id}-note` : undefined} />
  );
  if (compact) return <span className="lang-compact" title={t('lang.label')}>{select}{note && <span id={`${id}-note`} className="sr-only" role="status">{note}</span>}</span>;
  return (
    <div className="field">
      <label htmlFor={id}><span>{t('lang.label')}</span></label>
      <span className="hint">{t('lang.help')}</span>
      {select}
      {note && <span id={`${id}-note`} className="hint" role="status">{note}</span>}
    </div>
  );
}
