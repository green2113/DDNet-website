import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { useI18n } from './I18nProvider';
import { readReturnUrl } from '../lib/redirect';

export function RequireGuest({ children }) {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const returnUrl = readReturnUrl();

  useEffect(() => {
    if(!loading && user && returnUrl) {
      window.location.replace(returnUrl);
    }
  }, [loading, user, returnUrl]);

  if(loading) {
    return (
      <main className="shell">
        <section className="panel">{t('common.loadingSession')}</section>
      </main>
    );
  }

  if(user) {
    if(returnUrl) {
      return (
        <main className="shell">
          <section className="panel">{t('common.loadingSession')}</section>
        </main>
      );
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
