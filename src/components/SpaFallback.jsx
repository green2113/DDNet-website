import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { RequireAuth } from './RequireAuth';
import { useI18n } from './I18nProvider';
import DashboardPage from '../pages/DashboardPage';
import PlanStorePage from '../pages/PlanStorePage';
import PlanSubscribePage from '../pages/PlanSubscribePage';

function normalizePath(pathname) {
  const trimmed = String(pathname || '').replace(/\/+$/, '');
  return trimmed || '/';
}

export function SpaFallback() {
  const location = useLocation();
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const path = normalizePath(location.pathname);

  if(loading) {
    return (
      <main className="shell">
        <section className="panel">{t('common.loadingSession')}</section>
      </main>
    );
  }

  if(path === '/dashboard' || path.startsWith('/dashboard/')) {
    return (
      <RequireAuth>
        <DashboardPage />
      </RequireAuth>
    );
  }

  if(path === '/billing/plans' || path.startsWith('/billing/plans/')) {
    return (
      <RequireAuth>
        <PlanStorePage />
      </RequireAuth>
    );
  }

  if(path === '/billing/subscribe' || path.startsWith('/billing/subscribe/')) {
    return (
      <RequireAuth>
        <PlanSubscribePage />
      </RequireAuth>
    );
  }

  if(user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/" replace />;
}
