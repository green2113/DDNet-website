import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TopBar } from '../components/Layout';
import { disconnectPatreon, getMySubscription } from '../lib/api';

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
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [subscription, setSubscription] = useState(null);
  const [patreonConnected, setPatreonConnected] = useState(false);

  const joinUrl = String(import.meta.env.VITE_PATREON_JOIN_URL || '').trim();
  const queryResult = useMemo(() => new URLSearchParams(location.search).get('patreon') || '', [location.search]);

  useEffect(() => {
    if(queryResult === 'linked') {
      setFeedback('Patreon account linked successfully.');
    } else if(queryResult === 'error') {
      setFeedback('Patreon link failed. Please try again.');
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

  const onDisconnect = async () => {
    setBusy(true);
    setFeedback('');
    try {
      await disconnectPatreon();
      await refreshStatus();
      setFeedback('Patreon account disconnected.');
    } catch (err) {
      setFeedback(err.message);
    } finally {
      setBusy(false);
    }
  };

  const subscriptionStatus = String(subscription?.status || 'INACTIVE');

  return (
    <main className="shell">
      <TopBar right={<Link className="btn ghost" to="/dashboard">Dashboard</Link>} />

      <section className="hero">
        <p className="eyebrow">Billing</p>
        <h1>Subscription Plans</h1>
        <p className="lead">Ravion Plus is managed via Patreon.</p>
      </section>

      {feedback ? <section className="result info">{feedback}</section> : null}

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
            <p><strong>Patreon linked:</strong> {patreonConnected ? 'Yes' : 'No'}</p>
            <p><strong>Plan status:</strong> {loading ? 'Loading...' : subscriptionStatus}</p>
            <p><strong>Current period end:</strong> {loading ? 'Loading...' : formatDate(subscription?.current_period_end)}</p>
          </div>

          <div className="plan-actions">
            <button className="btn block" type="button" onClick={onConnect} disabled={busy}>
              Connect Patreon
            </button>
            {joinUrl ? (
              <a className="btn block ghost" href={joinUrl} target="_blank" rel="noreferrer">
                Open Patreon Join Page
              </a>
            ) : (
              <button className="btn block ghost" type="button" disabled>Set `VITE_PATREON_JOIN_URL`</button>
            )}
            {patreonConnected ? (
              <button className="btn block ghost" type="button" onClick={onDisconnect} disabled={busy}>
                Disconnect Patreon
              </button>
            ) : null}
          </div>
        </article>
      </section>
    </main>
  );
}
