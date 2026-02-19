import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { useI18n } from './I18nProvider';

export function RequireGuest({ children }) {
  const { user, loading } = useAuth();
  const { t } = useI18n();

  if(loading) {
    return (
      <main className="shell">
        <section className="panel">{t('common.loadingSession')}</section>
      </main>
    );
  }

  if(user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
