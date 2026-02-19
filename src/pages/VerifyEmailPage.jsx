import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { resendEmailVerification, verifyEmailCode } from '../lib/api';
import { useAuth } from '../components/AuthProvider';
import { useI18n } from '../components/I18nProvider';
import { Feedback, LanguageSelector } from '../components/Layout';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldownSec, setResendCooldownSec] = useState(0);
  const [sentToastVisible, setSentToastVisible] = useState(false);
  const [deadlineMs, setDeadlineMs] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const autoResendTriedRef = useRef(false);

  if(!user) {
    return <Navigate to="/login" replace />;
  }
  if(Number(user.email_verified || 0) === 1) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    if(autoResendTriedRef.current || !user || Number(user.email_verified || 0) === 1) {
      return;
    }
    autoResendTriedRef.current = true;

    resendEmailVerification({ auto: true })
      .then((data) => {
        const nextDeadline = Date.parse(String(data?.expiresAt || ''));
        if(Number.isFinite(nextDeadline) && nextDeadline > Date.now()) {
          setDeadlineMs(nextDeadline);
        }
      })
      .catch((err) => {
        const nextDeadline = Date.parse(String(err?.payload?.expiresAt || ''));
        if(Number.isFinite(nextDeadline) && nextDeadline > Date.now()) {
          setDeadlineMs(nextDeadline);
        }
      });
  }, [user, t]);

  useEffect(() => {
    if(!deadlineMs || deadlineMs <= Date.now()) {
      setRemainingMs(0);
      return undefined;
    }
    const update = () => {
      setRemainingMs(Math.max(0, deadlineMs - Date.now()));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [deadlineMs]);

  useEffect(() => {
    if(resendCooldownSec <= 0) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setResendCooldownSec((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldownSec]);

  const onVerify = async (event) => {
    event.preventDefault();
    setFeedback(null);
    setSubmitting(true);
    try {
      await verifyEmailCode({ code: code.trim() });
      await refresh();
      setFeedback({ type: 'ok', message: t('verify.success') });
      setTimeout(() => navigate('/dashboard', { replace: true }), 500);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    if(resendCooldownSec > 0) {
      return;
    }
    setFeedback(null);
    setResending(true);
    try {
      const data = await resendEmailVerification();
      const nextDeadline = Date.parse(String(data?.expiresAt || ''));
      if(Number.isFinite(nextDeadline) && nextDeadline > Date.now()) {
        setDeadlineMs(nextDeadline);
      }
      setResendCooldownSec(60);
      setSentToastVisible(true);
      window.setTimeout(() => setSentToastVisible(false), 1500);
    } catch (err) {
      const nextDeadline = Date.parse(String(err?.payload?.expiresAt || ''));
      if(Number.isFinite(nextDeadline) && nextDeadline > Date.now()) {
        setDeadlineMs(nextDeadline);
      }
      if(Number.isFinite(Number(err?.payload?.waitSeconds)) && Number(err.payload.waitSeconds) > 0) {
        setResendCooldownSec(Number(err.payload.waitSeconds));
      }
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setResending(false);
    }
  };

  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const timerText = remainingSeconds > 0
    ? `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`
    : '';

  return (
    <main className="auth-shell">
      {sentToastVisible ? (
        <div className="copy-toast" role="status" aria-live="polite">
          <span className="copy-toast-icon" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5L9.5 17L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>{t('verify.sentToast')}</span>
        </div>
      ) : null}
      <div className="auth-lang-row">
        <LanguageSelector />
      </div>
      <Link className="mini-link" to="/">{t('common.backHome')}</Link>
      <section className="panel auth-card">
        <p className="eyebrow">{t('verify.eyebrow')}</p>
        <h1>{t('verify.title')}</h1>
        <p className="muted">{t('verify.subtitle')}</p>
        <p className="muted">{user.email}</p>

        <form className="form" onSubmit={onVerify}>
          <label>
            {t('verify.code')}
            <div className="verify-code-row">
              <div className="verify-code-input-wrap">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder={t('verify.codePlaceholder')}
                  required
                />
                {timerText ? <span className="verify-code-timer">{timerText}</span> : null}
              </div>
              <button className="btn ghost verify-resend-btn" type="button" onClick={onResend} disabled={resending || resendCooldownSec > 0}>
                {resending ? t('verify.resending') : resendCooldownSec > 0 ? `${t('verify.resend')} (${resendCooldownSec}s)` : t('verify.resend')}
              </button>
            </div>
          </label>
          <button className="btn" type="submit" disabled={submitting || code.length !== 6}>
            {submitting ? t('verify.verifying') : t('verify.submit')}
          </button>
        </form>
        <Feedback feedback={feedback} />
      </section>
    </main>
  );
}
