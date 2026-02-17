import {
  buildSetCookie,
  clearCookie,
  getClientIp,
  getCountryCode,
  hashPassword,
  isValidEmail,
  isValidPassword,
  isValidUsername,
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

function cookieSecure(request) {
  return new URL(request.url).protocol === 'https:';
}

async function publicUserById(env, userId) {
  return env.DB.prepare(`
    SELECT
      id,
      username,
      email,
      invite_code,
      invite_quota,
      invite_used,
      country_signup,
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
  const pepper = env.CODE_PEPPER;
  if(!pepper) {
    throw new Error('CODE_PEPPER is not configured');
  }

  for(let i = 0; i < 20; i += 1) {
    const code = randomCode(20);
    const hash = await sha256Hex(`${pepper}:${code}`);
    const exists = await env.DB.prepare('SELECT id FROM users WHERE game_login_code_hash = ? LIMIT 1').bind(hash).first();
    if(!exists) {
      return { code, hash };
    }
  }

  throw new Error('Failed to allocate game code');
}

async function handleRegister(context) {
	const { request, env } = context;
	if(!env.SESSION_SECRET || !env.CODE_PEPPER) {
		return json({ ok: false, message: 'Missing SESSION_SECRET or CODE_PEPPER' }, 500);
	}

	const body = await parseRequestBody(request);
	const data = typeof body === 'string' ? {} : (body || {});

  const username = String(data.username || '').trim();
  const email = lower(data.email || '');
  const password = String(data.password || '');
  const inviteInput = normalizeCode(data.inviteCode || '');

  if(!isValidUsername(username)) {
    return json({ ok: false, message: 'Username must be 3-24 chars (A-Z, a-z, 0-9, _)' }, 400);
  }
  if(!isValidEmail(email)) {
    return json({ ok: false, message: 'Invalid email format' }, 400);
  }
  if(!isValidPassword(password)) {
    return json({ ok: false, message: 'Password must be 8-128 chars' }, 400);
  }

  const existingByName = await env.DB.prepare('SELECT id FROM users WHERE username_lower = ? LIMIT 1').bind(lower(username)).first();
  if(existingByName) {
    return json({ ok: false, message: 'Username already exists' }, 409);
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
  const inviteQuota = Number(env.INVITE_DEFAULT_QUOTA || 1);

  let userId = 0;
  let gameCode = '';

  for(let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = await allocateInviteCode(env);
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
      const inserted = await env.DB.prepare(`
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
        gameData.hash,
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

async function handleRotateGameCode(context) {
  const { request, env } = context;
  const result = await currentUser(context);
  if(result.error) {
    return result.error;
  }

  const userId = result.user.id;

  for(let attempt = 0; attempt < 5; attempt += 1) {
    const gameData = await allocateGameCode(env);

    try {
      const updated = await env.DB.prepare(`
        UPDATE users
        SET game_login_code_hash = ?, game_login_code_rotated_at = ?
        WHERE id = ?
      `).bind(gameData.hash, nowIso(), userId).run();

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

async function handleGameVerify(context) {
	const { request, env } = context;
	if(!env.CODE_PEPPER) {
		return json({ ok: false, message: 'Missing CODE_PEPPER' }, 500);
	}

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

  const hash = await sha256Hex(`${env.CODE_PEPPER}:${code}`);
  const user = await env.DB.prepare(`
    SELECT id, username
    FROM users
    WHERE game_login_code_hash = ?
    LIMIT 1
  `).bind(hash).first();

  if(!user) {
    return json({ ok: false, message: 'Code not found' });
  }

  return json({
    ok: true,
    accountId: user.id,
    username: user.username,
  });
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
    return json({ ok: true, country: getCountryCode(request) });
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

  if(request.method === 'POST' && path === '/game-code/rotate') {
    return handleRotateGameCode(context);
  }

  if(request.method === 'POST' && path === '/game/verify') {
    return handleGameVerify(context);
  }

  return json({ ok: false, message: 'API route not found' }, 404);
}
