import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { Feedback, TopBar } from '../components/Layout';

export default function HomePage() {
  const { user, logout } = useAuth();
  const [feedback, setFeedback] = useState(null);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      setFeedback({ type: 'ok', message: '로그아웃되었습니다.' });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  return (
    <main className="shell">
      <TopBar
        right={
          user ? (
            <>
              <button className="btn" type="button" onClick={() => navigate('/dashboard')}>대시보드</button>
              <button className="btn ghost" type="button" onClick={handleLogout}>로그아웃</button>
            </>
          ) : (
            <>
              <Link className="btn ghost" to="/login">로그인</Link>
              <Link className="btn" to="/register">회원가입</Link>
            </>
          )
        }
      />

      <section className="hero home-hero">
        <p className="eyebrow">DDNET SERVER ACCESS</p>
        <h1>웹 인증 기반 DDNet 입장 시스템</h1>
        <p className="lead">
          계정을 만들고 게임 로그인 코드를 발급받은 뒤, 인게임에서 <code>/login 코드</code>를 입력해
          관전 상태를 해제하세요.
        </p>
        <div className="hero-actions">
          {user ? (
            <>
              <Link className="btn" to="/dashboard">대시보드로 이동</Link>
              <Link className="btn ghost" to="/register">다른 계정 만들기</Link>
            </>
          ) : (
            <>
              <Link className="btn" to="/login">로그인 시작</Link>
              <Link className="btn ghost" to="/register">새 계정 만들기</Link>
            </>
          )}
        </div>
      </section>

      <section className="feature-grid">
        <article className="panel feature">
          <h3>웹 계정 로그인</h3>
          <p>이메일/비밀번호로 로그인해서 계정을 관리합니다.</p>
        </article>
        <article className="panel feature">
          <h3>게임 코드 발급</h3>
          <p>대시보드에서 반영구 게임 로그인 코드를 재발급할 수 있습니다.</p>
        </article>
        <article className="panel feature">
          <h3>인게임 인증</h3>
          <p>서버에서 <code>/login 코드</code>를 입력하면 플레이가 활성화됩니다.</p>
        </article>
      </section>

      <Feedback feedback={feedback} />
    </main>
  );
}
