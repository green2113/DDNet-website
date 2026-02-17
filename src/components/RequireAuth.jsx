import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { useI18n } from './I18nProvider';

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const { t } = useI18n();

  if(loading) {
    return (
      <main className="shell">
        <section className="panel">{t('common.loadingSession')}</section>
      </main>
    );
  }

  if(!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
