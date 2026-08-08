import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getGeo, register } from '../lib/api';
import { useAuth } from '../components/AuthProvider';
import { useI18n } from '../components/I18nProvider';
import { Feedback, LanguageSelector } from '../components/Layout';
import { readReturnUrl, withReturnParam } from '../lib/redirect';

const TERMS_URL = 'https://docs.under1111.com/%EC%84%9C%EB%B9%84%EC%8A%A4-%EC%9D%B4%EC%9A%A9%EC%95%BD%EA%B4%80';
const PRIVACY_URL = 'https://docs.under1111.com/%EA%B0%9C%EC%9D%B8%EC%A0%95%EB%B3%B4-%EC%88%98%EC%A7%91-%EB%B0%8F-%EC%9D%B4%EC%9A%A9-%EB%8F%99%EC%9D%98';

function AgreementCheckbox({
  checked,
  onChange,
  linkHref,
  linkText,
  prefixText,
  suffixText,
  requiredLabel,
}) {
  return (
    <label className={`agreement-row${checked ? ' is-checked' : ''}`}>
      <input
        type="checkbox"
        className="agreement-input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="agreement-box" aria-hidden="true">
        <svg className="agreement-check-icon" viewBox="0 0 12 10" fill="none" aria-hidden="true">
          <path d="M1 5.2L4.4 8.6L11 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="agreement-text">
        {prefixText}
        <a
          className="agreement-link"
          href={linkHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {linkText}
        </a>
        {suffixText}
        <span className="agreement-required">{requiredLabel}</span>
      </span>
    </label>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const { t } = useI18n();
  const returnUrl = readReturnUrl();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    inviteCode: '',
  });
  const [agreements, setAgreements] = useState({
    terms: false,
    privacy: false,
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

  const needsInviteCode = geoLoaded && country !== 'TW' && country !== 'KR';

  const onSubmit = async (event) => {
    event.preventDefault();
    setFeedback(null);
    if(!agreements.terms || !agreements.privacy) {
      setFeedback({ type: 'error', message: t('register.agreeRequired') });
      return;
    }
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
      const delay = data.emailVerificationRequired ? 600 : 900;
      setTimeout(() => {
        if(returnUrl) {
          window.location.replace(returnUrl);
        } else {
          navigate('/dashboard');
        }
      }, delay);
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
          <div className="agreement-list">
            <AgreementCheckbox
              checked={agreements.terms}
              onChange={(checked) => setAgreements((prev) => ({ ...prev, terms: checked }))}
              linkHref={TERMS_URL}
              linkText={t('register.termsLink')}
              prefixText={t('register.termsPrefix')}
              suffixText={t('register.termsSuffix')}
              requiredLabel={t('register.required')}
            />
            <AgreementCheckbox
              checked={agreements.privacy}
              onChange={(checked) => setAgreements((prev) => ({ ...prev, privacy: checked }))}
              linkHref={PRIVACY_URL}
              linkText={t('register.privacyLink')}
              prefixText={t('register.privacyPrefix')}
              suffixText={t('register.privacySuffix')}
              requiredLabel={t('register.required')}
            />
          </div>
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
          <button
            className="btn"
            type="submit"
            disabled={submitting || !agreements.terms || !agreements.privacy}
          >
            {submitting ? t('common.creating') : t('register.submit')}
          </button>
        </form>

        <p className="switch-line">{t('common.alreadyHaveAccount')} <Link to={withReturnParam('/login', returnUrl)}>{t('common.login')}</Link></p>
        <Feedback feedback={feedback} />
      </section>
    </main>
  );
}
