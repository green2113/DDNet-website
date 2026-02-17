import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from './I18nProvider';

export function LanguageSelector() {
  const { language, setLanguage, languages } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = languages.find((item) => item.code === language) || languages[0];

  useEffect(() => {
    const onDocClick = (event) => {
      if(rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onEscape = (event) => {
      if(event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  return (
    <div className="lang-select" ref={rootRef}>
      <button
        className="lang-trigger"
        type="button"
        aria-label="language-selector"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={`fi fi-${selected.flag}`} />
        <span>{selected.label}</span>
      </button>
      {open ? (
        <div className="lang-menu" role="menu">
          {languages.map((item) => (
            <button
              key={item.code}
              className="lang-option"
              type="button"
              onClick={() => {
                setLanguage(item.code);
                setOpen(false);
              }}
            >
              <span className={`fi fi-${item.flag}`} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
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
