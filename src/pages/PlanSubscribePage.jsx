import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TopBar } from '../components/Layout';

export default function PlanSubscribePage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/billing/plans', { replace: true });
  }, [navigate]);

  return (
    <main className="shell">
      <TopBar right={<Link className="btn ghost" to="/billing/plans">Back to Plans</Link>} />
      <section className="hero">
        <p className="eyebrow">Billing</p>
        <h1>Redirecting…</h1>
        <p className="lead">Subscription checkout moved to the plans page.</p>
      </section>
    </main>
  );
}
