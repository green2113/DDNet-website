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
import { hmacMd5Hex } from '../_lib/patreon.js';

const AUTH_COOKIE = 'ddnet_auth';
const SESSION_MAX_AGE_DEFAULT = 30 * 24 * 60 * 60;
const SESSION_MAX_AGE_MIN = 5 * 60;
const SESSION_MAX_AGE_MAX = 90 * 24 * 60 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;
const NAME_CHANGE_COOLDOWN_DAYS_DEFAULT = 10;
const NAME_CHANGE_COOLDOWN_DAYS_STARTER = 3;
const NAME_CHANGE_COOLDOWN_DAYS_PLUS = 1;
const NAME_CHANGE_COOLDOWN_MS_DEFAULT = NAME_CHANGE_COOLDOWN_DAYS_DEFAULT * DAY_MS;
const INVITE_QUOTA_STARTER = 10;
const INVITE_QUOTA_PLUS = 20;
const EMAIL_VERIFY_CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_VERIFY_RESEND_COOLDOWN_MS = 60 * 1000;
const PASSWORD_RESET_CODE_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_RESEND_COOLDOWN_MS = 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_BLOCK_MS = 10 * 60 * 1000;
const RESET_VERIFY_MAX_ATTEMPTS = 5;
const RESET_VERIFY_WINDOW_MS = 10 * 60 * 1000;
const RESET_VERIFY_BLOCK_MS = 10 * 60 * 1000;
const TRUE_VALUES = ['1', 'true', 'yes', 'on'];
const PASSWORD_RESET_GENERIC_REQUEST_MESSAGE = 'If the account exists, a reset code was sent.';
const PASSWORD_RESET_GENERIC_VERIFY_MESSAGE = 'Invalid email or reset code';
const PATREON_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const PATREON_TOKEN_REFRESH_SKEW_MS = 30 * 1000;
const PATREON_SYNC_STALE_DEFAULT_SECONDS = 6 * 60 * 60;
const TRAIL_MODE_MIN = 1;
const TRAIL_MODE_MAX = 3;

let s_TrailSettingsReady = false;

function cookieSecure(request) {
  return new URL(request.url).protocol === 'https:';
}

function getSessionMaxAgeSeconds(env) {
  const raw = Number(env.SESSION_MAX_AGE_SECONDS || SESSION_MAX_AGE_DEFAULT);
  if(!Number.isFinite(raw)) {
    return SESSION_MAX_AGE_DEFAULT;
  }
  return Math.max(SESSION_MAX_AGE_MIN, Math.min(SESSION_MAX_AGE_MAX, Math.floor(raw)));
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

function normalizeUiLanguage(input) {
  const value = String(input || '').trim().toLowerCase();
  if(!value) return '';
  if(value === 'zh-tw' || value === 'zhtw' || value === 'zh_hant') return 'zh-TW';
  if(value === 'zh-cn' || value === 'zhcn' || value === 'zh_hans') return 'zh-CN';
  if(value === 'ko' || value === 'ko-kr') return 'ko';
  if(value === 'ja' || value === 'ja-jp') return 'ja';
  return 'en';
}

function parseLanguageFromAcceptHeader(header) {
  const raw = String(header || '').toLowerCase();
  if(raw.includes('zh-tw') || raw.includes('zh-hk') || raw.includes('zh-hant')) return 'zh-TW';
  if(raw.includes('zh-cn') || raw.includes('zh-sg') || raw.includes('zh-hans')) return 'zh-CN';
  if(raw.includes('ko')) return 'ko';
  if(raw.includes('ja')) return 'ja';
  return 'en';
}

function formatUtcTimestamp(isoLike) {
  const date = new Date(isoLike || Date.now());
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`;
}

function passwordChangedEmailContent({ language, email, changedAtUtc }) {
  switch(language) {
  case 'ko':
    return {
      subject: '[Ravion] 비밀번호 변경 안내',
      text:
`안녕하세요.

이메일(${email})과 연결된 Ravion 계정의 비밀번호가 ${changedAtUtc} 에 변경되었습니다.

본인이 변경한 것이 아니라면 즉시 Discord(https://discord.gg/NNtuG9es32)로 문의해 주세요.`,
    };
  case 'zh-TW':
    return {
      subject: '[Ravion] 密碼變更通知',
      text:
`您好，

與此電子郵件（${email}）綁定的 Ravion 帳號密碼已於 ${changedAtUtc} 變更。

若這不是您本人操作，請立即前往 Discord（https://discord.gg/NNtuG9es32）與我們聯繫。`,
    };
  case 'zh-CN':
    return {
      subject: '[Ravion] 密码变更通知',
      text:
`您好，

与此邮箱（${email}）绑定的 Ravion 账号密码已于 ${changedAtUtc} 变更。

如果这不是您本人操作，请立即前往 Discord（https://discord.gg/NNtuG9es32）联系我们。`,
    };
  case 'ja':
    return {
      subject: '[Ravion] パスワード変更のお知らせ',
      text:
`こんにちは。

このメールアドレス（${email}）に紐づく Ravion アカウントのパスワードが ${changedAtUtc} に変更されました。

心当たりがない場合は、すぐに Discord（https://discord.gg/NNtuG9es32）までご連絡ください。`,
    };
  default:
    return {
      subject: '[Ravion] Password changed',
      text:
`Hello,

The password for your Ravion account linked to this email (${email}) was changed at ${changedAtUtc}.

If this was not you, please contact us immediately on Discord: https://discord.gg/NNtuG9es32`,
    };
  }
}

async function sendPasswordChangedEmail(env, email, language, changedAtIso) {
  const apiKey = String(env.RESEND_API_KEY || '').trim();
  const from = String(env.EMAIL_FROM || 'noreply@playravion.com').trim();
  if(!apiKey || !from) {
    throw new Error('Missing RESEND_API_KEY or EMAIL_FROM');
  }
  const fromWithName = from.includes('<') ? from : `Ravion <${from}>`;
  const changedAtUtc = formatUtcTimestamp(changedAtIso);
  const content = passwordChangedEmailContent({
    language: normalizeUiLanguage(language),
    email,
    changedAtUtc,
  });

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: fromWithName,
      to: [email],
      subject: content.subject,
      text: content.text,
      html: content.text.replace(/\n/g, '<br/>'),
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

async function ensureAuthRateLimitTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS auth_rate_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scope TEXT NOT NULL,
      subject TEXT NOT NULL,
      fail_count INTEGER NOT NULL DEFAULT 0,
      window_start TEXT NOT NULL,
      blocked_until TEXT DEFAULT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(scope, subject)
    )
  `).run();
  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_scope_subject
    ON auth_rate_limits(scope, subject)
  `).run();
}

function rateLimitWaitSeconds(blockedUntilRaw) {
  const blockedUntilMs = Date.parse(String(blockedUntilRaw || ''));
  if(!Number.isFinite(blockedUntilMs) || blockedUntilMs <= Date.now()) {
    return 0;
  }
  return Math.max(1, Math.ceil((blockedUntilMs - Date.now()) / 1000));
}

async function getRateLimitStatus(env, scope, subject, windowMs) {
  await ensureAuthRateLimitTable(env);
  const row = await env.DB.prepare(`
    SELECT fail_count, window_start, blocked_until
    FROM auth_rate_limits
    WHERE scope = ? AND subject = ?
    LIMIT 1
  `).bind(scope, subject).first();

  if(!row) {
    return { blocked: false, waitSeconds: 0 };
  }

  const waitSeconds = rateLimitWaitSeconds(row.blocked_until);
  if(waitSeconds > 0) {
    return { blocked: true, waitSeconds };
  }

  const windowStartMs = Date.parse(String(row.window_start || ''));
  if(!Number.isFinite(windowStartMs) || (Date.now() - windowStartMs) > windowMs) {
    await env.DB.prepare(`
      DELETE FROM auth_rate_limits
      WHERE scope = ? AND subject = ?
    `).bind(scope, subject).run();
    return { blocked: false, waitSeconds: 0 };
  }

  return { blocked: false, waitSeconds: 0 };
}

async function registerRateLimitFailure(env, scope, subject, maxAttempts, windowMs, blockMs) {
  await ensureAuthRateLimitTable(env);

  const row = await env.DB.prepare(`
    SELECT fail_count, window_start, blocked_until
    FROM auth_rate_limits
    WHERE scope = ? AND subject = ?
    LIMIT 1
  `).bind(scope, subject).first();

  const now = Date.now();
  const nowText = nowIso();
  const blockedWaitSeconds = rateLimitWaitSeconds(row?.blocked_until || '');
  if(row && blockedWaitSeconds > 0) {
    return { blocked: true, waitSeconds: blockedWaitSeconds };
  }

  const windowStartMs = Date.parse(String(row?.window_start || ''));
  const inWindow = Number.isFinite(windowStartMs) && (now - windowStartMs) <= windowMs;
  const nextFailCount = row && inWindow ? Number(row.fail_count || 0) + 1 : 1;

  const shouldBlock = nextFailCount >= maxAttempts;
  const blockedUntil = shouldBlock ? new Date(now + blockMs).toISOString() : null;

  await env.DB.prepare(`
    INSERT INTO auth_rate_limits (
      scope, subject, fail_count, window_start, blocked_until, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(scope, subject) DO UPDATE SET
      fail_count = excluded.fail_count,
      window_start = excluded.window_start,
      blocked_until = excluded.blocked_until,
      updated_at = excluded.updated_at
  `).bind(
    scope,
    subject,
    nextFailCount,
    inWindow ? String(row.window_start || nowText) : nowText,
    blockedUntil,
    nowText,
  ).run();

  if(!shouldBlock) {
    return { blocked: false, waitSeconds: 0 };
  }
  return { blocked: true, waitSeconds: Math.max(1, Math.ceil(blockMs / 1000)) };
}

