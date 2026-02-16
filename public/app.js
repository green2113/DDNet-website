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

function showResult(message, type = 'info') {
  const box = document.getElementById('result');
  if(!box) {
    return;
  }
  box.classList.remove('hidden', 'ok', 'error', 'info');
  box.classList.add(type);
  box.textContent = message;
}

function hideResult() {
  const box = document.getElementById('result');
  if(!box) {
    return;
  }
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

async function setupIndexPage() {
  const user = await ensureSession();
  if(user) {
    window.location.href = '/dashboard';
    return;
  }

  const registerForm = document.getElementById('register-form');
  const loginForm = document.getElementById('login-form');

  registerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideResult();

    const formData = new FormData(registerForm);
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

      showResult(`Registered. Your new game code: ${data.gameCode} (save it now).`, 'ok');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1200);
    } catch(err) {
      showResult(err.message, 'error');
    }
  });

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideResult();

    const formData = new FormData(loginForm);
    const payload = {
      identifier: String(formData.get('identifier') || '').trim(),
      password: String(formData.get('password') || ''),
    };

    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      showResult('Login successful.', 'ok');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 500);
    } catch(err) {
      showResult(err.message, 'error');
    }
  });
}

function renderUser(user) {
  const info = document.getElementById('account-info');
  if(!info) {
    return;
  }

  const rows = [
    ['User ID', user.id],
    ['Username', user.username],
    ['Email', user.email],
    ['Signup Country', user.country_signup],
    ['Created At', user.created_at],
    ['Game Code Rotated', user.game_login_code_rotated_at],
  ];

  info.innerHTML = rows
    .map(([k, v]) => `<dt>${k}</dt><dd>${v ?? '-'}</dd>`)
    .join('');

  const inviteCode = document.getElementById('invite-code');
  const inviteUsage = document.getElementById('invite-usage');
  if(inviteCode) inviteCode.textContent = user.invite_code || '-';
  if(inviteUsage) inviteUsage.textContent = `Used ${user.invite_used} / ${user.invite_quota}`;
}

async function setupDashboardPage() {
  const user = await ensureSession();
  if(!user) {
    window.location.href = '/';
    return;
  }

  renderUser(user);

  const rotateBtn = document.getElementById('rotate-code');
  const newCodeEl = document.getElementById('new-code');
  const logoutBtn = document.getElementById('logout');

  rotateBtn?.addEventListener('click', async () => {
    hideResult();

    try {
      const data = await api('/api/game-code/rotate', { method: 'POST' });
      if(newCodeEl) {
        newCodeEl.classList.remove('hidden');
        newCodeEl.textContent = `New code: ${data.code}\nIn game: /login ${data.code}`;
      }
      showResult('Game code rotated. Old code is now invalid.', 'ok');
    } catch(err) {
      showResult(err.message, 'error');
    }
  });

  logoutBtn?.addEventListener('click', async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
      window.location.href = '/';
    } catch(err) {
      showResult(err.message, 'error');
    }
  });
}

(async function init() {
  const page = document.body.getAttribute('data-page');
  if(page === 'dashboard') {
    await setupDashboardPage();
  } else {
    await setupIndexPage();
  }
})();
