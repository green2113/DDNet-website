import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();

  if(loading) {
    return (
      <main className="shell">
        <section className="panel">세션 확인 중...</section>
      </main>
    );
  }

  if(!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
