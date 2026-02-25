import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TopBar } from '../components/Layout';
import { getMySubscription } from '../lib/api';

function formatDate(value) {
  const text = String(value || '').trim();
  if(!text) {
    return '-';
  }
  const ms = Date.parse(text);
  if(!Number.isFinite(ms)) {
    return text;
  }
  return new Date(ms).toLocaleString();
}

export default function PlanStorePage() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [subscription, setSubscription] = useState(null);
  const [patreonConnected, setPatreonConnected] = useState(false);

  const joinUrl = String(import.meta.env.VITE_PATREON_JOIN_URL || '').trim();
  const queryResult = useMemo(() => new URLSearchParams(location.search).get('patreon') || '', [location.search]);

  useEffect(() => {
    if(queryResult === 'error') {
      setFeedback('Patreon link failed. Please try again.');
    } else {
      setFeedback('');
    }
  }, [queryResult]);

  const refreshStatus = async () => {
    setLoading(true);
    try {
      const result = await getMySubscription();
      setSubscription(result?.subscription || null);
      setPatreonConnected(!!result?.patreonConnected);
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  const onConnect = () => {
    window.location.assign('/api/billing/patreon/start');
  };

  const subscriptionStatus = String(subscription?.status || 'INACTIVE');
  const showLinkedBanner = queryResult === 'linked' && patreonConnected;

  return (
    <main className="shell">
      <TopBar right={<Link className="btn ghost" to="/dashboard">Dashboard</Link>} />

      <section className="hero">
        <p className="eyebrow">Billing</p>
        <h1>Subscription Plans</h1>
        <p className="lead">Ravion Plus is managed via Patreon.</p>
      </section>

      {showLinkedBanner ? (
        <section className="patreon-linked-banner" role="status" aria-live="polite">
          <span className="patreon-linked-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-1.15 14.55-3.5-3.5 1.4-1.4 2.1 2.1 4.35-4.35 1.4 1.4Z" />
            </svg>
          </span>
          <span>페트리온 연결됨</span>
        </section>
      ) : null}

      {feedback ? <section className="result error">{feedback}</section> : null}

      <section className="plan-grid">
        <article className="panel plan-card">
          <h3>Ravion Plus</h3>
          <p className="plan-price">Patreon</p>
          <ul className="plan-features">
            <li>Connect your Patreon account</li>
            <li>Plus is active only for allowed Patreon tiers</li>
            <li>Status sync is automatic (webhook + lazy refresh)</li>
          </ul>

          <div className="plan-meta">
            <p><strong>Plan status:</strong> {loading ? 'Loading...' : subscriptionStatus}</p>
            <p><strong>Current period end:</strong> {loading ? 'Loading...' : formatDate(subscription?.current_period_end)}</p>
          </div>

          <div className="plan-actions">
            {!patreonConnected ? (
              <button className="btn block" type="button" onClick={onConnect}>
                Connect Patreon
              </button>
            ) : null}
            {joinUrl ? (
              <a className="btn block ghost" href={joinUrl} target="_blank" rel="noreferrer">
                Open Patreon Join Page
              </a>
            ) : (
              <button className="btn block ghost" type="button" disabled>Set `VITE_PATREON_JOIN_URL`</button>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
