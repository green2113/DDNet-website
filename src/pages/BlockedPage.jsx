import { Link } from 'react-router-dom';

export default function BlockedPage() {
  return (
    <main className="auth-shell">
      <section className="panel auth-card">
        <p className="eyebrow">ACCESS BLOCKED</p>
        <h1>접속이 차단되었습니다</h1>
        <p className="muted">
          현재 네트워크가 VPN/프록시로 감지되어 로그인 및 회원가입이 제한됩니다.
        </p>
        <div className="hero-actions">
          <Link className="btn" to="/">메인으로</Link>
          <Link className="btn ghost" to="/login">다시 시도</Link>
        </div>
      </section>
    </main>
  );
}
