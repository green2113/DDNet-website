import { Link } from 'react-router-dom';
import { useI18n } from './I18nProvider';

export function LanguageSelector() {
  const { language, setLanguage, languages } = useI18n();

  return (
    <label className="lang-select">
      <select aria-label="language-selector" value={language} onChange={(e) => setLanguage(e.target.value)}>
        {languages.map((item) => (
          <option key={item.code} value={item.code}>{item.label}</option>
        ))}
      </select>
    </label>
  );
}

export function TopBar({ right }) {
  return (
    <header className="topbar">
      <Link className="brand" to="/">DDNet Portal</Link>
      <div className="top-actions">
        <LanguageSelector />
        <nav className="top-actions-nav">{right}</nav>
      </div>
    </header>
  );
}

export function BackgroundOrbs() {
  return (
    <>
      <div className="bg-orb orb-a" />
      <div className="bg-orb orb-b" />
    </>
  );
}

export function Feedback({ feedback }) {
  if(!feedback) return null;
  return <section className={`result ${feedback.type}`}>{feedback.message}</section>;
}
