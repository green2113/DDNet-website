const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeCode(raw) {
  if(typeof raw !== 'string') {
    return '';
  }
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function randomCode(length) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for(let i = 0; i < bytes.length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function bytesToHex(bytes) {
  let out = '';
  for(const b of bytes) {
    out += b.toString(16).padStart(2, '0');
  }
  return out;
}

function hexToBytes(hex) {
  if(hex.length % 2 !== 0) {
    throw new Error('invalid hex length');
  }
  const out = new Uint8Array(hex.length / 2);
  for(let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for(const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + padding);
  const out = new Uint8Array(binary.length);
  for(let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

async function hmacSha256(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return new Uint8Array(signature);
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export function timingSafeEqual(a, b) {
  if(typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  const maxLen = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;

  for(let i = 0; i < maxLen; i += 1) {
    const ac = i < a.length ? a.charCodeAt(i) : 0;
    const bc = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ac ^ bc;
  }

  return diff === 0;
}

async function pbkdf2(password, salt, iterations) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    baseKey,
    256,
  );

  return new Uint8Array(bits);
}

export async function hashPassword(password) {
  const iterations = 100000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await pbkdf2(password, salt, iterations);
  return `pbkdf2$${iterations}$${bytesToBase64Url(salt)}$${bytesToHex(derived)}`;
}

export async function verifyPassword(password, stored) {
  try {
    const parts = String(stored).split('$');
    if(parts.length !== 4 || parts[0] !== 'pbkdf2') {
      return false;
    }

    const iterations = Number(parts[1]);
    if(!Number.isInteger(iterations) || iterations < 1000 || iterations > 100000) {
      return false;
    }

    const salt = base64UrlToBytes(parts[2]);
    const expected = parts[3];
    const derived = await pbkdf2(password, salt, iterations);
    const actual = bytesToHex(derived);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function signSessionToken(userId, secret, durationSeconds = 30 * 24 * 60 * 60) {
  const payloadObj = {
    uid: Number(userId),
    exp: Math.floor(Date.now() / 1000) + durationSeconds,
  };
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify(payloadObj)));
  const sig = bytesToBase64Url(await hmacSha256(secret, payload));
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token, secret) {
  if(typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if(parts.length !== 2) {
    return null;
  }

  const [payloadPart, sigPart] = parts;
  const expectedSig = bytesToBase64Url(await hmacSha256(secret, payloadPart));
  if(!timingSafeEqual(sigPart, expectedSig)) {
    return null;
  }

  try {
    const payloadBytes = base64UrlToBytes(payloadPart);
    const payload = JSON.parse(decoder.decode(payloadBytes));
    if(!payload || typeof payload.uid !== 'number' || typeof payload.exp !== 'number') {
      return null;
    }

    if(payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(request) {
  const header = request.headers.get('cookie') || '';
  const cookies = {};

  for(const pair of header.split(';')) {
    const trimmed = pair.trim();
    if(!trimmed) {
      continue;
    }
    const idx = trimmed.indexOf('=');
    if(idx === -1) {
      continue;
    }
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(value);
  }

  return cookies;
}

export function buildSetCookie(name, value, { maxAge = 0, secure = true } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];

  if(maxAge > 0) {
    parts.push(`Max-Age=${maxAge}`);
  }

  if(secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function clearCookie(name, { secure = true } = {}) {
  return buildSetCookie(name, '', { maxAge: 0, secure });
}

export function getCountryCode(request) {
  const raw = (request.headers.get('CF-IPCountry') || request.headers.get('X-Country-Code') || '').trim().toUpperCase();
  if(raw === 'TWN' || raw === '158') {
    return 'TW';
  }

  if(raw) {
    return raw;
  }

  return 'ZZ';
}

export function getClientIp(request) {
  const xff = request.headers.get('X-Forwarded-For');
  if(xff) {
    return xff.split(',')[0].trim();
  }
  return request.headers.get('CF-Connecting-IP') || '0.0.0.0';
}

const VPN_PROXY_ASN_KEYWORDS = [
  'vpn',
  'proxy',
  'datacenter',
  'digitalocean',
  'linode',
  'vultr',
  'ovh',
  'hetzner',
  'm247',
  'choopa',
  'leaseweb',
  'psychz',
  'private layer',
  'amazon',
  'aws',
  'google cloud',
  'microsoft',
  'azure',
  'oracle cloud',
  'ibm cloud',
  'alibaba cloud',
  'tencent cloud',
];

export function isLikelyVpnOrProxy(request) {
  const cf = request.cf || {};
  const bot = cf.botManagement || {};

  if(bot.corporateProxy === true) {
    return { blocked: true, reason: 'corporate_proxy' };
  }

  const org = String(cf.asOrganization || '').toLowerCase();
  if(!org) {
    return { blocked: false, reason: '' };
  }

  for(const keyword of VPN_PROXY_ASN_KEYWORDS) {
    if(org.includes(keyword)) {
      return {
        blocked: true,
        reason: `asn_${String(cf.asn || '')}`,
      };
    }
  }

  return { blocked: false, reason: '' };
}

export async function parseRequestBody(request) {
  const contentType = (request.headers.get('content-type') || '').toLowerCase();

  if(contentType.includes('application/json')) {
    try {
      return await request.json();
    } catch {
      return {};
    }
  }

  if(contentType.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    const obj = {};
    for(const [key, value] of params.entries()) {
      obj[key] = value;
    }
    return obj;
  }

  return await request.text();
}

export function isValidUsername(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_]{3,24}$/.test(value);
}

export function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidPassword(value) {
  return typeof value === 'string' && value.length >= 8 && value.length <= 128;
}

export function lower(value) {
  return String(value || '').trim().toLowerCase();
}
