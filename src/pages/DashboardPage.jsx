import { Fragment, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { rotateGameCode } from '../lib/api';
import { useAuth } from '../components/AuthProvider';
import { useI18n } from '../components/I18nProvider';
import { Feedback, TopBar } from '../components/Layout';

function formatIso(value, locale) {
  if(!value) return '-';
  const d = new Date(value);
  if(Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(locale, { hour12: false });
}

export default function DashboardPage() {
  const { user, refresh, logout } = useAuth();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState(null);
  const [newCode, setNewCode] = useState('');
  const [rotating, setRotating] = useState(false);

  const rows = useMemo(() => ([
    [t('dashboard.rowUserId'), user?.id],
    [t('dashboard.rowUsername'), user?.username],
    [t('dashboard.rowEmail'), user?.email],
    [t('dashboard.rowCountry'), user?.country_signup],
    [t('dashboard.rowCreatedAt'), formatIso(user?.created_at, locale)],
    [t('dashboard.rowCodeRotated'), formatIso(user?.game_login_code_rotated_at, locale)],
  ]), [locale, t, user]);

  const onRotate = async () => {
    setFeedback(null);
    setRotating(true);
    try {
      const result = await rotateGameCode();
      setNewCode(result.code);
      await refresh();
      setFeedback({ type: 'ok', message: t('dashboard.rotated') });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setRotating(false);
    }
  };

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
          <>
            <Link className="btn ghost" to="/">{t('common.home')}</Link>
            <button className="btn" type="button" onClick={onLogout}>{t('common.logout')}</button>
          </>
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
          <button className="btn" type="button" onClick={onRotate} disabled={rotating}>
            {rotating ? t('dashboard.rotating') : t('dashboard.rotate')}
          </button>
          {newCode ? <pre className="mono">{t('dashboard.newCodeHeader')}{`\n`}{newCode}{`\n\n`}{t('dashboard.newCodeInGame')}: /login {newCode}</pre> : null}
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
