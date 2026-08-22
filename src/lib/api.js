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

export async function updateProfileDisplayName(payload) {
  return api('/api/profile/display-name', {
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

export async function adminGetAbuseReviews(status = 'open', kind = 'all') {
  const s = encodeURIComponent(String(status || 'open'));
  const k = encodeURIComponent(String(kind || 'all'));
  return api(`/api/admin/abuse/reviews?status=${s}&kind=${k}`, { method: 'GET' });
}

export async function adminGetAbuseLinks(accountId) {
  const id = encodeURIComponent(String(accountId || ''));
  return api(`/api/admin/abuse/links?accountId=${id}`, { method: 'GET' });
}

export async function adminResolveAbuseReview(payload) {
  return api('/api/admin/abuse/resolve', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function adminCreateAbuseTestCase(payload) {
  return api('/api/admin/abuse/test-case', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
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

function parseMaintenanceRoutes() {
  const raw = import.meta.env.VITE_MAINTENANCE_SERVER_ROUTES_JSON || '[]';
  try {
    const parsed = JSON.parse(raw);
    const entries = Array.isArray(parsed) ? parsed : [];
    return entries
      .map((entry) => ({
        key: String(entry?.key || '').trim(),
        label: String(entry?.label || entry?.key || '').trim(),
        url: String(entry?.url || entry?.pushUrl || entry?.maintenanceUrl || '').trim(),
        secret: String(entry?.secret || entry?.pushSecret || '').trim(),
      }))
      .filter((entry) => entry.key && entry.url);
  } catch {
    return [];
  }
}

function maintenanceHeaders(route) {
  const headers = {
    'content-type': 'application/json',
  };
  if(route?.secret) {
    headers['x-maintenance-secret'] = route.secret;
  }
  return headers;
}

async function fetchMaintenanceRoute(route, path, options = {}) {
  const response = await fetch(`${route.url}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...maintenanceHeaders(route),
    },
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

export async function adminGetServerMaintenance() {
  const routes = parseMaintenanceRoutes();
  const results = await Promise.all(routes.map(async (route) => {
    try {
      const response = await fetchMaintenanceRoute(route, '', { method: 'GET' });
      const state = response?.state || {};
      return {
        key: route.key,
        label: route.label,
        url: route.url,
        pushConfigured: Boolean(route.url),
        enabled: Boolean(state?.maintenance?.enabled),
        allowIpsRaw: String(state?.maintenance?.allowIpsRaw || ''),
        blockMessage: String(state?.maintenance?.blockMessage || ''),
        updatedAt: String(state?.maintenance?.updatedAt || ''),
        schedules: Array.isArray(state?.schedules) ? state.schedules : [],
        announcement: state?.announcement || null,
        rawState: state,
        ok: true,
      };
    } catch (error) {
      return {
        key: route.key,
        label: route.label,
        url: route.url,
        pushConfigured: Boolean(route.url),
        enabled: false,
        allowIpsRaw: '',
        blockMessage: '',
        updatedAt: '',
        schedules: [],
        announcement: null,
        rawState: null,
        ok: false,
        error: error?.message || 'Request failed',
      };
    }
  }));

  return {
    ok: true,
    servers: results,
    schedules: results.flatMap((entry) => (Array.isArray(entry.schedules) ? entry.schedules.map((schedule) => ({
      ...schedule,
      serverKey: entry.key,
      serverLabel: entry.label,
    })) : [])),
  };
}

export async function adminSetServerMaintenance(payload) {
  const routes = parseMaintenanceRoutes();
  const serverKey = String(payload?.serverKey || '').trim();
  const route = routes.find((entry) => entry.key === serverKey);
  if(!route) {
    throw new Error('Maintenance server route not configured');
  }

  return fetchMaintenanceRoute(route, '', {
    method: 'POST',
    body: JSON.stringify({
      kind: 'manual',
      serverKey,
      enabled: Number(payload?.enabled ? 1 : 0) === 1,
      blockMessage: String(payload?.blockMessage || '').trim(),
      allowIpsRaw: String(payload?.allowIpsRaw || '').trim(),
    }),
  });
}

export async function adminCreateServerMaintenanceSchedule(payload) {
  const routes = parseMaintenanceRoutes();
  const serverKeys = Array.isArray(payload?.serverKeys)
    ? payload.serverKeys.map((entry) => String(entry || '').trim()).filter(Boolean)
    : [];
  if(serverKeys.length === 0) {
    throw new Error('Select at least one server');
  }

  const results = [];
  for(const serverKey of serverKeys) {
    const route = routes.find((entry) => entry.key === serverKey);
    if(!route) {
      throw new Error(`Maintenance route not configured for ${serverKey}`);
    }
    try {
      const response = await fetchMaintenanceRoute(route, '', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'schedule',
          serverKey,
          startAt: String(payload?.startAt || ''),
          announcementIntervalMinutes: Number(payload?.announcementIntervalMinutes || 5),
          blockMessage: String(payload?.blockMessage || '').trim(),
          allowIpsRaw: String(payload?.allowIpsRaw || '').trim(),
        }),
      });
      results.push({ serverKey, ok: true, response });
    } catch (error) {
      results.push({ serverKey, ok: false, error: error?.message || 'Request failed' });
    }
  }

  return { ok: true, results };
}

export async function adminCancelServerMaintenanceSchedule(payload) {
  const routes = parseMaintenanceRoutes();
  const serverKey = String(payload?.serverKey || '').trim();
  const scheduleId = String(payload?.scheduleId || '').trim();
  if(!serverKey || !scheduleId) {
    throw new Error('serverKey and scheduleId are required');
  }
  const route = routes.find((entry) => entry.key === serverKey);
  if(!route) {
    throw new Error('Maintenance server route not configured');
  }

  return fetchMaintenanceRoute(route, '', {
    method: 'POST',
    body: JSON.stringify({
      kind: 'cancel-schedule',
      serverKey,
      scheduleId,
    }),
  });
}
