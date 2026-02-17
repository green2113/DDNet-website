import { createContext, useContext, useMemo, useState } from 'react';

const STORAGE_KEY = 'ddnet_lang';

const LANGUAGE_OPTIONS = [
  { code: 'zh-TW', label: '繁體中文', flag: 'tw' },
  { code: 'zh-CN', label: '简体中文', flag: 'cn' },
  { code: 'ko', label: '한국어', flag: 'kr' },
  { code: 'en', label: 'English', flag: 'us' },
  { code: 'ja', label: '日本語', flag: 'jp' },
];

const LOCALE_BY_LANGUAGE = {
  'zh-TW': 'zh-TW',
  'zh-CN': 'zh-CN',
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
};

const translations = {
  'zh-TW': {
    topbar: { language: '語言' },
    common: {
      home: '首頁',
      login: '登入',
      register: '註冊',
      dashboard: '儀表板',
      logout: '登出',
      backHome: '← 回首頁',
      retry: '重新嘗試',
      loadingSession: '正在檢查工作階段...',
      notLoggedInYet: '尚未登入嗎？',
      alreadyHaveAccount: '已經有帳號了嗎？',
      goToDashboard: '前往儀表板',
      creating: '建立中...',
      loggingIn: '登入中...',
    },
    home: {
      logoutDone: '已登出。',
      eyebrow: 'DDNET SERVER ACCESS',
      title: '基於網頁驗證的 DDNet 進入系統',
      lead: '建立帳號並取得遊戲登入碼後，在遊戲內輸入 /login 代碼 解除觀戰限制。',
      openDashboard: '前往儀表板',
      createAnother: '建立其他帳號',
      startLogin: '開始登入',
      createNew: '建立新帳號',
      featureAccountTitle: '網頁帳號登入',
      featureAccountBody: '用電子郵件與密碼登入並管理帳號。',
      featureCodeTitle: '遊戲代碼發放',
      featureCodeBody: '可在儀表板重新發放長期有效的遊戲登入碼。',
      featureGameTitle: '遊戲內驗證',
      featureGameBody: '在伺服器輸入 /login 代碼 後即可開始遊玩。',
    },
    login: {
      eyebrow: 'WELCOME BACK',
      title: '登入',
      subtitle: '使用已註冊的電子郵件與密碼登入。',
      email: '電子郵件',
      password: '密碼',
      submit: '登入',
      success: '登入成功，正在前往儀表板。',
    },
    register: {
      eyebrow: 'CREATE ACCOUNT',
      title: '註冊',
      subtitle: '台灣使用者可直接註冊，海外使用者需要邀請碼。',
      username: '使用者名稱',
      email: '電子郵件',
      password: '密碼',
      invite: '邀請碼（海外註冊必填）',
      invitePlaceholder: '8 位代碼',
      submit: '建立帳號',
      success: '註冊成功。遊戲代碼: {code}',
    },
    dashboard: {
      eyebrow: 'ACCOUNT CONTROL CENTER',
      title: '帳號儀表板',
      lead: '遊戲登入碼在重新發放前持續有效。',
      accountTitle: '我的帳號',
      inviteTitle: '邀請碼',
      inviteBody: '海外玩家註冊時可分享此代碼。',
      inviteUsage: '已使用 {used} / {quota}',
      gameCodeTitle: '遊戲登入碼',
      gameCodeBody: '代碼預設以遮罩顯示，可用眼睛按鈕切換顯示。',
      rotate: '重新發放代碼',
      rotating: '發放中...',
      rotated: '新的遊戲登入碼已發放。',
      newCodeHeader: '新代碼',
      newCodeInGame: '遊戲內',
      showCode: '顯示代碼',
      hideCode: '隱藏代碼',
      copyCode: '複製代碼',
      copied: '代碼已複製。',
      copyFailed: '複製失敗。',
      noCurrentCode: '目前沒有可顯示的代碼，請先重新發放一次。',
      inGameTitle: '遊戲內使用方式',
      step1: '連線至 DDNet 伺服器',
      step2: '在聊天欄輸入 /login 發放代碼',
      step3: '驗證成功後解除觀戰並可遊玩',
      rowUserId: '使用者 ID',
      rowUsername: '使用者名稱',
      rowEmail: '電子郵件',
      rowCountry: '註冊國家',
      rowCreatedAt: '建立時間',
      rowCodeRotated: '代碼更新時間',
    },
    blocked: {
      eyebrow: 'ACCESS BLOCKED',
      title: '連線已被封鎖',
      body: '目前網路被判定為 VPN/Proxy，登入與註冊功能已被限制。',
    },
  },
  'zh-CN': {
    topbar: { language: '语言' },
    common: {
      home: '主页',
      login: '登录',
      register: '注册',
      dashboard: '仪表盘',
      logout: '退出登录',
      backHome: '← 返回主页',
      retry: '重试',
      loadingSession: '正在检查会话...',
      notLoggedInYet: '还没有账号？',
      alreadyHaveAccount: '已经有账号了？',
      goToDashboard: '前往仪表盘',
      creating: '创建中...',
      loggingIn: '登录中...',
    },
    home: {
      logoutDone: '已退出登录。',
      eyebrow: 'DDNET SERVER ACCESS',
      title: '基于网页认证的 DDNet 准入系统',
      lead: '创建账号并获取游戏登录码后，在游戏内输入 /login 代码 解除观战限制。',
      openDashboard: '前往仪表盘',
      createAnother: '创建其他账号',
      startLogin: '开始登录',
      createNew: '创建新账号',
      featureAccountTitle: '网页账号登录',
      featureAccountBody: '使用邮箱/密码登录并管理账号。',
      featureCodeTitle: '游戏代码发放',
      featureCodeBody: '可在仪表盘重新发放长期有效的游戏登录码。',
      featureGameTitle: '游戏内认证',
      featureGameBody: '在服务器输入 /login 代码 后即可开始游玩。',
    },
    login: {
      eyebrow: 'WELCOME BACK',
      title: '登录',
      subtitle: '使用已注册邮箱和密码登录。',
      email: '邮箱',
      password: '密码',
      submit: '登录',
      success: '登录成功，正在跳转到仪表盘。',
    },
    register: {
      eyebrow: 'CREATE ACCOUNT',
      title: '注册',
      subtitle: '台湾用户可直接注册，海外用户需要邀请码。',
      username: '用户名',
      email: '邮箱',
      password: '密码',
      invite: '邀请码（海外注册必填）',
      invitePlaceholder: '8位代码',
      submit: '创建账号',
      success: '注册成功。游戏代码: {code}',
    },
    dashboard: {
      eyebrow: 'ACCOUNT CONTROL CENTER',
      title: '账号仪表盘',
      lead: '游戏登录码在重新发放前一直有效。',
      accountTitle: '我的账号',
      inviteTitle: '邀请码',
      inviteBody: '海外玩家注册时可分享该代码。',
      inviteUsage: '已使用 {used} / {quota}',
      gameCodeTitle: '游戏登录码',
      gameCodeBody: '代码默认以遮罩显示，可用眼睛按钮切换显示。',
      rotate: '重新发放代码',
      rotating: '发放中...',
      rotated: '新的游戏登录码已发放。',
      newCodeHeader: '新代码',
      newCodeInGame: '游戏内',
      showCode: '显示代码',
      hideCode: '隐藏代码',
      copyCode: '复制代码',
      copied: '代码已复制。',
      copyFailed: '复制失败。',
      noCurrentCode: '当前没有可显示的代码，请先重新发放一次。',
      inGameTitle: '游戏内使用方法',
      step1: '连接 DDNet 服务器',
      step2: '在聊天栏输入 /login 发放代码',
      step3: '验证成功后解除观战并可游玩',
      rowUserId: '用户 ID',
      rowUsername: '用户名',
      rowEmail: '邮箱',
      rowCountry: '注册国家',
      rowCreatedAt: '创建时间',
      rowCodeRotated: '代码更新时间',
    },
    blocked: {
      eyebrow: 'ACCESS BLOCKED',
      title: '连接已被拦截',
      body: '当前网络被判定为 VPN/Proxy，登录与注册已被限制。',
    },
  },
  ko: {
    topbar: { language: '언어' },
    common: {
      home: '메인',
      login: '로그인',
      register: '회원가입',
      dashboard: '대시보드',
      logout: '로그아웃',
      backHome: '← 메인으로',
      retry: '다시 시도',
      loadingSession: '세션 확인 중...',
      notLoggedInYet: '계정이 없으신가요?',
      alreadyHaveAccount: '이미 계정이 있으신가요?',
      goToDashboard: '대시보드로 이동',
      creating: '생성 중...',
      loggingIn: '로그인 중...',
    },
    home: {
      logoutDone: '로그아웃되었습니다.',
      eyebrow: 'DDNET SERVER ACCESS',
      title: '웹 인증 기반 DDNet 입장 시스템',
      lead: '계정을 만들고 게임 로그인 코드를 발급받은 뒤, 인게임에서 /login 코드를 입력해 관전 상태를 해제하세요.',
      openDashboard: '대시보드로 이동',
      createAnother: '다른 계정 만들기',
      startLogin: '로그인 시작',
      createNew: '새 계정 만들기',
      featureAccountTitle: '웹 계정 로그인',
      featureAccountBody: '이메일/비밀번호로 로그인해서 계정을 관리합니다.',
      featureCodeTitle: '게임 코드 발급',
      featureCodeBody: '대시보드에서 반영구 게임 로그인 코드를 재발급할 수 있습니다.',
      featureGameTitle: '인게임 인증',
      featureGameBody: '서버에서 /login 코드를 입력하면 플레이가 활성화됩니다.',
    },
    login: {
      eyebrow: 'WELCOME BACK',
      title: '로그인',
      subtitle: '등록된 이메일과 비밀번호로 로그인하세요.',
      email: '이메일',
      password: '비밀번호',
      submit: '로그인',
      success: '로그인 성공. 대시보드로 이동합니다.',
    },
    register: {
      eyebrow: 'CREATE ACCOUNT',
      title: '회원가입',
      subtitle: '대만 사용자는 바로 가입 가능, 해외 사용자는 초대코드가 필요합니다.',
      username: '아이디',
      email: '이메일',
      password: '비밀번호',
      invite: '초대코드 (해외 가입 시 필수)',
      invitePlaceholder: '8자리 코드',
      submit: '계정 생성',
      success: '회원가입 성공. 게임 코드: {code}',
    },
    dashboard: {
      eyebrow: 'ACCOUNT CONTROL CENTER',
      title: '계정 대시보드',
      lead: '게임 로그인 코드는 재발급 전까지 유효합니다.',
      accountTitle: '내 계정',
      inviteTitle: '초대 코드',
      inviteBody: '해외 유저 가입 시 이 코드를 공유하세요.',
      inviteUsage: '사용 {used} / {quota}',
      gameCodeTitle: '게임 로그인 코드',
      gameCodeBody: '코드는 기본적으로 가려져 있고, 눈 버튼으로 표시/숨김 전환할 수 있습니다.',
      rotate: '코드 재발급',
      rotating: '발급 중...',
      rotated: '새 게임 로그인 코드가 발급되었습니다.',
      newCodeHeader: '새 코드',
      newCodeInGame: '인게임',
      showCode: '코드 보기',
      hideCode: '코드 숨기기',
      copyCode: '코드 복사',
      copied: '코드가 복사되었습니다.',
      copyFailed: '복사에 실패했습니다.',
      noCurrentCode: '현재 표시할 코드가 없습니다. 코드 재발급을 한 번 진행해 주세요.',
      inGameTitle: '인게임 사용법',
      step1: 'DDNet 서버 접속',
      step2: '채팅창에 /login 발급코드 입력',
      step3: '인증 성공 시 관전 해제 후 플레이 가능',
      rowUserId: 'User ID',
      rowUsername: 'Username',
      rowEmail: 'Email',
      rowCountry: 'Signup Country',
      rowCreatedAt: 'Created At',
      rowCodeRotated: 'Code Rotated',
    },
    blocked: {
      eyebrow: 'ACCESS BLOCKED',
      title: '접속이 차단되었습니다',
      body: '현재 네트워크가 VPN/프록시로 감지되어 로그인 및 회원가입이 제한됩니다.',
    },
  },
  en: {
    topbar: { language: 'Language' },
    common: {
      home: 'Home',
      login: 'Login',
      register: 'Register',
      dashboard: 'Dashboard',
      logout: 'Logout',
      backHome: '← Back to Home',
      retry: 'Try Again',
      loadingSession: 'Checking session...',
      notLoggedInYet: "Don't have an account?",
      alreadyHaveAccount: 'Already have an account?',
      goToDashboard: 'Go to Dashboard',
      creating: 'Creating...',
      loggingIn: 'Signing in...',
    },
    home: {
      logoutDone: 'You have been logged out.',
      eyebrow: 'DDNET SERVER ACCESS',
      title: 'Web-authenticated DDNet access system',
      lead: 'Create an account, get a game login code, then enter /login CODE in game to unlock spectator mode.',
      openDashboard: 'Open Dashboard',
      createAnother: 'Create another account',
      startLogin: 'Start Login',
      createNew: 'Create account',
      featureAccountTitle: 'Web account login',
      featureAccountBody: 'Manage your account with email and password login.',
      featureCodeTitle: 'Game code issuing',
      featureCodeBody: 'Rotate your long-lived game login code from the dashboard.',
      featureGameTitle: 'In-game verification',
      featureGameBody: 'Enter /login CODE on the server to start playing.',
    },
    login: {
      eyebrow: 'WELCOME BACK',
      title: 'Login',
      subtitle: 'Sign in with your registered email and password.',
      email: 'Email',
      password: 'Password',
      submit: 'Login',
      success: 'Login successful. Redirecting to dashboard.',
    },
    register: {
      eyebrow: 'CREATE ACCOUNT',
      title: 'Register',
      subtitle: 'Taiwan users can sign up directly. Other countries require an invite code.',
      username: 'Username',
      email: 'Email',
      password: 'Password',
      invite: 'Invite code (required outside Taiwan)',
      invitePlaceholder: '8-character code',
      submit: 'Create account',
      success: 'Registration successful. Game code: {code}',
    },
    dashboard: {
      eyebrow: 'ACCOUNT CONTROL CENTER',
      title: 'Account Dashboard',
      lead: 'Your game login code stays valid until you rotate it.',
      accountTitle: 'My Account',
      inviteTitle: 'Invite Code',
      inviteBody: 'Share this code for non-Taiwan signups.',
      inviteUsage: 'Used {used} / {quota}',
      gameCodeTitle: 'Game Login Code',
      gameCodeBody: 'The code is masked by default. Use the eye button to show or hide it.',
      rotate: 'Reissue Code',
      rotating: 'Rotating...',
      rotated: 'A new game login code has been issued.',
      newCodeHeader: 'NEW CODE',
      newCodeInGame: 'In game',
      showCode: 'Show code',
      hideCode: 'Hide code',
      copyCode: 'Copy code',
      copied: 'Code copied.',
      copyFailed: 'Copy failed.',
      noCurrentCode: 'No current code is available. Reissue once first.',
      inGameTitle: 'In-Game Usage',
      step1: 'Join your DDNet server',
      step2: 'Type /login YOUR_CODE in chat',
      step3: 'On success, spectator lock is removed',
      rowUserId: 'User ID',
      rowUsername: 'Username',
      rowEmail: 'Email',
      rowCountry: 'Signup Country',
      rowCreatedAt: 'Created At',
      rowCodeRotated: 'Code Rotated',
    },
    blocked: {
      eyebrow: 'ACCESS BLOCKED',
      title: 'Access blocked',
      body: 'Your network is detected as VPN/proxy, so login and registration are restricted.',
    },
  },
  ja: {
    topbar: { language: '言語' },
    common: {
      home: 'ホーム',
      login: 'ログイン',
      register: '登録',
      dashboard: 'ダッシュボード',
      logout: 'ログアウト',
      backHome: '← ホームへ',
      retry: '再試行',
      loadingSession: 'セッションを確認中...',
      notLoggedInYet: 'アカウントをお持ちでないですか？',
      alreadyHaveAccount: 'すでにアカウントをお持ちですか？',
      goToDashboard: 'ダッシュボードへ',
      creating: '作成中...',
      loggingIn: 'ログイン中...',
    },
    home: {
      logoutDone: 'ログアウトしました。',
      eyebrow: 'DDNET SERVER ACCESS',
      title: 'Web認証ベースのDDNet入場システム',
      lead: 'アカウント作成後にゲームログインコードを発行し、ゲーム内で /login コード を入力して観戦ロックを解除します。',
      openDashboard: 'ダッシュボードへ',
      createAnother: '別アカウント作成',
      startLogin: 'ログイン開始',
      createNew: '新規登録',
      featureAccountTitle: 'Webアカウントログイン',
      featureAccountBody: 'メール/パスワードでログインしてアカウントを管理します。',
      featureCodeTitle: 'ゲームコード発行',
      featureCodeBody: 'ダッシュボードで長期有効なゲームログインコードを再発行できます。',
      featureGameTitle: 'ゲーム内認証',
      featureGameBody: 'サーバーで /login コード を入力するとプレイ可能になります。',
    },
    login: {
      eyebrow: 'WELCOME BACK',
      title: 'ログイン',
      subtitle: '登録済みメールアドレスとパスワードでログインしてください。',
      email: 'メールアドレス',
      password: 'パスワード',
      submit: 'ログイン',
      success: 'ログイン成功。ダッシュボードへ移動します。',
    },
    register: {
      eyebrow: 'CREATE ACCOUNT',
      title: '登録',
      subtitle: '台湾ユーザーは直接登録可能、その他の国は招待コードが必要です。',
      username: 'ユーザー名',
      email: 'メールアドレス',
      password: 'パスワード',
      invite: '招待コード（台湾以外は必須）',
      invitePlaceholder: '8文字コード',
      submit: 'アカウント作成',
      success: '登録成功。ゲームコード: {code}',
    },
    dashboard: {
      eyebrow: 'ACCOUNT CONTROL CENTER',
      title: 'アカウントダッシュボード',
      lead: 'ゲームログインコードは再発行するまで有効です。',
      accountTitle: 'アカウント情報',
      inviteTitle: '招待コード',
      inviteBody: '台湾以外の登録時にこのコードを共有してください。',
      inviteUsage: '使用 {used} / {quota}',
      gameCodeTitle: 'ゲームログインコード',
      gameCodeBody: 'コードは初期状態でマスク表示され、目のボタンで表示切替できます。',
      rotate: 'コード再発行',
      rotating: '発行中...',
      rotated: '新しいゲームログインコードを発行しました。',
      newCodeHeader: '新しいコード',
      newCodeInGame: 'ゲーム内',
      showCode: 'コードを表示',
      hideCode: 'コードを非表示',
      copyCode: 'コードをコピー',
      copied: 'コードをコピーしました。',
      copyFailed: 'コピーに失敗しました。',
      noCurrentCode: '表示できる現在のコードがありません。先に再発行してください。',
      inGameTitle: 'ゲーム内の使い方',
      step1: 'DDNetサーバーに接続',
      step2: 'チャットで /login 発行コード を入力',
      step3: '認証成功で観戦ロック解除',
      rowUserId: 'User ID',
      rowUsername: 'Username',
      rowEmail: 'Email',
      rowCountry: 'Signup Country',
      rowCreatedAt: 'Created At',
      rowCodeRotated: 'Code Rotated',
    },
    blocked: {
      eyebrow: 'ACCESS BLOCKED',
      title: 'アクセスがブロックされました',
      body: 'VPN/プロキシと判定されたため、ログインと登録は制限されています。',
    },
  },
};

