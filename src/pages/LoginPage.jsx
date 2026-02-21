import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getGeo, login, requestPasswordResetCode, resetPasswordWithCode } from '../lib/api';
import { useAuth } from '../components/AuthProvider';
import { useI18n } from '../components/I18nProvider';
import { LanguageSelector } from '../components/Layout';

export default function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetCodeRequested, setResetCodeRequested] = useState(false);
  const [requestingCode, setRequestingCode] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetInfoText, setResetInfoText] = useState('');
  const [resetErrorText, setResetErrorText] = useState('');
  const [resetCooldownSec, setResetCooldownSec] = useState(0);
  const [resetDeadlineMs, setResetDeadlineMs] = useState(0);

  useEffect(() => {
    let canceled = false;
    const probe = async () => {
      try {
        const geo = await getGeo();
        if(!canceled && geo.vpnBlocked) {
          navigate('/blocked', { replace: true });
        }
      } catch {
        // keep page usable if geo check fails
      }
    };
    probe();
    return () => {
      canceled = true;
    };
  }, [navigate]);

  useEffect(() => {
    if(!showPasswordReset || resetCooldownSec <= 0) {
      return undefined;
    }
    const timer = setInterval(() => {
      setResetCooldownSec((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [showPasswordReset, resetCooldownSec]);

  useEffect(() => {
    if(!showPasswordReset || !resetDeadlineMs || resetDeadlineMs <= Date.now()) {
      return undefined;
    }
    const timer = setInterval(() => {
      if(Date.now() >= resetDeadlineMs) {
        setResetDeadlineMs(0);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [showPasswordReset, resetDeadlineMs]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setErrorText('');
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      await refresh();
      setTimeout(() => navigate('/dashboard'), 450);
    } catch (err) {
      if(err.status === 403 && err.payload?.code === 'VPN_PROXY_BLOCKED') {
        navigate('/blocked', { replace: true });
        return;
      }
      if(err.status === 401) {
        setErrorText(t('login.invalidCredentials'));
      } else {
        setErrorText(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const remainingResetSeconds = resetDeadlineMs > Date.now()
    ? Math.ceil((resetDeadlineMs - Date.now()) / 1000)
    : 0;
  const resetTimerText = remainingResetSeconds > 0
    ? `${Math.floor(remainingResetSeconds / 60)}:${String(remainingResetSeconds % 60).padStart(2, '0')}`
    : '';

  const onRequestResetCode = async () => {
    setResetInfoText('');
    setResetErrorText('');
    setRequestingCode(true);
    try {
      const data = await requestPasswordResetCode({ email: resetEmail.trim() });
      setResetCodeRequested(true);
      setResetCooldownSec(60);
      const nextDeadline = data?.expiresAt ? Date.parse(data.expiresAt) : NaN;
      setResetDeadlineMs(Number.isFinite(nextDeadline) ? nextDeadline : 0);
      setResetInfoText(t('login.resetCodeSent'));
    } catch (err) {
      if(err.status === 403 && err.payload?.code === 'PASSWORD_RESET_EMAIL_NOT_VERIFIED') {
        setResetErrorText(`${t('login.resetUnverifiedLine1')}\n${t('login.resetUnverifiedLine2')}`);
      } else if(err.status === 429 && err.payload?.code === 'PASSWORD_RESET_COOLDOWN') {
        const wait = Number(err.payload?.waitSeconds || 0);
        if(wait > 0) {
          setResetCooldownSec(wait);
        }
        const nextDeadline = err.payload?.expiresAt ? Date.parse(err.payload.expiresAt) : NaN;
        setResetDeadlineMs(Number.isFinite(nextDeadline) ? nextDeadline : 0);
        setResetErrorText(t('login.resetCooldown', { seconds: wait || 1 }));
      } else {
        setResetErrorText(err.message || t('login.resetRequestFailed'));
      }
    } finally {
      setRequestingCode(false);
    }
  };

  const onResetPassword = async (event) => {
    event.preventDefault();
    setResetInfoText('');
    setResetErrorText('');
    setResettingPassword(true);
    try {
      await resetPasswordWithCode({
        email: resetEmail.trim(),
        code: resetCode.trim(),
        newPassword: resetPassword,
      });
      setResetInfoText(t('login.resetSuccess'));
      setResetCode('');
      setResetPassword('');
      setResetCodeRequested(false);
      setResetDeadlineMs(0);
    } catch (err) {
      if(err.status === 403 && err.payload?.code === 'PASSWORD_RESET_EMAIL_NOT_VERIFIED') {
        setResetErrorText(`${t('login.resetUnverifiedLine1')}\n${t('login.resetUnverifiedLine2')}`);
      } else {
        setResetErrorText(err.message || t('login.resetConfirmFailed'));
      }
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <main className="auth-shell">
      <div className="auth-lang-row">
        <LanguageSelector />
      </div>
      <Link className="mini-link" to="/">{t('common.backHome')}</Link>
      <section className="panel auth-card">
        <p className="eyebrow">{t('login.eyebrow')}</p>
        {showPasswordReset ? (
          <>
            <h1>{t('login.lostPassword')}</h1>
            <p className="muted">{t('login.resetSubtitle')}</p>
            <p className="switch-line">
              <button
                className="link-button"
                type="button"
                onClick={() => setShowPasswordReset(false)}
              >
                {t('common.login')}
              </button>
            </p>
          <form className="form password-reset-box" onSubmit={onResetPassword}>
            <label>
              {t('login.resetEmail')}
              <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required autoComplete="email" />
            </label>
            <div className="reset-actions-row">
              <button className="btn ghost" type="button" onClick={onRequestResetCode} disabled={requestingCode || resetCooldownSec > 0}>
                {requestingCode ? t('login.resetSending') : t('login.resetSendCode')}
              </button>
              {resetCooldownSec > 0 ? <span className="muted">{t('login.resetCooldown', { seconds: resetCooldownSec })}</span> : null}
            </div>
            {resetTimerText ? <p className="muted">{t('login.resetExpiresIn', { time: resetTimerText })}</p> : null}
            {resetCodeRequested ? (
              <>
                <label>
                  {t('login.resetCode')}
                  <input type="text" value={resetCode} onChange={(e) => setResetCode(e.target.value)} inputMode="numeric" maxLength={6} required />
                </label>
                <label>
                  {t('login.resetNewPassword')}
                  <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} minLength={8} required autoComplete="new-password" />
                </label>
                <button className="btn" type="submit" disabled={resettingPassword}>
                  {resettingPassword ? t('login.resetting') : t('login.resetSubmit')}
                </button>
              </>
            ) : null}
            {resetInfoText ? <p className="form-ok-text">{resetInfoText}</p> : null}
            {resetErrorText ? (
              <p className="form-error-text preserve-lines">
                {resetErrorText}
                {resetErrorText.includes('\n') ? (
                  <>
                    {' '}
                    <a href="https://discord.gg/NNtuG9es32" target="_blank" rel="noreferrer">{t('login.contactSupport')}</a>
                  </>
                ) : null}
              </p>
            ) : null}
          </form>
          </>
        ) : (
          <>
            <h1>{t('login.title')}</h1>
            <p className="muted">{t('login.subtitle')}</p>

            <form className="form" onSubmit={onSubmit}>
              <label>
                {t('login.email')}
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </label>
              <label>
                {t('login.password')}
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              </label>
              {errorText ? <p className="form-error-text">{errorText}</p> : null}
              <button className="btn" type="submit" disabled={submitting}>{submitting ? t('common.loggingIn') : t('login.submit')}</button>
            </form>

            <p className="switch-line">{t('common.notLoggedInYet')} <Link to="/register">{t('common.register')}</Link></p>
            <p className="switch-line">
              {t('login.lostAccount')}
              {' · '}
              <button
                className="link-button"
                type="button"
                onClick={() => {
                  setShowPasswordReset(true);
                  setResetEmail((prev) => prev || email.trim());
                }}
              >
                {t('login.lostPassword')}
              </button>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
