import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { resendEmailVerification, verifyEmailCode } from '../lib/api';
import { useAuth } from '../components/AuthProvider';
import { useI18n } from '../components/I18nProvider';
import { Feedback, LanguageSelector } from '../components/Layout';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const { user, refresh, logout } = useAuth();
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  if(!user) {
    return <Navigate to="/login" replace />;
  }
  if(Number(user.email_verified || 0) === 1) {
    return <Navigate to="/dashboard" replace />;
  }

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
    setFeedback(null);
    setResending(true);
    try {
      await resendEmailVerification();
      setFeedback({ type: 'ok', message: t('verify.resendDone') });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="auth-shell">
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
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={t('verify.codePlaceholder')}
              required
            />
          </label>
          <button className="btn" type="submit" disabled={submitting || code.length !== 6}>
            {submitting ? t('verify.verifying') : t('verify.submit')}
          </button>
        </form>

        <div className="code-actions">
          <button className="btn ghost" type="button" onClick={onResend} disabled={resending}>
            {resending ? t('verify.resending') : t('verify.resend')}
          </button>
          <button className="btn ghost" type="button" onClick={logout}>{t('verify.logout')}</button>
        </div>
        <Feedback feedback={feedback} />
      </section>
    </main>
  );
}
