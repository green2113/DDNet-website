import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentGameCode, rotateGameCode } from '../lib/api';
import { useAuth } from '../components/AuthProvider';
import { useI18n } from '../components/I18nProvider';
import { Feedback, TopBar } from '../components/Layout';

function maskEmail(value) {
  const email = String(value || '');
  const at = email.indexOf('@');
  if(at <= 0) {
    return '-';
  }

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if(!domain) {
    return '-';
  }

  const visibleCount = Math.min(3, local.length);
  const visible = local.slice(0, visibleCount);
  const hiddenLength = Math.max(1, local.length - visibleCount);
  return `${visible}${'*'.repeat(hiddenLength)}@${domain}`;
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M12 5c5.6 0 9.6 4.9 10.7 6.4.4.5.4 1.2 0 1.7C21.6 14.6 17.6 19.5 12 19.5S2.4 14.6 1.3 13.1a1.45 1.45 0 0 1 0-1.7C2.4 9.9 6.4 5 12 5Zm0 2C7.9 7 4.7 10.2 3.4 12c1.3 1.8 4.5 5 8.6 5s7.3-3.2 8.6-5C19.3 10.2 16.1 7 12 7Zm0 2.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6Z" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="m2.7 2 19.3 19.3-1.4 1.4-3.1-3.1a12.88 12.88 0 0 1-5.5 1.3C6.4 21 2.4 16.1 1.3 14.6a1.45 1.45 0 0 1 0-1.7A19.5 19.5 0 0 1 7 7.8L1.3 2.1 2.7 2Zm9.3 5c4.1 0 7.3 3.2 8.6 5a15.38 15.38 0 0 1-4.5 3.8l-2.1-2.1a2.8 2.8 0 0 0-3.7-3.7L8.2 8a11.82 11.82 0 0 1 3.8-1Zm0 4a1 1 0 0 1 1 1c0 .2-.1.5-.2.7l-1.5-1.5c.2-.1.5-.2.7-.2Z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M8 3h10a2 2 0 0 1 2 2v12h-2V5H8V3ZM5 7h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm0 2v10h10V9H5Z" />
    </svg>
  );
}

export default function DashboardPage() {
  const { user, refresh, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState(null);
  const [gameCode, setGameCode] = useState('');
  const [loadingCode, setLoadingCode] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [rotating, setRotating] = useState(false);

  const rows = useMemo(() => ([
    [t('dashboard.rowUsername'), user?.username],
    [t('dashboard.rowEmail'), maskEmail(user?.email)],
  ]), [t, user]);

  const onRotate = async () => {
    setFeedback(null);
    setRotating(true);
    try {
      const result = await rotateGameCode();
      setGameCode(result.code || '');
      setRevealed(true);
      await refresh();
      setFeedback({ type: 'ok', message: t('dashboard.rotated') });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setRotating(false);
    }
  };

  useEffect(() => {
    let canceled = false;
    const loadCurrentCode = async () => {
      setLoadingCode(true);
      try {
        const data = await getCurrentGameCode();
        if(!canceled) {
          setGameCode(String(data.code || ''));
        }
      } catch (err) {
        if(!canceled) {
          setFeedback({ type: 'error', message: err.message });
        }
      } finally {
        if(!canceled) {
          setLoadingCode(false);
        }
      }
    };
    loadCurrentCode();
    return () => {
      canceled = true;
    };
  }, []);

  const onCopyCode = async () => {
    if(!gameCode) {
      return;
    }
    try {
      await navigator.clipboard.writeText(gameCode);
      setFeedback({ type: 'ok', message: t('dashboard.copied') });
    } catch {
      setFeedback({ type: 'error', message: t('dashboard.copyFailed') });
    }
  };

  const displayCode = loadingCode
    ? '••••••••••••••••••••'
    : (!gameCode ? '-' : (revealed ? gameCode : '•'.repeat(gameCode.length)));

  const onLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  return (
    <main className="shell">
      <TopBar
        right={
          <button className="btn" type="button" onClick={onLogout}>{t('common.logout')}</button>
        }
      />

      <section className="hero">
        <p className="eyebrow">{t('dashboard.eyebrow')}</p>
        <h1>{t('dashboard.title')}</h1>
        <p className="lead">{t('dashboard.lead')}</p>
      </section>

      <section className="feature-grid dash-grid">
        <article className="panel">
          <h3>{t('dashboard.accountTitle')}</h3>
          <dl className="info">
            {rows.map(([key, value]) => (
              <Fragment key={key}>
                <dt>{key}</dt>
                <dd>{value ?? '-'}</dd>
              </Fragment>
            ))}
          </dl>
        </article>

        <article className="panel">
          <h3>{t('dashboard.inviteTitle')}</h3>
          <p className="muted">{t('dashboard.inviteBody')}</p>
          <pre className="mono">{user?.invite_code || '-'}</pre>
          <p className="muted">{t('dashboard.inviteUsage', { used: user?.invite_used ?? 0, quota: user?.invite_quota ?? 0 })}</p>
        </article>

        <article className="panel">
          <h3>{t('dashboard.gameCodeTitle')}</h3>
          <p className="muted">{t('dashboard.gameCodeBody')}</p>
          <div className="code-line">
            <pre className="mono code-mono">{displayCode}</pre>
            <div className="code-actions">
              <button
                className="btn ghost icon-btn"
                type="button"
                onClick={() => setRevealed((prev) => !prev)}
                disabled={!gameCode || loadingCode}
                title={revealed ? t('dashboard.hideCode') : t('dashboard.showCode')}
              >
                {revealed ? <EyeOffIcon /> : <EyeIcon />}
              </button>
              <button
                className="btn ghost icon-btn"
                type="button"
                onClick={onCopyCode}
                disabled={!gameCode || loadingCode}
                title={t('dashboard.copyCode')}
              >
                <CopyIcon />
              </button>
            </div>
          </div>
          {!loadingCode && !gameCode ? <p className="muted">{t('dashboard.noCurrentCode')}</p> : null}
          <button className="btn" type="button" onClick={onRotate} disabled={rotating}>
            {rotating ? t('dashboard.rotating') : t('dashboard.rotate')}
          </button>
          {gameCode ? <pre className="mono">{t('dashboard.newCodeInGame')}: /login {gameCode}</pre> : null}
        </article>
      </section>

      <section className="panel">
        <h3>{t('dashboard.inGameTitle')}</h3>
        <ol className="steps">
          <li>{t('dashboard.step1')}</li>
          <li>{t('dashboard.step2')}</li>
          <li>{t('dashboard.step3')}</li>
        </ol>
      </section>

      <Feedback feedback={feedback} />
    </main>
  );
}
