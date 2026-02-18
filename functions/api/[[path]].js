import {
  buildSetCookie,
  clearCookie,
  getClientIp,
  getCountryCode,
  hashPassword,
  isValidEmail,
  isValidPassword,
  isValidUsername,
  isLikelyVpnOrProxy,
  json,
  lower,
  normalizeCode,
  nowIso,
  parseCookies,
  parseRequestBody,
  randomCode,
  sha256Hex,
  signSessionToken,
  timingSafeEqual,
  verifyPassword,
  verifySessionToken,
} from '../_lib/utils.js';

const AUTH_COOKIE = 'ddnet_auth';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const NAME_CHANGE_COOLDOWN_DAYS = 10;
const NAME_CHANGE_COOLDOWN_MS = NAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
const TRUE_VALUES = ['1', 'true', 'yes', 'on'];

function cookieSecure(request) {
  return new URL(request.url).protocol === 'https:';
}

function vpnProxyBlockingEnabled(env) {
  return TRUE_VALUES.includes(String(env.BLOCK_VPN_PROXY || '').toLowerCase());
}

function vpnProxyBlockedResponse(action) {
  return json({
    ok: false,
    code: 'VPN_PROXY_BLOCKED',
    message: `VPN/Proxy connections are blocked for ${action}`,
  }, 403);
}

async function hasGameCodePlainColumn(env) {
  const row = await env.DB.prepare(`
    SELECT 1 AS ok
    FROM pragma_table_info('users')
    WHERE name = 'game_login_code_plain'
    LIMIT 1
  `).first();
  return !!row;
}

async function hasUsersColumn(env, columnName) {
  const row = await env.DB.prepare(`
    SELECT 1 AS ok
    FROM pragma_table_info('users')
    WHERE name = ?
    LIMIT 1
  `).bind(columnName).first();
  return !!row;
}

