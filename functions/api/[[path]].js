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
const EMAIL_VERIFY_CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_VERIFY_RESEND_COOLDOWN_MS = 60 * 1000;
const PASSWORD_RESET_CODE_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_RESEND_COOLDOWN_MS = 60 * 1000;
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

function randomDigits(length) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for(let i = 0; i < bytes.length; i += 1) {
    out += String(bytes[i] % 10);
  }
  return out;
}

async function emailCodeHash(env, userId, code) {
  return sha256Hex(`${env.SESSION_SECRET || ''}:${userId}:${code}`);
}

async function sendVerificationEmail(env, email, code) {
  const apiKey = String(env.RESEND_API_KEY || '').trim();
  const from = String(env.EMAIL_FROM || 'noreply@playravion.com').trim();
  if(!apiKey || !from) {
    throw new Error('Missing RESEND_API_KEY or EMAIL_FROM');
  }
  const fromWithName = from.includes('<') ? from : `Ravion <${from}>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: fromWithName,
      to: [email],
      subject: '[Ravion] Email Verification Code',
      text: `Your verification code is: ${code}\nThis code expires in 10 minutes.`,
      html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 10 minutes.</p>`,
    }),
  });

  if(!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Email provider failed (${response.status}): ${body}`);
  }
}

async function sendPasswordResetEmail(env, email, code) {
  const apiKey = String(env.RESEND_API_KEY || '').trim();
  const from = String(env.EMAIL_FROM || 'noreply@playravion.com').trim();
  if(!apiKey || !from) {
    throw new Error('Missing RESEND_API_KEY or EMAIL_FROM');
  }
  const fromWithName = from.includes('<') ? from : `Ravion <${from}>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: fromWithName,
      to: [email],
      subject: '[Ravion] Password Reset Code',
      text: `Your password reset code is: ${code}\nThis code expires in 10 minutes.`,
      html: `<p>Your password reset code is: <strong>${code}</strong></p><p>This code expires in 10 minutes.</p>`,
    }),
  });

  if(!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Email provider failed (${response.status}): ${body}`);
  }
}

async function ensurePasswordResetTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      used_at TEXT DEFAULT NULL
    )
  `).run();
  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_password_resets_user_id
    ON password_resets(user_id)
  `).run();
}

async function passwordResetCodeHash(env, userId, code) {
  return sha256Hex(`pwreset:${env.SESSION_SECRET || ''}:${userId}:${code}`);
}

async function issueEmailVerificationCode(env, userId, email, { bypassCooldown = false } = {}) {
  const row = await env.DB.prepare(`
    SELECT email_verified, email_verify_sent_at, email_verify_expires_at
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(userId).first();
  if(!row) {
    throw new Error('Account not found');
  }
  if(Number(row.email_verified || 0) === 1) {
    return { alreadyVerified: true };
  }

  const sentAtRaw = String(row.email_verify_sent_at || '');
  const sentAtMs = sentAtRaw ? Date.parse(sentAtRaw) : NaN;
  const existingExpiresAt = String(row.email_verify_expires_at || '');
  if(!bypassCooldown && Number.isFinite(sentAtMs) && (Date.now() - sentAtMs) < EMAIL_VERIFY_RESEND_COOLDOWN_MS) {
    const waitSeconds = Math.max(1, Math.ceil((EMAIL_VERIFY_RESEND_COOLDOWN_MS - (Date.now() - sentAtMs)) / 1000));
    return { cooldown: true, waitSeconds, expiresAt: existingExpiresAt };
  }

  const code = randomDigits(6);
  await sendVerificationEmail(env, email, code);

  const codeHash = await emailCodeHash(env, userId, code);
  const now = nowIso();
  const expiresAt = new Date(Date.now() + EMAIL_VERIFY_CODE_TTL_MS).toISOString();
  await env.DB.prepare(`
    UPDATE users
    SET email_verify_code_hash = ?, email_verify_expires_at = ?, email_verify_sent_at = ?
    WHERE id = ?
  `).bind(codeHash, expiresAt, now, userId).run();

  return { ok: true, expiresAt };
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
  const hasDummyName = await hasUsersColumn(env, 'dummy_name');
  const hasDummyNameChangeCooldown = await hasUsersColumn(env, 'dummy_name_change_available_at');
  const hasEmailVerified = await hasUsersColumn(env, 'email_verified');
  const hasIsAdmin = await hasUsersColumn(env, 'is_admin');
  return env.DB.prepare(`
    SELECT
      id,
      username,
      ${hasDummyName ? 'dummy_name' : 'NULL AS dummy_name'},
      ${hasDummyNameChangeCooldown ? 'dummy_name_change_available_at' : 'NULL AS dummy_name_change_available_at'},
      email,
      ${hasEmailVerified ? 'email_verified' : '1 AS email_verified'},
      invite_code,
      invite_quota,
      invite_used,
      country_signup,
      ${hasIsAdmin ? 'is_admin' : '0 AS is_admin'},
      ban_is_permanent,
      ban_until,
      ${hasNameChangeCooldown ? 'name_change_available_at' : 'NULL AS name_change_available_at'}
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(userId).first();
}

async function isNameTaken(env, name, excludeUserId = null) {
  const normalized = lower(name || '');
  if(!normalized) {
    return false;
  }
  const hasDummyNameLower = await hasUsersColumn(env, 'dummy_name_lower');
  const byUsername = excludeUserId === null
    ? await env.DB.prepare('SELECT id FROM users WHERE username_lower = ? LIMIT 1').bind(normalized).first()
    : await env.DB.prepare('SELECT id FROM users WHERE username_lower = ? AND id != ? LIMIT 1').bind(normalized, excludeUserId).first();
  if(byUsername) {
    return true;
  }
  if(!hasDummyNameLower) {
    return false;
  }
  const byDummy = excludeUserId === null
    ? await env.DB.prepare(`SELECT id FROM users WHERE dummy_name_lower = ? LIMIT 1`).bind(normalized).first()
    : await env.DB.prepare(`SELECT id FROM users WHERE dummy_name_lower = ? AND id != ? LIMIT 1`).bind(normalized, excludeUserId).first();
  return !!byDummy;
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

function isEmailVerified(user) {
  return Number(user?.email_verified || 0) === 1;
}

function emailVerificationRequiredResponse() {
  return json({
    ok: false,
    code: 'EMAIL_NOT_VERIFIED',
    message: 'Email verification is required',
  }, 403);
}

async function requireAdmin(context) {
  const result = await currentUser(context);
  if(result.error) {
    return result;
  }
  if(Number(result.user?.is_admin || 0) !== 1) {
    return { error: json({ ok: false, message: 'Admin privileges required' }, 403) };
  }
  return result;
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

async function allocateDummyGameCode(env) {
  const supportsPlainGameCode = await hasGameCodePlainColumn(env);
  const supportsDummyPlain = await hasUsersColumn(env, 'dummy_login_code_plain');

  for(let i = 0; i < 20; i += 1) {
    const code = randomCode(10);
    const exists = supportsPlainGameCode
      ? await env.DB.prepare(`
        SELECT id
        FROM users
        WHERE game_login_code_hash = ?
           OR game_login_code_plain = ?
           OR dummy_login_code_hash = ?
           ${supportsDummyPlain ? 'OR dummy_login_code_plain = ?' : ''}
        LIMIT 1
      `).bind(...(supportsDummyPlain ? [code, code, code, code] : [code, code, code])).first()
      : await env.DB.prepare(`
        SELECT id
        FROM users
        WHERE game_login_code_hash = ?
           OR dummy_login_code_hash = ?
        LIMIT 1
      `).bind(code, code).first();
    if(!exists) {
      return { code };
    }
  }

  throw new Error('Failed to allocate dummy code');
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

  if(await isNameTaken(env, username)) {
    return json({ ok: false, message: 'Name already exists' }, 409);
  }

  const existingByEmail = await env.DB.prepare('SELECT id FROM users WHERE email_lower = ? LIMIT 1').bind(email).first();
  if(existingByEmail) {
    return json({ ok: false, message: 'Email already exists' }, 409);
  }

  const country = getCountryCode(request);
  const isDirectSignupCountry = country === 'TW' || country === 'KR';

  if(!isDirectSignupCountry && !inviteInput) {
    return json({
      ok: false,
      message: 'Registration is open directly for Taiwan and Korea. Other countries require a valid invite code.',
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
  const hasEmailVerifyColumns = await hasUsersColumn(env, 'email_verified')
    && await hasUsersColumn(env, 'email_verify_code_hash')
    && await hasUsersColumn(env, 'email_verify_expires_at')
    && await hasUsersColumn(env, 'email_verify_sent_at')
    && await hasUsersColumn(env, 'email_verified_at');
  if(!hasEmailVerifyColumns) {
    return json({ ok: false, message: 'Email verification columns are missing. Run migrations first.' }, 500);
  }

  let userId = 0;

  for(let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = isDirectSignupCountry ? await allocateInviteCode(env) : null;
    const inviteQuota = isDirectSignupCountry ? inviteQuotaDefault : 0;
    // Keep a non-usable unique placeholder until user explicitly issues a code on dashboard.
    const pendingGameCodeHash = await sha256Hex(`pending:${randomCode(24)}:${nowIso()}`);

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
            email_verified,
            email_verify_code_hash,
            email_verify_expires_at,
            email_verify_sent_at,
            email_verified_at,
            invite_code,
            invite_quota,
            invite_used,
            inviter_id,
            country_signup,
            game_login_code_hash,
            game_login_code_plain,
            game_login_code_rotated_at,
            created_at
          ) VALUES (?, ?, ?, ?, ?, 0, NULL, NULL, NULL, NULL, ?, ?, 0, ?, ?, ?, ?, ?, ?)
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
            pendingGameCodeHash,
            '',
            '',
            now,
        ).run()
        : await env.DB.prepare(`
          INSERT INTO users (
            username,
            username_lower,
            email,
            email_lower,
            password_hash,
            email_verified,
            email_verify_code_hash,
            email_verify_expires_at,
            email_verify_sent_at,
            email_verified_at,
            invite_code,
            invite_quota,
            invite_used,
            inviter_id,
            country_signup,
            game_login_code_hash,
            game_login_code_rotated_at,
            created_at
          ) VALUES (?, ?, ?, ?, ?, 0, NULL, NULL, NULL, NULL, ?, ?, 0, ?, ?, ?, ?, ?)
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
            pendingGameCodeHash,
            '',
            now,
        ).run();

      if((inserted.meta?.changes || 0) !== 1) {
        throw new Error('Insert failed');
      }

      userId = Number(inserted.meta?.last_row_id || 0);

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

  if(!userId) {
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
      message: 'Registered. Please verify your email.',
      user,
      emailVerificationRequired: true,
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
    SELECT id, email, password_hash, email_verified
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
  return json({
    ok: true,
    user,
    emailVerificationRequired: !isEmailVerified(user),
  }, 200, { 'set-cookie': setCookie });
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

async function handleEmailResend(context) {
  const { env, request } = context;
  const result = await currentUser(context);
  if(result.error) {
    return result.error;
  }
  if(isEmailVerified(result.user)) {
    return json({ ok: true, message: 'Already verified' });
  }

  const body = await parseRequestBody(request);
  const data = typeof body === 'string' ? {} : (body || {});
  const auto = !!data.auto;

  if(auto) {
    const status = await env.DB.prepare(`
      SELECT email_verify_expires_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `).bind(result.user.id).first();
    const expiresAtRaw = String(status?.email_verify_expires_at || '');
    const expiresAtMs = expiresAtRaw ? Date.parse(expiresAtRaw) : NaN;
    if(Number.isFinite(expiresAtMs) && expiresAtMs > Date.now()) {
      return json({
        ok: true,
        message: 'Verification code is still active',
        expiresAt: expiresAtRaw,
        reusedActiveCode: true,
      });
    }
  }

  const issued = await issueEmailVerificationCode(env, result.user.id, String(result.user.email || ''), { bypassCooldown: false });
  if(issued.cooldown) {
    return json({
      ok: false,
      code: 'VERIFY_CODE_COOLDOWN',
      message: `Please wait ${issued.waitSeconds} second(s) before requesting another code.`,
      waitSeconds: issued.waitSeconds,
      expiresAt: issued.expiresAt || null,
    }, 429);
  }
  return json({ ok: true, message: 'Verification code sent', expiresAt: issued.expiresAt || null });
}

async function handleEmailVerify(context) {
  const { request, env } = context;
  const result = await currentUser(context);
  if(result.error) {
    return result.error;
  }
  if(isEmailVerified(result.user)) {
    return json({ ok: true, user: result.user, message: 'Already verified' });
  }

  const body = await parseRequestBody(request);
  const data = typeof body === 'string' ? {} : (body || {});
  const code = String(data.code || '').trim();
  if(!/^\d{6}$/.test(code)) {
    return json({ ok: false, message: 'Verification code must be 6 digits' }, 400);
  }

  const row = await env.DB.prepare(`
    SELECT email_verify_code_hash, email_verify_expires_at
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(result.user.id).first();
  const hash = String(row?.email_verify_code_hash || '');
  const expiresAtRaw = String(row?.email_verify_expires_at || '');
  if(!hash || !expiresAtRaw) {
    return json({ ok: false, message: 'No active verification code. Please resend.' }, 400);
  }

  const expiresAtMs = Date.parse(expiresAtRaw);
  if(!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return json({ ok: false, message: 'Verification code expired. Please resend.' }, 400);
  }

  const expected = await emailCodeHash(env, result.user.id, code);
  if(!timingSafeEqual(expected, hash)) {
    return json({ ok: false, message: 'Invalid verification code' }, 400);
  }

  await env.DB.prepare(`
    UPDATE users
    SET email_verified = 1,
        email_verified_at = ?,
        email_verify_code_hash = NULL,
        email_verify_expires_at = NULL
    WHERE id = ?
  `).bind(nowIso(), result.user.id).run();

  const user = await publicUserById(env, result.user.id);
  return json({ ok: true, user, message: 'Email verified' });
}

async function handlePasswordResetRequest(context) {
  const { request, env } = context;
  const body = await parseRequestBody(request);
  const data = typeof body === 'string' ? {} : (body || {});
  const email = lower(data.email || '');

  if(!email || !isValidEmail(email)) {
    return json({ ok: false, message: 'Invalid email format' }, 400);
  }

  const user = await env.DB.prepare(`
    SELECT id, email, email_verified
    FROM users
    WHERE email_lower = ?
    LIMIT 1
  `).bind(email).first();

  // Avoid leaking account existence.
  if(!user) {
    return json({ ok: true, message: 'If the account exists, a reset code was sent.' });
  }

  if(Number(user.email_verified || 0) !== 1) {
    return json({
      ok: false,
      code: 'PASSWORD_RESET_EMAIL_NOT_VERIFIED',
      message: 'This email is not verified, so password reset is unavailable.',
      supportUrl: 'https://discord.gg/NNtuG9es32',
    }, 403);
  }

  await ensurePasswordResetTable(env);

  const active = await env.DB.prepare(`
    SELECT sent_at, expires_at
    FROM password_resets
    WHERE user_id = ? AND used_at IS NULL
    ORDER BY id DESC
    LIMIT 1
  `).bind(user.id).first();

  const sentAtMs = Date.parse(String(active?.sent_at || ''));
  if(Number.isFinite(sentAtMs) && Date.now() - sentAtMs < PASSWORD_RESET_RESEND_COOLDOWN_MS) {
    const waitSeconds = Math.max(1, Math.ceil((PASSWORD_RESET_RESEND_COOLDOWN_MS - (Date.now() - sentAtMs)) / 1000));
    return json({
      ok: false,
      code: 'PASSWORD_RESET_COOLDOWN',
      message: `Please wait ${waitSeconds} second(s) before requesting another code.`,
      waitSeconds,
      expiresAt: String(active?.expires_at || '') || null,
    }, 429);
  }

  const code = randomDigits(6);
  await sendPasswordResetEmail(env, String(user.email || email), code);

  const now = nowIso();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_CODE_TTL_MS).toISOString();
  const codeHash = await passwordResetCodeHash(env, user.id, code);

  await env.DB.prepare(`
    INSERT INTO password_resets (user_id, code_hash, expires_at, sent_at, used_at)
    VALUES (?, ?, ?, ?, NULL)
  `).bind(user.id, codeHash, expiresAt, now).run();

  return json({ ok: true, message: 'Password reset code sent', expiresAt });
}

async function handlePasswordResetConfirm(context) {
  const { request, env } = context;
  const body = await parseRequestBody(request);
  const data = typeof body === 'string' ? {} : (body || {});
  const email = lower(data.email || '');
  const code = String(data.code || '').trim();
  const newPassword = String(data.newPassword || data.password || '');

  if(!email || !isValidEmail(email)) {
    return json({ ok: false, message: 'Invalid email format' }, 400);
  }
  if(!/^\d{6}$/.test(code)) {
    return json({ ok: false, message: 'Verification code must be 6 digits' }, 400);
  }
  if(!isValidPassword(newPassword)) {
    return json({ ok: false, message: 'Password must be at least 8 characters' }, 400);
  }

  const user = await env.DB.prepare(`
    SELECT id, email_verified
    FROM users
    WHERE email_lower = ?
    LIMIT 1
  `).bind(email).first();
  if(!user) {
    return json({ ok: false, message: 'Invalid email or reset code' }, 400);
  }
  if(Number(user.email_verified || 0) !== 1) {
    return json({
      ok: false,
      code: 'PASSWORD_RESET_EMAIL_NOT_VERIFIED',
      message: 'This email is not verified, so password reset is unavailable.',
      supportUrl: 'https://discord.gg/NNtuG9es32',
    }, 403);
  }

  await ensurePasswordResetTable(env);
  const row = await env.DB.prepare(`
    SELECT id, code_hash, expires_at
    FROM password_resets
    WHERE user_id = ? AND used_at IS NULL
    ORDER BY id DESC
    LIMIT 1
  `).bind(user.id).first();

  const hash = String(row?.code_hash || '');
  const expiresAtRaw = String(row?.expires_at || '');
  if(!hash || !expiresAtRaw) {
    return json({ ok: false, message: 'No active reset code. Please request a new one.' }, 400);
  }

  const expiresAtMs = Date.parse(expiresAtRaw);
  if(!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return json({ ok: false, message: 'Reset code expired. Please request a new one.' }, 400);
  }

  const expected = await passwordResetCodeHash(env, user.id, code);
  if(!timingSafeEqual(expected, hash)) {
    return json({ ok: false, message: 'Invalid email or reset code' }, 400);
  }

  const passwordHash = await hashPassword(newPassword);
  await env.DB.batch([
    env.DB.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).bind(passwordHash, user.id),
    env.DB.prepare(`UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL`).bind(nowIso(), user.id),
  ]);

  return json({ ok: true, message: 'Password has been reset' });
}

async function handlePasswordResetCheck(context) {
  const { request, env } = context;
  const body = await parseRequestBody(request);
  const data = typeof body === 'string' ? {} : (body || {});
  const email = lower(data.email || '');
  const code = String(data.code || '').trim();

  if(!email || !isValidEmail(email)) {
    return json({ ok: false, message: 'Invalid email format' }, 400);
  }
  if(!/^\d{6}$/.test(code)) {
    return json({ ok: false, message: 'Verification code must be 6 digits' }, 400);
  }

  const user = await env.DB.prepare(`
    SELECT id, email_verified
    FROM users
    WHERE email_lower = ?
    LIMIT 1
  `).bind(email).first();
  if(!user) {
    return json({ ok: false, message: 'Invalid email or reset code' }, 400);
  }
  if(Number(user.email_verified || 0) !== 1) {
    return json({
      ok: false,
      code: 'PASSWORD_RESET_EMAIL_NOT_VERIFIED',
      message: 'This email is not verified, so password reset is unavailable.',
      supportUrl: 'https://discord.gg/NNtuG9es32',
    }, 403);
  }

  await ensurePasswordResetTable(env);
  const row = await env.DB.prepare(`
    SELECT code_hash, expires_at
    FROM password_resets
    WHERE user_id = ? AND used_at IS NULL
    ORDER BY id DESC
    LIMIT 1
  `).bind(user.id).first();

  const hash = String(row?.code_hash || '');
  const expiresAtRaw = String(row?.expires_at || '');
  if(!hash || !expiresAtRaw) {
    return json({ ok: false, message: 'No active reset code. Please request a new one.' }, 400);
  }

  const expiresAtMs = Date.parse(expiresAtRaw);
  if(!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return json({ ok: false, message: 'Reset code expired. Please request a new one.' }, 400);
  }

  const expected = await passwordResetCodeHash(env, user.id, code);
  if(!timingSafeEqual(expected, hash)) {
    return json({ ok: false, message: 'Invalid email or reset code' }, 400);
  }

  return json({ ok: true, message: 'Reset code verified' });
}

async function handleUpdateProfileName(context) {
  const { request, env } = context;
  const result = await currentUser(context);
  if(result.error) {
    return result.error;
  }
  if(!isEmailVerified(result.user)) {
    return emailVerificationRequiredResponse();
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

  if(await isNameTaken(env, nextName, result.user.id)) {
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
    const remainingDays = Math.max(1, Math.floor((nextAllowedMs - Date.now()) / (24 * 60 * 60 * 1000)));
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
  if(!isEmailVerified(result.user)) {
    return emailVerificationRequiredResponse();
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

async function handleRotateDummyGameCode(context) {
  const { request, env } = context;
  const result = await currentUser(context);
  if(result.error) {
    return result.error;
  }
  if(!isEmailVerified(result.user)) {
    return emailVerificationRequiredResponse();
  }

  const hasDummyHash = await hasUsersColumn(env, 'dummy_login_code_hash');
  if(!hasDummyHash) {
    return json({ ok: false, message: 'Dummy code columns are missing. Run migrations first.' }, 500);
  }

  const supportsDummyPlain = await hasUsersColumn(env, 'dummy_login_code_plain');
  const hasDummyName = await hasUsersColumn(env, 'dummy_name');
  const hasDummyNameLower = await hasUsersColumn(env, 'dummy_name_lower');
  const userId = result.user.id;
  const body = await parseRequestBody(request);
  const data = typeof body === 'string' ? {} : (body || {});
  const requestedDummyName = String(data.name || data.dummyName || '').trim();

  const existingDummyRow = supportsDummyPlain
    ? await env.DB.prepare(`
      SELECT dummy_login_code_plain, dummy_login_code_hash
      FROM users
      WHERE id = ?
      LIMIT 1
    `).bind(userId).first()
    : await env.DB.prepare(`
      SELECT dummy_login_code_hash
      FROM users
      WHERE id = ?
      LIMIT 1
    `).bind(userId).first();
  const existingDummyPlain = String(existingDummyRow?.dummy_login_code_plain || '');
  const existingDummyHash = String(existingDummyRow?.dummy_login_code_hash || '');
  const hasExistingDummyCode = existingDummyPlain.length > 0 || (existingDummyHash.length > 0 && !/^[0-9a-f]{64}$/i.test(existingDummyHash));

  if(!hasExistingDummyCode) {
    if(!isValidUsername(requestedDummyName)) {
      return json({ ok: false, code: 'DUMMY_NAME_REQUIRED', message: 'Dummy name must be 1-15 UTF-8 bytes and cannot start with /' }, 400);
    }
    if(await isNameTaken(env, requestedDummyName, userId)) {
      return json({ ok: false, message: 'Name already exists' }, 409);
    }
  }

  for(let attempt = 0; attempt < 5; attempt += 1) {
    const dummyData = await allocateDummyGameCode(env);

    try {
      let updated;
      if(!hasExistingDummyCode && requestedDummyName && hasDummyName && hasDummyNameLower) {
        // First-time dummy name setup should not consume name-change cooldown.
        const nextAllowedAt = null;
        updated = supportsDummyPlain
          ? await env.DB.prepare(`
            UPDATE users
            SET dummy_login_code_hash = ?, dummy_login_code_plain = ?, dummy_login_code_rotated_at = ?, dummy_name = ?, dummy_name_lower = ?, dummy_name_change_available_at = ?
            WHERE id = ?
          `).bind(dummyData.code, dummyData.code, nowIso(), requestedDummyName, lower(requestedDummyName), nextAllowedAt, userId).run()
          : await env.DB.prepare(`
            UPDATE users
            SET dummy_login_code_hash = ?, dummy_login_code_rotated_at = ?, dummy_name = ?, dummy_name_lower = ?, dummy_name_change_available_at = ?
            WHERE id = ?
          `).bind(dummyData.code, nowIso(), requestedDummyName, lower(requestedDummyName), nextAllowedAt, userId).run();
      } else {
        updated = supportsDummyPlain
          ? await env.DB.prepare(`
            UPDATE users
            SET dummy_login_code_hash = ?, dummy_login_code_plain = ?, dummy_login_code_rotated_at = ?
            WHERE id = ?
          `).bind(dummyData.code, dummyData.code, nowIso(), userId).run()
          : await env.DB.prepare(`
            UPDATE users
            SET dummy_login_code_hash = ?, dummy_login_code_rotated_at = ?
            WHERE id = ?
          `).bind(dummyData.code, nowIso(), userId).run();
      }

      if((updated.meta?.changes || 0) !== 1) {
        return json({ ok: false, message: 'Could not rotate dummy code' }, 500);
      }

      return json({ ok: true, code: dummyData.code, message: 'Dummy login code rotated' });
    } catch(err) {
      const message = String(err && err.message ? err.message : err);
      if(message.includes('UNIQUE') && attempt < 4) {
        continue;
      }
      console.error('rotate dummy failed', err);
      return json({ ok: false, message: 'Could not rotate dummy code' }, 500);
    }
  }

  return json({ ok: false, message: 'Could not rotate dummy code' }, 500);
}

async function handleGetCurrentDummyCode(context) {
  const { env } = context;
  const result = await currentUser(context);
  if(result.error) {
    return result.error;
  }

  const hasDummyHash = await hasUsersColumn(env, 'dummy_login_code_hash');
  if(!hasDummyHash) {
    return json({ ok: false, message: 'Dummy code columns are missing. Run migrations first.' }, 500);
  }

  const supportsDummyPlain = await hasUsersColumn(env, 'dummy_login_code_plain');
  const hasDummyName = await hasUsersColumn(env, 'dummy_name');
  const row = supportsDummyPlain
    ? await env.DB.prepare(`
      SELECT dummy_login_code_plain, dummy_login_code_hash, ${hasDummyName ? 'dummy_name' : 'NULL AS dummy_name'}
      FROM users
      WHERE id = ?
      LIMIT 1
    `).bind(result.user.id).first()
    : await env.DB.prepare(`
      SELECT dummy_login_code_hash, ${hasDummyName ? 'dummy_name' : 'NULL AS dummy_name'}
      FROM users
      WHERE id = ?
      LIMIT 1
    `).bind(result.user.id).first();

  const plain = String(row?.dummy_login_code_plain || '');
  const fallback = String(row?.dummy_login_code_hash || '');
  const isLegacyHash = /^[0-9a-f]{64}$/i.test(fallback);
  const code = plain || (isLegacyHash ? '' : fallback);
  return json({ ok: true, code, hasCode: code.length > 0, dummyName: String(row?.dummy_name || '') });
}

async function handleUpdateDummyName(context) {
  const { request, env } = context;
  const result = await currentUser(context);
  if(result.error) {
    return result.error;
  }
  if(!isEmailVerified(result.user)) {
    return emailVerificationRequiredResponse();
  }

  const hasDummyName = await hasUsersColumn(env, 'dummy_name');
  const hasDummyNameLower = await hasUsersColumn(env, 'dummy_name_lower');
  const hasDummyNameChangeCooldown = await hasUsersColumn(env, 'dummy_name_change_available_at');
  if(!hasDummyName || !hasDummyNameLower || !hasDummyNameChangeCooldown) {
    return json({ ok: false, message: 'Dummy name columns are missing. Run migrations first.' }, 500);
  }
  const hasDummyHash = await hasUsersColumn(env, 'dummy_login_code_hash');
  if(!hasDummyHash) {
    return json({ ok: false, message: 'Dummy code columns are missing. Run migrations first.' }, 500);
  }

  const body = await parseRequestBody(request);
  const data = typeof body === 'string' ? {} : (body || {});
  const nextName = String(data.name || data.dummyName || '').trim();
  if(!isValidUsername(nextName)) {
    return json({ ok: false, message: 'Dummy name must be 1-15 UTF-8 bytes and cannot start with /' }, 400);
  }
  if(await isNameTaken(env, nextName, result.user.id)) {
    return json({ ok: false, message: 'Name already exists' }, 409);
  }

  const supportsDummyPlain = await hasUsersColumn(env, 'dummy_login_code_plain');
  const row = supportsDummyPlain
    ? await env.DB.prepare(`
      SELECT dummy_login_code_plain, dummy_login_code_hash, dummy_name_change_available_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `).bind(result.user.id).first()
    : await env.DB.prepare(`
      SELECT dummy_login_code_hash, dummy_name_change_available_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `).bind(result.user.id).first();
  const plain = String(row?.dummy_login_code_plain || '');
  const fallback = String(row?.dummy_login_code_hash || '');
  const isLegacyHash = /^[0-9a-f]{64}$/i.test(fallback);
  const hasCode = plain.length > 0 || (fallback.length > 0 && !isLegacyHash);
  if(!hasCode) {
    return json({ ok: false, code: 'DUMMY_CODE_REQUIRED', message: 'Issue a dummy code first.' }, 400);
  }

  const nextAllowedRaw = String(row?.dummy_name_change_available_at || '');
  const nextAllowedMs = nextAllowedRaw ? Date.parse(nextAllowedRaw) : NaN;
  if(Number.isFinite(nextAllowedMs) && nextAllowedMs > Date.now()) {
    const remainingDays = Math.max(1, Math.floor((nextAllowedMs - Date.now()) / (24 * 60 * 60 * 1000)));
    return json({
      ok: false,
      code: 'DUMMY_NAME_CHANGE_COOLDOWN',
      message: `You can change your dummy name again in ${remainingDays} day(s).`,
      nextAllowedAt: new Date(nextAllowedMs).toISOString(),
      remainingDays,
    }, 429);
  }

  const nextAllowedAt = new Date(Date.now() + NAME_CHANGE_COOLDOWN_MS).toISOString();

  const updated = await env.DB.prepare(`
    UPDATE users
    SET dummy_name = ?, dummy_name_lower = ?, dummy_name_change_available_at = ?
    WHERE id = ?
  `).bind(nextName, lower(nextName), nextAllowedAt, result.user.id).run();
  if((updated.meta?.changes || 0) !== 1) {
    return json({ ok: false, message: 'Could not update dummy name' }, 500);
  }
  const user = await publicUserById(env, result.user.id);
  return json({ ok: true, user, message: 'Dummy name updated' });
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

  const hasDummyHash = await hasUsersColumn(env, 'dummy_login_code_hash');
  const hasDummyPlain = hasDummyHash && await hasUsersColumn(env, 'dummy_login_code_plain');

  let matchedDummyCode = false;

  let user = await env.DB.prepare(`
    SELECT id, username, dummy_name, email_verified, ban_is_permanent, ban_until, ban_reason
    FROM users
    WHERE game_login_code_hash = ?
    LIMIT 1
  `).bind(code).first();

  if(!user && hasDummyHash) {
    user = hasDummyPlain
      ? await env.DB.prepare(`
        SELECT id, username, dummy_name, email_verified, ban_is_permanent, ban_until, ban_reason
        FROM users
        WHERE dummy_login_code_hash = ? OR dummy_login_code_plain = ?
        LIMIT 1
      `).bind(code, code).first()
      : await env.DB.prepare(`
        SELECT id, username, dummy_name, email_verified, ban_is_permanent, ban_until, ban_reason
        FROM users
        WHERE dummy_login_code_hash = ?
        LIMIT 1
      `).bind(code).first();
    if(user) {
      matchedDummyCode = true;
    }
  }

  if(!user && env.CODE_PEPPER) {
    const hash = await sha256Hex(`${env.CODE_PEPPER}:${code}`);
    user = await env.DB.prepare(`
      SELECT id, username, dummy_name, email_verified, ban_is_permanent, ban_until, ban_reason
      FROM users
      WHERE game_login_code_hash = ?
      LIMIT 1
    `).bind(hash).first();
    if(!user && hasDummyHash) {
      user = await env.DB.prepare(`
        SELECT id, username, dummy_name, email_verified, ban_is_permanent, ban_until, ban_reason
        FROM users
        WHERE dummy_login_code_hash = ?
        LIMIT 1
      `).bind(hash).first();
      if(user) {
        matchedDummyCode = true;
      }
    }
  }

  if(!user) {
    return json({ ok: false, message: 'Code not found' });
  }
  if(Number(user.email_verified || 0) !== 1) {
    return json({ ok: false, code: 'ACCOUNT_UNVERIFIED', message: 'Account email is not verified.' });
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
      dummyCode: matchedDummyCode,
    });
  }

  return json({
    ok: true,
    accountId: user.id,
    name: matchedDummyCode && String(user.dummy_name || '').trim() ? String(user.dummy_name).trim() : user.username,
    username: matchedDummyCode && String(user.dummy_name || '').trim() ? String(user.dummy_name).trim() : user.username,
    dummyCode: matchedDummyCode,
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

async function handleAdminBan(context) {
  const { request, env } = context;
  const auth = await requireAdmin(context);
  if(auth.error) {
    return auth.error;
  }

  const body = await parseRequestBody(request);
  const data = typeof body === 'string' ? {} : (body || {});
  const accountId = Number(data.accountId || 0);
  const minutesRaw = Number(data.minutes ?? 0);
  const reason = String(data.reason || '').trim();

  if(!Number.isFinite(accountId) || accountId <= 0) {
    return json({ ok: false, message: 'Invalid account id' }, 400);
  }

  const permanent = minutesRaw <= 0;
  const minutes = Math.max(1, Math.floor(minutesRaw));
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

async function handleAdminUnban(context) {
  const { request, env } = context;
  const auth = await requireAdmin(context);
  if(auth.error) {
    return auth.error;
  }

  const body = await parseRequestBody(request);
  const data = typeof body === 'string' ? {} : (body || {});
  const accountId = Number(data.accountId || 0);
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

async function handleAdminUsers(context) {
  const { request, env } = context;
  const auth = await requireAdmin(context);
  if(auth.error) {
    return auth.error;
  }

  const url = new URL(request.url);
  const q = String(url.searchParams.get('q') || '').trim();
  const like = `%${q}%`;
  const hasDummyName = await hasUsersColumn(env, 'dummy_name');

  const rows = q
    ? await env.DB.prepare(`
      SELECT
        id,
        username,
        ${hasDummyName ? 'dummy_name' : 'NULL AS dummy_name'},
        ban_is_permanent,
        ban_until
      FROM users
      WHERE username LIKE ?
      ${hasDummyName ? 'OR dummy_name LIKE ?' : ''}
      ORDER BY id ASC
      LIMIT 200
    `).bind(...(hasDummyName ? [like, like] : [like])).all()
    : await env.DB.prepare(`
      SELECT
        id,
        username,
        ${hasDummyName ? 'dummy_name' : 'NULL AS dummy_name'},
        ban_is_permanent,
        ban_until
      FROM users
      ORDER BY id ASC
      LIMIT 200
    `).all();

  return json({ ok: true, users: rows?.results || [] });
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
  if(request.method === 'POST' && path === '/auth/email/resend') {
    return handleEmailResend(context);
  }
  if(request.method === 'POST' && path === '/auth/email/verify') {
    return handleEmailVerify(context);
  }
  if(request.method === 'POST' && path === '/auth/password/request') {
    return handlePasswordResetRequest(context);
  }
  if(request.method === 'POST' && path === '/auth/password/check') {
    return handlePasswordResetCheck(context);
  }
  if(request.method === 'POST' && path === '/auth/password/reset') {
    return handlePasswordResetConfirm(context);
  }

  if(request.method === 'GET' && path === '/me') {
    return handleMe(context);
  }

  if(request.method === 'POST' && path === '/profile/name') {
    return handleUpdateProfileName(context);
  }
  if(request.method === 'POST' && path === '/profile/dummy-name') {
    return handleUpdateDummyName(context);
  }

  if(request.method === 'POST' && path === '/game-code/rotate') {
    return handleRotateGameCode(context);
  }

  if(request.method === 'GET' && path === '/game-code/current') {
    return handleGetCurrentGameCode(context);
  }

  if(request.method === 'POST' && path === '/game-code/dummy/rotate') {
    return handleRotateDummyGameCode(context);
  }

  if(request.method === 'GET' && path === '/game-code/dummy/current') {
    return handleGetCurrentDummyCode(context);
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

  if(request.method === 'POST' && path === '/admin/ban') {
    return handleAdminBan(context);
  }

  if(request.method === 'POST' && path === '/admin/unban') {
    return handleAdminUnban(context);
  }

  if(request.method === 'GET' && path === '/admin/users') {
    return handleAdminUsers(context);
  }

  return json({ ok: false, message: 'API route not found' }, 404);
}
