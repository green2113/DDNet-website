import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { useI18n } from './I18nProvider';

export function RequireGuest({ children }) {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const location = useLocation();

  if(loading) {
    return (
      <main className="shell">
        <section className="panel">{t('common.loadingSession')}</section>
      </main>
    );
  }

  const params = new URLSearchParams(location.search);
  const isReauthFlow = params.get('reauth') === '1';

  if(user && !isReauthFlow) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
