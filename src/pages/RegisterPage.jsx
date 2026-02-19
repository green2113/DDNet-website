import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getGeo, register } from '../lib/api';
import { useAuth } from '../components/AuthProvider';
import { useI18n } from '../components/I18nProvider';
import { Feedback, LanguageSelector } from '../components/Layout';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const { t } = useI18n();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    inviteCode: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [country, setCountry] = useState('');
  const [geoLoaded, setGeoLoaded] = useState(false);

  useEffect(() => {
    let canceled = false;
    const loadGeo = async () => {
      try {
        const data = await getGeo();
        if(!canceled) {
          setCountry(String(data.country || '').toUpperCase());
          if(data.vpnBlocked) {
            navigate('/blocked', { replace: true });
            return;
          }
        }
      } catch {
        if(!canceled) {
          setCountry('');
        }
      } finally {
        if(!canceled) {
          setGeoLoaded(true);
        }
      }
    };
    loadGeo();
    return () => {
      canceled = true;
    };
  }, [navigate]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const needsInviteCode = geoLoaded && country !== 'TW';

  const onSubmit = async (event) => {
    event.preventDefault();
    setFeedback(null);
    setSubmitting(true);
    try {
      const data = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        inviteCode: form.inviteCode.trim(),
      });
      await refresh();
      setFeedback({ type: 'ok', message: data.emailVerificationRequired ? t('register.verifyRequired') : t('register.success', { code: data.gameCode }) });
      setTimeout(() => navigate('/dashboard'), data.emailVerificationRequired ? 600 : 900);
    } catch (err) {
      if(err.status === 403 && err.payload?.code === 'VPN_PROXY_BLOCKED') {
        navigate('/blocked', { replace: true });
        return;
      }
      setFeedback({ type: 'error', message: err.message });
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
        <p className="eyebrow">{t('register.eyebrow')}</p>
        <h1>{t('register.title')}</h1>
        <p className="muted">{t('register.subtitle')}</p>

        <form className="form" onSubmit={onSubmit}>
          <label>
            {t('register.name')}
            <input value={form.name} onChange={(e) => setField('name', e.target.value)} maxLength={32} required autoComplete="nickname" />
            <small className="input-help">{t('register.nameHint')}</small>
          </label>
          <label>
            {t('register.email')}
            <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} required autoComplete="email" />
          </label>
          <label>
            {t('register.password')}
            <input type="password" value={form.password} onChange={(e) => setField('password', e.target.value)} minLength={8} required autoComplete="new-password" />
          </label>
          {needsInviteCode ? (
            <label>
              {t('register.invite')}
              <input
                value={form.inviteCode}
                onChange={(e) => setField('inviteCode', e.target.value)}
                placeholder={t('register.invitePlaceholder')}
                minLength={8}
                maxLength={32}
                required
              />
            </label>
          ) : null}
          <button className="btn" type="submit" disabled={submitting}>{submitting ? t('common.creating') : t('register.submit')}</button>
        </form>

        <p className="switch-line">{t('common.alreadyHaveAccount')} <Link to="/login">{t('common.login')}</Link></p>
        <Feedback feedback={feedback} />
      </section>
    </main>
  );
}
