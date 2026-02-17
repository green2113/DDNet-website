import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getGeo, login } from '../lib/api';
import { useAuth } from '../components/AuthProvider';
import { Feedback } from '../components/Layout';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

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
    setFeedback(null);
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      await refresh();
      setFeedback({ type: 'ok', message: '로그인 성공. 대시보드로 이동합니다.' });
      setTimeout(() => navigate('/dashboard'), 450);
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
      <Link className="mini-link" to="/">← 메인으로</Link>
      <section className="panel auth-card">
        <p className="eyebrow">WELCOME BACK</p>
        <h1>로그인</h1>
        <p className="muted">등록된 이메일과 비밀번호로 로그인하세요.</p>

        {user ? (
          <section className="panel soft-gap">
            <p className="muted">이미 로그인되어 있습니다.</p>
            <div className="hero-actions">
              <button className="btn" type="button" onClick={() => navigate('/dashboard')}>대시보드로 이동</button>
            </div>
          </section>
        ) : null}

        <form className="form" onSubmit={onSubmit}>
          <label>
            이메일
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label>
            비밀번호
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </label>
          <button className="btn" type="submit" disabled={submitting}>{submitting ? '로그인 중...' : '로그인'}</button>
        </form>

        <p className="switch-line">계정이 없으신가요? <Link to="/register">회원가입</Link></p>
        <Feedback feedback={feedback} />
      </section>
    </main>
  );
}
