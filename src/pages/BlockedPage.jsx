import { Link } from 'react-router-dom';
import { useI18n } from '../components/I18nProvider';
import { TopBar } from '../components/Layout';

export default function BlockedPage() {
  const { t } = useI18n();

  return (
    <main className="shell">
      <TopBar
        right={(
          <>
            <Link className="btn ghost" to="/">{t('common.home')}</Link>
            <Link className="btn" to="/login">{t('common.login')}</Link>
          </>
        )}
      />
      <section className="panel auth-card">
        <p className="eyebrow">{t('blocked.eyebrow')}</p>
        <h1>{t('blocked.title')}</h1>
        <p className="muted">{t('blocked.body')}</p>
        <div className="hero-actions">
          <Link className="btn" to="/">{t('common.home')}</Link>
          <Link className="btn ghost" to="/login">{t('common.retry')}</Link>
        </div>
      </section>
    </main>
  );
}
