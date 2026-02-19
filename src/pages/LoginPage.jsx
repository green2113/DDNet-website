import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getGeo, login } from '../lib/api';
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

  return (
    <main className="auth-shell">
      <div className="auth-lang-row">
        <LanguageSelector />
      </div>
      <Link className="mini-link" to="/">{t('common.backHome')}</Link>
      <section className="panel auth-card">
        <p className="eyebrow">{t('login.eyebrow')}</p>
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
      </section>
    </main>
  );
}
