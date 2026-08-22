// ?next=/dashboard — same-site return after a session check fails on refresh.
export function readInternalNextPath() {
  if(typeof window === 'undefined') {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  const next = String(params.get('next') || '').trim();
  if(!next.startsWith('/') || next.startsWith('//')) {
    return null;
  }
  return next;
}

// 회원가입/로그인 후 되돌아갈 외부 사이트(playravion.com 계열)를 안전하게 판별합니다.
const ALLOWED_RETURN_BASE_HOSTS = ['playravion.com'];

function isAllowedReturn(url) {
  try {
    const parsed = new URL(url);
    if(parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_RETURN_BASE_HOSTS.some(
      (base) => host === base || host.endsWith(`.${base}`),
    );
  } catch {
    return false;
  }
}

// 우선순위: 명시적 ?return=... 파라미터 → dev 등 서브사이트에서 넘어온 referrer 기반 추론
export function readReturnUrl() {
  if(typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const explicit = params.get('return');
  if(explicit && isAllowedReturn(explicit)) {
    return explicit;
  }

  const ref = document.referrer;
  if(ref && isAllowedReturn(ref)) {
    try {
      const refUrl = new URL(ref);
      if(refUrl.hostname.toLowerCase() !== window.location.hostname.toLowerCase()) {
        return `${refUrl.origin}/login`;
      }
    } catch {
      return null;
    }
  }

  return null;
}

// return 파라미터를 유지한 채 내부 경로 링크를 만들 때 사용합니다.
export function withReturnParam(path, returnUrl) {
  if(!returnUrl) {
    return path;
  }
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}return=${encodeURIComponent(returnUrl)}`;
}
