import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentGameCode, rotateGameCode, updateProfileName } from '../lib/api';
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

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="M3 17.2V21h3.8l11-11.1-3.8-3.8L3 17.2Zm17.7-10.1a1 1 0 0 0 0-1.4l-2.4-2.4a1 1 0 0 0-1.4 0l-1.9 1.9 3.8 3.8 1.9-2Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="m9.1 16.6-4.2-4.2 1.4-1.4 2.8 2.8 8.6-8.6 1.4 1.4-10 10Z" />
    </svg>
  );
}

function ToastCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-1.1 14.6-3.5-3.5 1.4-1.4 2.1 2.1 4.3-4.3 1.4 1.4Z" />
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
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);
  const [nameForm, setNameForm] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [showCopyToast, setShowCopyToast] = useState(false);

  const currentName = String(user?.username || '');
  const trimmedName = nameForm.trim();
  const canSaveName = editingName && !savingName && trimmedName.length > 0 && trimmedName !== currentName;

  useEffect(() => {
    setNameForm(currentName);
    setEditingName(false);
  }, [currentName]);

  useEffect(() => {
    if(!showCopyToast) {
      return undefined;
    }
    const timer = setTimeout(() => setShowCopyToast(false), 1800);
    return () => clearTimeout(timer);
  }, [showCopyToast]);

  const executeRotate = async () => {
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

  const onRotateClick = () => {
    if(rotating || loadingCode) {
      return;
    }

    if(gameCode) {
      setShowRotateConfirm(true);
      return;
    }

    executeRotate();
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
      setShowCopyToast(false);
      requestAnimationFrame(() => setShowCopyToast(true));
    } catch {
      setFeedback({ type: 'error', message: t('dashboard.copyFailed') });
    }
  };

  const saveName = async () => {
    if(!canSaveName) {
      return;
    }
    setSavingName(true);
    setFeedback(null);
    try {
      await updateProfileName({ name: trimmedName });
      await refresh();
      setEditingName(false);
      setFeedback({ type: 'ok', message: t('dashboard.nameUpdated') });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSavingName(false);
    }
  };

  const onNameAction = () => {
    if(editingName) {
      saveName();
      return;
    }
    setNameForm(currentName);
    setEditingName(true);
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

      {showCopyToast ? (
        <section className="copy-toast" role="status" aria-live="polite">
          <span className="copy-toast-icon"><ToastCheckIcon /></span>
          <span>{t('dashboard.copyToast')}</span>
        </section>
      ) : null}

      <section className="hero">
        <p className="eyebrow">{t('dashboard.eyebrow')}</p>
        <h1>{t('dashboard.title')}</h1>
        <p className="lead">{t('dashboard.lead')}</p>
      </section>

      <section className="feature-grid dash-grid">
        <article className="panel">
          <h3>{t('dashboard.accountTitle')}</h3>
          <dl className="info">
            <dt>{t('dashboard.rowUsername')}</dt>
            <dd>
              <div className="name-inline">
                {editingName ? (
                  <input
                    className="name-inline-input"
                    value={nameForm}
                    onChange={(event) => setNameForm(event.target.value)}
                    maxLength={32}
                    autoComplete="nickname"
                    autoFocus
                    onKeyDown={(event) => {
                      if(event.key === 'Escape') {
                        setNameForm(currentName);
                        setEditingName(false);
                      }
                      if(event.key === 'Enter') {
                        event.preventDefault();
                        saveName();
                      }
                    }}
                  />
                ) : (
                  <span className="name-inline-value">{currentName || '-'}</span>
                )}
                <button
                  className="btn ghost icon-btn name-action-btn"
                  type="button"
                  onClick={onNameAction}
                  disabled={editingName && !canSaveName}
                  title={editingName ? t('dashboard.nameApply') : t('dashboard.nameEdit')}
                >
                  {editingName ? <CheckIcon /> : <PencilIcon />}
                </button>
              </div>
            </dd>

            <dt>{t('dashboard.rowEmail')}</dt>
            <dd>{maskEmail(user?.email)}</dd>
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
          <button className="btn" type="button" onClick={onRotateClick} disabled={rotating || loadingCode}>
            {rotating ? t('dashboard.rotating') : (gameCode ? t('dashboard.reissueCode') : t('dashboard.issueCode'))}
          </button>
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

      {showRotateConfirm ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t('dashboard.rotateWarnTitle')}>
          <section className="modal-card">
            <h3>{t('dashboard.rotateWarnTitle')}</h3>
            <p className="muted">{t('dashboard.rotateWarnBody')}</p>
            <div className="modal-actions">
              <button className="btn ghost" type="button" onClick={() => setShowRotateConfirm(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setShowRotateConfirm(false);
                  executeRotate();
                }}
              >
                {t('dashboard.rotateWarnConfirm')}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <Feedback feedback={feedback} />
    </main>
  );
}
