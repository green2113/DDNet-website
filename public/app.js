async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({ ok: false, message: 'Invalid API response' }));
  if(!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

function resultBox() {
  return document.getElementById('result');
}

function showResult(message, type = 'info') {
  const box = resultBox();
  if(!box) return;
  box.classList.remove('hidden', 'ok', 'error', 'info');
  box.classList.add(type);
  box.textContent = message;
}

function hideResult() {
  const box = resultBox();
  if(!box) return;
  box.classList.add('hidden');
  box.textContent = '';
}

async function ensureSession() {
  try {
    const me = await api('/api/me', { method: 'GET' });
    return me.user;
  } catch {
    return null;
  }
}

function renderUser(user) {
  const info = document.getElementById('account-info');
  if(!info) return;

  const rows = [
    ['User ID', user.id],
    ['Username', user.username],
    ['Email', user.email],
    ['Signup Country', user.country_signup],
    ['Created At', user.created_at],
    ['Code Rotated', user.game_login_code_rotated_at],
  ];

  info.innerHTML = rows
    .map(([key, value]) => `<dt>${key}</dt><dd>${value ?? '-'}</dd>`)
    .join('');

  const inviteCode = document.getElementById('invite-code');
  const inviteUsage = document.getElementById('invite-usage');
  if(inviteCode) inviteCode.textContent = user.invite_code || '-';
  if(inviteUsage) inviteUsage.textContent = `사용 ${user.invite_used} / ${user.invite_quota}`;
}

async function initHome() {
  const user = await ensureSession();
  const authLinks = document.getElementById('home-auth-links');
  const userLinks = document.getElementById('home-user-links');
  const mainActions = document.getElementById('home-main-actions');

  if(user) {
    authLinks?.classList.add('hidden');
    userLinks?.classList.remove('hidden');
    if(mainActions) {
      mainActions.innerHTML = '<a class="btn" href="/dashboard">대시보드로 이동</a>';
    }
  }

  document.getElementById('home-logout')?.addEventListener('click', async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
      window.location.reload();
    } catch(err) {
      showResult(err.message, 'error');
    }
  });
}

async function initLogin() {
  const user = await ensureSession();
  if(user) {
    window.location.href = '/dashboard';
    return;
  }

  const form = document.getElementById('login-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideResult();

    const formData = new FormData(form);
    const payload = {
      identifier: String(formData.get('identifier') || '').trim(),
      password: String(formData.get('password') || ''),
    };

    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showResult('로그인 성공. 대시보드로 이동합니다.', 'ok');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 500);
    } catch(err) {
      showResult(err.message, 'error');
    }
  });
}

async function initRegister() {
  const user = await ensureSession();
  if(user) {
    window.location.href = '/dashboard';
    return;
  }

  const form = document.getElementById('register-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideResult();

    const formData = new FormData(form);
    const payload = {
      username: String(formData.get('username') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      password: String(formData.get('password') || ''),
      inviteCode: String(formData.get('inviteCode') || '').trim(),
    };

    try {
      const data = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showResult(`회원가입 성공. 게임 코드: ${data.gameCode}`, 'ok');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 900);
    } catch(err) {
      showResult(err.message, 'error');
    }
  });
}

async function initDashboard() {
  const user = await ensureSession();
  if(!user) {
    window.location.href = '/login';
    return;
  }

  renderUser(user);

  document.getElementById('rotate-code')?.addEventListener('click', async () => {
    hideResult();
    try {
      const data = await api('/api/game-code/rotate', { method: 'POST' });
      const codeBox = document.getElementById('new-code');
      if(codeBox) {
        codeBox.classList.remove('hidden');
        codeBox.textContent = `NEW CODE\n${data.code}\n\nIn game: /login ${data.code}`;
      }
      showResult('새 게임 로그인 코드가 발급되었습니다.', 'ok');
    } catch(err) {
      showResult(err.message, 'error');
    }
  });

  document.getElementById('logout')?.addEventListener('click', async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch(err) {
      showResult(err.message, 'error');
    }
  });
}

(async function init() {
  const page = document.body.getAttribute('data-page');
  if(page === 'home') await initHome();
  if(page === 'login') await initLogin();
  if(page === 'register') await initRegister();
  if(page === 'dashboard') await initDashboard();
})();