async function clearRateLimitState(env, scope, subject) {
  await ensureAuthRateLimitTable(env);
  await env.DB.prepare(`
    DELETE FROM auth_rate_limits
    WHERE scope = ? AND subject = ?
  `).bind(scope, subject).run();
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

async function ensureUsersSessionVersionColumn(env) {
  if(await hasUsersColumn(env, 'session_version')) {
    return true;
  }
  try {
    await env.DB.prepare(`
      ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0
    `).run();
  } catch(err) {
    const message = String(err?.message || err);
    if(!message.toLowerCase().includes('duplicate column')) {
      throw err;
    }
  }
  return await hasUsersColumn(env, 'session_version');
}

async function ensureUsersInviteQuotaBaseColumn(env) {
  if(!(await hasUsersColumn(env, 'invite_quota_base'))) {
    try {
      await env.DB.prepare(`
        ALTER TABLE users ADD COLUMN invite_quota_base INTEGER
      `).run();
    } catch(err) {
      const message = String(err?.message || err).toLowerCase();
      if(!message.includes('duplicate column')) {
        throw err;
      }
    }
  }

  const hasColumn = await hasUsersColumn(env, 'invite_quota_base');
  if(!hasColumn) {
    return false;
  }

  await env.DB.prepare(`
    UPDATE users
    SET invite_quota_base = invite_quota
    WHERE invite_quota_base IS NULL
  `).run();

  return true;
}

async function getUserSessionVersion(env, userId) {
  const hasSessionVersion = await ensureUsersSessionVersionColumn(env);
  if(!hasSessionVersion) {
    return 0;
  }
  const row = await env.DB.prepare(`
    SELECT session_version
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(userId).first();
  const version = Number(row?.session_version || 0);
  if(!Number.isFinite(version)) {
    return 0;
  }
  return Math.max(0, Math.floor(version));
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
      ban_reason,
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

  const tokenVersion = Number.isFinite(Number(payload.ver)) ? Number(payload.ver) : 0;
  const userSessionVersion = await getUserSessionVersion(env, payload.uid);
  if(tokenVersion !== userSessionVersion) {
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
  const hasInviteQuotaBase = await ensureUsersInviteQuotaBaseColumn(env);
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
            ${hasInviteQuotaBase ? 'invite_quota_base,' : ''}
            invite_used,
            inviter_id,
            country_signup,
            game_login_code_hash,
            game_login_code_plain,
            game_login_code_rotated_at,
            created_at
          ) VALUES (?, ?, ?, ?, ?, 0, NULL, NULL, NULL, NULL, ?, ?, ${hasInviteQuotaBase ? '?, ' : ''}0, ?, ?, ?, ?, ?, ?)
        `).bind(
          username,
          lower(username),
          email,
          email,
          passwordHash,
          inviteCode,
          inviteQuota,
          ...(hasInviteQuotaBase ? [inviteQuota] : []),
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
            ${hasInviteQuotaBase ? 'invite_quota_base,' : ''}
            invite_used,
            inviter_id,
            country_signup,
            game_login_code_hash,
            game_login_code_rotated_at,
            created_at
          ) VALUES (?, ?, ?, ?, ?, 0, NULL, NULL, NULL, NULL, ?, ?, ${hasInviteQuotaBase ? '?, ' : ''}0, ?, ?, ?, ?, ?)
        `).bind(
          username,
          lower(username),
          email,
          email,
          passwordHash,
          inviteCode,
          inviteQuota,
          ...(hasInviteQuotaBase ? [inviteQuota] : []),
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

  const sessionMaxAge = getSessionMaxAgeSeconds(env);
  const sessionVersion = await getUserSessionVersion(env, userId);
  const token = await signSessionToken(userId, env.SESSION_SECRET, sessionMaxAge, sessionVersion);
  const setCookie = buildSetCookie(AUTH_COOKIE, token, {
    maxAge: sessionMaxAge,
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
  const ip = getClientIp(request);

  if(!email || !password) {
    return json({ ok: false, message: 'email and password are required' }, 400);
  }

  if(!isValidEmail(email)) {
    return json({ ok: false, message: 'Invalid email format' }, 400);
  }

  const blockedByEmail = await getRateLimitStatus(env, 'login_email', email, LOGIN_WINDOW_MS);
  const blockedByIp = await getRateLimitStatus(env, 'login_ip', ip, LOGIN_WINDOW_MS);
  if(blockedByEmail.blocked || blockedByIp.blocked) {
    const waitSeconds = Math.max(blockedByEmail.waitSeconds, blockedByIp.waitSeconds);
    return json({
      ok: false,
      code: 'LOGIN_RATE_LIMITED',
      message: `Too many login attempts. Please try again later.`,
      waitSeconds,
    }, 429);
  }

  const row = await env.DB.prepare(`
    SELECT id, email, password_hash, email_verified
    FROM users
    WHERE email_lower = ?
    LIMIT 1
  `).bind(email).first();

  if(!row) {
    const emailFail = await registerRateLimitFailure(env, 'login_email', email, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS, LOGIN_BLOCK_MS);
    const ipFail = await registerRateLimitFailure(env, 'login_ip', ip, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS, LOGIN_BLOCK_MS);
    if(emailFail.blocked || ipFail.blocked) {
      const waitSeconds = Math.max(emailFail.waitSeconds, ipFail.waitSeconds);
      return json({
        ok: false,
        code: 'LOGIN_RATE_LIMITED',
        message: `Too many login attempts. Please try again later.`,
        waitSeconds,
      }, 429);
    }
    return json({ ok: false, message: 'Invalid credentials' }, 401);
  }

  const ok = await verifyPassword(password, row.password_hash);
  if(!ok) {
    const emailFail = await registerRateLimitFailure(env, 'login_email', email, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS, LOGIN_BLOCK_MS);
    const ipFail = await registerRateLimitFailure(env, 'login_ip', ip, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS, LOGIN_BLOCK_MS);
    if(emailFail.blocked || ipFail.blocked) {
      const waitSeconds = Math.max(emailFail.waitSeconds, ipFail.waitSeconds);
      return json({
        ok: false,
        code: 'LOGIN_RATE_LIMITED',
        message: `Too many login attempts. Please try again later.`,
        waitSeconds,
      }, 429);
    }
    return json({ ok: false, message: 'Invalid credentials' }, 401);
  }

  await clearRateLimitState(env, 'login_email', email);
  await clearRateLimitState(env, 'login_ip', ip);

  const sessionMaxAge = getSessionMaxAgeSeconds(env);
  const sessionVersion = await getUserSessionVersion(env, row.id);
  const token = await signSessionToken(row.id, env.SESSION_SECRET, sessionMaxAge, sessionVersion);
  const setCookie = buildSetCookie(AUTH_COOKIE, token, {
    maxAge: sessionMaxAge,
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

  let issued;
  try {
    issued = await issueEmailVerificationCode(env, result.user.id, String(result.user.email || ''), { bypassCooldown: false });
  } catch(err) {
    const message = String(err?.message || 'Verification email send failed');
    console.error('email resend failed', message);
    return json({
      ok: false,
      code: 'EMAIL_SEND_FAILED',
      message,
    }, 502);
  }
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
    return json({ ok: true, message: PASSWORD_RESET_GENERIC_REQUEST_MESSAGE });
  }

  if(Number(user.email_verified || 0) !== 1) {
    return json({
      ok: true,
      sent: false,
      code: 'PASSWORD_RESET_EMAIL_UNVERIFIED',
      message: 'Email is not verified',
    });
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
    // Silent success to avoid account-state enumeration.
    return json({ ok: true, sent: true, message: PASSWORD_RESET_GENERIC_REQUEST_MESSAGE });
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

  return json({ ok: true, sent: true, message: PASSWORD_RESET_GENERIC_REQUEST_MESSAGE, expiresAt });
}

async function handlePasswordResetConfirm(context) {
  const { request, env } = context;
  const body = await parseRequestBody(request);
  const data = typeof body === 'string' ? {} : (body || {});
  const email = lower(data.email || '');
  const code = String(data.code || '').trim();
  const newPassword = String(data.newPassword || data.password || '');
  const requestedLanguage = normalizeUiLanguage(data.language || data.lang || '');
  const acceptLanguage = parseLanguageFromAcceptHeader(request.headers.get('accept-language'));
  const emailLanguage = requestedLanguage || acceptLanguage || 'en';
  const ip = getClientIp(request);

  if(!email || !isValidEmail(email)) {
    return json({ ok: false, message: 'Invalid email format' }, 400);
  }
  if(!/^\d{6}$/.test(code)) {
    return json({ ok: false, message: 'Verification code must be 6 digits' }, 400);
  }
  if(!isValidPassword(newPassword)) {
    return json({ ok: false, message: 'Password must be at least 8 characters' }, 400);
  }

  const blockedByEmail = await getRateLimitStatus(env, 'reset_verify_email', email, RESET_VERIFY_WINDOW_MS);
  const blockedByIp = await getRateLimitStatus(env, 'reset_verify_ip', ip, RESET_VERIFY_WINDOW_MS);
  if(blockedByEmail.blocked || blockedByIp.blocked) {
    const waitSeconds = Math.max(blockedByEmail.waitSeconds, blockedByIp.waitSeconds);
    return json({
      ok: false,
      code: 'PASSWORD_RESET_RATE_LIMITED',
      message: `Too many reset-code attempts. Please try again later.`,
      waitSeconds,
    }, 429);
  }

  const user = await env.DB.prepare(`
    SELECT id, email_verified
    FROM users
    WHERE email_lower = ?
    LIMIT 1
  `).bind(email).first();
  if(!user) {
    const emailFail = await registerRateLimitFailure(env, 'reset_verify_email', email, RESET_VERIFY_MAX_ATTEMPTS, RESET_VERIFY_WINDOW_MS, RESET_VERIFY_BLOCK_MS);
    const ipFail = await registerRateLimitFailure(env, 'reset_verify_ip', ip, RESET_VERIFY_MAX_ATTEMPTS, RESET_VERIFY_WINDOW_MS, RESET_VERIFY_BLOCK_MS);
    if(emailFail.blocked || ipFail.blocked) {
      const waitSeconds = Math.max(emailFail.waitSeconds, ipFail.waitSeconds);
      return json({
        ok: false,
        code: 'PASSWORD_RESET_RATE_LIMITED',
        message: `Too many reset-code attempts. Please try again later.`,
        waitSeconds,
      }, 429);
    }
    return json({ ok: false, message: PASSWORD_RESET_GENERIC_VERIFY_MESSAGE }, 400);
  }
  if(Number(user.email_verified || 0) !== 1) {
    const emailFail = await registerRateLimitFailure(env, 'reset_verify_email', email, RESET_VERIFY_MAX_ATTEMPTS, RESET_VERIFY_WINDOW_MS, RESET_VERIFY_BLOCK_MS);
    const ipFail = await registerRateLimitFailure(env, 'reset_verify_ip', ip, RESET_VERIFY_MAX_ATTEMPTS, RESET_VERIFY_WINDOW_MS, RESET_VERIFY_BLOCK_MS);
    if(emailFail.blocked || ipFail.blocked) {
      const waitSeconds = Math.max(emailFail.waitSeconds, ipFail.waitSeconds);
      return json({
        ok: false,
        code: 'PASSWORD_RESET_RATE_LIMITED',
        message: `Too many reset-code attempts. Please try again later.`,
        waitSeconds,
      }, 429);
    }
    return json({ ok: false, message: PASSWORD_RESET_GENERIC_VERIFY_MESSAGE }, 400);
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
    const emailFail = await registerRateLimitFailure(env, 'reset_verify_email', email, RESET_VERIFY_MAX_ATTEMPTS, RESET_VERIFY_WINDOW_MS, RESET_VERIFY_BLOCK_MS);
    const ipFail = await registerRateLimitFailure(env, 'reset_verify_ip', ip, RESET_VERIFY_MAX_ATTEMPTS, RESET_VERIFY_WINDOW_MS, RESET_VERIFY_BLOCK_MS);
    if(emailFail.blocked || ipFail.blocked) {
      const waitSeconds = Math.max(emailFail.waitSeconds, ipFail.waitSeconds);
      return json({
        ok: false,
        code: 'PASSWORD_RESET_RATE_LIMITED',
        message: `Too many reset-code attempts. Please try again later.`,
        waitSeconds,
      }, 429);
    }
    return json({ ok: false, message: PASSWORD_RESET_GENERIC_VERIFY_MESSAGE }, 400);
  }

  const expiresAtMs = Date.parse(expiresAtRaw);
  if(!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    const emailFail = await registerRateLimitFailure(env, 'reset_verify_email', email, RESET_VERIFY_MAX_ATTEMPTS, RESET_VERIFY_WINDOW_MS, RESET_VERIFY_BLOCK_MS);
    const ipFail = await registerRateLimitFailure(env, 'reset_verify_ip', ip, RESET_VERIFY_MAX_ATTEMPTS, RESET_VERIFY_WINDOW_MS, RESET_VERIFY_BLOCK_MS);
    if(emailFail.blocked || ipFail.blocked) {
      const waitSeconds = Math.max(emailFail.waitSeconds, ipFail.waitSeconds);
      return json({
        ok: false,
        code: 'PASSWORD_RESET_RATE_LIMITED',
        message: `Too many reset-code attempts. Please try again later.`,
        waitSeconds,
      }, 429);
    }
    return json({ ok: false, message: PASSWORD_RESET_GENERIC_VERIFY_MESSAGE }, 400);
  }

  const expected = await passwordResetCodeHash(env, user.id, code);
  if(!timingSafeEqual(expected, hash)) {
    const emailFail = await registerRateLimitFailure(env, 'reset_verify_email', email, RESET_VERIFY_MAX_ATTEMPTS, RESET_VERIFY_WINDOW_MS, RESET_VERIFY_BLOCK_MS);
    const ipFail = await registerRateLimitFailure(env, 'reset_verify_ip', ip, RESET_VERIFY_MAX_ATTEMPTS, RESET_VERIFY_WINDOW_MS, RESET_VERIFY_BLOCK_MS);
    if(emailFail.blocked || ipFail.blocked) {
      const waitSeconds = Math.max(emailFail.waitSeconds, ipFail.waitSeconds);
      return json({
        ok: false,
        code: 'PASSWORD_RESET_RATE_LIMITED',
        message: `Too many reset-code attempts. Please try again later.`,
        waitSeconds,
      }, 429);
    }
    return json({ ok: false, message: PASSWORD_RESET_GENERIC_VERIFY_MESSAGE }, 400);
  }

  const passwordHash = await hashPassword(newPassword);
  const hasSessionVersion = await ensureUsersSessionVersionColumn(env);
  const updatePasswordSql = hasSessionVersion
    ? `UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?`
    : `UPDATE users SET password_hash = ? WHERE id = ?`;
  const changedAtIso = nowIso();
  await env.DB.batch([
    env.DB.prepare(updatePasswordSql).bind(passwordHash, user.id),
    env.DB.prepare(`UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL`).bind(changedAtIso, user.id),
  ]);
  await clearRateLimitState(env, 'reset_verify_email', email);
  await clearRateLimitState(env, 'reset_verify_ip', ip);

  try {
    await sendPasswordChangedEmail(env, email, emailLanguage, changedAtIso);
  } catch(err) {
    console.error('password changed mail failed', err);
  }

  return json({ ok: true, message: 'Password has been reset' });
}

async function handlePasswordResetCheck(context) {
  const { request, env } = context;
  const body = await parseRequestBody(request);
  const data = typeof body === 'string' ? {} : (body || {});
  const email = lower(data.email || '');
  const code = String(data.code || '').trim();
  const ip = getClientIp(request);

  if(!email || !isValidEmail(email)) {
    return json({ ok: false, message: 'Invalid email format' }, 400);
  }
  if(!/^\d{6}$/.test(code)) {
    return json({ ok: false, message: 'Verification code must be 6 digits' }, 400);
  }

  const blockedByEmail = await getRateLimitStatus(env, 'reset_verify_email', email, RESET_VERIFY_WINDOW_MS);
  const blockedByIp = await getRateLimitStatus(env, 'reset_verify_ip', ip, RESET_VERIFY_WINDOW_MS);
  if(blockedByEmail.blocked || blockedByIp.blocked) {
    const waitSeconds = Math.max(blockedByEmail.waitSeconds, blockedByIp.waitSeconds);
    return json({
      ok: false,
      code: 'PASSWORD_RESET_RATE_LIMITED',
      message: `Too many reset-code attempts. Please try again later.`,
      waitSeconds,
    }, 429);
  }

  const user = await env.DB.prepare(`
    SELECT id, email_verified
    FROM users
    WHERE email_lower = ?
    LIMIT 1
  `).bind(email).first();
  if(!user) {
    const emailFail = await registerRateLimitFailure(env, 'reset_verify_email', email, RESET_VERIFY_MAX_ATTEMPTS, RESET_VERIFY_WINDOW_MS, RESET_VERIFY_BLOCK_MS);
    const ipFail = await registerRateLimitFailure(env, 'reset_verify_ip', ip, RESET_VERIFY_MAX_ATTEMPTS, RESET_VERIFY_WINDOW_MS, RESET_VERIFY_BLOCK_MS);
    if(emailFail.blocked || ipFail.blocked) {
      const waitSeconds = Math.max(emailFail.waitSeconds, ipFail.waitSeconds);
      return json({
        ok: false,
        code: 'PASSWORD_RESET_RATE_LIMITED',
        message: `Too many reset-code attempts. Please try again later.`,
        waitSeconds,
      }, 429);
    }
    return json({ ok: false, message: PASSWORD_RESET_GENERIC_VERIFY_MESSAGE }, 400);
  }
  if(Number(user.email_verified || 0) !== 1) {
    const emailFail = await registerRateLimitFailure(env, 'reset_verify_email', email, RESET_VERIFY_MAX_ATTEMPTS, RESET_VERIFY_WINDOW_MS, RESET_VERIFY_BLOCK_MS);
    const ipFail = await registerRateLimitFailure(env, 'reset_verify_ip', ip, RESET_VERIFY_MAX_ATTEMPTS, RESET_VERIFY_WINDOW_MS, RESET_VERIFY_BLOCK_MS);
    if(emailFail.blocked || ipFail.blocked) {
      const waitSeconds = Math.max(emailFail.waitSeconds, ipFail.waitSeconds);
      return json({
        ok: false,
        code: 'PASSWORD_RESET_RATE_LIMITED',
        message: `Too many reset-code attempts. Please try again later.`,
        waitSeconds,
      }, 429);
    }
    return json({ ok: false, message: PASSWORD_RESET_GENERIC_VERIFY_MESSAGE }, 400);
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
    const emailFail = await registerRateLimitFailure(env, 'reset_verify_email', email, RESET_VERIFY_MAX_ATTEMPTS, RESET_VERIFY_WINDOW_MS, RESET_VERIFY_BLOCK_MS);
    const ipFail = await registerRateLimitFailure(env, 'reset_verify_ip', ip, RESET_VERIFY_MAX_ATTEMPTS, RESET_VERIFY_WINDOW_MS, RESET_VERIFY_BLOCK_MS);
    if(emailFail.blocked || ipFail.blocked) {
      const waitSeconds = Math.max(emailFail.waitSeconds, ipFail.waitSeconds);
      return json({
        ok: false,
        code: 'PASSWORD_RESET_RATE_LIMITED',
        message: `Too many reset-code attempts. Please try again later.`,
        waitSeconds,
      }, 429);
    }
    return json({ ok: false, message: PASSWORD_RESET_GENERIC_VERIFY_MESSAGE }, 400);
  }

  const expiresAtMs = Date.parse(expiresAtRaw);
  if(!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    const emailFail = await registerRateLimitFailure(env, 'reset_verify_email', email, RESET_VERIFY_MAX_ATTEMPTS, RESET_VERIFY_WINDOW_MS, RESET_VERIFY_BLOCK_MS);
    const ipFail = await registerRateLimitFailure(env, 'reset_verify_ip', ip, RESET_VERIFY_MAX_ATTEMPTS, RESET_VERIFY_WINDOW_MS, RESET_VERIFY_BLOCK_MS);
    if(emailFail.blocked || ipFail.blocked) {
      const waitSeconds = Math.max(emailFail.waitSeconds, ipFail.waitSeconds);
      return json({
        ok: false,
        code: 'PASSWORD_RESET_RATE_LIMITED',
        message: `Too many reset-code attempts. Please try again later.`,
        waitSeconds,
      }, 429);
    }
    return json({ ok: false, message: PASSWORD_RESET_GENERIC_VERIFY_MESSAGE }, 400);
  }

  const expected = await passwordResetCodeHash(env, user.id, code);
  if(!timingSafeEqual(expected, hash)) {
    const emailFail = await registerRateLimitFailure(env, 'reset_verify_email', email, RESET_VERIFY_MAX_ATTEMPTS, RESET_VERIFY_WINDOW_MS, RESET_VERIFY_BLOCK_MS);
    const ipFail = await registerRateLimitFailure(env, 'reset_verify_ip', ip, RESET_VERIFY_MAX_ATTEMPTS, RESET_VERIFY_WINDOW_MS, RESET_VERIFY_BLOCK_MS);
    if(emailFail.blocked || ipFail.blocked) {
      const waitSeconds = Math.max(emailFail.waitSeconds, ipFail.waitSeconds);
      return json({
        ok: false,
        code: 'PASSWORD_RESET_RATE_LIMITED',
        message: `Too many reset-code attempts. Please try again later.`,
        waitSeconds,
      }, 429);
    }
    return json({ ok: false, message: PASSWORD_RESET_GENERIC_VERIFY_MESSAGE }, 400);
  }

  await clearRateLimitState(env, 'reset_verify_email', email);
  await clearRateLimitState(env, 'reset_verify_ip', ip);

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

  const planFlags = await loadPlanActivityFlags(env, result.user.id);
  const benefitValues = resolvePlanBenefitValues(planFlags);
  const nextAllowedAt = new Date(Date.now() + benefitValues.nameCooldownDays * DAY_MS).toISOString();

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

  const nextAllowedAt = new Date(Date.now() + NAME_CHANGE_COOLDOWN_MS_DEFAULT).toISOString();

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

async function ensureTrailSettingsTable(env) {
  if(s_TrailSettingsReady) {
    return;
  }

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS user_trail_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      enabled INTEGER NOT NULL DEFAULT 0,
      mode INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `).run();
  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_user_trail_settings_user_id
    ON user_trail_settings(user_id)
  `).run();
  s_TrailSettingsReady = true;
}

function entitlementRowIsActive(row) {
  if(!row) {
    return false;
  }
  if(lower(row.status || '') !== 'active') {
    return false;
  }

  const periodEndRaw = String(row.current_period_end || '').trim();
  if(!periodEndRaw) {
    return true;
  }

  const periodEndMs = Date.parse(periodEndRaw);
  return Number.isFinite(periodEndMs) && periodEndMs > Date.now();
}

async function loadPlanActivityFlags(env, userId) {
  const id = Number(userId);
  if(!Number.isFinite(id) || id <= 0) {
    return { starterActive: false, plusActive: false };
  }

  try {
    const rows = await env.DB.prepare(`
      SELECT plan_key, status, current_period_end
      FROM billing_entitlements
      WHERE user_id = ? AND plan_key IN ('starter', 'plus')
    `).bind(id).all();

    let starterActive = false;
    let plusActive = false;

    for(const row of rows?.results || []) {
      const planKey = lower(row?.plan_key || '');
      const isActive = entitlementRowIsActive(row);
      if(planKey === 'starter' && isActive) {
        starterActive = true;
      } else if(planKey === 'plus' && isActive) {
        plusActive = true;
      }
    }

    if(plusActive) {
      starterActive = true;
    }

    return { starterActive, plusActive };
  } catch {
    return { starterActive: false, plusActive: false };
  }
}

function resolvePlanBenefitValues(planFlags) {
  const plusActive = !!planFlags?.plusActive;
  const starterActive = plusActive || !!planFlags?.starterActive;

  if(plusActive) {
    return {
      starterActive: true,
      plusActive: true,
      inviteQuotaTarget: INVITE_QUOTA_PLUS,
      nameCooldownDays: NAME_CHANGE_COOLDOWN_DAYS_PLUS,
    };
  }
  if(starterActive) {
    return {
      starterActive: true,
      plusActive: false,
      inviteQuotaTarget: INVITE_QUOTA_STARTER,
      nameCooldownDays: NAME_CHANGE_COOLDOWN_DAYS_STARTER,
    };
  }
  return {
    starterActive: false,
    plusActive: false,
    inviteQuotaTarget: null,
    nameCooldownDays: NAME_CHANGE_COOLDOWN_DAYS_DEFAULT,
  };
}

async function applyPlanBenefits(env, userId, planFlags) {
  const id = Number(userId);
  if(!Number.isFinite(id) || id <= 0) {
    return;
  }

  const normalized = resolvePlanBenefitValues(planFlags);
  await ensureUsersInviteQuotaBaseColumn(env);

  const row = await env.DB.prepare(`
    SELECT invite_quota, invite_quota_base, name_change_available_at
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(id).first();
  if(!row) {
    return;
  }

  const currentQuota = Number(row.invite_quota || 0);
  const baseRaw = Number(row.invite_quota_base);
  const fallbackBase = Number.isFinite(currentQuota) ? Math.max(0, Math.floor(currentQuota)) : 0;
  const baseQuota = Number.isFinite(baseRaw) ? Math.max(0, Math.floor(baseRaw)) : fallbackBase;
  const targetQuota = normalized.inviteQuotaTarget === null
    ? baseQuota
    : Math.max(0, Math.floor(normalized.inviteQuotaTarget));

  if(!Number.isFinite(baseRaw) || baseRaw < 0) {
    await env.DB.prepare(`
      UPDATE users
      SET invite_quota_base = ?
      WHERE id = ?
    `).bind(baseQuota, id).run();
  }

  if(!Number.isFinite(currentQuota) || Math.floor(currentQuota) !== targetQuota) {
    await env.DB.prepare(`
      UPDATE users
      SET invite_quota = ?
      WHERE id = ?
    `).bind(targetQuota, id).run();
  }

  if(normalized.nameCooldownDays >= NAME_CHANGE_COOLDOWN_DAYS_DEFAULT) {
    return;
  }

  const currentNextAllowedRaw = String(row.name_change_available_at || '').trim();
  const currentNextAllowedMs = currentNextAllowedRaw ? Date.parse(currentNextAllowedRaw) : NaN;
  if(!Number.isFinite(currentNextAllowedMs) || currentNextAllowedMs <= Date.now()) {
    return;
  }

  const targetNextAllowedMs = Date.now() + normalized.nameCooldownDays * DAY_MS;
  if(currentNextAllowedMs > targetNextAllowedMs) {
    await env.DB.prepare(`
      UPDATE users
      SET name_change_available_at = ?
      WHERE id = ?
    `).bind(new Date(targetNextAllowedMs).toISOString(), id).run();
  }
}

