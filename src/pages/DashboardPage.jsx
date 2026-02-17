import { Fragment, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { rotateGameCode } from '../lib/api';
import { useAuth } from '../components/AuthProvider';
import { Feedback, TopBar } from '../components/Layout';

function formatIso(value) {
  if(!value) return '-';
  const d = new Date(value);
  if(Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ko-KR', { hour12: false });
}

export default function DashboardPage() {
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState(null);
  const [newCode, setNewCode] = useState('');
  const [rotating, setRotating] = useState(false);

  const rows = useMemo(() => ([
    ['User ID', user?.id],
    ['Username', user?.username],
    ['Email', user?.email],
    ['Signup Country', user?.country_signup],
    ['Created At', formatIso(user?.created_at)],
    ['Code Rotated', formatIso(user?.game_login_code_rotated_at)],
  ]), [user]);

  const onRotate = async () => {
    setFeedback(null);
    setRotating(true);
    try {
      const result = await rotateGameCode();
      setNewCode(result.code);
      await refresh();
      setFeedback({ type: 'ok', message: '새 게임 로그인 코드가 발급되었습니다.' });
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
            <Link className="btn ghost" to="/">메인</Link>
            <button className="btn" type="button" onClick={onLogout}>로그아웃</button>
          </>
        }
      />

      <section className="hero">
        <p className="eyebrow">ACCOUNT CONTROL CENTER</p>
        <h1>계정 대시보드</h1>
        <p className="lead">게임 로그인 코드는 재발급 전까지 유효합니다.</p>
      </section>

      <section className="feature-grid dash-grid">
        <article className="panel">
          <h3>내 계정</h3>
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
          <h3>초대 코드</h3>
          <p className="muted">해외 유저 가입 시 이 코드를 공유하세요.</p>
          <pre className="mono">{user?.invite_code || '-'}</pre>
          <p className="muted">사용 {user?.invite_used ?? 0} / {user?.invite_quota ?? 0}</p>
        </article>

        <article className="panel">
          <h3>게임 로그인 코드</h3>
          <p className="muted">보안상 현재 코드는 표시하지 않습니다.</p>
          <button className="btn" type="button" onClick={onRotate} disabled={rotating}>
            {rotating ? '발급 중...' : '새 코드 발급'}
          </button>
          {newCode ? <pre className="mono">NEW CODE{`\n`}{newCode}{`\n\n`}In game: /login {newCode}</pre> : null}
        </article>
      </section>

      <section className="panel">
        <h3>인게임 사용법</h3>
        <ol className="steps">
          <li>DDNet 서버 접속</li>
          <li>채팅창에 <code>/login 발급코드</code> 입력</li>
          <li>인증 성공 시 관전 해제 후 플레이 가능</li>
        </ol>
      </section>

      <Feedback feedback={feedback} />
    </main>
  );
}