async function publicUserById(env, userId) {
  const hasNameChangeCooldown = await hasUsersColumn(env, 'name_change_available_at');
  return env.DB.prepare(`
    SELECT
      id,
      username,
      email,
      invite_code,
      invite_quota,
      invite_used,
      country_signup,
      ban_is_permanent,
      ban_until,
      ban_reason,
      ${hasNameChangeCooldown ? 'name_change_available_at' : 'NULL AS name_change_available_at'},
      game_login_code_rotated_at,
      created_at
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(userId).first();
}

async function currentUser(context) {
  const { request, env } = context;
  const secret = env.SESSION_SECRET;
  if(!secret) {
    return { error: json({ ok: false, message: 'SESSION_SECRET is not configured' }, 500) };
  }

  const cookies = parseCookies(request);
  const token = cookies[AUTH_COOKIE];
  if(!token) {
    return { error: json({ ok: false, message: 'Not logged in' }, 401) };
  }

  const payload = await verifySessionToken(token, secret);
  if(!payload) {
    return { error: json({ ok: false, message: 'Session expired' }, 401) };
  }

  const user = await publicUserById(env, payload.uid);
  if(!user) {
    return { error: json({ ok: false, message: 'Session not found' }, 401) };
  }

  return { user };
}

async function allocateInviteCode(env) {
  for(let i = 0; i < 20; i += 1) {
    const code = randomCode(8);
    const exists = await env.DB.prepare('SELECT id FROM users WHERE invite_code = ? LIMIT 1').bind(code).first();
    if(!exists) {
      return code;
    }
  }
  throw new Error('Failed to allocate invite code');
}

async function allocateGameCode(env) {
  const supportsPlainGameCode = await hasGameCodePlainColumn(env);

  for(let i = 0; i < 20; i += 1) {
    const code = randomCode(10);
    const exists = supportsPlainGameCode
      ? await env.DB.prepare('SELECT id FROM users WHERE game_login_code_hash = ? OR game_login_code_plain = ? LIMIT 1').bind(code, code).first()
      : await env.DB.prepare('SELECT id FROM users WHERE game_login_code_hash = ? LIMIT 1').bind(code).first();
    if(!exists) {
      return { code };
    }
  }

  throw new Error('Failed to allocate game code');
}

async function handleRegister(context) {
	const { request, env } = context;
	if(!env.SESSION_SECRET) {
		return json({ ok: false, message: 'Missing SESSION_SECRET' }, 500);
	}

  if(vpnProxyBlockingEnabled(env)) {
    const verdict = isLikelyVpnOrProxy(request);
    if(verdict.blocked) {
      return vpnProxyBlockedResponse('registration');
    }
  }

	const body = await parseRequestBody(request);
	const data = typeof body === 'string' ? {} : (body || {});

  const username = String(data.name || data.username || '').trim();
  const email = lower(data.email || '');
  const password = String(data.password || '');
  const inviteInput = normalizeCode(data.inviteCode || '');

  if(!isValidUsername(username)) {
    return json({ ok: false, message: 'Name must be 1-15 UTF-8 bytes and cannot start with /' }, 400);
  }
  if(!isValidEmail(email)) {
    return json({ ok: false, message: 'Invalid email format' }, 400);
  }
  if(!isValidPassword(password)) {
    return json({ ok: false, message: 'Password must be 8-128 chars' }, 400);
  }

  const existingByName = await env.DB.prepare('SELECT id FROM users WHERE username_lower = ? LIMIT 1').bind(lower(username)).first();
  if(existingByName) {
    return json({ ok: false, message: 'Name already exists' }, 409);
  }

  const existingByEmail = await env.DB.prepare('SELECT id FROM users WHERE email_lower = ? LIMIT 1').bind(email).first();
  if(existingByEmail) {
    return json({ ok: false, message: 'Email already exists' }, 409);
  }

  const country = getCountryCode(request);
  const isTaiwan = country === 'TW';

  if(!isTaiwan && !inviteInput) {
    return json({
      ok: false,
      message: 'Registration is limited to Taiwan unless you provide a valid invite code',
      country,
    }, 403);
  }

  let inviter = null;
  if(inviteInput) {
    inviter = await env.DB.prepare(`
      SELECT id, invite_quota, invite_used
      FROM users
      WHERE invite_code = ?
      LIMIT 1
    `).bind(inviteInput).first();

    if(!inviter || inviter.invite_used >= inviter.invite_quota) {
      return json({ ok: false, message: 'Invite code is invalid or exhausted' }, 400);
    }
  }

  const passwordHash = await hashPassword(password);
  const signupIp = getClientIp(request);
  const inviteQuotaDefault = Number(env.INVITE_DEFAULT_QUOTA || 1);
  const supportsPlainGameCode = await hasGameCodePlainColumn(env);

  let userId = 0;
  let gameCode = '';

  for(let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = isTaiwan ? await allocateInviteCode(env) : null;
    const inviteQuota = isTaiwan ? inviteQuotaDefault : 0;
    const gameData = await allocateGameCode(env);

    let consumedInvite = false;
    try {
      if(inviter) {
        const consume = await env.DB.prepare(`
          UPDATE users
          SET invite_used = invite_used + 1
          WHERE id = ? AND invite_used < invite_quota
        `).bind(inviter.id).run();

        if((consume.meta?.changes || 0) !== 1) {
          return json({ ok: false, message: 'Invite code is invalid or exhausted' }, 400);
        }
        consumedInvite = true;
      }

      const now = nowIso();
      const inserted = supportsPlainGameCode
        ? await env.DB.prepare(`
          INSERT INTO users (
            username,
            username_lower,
            email,
            email_lower,
            password_hash,
            invite_code,
            invite_quota,
            invite_used,
            inviter_id,
            country_signup,
            game_login_code_hash,
            game_login_code_plain,
            game_login_code_rotated_at,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
        `).bind(
          username,
          lower(username),
          email,
          email,
          passwordHash,
          inviteCode,
          inviteQuota,
          inviter ? inviter.id : null,
          country,
            gameData.code,
            gameData.code,
            now,
            now,
        ).run()
        : await env.DB.prepare(`
          INSERT INTO users (
            username,
            username_lower,
            email,
            email_lower,
            password_hash,
            invite_code,
            invite_quota,
            invite_used,
            inviter_id,
            country_signup,
            game_login_code_hash,
            game_login_code_rotated_at,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
        `).bind(
          username,
          lower(username),
          email,
          email,
          passwordHash,
          inviteCode,
          inviteQuota,
          inviter ? inviter.id : null,
          country,
            gameData.code,
            now,
            now,
        ).run();

      if((inserted.meta?.changes || 0) !== 1) {
        throw new Error('Insert failed');
      }

      userId = Number(inserted.meta?.last_row_id || 0);
      gameCode = gameData.code;

      if(inviter && userId > 0) {
        await env.DB.prepare(`
          INSERT INTO invite_uses (
            inviter_id,
            invitee_id,
            signup_ip,
            signup_country,
            used_at
          ) VALUES (?, ?, ?, ?, ?)
        `).bind(inviter.id, userId, signupIp, country, now).run();
      }

      break;
    } catch(err) {
      if(consumedInvite && inviter) {
        await env.DB.prepare('UPDATE users SET invite_used = MAX(invite_used - 1, 0) WHERE id = ?').bind(inviter.id).run();
      }

      const message = String(err && err.message ? err.message : err);
      const uniqueConflict = message.includes('UNIQUE');
      if(uniqueConflict && attempt < 4) {
        continue;
      }

      console.error('register failed', err);
      return json({ ok: false, message: 'Registration failed' }, 500);
    }
  }

  if(!userId || !gameCode) {
    return json({ ok: false, message: 'Registration failed, retry later' }, 500);
  }

  const token = await signSessionToken(userId, env.SESSION_SECRET, SESSION_MAX_AGE);
  const setCookie = buildSetCookie(AUTH_COOKIE, token, {
    maxAge: SESSION_MAX_AGE,
    secure: cookieSecure(request),
  });

  const user = await publicUserById(env, userId);

  return json(
    {
      ok: true,
      message: 'Registered',
      user,
      gameCode,
    },
    200,
    {
      'set-cookie': setCookie,
    },
  );
}

async function handleLogin(context) {
	const { request, env } = context;
	if(!env.SESSION_SECRET) {
		return json({ ok: false, message: 'Missing SESSION_SECRET' }, 500);
	}

  if(vpnProxyBlockingEnabled(env)) {
    const verdict = isLikelyVpnOrProxy(request);
    if(verdict.blocked) {
      return vpnProxyBlockedResponse('login');
    }
  }

	const body = await parseRequestBody(request);
	const data = typeof body === 'string' ? {} : (body || {});

  const email = lower(data.email || data.identifier || '');
  const password = String(data.password || '');

  if(!email || !password) {
    return json({ ok: false, message: 'email and password are required' }, 400);
  }

  if(!isValidEmail(email)) {
    return json({ ok: false, message: 'Invalid email format' }, 400);
  }

  const row = await env.DB.prepare(`
    SELECT id, password_hash
    FROM users
    WHERE email_lower = ?
    LIMIT 1
  `).bind(email).first();

  if(!row) {
    return json({ ok: false, message: 'Invalid credentials' }, 401);
  }

  const ok = await verifyPassword(password, row.password_hash);
  if(!ok) {
    return json({ ok: false, message: 'Invalid credentials' }, 401);
  }

  const token = await signSessionToken(row.id, env.SESSION_SECRET, SESSION_MAX_AGE);
  const setCookie = buildSetCookie(AUTH_COOKIE, token, {
    maxAge: SESSION_MAX_AGE,
    secure: cookieSecure(request),
  });

  const user = await publicUserById(env, row.id);
  return json({ ok: true, user }, 200, { 'set-cookie': setCookie });
}

async function handleLogout(context) {
  const { request } = context;
  const setCookie = clearCookie(AUTH_COOKIE, {
    secure: cookieSecure(request),
  });

  return json({ ok: true }, 200, { 'set-cookie': setCookie });
}

async function handleMe(context) {
  const result = await currentUser(context);
  if(result.error) {
    return result.error;
  }

  return json({ ok: true, user: result.user });
}

async function handleUpdateProfileName(context) {
  const { request, env } = context;
  const result = await currentUser(context);
  if(result.error) {
    return result.error;
  }

  const body = await parseRequestBody(request);
  const data = typeof body === 'string' ? {} : (body || {});
  const nextName = String(data.name || '').trim();

  if(!isValidUsername(nextName)) {
    return json({ ok: false, message: 'Name must be 1-15 UTF-8 bytes and cannot start with /' }, 400);
  }

  if(nextName === String(result.user.username || '')) {
    return json({ ok: true, user: result.user, message: 'Name updated' });
  }

  const exists = await env.DB.prepare(`
    SELECT id
    FROM users
    WHERE username_lower = ?
      AND id != ?
    LIMIT 1
  `).bind(lower(nextName), result.user.id).first();
  if(exists) {
    return json({ ok: false, message: 'Name already exists' }, 409);
  }

  const cooldownSupported = await hasUsersColumn(env, 'name_change_available_at');
  if(!cooldownSupported) {
    return json({
      ok: false,
      message: 'Name cooldown column is missing. Run migrations first.',
    }, 500);
  }

  const cooldownInfo = await env.DB.prepare(`
    SELECT name_change_available_at
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(result.user.id).first();
  const nextAllowedRaw = String(cooldownInfo?.name_change_available_at || '');
  const nextAllowedMs = nextAllowedRaw ? Date.parse(nextAllowedRaw) : NaN;
  if(Number.isFinite(nextAllowedMs) && nextAllowedMs > Date.now()) {
    const remainingDays = Math.max(1, Math.ceil((nextAllowedMs - Date.now()) / (24 * 60 * 60 * 1000)));
    return json({
      ok: false,
      code: 'NAME_CHANGE_COOLDOWN',
      message: `You can change your name again in ${remainingDays} day(s).`,
      nextAllowedAt: new Date(nextAllowedMs).toISOString(),
      remainingDays,
    }, 429);
  }

  const nextAllowedAt = new Date(Date.now() + NAME_CHANGE_COOLDOWN_MS).toISOString();

  const updated = await env.DB.prepare(`
    UPDATE users
    SET username = ?, username_lower = ?, name_change_available_at = ?
    WHERE id = ?
  `).bind(nextName, lower(nextName), nextAllowedAt, result.user.id).run();

  if((updated.meta?.changes || 0) !== 1) {
    return json({ ok: false, message: 'Could not update name' }, 500);
  }

  const user = await publicUserById(env, result.user.id);
  return json({ ok: true, user, message: 'Name updated' });
}

async function handleRotateGameCode(context) {
  const { request, env } = context;
  const result = await currentUser(context);
  if(result.error) {
    return result.error;
  }

  const userId = result.user.id;
  const supportsPlainGameCode = await hasGameCodePlainColumn(env);

  for(let attempt = 0; attempt < 5; attempt += 1) {
    const gameData = await allocateGameCode(env);

    try {
      const updated = supportsPlainGameCode
        ? await env.DB.prepare(`
          UPDATE users
          SET game_login_code_hash = ?, game_login_code_plain = ?, game_login_code_rotated_at = ?
          WHERE id = ?
        `).bind(gameData.code, gameData.code, nowIso(), userId).run()
        : await env.DB.prepare(`
          UPDATE users
          SET game_login_code_hash = ?, game_login_code_rotated_at = ?
          WHERE id = ?
        `).bind(gameData.code, nowIso(), userId).run();

      if((updated.meta?.changes || 0) !== 1) {
        return json({ ok: false, message: 'Could not rotate game code' }, 500);
      }

      return json({ ok: true, code: gameData.code, message: 'Game login code rotated' });
    } catch(err) {
      const message = String(err && err.message ? err.message : err);
      if(message.includes('UNIQUE') && attempt < 4) {
        continue;
      }
      console.error('rotate failed', err);
      return json({ ok: false, message: 'Could not rotate game code' }, 500);
    }
  }

  return json({ ok: false, message: 'Could not rotate game code' }, 500);
}

async function handleGetCurrentGameCode(context) {
  const { env } = context;
  const result = await currentUser(context);
  if(result.error) {
    return result.error;
  }

  const supportsPlainGameCode = await hasGameCodePlainColumn(env);
  const row = supportsPlainGameCode
    ? await env.DB.prepare(`
      SELECT game_login_code_plain, game_login_code_hash
      FROM users
      WHERE id = ?
      LIMIT 1
    `).bind(result.user.id).first()
    : await env.DB.prepare(`
      SELECT game_login_code_hash
      FROM users
      WHERE id = ?
      LIMIT 1
    `).bind(result.user.id).first();

  const plain = String(row?.game_login_code_plain || '');
  const fallback = String(row?.game_login_code_hash || '');
  const isLegacyHash = /^[0-9a-f]{64}$/i.test(fallback);
  const code = plain || (isLegacyHash ? '' : fallback);
  return json({ ok: true, code, hasCode: code.length > 0 });
}

async function handleGameVerify(context) {
	const { request, env } = context;
	const key = request.headers.get('X-Game-Server-Key') || '';

  if(!env.GAME_SERVER_API_KEY || !timingSafeEqual(key, env.GAME_SERVER_API_KEY)) {
    return json({ ok: false, message: 'Unauthorized game server key' }, 401);
  }

  let rawCode = request.headers.get('X-Game-Login-Code') || '';
  if(!rawCode) {
    const body = await parseRequestBody(request);
    if(typeof body === 'string') {
      rawCode = body;
    } else if(body && typeof body.code === 'string') {
      rawCode = body.code;
    }
  }

  const code = normalizeCode(rawCode);
  if(code.length < 8 || code.length > 64) {
    return json({ ok: false, message: 'Invalid code format' });
  }

  let user = await env.DB.prepare(`
    SELECT id, username, ban_is_permanent, ban_until, ban_reason
    FROM users
    WHERE game_login_code_hash = ?
    LIMIT 1
  `).bind(code).first();

  if(!user && env.CODE_PEPPER) {
    const hash = await sha256Hex(`${env.CODE_PEPPER}:${code}`);
    user = await env.DB.prepare(`
      SELECT id, username, ban_is_permanent, ban_until, ban_reason
      FROM users
      WHERE game_login_code_hash = ?
      LIMIT 1
    `).bind(hash).first();
  }

  if(!user) {
    return json({ ok: false, message: 'Code not found' });
  }

  const now = Date.now();
  const permanent = Number(user.ban_is_permanent || 0) !== 0;
  const banUntilRaw = String(user.ban_until || '');
  const banUntilMs = banUntilRaw ? Date.parse(banUntilRaw) : NaN;
  const tempActive = Number.isFinite(banUntilMs) && banUntilMs > now;
  const banned = permanent || tempActive;

  if(banned) {
    const remainingSeconds = tempActive ? Math.max(0, Math.ceil((banUntilMs - now) / 1000)) : 0;
    return json({
      ok: false,
      code: 'ACCOUNT_BANNED',
      message: permanent
        ? 'This account is permanently restricted from gameplay.'
        : `This account is temporarily restricted from gameplay. Remaining time: ${remainingSeconds} second(s).`,
      banPermanent: permanent,
      banUntil: banUntilRaw,
      banReason: String(user.ban_reason || ''),
      remainingSeconds,
    });
  }

  return json({
    ok: true,
    accountId: user.id,
    name: user.username,
    username: user.username,
  });
}

async function handleGameBan(context) {
  const { request, env } = context;
  const key = request.headers.get('X-Game-Server-Key') || '';
  if(!env.GAME_SERVER_API_KEY || !timingSafeEqual(key, env.GAME_SERVER_API_KEY)) {
    return json({ ok: false, message: 'Unauthorized game server key' }, 401);
  }

  const accountId = Number(request.headers.get('X-Game-Account-Id') || 0);
  const permanentHeader = String(request.headers.get('X-Game-Ban-Permanent') || '').toLowerCase();
  const minutesHeader = Number(request.headers.get('X-Game-Ban-Minutes') || 0);
  const reason = String(request.headers.get('X-Game-Ban-Reason') || '').trim();

  if(!Number.isFinite(accountId) || accountId <= 0) {
    return json({ ok: false, message: 'Invalid account id' }, 400);
  }

  const permanent = ['1', 'true', 'yes', 'on'].includes(permanentHeader) || minutesHeader <= 0;
  const minutes = Math.max(1, Math.floor(minutesHeader));
  const banUntil = permanent ? null : new Date(Date.now() + minutes * 60 * 1000).toISOString();

  const updated = await env.DB.prepare(`
    UPDATE users
    SET ban_is_permanent = ?, ban_until = ?, ban_reason = ?
    WHERE id = ?
  `).bind(permanent ? 1 : 0, banUntil, reason, accountId).run();

  if((updated.meta?.changes || 0) !== 1) {
    return json({ ok: false, message: 'Account not found' }, 404);
  }

  return json({
    ok: true,
    accountId,
    banPermanent: permanent,
    banUntil,
    banReason: reason,
  });
}

async function handleGameUnban(context) {
  const { request, env } = context;
  const key = request.headers.get('X-Game-Server-Key') || '';
  if(!env.GAME_SERVER_API_KEY || !timingSafeEqual(key, env.GAME_SERVER_API_KEY)) {
    return json({ ok: false, message: 'Unauthorized game server key' }, 401);
  }

  const accountId = Number(request.headers.get('X-Game-Account-Id') || 0);
  if(!Number.isFinite(accountId) || accountId <= 0) {
    return json({ ok: false, message: 'Invalid account id' }, 400);
  }

  const updated = await env.DB.prepare(`
    UPDATE users
    SET ban_is_permanent = 0, ban_until = NULL, ban_reason = ''
    WHERE id = ?
  `).bind(accountId).run();

  if((updated.meta?.changes || 0) !== 1) {
    return json({ ok: false, message: 'Account not found' }, 404);
  }

  return json({ ok: true, accountId });
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  let path = url.pathname;
  if(path.startsWith('/api/')) {
    path = path.slice(4);
  } else if(path === '/api') {
    path = '/';
  }

  if(request.method === 'GET' && path === '/health') {
    return json({ ok: true, now: nowIso() });
  }

  if(request.method === 'GET' && path === '/geo') {
    const country = getCountryCode(request);
    let vpnBlocked = false;
    if(vpnProxyBlockingEnabled(context.env)) {
      vpnBlocked = isLikelyVpnOrProxy(request).blocked;
    }
    return json({ ok: true, country, vpnBlocked });
  }

  if(request.method === 'POST' && path === '/auth/register') {
    return handleRegister(context);
  }

  if(request.method === 'POST' && path === '/auth/login') {
    return handleLogin(context);
  }

  if(request.method === 'POST' && path === '/auth/logout') {
    return handleLogout(context);
  }

  if(request.method === 'GET' && path === '/me') {
    return handleMe(context);
  }

  if(request.method === 'POST' && path === '/profile/name') {
    return handleUpdateProfileName(context);
  }

  if(request.method === 'POST' && path === '/game-code/rotate') {
    return handleRotateGameCode(context);
  }

  if(request.method === 'GET' && path === '/game-code/current') {
    return handleGetCurrentGameCode(context);
  }

  if(request.method === 'POST' && path === '/game/verify') {
    return handleGameVerify(context);
  }

  if(request.method === 'POST' && path === '/game/ban') {
    return handleGameBan(context);
  }

  if(request.method === 'POST' && path === '/game/unban') {
    return handleGameUnban(context);
  }

  return json({ ok: false, message: 'API route not found' }, 404);
}