function defaultGameTrailState() {
  return {
    plusActive: false,
    trailEnabled: false,
    trailMode: 1,
  };
}

async function loadGameTrailState(env, accountId) {
  const defaults = defaultGameTrailState();
  const id = Number(accountId);
  if(!Number.isFinite(id) || id <= 0) {
    return defaults;
  }

  try {
    await ensureTrailSettingsTable(env);

    const trailRow = await env.DB.prepare(`
      SELECT enabled, mode
      FROM user_trail_settings
      WHERE user_id = ?
      LIMIT 1
    `).bind(id).first();
    const trailEnabled = Number(trailRow?.enabled || 0) === 1;
    let trailMode = Number(trailRow?.mode || 1);
    if(!Number.isFinite(trailMode) || trailMode < TRAIL_MODE_MIN || trailMode > TRAIL_MODE_MAX) {
      trailMode = 1;
    }

    const planFlags = await loadPlanActivityFlags(env, id);

    return {
      plusActive: planFlags.plusActive,
      trailEnabled,
      trailMode,
    };
  } catch {
    // Fail closed when billing tables are missing or query errors occur.
    return defaults;
  }
}

async function handleGameVerify(context) {
	const { request, env } = context;
	const key = request.headers.get('X-Game-Server-Key') || '';
  const defaults = defaultGameTrailState();

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
    return json({ ok: false, message: 'Invalid code format', ...defaults });
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
    return json({ ok: false, message: 'Code not found', ...defaults });
  }
  const trailState = await loadGameTrailState(env, user.id);
  if(Number(user.email_verified || 0) !== 1) {
    return json({
      ok: false,
      code: 'ACCOUNT_UNVERIFIED',
      message: 'Account email is not verified.',
      ...trailState,
    });
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
      ...trailState,
    });
  }

  return json({
    ok: true,
    accountId: user.id,
    name: matchedDummyCode && String(user.dummy_name || '').trim() ? String(user.dummy_name).trim() : user.username,
    username: matchedDummyCode && String(user.dummy_name || '').trim() ? String(user.dummy_name).trim() : user.username,
    dummyCode: matchedDummyCode,
    ...trailState,
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

async function handleGameAccountStatus(context) {
  const { request, env } = context;
  const key = request.headers.get('X-Game-Server-Key') || '';
  if(!env.GAME_SERVER_API_KEY || !timingSafeEqual(key, env.GAME_SERVER_API_KEY)) {
    return json({ ok: false, message: 'Unauthorized game server key' }, 401);
  }

  const accountId = Number(request.headers.get('X-Game-Account-Id') || 0);
  if(!Number.isFinite(accountId) || accountId <= 0) {
    return json({ ok: false, message: 'Invalid account id' }, 400);
  }

  const user = await env.DB.prepare(`
    SELECT ban_is_permanent, ban_until, ban_reason
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(accountId).first();

  if(!user) {
    return json({ ok: false, message: 'Account not found' }, 404);
  }
  const trailState = await loadGameTrailState(env, accountId);

  const now = Date.now();
  const permanent = Number(user.ban_is_permanent || 0) !== 0;
  const banUntilRaw = String(user.ban_until || '');
  const banUntilMs = banUntilRaw ? Date.parse(banUntilRaw) : NaN;
  const tempActive = Number.isFinite(banUntilMs) && banUntilMs > now;
  const banned = permanent || tempActive;
  const remainingSeconds = tempActive ? Math.max(0, Math.ceil((banUntilMs - now) / 1000)) : 0;

  return json({
    ok: true,
    accountId,
    banned,
    banPermanent: permanent,
    banUntil: banUntilRaw,
    banReason: String(user.ban_reason || ''),
    remainingSeconds,
    plusActive: trailState.plusActive,
    trailEnabled: trailState.trailEnabled,
    trailMode: trailState.trailMode,
  });
}

function parseBoundedInt(raw, fallback, min, max) {
  const value = Number(raw);
  if(!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function patreonScopes(env) {
  const value = String(env.PATREON_OAUTH_SCOPES || '').trim();
  return value || 'identity identity.memberships';
}

function patreonRedirectUri(env, request) {
  const configured = String(env.PATREON_REDIRECT_URI || '').trim();
  if(configured) {
    return configured;
  }
  const origin = new URL(request.url).origin;
  return `${origin}/api/billing/patreon/callback`;
}

function plansPageUrl(request, queryValue = '') {
  const origin = new URL(request.url).origin;
  if(!queryValue) {
    return `${origin}/billing/plans`;
  }
  return `${origin}/billing/plans?patreon=${encodeURIComponent(queryValue)}`;
}

async function ensurePatreonTables(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS patreon_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      patreon_user_id TEXT NOT NULL UNIQUE,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      token_expires_at TEXT,
      scope TEXT,
      last_sync_at TEXT,
      last_sync_status TEXT,
      last_sync_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `).run();
  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_patreon_connections_user_id
    ON patreon_connections(user_id)
  `).run();
  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_patreon_connections_patreon_user_id
    ON patreon_connections(patreon_user_id)
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS billing_entitlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plan_key TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_ref TEXT,
      status TEXT NOT NULL,
      current_period_end TEXT,
      raw_payload TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, plan_key),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `).run();
  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_billing_entitlements_plan_status
    ON billing_entitlements(plan_key, status)
  `).run();
  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_billing_entitlements_provider
    ON billing_entitlements(provider)
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS billing_tier_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      plan_key TEXT NOT NULL,
      external_tier_id TEXT NOT NULL UNIQUE,
      tier_title TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_by_user_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    )
  `).run();
  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_billing_tier_rules_provider_plan_active
    ON billing_tier_rules(provider, plan_key, active)
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS patreon_oauth_states (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      state_token TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `).run();
  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_patreon_oauth_states_user_expires
    ON patreon_oauth_states(user_id, expires_at)
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS billing_webhook_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      event_id TEXT NOT NULL UNIQUE,
      event_type TEXT NOT NULL,
      resource_id TEXT,
      received_at TEXT NOT NULL,
      processed_at TEXT,
      raw_payload TEXT NOT NULL
    )
  `).run();
  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_provider_type
    ON billing_webhook_events(provider, event_type)
  `).run();
}

async function createPatreonOAuthState(env, userId) {
  const now = nowIso();
  const expiresAt = new Date(Date.now() + PATREON_OAUTH_STATE_TTL_MS).toISOString();
  const stateToken = `${randomCode(18)}${randomCode(18)}`;
  await env.DB.prepare(`
    INSERT INTO patreon_oauth_states (state_token, user_id, expires_at, used_at, created_at)
    VALUES (?, ?, ?, NULL, ?)
  `).bind(stateToken, userId, expiresAt, now).run();
  return stateToken;
}

async function exchangePatreonToken(env, request, params) {
  const clientId = String(env.PATREON_CLIENT_ID || '').trim();
  const clientSecret = String(env.PATREON_CLIENT_SECRET || '').trim();
  if(!clientId || !clientSecret) {
    throw new Error('Patreon OAuth credentials are not configured');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: patreonRedirectUri(env, request),
    ...params,
  });
  const response = await fetch('https://www.patreon.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const payload = await response.json().catch(() => ({}));
  if(!response.ok) {
    throw new Error(String(payload?.error_description || payload?.error || `Patreon token exchange failed (${response.status})`));
  }
  return payload;
}

async function fetchPatreonIdentity(accessToken) {
  const response = await fetch('https://www.patreon.com/api/oauth2/v2/identity?include=memberships,memberships.currently_entitled_tiers,memberships.campaign', {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
    },
  });
  const payload = await response.json().catch(() => ({}));
  if(!response.ok) {
    throw new Error(String(payload?.errors?.[0]?.detail || `Patreon identity fetch failed (${response.status})`));
  }
  return payload;
}

function parsePatreonIdentity(payload, campaignId) {
  const included = Array.isArray(payload?.included) ? payload.included : [];
  const campaignFilter = String(campaignId || '').trim();
  const memberMap = new Map();

  for(const item of included) {
    if(String(item?.type || '') === 'member' && String(item?.id || '')) {
      memberMap.set(String(item.id), item);
    }
  }

  const refs = Array.isArray(payload?.data?.relationships?.memberships?.data)
    ? payload.data.relationships.memberships.data
    : [];

  let memberships = refs
    .map((ref) => memberMap.get(String(ref?.id || '')))
    .filter(Boolean);
  if(memberships.length === 0 && String(payload?.data?.type || '') === 'member') {
    memberships = [payload.data];
  }

  if(campaignFilter) {
    memberships = memberships.filter((member) => {
      const campaignRef = String(member?.relationships?.campaign?.data?.id || '');
      return campaignRef === campaignFilter;
    });
  }

  const tierIds = new Set();
  let activePatron = false;
  let currentPeriodEnd = null;

  for(const member of memberships) {
    const patronStatus = lower(member?.attributes?.patron_status || '');
    const nextChargeDateRaw = String(member?.attributes?.next_charge_date || '').trim();
    if(nextChargeDateRaw) {
      currentPeriodEnd = nextChargeDateRaw;
    }
    const tierRefs = Array.isArray(member?.relationships?.currently_entitled_tiers?.data)
      ? member.relationships.currently_entitled_tiers.data
      : [];
    if(patronStatus === 'active_patron') {
      activePatron = true;
    } else if(!patronStatus && tierRefs.length > 0) {
      // Some Patreon responses omit patron_status while still returning entitled tiers.
      // In that case, treat the membership as active and let tier rules decide eligibility.
      activePatron = true;
    }
    for(const tierRef of tierRefs) {
      const tierId = String(tierRef?.id || '').trim();
      if(tierId) {
        tierIds.add(tierId);
      }
    }
  }

  return {
    patreonUserId: String(payload?.data?.id || '').trim(),
    activePatron,
    tierIds: Array.from(tierIds),
    currentPeriodEnd,
  };
}

async function loadAllowedTierIds(env, planKey) {
  const normalizedPlanKey = lower(planKey || '');
  if(normalizedPlanKey !== 'plus' && normalizedPlanKey !== 'starter') {
    return new Set();
  }

  const rows = await env.DB.prepare(`
    SELECT external_tier_id
    FROM billing_tier_rules
    WHERE provider = 'patreon' AND plan_key = ? AND active = 1
  `).bind(normalizedPlanKey).all();
  const out = new Set();
  for(const row of rows?.results || []) {
    const tierId = String(row?.external_tier_id || '').trim();
    if(tierId) {
      out.add(tierId);
    }
  }
  return out;
}

async function upsertEntitlement(env, userId, planKey, providerRef, status, currentPeriodEnd, rawPayload) {
  const normalizedPlanKey = lower(planKey || '');
  if(normalizedPlanKey !== 'plus' && normalizedPlanKey !== 'starter') {
    throw new Error(`Unsupported plan key: ${planKey}`);
  }

  const now = nowIso();
  await env.DB.prepare(`
    INSERT INTO billing_entitlements (
      user_id, plan_key, provider, provider_ref, status, current_period_end, raw_payload, created_at, updated_at
    ) VALUES (?, ?, 'patreon', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, plan_key) DO UPDATE SET
      provider = excluded.provider,
      provider_ref = excluded.provider_ref,
      status = excluded.status,
      current_period_end = excluded.current_period_end,
      raw_payload = excluded.raw_payload,
      updated_at = excluded.updated_at
  `).bind(
    userId,
    normalizedPlanKey,
    providerRef,
    status,
    currentPeriodEnd || null,
    JSON.stringify(rawPayload || {}),
    now,
    now,
  ).run();
}

async function syncPatreonConnection(env, userId, accessToken, refreshToken, tokenExpiresAt, scope, identityPayload, source = 'manual') {
  const campaignId = String(env.PATREON_CAMPAIGN_ID || '').trim();
  const parsed = parsePatreonIdentity(identityPayload, campaignId);
  if(!parsed.patreonUserId) {
    throw new Error('Patreon identity payload is missing user id');
  }

  const duplicate = await env.DB.prepare(`
    SELECT user_id
    FROM patreon_connections
    WHERE patreon_user_id = ? AND user_id != ?
    LIMIT 1
  `).bind(parsed.patreonUserId, userId).first();
  if(duplicate) {
    throw new Error('This Patreon account is already linked to another user');
  }

  const allowedStarterTierIds = await loadAllowedTierIds(env, 'starter');
  const allowedPlusTierIds = await loadAllowedTierIds(env, 'plus');
  const hasStarterTier = parsed.tierIds.some((tierId) => allowedStarterTierIds.has(tierId));
  const hasPlusTier = parsed.tierIds.some((tierId) => allowedPlusTierIds.has(tierId));
  const plusActive = parsed.activePatron && hasPlusTier;
  const starterActive = parsed.activePatron && (hasStarterTier || hasPlusTier);
  const now = nowIso();

  await env.DB.prepare(`
    INSERT INTO patreon_connections (
      user_id, patreon_user_id, access_token, refresh_token, token_expires_at, scope,
      last_sync_at, last_sync_status, last_sync_error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ok', NULL, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      patreon_user_id = excluded.patreon_user_id,
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      token_expires_at = excluded.token_expires_at,
      scope = excluded.scope,
      last_sync_at = excluded.last_sync_at,
      last_sync_status = excluded.last_sync_status,
      last_sync_error = excluded.last_sync_error,
      updated_at = excluded.updated_at
  `).bind(
    userId,
    parsed.patreonUserId,
    accessToken,
    refreshToken || null,
    tokenExpiresAt || null,
    scope || null,
    now,
    now,
    now,
  ).run();

  await upsertEntitlement(env, userId, 'starter', parsed.patreonUserId, starterActive ? 'ACTIVE' : 'INACTIVE', parsed.currentPeriodEnd || null, {
    source,
    activePatron: parsed.activePatron,
    tierIds: parsed.tierIds,
    allowedTierIds: Array.from(allowedStarterTierIds),
    includesPlusTier: hasPlusTier,
    identity: identityPayload,
  });

  await upsertEntitlement(env, userId, 'plus', parsed.patreonUserId, plusActive ? 'ACTIVE' : 'INACTIVE', parsed.currentPeriodEnd || null, {
    source,
    activePatron: parsed.activePatron,
    tierIds: parsed.tierIds,
    allowedTierIds: Array.from(allowedPlusTierIds),
    identity: identityPayload,
  });

  await applyPlanBenefits(env, userId, { starterActive, plusActive });

  return {
    patreonUserId: parsed.patreonUserId,
    activePatron: parsed.activePatron,
    tierIds: parsed.tierIds,
    starterActive,
    plusActive,
    currentPeriodEnd: parsed.currentPeriodEnd || null,
  };
}

async function syncPatreonForUserFromStoredConnection(env, request, userId) {
  const row = await env.DB.prepare(`
    SELECT user_id, access_token, refresh_token, token_expires_at, scope
    FROM patreon_connections
    WHERE user_id = ?
    LIMIT 1
  `).bind(userId).first();
  if(!row) {
    return null;
  }

  let accessToken = String(row.access_token || '');
  let refreshToken = String(row.refresh_token || '');
  let scope = String(row.scope || '');
  let tokenExpiresAt = String(row.token_expires_at || '');
  const expiresAtMs = tokenExpiresAt ? Date.parse(tokenExpiresAt) : NaN;
  const shouldRefresh = refreshToken && Number.isFinite(expiresAtMs) && expiresAtMs <= (Date.now() + PATREON_TOKEN_REFRESH_SKEW_MS);

  if(shouldRefresh) {
    const refreshed = await exchangePatreonToken(env, request, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    accessToken = String(refreshed?.access_token || '').trim();
    refreshToken = String(refreshed?.refresh_token || refreshToken).trim();
    scope = String(refreshed?.scope || scope).trim();
    if(!accessToken) {
      throw new Error('Patreon refresh returned no access token');
    }
    const expiresIn = parseBoundedInt(refreshed?.expires_in, 0, 0, 60 * 60 * 24 * 365);
    tokenExpiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
  }

  const identity = await fetchPatreonIdentity(accessToken);
  return syncPatreonConnection(env, userId, accessToken, refreshToken, tokenExpiresAt, scope, identity, 'stale_sync');
}

async function loadSubscriptionByPlanKey(env, userId, planKey) {
  const normalizedPlanKey = lower(planKey || '');
  if(normalizedPlanKey !== 'plus' && normalizedPlanKey !== 'starter') {
    return null;
  }
  const row = await env.DB.prepare(`
    SELECT plan_key, provider, provider_ref, status, current_period_end, updated_at
    FROM billing_entitlements
    WHERE user_id = ? AND plan_key = ?
    LIMIT 1
  `).bind(userId, normalizedPlanKey).first();
  return row || null;
}

function extractPatreonUserIdFromWebhook(payload) {
  const directUserId = String(payload?.data?.relationships?.user?.data?.id || '').trim();
  if(directUserId) {
    return directUserId;
  }

  const included = Array.isArray(payload?.included) ? payload.included : [];
  for(const item of included) {
    if(String(item?.type || '') === 'user' && String(item?.id || '')) {
      return String(item.id);
    }
  }
  return '';
}

function patreonWebhookType(payload) {
  const attr = payload?.data?.attributes || {};
  const candidate = String(attr.type || attr.event_type || attr.action || payload?.type || payload?.event_type || 'unknown').trim();
  return candidate || 'unknown';
}

function verifyPatreonWebhookSignature(secret, rawBodyText, signatureHeader) {
  const expected = hmacMd5Hex(secret, rawBodyText);
  const rawProvided = String(signatureHeader || '').trim().toLowerCase();
  const provided = rawProvided.includes('=') ? rawProvided.split('=').pop() : rawProvided;
  if(!provided) {
    return false;
  }
  return timingSafeEqual(expected, provided);
}

async function markPatreonConnectionSyncError(env, userId, errorMessage) {
  await env.DB.prepare(`
    UPDATE patreon_connections
    SET last_sync_at = ?, last_sync_status = 'error', last_sync_error = ?, updated_at = ?
    WHERE user_id = ?
  `).bind(nowIso(), String(errorMessage || 'sync failed'), nowIso(), userId).run();
}

async function handlePatreonStart(context) {
  const { env, request } = context;
  const auth = await currentUser(context);
  if(auth.error) {
    return auth.error;
  }

  await ensurePatreonTables(env);
  const clientId = String(env.PATREON_CLIENT_ID || '').trim();
  if(!clientId) {
    return json({ ok: false, message: 'PATREON_CLIENT_ID is not configured' }, 500);
  }

  const state = await createPatreonOAuthState(env, auth.user.id);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: patreonRedirectUri(env, request),
    scope: patreonScopes(env),
    state,
  });
  return Response.redirect(`https://www.patreon.com/oauth2/authorize?${params.toString()}`, 302);
}

async function handlePatreonCallback(context) {
  const { env, request } = context;
  await ensurePatreonTables(env);
  const url = new URL(request.url);
  const state = String(url.searchParams.get('state') || '').trim();
  const code = String(url.searchParams.get('code') || '').trim();
  const errorFromPatreon = String(url.searchParams.get('error') || '').trim();

  if(errorFromPatreon) {
    return Response.redirect(plansPageUrl(request, 'error'), 302);
  }
  if(!state || !code) {
    return Response.redirect(plansPageUrl(request, 'error'), 302);
  }

  const row = await env.DB.prepare(`
    SELECT id, user_id, expires_at, used_at
    FROM patreon_oauth_states
    WHERE state_token = ?
    LIMIT 1
  `).bind(state).first();
  if(!row) {
    return Response.redirect(plansPageUrl(request, 'error'), 302);
  }
  if(String(row.used_at || '').trim()) {
    return Response.redirect(plansPageUrl(request, 'error'), 302);
  }
  const expiresAtMs = Date.parse(String(row.expires_at || ''));
  if(!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return Response.redirect(plansPageUrl(request, 'error'), 302);
  }

  await env.DB.prepare(`
    UPDATE patreon_oauth_states
    SET used_at = ?
    WHERE id = ? AND used_at IS NULL
  `).bind(nowIso(), row.id).run();

  try {
    const tokenPayload = await exchangePatreonToken(env, request, {
      grant_type: 'authorization_code',
      code,
    });
    const accessToken = String(tokenPayload?.access_token || '').trim();
    const refreshToken = String(tokenPayload?.refresh_token || '').trim();
    const scope = String(tokenPayload?.scope || '').trim();
    const expiresIn = parseBoundedInt(tokenPayload?.expires_in, 0, 0, 60 * 60 * 24 * 365);
    const tokenExpiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
    if(!accessToken) {
      return Response.redirect(plansPageUrl(request, 'error'), 302);
    }
    const identity = await fetchPatreonIdentity(accessToken);
    await syncPatreonConnection(
      env,
      Number(row.user_id),
      accessToken,
      refreshToken,
      tokenExpiresAt,
      scope,
      identity,
      'oauth_callback',
    );
    return Response.redirect(plansPageUrl(request, 'linked'), 302);
  } catch {
    return Response.redirect(plansPageUrl(request, 'error'), 302);
  }
}

async function handlePatreonDisconnect(context) {
  const { env } = context;
  const auth = await currentUser(context);
  if(auth.error) {
    return auth.error;
  }
  await ensurePatreonTables(env);

  await env.DB.prepare(`
    DELETE FROM patreon_connections
    WHERE user_id = ?
  `).bind(auth.user.id).run();

  await upsertEntitlement(
    env,
    auth.user.id,
    'starter',
    null,
    'INACTIVE',
    null,
    { source: 'disconnect' },
  );
  await upsertEntitlement(
    env,
    auth.user.id,
    'plus',
    null,
    'INACTIVE',
    null,
    { source: 'disconnect' },
  );
  await applyPlanBenefits(env, auth.user.id, { starterActive: false, plusActive: false });

  return json({ ok: true, disconnected: true });
}

async function handleMySubscription(context) {
  const { env, request } = context;
  const auth = await currentUser(context);
  if(auth.error) {
    return auth.error;
  }
  await ensurePatreonTables(env);

  const connection = await env.DB.prepare(`
    SELECT user_id, patreon_user_id, last_sync_at, last_sync_status, last_sync_error
    FROM patreon_connections
    WHERE user_id = ?
    LIMIT 1
  `).bind(auth.user.id).first();

  const staleSeconds = parseBoundedInt(
    env.PATREON_SYNC_STALE_SECONDS,
    PATREON_SYNC_STALE_DEFAULT_SECONDS,
    60,
    7 * 24 * 60 * 60,
  );
  const staleCutoffMs = Date.now() - staleSeconds * 1000;
  const lastSyncMs = connection?.last_sync_at ? Date.parse(String(connection.last_sync_at || '')) : NaN;
  const shouldSync = !!connection && (!Number.isFinite(lastSyncMs) || lastSyncMs < staleCutoffMs);

  if(shouldSync) {
    try {
      await syncPatreonForUserFromStoredConnection(env, request, auth.user.id);
    } catch(err) {
      await markPatreonConnectionSyncError(env, auth.user.id, String(err?.message || 'sync failed'));
    }
  }

  const latestConnection = await env.DB.prepare(`
    SELECT patreon_user_id, last_sync_at, last_sync_status, last_sync_error
    FROM patreon_connections
    WHERE user_id = ?
    LIMIT 1
  `).bind(auth.user.id).first();
  const subscription = await loadSubscriptionByPlanKey(env, auth.user.id, 'plus');
  const starterSubscription = await loadSubscriptionByPlanKey(env, auth.user.id, 'starter');
  const planFlags = await loadPlanActivityFlags(env, auth.user.id);
  const benefits = resolvePlanBenefitValues(planFlags);
  const inviteQuotaRow = await env.DB.prepare(`
    SELECT invite_quota
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(auth.user.id).first();

  return json({
    ok: true,
    patreonConnected: !!latestConnection,
    connection: latestConnection || null,
    subscription,
    starterSubscription,
    benefits: {
      starterActive: benefits.starterActive,
      plusActive: benefits.plusActive,
      inviteQuota: Number(inviteQuotaRow?.invite_quota || 0),
      nameCooldownDays: benefits.nameCooldownDays,
    },
  });
}

async function handlePatreonWebhook(context) {
  const { env, request } = context;
  await ensurePatreonTables(env);

  const secret = String(env.PATREON_WEBHOOK_SECRET || '').trim();
  if(!secret) {
    return json({ ok: false, message: 'PATREON_WEBHOOK_SECRET is not configured' }, 500);
  }

  const rawBodyText = await request.text();
  const signatureHeader = request.headers.get('X-Patreon-Signature') || request.headers.get('x-patreon-signature') || '';
  if(!verifyPatreonWebhookSignature(secret, rawBodyText, signatureHeader)) {
    return json({ ok: false, message: 'Invalid Patreon webhook signature' }, 401);
  }

  let payload = {};
  try {
    payload = JSON.parse(rawBodyText || '{}');
  } catch {
    return json({ ok: false, message: 'Invalid webhook payload' }, 400);
  }
  const eventType = patreonWebhookType(payload);
  const resourceId = String(payload?.data?.id || '').trim() || null;
  const eventId = await sha256Hex(`${eventType}:${rawBodyText}`);
  const now = nowIso();

  const insertEvent = await env.DB.prepare(`
    INSERT INTO billing_webhook_events (
      provider, event_id, event_type, resource_id, received_at, processed_at, raw_payload
    ) VALUES ('patreon', ?, ?, ?, ?, NULL, ?)
    ON CONFLICT(event_id) DO NOTHING
  `).bind(eventId, eventType, resourceId, now, rawBodyText).run();

  if((insertEvent.meta?.changes || 0) === 0) {
    return json({ ok: true, duplicate: true });
  }

  const patreonUserId = extractPatreonUserIdFromWebhook(payload);
  if(patreonUserId) {
    const connection = await env.DB.prepare(`
      SELECT user_id
      FROM patreon_connections
      WHERE patreon_user_id = ?
      LIMIT 1
    `).bind(patreonUserId).first();

    if(connection) {
      try {
        await syncPatreonForUserFromStoredConnection(env, request, Number(connection.user_id));
      } catch(err) {
        await markPatreonConnectionSyncError(env, Number(connection.user_id), String(err?.message || 'sync failed'));
      }
    }
  }

  await env.DB.prepare(`
    UPDATE billing_webhook_events
    SET processed_at = ?
    WHERE event_id = ?
  `).bind(nowIso(), eventId).run();

  return json({ ok: true });
}

async function handleAdminPatreonTiers(context) {
  const { env } = context;
  const auth = await requireAdmin(context);
  if(auth.error) {
    return auth.error;
  }
  await ensurePatreonTables(env);

  const rows = await env.DB.prepare(`
    SELECT plan_key, external_tier_id, tier_title, active, created_at, updated_at
    FROM billing_tier_rules
    WHERE provider = 'patreon' AND plan_key IN ('starter', 'plus')
    ORDER BY active DESC, plan_key ASC, updated_at DESC
  `).all();
  return json({ ok: true, tiers: rows?.results || [] });
}

async function handleAdminPatreonTierUpsert(context) {
  const { env, request } = context;
  const auth = await requireAdmin(context);
  if(auth.error) {
    return auth.error;
  }
  await ensurePatreonTables(env);

  const body = await parseRequestBody(request);
  const data = typeof body === 'string' ? {} : (body || {});
  const planKey = lower(data.planKey || 'plus');
  const externalTierId = String(data.externalTierId || '').trim();
  const tierTitle = String(data.tierTitle || '').trim();
  const active = Number(data.active === undefined ? 1 : data.active ? 1 : 0) ? 1 : 0;

  if(planKey !== 'plus' && planKey !== 'starter') {
    return json({ ok: false, message: 'planKey must be plus or starter' }, 400);
  }
  if(!externalTierId) {
    return json({ ok: false, message: 'externalTierId is required' }, 400);
  }

  const now = nowIso();
  await env.DB.prepare(`
    INSERT INTO billing_tier_rules (
      provider, plan_key, external_tier_id, tier_title, active, created_by_user_id, created_at, updated_at
    ) VALUES ('patreon', ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(external_tier_id) DO UPDATE SET
      plan_key = excluded.plan_key,
      tier_title = excluded.tier_title,
      active = excluded.active,
      updated_at = excluded.updated_at
  `).bind(planKey, externalTierId, tierTitle || null, active, auth.user.id, now, now).run();

  return json({ ok: true, planKey, externalTierId, tierTitle, active });
}

async function handleAdminPatreonTierDelete(context, externalTierId) {
  const { env } = context;
  const auth = await requireAdmin(context);
  if(auth.error) {
    return auth.error;
  }
  await ensurePatreonTables(env);

  const id = String(externalTierId || '').trim();
  if(!id) {
    return json({ ok: false, message: 'externalTierId is required' }, 400);
  }

  const updated = await env.DB.prepare(`
    UPDATE billing_tier_rules
    SET active = 0, updated_at = ?
    WHERE provider = 'patreon' AND external_tier_id = ?
  `).bind(nowIso(), id).run();
  if((updated.meta?.changes || 0) !== 1) {
    return json({ ok: false, message: 'Tier not found' }, 404);
  }
  return json({ ok: true, externalTierId: id, active: 0 });
}

async function handleAdminTrailSettingsGet(context) {
  const { env } = context;
  const auth = await requireAdmin(context);
  if(auth.error) {
    return auth.error;
  }

  await ensureTrailSettingsTable(env);

  const row = await env.DB.prepare(`
    SELECT enabled, mode
    FROM user_trail_settings
    WHERE user_id = ?
    LIMIT 1
  `).bind(auth.user.id).first();

  let trailMode = Number(row?.mode || 1);
  if(!Number.isFinite(trailMode) || trailMode < TRAIL_MODE_MIN || trailMode > TRAIL_MODE_MAX) {
    trailMode = 1;
  }

  return json({
    ok: true,
    trailEnabled: Number(row?.enabled || 0) === 1,
    trailMode,
  });
}

async function handleAdminTrailSettingsSet(context) {
  const { env, request } = context;
  const auth = await requireAdmin(context);
  if(auth.error) {
    return auth.error;
  }

  await ensureTrailSettingsTable(env);

  const body = await parseRequestBody(request);
  const data = typeof body === 'string' ? {} : (body || {});
  const trailEnabled = Number(data.enabled ? 1 : 0) === 1;
  let trailMode = Number(data.mode === undefined ? 1 : data.mode);
  if(!Number.isFinite(trailMode) || trailMode < TRAIL_MODE_MIN || trailMode > TRAIL_MODE_MAX) {
    trailMode = 1;
  }

  const now = nowIso();
  await env.DB.prepare(`
    INSERT INTO user_trail_settings (
      user_id, enabled, mode, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      enabled = excluded.enabled,
      mode = excluded.mode,
      updated_at = excluded.updated_at
  `).bind(auth.user.id, trailEnabled ? 1 : 0, trailMode, now, now).run();

  return json({
    ok: true,
    trailEnabled,
    trailMode,
  });
}

async function handleMyTrailSettingsGet(context) {
  const { env } = context;
  const auth = await currentUser(context);
  if(auth.error) {
    return auth.error;
  }

  await ensureTrailSettingsTable(env);

  const row = await env.DB.prepare(`
    SELECT enabled, mode
    FROM user_trail_settings
    WHERE user_id = ?
    LIMIT 1
  `).bind(auth.user.id).first();

  let trailMode = Number(row?.mode || 1);
  if(!Number.isFinite(trailMode) || trailMode < TRAIL_MODE_MIN || trailMode > TRAIL_MODE_MAX) {
    trailMode = 1;
  }

  const planFlags = await loadPlanActivityFlags(env, auth.user.id);

  return json({
    ok: true,
    plusActive: !!planFlags.plusActive,
    trailEnabled: Number(row?.enabled || 0) === 1,
    trailMode,
  });
}

async function handleMyTrailSettingsSet(context) {
  const { env, request } = context;
  const auth = await currentUser(context);
  if(auth.error) {
    return auth.error;
  }

  const planFlags = await loadPlanActivityFlags(env, auth.user.id);
  if(!planFlags.plusActive) {
    return json({ ok: false, message: 'Plus subscription is required to use trail settings.' }, 403);
  }

  await ensureTrailSettingsTable(env);

  const body = await parseRequestBody(request);
  const data = typeof body === 'string' ? {} : (body || {});
  const trailEnabled = Number(data.enabled ? 1 : 0) === 1;
  let trailMode = Number(data.mode === undefined ? 1 : data.mode);
  if(!Number.isFinite(trailMode) || trailMode < TRAIL_MODE_MIN || trailMode > TRAIL_MODE_MAX) {
    trailMode = 1;
  }

  const now = nowIso();
  await env.DB.prepare(`
    INSERT INTO user_trail_settings (
      user_id, enabled, mode, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      enabled = excluded.enabled,
      mode = excluded.mode,
      updated_at = excluded.updated_at
  `).bind(auth.user.id, trailEnabled ? 1 : 0, trailMode, now, now).run();

  return json({
    ok: true,
    plusActive: true,
    trailEnabled,
    trailMode,
  });
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
        ban_until,
        ban_reason
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
        ban_until,
        ban_reason
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

  if(request.method === 'POST' && path === '/game/account-status') {
    return handleGameAccountStatus(context);
  }

  if(request.method === 'GET' && path === '/billing/patreon/start') {
    return handlePatreonStart(context);
  }

  if(request.method === 'GET' && path === '/billing/patreon/callback') {
    return handlePatreonCallback(context);
  }

  if(request.method === 'POST' && path === '/billing/patreon/webhook') {
    return handlePatreonWebhook(context);
  }

  if(request.method === 'POST' && path === '/billing/patreon/disconnect') {
    return handlePatreonDisconnect(context);
  }

  if(request.method === 'GET' && path === '/billing/subscription/me') {
    return handleMySubscription(context);
  }

  if(request.method === 'GET' && path === '/me/trail-settings') {
    return handleMyTrailSettingsGet(context);
  }

  if(request.method === 'POST' && path === '/me/trail-settings') {
    return handleMyTrailSettingsSet(context);
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

  if(request.method === 'GET' && path === '/admin/patreon/tiers') {
    return handleAdminPatreonTiers(context);
  }

  if(request.method === 'POST' && path === '/admin/patreon/tiers') {
    return handleAdminPatreonTierUpsert(context);
  }

  if(request.method === 'DELETE' && path.startsWith('/admin/patreon/tiers/')) {
    const externalTierId = decodeURIComponent(path.slice('/admin/patreon/tiers/'.length));
    return handleAdminPatreonTierDelete(context, externalTierId);
  }

  if(request.method === 'GET' && path === '/admin/trail-settings') {
    return handleAdminTrailSettingsGet(context);
  }

  if(request.method === 'POST' && path === '/admin/trail-settings') {
    return handleAdminTrailSettingsSet(context);
  }

  return json({ ok: false, message: 'API route not found' }, 404);
}
