import { browser } from 'wxt/browser';
import { useI18n, type LangPref } from '../../../src/i18n';

const REPO_URL = 'https://github.com/firevenus/TabPocket';
const ISSUES_URL = 'https://github.com/firevenus/TabPocket/issues';

const LANGS: { value: LangPref; label: string }[] = [
  { value: 'auto', label: '' }, // 文案取自词典
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
];

export default function AboutView() {
  const { t, pref, setPref } = useI18n();
  const version = browser.runtime.getManifest().version;

  return (
    <div className="about-view">
      <img className="about-logo" src="icon/128.png" alt="TabPocket" />
      <h2 className="about-name">{t('about.name')}</h2>
      <p className="about-slogan">{t('about.slogan')}</p>

      <p className="about-desc">
        {t('about.desc')
          .split('\n')
          .map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {line}
            </span>
          ))}
      </p>

      <div className="about-version">{t('about.version', { v: version })}</div>

      <div className="about-lang">
        <span className="about-lang-label">{t('about.language')}</span>
        {LANGS.map((l) => (
          <button
            key={l.value}
            type="button"
            className={pref === l.value ? 'tag-chip active' : 'tag-chip'}
            onClick={() => void setPref(l.value)}
          >
            {l.value === 'auto' ? t('about.langAuto') : l.label}
          </button>
        ))}
      </div>

      <a className="about-link" href={REPO_URL} target="_blank" rel="noreferrer">
        {t('about.repo')}
      </a>

      <p className="about-invite">{t('about.invite')}</p>
      <a className="about-link" href={ISSUES_URL} target="_blank" rel="noreferrer">
        {t('about.issues')}
      </a>

      <p className="about-foot">{t('about.foot')}</p>
    </div>
  );
}
