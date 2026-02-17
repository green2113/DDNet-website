import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { register } from '../lib/api';
import { useAuth } from '../components/AuthProvider';
import { Feedback } from '../components/Layout';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    inviteCode: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setFeedback(null);
    setSubmitting(true);
    try {
      const data = await register({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        inviteCode: form.inviteCode.trim(),
      });
      await refresh();
      setFeedback({ type: 'ok', message: `회원가입 성공. 게임 코드: ${data.gameCode}` });
      setTimeout(() => navigate('/dashboard'), 900);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <Link className="mini-link" to="/">← 메인으로</Link>
      <section className="panel auth-card">
        <p className="eyebrow">CREATE ACCOUNT</p>
        <h1>회원가입</h1>
        <p className="muted">대만 사용자는 바로 가입 가능, 해외 사용자는 초대코드가 필요합니다.</p>

        <form className="form" onSubmit={onSubmit}>
          <label>
            아이디
            <input value={form.username} onChange={(e) => setField('username', e.target.value)} minLength={3} maxLength={24} required autoComplete="username" />
          </label>
          <label>
            이메일
            <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} required autoComplete="email" />
          </label>
          <label>
            비밀번호
            <input type="password" value={form.password} onChange={(e) => setField('password', e.target.value)} minLength={8} required autoComplete="new-password" />
          </label>
          <label>
            초대코드 (해외 가입 시 필수)
            <input value={form.inviteCode} onChange={(e) => setField('inviteCode', e.target.value)} placeholder="예: ADMINTW1" />
          </label>
          <button className="btn" type="submit" disabled={submitting}>{submitting ? '생성 중...' : '계정 생성'}</button>
        </form>

        <p className="switch-line">이미 계정이 있으신가요? <Link to="/login">로그인</Link></p>
        <Feedback feedback={feedback} />
      </section>
    </main>
  );
}