function detectInitialLanguage() {
  if(typeof window === 'undefined') {
    return 'ko';
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if(saved && LANGUAGE_OPTIONS.some((x) => x.code === saved)) {
    return saved;
  }

  const browser = String(window.navigator.language || '').toLowerCase();
  if(browser.startsWith('zh-tw') || browser.startsWith('zh-hk')) return 'zh-TW';
  if(browser.startsWith('zh')) return 'zh-CN';
  if(browser.startsWith('ja')) return 'ja';
  if(browser.startsWith('en')) return 'en';
  return 'ko';
}

function lookupText(language, key) {
  const chunks = String(key).split('.');
  let value = translations[language];
  for(const chunk of chunks) {
    if(value && typeof value === 'object' && chunk in value) {
      value = value[chunk];
    } else {
      return null;
    }
  }
  return typeof value === 'string' ? value : null;
}

function applyParams(text, params) {
  let output = text;
  for(const [key, value] of Object.entries(params || {})) {
    output = output.replaceAll(`{${key}}`, String(value));
  }
  return output;
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(detectInitialLanguage);

  const setLanguage = (next) => {
    if(!LANGUAGE_OPTIONS.some((x) => x.code === next)) return;
    setLanguageState(next);
    if(typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  };

  const t = (key, params = {}) => {
    const chosen = lookupText(language, key);
    if(chosen) {
      return applyParams(chosen, params);
    }
    const fallback = lookupText('en', key);
    return applyParams(fallback || key, params);
  };

  const value = useMemo(() => ({
    language,
    setLanguage,
    languages: LANGUAGE_OPTIONS,
    locale: LOCALE_BY_LANGUAGE[language] || 'en-US',
    t,
  }), [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if(!ctx) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
 