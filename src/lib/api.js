export async function api(path, options = {}) {
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
    const error = new Error(data.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

export async function getMe() {
  const data = await api('/api/me', { method: 'GET' });
  return data.user;
}

export async function getGeo() {
  return api('/api/geo', { method: 'GET' });
}

export async function login(payload) {
  return api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function register(payload) {
  return api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function logout() {
  return api('/api/auth/logout', { method: 'POST' });
}

export async function rotateGameCode() {
  return api('/api/game-code/rotate', { method: 'POST' });
}

export async function getCurrentGameCode() {
  return api('/api/game-code/current', { method: 'GET' });
}
