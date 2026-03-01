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

export async function apiForm(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
  };
  const response = await fetch(path, {
    credentials: 'include',
    ...options,
    headers,
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

export async function resendEmailVerification(payload = {}) {
  return api('/api/auth/email/resend', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function verifyEmailCode(payload) {
  return api('/api/auth/email/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function requestPasswordResetCode(payload) {
  return api('/api/auth/password/request', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function checkPasswordResetCode(payload) {
  return api('/api/auth/password/check', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function resetPasswordWithCode(payload) {
  return api('/api/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function rotateGameCode() {
  return api('/api/game-code/rotate', { method: 'POST' });
}

export async function getCurrentGameCode() {
  return api('/api/game-code/current', { method: 'GET' });
}

export async function rotateDummyGameCode(payload = {}) {
  return api('/api/game-code/dummy/rotate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getCurrentDummyGameCode() {
  return api('/api/game-code/dummy/current', { method: 'GET' });
}

export async function getAutoLoginSettings() {
  return api('/api/me/auto-login-settings', { method: 'GET' });
}

export async function updateAutoLoginSettings(payload) {
  return api('/api/me/auto-login-settings', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
}

export async function updateProfileName(payload) {
  return api('/api/profile/name', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateDummyProfileName(payload) {
  return api('/api/profile/dummy-name', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function adminBanAccount(payload) {
  return api('/api/admin/ban', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function adminUnbanAccount(payload) {
  return api('/api/admin/unban', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function adminSearchUsers(query = '') {
  const q = encodeURIComponent(String(query || ''));
  return api(`/api/admin/users?q=${q}`, { method: 'GET' });
}

export async function startPatreonConnect() {
  window.location.assign('/api/billing/patreon/start');
}

export async function disconnectPatreon() {
  return api('/api/billing/patreon/disconnect', { method: 'POST' });
}

export async function getMySubscription() {
  return api('/api/billing/subscription/me', { method: 'GET' });
}

export async function adminGetPatreonTiers() {
  return api('/api/admin/patreon/tiers', { method: 'GET' });
}

export async function adminUpsertPatreonTier(payload) {
  return api('/api/admin/patreon/tiers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function adminDeletePatreonTier(externalTierId) {
  return api(`/api/admin/patreon/tiers/${encodeURIComponent(String(externalTierId || ''))}`, {
    method: 'DELETE',
  });
}

export async function adminGetTrailSettings() {
  return api('/api/admin/trail-settings', { method: 'GET' });
}

export async function adminUpdateTrailSettings(payload) {
  return api('/api/admin/trail-settings', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
}

export async function adminGrantSubscriptionMonths(payload) {
  return api('/api/admin/subscription/grant-months', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
}

export async function getTrailSettings() {
  return api('/api/me/trail-settings', { method: 'GET' });
}

export async function updateTrailSettings(payload) {
  return api('/api/me/trail-settings', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
}

export async function adminGetMapTargets() {
  return api('/api/admin/map-targets', { method: 'GET' });
}

export async function adminUploadMap(formData) {
  return apiForm('/api/admin/maps/upload', {
    method: 'POST',
    body: formData,
  });
}

export async function adminListMaps(query = '') {
  const q = encodeURIComponent(String(query || ''));
  return api(`/api/admin/maps?q=${q}`, { method: 'GET' });
}

export async function adminListMapDeployJobs() {
  return api('/api/admin/maps/deploy-jobs', { method: 'GET' });
}

export async function adminGetMapDeployJob(jobId) {
  return api(`/api/admin/maps/deploy-jobs/${encodeURIComponent(String(jobId || ''))}`, { method: 'GET' });
}

export async function adminRetryMapDeployJob(jobId) {
  return api(`/api/admin/maps/deploy-jobs/${encodeURIComponent(String(jobId || ''))}/retry`, {
    method: 'POST',
  });
}
