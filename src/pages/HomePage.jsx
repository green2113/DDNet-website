import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useI18n } from '../components/I18nProvider';
import { Feedback, TopBar } from '../components/Layout';

export default function HomePage() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const [feedback, setFeedback] = useState(null);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      setFeedback({ type: 'ok', message: t('home.logoutDone') });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  return (
    <main className="shell">
      <TopBar
        right={
          user ? (
            <>
              <button className="btn" type="button" onClick={() => navigate('/dashboard')}>{t('common.dashboard')}</button>
              <button className="btn ghost" type="button" onClick={handleLogout}>{t('common.logout')}</button>
            </>
          ) : (
            <>
              <Link className="btn ghost" to="/login">{t('common.login')}</Link>
              <Link className="btn" to="/register">{t('common.register')}</Link>
            </>
          )
        }
      />

      <section className="hero home-hero">
        <p className="eyebrow">{t('home.eyebrow')}</p>
        <h1>{t('home.title')}</h1>
        <p className="lead">
          {t('home.lead')}
        </p>
        <div className="hero-actions">
          {user ? (
            <>
              <Link className="btn" to="/dashboard">{t('home.openDashboard')}</Link>
              <Link className="btn ghost" to="/register">{t('home.createAnother')}</Link>
            </>
          ) : (
            <>
              <Link className="btn" to="/login">{t('home.startLogin')}</Link>
              <Link className="btn ghost" to="/register">{t('home.createNew')}</Link>
            </>
          )}
        </div>
      </section>

      <section className="feature-grid">
        <article className="panel feature">
          <h3>{t('home.featureAccountTitle')}</h3>
          <p>{t('home.featureAccountBody')}</p>
        </article>
        <article className="panel feature">
          <h3>{t('home.featureCodeTitle')}</h3>
          <p>{t('home.featureCodeBody')}</p>
        </article>
        <article className="panel feature">
          <h3>{t('home.featureGameTitle')}</h3>
          <p>{t('home.featureGameBody')}</p>
        </article>
      </section>

      <Feedback feedback={feedback} />
    </main>
  );
}
