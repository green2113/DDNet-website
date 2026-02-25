import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TopBar } from '../components/Layout';
import { getMySubscription } from '../lib/api';

export default function PlanStorePage() {
  const location = useLocation();
  const [feedback, setFeedback] = useState('');
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
    try {
      const result = await getMySubscription();
      setPatreonConnected(!!result?.patreonConnected);
    } catch (err) {
      setFeedback(err.message);
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  const onConnect = () => {
    window.location.assign('/api/billing/patreon/start');
  };
  const showLinkedBanner = queryResult === 'linked' && patreonConnected;

  return (
    <main className="shell">
      <TopBar right={<Link className="btn ghost" to="/dashboard">Dashboard</Link>} />

      <section className="hero">
        <p className="eyebrow">Billing</p>
        <h1>Subscription Plans</h1>
        <p className="lead">모든 구독 플랜은 Patreon에서 결제 및 관리됩니다.</p>
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
          <p className="plan-price">$2.99 / month</p>
          <ul className="plan-features">
            <li>3종 트레일 사용 가능</li>
            <li>이름 변경 쿨타임 감소 (10일 → 1일)</li>
            <li>초대 코드 발급 제한 증가 (기본값 → 20회)</li>
            <li>Ravion Starter의 모든 혜택 포함</li>
            <li>Patreon 허용 티어 + 활성 구독 시 자동 적용</li>
          </ul>

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

        <article className="panel plan-card">
          <h3>Ravion Starter</h3>
          <p className="plan-price">$1.99 / month</p>
          <ul className="plan-features">
            <li>이름 변경 쿨타임 감소 (10일 → 3일)</li>
            <li>초대 코드 발급 제한 증가 (3회 → 10회)</li>
            <li>Patreon 허용 티어 + 활성 구독 시 자동 적용</li>
          </ul>

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
