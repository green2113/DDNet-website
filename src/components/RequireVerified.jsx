import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { useI18n } from './I18nProvider';

export function RequireVerified({ children }) {
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
  if(Number(user.email_verified || 0) !== 1) {
    return <Navigate to="/verify-email" replace />;
  }
  return children;
}
