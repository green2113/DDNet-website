import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TopBar } from '../components/Layout';
import { useI18n } from '../components/I18nProvider';
import { getMySubscription } from '../lib/api';

export default function PlanStorePage() {
  const location = useLocation();
  const { t } = useI18n();
  const [feedback, setFeedback] = useState('');
  const [patreonConnected, setPatreonConnected] = useState(false);

  const joinUrl = String(import.meta.env.VITE_PATREON_JOIN_URL || '').trim();
  const queryResult = useMemo(() => new URLSearchParams(location.search).get('patreon') || '', [location.search]);

  useEffect(() => {
    if(queryResult === 'error') {
      setFeedback(t('plans.feedbackLinkFailed'));
    } else {
      setFeedback('');
    }
  }, [queryResult, t]);

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
      <TopBar right={<Link className="btn ghost" to="/dashboard">{t('common.dashboard')}</Link>} />

      <section className="hero">
        <p className="eyebrow">{t('plans.eyebrow')}</p>
        <h1>{t('plans.title')}</h1>
        <p className="lead">{t('plans.lead')}</p>
      </section>

      {showLinkedBanner ? (
        <section className="patreon-linked-banner" role="status" aria-live="polite">
          <span className="patreon-linked-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-1.15 14.55-3.5-3.5 1.4-1.4 2.1 2.1 4.35-4.35 1.4 1.4Z" />
            </svg>
          </span>
          <span>{t('plans.linkedBanner')}</span>
        </section>
      ) : null}

      {feedback ? <section className="result error">{feedback}</section> : null}

      <section className="plan-grid">
        <article className="panel plan-card">
          <h3>{t('plans.plusName')}</h3>
          <p className="plan-price">{t('plans.plusPrice')}</p>
          <ul className="plan-features">
            <li>{t('plans.plusFeatureTrail')}</li>
            <li>{t('plans.plusFeatureNameCooldown')}</li>
            <li>{t('plans.plusFeatureInvite')}</li>
            <li>{t('plans.plusFeatureIncludesStarter')}</li>
            <li>{t('plans.plusFeatureAutoApply')}</li>
          </ul>

          <div className="plan-actions">
            {!patreonConnected ? (
              <button className="btn block" type="button" onClick={onConnect}>
                {t('plans.connectPatreon')}
              </button>
            ) : null}
            {joinUrl ? (
              <a className="btn block ghost" href={joinUrl} target="_blank" rel="noreferrer">
                {t('plans.openPatreonJoin')}
              </a>
            ) : (
              <button className="btn block ghost" type="button" disabled>{t('plans.setJoinUrl')}</button>
            )}
          </div>
        </article>

        <article className="panel plan-card">
          <h3>{t('plans.starterName')}</h3>
          <p className="plan-price">{t('plans.starterPrice')}</p>
          <ul className="plan-features">
            <li>{t('plans.starterFeatureNameCooldown')}</li>
            <li>{t('plans.starterFeatureInvite')}</li>
            <li>{t('plans.starterFeatureAutoApply')}</li>
          </ul>

          <div className="plan-actions">
            {!patreonConnected ? (
              <button className="btn block" type="button" onClick={onConnect}>
                {t('plans.connectPatreon')}
              </button>
            ) : null}
            {joinUrl ? (
              <a className="btn block ghost" href={joinUrl} target="_blank" rel="noreferrer">
                {t('plans.openPatreonJoin')}
              </a>
            ) : (
              <button className="btn block ghost" type="button" disabled>{t('plans.setJoinUrl')}</button>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
