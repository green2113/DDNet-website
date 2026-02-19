import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentDummyGameCode, getCurrentGameCode, resendEmailVerification, rotateDummyGameCode, rotateGameCode, updateDummyProfileName, updateProfileName, verifyEmailCode } from '../lib/api';
import { useAuth } from '../components/AuthProvider';
import { useI18n } from '../components/I18nProvider';
import { Feedback, TopBar } from '../components/Layout';
import Tooltip from '../components/Tooltip';

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

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="m18.3 7.1-1.4-1.4L12 10.6 7.1 5.7 5.7 7.1l4.9 4.9-4.9 4.9 1.4 1.4 4.9-4.9 4.9 4.9 1.4-1.4-4.9-4.9 4.9-4.9Z" />
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

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="M17 8h-1V6a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4V6Z" />
    </svg>
  );
}

export default function DashboardPage() {
  const { user, refresh, logout } = useAuth();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState(null);
  const [gameCode, setGameCode] = useState('');
  const [dummyCode, setDummyCode] = useState('');
  const [loadingCode, setLoadingCode] = useState(true);
  const [loadingDummyCode, setLoadingDummyCode] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [dummyRevealed, setDummyRevealed] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [rotatingDummy, setRotatingDummy] = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);
  const [showDummyRotateConfirm, setShowDummyRotateConfirm] = useState(false);
  const [showDummyFirstIssue, setShowDummyFirstIssue] = useState(false);
  const [showNameConfirm, setShowNameConfirm] = useState(false);
  const [nameForm, setNameForm] = useState('');
  const [dummyNameForm, setDummyNameForm] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [editingDummyName, setEditingDummyName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingDummyName, setSavingDummyName] = useState(false);
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [showEmailVerifyModal, setShowEmailVerifyModal] = useState(false);
  const [verifyCodeInput, setVerifyCodeInput] = useState('');
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [verifyResending, setVerifyResending] = useState(false);
  const [verifyDeadlineMs, setVerifyDeadlineMs] = useState(0);
  const [verifyRemainingMs, setVerifyRemainingMs] = useState(0);
  const [verifyResendCooldownSec, setVerifyResendCooldownSec] = useState(0);
  const [showVerifySentToast, setShowVerifySentToast] = useState(false);

  const currentName = String(user?.username || '');
  const currentDummyName = String(user?.dummy_name || '');
  const emailVerified = Number(user?.email_verified || 0) === 1;
  const canUseInvite = String(user?.country_signup || '').toUpperCase() === 'TW';
  const trimmedName = nameForm.trim();
  const trimmedDummyName = dummyNameForm.trim();
  const nameCooldownUntilRaw = String(user?.name_change_available_at || '');
  const nameCooldownUntilMs = nameCooldownUntilRaw ? Date.parse(nameCooldownUntilRaw) : NaN;
  const nameCooldownActive = Number.isFinite(nameCooldownUntilMs) && nameCooldownUntilMs > Date.now();
  const nameCooldownDaysLeft = nameCooldownActive
    ? Math.max(1, Math.floor((nameCooldownUntilMs - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;
  const dummyNameCooldownUntilRaw = String(user?.dummy_name_change_available_at || '');
  const dummyNameCooldownUntilMs = dummyNameCooldownUntilRaw ? Date.parse(dummyNameCooldownUntilRaw) : NaN;
  const dummyNameCooldownActive = Number.isFinite(dummyNameCooldownUntilMs) && dummyNameCooldownUntilMs > Date.now();
  const dummyNameCooldownDaysLeft = dummyNameCooldownActive
    ? Math.max(1, Math.floor((dummyNameCooldownUntilMs - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;
  const canSaveName = editingName && !savingName && trimmedName.length > 0 && trimmedName !== currentName;
  const canSaveDummyName = editingDummyName && !dummyNameCooldownActive && !savingDummyName && trimmedDummyName.length > 0 && trimmedDummyName !== currentDummyName;
  const isDummyNameInputActive = editingDummyName || showDummyFirstIssue;
  const verifyRemainingSeconds = Math.ceil(verifyRemainingMs / 1000);
  const verifyTimerText = verifyRemainingSeconds > 0
    ? `${String(Math.floor(verifyRemainingSeconds / 60)).padStart(2, '0')}:${String(verifyRemainingSeconds % 60).padStart(2, '0')}`
    : '';

  useEffect(() => {
    setNameForm(currentName);
    setEditingName(false);
  }, [currentName]);

  useEffect(() => {
    setDummyNameForm(currentDummyName);
    setEditingDummyName(false);
  }, [currentDummyName]);

  useEffect(() => {
    if(nameCooldownActive && editingName) {
      setEditingName(false);
      setShowNameConfirm(false);
    }
  }, [nameCooldownActive, editingName]);

  useEffect(() => {
    if(dummyNameCooldownActive && editingDummyName) {
      setEditingDummyName(false);
    }
  }, [dummyNameCooldownActive, editingDummyName]);

  useEffect(() => {
    if(!showCopyToast) {
      return undefined;
    }
    const timer = setTimeout(() => setShowCopyToast(false), 1800);
    return () => clearTimeout(timer);
  }, [showCopyToast]);

  useEffect(() => {
    if(!showVerifySentToast) {
      return undefined;
    }
    const timer = setTimeout(() => setShowVerifySentToast(false), 1800);
    return () => clearTimeout(timer);
  }, [showVerifySentToast]);

  useEffect(() => {
    if(!showEmailVerifyModal) {
      return undefined;
    }
    let disposed = false;
    const autoSend = async () => {
      try {
        const data = await resendEmailVerification({ auto: true });
        if(disposed) return;
        const nextDeadline = Date.parse(String(data?.expiresAt || ''));
        if(Number.isFinite(nextDeadline) && nextDeadline > Date.now()) {
          setVerifyDeadlineMs(nextDeadline);
        }
      } catch (err) {
        if(disposed) return;
        const nextDeadline = Date.parse(String(err?.payload?.expiresAt || ''));
        if(Number.isFinite(nextDeadline) && nextDeadline > Date.now()) {
          setVerifyDeadlineMs(nextDeadline);
        }
      }
    };
    autoSend();
    return () => {
      disposed = true;
    };
  }, [showEmailVerifyModal]);

  useEffect(() => {
    if(!showEmailVerifyModal || !verifyDeadlineMs || verifyDeadlineMs <= Date.now()) {
      setVerifyRemainingMs(0);
      return undefined;
    }
    const update = () => {
      setVerifyRemainingMs(Math.max(0, verifyDeadlineMs - Date.now()));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [showEmailVerifyModal, verifyDeadlineMs]);

  useEffect(() => {
    if(!showEmailVerifyModal || verifyResendCooldownSec <= 0) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setVerifyResendCooldownSec((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [showEmailVerifyModal, verifyResendCooldownSec]);

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

  const executeDummyRotate = async (firstDummyName = '') => {
    setFeedback(null);
    setRotatingDummy(true);
    try {
      const result = await rotateDummyGameCode(firstDummyName ? { name: firstDummyName } : {});
      setDummyCode(result.code || '');
      setDummyRevealed(true);
      await refresh();
      setFeedback({ type: 'ok', message: t('dashboard.dummyRotated') });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setRotatingDummy(false);
    }
  };

  const onRotateClick = () => {
    if(!emailVerified) {
      return;
    }
    if(rotating || loadingCode) {
      return;
    }

    if(gameCode) {
      setShowRotateConfirm(true);
      return;
    }

    executeRotate();
  };

  const onDummyRotateClick = () => {
    if(!emailVerified) {
      return;
    }
    if(rotatingDummy || loadingDummyCode) {
      return;
    }

    if(dummyCode) {
      setShowDummyRotateConfirm(true);
      return;
    }

    setDummyNameForm(currentDummyName || '');
    setShowDummyFirstIssue(true);
  };

  useEffect(() => {
    if(!emailVerified) {
      setLoadingCode(false);
      setLoadingDummyCode(false);
      return undefined;
    }
    let canceled = false;
    const loadCurrentCode = async (reportError = true) => {
      setLoadingCode(true);
      try {
        const data = await getCurrentGameCode();
        if(!canceled) {
          setGameCode(String(data.code || ''));
        }
      } catch (err) {
        if(!canceled && reportError) {
          setFeedback({ type: 'error', message: err.message });
        }
      } finally {
        if(!canceled) {
          setLoadingCode(false);
        }
      }
    };
    const loadCurrentDummyCode = async (reportError = true) => {
      setLoadingDummyCode(true);
      try {
        const data = await getCurrentDummyGameCode();
        if(!canceled) {
          setDummyCode(String(data.code || ''));
          if(!isDummyNameInputActive && typeof data.dummyName === 'string') {
            setDummyNameForm(data.dummyName);
          }
        }
      } catch (err) {
        if(!canceled && reportError) {
          setFeedback({ type: 'error', message: err.message });
        }
      } finally {
        if(!canceled) {
          setLoadingDummyCode(false);
        }
      }
    };
    loadCurrentCode(true);
    loadCurrentDummyCode(true);
    return () => {
      canceled = true;
    };
  }, [emailVerified, isDummyNameInputActive]);

  useEffect(() => {
    if(!user?.id || !emailVerified) {
      return undefined;
    }

    let disposed = false;
    let inFlight = false;
    const tick = async () => {
      if(disposed || inFlight || document.hidden) {
        return;
      }
      inFlight = true;
      try {
        await refresh({ silent: true });
        const [game, dummy] = await Promise.all([
          getCurrentGameCode().catch(() => null),
          getCurrentDummyGameCode().catch(() => null),
        ]);
        if(!disposed) {
          if(game) {
            setGameCode(String(game.code || ''));
          }
          if(dummy) {
            setDummyCode(String(dummy.code || ''));
            if(!isDummyNameInputActive && typeof dummy.dummyName === 'string') {
              setDummyNameForm(dummy.dummyName);
            }
          }
        }
      } finally {
        inFlight = false;
      }
    };

    const timer = setInterval(tick, 3000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [user?.id, refresh, isDummyNameInputActive, emailVerified]);

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
    if(!emailVerified) {
      return;
    }
    if(editingName) {
      if(canSaveName) {
        setShowNameConfirm(true);
      }
      return;
    }
    if(nameCooldownActive) {
      return;
    }
    setNameForm(currentName);
    setEditingName(true);
  };

  const onCancelNameEdit = () => {
    setNameForm(currentName);
    setEditingName(false);
  };

  const onDummyNameAction = () => {
    if(!emailVerified) {
      return;
    }
    if(editingDummyName) {
      if(canSaveDummyName) {
        saveDummyName();
      }
      return;
    }
    if(dummyNameCooldownActive) {
      return;
    }
    setDummyNameForm(currentDummyName);
    setEditingDummyName(true);
  };

  const onCancelDummyNameEdit = () => {
    setDummyNameForm(currentDummyName);
    setEditingDummyName(false);
  };

  const saveDummyName = async () => {
    if(!canSaveDummyName) {
      return;
    }
    setSavingDummyName(true);
    setFeedback(null);
    try {
      await updateDummyProfileName({ name: trimmedDummyName });
      await refresh();
      setEditingDummyName(false);
      setFeedback({ type: 'ok', message: t('dashboard.dummyNameUpdated') });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSavingDummyName(false);
    }
  };

  const openEmailVerifyModal = () => {
    setVerifyCodeInput('');
    setVerifyResendCooldownSec(0);
    setVerifyDeadlineMs(0);
    setVerifyRemainingMs(0);
    setShowEmailVerifyModal(true);
  };

  const onVerifyResend = async () => {
    if(verifyResendCooldownSec > 0 || verifyResending) {
      return;
    }
    setVerifyResending(true);
    setFeedback(null);
    try {
      const data = await resendEmailVerification();
      const nextDeadline = Date.parse(String(data?.expiresAt || ''));
      if(Number.isFinite(nextDeadline) && nextDeadline > Date.now()) {
        setVerifyDeadlineMs(nextDeadline);
      }
      setVerifyResendCooldownSec(60);
      setShowVerifySentToast(false);
      requestAnimationFrame(() => setShowVerifySentToast(true));
    } catch (err) {
      const nextDeadline = Date.parse(String(err?.payload?.expiresAt || ''));
      if(Number.isFinite(nextDeadline) && nextDeadline > Date.now()) {
        setVerifyDeadlineMs(nextDeadline);
      }
      if(Number.isFinite(Number(err?.payload?.waitSeconds)) && Number(err.payload.waitSeconds) > 0) {
        setVerifyResendCooldownSec(Number(err.payload.waitSeconds));
      }
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setVerifyResending(false);
    }
  };

  const onVerifyEmail = async () => {
    if(verifySubmitting || verifyCodeInput.length !== 6) {
      return;
    }
    setVerifySubmitting(true);
    setFeedback(null);
    try {
      await verifyEmailCode({ code: verifyCodeInput });
      await refresh();
      setShowEmailVerifyModal(false);
      setFeedback({ type: 'ok', message: t('dashboard.emailVerifiedNow') });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setVerifySubmitting(false);
    }
  };

  const displayCode = loadingCode
    ? '••••••••••••••••••••'
    : (!gameCode ? '-' : (revealed ? gameCode : '•'.repeat(gameCode.length)));
  const displayDummyCode = loadingDummyCode
    ? '••••••••••••••••••••'
    : (!dummyCode ? '-' : (dummyRevealed ? dummyCode : '•'.repeat(dummyCode.length)));

  const banPermanent = Number(user?.ban_is_permanent || 0) !== 0;
  const banUntilRaw = String(user?.ban_until || '');
  const banUntilMs = banUntilRaw ? Date.parse(banUntilRaw) : NaN;
  const banTempActive = Number.isFinite(banUntilMs) && banUntilMs > Date.now();
  const isBanned = banPermanent || banTempActive;
  const banUntilText = banTempActive
    ? new Date(banUntilMs).toLocaleString(locale || 'en-US')
    : '';
  const accessStatusText = isBanned
    ? (banPermanent
      ? t('dashboard.accessBannedPermanent')
      : t('dashboard.accessBannedUntil', { time: banUntilText }))
    : t('dashboard.accessActive');
  const accessStatusClass = isBanned
    ? (banPermanent ? 'status-text status-permanent' : 'status-text status-temporary')
    : 'status-text status-normal';

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
      {showVerifySentToast ? (
        <section className="copy-toast" role="status" aria-live="polite">
          <span className="copy-toast-icon"><ToastCheckIcon /></span>
          <span>{t('dashboard.emailVerifySentToast')}</span>
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
            <dt>{t('dashboard.rowUserId')}</dt>
            <dd>{user?.id ?? '-'}</dd>
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
                        onCancelNameEdit();
                      }
                      if(event.key === 'Enter') {
                        event.preventDefault();
                        if(canSaveName) {
                          setShowNameConfirm(true);
                        }
                      }
                    }}
                  />
                ) : (
                  <span className="name-inline-value">{currentName || '-'}</span>
                )}
                {!emailVerified && !editingName ? (
                  <Tooltip label={t('dashboard.verifyRequiredTooltip')}>
                    <button
                      className="btn ghost icon-btn name-action-btn locked-action"
                      type="button"
                      aria-disabled="true"
                      title={t('dashboard.verifyRequiredTooltip')}
                    >
                      <LockIcon />
                    </button>
                  </Tooltip>
                ) : nameCooldownActive && !editingName ? (
                  <span className="name-cooldown">{t('dashboard.nameCooldown', { days: nameCooldownDaysLeft })}</span>
                ) : (
                  <button
                    className="btn ghost icon-btn name-action-btn"
                    type="button"
                    onClick={onNameAction}
                    disabled={editingName && !canSaveName}
                    title={editingName ? t('dashboard.nameApply') : t('dashboard.nameEdit')}
                  >
                    {editingName ? <CheckIcon /> : <PencilIcon />}
                  </button>
                )}
                {editingName ? (
                  <button
                    className="btn ghost icon-btn name-action-btn"
                    type="button"
                    onClick={onCancelNameEdit}
                    title={t('dashboard.nameCancel')}
                  >
                    <CloseIcon />
                  </button>
                ) : null}
              </div>
            </dd>

            <dt>{t('dashboard.rowEmail')}</dt>
            <dd>
              <div className="email-verify-row">
                <span>{maskEmail(user?.email)}</span>
                {emailVerified ? (
                  <span className="status-text status-normal">{t('dashboard.emailVerified')}</span>
                ) : (
                  <button className="btn ghost" type="button" onClick={openEmailVerifyModal}>{t('dashboard.emailVerifyAction')}</button>
                )}
              </div>
            </dd>
            <dt>{t('dashboard.rowAccess')}</dt>
            <dd><span className={accessStatusClass}>{accessStatusText}</span></dd>
          </dl>
        </article>

        {canUseInvite ? (
          <article className="panel">
            <h3>{t('dashboard.inviteTitle')}</h3>
            <p className="muted">{t('dashboard.inviteBody')}</p>
            <pre className="mono">{user?.invite_code || '-'}</pre>
            <p className="muted">{t('dashboard.inviteUsage', { used: user?.invite_used ?? 0, quota: user?.invite_quota ?? 0 })}</p>
            <p className="muted">{t('dashboard.inviteNotice')}</p>
          </article>
        ) : null}

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
          {!emailVerified ? (
            <Tooltip label={t('dashboard.verifyRequiredTooltip')}>
              <button className="btn locked-action" type="button" aria-disabled="true">
                {gameCode ? t('dashboard.reissueCode') : t('dashboard.issueCode')}
              </button>
            </Tooltip>
          ) : (
            <button className="btn" type="button" onClick={onRotateClick} disabled={rotating || loadingCode}>
              {rotating ? t('dashboard.rotating') : (gameCode ? t('dashboard.reissueCode') : t('dashboard.issueCode'))}
            </button>
          )}
        </article>

        <article className="panel">
          <h3>{t('dashboard.dummyCodeTitle')}</h3>
          <p className="muted">{t('dashboard.dummyCodeBody')}</p>
          {dummyCode ? (
            <div className="name-inline" style={{ marginBottom: 12 }}>
              {editingDummyName ? (
                <input
                  className="name-inline-input"
                  value={dummyNameForm}
                  onChange={(event) => setDummyNameForm(event.target.value)}
                  maxLength={32}
                  autoComplete="nickname"
                  autoFocus
                  onKeyDown={(event) => {
                    if(event.key === 'Escape') {
                      onCancelDummyNameEdit();
                    }
                    if(event.key === 'Enter') {
                      event.preventDefault();
                      if(canSaveDummyName) {
                        saveDummyName();
                      }
                    }
                  }}
                />
              ) : (
                <span className="name-inline-value">{currentDummyName || '-'}</span>
              )}
              {!emailVerified && !editingDummyName ? (
                <Tooltip label={t('dashboard.verifyRequiredTooltip')}>
                  <button
                    className="btn ghost icon-btn name-action-btn locked-action"
                    type="button"
                    aria-disabled="true"
                    title={t('dashboard.verifyRequiredTooltip')}
                  >
                    <LockIcon />
                  </button>
                </Tooltip>
              ) : dummyNameCooldownActive && !editingDummyName ? (
                <span className="name-cooldown">{t('dashboard.nameCooldown', { days: dummyNameCooldownDaysLeft })}</span>
              ) : (
                <button
                  className="btn ghost icon-btn name-action-btn"
                  type="button"
                  onClick={onDummyNameAction}
                  disabled={editingDummyName && !canSaveDummyName}
                  title={editingDummyName ? t('dashboard.nameApply') : t('dashboard.dummyNameEdit')}
                >
                  {editingDummyName ? <CheckIcon /> : <PencilIcon />}
                </button>
              )}
              {editingDummyName ? (
                <button
                  className="btn ghost icon-btn name-action-btn"
                  type="button"
                  onClick={onCancelDummyNameEdit}
                  title={t('dashboard.nameCancel')}
                >
                  <CloseIcon />
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="code-line">
            <pre className="mono code-mono">{displayDummyCode}</pre>
            <div className="code-actions">
              <button
                className="btn ghost icon-btn"
                type="button"
                onClick={() => setDummyRevealed((prev) => !prev)}
                disabled={!dummyCode || loadingDummyCode}
                title={dummyRevealed ? t('dashboard.hideCode') : t('dashboard.showCode')}
              >
                {dummyRevealed ? <EyeOffIcon /> : <EyeIcon />}
              </button>
              <button
                className="btn ghost icon-btn"
                type="button"
                onClick={async () => {
                  if(!dummyCode) return;
                  try {
                    await navigator.clipboard.writeText(dummyCode);
                    setShowCopyToast(false);
                    requestAnimationFrame(() => setShowCopyToast(true));
                  } catch {
                    setFeedback({ type: 'error', message: t('dashboard.copyFailed') });
                  }
                }}
                disabled={!dummyCode || loadingDummyCode}
                title={t('dashboard.copyCode')}
              >
                <CopyIcon />
              </button>
            </div>
          </div>
          {!emailVerified ? (
            <Tooltip label={t('dashboard.verifyRequiredTooltip')}>
              <button className="btn locked-action" type="button" aria-disabled="true">
                {dummyCode ? t('dashboard.dummyReissueCode') : t('dashboard.dummyIssueCode')}
              </button>
            </Tooltip>
          ) : (
            <button className="btn" type="button" onClick={onDummyRotateClick} disabled={rotatingDummy || loadingDummyCode}>
              {rotatingDummy ? t('dashboard.rotating') : (dummyCode ? t('dashboard.dummyReissueCode') : t('dashboard.dummyIssueCode'))}
            </button>
          )}
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

      {showDummyRotateConfirm ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t('dashboard.dummyRotateWarnTitle')}>
          <section className="modal-card">
            <h3>{t('dashboard.dummyRotateWarnTitle')}</h3>
            <p className="muted">{t('dashboard.dummyRotateWarnBody')}</p>
            <div className="modal-actions">
              <button className="btn ghost" type="button" onClick={() => setShowDummyRotateConfirm(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setShowDummyRotateConfirm(false);
                  executeDummyRotate();
                }}
              >
                {t('dashboard.dummyRotateWarnConfirm')}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showDummyFirstIssue ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t('dashboard.dummyFirstIssueTitle')}>
          <section className="modal-card">
            <h3>{t('dashboard.dummyFirstIssueTitle')}</h3>
            <p className="muted">{t('dashboard.dummyFirstIssueBody')}</p>
            <label className="field">
              <input
                value={dummyNameForm}
                onChange={(event) => setDummyNameForm(event.target.value)}
                maxLength={32}
                autoComplete="nickname"
                autoFocus
              />
            </label>
            <div className="modal-actions">
              <button className="btn ghost" type="button" onClick={() => setShowDummyFirstIssue(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn"
                type="button"
                onClick={async () => {
                  const initialName = dummyNameForm.trim();
                  if(!initialName) {
                    setFeedback({ type: 'error', message: t('dashboard.dummyNameRequired') });
                    return;
                  }
                  setShowDummyFirstIssue(false);
                  await executeDummyRotate(initialName);
                }}
              >
                {t('dashboard.dummyFirstIssueConfirm')}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showNameConfirm ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t('dashboard.nameWarnTitle')}>
          <section className="modal-card">
            <h3>{t('dashboard.nameWarnTitle')}</h3>
            <p className="muted">{t('dashboard.nameWarnBody')}</p>
            <div className="modal-actions">
              <button className="btn ghost" type="button" onClick={() => setShowNameConfirm(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn"
                type="button"
                onClick={async () => {
                  setShowNameConfirm(false);
                  await saveName();
                }}
              >
                {t('dashboard.nameWarnConfirm')}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showEmailVerifyModal ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t('dashboard.emailVerifyTitle')}>
          <section className="modal-card">
            <h3>{t('dashboard.emailVerifyTitle')}</h3>
            <p className="muted">{t('dashboard.emailVerifyBody')}</p>
            <p className="muted">{String(user?.email || '')}</p>
            <label className="field">
              <div className="verify-code-row">
                <div className="verify-code-input-wrap">
                  <input
                    value={verifyCodeInput}
                    onChange={(event) => setVerifyCodeInput(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder={t('dashboard.emailVerifyCodePlaceholder')}
                    autoFocus
                    required
                  />
                  {verifyTimerText ? <span className="verify-code-timer">{verifyTimerText}</span> : null}
                </div>
                <button
                  className="btn ghost verify-resend-btn"
                  type="button"
                  onClick={onVerifyResend}
                  disabled={verifyResending || verifyResendCooldownSec > 0}
                >
                  {verifyResending
                    ? t('dashboard.emailVerifyResending')
                    : verifyResendCooldownSec > 0
                      ? `${t('dashboard.emailVerifyResend')} (${verifyResendCooldownSec}s)`
                      : t('dashboard.emailVerifyResend')}
                </button>
              </div>
            </label>
            <div className="modal-actions">
              <button className="btn ghost" type="button" onClick={() => setShowEmailVerifyModal(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn" type="button" onClick={onVerifyEmail} disabled={verifySubmitting || verifyCodeInput.length !== 6}>
                {verifySubmitting ? t('dashboard.emailVerifyVerifying') : t('dashboard.emailVerifySubmit')}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <Feedback feedback={feedback} />
    </main>
  );
}
