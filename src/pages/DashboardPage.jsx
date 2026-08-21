import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  adminBanAccount,
  adminDeletePatreonTier,
  adminGetAbuseLinks,
  adminGetAbuseReviews,
  adminResolveAbuseReview,
  adminGetMapTargets,
  adminGetServerMaintenance,
  adminGrantSubscriptionMonths,
  adminGetPatreonTiers,
  adminListMapDeployJobs,
  adminRetryMapDeployJob,
  adminSearchUsers,
  adminCreateServerMaintenanceSchedule,
  adminCancelServerMaintenanceSchedule,
  adminSetServerMaintenance,
  adminUnbanAccount,
  adminUploadMap,
  adminUpsertPatreonTier,
  getAutoLoginSettings,
  getMySubscription,
  getTrailSettings,
  getCurrentDummyGameCode,
  getCurrentGameCode,
  resendEmailVerification,
  rotateDummyGameCode,
  rotateGameCode,
  updateTrailSettings,
  updateDummyProfileName,
  updateAutoLoginSettings,
  updateProfileDisplayName,
  updateProfileName,
  verifyEmailCode,
} from '../lib/api';
import { useAuth } from '../components/AuthProvider';
import { useI18n } from '../components/I18nProvider';
import { Feedback, TopBar } from '../components/Layout';
import Tooltip from '../components/Tooltip';
import iconEnvelope from '../assets/icons/icon-envelope.svg';
import iconUser from '../assets/icons/icon-user.svg';
import iconSiren from '../assets/icons/icon-siren.svg';
import iconKey from '../assets/icons/icon-key.svg';
import iconCloudUploadAlt from '../assets/icons/icon-cloud-upload-alt.svg';
import iconCreditCard from '../assets/icons/icon-credit-card.svg';

function maskEmail(value) {
  const email = String(value || '');
  const at = email.indexOf('@');
  if(at <= 0) {
    return '-';
  }

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if(!domain) {
    return '-';
  }

  const visibleCount = Math.min(3, local.length);
  const visible = local.slice(0, visibleCount);
  const hiddenLength = Math.max(1, local.length - visibleCount);
  return `${visible}${'*'.repeat(hiddenLength)}@${domain}`;
}

function formatDateTimePrecise(valueMs, locale) {
  if(!Number.isFinite(valueMs) || valueMs <= 0) {
    return '';
  }
  return new Intl.DateTimeFormat(locale || 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(valueMs));
}

function formatDateTimeShort(value, locale) {
  const valueMs = Date.parse(String(value || ''));
  if(!Number.isFinite(valueMs) || valueMs <= 0) {
    return '-';
  }
  return new Intl.DateTimeFormat(locale || 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(valueMs));
}

const MAINTENANCE_UI_TEXT = {
  en: {
    nav: 'Server Maintenance',
    title: 'Server Maintenance',
    body: 'Toggle maintenance per server, set allowlist IPs and block message, then push instantly.',
    server: 'Server',
    enabled: 'Maintenance Enabled',
    blockMessage: 'Block Message',
    allowIps: 'Allow IPs (semicolon separated)',
    refresh: 'Refresh',
    refreshing: 'Refreshing...',
    apply: 'Apply',
    applying: 'Applying...',
    result: 'Result',
    scheduleTitle: 'Maintenance Schedule',
    scheduleBody: 'Select one or more servers, choose a date and time, and maintenance can be planned from the dashboard.',
    servers: 'Servers',
    startDate: 'Start Date',
    startTime: 'Start Time',
    interval: 'Announcement interval (minutes)',
    scheduleBlockMessage: 'Schedule block message',
    scheduleAllowIps: 'Schedule allow IPs',
    saveSchedule: 'Save Schedule',
    scheduling: 'Scheduling...',
    serverStatus: 'Server Status',
    noRoutes: 'No maintenance server routes configured.',
    maintenanceOn: 'Maintenance ON',
    maintenanceOff: 'Maintenance OFF',
    pushConfigured: 'Push configured',
    pushNotConfigured: 'Push not configured',
    scheduledJobs: 'Scheduled Jobs',
    noSchedules: 'No maintenance schedules yet.',
    start: 'Start',
    activate: 'Activate',
    intervalShort: 'Interval',
    canceled: 'Canceled',
    active: 'Active',
    scheduled: 'Scheduled',
    cancel: 'Cancel',
    canceling: 'Canceling...',
    errSelectServer: 'Select a server first.',
    errSelectAtLeastOne: 'Select at least one server.',
    errDateTime: 'Set a valid date and time.',
    okUpdated: 'Maintenance settings updated.',
    okScheduled: 'Maintenance schedule saved.',
    okCanceled: 'Maintenance schedule canceled.',
  },
  'zh-TW': {
    nav: '伺服器維護',
    title: '伺服器維護',
    body: '可針對各伺服器切換維護模式、設定允許 IP 與封鎖訊息，並立即套用。',
    server: '伺服器',
    enabled: '維護模式',
    blockMessage: '封鎖訊息',
    allowIps: '允許 IP（以分號分隔）',
    refresh: '重新整理',
    refreshing: '重新整理中...',
    apply: '套用',
    applying: '套用中...',
    result: '結果',
    scheduleTitle: '維護排程',
    scheduleBody: '可選擇一個以上伺服器，設定日期與時間後由儀表板管理排程。',
    servers: '伺服器清單',
    startDate: '開始日期',
    startTime: '開始時間',
    interval: '公告間隔（分鐘）',
    scheduleBlockMessage: '排程封鎖訊息',
    scheduleAllowIps: '排程允許 IP',
    saveSchedule: '儲存排程',
    scheduling: '儲存中...',
    serverStatus: '伺服器狀態',
    noRoutes: '尚未設定維護伺服器路由。',
    maintenanceOn: '維護 ON',
    maintenanceOff: '維護 OFF',
    pushConfigured: '已設定推送',
    pushNotConfigured: '未設定推送',
    scheduledJobs: '排程列表',
    noSchedules: '目前沒有維護排程。',
    start: '開始',
    activate: '啟用',
    intervalShort: '間隔',
    canceled: '已取消',
    active: '啟用中',
    scheduled: '已排程',
    cancel: '取消',
    canceling: '取消中...',
    errSelectServer: '請先選擇伺服器。',
    errSelectAtLeastOne: '請至少選擇一個伺服器。',
    errDateTime: '請輸入有效的日期與時間。',
    okUpdated: '維護設定已更新。',
    okScheduled: '維護排程已儲存。',
    okCanceled: '維護排程已取消。',
  },
  'zh-CN': {
    nav: '服务器维护',
    title: '服务器维护',
    body: '可按服务器切换维护、设置允许 IP 与拦截消息，并立即应用。',
    server: '服务器',
    enabled: '维护模式',
    blockMessage: '拦截消息',
    allowIps: '允许 IP（分号分隔）',
    refresh: '刷新',
    refreshing: '刷新中...',
    apply: '应用',
    applying: '应用中...',
    result: '结果',
    scheduleTitle: '维护计划',
    scheduleBody: '可选择一个或多个服务器并设置日期时间，在仪表盘统一管理。',
    servers: '服务器列表',
    startDate: '开始日期',
    startTime: '开始时间',
    interval: '公告间隔（分钟）',
    scheduleBlockMessage: '计划拦截消息',
    scheduleAllowIps: '计划允许 IP',
    saveSchedule: '保存计划',
    scheduling: '保存中...',
    serverStatus: '服务器状态',
    noRoutes: '未配置维护服务器路由。',
    maintenanceOn: '维护 ON',
    maintenanceOff: '维护 OFF',
    pushConfigured: '已配置推送',
    pushNotConfigured: '未配置推送',
    scheduledJobs: '计划列表',
    noSchedules: '暂无维护计划。',
    start: '开始',
    activate: '启用',
    intervalShort: '间隔',
    canceled: '已取消',
    active: '进行中',
    scheduled: '已计划',
    cancel: '取消',
    canceling: '取消中...',
    errSelectServer: '请先选择服务器。',
    errSelectAtLeastOne: '请至少选择一个服务器。',
    errDateTime: '请设置有效的日期和时间。',
    okUpdated: '维护设置已更新。',
    okScheduled: '维护计划已保存。',
    okCanceled: '维护计划已取消。',
  },
  ko: {
    nav: '서버 점검',
    title: '서버 점검',
    body: '서버별 점검 토글, 허용 IP, 차단 메시지를 설정하고 즉시 적용할 수 있습니다.',
    server: '서버',
    enabled: '점검 모드',
    blockMessage: '차단 메시지',
    allowIps: '허용 IP (세미콜론 구분)',
    refresh: '새로고침',
    refreshing: '새로고침 중...',
    apply: '적용',
    applying: '적용 중...',
    result: '결과',
    scheduleTitle: '점검 예약',
    scheduleBody: '서버를 선택하고 날짜/시간을 지정해 대시보드에서 점검 일정을 등록할 수 있습니다.',
    servers: '서버 선택',
    startDate: '시작 날짜',
    startTime: '시작 시간',
    interval: '공지 간격(분)',
    scheduleBlockMessage: '예약 차단 메시지',
    scheduleAllowIps: '예약 허용 IP',
    saveSchedule: '예약 저장',
    scheduling: '예약 저장 중...',
    serverStatus: '서버 상태',
    noRoutes: '설정된 점검 서버 경로가 없습니다.',
    maintenanceOn: '점검 ON',
    maintenanceOff: '점검 OFF',
    pushConfigured: '푸시 설정됨',
    pushNotConfigured: '푸시 미설정',
    scheduledJobs: '예약 목록',
    noSchedules: '등록된 점검 예약이 없습니다.',
    start: '시작',
    activate: '활성화',
    intervalShort: '간격',
    canceled: '취소됨',
    active: '활성',
    scheduled: '예약됨',
    cancel: '취소',
    canceling: '취소 중...',
    errSelectServer: '먼저 서버를 선택해 주세요.',
    errSelectAtLeastOne: '최소 1개 서버를 선택해 주세요.',
    errDateTime: '유효한 날짜와 시간을 입력해 주세요.',
    okUpdated: '점검 설정이 업데이트되었습니다.',
    okScheduled: '점검 예약이 저장되었습니다.',
    okCanceled: '점검 예약이 취소되었습니다.',
  },
  ja: {
    nav: 'サーバーメンテナンス',
    title: 'サーバーメンテナンス',
    body: 'サーバーごとにメンテナンス切替、許可 IP、ブロックメッセージを設定して即時反映できます。',
    server: 'サーバー',
    enabled: 'メンテナンス有効',
    blockMessage: 'ブロックメッセージ',
    allowIps: '許可 IP（セミコロン区切り）',
    refresh: '更新',
    refreshing: '更新中...',
    apply: '適用',
    applying: '適用中...',
    result: '結果',
    scheduleTitle: 'メンテナンス予約',
    scheduleBody: 'サーバーを選択し、日付と時刻を指定してダッシュボードから予約できます。',
    servers: 'サーバー選択',
    startDate: '開始日',
    startTime: '開始時刻',
    interval: '告知間隔（分）',
    scheduleBlockMessage: '予約時ブロックメッセージ',
    scheduleAllowIps: '予約時許可 IP',
    saveSchedule: '予約を保存',
    scheduling: '保存中...',
    serverStatus: 'サーバー状態',
    noRoutes: 'メンテナンス対象サーバーの設定がありません。',
    maintenanceOn: 'メンテ ON',
    maintenanceOff: 'メンテ OFF',
    pushConfigured: 'Push 設定済み',
    pushNotConfigured: 'Push 未設定',
    scheduledJobs: '予約一覧',
    noSchedules: '予約はまだありません。',
    start: '開始',
    activate: '有効化',
    intervalShort: '間隔',
    canceled: 'キャンセル済み',
    active: '実行中',
    scheduled: '予約済み',
    cancel: 'キャンセル',
    canceling: 'キャンセル中...',
    errSelectServer: '先にサーバーを選択してください。',
    errSelectAtLeastOne: '少なくとも 1 台のサーバーを選択してください。',
    errDateTime: '有効な日付と時刻を設定してください。',
    okUpdated: 'メンテナンス設定を更新しました。',
    okScheduled: 'メンテナンス予約を保存しました。',
    okCanceled: 'メンテナンス予約をキャンセルしました。',
  },
};

function getMaintenanceUiText(locale) {
  const key = String(locale || '').toLowerCase();
  if(key.startsWith('zh-tw')) {
    return MAINTENANCE_UI_TEXT['zh-TW'];
  }
  if(key.startsWith('zh-cn')) {
    return MAINTENANCE_UI_TEXT['zh-CN'];
  }
  if(key.startsWith('ko')) {
    return MAINTENANCE_UI_TEXT.ko;
  }
  if(key.startsWith('ja')) {
    return MAINTENANCE_UI_TEXT.ja;
  }
  return MAINTENANCE_UI_TEXT.en;
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M12 5c5.6 0 9.6 4.9 10.7 6.4.4.5.4 1.2 0 1.7C21.6 14.6 17.6 19.5 12 19.5S2.4 14.6 1.3 13.1a1.45 1.45 0 0 1 0-1.7C2.4 9.9 6.4 5 12 5Zm0 2C7.9 7 4.7 10.2 3.4 12c1.3 1.8 4.5 5 8.6 5s7.3-3.2 8.6-5C19.3 10.2 16.1 7 12 7Zm0 2.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6Z" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="m2.7 2 19.3 19.3-1.4 1.4-3.1-3.1a12.88 12.88 0 0 1-5.5 1.3C6.4 21 2.4 16.1 1.3 14.6a1.45 1.45 0 0 1 0-1.7A19.5 19.5 0 0 1 7 7.8L1.3 2.1 2.7 2Zm9.3 5c4.1 0 7.3 3.2 8.6 5a15.38 15.38 0 0 1-4.5 3.8l-2.1-2.1a2.8 2.8 0 0 0-3.7-3.7L8.2 8a11.82 11.82 0 0 1 3.8-1Zm0 4a1 1 0 0 1 1 1c0 .2-.1.5-.2.7l-1.5-1.5c.2-.1.5-.2.7-.2Z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M8 3h10a2 2 0 0 1 2 2v12h-2V5H8V3ZM5 7h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm0 2v10h10V9H5Z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="M3 17.2V21h3.8l11-11.1-3.8-3.8L3 17.2Zm17.7-10.1a1 1 0 0 0 0-1.4l-2.4-2.4a1 1 0 0 0-1.4 0l-1.9 1.9 3.8 3.8 1.9-2Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="m9.1 16.6-4.2-4.2 1.4-1.4 2.8 2.8 8.6-8.6 1.4 1.4-10 10Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="m18.3 7.1-1.4-1.4L12 10.6 7.1 5.7 5.7 7.1l4.9 4.9-4.9 4.9 1.4 1.4 4.9-4.9 4.9 4.9 1.4-1.4-4.9-4.9 4.9-4.9Z" />
    </svg>
  );
}

function ToastCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-1.1 14.6-3.5-3.5 1.4-1.4 2.1 2.1 4.3-4.3 1.4 1.4Z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="M17 8h-1V6a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4V6Z" />
    </svg>
  );
}

export default function DashboardPage() {
  const { user, refresh, logout } = useAuth();
  const { t, locale } = useI18n();
  const maintenanceText = getMaintenanceUiText(locale);
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('account');
  const [feedback, setFeedback] = useState(null);
  const [gameCode, setGameCode] = useState('');
  const [dummyCode, setDummyCode] = useState('');
  const [loadingCode, setLoadingCode] = useState(true);
  const [loadingDummyCode, setLoadingDummyCode] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [dummyRevealed, setDummyRevealed] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [rotatingDummy, setRotatingDummy] = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);
  const [showDummyRotateConfirm, setShowDummyRotateConfirm] = useState(false);
  const [showDummyFirstIssue, setShowDummyFirstIssue] = useState(false);
  const [showNameConfirm, setShowNameConfirm] = useState(false);
  const [nameForm, setNameForm] = useState('');
  const [displayNameForm, setDisplayNameForm] = useState('');
  const [dummyNameForm, setDummyNameForm] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [editingDummyName, setEditingDummyName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [savingDummyName, setSavingDummyName] = useState(false);
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [showTrailSavedToast, setShowTrailSavedToast] = useState(false);
  const [showAutoLoginSavedToast, setShowAutoLoginSavedToast] = useState(false);
  const [showEmailVerifyModal, setShowEmailVerifyModal] = useState(false);
  const [verifyCodeInput, setVerifyCodeInput] = useState('');
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [verifyResending, setVerifyResending] = useState(false);
  const [verifyDeadlineMs, setVerifyDeadlineMs] = useState(0);
  const [verifyRemainingMs, setVerifyRemainingMs] = useState(0);
  const [verifyResendCooldownSec, setVerifyResendCooldownSec] = useState(0);
  const [showVerifySentToast, setShowVerifySentToast] = useState(false);
  const [adminSearchName, setAdminSearchName] = useState('');
  const [adminSelectedUser, setAdminSelectedUser] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminPickerOpen, setAdminPickerOpen] = useState(false);
  const [adminMinutes, setAdminMinutes] = useState('10');
  const [adminBanMode, setAdminBanMode] = useState('temporary');
  const [adminReasonPreset, setAdminReasonPreset] = useState('chat');
  const [adminReasonCustom, setAdminReasonCustom] = useState('');
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [showAdminBanConfirm, setShowAdminBanConfirm] = useState(false);
  const [abuseReviews, setAbuseReviews] = useState([]);
  const [abuseReviewsLoading, setAbuseReviewsLoading] = useState(false);
  const [abuseCase, setAbuseCase] = useState(null);
  const [abuseAccountId, setAbuseAccountId] = useState(0);
  const [abuseLinks, setAbuseLinks] = useState([]);
  const [abuseSharing, setAbuseSharing] = useState(null);
  const [abuseActivity, setAbuseActivity] = useState([]);
  const [abuseKindFilter, setAbuseKindFilter] = useState('all');
  const [abuseLinksLoading, setAbuseLinksLoading] = useState(false);
  const [abuseSearchName, setAbuseSearchName] = useState('');
  const [abusePickerOpen, setAbusePickerOpen] = useState(false);
  const [abuseBanIds, setAbuseBanIds] = useState([]);
  const [abuseNote, setAbuseNote] = useState('');
  const [abuseSubmitting, setAbuseSubmitting] = useState(false);
  const [adminGrantPlanKey, setAdminGrantPlanKey] = useState('starter');
  const [adminGrantMonths, setAdminGrantMonths] = useState('1');
  const [adminGrantReason, setAdminGrantReason] = useState('');
  const [adminGrantSubmitting, setAdminGrantSubmitting] = useState(false);
  const [showAdminGrantConfirm, setShowAdminGrantConfirm] = useState(false);
  const [adminPatreonTierId, setAdminPatreonTierId] = useState('');
  const [adminPatreonPlanKey, setAdminPatreonPlanKey] = useState('plus');
  const [adminPatreonTierTitle, setAdminPatreonTierTitle] = useState('');
  const [adminPatreonTierActive, setAdminPatreonTierActive] = useState(true);
  const [adminPatreonTiers, setAdminPatreonTiers] = useState([]);
  const [adminPatreonLoading, setAdminPatreonLoading] = useState(false);
  const [adminPatreonSubmitting, setAdminPatreonSubmitting] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [adminTrailEnabled, setAdminTrailEnabled] = useState(false);
  const [adminTrailMode, setAdminTrailMode] = useState(1);
  const [adminTrailExtraEnabled, setAdminTrailExtraEnabled] = useState(false);
  const [adminTrailExtraHook, setAdminTrailExtraHook] = useState(false);
  const [adminTrailExtraJump, setAdminTrailExtraJump] = useState(false);
  const [adminTrailExtraJetpack, setAdminTrailExtraJetpack] = useState(false);
  const [adminTrailLoading, setAdminTrailLoading] = useState(false);
  const [adminTrailSubmitting, setAdminTrailSubmitting] = useState(false);
  const [adminTrailMenuOpen, setAdminTrailMenuOpen] = useState(false);
  const [adminMapFile, setAdminMapFile] = useState(null);
  const [adminMapName, setAdminMapName] = useState('');
  const [adminMapCategory, setAdminMapCategory] = useState('Easy');
  const [adminMapStars, setAdminMapStars] = useState('1');
  const [adminMapPoints, setAdminMapPoints] = useState('0');
  const [adminMapAuthor, setAdminMapAuthor] = useState('');
  const [adminMapSourceLabel, setAdminMapSourceLabel] = useState('');
  const [adminMapNotes, setAdminMapNotes] = useState('');
  const [adminMapTargets, setAdminMapTargets] = useState([]);
  const [adminSelectedMapTargets, setAdminSelectedMapTargets] = useState([]);
  const [adminMapUploadSubmitting, setAdminMapUploadSubmitting] = useState(false);
  const [adminMapJobsLoading, setAdminMapJobsLoading] = useState(false);
  const [adminMapJobs, setAdminMapJobs] = useState([]);
  const [adminMapRetryingJobId, setAdminMapRetryingJobId] = useState(0);
  const [adminMaintenanceLoading, setAdminMaintenanceLoading] = useState(false);
  const [adminMaintenanceSubmitting, setAdminMaintenanceSubmitting] = useState(false);
  const [adminMaintenanceServers, setAdminMaintenanceServers] = useState([]);
  const [adminMaintenanceServerKey, setAdminMaintenanceServerKey] = useState('');
  const [adminMaintenanceEnabled, setAdminMaintenanceEnabled] = useState(false);
  const [adminMaintenanceMessage, setAdminMaintenanceMessage] = useState('');
  const [adminMaintenanceAllowIps, setAdminMaintenanceAllowIps] = useState('');
  const [adminMaintenanceLastPush, setAdminMaintenanceLastPush] = useState(null);
  const [adminMaintenanceSchedules, setAdminMaintenanceSchedules] = useState([]);
  const [adminMaintenanceScheduleServerKeys, setAdminMaintenanceScheduleServerKeys] = useState([]);
  const [adminMaintenanceScheduleDate, setAdminMaintenanceScheduleDate] = useState('');
  const [adminMaintenanceScheduleTime, setAdminMaintenanceScheduleTime] = useState('');
  const [adminMaintenanceScheduleInterval, setAdminMaintenanceScheduleInterval] = useState('5');
  const [adminMaintenanceScheduleMessage, setAdminMaintenanceScheduleMessage] = useState('');
  const [adminMaintenanceScheduleAllowIps, setAdminMaintenanceScheduleAllowIps] = useState('');
  const [adminMaintenanceScheduleSubmitting, setAdminMaintenanceScheduleSubmitting] = useState(false);
  const [adminMaintenanceCancelingScheduleId, setAdminMaintenanceCancelingScheduleId] = useState('');
  const [autoLoginEnabled, setAutoLoginEnabled] = useState(Number(user?.auto_login_enabled ?? 1) === 1);
  const [autoLoginStrict, setAutoLoginStrict] = useState(
    Number(user?.auto_login_enabled ?? 1) === 1 && Number(user?.auto_login_strict ?? 0) === 1,
  );
  const [autoLoginSaving, setAutoLoginSaving] = useState(false);
  const adminPickerRef = useRef(null);
  const abusePickerRef = useRef(null);
  const adminTrailMenuRef = useRef(null);
  const adminSearchInputRef = useRef(null);
  const abuseSearchInputRef = useRef(null);
  const adminUsersRequestIdRef = useRef(0);

  const currentName = String(user?.username || '');
  const currentDisplayName = String(user?.display_name || user?.username || '');
  const currentDummyName = String(user?.dummy_name || '');
  const emailVerified = Number(user?.email_verified || 0) === 1;
  const signupCountry = String(user?.country_signup || '').toUpperCase();
  const hasInviteCode = String(user?.invite_code || '').trim().length > 0;
  const trimmedName = nameForm.trim();
  const trimmedDisplayName = displayNameForm.trim();
  const trimmedDummyName = dummyNameForm.trim();
  const nameCooldownUntilRaw = String(user?.name_change_available_at || '');
  const nameCooldownUntilMs = nameCooldownUntilRaw ? Date.parse(nameCooldownUntilRaw) : NaN;
  const nameCooldownActive = Number.isFinite(nameCooldownUntilMs) && nameCooldownUntilMs > Date.now();
  const nameCooldownDaysLeft = nameCooldownActive
    ? Math.max(1, Math.floor((nameCooldownUntilMs - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;
  const dummyNameCooldownUntilRaw = String(user?.dummy_name_change_available_at || '');
  const dummyNameCooldownUntilMs = dummyNameCooldownUntilRaw ? Date.parse(dummyNameCooldownUntilRaw) : NaN;
  const dummyNameCooldownActive = Number.isFinite(dummyNameCooldownUntilMs) && dummyNameCooldownUntilMs > Date.now();
  const dummyNameCooldownDaysLeft = dummyNameCooldownActive
    ? Math.max(1, Math.floor((dummyNameCooldownUntilMs - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;
  const subscriptionStateLoading = subscriptionLoading;
  const plusActive = Boolean(subscriptionInfo?.benefits?.plusActive);
  const starterActive = plusActive || Boolean(subscriptionInfo?.benefits?.starterActive);
  const canSaveName = editingName && !savingName && trimmedName.length > 0 && trimmedName !== currentName;
  const canSaveDisplayName = editingDisplayName && !savingDisplayName && trimmedDisplayName.length > 0 && trimmedDisplayName !== currentDisplayName;
  const canSaveDummyName = editingDummyName && !dummyNameCooldownActive && !savingDummyName && trimmedDummyName.length > 0 && trimmedDummyName !== currentDummyName;
  const displayNameFeatureLocked = subscriptionStateLoading || !plusActive;
  const isDummyNameInputActive = editingDummyName || showDummyFirstIssue;
  const adminLevel = Number(user?.is_admin || 0);
  const isManager = Number.isFinite(adminLevel) && adminLevel >= 1;
  const isOperator = Number.isFinite(adminLevel) && adminLevel >= 2;
  const isAdminSection = activeSection === 'admin-ban' || activeSection === 'admin-abuse' || activeSection === 'admin-patreon' || activeSection === 'admin-plan-grant' || activeSection === 'admin-map-upload' || activeSection === 'admin-maintenance';
  const canUseInvite = signupCountry === 'TW' || signupCountry === 'KR' || plusActive || hasInviteCode;
  const trailFeatureLocked = subscriptionStateLoading || !plusActive;
  const plusSubscription = subscriptionInfo?.subscription || null;
  const starterSubscription = subscriptionInfo?.starterSubscription || null;
  const activeSubscription = plusActive ? plusSubscription : (starterActive ? starterSubscription : null);
  const currentPlanLabel = plusActive
    ? t('dashboard.subscriptionPlanPlus')
    : starterActive
      ? t('dashboard.subscriptionPlanStarter')
      : t('dashboard.subscriptionPlanNone');
  const currentPeriodEndRaw = String(activeSubscription?.current_period_end || '');
  const currentPeriodEndMs = currentPeriodEndRaw ? Date.parse(currentPeriodEndRaw) : NaN;
  const hasCurrentPeriodEnd = Number.isFinite(currentPeriodEndMs) && currentPeriodEndMs > 0;
  const remainingDays = hasCurrentPeriodEnd ? Math.max(0, Math.ceil((currentPeriodEndMs - Date.now()) / (24 * 60 * 60 * 1000))) : 0;
  const trailSectionLockedTooltip = subscriptionStateLoading
    ? t('dashboard.subscriptionTrailLoadingTooltip')
    : t('dashboard.subscriptionTrailLockedTooltip');
  const billingPageUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/billing/plans`
    : '/billing/plans';
  const verifyRemainingSeconds = Math.min(600, Math.max(0, Math.ceil(verifyRemainingMs / 1000)));
  const verifyTimerText = verifyRemainingSeconds > 0
    ? `${String(Math.floor(verifyRemainingSeconds / 60)).padStart(2, '0')}:${String(verifyRemainingSeconds % 60).padStart(2, '0')}`
    : '';
  const parsedMinutes = Number(adminMinutes);
  const renderAdminUserCell = (value) => {
    const text = String(value || '-');
    return (
      <Tooltip label={text}>
        <span className="admin-user-cell-text">{text}</span>
      </Tooltip>
    );
  };
  const temporaryMinutesValid = Number.isInteger(parsedMinutes) && parsedMinutes >= 1 && parsedMinutes <= 1440;
  const adminMinutesNum = adminBanMode === 'permanent' ? 0 : parsedMinutes;
  const parsedGrantMonths = Number(adminGrantMonths);
  const grantMonthsValid = Number.isInteger(parsedGrantMonths) && parsedGrantMonths >= 1 && parsedGrantMonths <= 24;
  const adminReasonValue = adminReasonPreset === 'custom'
    ? adminReasonCustom.trim()
    : adminReasonPreset;
  const trailModeOptions = [
    { value: 1, label: t('dashboard.subscriptionTrailMode1') },
    { value: 2, label: t('dashboard.subscriptionTrailMode2') },
    { value: 3, label: t('dashboard.subscriptionTrailMode3') },
  ];
  const mapCategoryOptions = ['Easy', 'Main', 'Hard', 'Insane', 'Extreme', 'Mod', 'Unknown'];
  const mapDeployStatusLabel = (status) => {
    switch(String(status || '')) {
    case 'queued':
      return t('dashboard.adminMapStatusQueued');
    case 'copying_map':
      return t('dashboard.adminMapStatusCopyingMap');
    case 'updating_config':
      return t('dashboard.adminMapStatusUpdatingConfig');
    case 'generating_votes':
      return t('dashboard.adminMapStatusGeneratingVotes');
    case 'syncing_database':
      return t('dashboard.adminMapStatusSyncingDatabase');
    case 'completed':
      return t('dashboard.adminMapStatusCompleted');
    case 'failed':
      return t('dashboard.adminMapStatusFailed');
    case 'running':
      return t('dashboard.adminMapJobRunning');
    default:
      return String(status || '-');
    }
  };
  const mapDeployStatusClass = (status) => {
    switch(String(status || '')) {
    case 'completed':
      return 'status-text status-normal';
    case 'failed':
      return 'status-text status-permanent';
    default:
      return 'status-text status-temporary';
    }
  };
  const currentTrailModeLabel = trailModeOptions.find((entry) => entry.value === adminTrailMode)?.label || trailModeOptions[0].label;
  const trailModeDisabled = trailFeatureLocked || !adminTrailEnabled || adminTrailLoading || adminTrailSubmitting;
  const trailExtraDisabled = trailFeatureLocked || !adminTrailExtraEnabled || adminTrailLoading || adminTrailSubmitting;
  const refreshAdminUsers = async () => {
    const requestId = ++adminUsersRequestIdRef.current;
    setAdminUsersLoading(true);
    try {
      const result = await adminSearchUsers('');
      if(requestId === adminUsersRequestIdRef.current) {
        setAdminUsers(Array.isArray(result?.users) ? result.users : []);
      }
    } catch (err) {
      if(requestId === adminUsersRequestIdRef.current) {
        setAdminUsers([]);
        setFeedback({ type: 'error', message: err.message });
      }
    } finally {
      if(requestId === adminUsersRequestIdRef.current) {
        setAdminUsersLoading(false);
      }
    }
  };

  const refreshAbuseReviews = async (kind = abuseKindFilter) => {
    setAbuseReviewsLoading(true);
    try {
      const result = await adminGetAbuseReviews('open', kind);
      setAbuseReviews(Array.isArray(result?.reviews) ? result.reviews : []);
    } catch {
      setAbuseReviews([]);
    } finally {
      setAbuseReviewsLoading(false);
    }
  };

  const loadAbuseLinks = async (accountId) => {
    const id = Number(accountId || 0);
    if(!Number.isFinite(id) || id <= 0) {
      return;
    }
    setAbuseLinksLoading(true);
    setAbuseAccountId(id);
    try {
      const result = await adminGetAbuseLinks(id);
      setAbuseLinks(Array.isArray(result?.links) ? result.links : []);
      setAbuseSharing(result?.sharing || null);
      setAbuseActivity(Array.isArray(result?.activity) ? result.activity : []);
    } catch {
      setAbuseLinks([]);
      setAbuseSharing(null);
      setAbuseActivity([]);
    } finally {
      setAbuseLinksLoading(false);
    }
  };

  const openAbuseCase = async (review) => {
    setAbuseCase(review || null);
    setAbuseNote('');
    // The flagged account is preselected because it is the one the case is
    // about; the account it was linked to is usually already banned.
    setAbuseBanIds(review ? [Number(review.accountId)] : []);
    setAbuseSearchName(review ? String(review.accountName || review.accountId) : '');
    setAbusePickerOpen(false);
    await loadAbuseLinks(review?.accountId);
  };

  const onAbusePickUser = async (entry) => {
    setAbuseSearchName(String(entry?.username || ''));
    setAbusePickerOpen(false);
    blurAbusePickerFocus();
    setAbuseCase(null);
    setAbuseBanIds([]);
    await loadAbuseLinks(entry?.id);
  };

  const toggleAbuseBanId = (accountId) => {
    const id = Number(accountId || 0);
    setAbuseBanIds((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));
  };

  const onAbuseResolve = async (action) => {
    if(!abuseCase || abuseSubmitting) {
      return;
    }
    setAbuseSubmitting(true);
    setFeedback(null);
    try {
      const result = await adminResolveAbuseReview({
        reviewId: abuseCase.id,
        action,
        note: abuseNote.trim(),
        banAccountIds: action === 'confirm' ? abuseBanIds : [],
        minutes: 0,
      });
      const bannedCount = Array.isArray(result?.banned) ? result.banned.length : 0;
      setFeedback({ type: 'ok', message: t('dashboard.adminAbuseResolved', { count: bannedCount }) });
      setAbuseCase(null);
      setAbuseBanIds([]);
      setAbuseNote('');
      await refreshAbuseReviews();
      if(abuseAccountId > 0) {
        await loadAbuseLinks(abuseAccountId);
      }
    } catch(err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setAbuseSubmitting(false);
    }
  };

  const refreshAdminPatreonTiers = async () => {
    setAdminPatreonLoading(true);
    try {
      const result = await adminGetPatreonTiers();
      setAdminPatreonTiers(Array.isArray(result?.tiers) ? result.tiers : []);
    } catch (err) {
      setAdminPatreonTiers([]);
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setAdminPatreonLoading(false);
    }
  };

  const refreshAdminMapTargets = async () => {
    try {
      const result = await adminGetMapTargets();
      const targets = Array.isArray(result?.targets) ? result.targets : [];
      setAdminMapTargets(targets);
      setAdminSelectedMapTargets((prev) => {
        if(prev.length > 0) {
          return prev.filter((entry) => targets.some((target) => target.key === entry));
        }
        return targets.map((entry) => String(entry.key || ''));
      });
    } catch (err) {
      setAdminMapTargets([]);
      setAdminSelectedMapTargets([]);
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const refreshAdminMapJobs = async ({ silent = false } = {}) => {
    if(!silent) {
      setAdminMapJobsLoading(true);
    }
    try {
      const result = await adminListMapDeployJobs();
      setAdminMapJobs(Array.isArray(result?.jobs) ? result.jobs : []);
    } catch (err) {
      setAdminMapJobs([]);
      if(!silent) {
        setFeedback({ type: 'error', message: err.message });
      }
    } finally {
      if(!silent) {
        setAdminMapJobsLoading(false);
      }
    }
  };

  const refreshSubscriptionInfo = async ({ silent = false } = {}) => {
    if(!silent) {
      setSubscriptionLoading(true);
    }
    try {
      const result = await getMySubscription();
      setSubscriptionInfo(result || null);
      if(result?.benefits?.plusActive && !String(user?.invite_code || '').trim()) {
        await refresh({ silent: true });
      }
    } catch (err) {
      if(!silent) {
        setFeedback({ type: 'error', message: err.message });
      }
    } finally {
      if(!silent) {
        setSubscriptionLoading(false);
      }
    }
  };

  useEffect(() => {
    if(!isManager && isAdminSection) {
      setActiveSection('account');
    }
  }, [isManager, isAdminSection]);

  useEffect(() => {
    if(!isOperator && (activeSection === 'admin-patreon' || activeSection === 'admin-plan-grant' || activeSection === 'admin-map-upload' || activeSection === 'admin-maintenance')) {
      setActiveSection(isManager ? 'admin-ban' : 'account');
    }
  }, [isOperator, isManager, activeSection]);

  useEffect(() => {
    refreshSubscriptionInfo();
  }, []);

  useEffect(() => {
    if(!plusActive && activeSection === 'subscription-trail') {
      setActiveSection('subscription');
    }
  }, [plusActive, activeSection]);

  useEffect(() => {
    if(!isManager || (activeSection !== 'admin-ban' && activeSection !== 'admin-plan-grant' && activeSection !== 'admin-map-upload' && activeSection !== 'admin-maintenance')) {
      setAdminPickerOpen(false);
      adminUsersRequestIdRef.current += 1;
      return undefined;
    }
    refreshAdminUsers();
    return () => {
      adminUsersRequestIdRef.current += 1;
    };
  }, [isManager, isOperator, activeSection]);

  useEffect(() => {
    if(!isOperator || activeSection !== 'admin-patreon') {
      return;
    }
    refreshAdminPatreonTiers();
  }, [isOperator, activeSection]);

  const refreshTrailSettings = async () => {
    setAdminTrailLoading(true);
    try {
      const result = await getTrailSettings();
      const enabled = Boolean(result?.trailEnabled);
      const modeRaw = Number(result?.trailMode || 1);
      const normalizedMode = Number.isFinite(modeRaw) && modeRaw >= 1 && modeRaw <= 3 ? Math.floor(modeRaw) : 1;
      const extraEnabled = Boolean(result?.extraEnabled);
      const extraHook = Boolean(result?.extraEndlessHook);
      const extraJump = Boolean(result?.extraEndlessJump);
      const extraJetpack = Boolean(result?.extraJetpack);
      setAdminTrailEnabled(enabled);
      setAdminTrailMode(normalizedMode);
      setAdminTrailExtraEnabled(extraEnabled);
      setAdminTrailExtraHook(extraHook);
      setAdminTrailExtraJump(extraJump);
      setAdminTrailExtraJetpack(extraJetpack);
    } catch (err) {
      setAdminTrailEnabled(false);
      setAdminTrailMode(1);
      setAdminTrailExtraEnabled(false);
      setAdminTrailExtraHook(false);
      setAdminTrailExtraJump(false);
      setAdminTrailExtraJetpack(false);
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setAdminTrailLoading(false);
    }
  };

  const refreshAutoLoginSettings = async ({ silent = false } = {}) => {
    try {
      const result = await getAutoLoginSettings();
      const settings = result?.settings || {};
      const enabled = Number(settings.enabled || 0) === 1;
      const strict = enabled && Number(settings.strict || 0) === 1;
      setAutoLoginEnabled(enabled);
      setAutoLoginStrict(strict);
    } catch (err) {
      if(!silent) {
        setFeedback({ type: 'error', message: err.message || t('dashboard.autoLoginSaveFailed') });
      }
    }
  };

  useEffect(() => {
    const enabled = Number(user?.auto_login_enabled ?? 1) === 1;
    const strict = enabled && Number(user?.auto_login_strict ?? 0) === 1;
    setAutoLoginEnabled(enabled);
    setAutoLoginStrict(strict);
  }, [user?.auto_login_enabled, user?.auto_login_strict]);

  useEffect(() => {
    if(activeSection !== 'subscription-trail') {
      setAdminTrailMenuOpen(false);
      return;
    }
    refreshTrailSettings();
  }, [activeSection]);

  useEffect(() => {
    if(activeSection !== 'codes') {
      return;
    }
    refreshAutoLoginSettings({ silent: true });
  }, [activeSection]);

  useEffect(() => {
    if(!isOperator || activeSection !== 'admin-map-upload') {
      return;
    }
    refreshAdminMapTargets();
    refreshAdminMapJobs();
  }, [isOperator, activeSection]);

  useEffect(() => {
    if(!isOperator || activeSection !== 'admin-map-upload') {
      return undefined;
    }
    const timer = window.setInterval(() => {
      refreshAdminMapJobs({ silent: true });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [isOperator, activeSection]);

  const refreshAdminMaintenance = async () => {
    setAdminMaintenanceLoading(true);
    try {
      const result = await adminGetServerMaintenance();
      const servers = Array.isArray(result?.servers) ? result.servers : [];
      setAdminMaintenanceServers(servers);
      const schedules = Array.isArray(result?.schedules) ? result.schedules : [];
      setAdminMaintenanceSchedules(schedules);

      const selectedKey = String(adminMaintenanceServerKey || '');
      const selectedServer = servers.find((entry) => String(entry?.key || '') === selectedKey) || servers[0] || null;
      const nextKey = String(selectedServer?.key || '');
      setAdminMaintenanceServerKey(nextKey);
      setAdminMaintenanceEnabled(Boolean(selectedServer?.enabled));
      setAdminMaintenanceMessage(String(selectedServer?.blockMessage || 'Server is under maintenance.'));
      setAdminMaintenanceAllowIps(String(selectedServer?.allowIpsRaw || ''));
      setAdminMaintenanceScheduleMessage((prev) => String(prev || selectedServer?.blockMessage || 'Server is under maintenance.'));
      setAdminMaintenanceScheduleAllowIps((prev) => String(prev || selectedServer?.allowIpsRaw || ''));

      const nextScheduleServerKeys = adminMaintenanceScheduleServerKeys.filter((key) => servers.some((entry) => String(entry?.key || '') === String(key || '')));
      setAdminMaintenanceScheduleServerKeys(nextScheduleServerKeys.length > 0 ? nextScheduleServerKeys : (nextKey ? [nextKey] : []));

      if(!adminMaintenanceScheduleDate && !adminMaintenanceScheduleTime && schedules.length > 0) {
        const firstScheduleStart = String(schedules[0]?.startAt || '');
        const startMs = Date.parse(firstScheduleStart);
        if(Number.isFinite(startMs) && startMs > 0) {
          const local = new Date(startMs);
          const yyyy = local.getFullYear();
          const mm = String(local.getMonth() + 1).padStart(2, '0');
          const dd = String(local.getDate()).padStart(2, '0');
          const hh = String(local.getHours()).padStart(2, '0');
          const min = String(local.getMinutes()).padStart(2, '0');
          setAdminMaintenanceScheduleDate(`${yyyy}-${mm}-${dd}`);
          setAdminMaintenanceScheduleTime(`${hh}:${min}`);
        }
      }
    } catch (err) {
      setAdminMaintenanceServers([]);
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setAdminMaintenanceLoading(false);
    }
  };

  useEffect(() => {
    if(!isOperator || activeSection !== 'admin-maintenance') {
      return;
    }
    refreshAdminMaintenance();
  }, [isOperator, activeSection]);

  useEffect(() => {
    if(activeSection !== 'admin-maintenance') {
      return;
    }
    const selectedServer = adminMaintenanceServers.find((entry) => String(entry?.key || '') === String(adminMaintenanceServerKey || ''));
    if(!selectedServer) {
      return;
    }
    setAdminMaintenanceEnabled(Boolean(selectedServer?.enabled));
    setAdminMaintenanceMessage(String(selectedServer?.blockMessage || 'Server is under maintenance.'));
    setAdminMaintenanceAllowIps(String(selectedServer?.allowIpsRaw || ''));
  }, [activeSection, adminMaintenanceServerKey, adminMaintenanceServers]);

  const onAdminMaintenanceApply = async () => {
    const serverKey = String(adminMaintenanceServerKey || '').trim();
    if(!serverKey) {
      setFeedback({ type: 'error', message: maintenanceText.errSelectServer });
      return;
    }

    setAdminMaintenanceSubmitting(true);
    setFeedback(null);
    try {
      const result = await adminSetServerMaintenance({
        serverKey,
        enabled: adminMaintenanceEnabled ? 1 : 0,
        blockMessage: String(adminMaintenanceMessage || '').trim(),
        allowIpsRaw: String(adminMaintenanceAllowIps || ''),
      });
      setAdminMaintenanceLastPush(result || null);
      if(result && result.ok === false) {
        setFeedback({ type: 'error', message: `Saved, but push failed: ${String(result.message || 'unknown error')}` });
      } else {
        setFeedback({ type: 'ok', message: maintenanceText.okUpdated });
      }
      await refreshAdminMaintenance();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setAdminMaintenanceSubmitting(false);
    }
  };

  const buildAdminMaintenanceScheduleStartAt = () => {
    const date = String(adminMaintenanceScheduleDate || '').trim();
    const time = String(adminMaintenanceScheduleTime || '').trim();
    if(!date || !time) {
      return '';
    }
    const startAt = new Date(`${date}T${time}`);
    if(Number.isNaN(startAt.getTime())) {
      return '';
    }
    return startAt.toISOString();
  };

  const onAdminMaintenanceScheduleApply = async () => {
    const serverKeys = Array.isArray(adminMaintenanceScheduleServerKeys)
      ? adminMaintenanceScheduleServerKeys.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [];
    if(serverKeys.length === 0) {
      setFeedback({ type: 'error', message: maintenanceText.errSelectAtLeastOne });
      return;
    }

    const startAt = buildAdminMaintenanceScheduleStartAt();
    if(!startAt) {
      setFeedback({ type: 'error', message: maintenanceText.errDateTime });
      return;
    }

    setAdminMaintenanceScheduleSubmitting(true);
    setFeedback(null);
    try {
      await adminCreateServerMaintenanceSchedule({
        serverKeys,
        startAt,
        announcementIntervalMinutes: Number(adminMaintenanceScheduleInterval || 5),
        blockMessage: String(adminMaintenanceScheduleMessage || adminMaintenanceMessage || '').trim(),
        allowIpsRaw: String(adminMaintenanceScheduleAllowIps || adminMaintenanceAllowIps || '').trim(),
      });
      setFeedback({ type: 'ok', message: maintenanceText.okScheduled });
      await refreshAdminMaintenance();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setAdminMaintenanceScheduleSubmitting(false);
    }
  };

  const onAdminMaintenanceCancelSchedule = async (schedule) => {
    const scheduleId = String(schedule?.id || '').trim();
    const serverKey = String(schedule?.serverKey || schedule?.server_key || '').trim();
    if(!scheduleId || !serverKey) {
      return;
    }
    setAdminMaintenanceCancelingScheduleId(scheduleId);
    setFeedback(null);
    try {
      await adminCancelServerMaintenanceSchedule({ serverKey, scheduleId });
      setFeedback({ type: 'ok', message: maintenanceText.okCanceled });
      await refreshAdminMaintenance();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setAdminMaintenanceCancelingScheduleId('');
    }
  };

  useEffect(() => {
    if(!adminTrailMenuOpen) {
      return undefined;
    }
    const onMouseDown = (event) => {
      if(!adminTrailMenuRef.current || adminTrailMenuRef.current.contains(event.target)) {
        return;
      }
      setAdminTrailMenuOpen(false);
    };
    const onKeyDown = (event) => {
      if(event.key === 'Escape') {
        setAdminTrailMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [adminTrailMenuOpen]);

  useEffect(() => {
    if(trailModeDisabled && adminTrailMenuOpen) {
      setAdminTrailMenuOpen(false);
    }
  }, [trailModeDisabled, adminTrailMenuOpen]);

  useEffect(() => {
    if(!isManager || (activeSection !== 'admin-ban' && activeSection !== 'admin-plan-grant' && activeSection !== 'admin-map-upload' && activeSection !== 'admin-maintenance') || !adminPickerOpen) {
      return;
    }
    refreshAdminUsers();
  }, [isManager, activeSection, adminPickerOpen]);

  useEffect(() => {
    setAdminBanMode('temporary');
  }, [adminSelectedUser?.id, activeSection]);

  useEffect(() => {
    if(!isManager || activeSection !== 'admin-abuse') {
      return;
    }
    refreshAbuseReviews(abuseKindFilter);
  }, [isManager, activeSection, abuseKindFilter]);

  useEffect(() => {
    if(!isManager || activeSection !== 'admin-abuse' || !abusePickerOpen) {
      return;
    }
    refreshAdminUsers();
  }, [isManager, activeSection, abusePickerOpen]);

  useEffect(() => {
    if(!abusePickerOpen) {
      return undefined;
    }
    const onMouseDown = (event) => {
      if(!abusePickerRef.current || abusePickerRef.current.contains(event.target)) {
        return;
      }
      setAbusePickerOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [abusePickerOpen]);

  useEffect(() => {
    setAdminGrantPlanKey('starter');
    setAdminGrantMonths('1');
    setAdminGrantReason('');
  }, [adminSelectedUser?.id, activeSection]);

  useEffect(() => {
    if(!adminPickerOpen) {
      return undefined;
    }
    const onMouseDown = (event) => {
      if(!adminPickerRef.current || adminPickerRef.current.contains(event.target)) {
        return;
      }
      setAdminPickerOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [adminPickerOpen]);

  useEffect(() => {
    setNameForm(currentName);
    setEditingName(false);
  }, [currentName]);

  useEffect(() => {
    setDisplayNameForm(currentDisplayName);
    setEditingDisplayName(false);
  }, [currentDisplayName]);

  useEffect(() => {
    setDummyNameForm(currentDummyName);
    setEditingDummyName(false);
  }, [currentDummyName]);

  useEffect(() => {
    if(nameCooldownActive && editingName) {
      setEditingName(false);
      setShowNameConfirm(false);
    }
  }, [nameCooldownActive, editingName]);

  useEffect(() => {
    if(dummyNameCooldownActive && editingDummyName) {
      setEditingDummyName(false);
    }
  }, [dummyNameCooldownActive, editingDummyName]);

  useEffect(() => {
    if(!showCopyToast) {
      return undefined;
    }
    const timer = setTimeout(() => setShowCopyToast(false), 1800);
    return () => clearTimeout(timer);
  }, [showCopyToast]);

  useEffect(() => {
    if(!showTrailSavedToast) {
      return undefined;
    }
    const timer = setTimeout(() => setShowTrailSavedToast(false), 1800);
    return () => clearTimeout(timer);
  }, [showTrailSavedToast]);

  useEffect(() => {
    if(!showAutoLoginSavedToast) {
      return undefined;
    }
    const timer = setTimeout(() => setShowAutoLoginSavedToast(false), 1800);
    return () => clearTimeout(timer);
  }, [showAutoLoginSavedToast]);

  useEffect(() => {
    if(!showVerifySentToast) {
      return undefined;
    }
    const timer = setTimeout(() => setShowVerifySentToast(false), 1800);
    return () => clearTimeout(timer);
  }, [showVerifySentToast]);

  useEffect(() => {
    if(!showEmailVerifyModal) {
      return undefined;
    }
    let disposed = false;
    const autoSend = async () => {
      try {
        const data = await resendEmailVerification({ auto: true });
        if(disposed) return;
        const nextDeadline = Date.parse(String(data?.expiresAt || ''));
        if(Number.isFinite(nextDeadline) && nextDeadline > Date.now()) {
          setVerifyDeadlineMs(nextDeadline);
        }
      } catch (err) {
        if(disposed) return;
        const nextDeadline = Date.parse(String(err?.payload?.expiresAt || ''));
        if(Number.isFinite(nextDeadline) && nextDeadline > Date.now()) {
          setVerifyDeadlineMs(nextDeadline);
        }
        setFeedback({ type: 'error', message: err?.message || 'Verification email send failed' });
      }
    };
    autoSend();
    return () => {
      disposed = true;
    };
  }, [showEmailVerifyModal]);

  useEffect(() => {
    if(!showEmailVerifyModal || !verifyDeadlineMs || verifyDeadlineMs <= Date.now()) {
      setVerifyRemainingMs(0);
      return undefined;
    }
    const update = () => {
      setVerifyRemainingMs(Math.max(0, verifyDeadlineMs - Date.now()));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [showEmailVerifyModal, verifyDeadlineMs]);

  useEffect(() => {
    if(!showEmailVerifyModal || verifyResendCooldownSec <= 0) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setVerifyResendCooldownSec((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [showEmailVerifyModal, verifyResendCooldownSec]);

  const executeRotate = async () => {
    setFeedback(null);
    setRotating(true);
    try {
      const result = await rotateGameCode();
      setGameCode(result.code || '');
      setRevealed(true);
      await refresh();
      setFeedback({ type: 'ok', message: t('dashboard.rotated') });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setRotating(false);
    }
  };

  const executeDummyRotate = async (firstDummyName = '') => {
    setFeedback(null);
    setRotatingDummy(true);
    try {
      const result = await rotateDummyGameCode(firstDummyName ? { name: firstDummyName } : {});
      setDummyCode(result.code || '');
      setDummyRevealed(true);
      await refresh();
      setFeedback({ type: 'ok', message: t('dashboard.dummyRotated') });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setRotatingDummy(false);
    }
  };

  const onRotateClick = () => {
    if(!emailVerified) {
      return;
    }
    if(rotating || loadingCode) {
      return;
    }

    if(gameCode) {
      setShowRotateConfirm(true);
      return;
    }

    executeRotate();
  };

  const onDummyRotateClick = () => {
    if(!emailVerified) {
      return;
    }
    if(rotatingDummy || loadingDummyCode) {
      return;
    }

    if(dummyCode) {
      setShowDummyRotateConfirm(true);
      return;
    }

    setDummyNameForm(currentDummyName || '');
    setShowDummyFirstIssue(true);
  };

  useEffect(() => {
    let canceled = false;
    const loadCurrentCode = async (reportError = true) => {
      setLoadingCode(true);
      try {
        const data = await getCurrentGameCode();
        if(!canceled) {
          setGameCode(String(data.code || ''));
        }
      } catch (err) {
        if(!canceled && reportError) {
          setFeedback({ type: 'error', message: err.message });
        }
      } finally {
        if(!canceled) {
          setLoadingCode(false);
        }
      }
    };
    const loadCurrentDummyCode = async (reportError = true) => {
      setLoadingDummyCode(true);
      try {
        const data = await getCurrentDummyGameCode();
        if(!canceled) {
          setDummyCode(String(data.code || ''));
          if(!isDummyNameInputActive && typeof data.dummyName === 'string') {
            setDummyNameForm(data.dummyName);
          }
        }
      } catch (err) {
        if(!canceled && reportError) {
          setFeedback({ type: 'error', message: err.message });
        }
      } finally {
        if(!canceled) {
          setLoadingDummyCode(false);
        }
      }
    };
    loadCurrentCode(true);
    loadCurrentDummyCode(true);
    return () => {
      canceled = true;
    };
  }, [isDummyNameInputActive]);

  const onCopyCode = async () => {
    if(!gameCode) {
      return;
    }
    try {
      await navigator.clipboard.writeText(gameCode);
      setShowCopyToast(false);
      requestAnimationFrame(() => setShowCopyToast(true));
    } catch {
      setFeedback({ type: 'error', message: t('dashboard.copyFailed') });
    }
  };

  const saveAutoLoginSettings = async (enabled, strict) => {
    if(autoLoginSaving) {
      return;
    }
    setAutoLoginSaving(true);
    setFeedback(null);
    try {
      const response = await updateAutoLoginSettings({
        enabled: enabled ? 1 : 0,
        strict: enabled && strict ? 1 : 0,
      });
      const settings = response?.settings || {};
      const nextEnabled = Number(settings.enabled || 0) === 1;
      const nextStrict = nextEnabled && Number(settings.strict || 0) === 1;
      setAutoLoginEnabled(nextEnabled);
      setAutoLoginStrict(nextStrict);
      setShowAutoLoginSavedToast(false);
      requestAnimationFrame(() => setShowAutoLoginSavedToast(true));
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || t('dashboard.autoLoginSaveFailed') });
    } finally {
      setAutoLoginSaving(false);
    }
  };

  const onToggleAutoLoginEnabled = () => {
    if(autoLoginSaving) {
      return;
    }
    const nextEnabled = !autoLoginEnabled;
    const nextStrict = nextEnabled ? autoLoginStrict : false;
    setAutoLoginEnabled(nextEnabled);
    setAutoLoginStrict(nextStrict);
    saveAutoLoginSettings(nextEnabled, nextStrict);
  };

  const onToggleAutoLoginStrict = () => {
    if(autoLoginSaving || !autoLoginEnabled) {
      return;
    }
    const nextStrict = !autoLoginStrict;
    setAutoLoginStrict(nextStrict);
    saveAutoLoginSettings(true, nextStrict);
  };

  const saveName = async () => {
    if(!canSaveName) {
      return;
    }
    setSavingName(true);
    setFeedback(null);
    try {
      await updateProfileName({ name: trimmedName });
      await refresh();
      setEditingName(false);
      setFeedback({ type: 'ok', message: t('dashboard.nameUpdated') });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSavingName(false);
    }
  };

  const saveDisplayName = async () => {
    if(!canSaveDisplayName) {
      return;
    }
    setSavingDisplayName(true);
    setFeedback(null);
    try {
      await updateProfileDisplayName({ displayName: trimmedDisplayName });
      await refresh();
      setEditingDisplayName(false);
      setFeedback({ type: 'ok', message: t('dashboard.displayNameUpdated') });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSavingDisplayName(false);
    }
  };

  const onNameAction = () => {
    if(!emailVerified) {
      return;
    }
    if(editingName) {
      if(canSaveName) {
        setShowNameConfirm(true);
      }
      return;
    }
    if(nameCooldownActive) {
      return;
    }
    setNameForm(currentName);
    setEditingName(true);
  };

  const onCancelNameEdit = () => {
    setNameForm(currentName);
    setEditingName(false);
  };

  const onDisplayNameAction = () => {
    if(!emailVerified) {
      return;
    }
    if(displayNameFeatureLocked) {
      return;
    }
    if(editingDisplayName) {
      if(canSaveDisplayName) {
        saveDisplayName();
      }
      return;
    }
    setDisplayNameForm(currentDisplayName);
    setEditingDisplayName(true);
  };

  const onCancelDisplayNameEdit = () => {
    setDisplayNameForm(currentDisplayName);
    setEditingDisplayName(false);
  };

  const onDummyNameAction = () => {
    if(!emailVerified) {
      return;
    }
    if(editingDummyName) {
      if(canSaveDummyName) {
        saveDummyName();
      }
      return;
    }
    if(dummyNameCooldownActive) {
      return;
    }
    setDummyNameForm(currentDummyName);
    setEditingDummyName(true);
  };

  const onCancelDummyNameEdit = () => {
    setDummyNameForm(currentDummyName);
    setEditingDummyName(false);
  };

  const saveDummyName = async () => {
    if(!canSaveDummyName) {
      return;
    }
    setSavingDummyName(true);
    setFeedback(null);
    try {
      await updateDummyProfileName({ name: trimmedDummyName });
      await refresh();
      setEditingDummyName(false);
      setFeedback({ type: 'ok', message: t('dashboard.dummyNameUpdated') });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSavingDummyName(false);
    }
  };

  const openEmailVerifyModal = () => {
    setVerifyCodeInput('');
    setVerifyResendCooldownSec(0);
    setVerifyDeadlineMs(0);
    setVerifyRemainingMs(0);
    setShowEmailVerifyModal(true);
  };

  const onVerifyResend = async () => {
    if(verifyResendCooldownSec > 0 || verifyResending) {
      return;
    }
    setVerifyResending(true);
    setFeedback(null);
    try {
      const data = await resendEmailVerification();
      const nextDeadline = Date.parse(String(data?.expiresAt || ''));
      if(Number.isFinite(nextDeadline) && nextDeadline > Date.now()) {
        setVerifyDeadlineMs(nextDeadline);
      }
      setVerifyResendCooldownSec(60);
      setShowVerifySentToast(false);
      requestAnimationFrame(() => setShowVerifySentToast(true));
    } catch (err) {
      const nextDeadline = Date.parse(String(err?.payload?.expiresAt || ''));
      if(Number.isFinite(nextDeadline) && nextDeadline > Date.now()) {
        setVerifyDeadlineMs(nextDeadline);
      }
      if(Number.isFinite(Number(err?.payload?.waitSeconds)) && Number(err.payload.waitSeconds) > 0) {
        setVerifyResendCooldownSec(Number(err.payload.waitSeconds));
      }
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setVerifyResending(false);
    }
  };

  const onVerifyEmail = async () => {
    if(verifySubmitting || verifyCodeInput.length !== 6) {
      return;
    }
    setVerifySubmitting(true);
    setFeedback(null);
    try {
      await verifyEmailCode({ code: verifyCodeInput });
      await refresh();
      setShowEmailVerifyModal(false);
      setFeedback({ type: 'ok', message: t('dashboard.emailVerifiedNow') });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setVerifySubmitting(false);
    }
  };

  const onAdminBan = async () => {
    const accountId = Number(adminSelectedUser?.id || 0);
    const minutes = adminMinutesNum;
    if(!Number.isFinite(accountId) || accountId <= 0) {
      setFeedback({ type: 'error', message: t('dashboard.adminSelectUserRequired') });
      return;
    }
    if(adminBanMode === 'temporary') {
      if(!Number.isFinite(parsedMinutes)) {
        setFeedback({ type: 'error', message: t('dashboard.adminInvalidMinutes') });
        return;
      }
      if(!temporaryMinutesValid) {
        setFeedback({ type: 'error', message: t('dashboard.adminInvalidMinutesRange') });
        return;
      }
    }
    setAdminSubmitting(true);
    setFeedback(null);
    try {
      await adminBanAccount({
        accountId,
        minutes,
        reason: adminReasonValue,
      });
      const list = await adminSearchUsers('');
      setAdminUsers(Array.isArray(list?.users) ? list.users : []);
      const refreshedSelected = Array.isArray(list?.users)
        ? list.users.find((entry) => Number(entry?.id) === accountId) || null
        : null;
      setAdminSelectedUser(refreshedSelected);
      setShowAdminBanConfirm(false);
      setFeedback({ type: 'ok', message: t('dashboard.adminBanDone') });
      await refresh();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setAdminSubmitting(false);
    }
  };

  const onAdminUnban = async () => {
    const accountId = Number(adminSelectedUser?.id || 0);
    if(!Number.isFinite(accountId) || accountId <= 0) {
      setFeedback({ type: 'error', message: t('dashboard.adminSelectUserRequired') });
      return;
    }
    setAdminSubmitting(true);
    setFeedback(null);
    try {
      await adminUnbanAccount({ accountId });
      const list = await adminSearchUsers('');
      setAdminUsers(Array.isArray(list?.users) ? list.users : []);
      const refreshedSelected = Array.isArray(list?.users)
        ? list.users.find((entry) => Number(entry?.id) === accountId) || null
        : null;
      setAdminSelectedUser(refreshedSelected);
      setFeedback({ type: 'ok', message: t('dashboard.adminUnbanDone') });
      await refresh();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setAdminSubmitting(false);
    }
  };

  const onOpenAdminGrantConfirm = () => {
    const accountId = Number(adminSelectedUser?.id || 0);
    if(!Number.isFinite(accountId) || accountId <= 0) {
      setFeedback({ type: 'error', message: t('dashboard.adminSelectUserRequired') });
      return;
    }
    if(adminGrantPlanKey !== 'starter' && adminGrantPlanKey !== 'plus') {
      setFeedback({ type: 'error', message: t('dashboard.adminGrantInvalidPlan') });
      return;
    }
    if(!grantMonthsValid) {
      setFeedback({ type: 'error', message: t('dashboard.adminGrantInvalidMonthsRange') });
      return;
    }
    setShowAdminGrantConfirm(true);
  };

  const onAdminGrantMonths = async () => {
    const accountId = Number(adminSelectedUser?.id || 0);
    if(!Number.isFinite(accountId) || accountId <= 0) {
      setFeedback({ type: 'error', message: t('dashboard.adminSelectUserRequired') });
      return;
    }
    if(adminGrantPlanKey !== 'starter' && adminGrantPlanKey !== 'plus') {
      setFeedback({ type: 'error', message: t('dashboard.adminGrantInvalidPlan') });
      return;
    }
    if(!grantMonthsValid) {
      setFeedback({ type: 'error', message: t('dashboard.adminGrantInvalidMonthsRange') });
      return;
    }

    setAdminGrantSubmitting(true);
    setFeedback(null);
    try {
      await adminGrantSubscriptionMonths({
        accountId,
        planKey: adminGrantPlanKey,
        months: parsedGrantMonths,
        reason: String(adminGrantReason || '').trim(),
      });
      const list = await adminSearchUsers('');
      setAdminUsers(Array.isArray(list?.users) ? list.users : []);
      const refreshedSelected = Array.isArray(list?.users)
        ? list.users.find((entry) => Number(entry?.id) === accountId) || null
        : null;
      setAdminSelectedUser(refreshedSelected);
      setShowAdminGrantConfirm(false);
      setAdminGrantMonths('1');
      setAdminGrantReason('');
      setFeedback({ type: 'ok', message: t('dashboard.adminGrantDone') });
      await refreshSubscriptionInfo({ silent: true });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setAdminGrantSubmitting(false);
    }
  };

  const onAdminPatreonTierSave = async () => {
    const tierId = String(adminPatreonTierId || '').trim();
    if(!tierId) {
      setFeedback({ type: 'error', message: 'Tier ID is required.' });
      return;
    }
    setAdminPatreonSubmitting(true);
    setFeedback(null);
    try {
      await adminUpsertPatreonTier({
        planKey: adminPatreonPlanKey,
        externalTierId: tierId,
        tierTitle: String(adminPatreonTierTitle || '').trim(),
        active: adminPatreonTierActive ? 1 : 0,
      });
      setAdminPatreonPlanKey('plus');
      setAdminPatreonTierId('');
      setAdminPatreonTierTitle('');
      setAdminPatreonTierActive(true);
      await refreshAdminPatreonTiers();
      setFeedback({ type: 'ok', message: 'Patreon tier saved.' });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setAdminPatreonSubmitting(false);
    }
  };

  const onAdminPatreonTierDisable = async (tierId) => {
    if(!tierId || adminPatreonSubmitting) {
      return;
    }
    setAdminPatreonSubmitting(true);
    setFeedback(null);
    try {
      await adminDeletePatreonTier(tierId);
      await refreshAdminPatreonTiers();
      setFeedback({ type: 'ok', message: 'Patreon tier disabled.' });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setAdminPatreonSubmitting(false);
    }
  };

  const onAdminMapTargetToggle = (targetKey) => {
    const normalized = String(targetKey || '');
    if(!normalized) {
      return;
    }
    setAdminSelectedMapTargets((prev) => (
      prev.includes(normalized)
        ? prev.filter((entry) => entry !== normalized)
        : [...prev, normalized]
    ));
  };

  const resetAdminMapForm = () => {
    setAdminMapFile(null);
    setAdminMapName('');
    setAdminMapCategory('Easy');
    setAdminMapStars('1');
    setAdminMapPoints('0');
    setAdminMapAuthor('');
    setAdminMapSourceLabel('');
    setAdminMapNotes('');
  };

  const onAdminMapUpload = async () => {
    if(adminMapUploadSubmitting) {
      return;
    }
    if(!(adminMapFile instanceof File)) {
      setFeedback({ type: 'error', message: t('dashboard.adminMapFileRequired') });
      return;
    }
    if(adminSelectedMapTargets.length === 0) {
      setFeedback({ type: 'error', message: t('dashboard.adminMapTargetRequired') });
      return;
    }

    const formData = new FormData();
    formData.append('mapFile', adminMapFile);
    formData.append('mapName', adminMapName);
    formData.append('category', adminMapCategory);
    formData.append('stars', adminMapStars);
    formData.append('points', adminMapPoints);
    formData.append('author', adminMapAuthor);
    formData.append('sourceLabel', adminMapSourceLabel);
    formData.append('notes', adminMapNotes);
    adminSelectedMapTargets.forEach((entry) => {
      formData.append('targetKeys[]', entry);
    });

    setAdminMapUploadSubmitting(true);
    setFeedback(null);
    try {
      await adminUploadMap(formData);
      resetAdminMapForm();
      await refreshAdminMapJobs();
      setFeedback({ type: 'ok', message: t('dashboard.adminMapUploadDone') });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setAdminMapUploadSubmitting(false);
    }
  };

  const onAdminMapRetry = async (jobId) => {
    const normalizedJobId = Math.floor(Number(jobId || 0));
    if(!Number.isFinite(normalizedJobId) || normalizedJobId <= 0 || adminMapRetryingJobId > 0) {
      return;
    }
    setAdminMapRetryingJobId(normalizedJobId);
    setFeedback(null);
    try {
      await adminRetryMapDeployJob(normalizedJobId);
      await refreshAdminMapJobs();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setAdminMapRetryingJobId(0);
    }
  };

  const getCurrentTrailSettingsState = () => ({
    enabled: adminTrailEnabled,
    mode: adminTrailMode,
    extraEnabled: adminTrailExtraEnabled,
    extraEndlessHook: adminTrailExtraHook,
    extraEndlessJump: adminTrailExtraJump,
    extraJetpack: adminTrailExtraJetpack,
  });

  const applyTrailSettingsState = (settings) => {
    setAdminTrailEnabled(Boolean(settings.enabled));
    setAdminTrailMode(Number(settings.mode) || 1);
    setAdminTrailExtraEnabled(Boolean(settings.extraEnabled));
    setAdminTrailExtraHook(Boolean(settings.extraEndlessHook));
    setAdminTrailExtraJump(Boolean(settings.extraEndlessJump));
    setAdminTrailExtraJetpack(Boolean(settings.extraJetpack));
  };

  const persistTrailSettings = async (nextSettings) => {
    if(adminTrailSubmitting) {
      return;
    }
    if(trailFeatureLocked) {
      setFeedback({ type: 'error', message: trailSectionLockedTooltip });
      return;
    }
    const previousSettings = getCurrentTrailSettingsState();
    const normalizedSettings = {
      enabled: Boolean(nextSettings.enabled),
      mode: Number(nextSettings.mode) || 1,
      extraEnabled: Boolean(nextSettings.extraEnabled),
      extraEndlessHook: Boolean(nextSettings.extraEndlessHook),
      extraEndlessJump: Boolean(nextSettings.extraEndlessJump),
      extraJetpack: Boolean(nextSettings.extraJetpack),
    };
    applyTrailSettingsState(normalizedSettings);
    setAdminTrailSubmitting(true);
    setAdminTrailMenuOpen(false);
    setFeedback(null);
    try {
      await updateTrailSettings({
        enabled: normalizedSettings.enabled ? 1 : 0,
        mode: normalizedSettings.mode,
        extraEnabled: normalizedSettings.extraEnabled ? 1 : 0,
        extraEndlessHook: normalizedSettings.extraEndlessHook ? 1 : 0,
        extraEndlessJump: normalizedSettings.extraEndlessJump ? 1 : 0,
        extraJetpack: normalizedSettings.extraJetpack ? 1 : 0,
      });
      setShowTrailSavedToast(false);
      requestAnimationFrame(() => setShowTrailSavedToast(true));
    } catch (err) {
      applyTrailSettingsState(previousSettings);
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setAdminTrailSubmitting(false);
    }
  };

  const onAdminTrailToggle = () => persistTrailSettings({
    ...getCurrentTrailSettingsState(),
    enabled: !adminTrailEnabled,
  });

  const onAdminTrailModeSelect = (modeValue) => persistTrailSettings({
    ...getCurrentTrailSettingsState(),
    mode: modeValue,
  });

  const onAdminTrailExtraToggle = () => persistTrailSettings({
    ...getCurrentTrailSettingsState(),
    extraEnabled: !adminTrailExtraEnabled,
  });

  const onAdminTrailExtraOptionToggle = (field) => {
    const current = getCurrentTrailSettingsState();
    persistTrailSettings({
      ...current,
      [field]: !current[field],
    });
  };

  const displayCode = loadingCode
    ? '••••••••••••••••••••'
    : (!gameCode ? '-' : (revealed ? gameCode : '•'.repeat(gameCode.length)));
  const displayDummyCode = loadingDummyCode
    ? '••••••••••••••••••••'
    : (!dummyCode ? '-' : (dummyRevealed ? dummyCode : '•'.repeat(dummyCode.length)));

  const banPermanent = Number(user?.ban_is_permanent || 0) !== 0;
  const banUntilRaw = String(user?.ban_until || '');
  const banUntilMs = banUntilRaw ? Date.parse(banUntilRaw) : NaN;
  const banTempActive = Number.isFinite(banUntilMs) && banUntilMs > Date.now();
  const isBanned = banPermanent || banTempActive;
  const localizeBanReason = (reasonRaw) => {
    const reason = String(reasonRaw || '').trim();
    if(reason === 'chat') return t('dashboard.adminReasonChat');
    if(reason === 'griefing') return t('dashboard.adminReasonGriefing');
    if(reason === 'cheat') return t('dashboard.adminReasonCheat');
    return reason;
  };
  const banReasonText = localizeBanReason(user?.ban_reason);
  const banUntilText = banTempActive
    ? new Date(banUntilMs).toLocaleString(locale || 'en-US')
    : '';
  const accessStatusText = isBanned
    ? `${banPermanent
      ? t('dashboard.accessBannedPermanent')
      : t('dashboard.accessBannedUntil', { time: banUntilText })}
${t('dashboard.accessReasonLine', { reason: banReasonText || '-' })}`
    : t('dashboard.accessActive');
  const accessStatusClass = isBanned
    ? (banPermanent ? 'status-text status-permanent' : 'status-text status-temporary')
    : 'status-text status-normal';
  const filterAdminUsersByName = (needle) => {
    const lowered = needle.trim().toLowerCase();
    if(!lowered) {
      return adminUsers;
    }
    return adminUsers.filter((entry) => {
      const username = String(entry?.username || '').toLowerCase();
      const displayName = String(entry?.display_name || entry?.username || '').toLowerCase();
      const dummyName = String(entry?.dummy_name || '').toLowerCase();
      return username.includes(lowered) || displayName.includes(lowered) || dummyName.includes(lowered);
    });
  };
  const adminFilteredUsers = filterAdminUsersByName(adminSearchName);
  const abuseFilteredUsers = filterAdminUsersByName(abuseSearchName);
  const abuseKindOptions = [
    { value: 'all', label: t('dashboard.adminAbuseKindAll') },
    { value: 'evasion', label: t('dashboard.adminAbuseKindEvasion') },
    { value: 'multi_account', label: t('dashboard.adminAbuseKindMulti') },
    { value: 'sharing', label: t('dashboard.adminAbuseKindSharing') },
  ];
  const abuseKindLabel = (kind) => abuseKindOptions.find((option) => option.value === kind)?.label || kind;
  // A sharing case is about one account, so it has no counterpart to ban.
  const abuseCaseTargets = abuseCase
    ? [
      { id: Number(abuseCase.accountId), name: abuseCase.accountName },
      ...(Number(abuseCase.relatedAccountId) > 0
        ? [{ id: Number(abuseCase.relatedAccountId), name: abuseCase.relatedAccountName }]
        : []),
    ]
    : [];
  const adminUserStatusText = (targetUser) => {
    const permanent = Number(targetUser?.ban_is_permanent || 0) !== 0;
    const untilRaw = String(targetUser?.ban_until || '');
    const untilMs = untilRaw ? Date.parse(untilRaw) : NaN;
    const tempActive = Number.isFinite(untilMs) && untilMs > Date.now();
    if(permanent) {
      return t('dashboard.accessBannedPermanent');
    }
    if(tempActive) {
      return t('dashboard.accessBannedUntil', { time: new Date(untilMs).toLocaleString(locale || 'en-US') });
    }
    return t('dashboard.accessActive');
  };
  const adminUserStatusCompact = (targetUser) => {
    const permanent = Number(targetUser?.ban_is_permanent || 0) !== 0;
    const untilRaw = String(targetUser?.ban_until || '');
    const untilMs = untilRaw ? Date.parse(untilRaw) : NaN;
    const tempActive = Number.isFinite(untilMs) && untilMs > Date.now();
    if(permanent) {
      return t('dashboard.accessBannedPermanent');
    }
    if(tempActive) {
      return t('dashboard.adminTemporaryBanShort');
    }
    return t('dashboard.accessActive');
  };
  const selectedBanPermanent = Number(adminSelectedUser?.ban_is_permanent || 0) !== 0;
  const selectedBanUntilRaw = String(adminSelectedUser?.ban_until || '');
  const selectedBanUntilMs = selectedBanUntilRaw ? Date.parse(selectedBanUntilRaw) : NaN;
  const selectedBanTempActive = Number.isFinite(selectedBanUntilMs) && selectedBanUntilMs > Date.now();
  const selectedUserBanned = selectedBanPermanent || selectedBanTempActive;
  const selectedUserBanReason = localizeBanReason(adminSelectedUser?.ban_reason);
  const selectedUserStatusText = adminSelectedUser ? adminUserStatusText(adminSelectedUser) : '';
  const selectedUserStatusClass = selectedUserBanned
    ? (selectedBanPermanent ? 'status-text status-permanent' : 'status-text status-temporary')
    : 'status-text status-normal';
  const adminBanUntilMs = Number.isFinite(adminMinutesNum) && adminMinutesNum > 0
    ? Date.now() + Math.floor(adminMinutesNum) * 60 * 1000
    : NaN;
  const adminBanUntilText = Number.isFinite(adminBanUntilMs)
    ? formatDateTimePrecise(adminBanUntilMs, locale)
    : '';

  const onOpenAdminBanConfirm = () => {
    const accountId = Number(adminSelectedUser?.id || 0);
    if(!Number.isFinite(accountId) || accountId <= 0) {
      setFeedback({ type: 'error', message: t('dashboard.adminSelectUserRequired') });
      return;
    }
    if(adminBanMode === 'temporary') {
      if(!Number.isFinite(parsedMinutes)) {
        setFeedback({ type: 'error', message: t('dashboard.adminInvalidMinutes') });
        return;
      }
      if(!temporaryMinutesValid) {
        setFeedback({ type: 'error', message: t('dashboard.adminInvalidMinutesRange') });
        return;
      }
    }
    setShowAdminBanConfirm(true);
  };
  const blurAdminPickerFocus = () => {
    if(typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if(adminSearchInputRef.current) {
      adminSearchInputRef.current.blur();
    }
  };
  const blurAbusePickerFocus = () => {
    if(typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if(abuseSearchInputRef.current) {
      abuseSearchInputRef.current.blur();
    }
  };
  const navItems = [
    { id: 'account', label: t('dashboard.accountTitle'), icon: iconUser },
    ...(canUseInvite ? [{ id: 'invite', label: t('dashboard.inviteTitle'), icon: iconEnvelope }] : []),
    { id: 'codes', label: t('dashboard.gameCodeTitle'), icon: iconKey },
    { id: 'subscription', label: t('dashboard.subscriptionNav'), icon: iconCreditCard },
  ];

  const onLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  return (
    <main className="shell">
      <TopBar
        right={
          <button className="btn" type="button" onClick={onLogout}>{t('common.logout')}</button>
        }
      />

      {showCopyToast ? (
        <section className="copy-toast" role="status" aria-live="polite">
          <span className="copy-toast-icon"><ToastCheckIcon /></span>
          <span>{t('dashboard.copyToast')}</span>
        </section>
      ) : null}
      {showTrailSavedToast ? (
        <section className="copy-toast" role="status" aria-live="polite">
          <span className="copy-toast-icon"><ToastCheckIcon /></span>
          <span>{t('dashboard.subscriptionTrailSaved')}</span>
        </section>
      ) : null}
      {showAutoLoginSavedToast ? (
        <section className="copy-toast" role="status" aria-live="polite">
          <span className="copy-toast-icon"><ToastCheckIcon /></span>
          <span>{t('dashboard.autoLoginSaved')}</span>
        </section>
      ) : null}
      {showVerifySentToast ? (
        <section className="copy-toast" role="status" aria-live="polite">
          <span className="copy-toast-icon"><ToastCheckIcon /></span>
          <span>{t('dashboard.emailVerifySentToast')}</span>
        </section>
      ) : null}

      <section className="hero">
        <p className="eyebrow">{t('dashboard.eyebrow')}</p>
        <h1>{t('dashboard.title')}</h1>
        <p className="lead">{t('dashboard.lead')}</p>
      </section>

      <section className="dashboard-layout">
        <aside className="panel dashboard-sidebar">
          <p className="dashboard-sidebar-caption">{t('dashboard.title')}</p>
          <nav className="dashboard-nav" aria-label="Dashboard sections">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`dashboard-nav-btn${activeSection === item.id ? ' active' : ''}`}
                type="button"
                onClick={() => setActiveSection(item.id)}
              >
                <span className="dashboard-nav-icon" aria-hidden="true"><img src={item.icon} alt="" /></span>
                <span>{item.label}</span>
              </button>
            ))}
            {trailFeatureLocked ? (
              <Tooltip label={trailSectionLockedTooltip}>
                <button
                  className={`dashboard-nav-btn dashboard-sub-nav-btn${activeSection === 'subscription-trail' ? ' active' : ''} is-locked`}
                  type="button"
                  onClick={() => {}}
                  aria-disabled="true"
                  title={trailSectionLockedTooltip}
                >
                  <span className="dashboard-nav-icon" aria-hidden="true"><img src={iconCreditCard} alt="" /></span>
                  <span>{t('dashboard.subscriptionTrailNav')}</span>
                </button>
              </Tooltip>
            ) : (
              <button
                className={`dashboard-nav-btn dashboard-sub-nav-btn${activeSection === 'subscription-trail' ? ' active' : ''}`}
                type="button"
                onClick={() => setActiveSection('subscription-trail')}
              >
                <span className="dashboard-nav-icon" aria-hidden="true"><img src={iconCreditCard} alt="" /></span>
                <span>{t('dashboard.subscriptionTrailNav')}</span>
              </button>
            )}
          </nav>
          {isManager ? (
            <div className="dashboard-admin-nav">
              <div className="dashboard-nav-divider" />
              <p className="dashboard-admin-label">{t('dashboard.adminSection')}</p>
              <button
                className={`dashboard-nav-btn${activeSection === 'admin-ban' ? ' active' : ''}`}
                type="button"
                onClick={() => setActiveSection('admin-ban')}
              >
                <span className="dashboard-nav-icon" aria-hidden="true"><img src={iconSiren} alt="" /></span>
                <span>{t('dashboard.adminBanNav')}</span>
              </button>
              <button
                className={`dashboard-nav-btn${activeSection === 'admin-abuse' ? ' active' : ''}`}
                type="button"
                onClick={() => setActiveSection('admin-abuse')}
              >
                <span className="dashboard-nav-icon" aria-hidden="true"><img src={iconSiren} alt="" /></span>
                <span>{t('dashboard.adminAbuseNav')}</span>
              </button>
              {isOperator ? (
                <button
                  className={`dashboard-nav-btn${activeSection === 'admin-plan-grant' ? ' active' : ''}`}
                  type="button"
                  onClick={() => setActiveSection('admin-plan-grant')}
                >
                  <span className="dashboard-nav-icon" aria-hidden="true"><img src={iconCreditCard} alt="" /></span>
                  <span>{t('dashboard.adminPlanGrantNav')}</span>
                </button>
              ) : null}
              {isOperator ? (
                <button
                  className={`dashboard-nav-btn${activeSection === 'admin-patreon' ? ' active' : ''}`}
                  type="button"
                  onClick={() => setActiveSection('admin-patreon')}
                >
                  <span className="dashboard-nav-icon" aria-hidden="true"><img src={iconCreditCard} alt="" /></span>
                  <span>{t('dashboard.adminPatreonNav')}</span>
                </button>
              ) : null}
              {isOperator ? (
                <button
                  className={`dashboard-nav-btn${activeSection === 'admin-map-upload' ? ' active' : ''}`}
                  type="button"
                  onClick={() => setActiveSection('admin-map-upload')}
                >
                  <span className="dashboard-nav-icon" aria-hidden="true"><img src={iconCloudUploadAlt} alt="" /></span>
                  <span>{t('dashboard.adminMapUploadNav')}</span>
                </button>
              ) : null}
              {isOperator ? (
                <button
                  className={`dashboard-nav-btn${activeSection === 'admin-maintenance' ? ' active' : ''}`}
                  type="button"
                  onClick={() => setActiveSection('admin-maintenance')}
                >
                  <span className="dashboard-nav-icon" aria-hidden="true"><img src={iconSiren} alt="" /></span>
                  <span>{maintenanceText.nav}</span>
                </button>
              ) : null}
            </div>
          ) : null}
        </aside>

        <div className="dashboard-content">
          {activeSection === 'account' ? (
            <article className="panel">
          <h3>{t('dashboard.accountTitle')}</h3>
          <div className="account-info">
            <div className="account-row">
              <div className="account-label">{t('dashboard.rowUserId')}</div>
              <div className="account-value">{user?.id ?? '-'}</div>
            </div>
            <div className="account-row">
              <div className="account-label">{t('dashboard.rowUsername')}</div>
              <div className="account-value">
              <div className="name-inline">
                {editingName ? (
                  <input
                    className="name-inline-input"
                    value={nameForm}
                    onChange={(event) => setNameForm(event.target.value)}
                    maxLength={32}
                    autoComplete="nickname"
                    autoFocus
                    onKeyDown={(event) => {
                      if(event.key === 'Escape') {
                        onCancelNameEdit();
                      }
                      if(event.key === 'Enter') {
                        event.preventDefault();
                        if(canSaveName) {
                          setShowNameConfirm(true);
                        }
                      }
                    }}
                  />
                ) : (
                  <span className="name-inline-value">{currentName || '-'}</span>
                )}
                {!editingName ? (
                  !emailVerified ? (
                    <Tooltip label={t('dashboard.verifyRequiredTooltip')}>
                      <button
                        className="btn ghost icon-btn name-action-btn locked-action"
                        type="button"
                        aria-disabled="true"
                        title={t('dashboard.verifyRequiredTooltip')}
                      >
                        <LockIcon />
                      </button>
                    </Tooltip>
                  ) : nameCooldownActive ? (
                    <Tooltip label={t('dashboard.nameCooldown', { days: nameCooldownDaysLeft })}>
                      <button
                        className="btn ghost icon-btn name-action-btn locked-action"
                        type="button"
                        onClick={onNameAction}
                        aria-disabled="true"
                        title={t('dashboard.nameCooldown', { days: nameCooldownDaysLeft })}
                      >
                        <PencilIcon />
                      </button>
                    </Tooltip>
                  ) : (
                    <button
                      className="btn ghost icon-btn name-action-btn"
                      type="button"
                      onClick={onNameAction}
                      title={t('dashboard.nameEdit')}
                    >
                      <PencilIcon />
                    </button>
                  )
                ) : (
                  <button
                    className="btn ghost icon-btn name-action-btn"
                    type="button"
                    onClick={onNameAction}
                    disabled={!canSaveName}
                    title={t('dashboard.nameApply')}
                  >
                    <CheckIcon />
                  </button>
                )}
                {editingName ? (
                  <button
                    className="btn ghost icon-btn name-action-btn"
                    type="button"
                    onClick={onCancelNameEdit}
                    title={t('dashboard.nameCancel')}
                  >
                    <CloseIcon />
                  </button>
                ) : null}
              </div>
              </div>
            </div>
            <div className="account-row">
              <div className="account-label">{t('dashboard.rowDisplayName')}</div>
              <div className="account-value">
              <div className="name-inline">
                {editingDisplayName ? (
                  <input
                    className="name-inline-input"
                    value={displayNameForm}
                    onChange={(event) => setDisplayNameForm(event.target.value)}
                    maxLength={32}
                    autoComplete="nickname"
                    autoFocus
                    onKeyDown={(event) => {
                      if(event.key === 'Escape') {
                        onCancelDisplayNameEdit();
                      }
                      if(event.key === 'Enter') {
                        event.preventDefault();
                        if(canSaveDisplayName) {
                          saveDisplayName();
                        }
                      }
                    }}
                  />
                ) : (
                  <span className="name-inline-value">{currentDisplayName || '-'}</span>
                )}
                {editingDisplayName ? (
                  <>
                    <button
                      className="btn ghost icon-btn name-action-btn"
                      type="button"
                      onClick={onDisplayNameAction}
                      disabled={!canSaveDisplayName}
                      title={t('dashboard.nameApply')}
                    >
                      <CheckIcon />
                    </button>
                    <button
                      className="btn ghost icon-btn name-action-btn"
                      type="button"
                      onClick={onCancelDisplayNameEdit}
                      title={t('dashboard.nameCancel')}
                    >
                      <CloseIcon />
                    </button>
                  </>
                ) : (
                  displayNameFeatureLocked ? (
                    <Tooltip label={t('dashboard.displayNamePlusTooltip')}>
                      <button
                        className="btn ghost icon-btn name-action-btn locked-action"
                        type="button"
                        aria-disabled="true"
                        title={t('dashboard.displayNamePlusTooltip')}
                      >
                        <LockIcon />
                      </button>
                    </Tooltip>
                  ) : (
                    <button
                      className="btn ghost icon-btn name-action-btn"
                      type="button"
                      onClick={onDisplayNameAction}
                      title={t('dashboard.displayNameEdit')}
                    >
                      <PencilIcon />
                    </button>
                  )
                )}
              </div>
              </div>
            </div>
            {(dummyCode || currentDummyName) ? (
              <div className="account-row">
                <div className="account-label">{t('dashboard.rowDummyName')}</div>
                <div className="account-value">
                  <div className="name-inline">
                    {editingDummyName ? (
                      <input
                        className="name-inline-input"
                        value={dummyNameForm}
                        onChange={(event) => setDummyNameForm(event.target.value)}
                        maxLength={32}
                        autoComplete="nickname"
                        autoFocus
                        onKeyDown={(event) => {
                          if(event.key === 'Escape') {
                            onCancelDummyNameEdit();
                          }
                          if(event.key === 'Enter') {
                            event.preventDefault();
                            if(canSaveDummyName) {
                              saveDummyName();
                            }
                          }
                        }}
                      />
                    ) : (
                      <span className="name-inline-value">{currentDummyName || '-'}</span>
                    )}
                    {!editingDummyName ? (
                      !emailVerified ? (
                        <Tooltip label={t('dashboard.verifyRequiredTooltip')}>
                          <button
                            className="btn ghost icon-btn name-action-btn locked-action"
                            type="button"
                            aria-disabled="true"
                            title={t('dashboard.verifyRequiredTooltip')}
                          >
                            <LockIcon />
                          </button>
                        </Tooltip>
                      ) : dummyNameCooldownActive ? (
                        <Tooltip label={t('dashboard.nameCooldown', { days: dummyNameCooldownDaysLeft })}>
                          <button
                            className="btn ghost icon-btn name-action-btn locked-action"
                            type="button"
                            onClick={onDummyNameAction}
                            aria-disabled="true"
                            title={t('dashboard.nameCooldown', { days: dummyNameCooldownDaysLeft })}
                          >
                            <PencilIcon />
                          </button>
                        </Tooltip>
                      ) : (
                        <button
                          className="btn ghost icon-btn name-action-btn"
                          type="button"
                          onClick={onDummyNameAction}
                          title={t('dashboard.dummyNameEdit')}
                        >
                          <PencilIcon />
                        </button>
                      )
                    ) : (
                      <button
                        className="btn ghost icon-btn name-action-btn"
                        type="button"
                        onClick={onDummyNameAction}
                        disabled={!canSaveDummyName}
                        title={t('dashboard.nameApply')}
                      >
                        <CheckIcon />
                      </button>
                    )}
                    {editingDummyName ? (
                      <button
                        className="btn ghost icon-btn name-action-btn"
                        type="button"
                        onClick={onCancelDummyNameEdit}
                        title={t('dashboard.nameCancel')}
                      >
                        <CloseIcon />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
            <div className="account-row">
              <div className="account-label">{t('dashboard.rowEmail')}</div>
              <div className="account-value">
              <div className="email-verify-row">
                <span>{maskEmail(user?.email)}</span>
                {emailVerified ? (
                  <span className="status-text status-normal">{t('dashboard.emailVerified')}</span>
                ) : (
                  <button className="btn ghost" type="button" onClick={openEmailVerifyModal}>{t('dashboard.emailVerifyAction')}</button>
                )}
              </div>
              </div>
            </div>
            <div className="account-row">
              <div className="account-label">{t('dashboard.rowAccess')}</div>
              <div className="account-value"><span className={`${accessStatusClass} preserve-lines`}>{accessStatusText}</span></div>
            </div>
          </div>
            </article>
          ) : null}

          {activeSection === 'subscription' ? (
            <article className="panel">
              <h3>{t('dashboard.subscriptionTitle')}</h3>
              <dl className="info subscription-info">
                <dt>{t('dashboard.subscriptionCurrentPlan')}</dt>
                <dd>{subscriptionLoading ? t('dashboard.subscriptionLoading') : currentPlanLabel}</dd>
                <dt>{t('dashboard.subscriptionPeriodEnd')}</dt>
                <dd>
                  {subscriptionLoading
                    ? t('dashboard.subscriptionLoading')
                    : hasCurrentPeriodEnd
                      ? formatDateTimePrecise(currentPeriodEndMs, locale)
                      : '-'}
                </dd>
                <dt>{t('dashboard.subscriptionRemainingDays')}</dt>
                <dd>
                  {subscriptionLoading
                    ? t('dashboard.subscriptionLoading')
                    : hasCurrentPeriodEnd
                      ? t('dashboard.subscriptionRemainingDaysValue', { days: remainingDays })
                      : '-'}
                </dd>
                <dt>{t('dashboard.subscriptionPlanPage')}</dt>
                <dd>
                  <a className="mini-link" href={billingPageUrl}>
                    {billingPageUrl}
                  </a>
                </dd>
              </dl>
            </article>
          ) : null}

          {activeSection === 'invite' && canUseInvite ? (
            <article className="panel">
              <h3>{t('dashboard.inviteTitle')}</h3>
              <p className="muted">{t('dashboard.inviteBody')}</p>
              <pre className="mono">{user?.invite_code || '-'}</pre>
              <p className="muted">{t('dashboard.inviteUsage', { used: user?.invite_used ?? 0, quota: user?.invite_quota ?? 0 })}</p>
              <p className="muted">{t('dashboard.inviteNotice')}</p>
            </article>
          ) : null}

          {activeSection === 'codes' ? (
            <div className="dashboard-codes-grid">
              <article className="panel">
                <h3>{t('dashboard.gameCodeTitle')}</h3>
                <p className="muted">{t('dashboard.gameCodeBody')}</p>
                <div className="code-line">
                  <pre className="mono code-mono">{displayCode}</pre>
                  <div className="code-actions">
                    <Tooltip label={revealed ? t('dashboard.hideCode') : t('dashboard.showCode')}>
                      <button
                        className="btn ghost icon-btn"
                        type="button"
                        onClick={() => setRevealed((prev) => !prev)}
                        disabled={!gameCode || loadingCode}
                      >
                        {revealed ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </Tooltip>
                    <Tooltip label={t('dashboard.copyCode')}>
                      <button
                        className="btn ghost icon-btn"
                        type="button"
                        onClick={onCopyCode}
                        disabled={!gameCode || loadingCode}
                      >
                        <CopyIcon />
                      </button>
                    </Tooltip>
                  </div>
                </div>
                {!emailVerified ? (
                  <Tooltip label={t('dashboard.verifyRequiredTooltip')}>
                    <button className="btn locked-action" type="button" aria-disabled="true">
                      {gameCode ? t('dashboard.reissueCode') : t('dashboard.issueCode')}
                    </button>
                  </Tooltip>
                ) : (
                  <button className="btn" type="button" onClick={onRotateClick} disabled={rotating || loadingCode}>
                    {rotating ? t('dashboard.rotating') : (gameCode ? t('dashboard.reissueCode') : t('dashboard.issueCode'))}
                  </button>
                )}
              </article>

              <article className="panel">
                <h3>{t('dashboard.dummyCodeTitle')}</h3>
                <p className="muted">{t('dashboard.dummyCodeBody')}</p>
                <div className="code-line">
                  <pre className="mono code-mono">{displayDummyCode}</pre>
                  <div className="code-actions">
                    <Tooltip label={dummyRevealed ? t('dashboard.hideCode') : t('dashboard.showCode')}>
                      <button
                        className="btn ghost icon-btn"
                        type="button"
                        onClick={() => setDummyRevealed((prev) => !prev)}
                        disabled={!dummyCode || loadingDummyCode}
                      >
                        {dummyRevealed ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </Tooltip>
                    <Tooltip label={t('dashboard.copyCode')}>
                      <button
                        className="btn ghost icon-btn"
                        type="button"
                        onClick={async () => {
                          if(!dummyCode) return;
                          try {
                            await navigator.clipboard.writeText(dummyCode);
                            setShowCopyToast(false);
                            requestAnimationFrame(() => setShowCopyToast(true));
                          } catch {
                            setFeedback({ type: 'error', message: t('dashboard.copyFailed') });
                          }
                        }}
                        disabled={!dummyCode || loadingDummyCode}
                      >
                        <CopyIcon />
                      </button>
                    </Tooltip>
                  </div>
                </div>
                {!emailVerified ? (
                  <Tooltip label={t('dashboard.verifyRequiredTooltip')}>
                    <button className="btn locked-action" type="button" aria-disabled="true">
                      {dummyCode ? t('dashboard.dummyReissueCode') : t('dashboard.dummyIssueCode')}
                    </button>
                  </Tooltip>
                ) : (
                  <button className="btn" type="button" onClick={onDummyRotateClick} disabled={rotatingDummy || loadingDummyCode}>
                    {rotatingDummy ? t('dashboard.rotating') : (dummyCode ? t('dashboard.dummyReissueCode') : t('dashboard.dummyIssueCode'))}
                  </button>
                )}
              </article>

              <article className="panel auto-login-settings-panel">
                <h3>{t('dashboard.autoLoginToggle')}</h3>
                <div className="trail-setting-card">
                  <div className="trail-toggle-row">
                    <div>
                      <p className="trail-toggle-title">{t('dashboard.autoLoginToggle')}</p>
                      <p className="trail-toggle-subtitle">{t('dashboard.autoLoginToggleDesc')}</p>
                    </div>
                    <button
                      className={`trail-toggle${autoLoginEnabled ? ' is-on' : ''}`}
                      type="button"
                      role="switch"
                      aria-checked={autoLoginEnabled}
                      onClick={onToggleAutoLoginEnabled}
                      disabled={autoLoginSaving}
                    >
                      <span className="trail-toggle-knob" />
                    </button>
                  </div>
                  <div className="trail-toggle-row">
                    <div>
                      <p className="trail-toggle-title">{t('dashboard.autoLoginStrictToggle')}</p>
                      <p className="trail-toggle-subtitle">{t('dashboard.autoLoginStrictToggleDesc')}</p>
                    </div>
                    <button
                      className={`trail-toggle${autoLoginStrict ? ' is-on' : ''}`}
                      type="button"
                      role="switch"
                      aria-checked={autoLoginStrict}
                      onClick={onToggleAutoLoginStrict}
                      disabled={autoLoginSaving || !autoLoginEnabled}
                      aria-disabled={!autoLoginEnabled}
                    >
                      <span className="trail-toggle-knob" />
                    </button>
                  </div>
                </div>
              </article>
            </div>
          ) : null}

          {activeSection === 'admin-ban' && isManager ? (
            <article className="panel">
              <h3>{t('dashboard.adminBanTitle')}</h3>
              <div className="admin-form-grid">
                <label>
                  {t('dashboard.adminSearchName')}
                  <div className="admin-user-picker" ref={adminPickerRef}>
                    <input
                      ref={adminSearchInputRef}
                      value={adminSearchName}
                      onChange={(event) => {
                        setAdminSearchName(event.target.value);
                        setAdminPickerOpen(true);
                        setAdminSelectedUser(null);
                      }}
                      onFocus={() => setAdminPickerOpen(true)}
                      placeholder={t('dashboard.adminSearchPlaceholder')}
                    />
                    {adminPickerOpen ? (
                      <div className="admin-user-list-wrap">
                        <div className="admin-user-list-header">
                          <span>{t('dashboard.rowUserId')}</span>
                          <span>{t('dashboard.rowUsername')}</span>
                          <span>{t('dashboard.rowDisplayName')}</span>
                          <span>{t('dashboard.rowDummyName')}</span>
                          <span>{t('dashboard.rowAccess')}</span>
                        </div>
                        <div className="admin-user-list">
                          {adminUsersLoading && adminUsers.length === 0 ? (
                            <div className="admin-user-list-empty">{t('dashboard.adminNoUsers')}</div>
                          ) : adminFilteredUsers.length === 0 ? (
                            <div className="admin-user-list-empty">{t('dashboard.adminNoUsers')}</div>
                          ) : (
                            adminFilteredUsers.map((entry) => (
                              <button
                                key={entry.id}
                                className="admin-user-row"
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  setAdminSelectedUser(entry);
                                  setAdminSearchName(String(entry.username || ''));
                                  setAdminPickerOpen(false);
                                  blurAdminPickerFocus();
                                }}
                              >
                                <span>{entry.id}</span>
                                {renderAdminUserCell(entry.username || '-')}
                                {renderAdminUserCell(entry.display_name || entry.username || '-')}
                                {renderAdminUserCell(entry.dummy_name || '-')}
                                <Tooltip label={adminUserStatusText(entry)}>
                                  <span className="admin-user-cell-text">{adminUserStatusCompact(entry)}</span>
                                </Tooltip>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </label>
                {adminSelectedUser ? (
                  <div className="admin-picked-user">
                    <div className="admin-picked-row">
                      <span>{t('dashboard.rowUserId')}</span>
                      <span>{adminSelectedUser.id}</span>
                    </div>
                    <div className="admin-picked-row">
                      <span>{t('dashboard.rowUsername')}</span>
                      <span>{adminSelectedUser.username || '-'}</span>
                    </div>
                    <div className="admin-picked-row">
                      <span>{t('dashboard.rowDisplayName')}</span>
                      <span>{adminSelectedUser.display_name || adminSelectedUser.username || '-'}</span>
                    </div>
                    <div className="admin-picked-row">
                      <span>{t('dashboard.rowDummyName')}</span>
                      <span>{adminSelectedUser.dummy_name || '-'}</span>
                    </div>
                    <div className="admin-picked-row">
                      <span>{t('dashboard.rowAccess')}</span>
                      <span className={selectedUserStatusClass}>{selectedUserStatusText}</span>
                    </div>
                    <div className="admin-picked-row">
                      <span>{t('dashboard.adminReason')}</span>
                      <span>{selectedUserBanReason || '-'}</span>
                    </div>
                  </div>
                ) : null}
                {adminSelectedUser && !selectedUserBanned ? (
                  <>
                    <div className="admin-ban-mode-toggle">
                      <button
                        className={`btn ghost admin-ban-mode-btn${adminBanMode === 'temporary' ? ' active' : ''}`}
                        type="button"
                        aria-pressed={adminBanMode === 'temporary'}
                        onClick={() => setAdminBanMode('temporary')}
                      >
                        {adminBanMode === 'temporary' ? `✓ ${t('dashboard.adminBanModeTemporary')}` : t('dashboard.adminBanModeTemporary')}
                      </button>
                      <button
                        className={`btn ghost admin-ban-mode-btn${adminBanMode === 'permanent' ? ' active' : ''}`}
                        type="button"
                        aria-pressed={adminBanMode === 'permanent'}
                        onClick={() => setAdminBanMode('permanent')}
                      >
                        {adminBanMode === 'permanent' ? `✓ ${t('dashboard.adminBanModePermanent')}` : t('dashboard.adminBanModePermanent')}
                      </button>
                    </div>
                    {adminBanMode === 'temporary' ? (
                      <label>
                        {t('dashboard.adminMinutes')}
                        <input
                          type="number"
                          min={1}
                          max={1440}
                          step={1}
                          value={adminMinutes}
                          onChange={(event) => setAdminMinutes(event.target.value)}
                          placeholder={t('dashboard.adminMinutesPlaceholder')}
                        />
                      </label>
                    ) : null}
                    <label>
                      {t('dashboard.adminReason')}
                      <select
                        value={adminReasonPreset}
                        onChange={(event) => setAdminReasonPreset(event.target.value)}
                      >
                        <option value="chat">{t('dashboard.adminReasonChat')}</option>
                        <option value="griefing">{t('dashboard.adminReasonGriefing')}</option>
                        <option value="cheat">{t('dashboard.adminReasonCheat')}</option>
                        <option value="custom">{t('dashboard.adminReasonCustomOption')}</option>
                      </select>
                    </label>
                    {adminReasonPreset === 'custom' ? (
                      <label>
                        {t('dashboard.adminReasonCustom')}
                        <input
                          value={adminReasonCustom}
                          onChange={(event) => setAdminReasonCustom(event.target.value)}
                          placeholder={t('dashboard.adminReasonPlaceholder')}
                        />
                      </label>
                    ) : null}
                  </>
                ) : null}
              </div>
              {adminSelectedUser && !selectedUserBanned ? (
                <div className="admin-actions">
                  <button className="btn admin-main-action" type="button" onClick={onOpenAdminBanConfirm} disabled={adminSubmitting}>
                    {t('dashboard.adminBanAction')}
                  </button>
                </div>
              ) : null}
              {adminSelectedUser && selectedUserBanned ? (
                <div className="admin-actions">
                  <button className="btn admin-main-action" type="button" onClick={onAdminUnban} disabled={adminSubmitting}>
                    {t('dashboard.adminUnbanAction')}
                  </button>
                </div>
              ) : null}

            </article>
          ) : null}

          {activeSection === 'admin-patreon' && isOperator ? (
            <article className="panel">
              <h3>Patreon Tier Rules</h3>
              <p className="muted">Only active patrons in allowed Starter/Plus tiers receive matching benefits.</p>
              <div className="admin-form-grid">
                <label>
                  Plan Key
                  <select
                    value={adminPatreonPlanKey}
                    onChange={(event) => setAdminPatreonPlanKey(event.target.value === 'starter' ? 'starter' : 'plus')}
                  >
                    <option value="plus">Plus</option>
                    <option value="starter">Starter</option>
                  </select>
                </label>
                <label>
                  Patreon Tier ID
                  <input
                    value={adminPatreonTierId}
                    onChange={(event) => setAdminPatreonTierId(event.target.value)}
                    placeholder="e.g. 12345678"
                  />
                </label>
                <label>
                  Tier Title (optional)
                  <input
                    value={adminPatreonTierTitle}
                    onChange={(event) => setAdminPatreonTierTitle(event.target.value)}
                    placeholder="e.g. Ravion Plus"
                  />
                </label>
                <label>
                  Active
                  <select
                    value={adminPatreonTierActive ? '1' : '0'}
                    onChange={(event) => setAdminPatreonTierActive(event.target.value === '1')}
                  >
                    <option value="1">Enabled</option>
                    <option value="0">Disabled</option>
                  </select>
                </label>
              </div>
              <div className="admin-actions">
                <button className="btn admin-main-action" type="button" onClick={onAdminPatreonTierSave} disabled={adminPatreonSubmitting}>
                  Save Patreon Tier
                </button>
              </div>

              <div className="admin-tier-list">
                <div className="admin-tier-list-header">
                  <span>Plan</span>
                  <span>Tier ID</span>
                  <span>Title</span>
                  <span>Status</span>
                  <span>Action</span>
                </div>
                <div className="admin-tier-list-body">
                  {adminPatreonLoading ? (
                    <div className="admin-user-list-empty">Loading tiers...</div>
                  ) : adminPatreonTiers.length === 0 ? (
                    <div className="admin-user-list-empty">No Patreon tier rules yet.</div>
                  ) : (
                    adminPatreonTiers.map((tier) => (
                      <div className="admin-tier-row" key={tier.external_tier_id}>
                        <span>{String(tier.plan_key || '-').toUpperCase()}</span>
                        <span>{tier.external_tier_id}</span>
                        <span>{tier.tier_title || '-'}</span>
                        <span className={Number(tier.active || 0) === 1 ? 'status-text status-normal' : 'status-text status-temporary'}>
                          {Number(tier.active || 0) === 1 ? 'Enabled' : 'Disabled'}
                        </span>
                        <span>
                          {Number(tier.active || 0) === 1 ? (
                            <button
                              className="btn ghost"
                              type="button"
                              onClick={() => onAdminPatreonTierDisable(tier.external_tier_id)}
                              disabled={adminPatreonSubmitting}
                            >
                              Disable
                            </button>
                          ) : (
                            <span className="muted">-</span>
                          )}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </article>
          ) : null}

          {activeSection === 'admin-abuse' && isManager ? (
            <article className="panel">
              <h3>{t('dashboard.adminAbuseTitle')}</h3>
              <p className="muted">{t('dashboard.adminAbuseIntro')}</p>

              <div className="admin-form-grid">
                <h4>{t('dashboard.adminAbuseQueueTitle')}</h4>
                <div className="admin-abuse-filter">
                  {abuseKindOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`btn ghost${abuseKindFilter === option.value ? ' active' : ''}`}
                      onClick={() => setAbuseKindFilter(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {abuseReviewsLoading ? (
                  <p className="muted">{t('dashboard.adminAbuseLoading')}</p>
                ) : abuseReviews.length === 0 ? (
                  <p className="muted">{t('dashboard.adminAbuseQueueEmpty')}</p>
                ) : (
                  <div className="admin-abuse-list">
                    {abuseReviews.map((review) => (
                      <button
                        key={review.id}
                        type="button"
                        className={`admin-abuse-case${abuseCase?.id === review.id ? ' active' : ''}`}
                        onClick={() => openAbuseCase(review)}
                      >
                        <span className="admin-abuse-score">{review.score}</span>
                        <span className={`admin-abuse-kind kind-${review.kind}`}>
                          {abuseKindLabel(review.kind)}
                        </span>
                        <span className="admin-abuse-case-text">
                          {review.kind === 'sharing'
                            ? `${review.accountName} (#${review.accountId})`
                            : `${review.accountName} (#${review.accountId}) → ${review.relatedAccountName} (#${review.relatedAccountId})`}
                        </span>
                        {review.accountBanned ? (
                          <span className="admin-abuse-tag">{t('dashboard.adminAbuseBannedTag')}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                )}

                <label>
                  {t('dashboard.adminAbuseLookupLabel')}
                  <div className="admin-user-picker" ref={abusePickerRef}>
                    <input
                      ref={abuseSearchInputRef}
                      value={abuseSearchName}
                      onChange={(event) => {
                        setAbuseSearchName(event.target.value);
                        setAbusePickerOpen(true);
                      }}
                      onFocus={() => setAbusePickerOpen(true)}
                      placeholder={t('dashboard.adminSearchPlaceholder')}
                    />
                    {abusePickerOpen ? (
                      <div className="admin-user-list-wrap">
                        <div className="admin-user-list-header">
                          <span>{t('dashboard.rowUserId')}</span>
                          <span>{t('dashboard.rowUsername')}</span>
                          <span>{t('dashboard.rowDisplayName')}</span>
                          <span>{t('dashboard.rowDummyName')}</span>
                          <span>{t('dashboard.rowAccess')}</span>
                        </div>
                        <div className="admin-user-list">
                          {adminUsersLoading && adminUsers.length === 0 ? (
                            <div className="admin-user-list-empty">{t('dashboard.adminNoUsers')}</div>
                          ) : abuseFilteredUsers.length === 0 ? (
                            <div className="admin-user-list-empty">{t('dashboard.adminNoUsers')}</div>
                          ) : (
                            abuseFilteredUsers.map((entry) => (
                              <button
                                key={entry.id}
                                className="admin-user-row"
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => onAbusePickUser(entry)}
                              >
                                <span>{entry.id}</span>
                                {renderAdminUserCell(entry.username || '-')}
                                {renderAdminUserCell(entry.display_name || entry.username || '-')}
                                {renderAdminUserCell(entry.dummy_name || '-')}
                                <Tooltip label={adminUserStatusText(entry)}>
                                  <span className="admin-user-cell-text">{adminUserStatusCompact(entry)}</span>
                                </Tooltip>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </label>

                {abuseAccountId > 0 ? (
                  <>
                    <h4>{t('dashboard.adminAbuseSharingTitle')}</h4>
                    {!abuseSharing || abuseSharing.reasons.length === 0 ? (
                      <p className="muted">{t('dashboard.adminAbuseSharingEmpty')}</p>
                    ) : (
                      <div className="admin-abuse-link">
                        <div className="admin-abuse-link-head">
                          <span className="admin-abuse-score">{abuseSharing.score}</span>
                          <span className="admin-abuse-case-text">
                            {t('dashboard.adminAbuseSharingSummary', {
                              handovers: abuseSharing.handovers,
                              switches: abuseSharing.switches,
                              networks: abuseSharing.networks,
                              names: abuseSharing.names,
                            })}
                          </span>
                        </div>
                        <ul className="admin-abuse-reasons">
                          {abuseSharing.reasons.map((reason) => (
                            <li key={reason.kind}>
                              {t(`dashboard.adminAbuseReason_${reason.kind}`, { count: reason.count })}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <h4>{t('dashboard.adminAbuseLinksTitle')}</h4>
                    {abuseLinksLoading ? (
                      <p className="muted">{t('dashboard.adminAbuseLoading')}</p>
                    ) : abuseLinks.length === 0 ? (
                      <p className="muted">{t('dashboard.adminAbuseLinksEmpty')}</p>
                    ) : (
                      <div className="admin-abuse-list">
                        {abuseLinks.map((link) => (
                          <div key={link.accountId} className="admin-abuse-link">
                            <div className="admin-abuse-link-head">
                              <span className="admin-abuse-score">{link.score}</span>
                              <span className="admin-abuse-case-text">
                                {`${link.displayName} (#${link.accountId})`}
                              </span>
                              {link.banned ? (
                                <span className="admin-abuse-tag">{t('dashboard.adminAbuseBannedTag')}</span>
                              ) : null}
                            </div>
                            <ul className="admin-abuse-reasons">
                              {link.reasons.map((reason) => (
                                <li key={reason.kind}>
                                  {t(`dashboard.adminAbuseReason_${reason.kind}`, { count: reason.count })}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}

                    <h4>{t('dashboard.adminAbuseActivityTitle')}</h4>
                    {abuseActivity.length === 0 ? (
                      <p className="muted">{t('dashboard.adminAbuseLinksEmpty')}</p>
                    ) : (
                      <div className="admin-abuse-activity">
                        {abuseActivity.map((entry, index) => (
                          <div key={`${entry.source}-${entry.ip}-${index}`} className="admin-abuse-activity-row">
                            <span>{entry.source}</span>
                            <span>{entry.ip}</span>
                            <span>{entry.client_name || '-'}</span>
                            <span>{entry.hits}</span>
                            <span>{String(entry.last_seen_at || '').slice(0, 16).replace('T', ' ')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : null}

                {abuseCase ? (
                  <>
                    <h4>{t('dashboard.adminAbuseTargetsTitle')}</h4>
                    <div className="admin-abuse-targets">
                      {abuseCaseTargets.map((target) => (
                        <label key={target.id} className="admin-abuse-pick">
                          <input
                            type="checkbox"
                            checked={abuseBanIds.includes(target.id)}
                            onChange={() => toggleAbuseBanId(target.id)}
                          />
                          <span>{`${target.name} (#${target.id})`}</span>
                        </label>
                      ))}
                    </div>
                    <label>
                      {t('dashboard.adminAbuseNoteLabel')}
                      <input
                        type="text"
                        value={abuseNote}
                        onChange={(event) => setAbuseNote(event.target.value)}
                        placeholder={t('dashboard.adminAbuseNotePlaceholder')}
                      />
                    </label>
                    <div className="admin-ban-mode-toggle">
                      <button
                        className="btn danger"
                        type="button"
                        disabled={abuseSubmitting || abuseBanIds.length === 0}
                        onClick={() => onAbuseResolve('confirm')}
                      >
                        {t('dashboard.adminAbuseConfirm')}
                      </button>
                      <button
                        className="btn ghost"
                        type="button"
                        disabled={abuseSubmitting}
                        onClick={() => onAbuseResolve('dismiss')}
                      >
                        {t('dashboard.adminAbuseDismiss')}
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </article>
          ) : null}

          {activeSection === 'admin-plan-grant' && isOperator ? (
            <article className="panel">
              <h3>{t('dashboard.adminPlanGrantTitle')}</h3>
              <p className="muted">{t('dashboard.adminPlanGrantBody')}</p>
              <div className="admin-form-grid">
                <label>
                  {t('dashboard.adminSearchName')}
                  <div className="admin-user-picker" ref={adminPickerRef}>
                    <input
                      ref={adminSearchInputRef}
                      value={adminSearchName}
                      onChange={(event) => {
                        setAdminSearchName(event.target.value);
                        setAdminPickerOpen(true);
                        setAdminSelectedUser(null);
                      }}
                      onFocus={() => setAdminPickerOpen(true)}
                      placeholder={t('dashboard.adminSearchPlaceholder')}
                    />
                    {adminPickerOpen ? (
                      <div className="admin-user-list-wrap">
                        <div className="admin-user-list-header">
                          <span>{t('dashboard.rowUserId')}</span>
                          <span>{t('dashboard.rowUsername')}</span>
                          <span>{t('dashboard.rowDisplayName')}</span>
                          <span>{t('dashboard.rowDummyName')}</span>
                          <span>{t('dashboard.rowAccess')}</span>
                        </div>
                        <div className="admin-user-list">
                          {adminUsersLoading && adminUsers.length === 0 ? (
                            <div className="admin-user-list-empty">{t('dashboard.adminNoUsers')}</div>
                          ) : adminFilteredUsers.length === 0 ? (
                            <div className="admin-user-list-empty">{t('dashboard.adminNoUsers')}</div>
                          ) : (
                            adminFilteredUsers.map((entry) => (
                              <button
                                key={entry.id}
                                className="admin-user-row"
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  setAdminSelectedUser(entry);
                                  setAdminSearchName(String(entry.username || ''));
                                  setAdminPickerOpen(false);
                                  blurAdminPickerFocus();
                                }}
                              >
                                <span>{entry.id}</span>
                                {renderAdminUserCell(entry.username || '-')}
                                {renderAdminUserCell(entry.display_name || entry.username || '-')}
                                {renderAdminUserCell(entry.dummy_name || '-')}
                                <Tooltip label={adminUserStatusText(entry)}>
                                  <span className="admin-user-cell-text">{adminUserStatusCompact(entry)}</span>
                                </Tooltip>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </label>
                <label>
                  {t('dashboard.adminGrantPlanKey')}
                  <select
                    value={adminGrantPlanKey}
                    onChange={(event) => setAdminGrantPlanKey(event.target.value === 'plus' ? 'plus' : 'starter')}
                  >
                    <option value="starter">{t('dashboard.subscriptionPlanStarter')}</option>
                    <option value="plus">{t('dashboard.subscriptionPlanPlus')}</option>
                  </select>
                </label>
                <label>
                  {t('dashboard.adminGrantMonths')}
                  <input
                    type="number"
                    min={1}
                    max={24}
                    step={1}
                    value={adminGrantMonths}
                    onChange={(event) => setAdminGrantMonths(event.target.value)}
                    placeholder={t('dashboard.adminGrantMonthsPlaceholder')}
                  />
                </label>
                <label>
                  {t('dashboard.adminGrantReason')}
                  <input
                    value={adminGrantReason}
                    onChange={(event) => setAdminGrantReason(event.target.value)}
                    placeholder={t('dashboard.adminReasonPlaceholder')}
                  />
                </label>
              </div>
              <div className="admin-actions">
                <button
                  className="btn admin-main-action"
                  type="button"
                  onClick={onOpenAdminGrantConfirm}
                  disabled={adminGrantSubmitting}
                >
                  {t('dashboard.adminGrantAction')}
                </button>
              </div>
            </article>
          ) : null}

          {activeSection === 'admin-map-upload' && isOperator ? (
            <article className="panel">
              <h3>{t('dashboard.adminMapUploadTitle')}</h3>
              <p className="muted">{t('dashboard.adminMapUploadBody')}</p>
              <div className="admin-form-grid">
                <label>
                  {t('dashboard.adminMapFile')}
                  <input
                    type="file"
                    accept=".map"
                    onChange={(event) => {
                      const nextFile = event.target.files && event.target.files[0] ? event.target.files[0] : null;
                      setAdminMapFile(nextFile);
                      if(nextFile && !adminMapName.trim()) {
                        setAdminMapName(String(nextFile.name || '').replace(/\.map$/i, ''));
                      }
                    }}
                  />
                </label>
                <label>
                  {t('dashboard.adminMapName')}
                  <input
                    value={adminMapName}
                    onChange={(event) => setAdminMapName(event.target.value)}
                    placeholder="e.g. BlmapChill"
                  />
                </label>
                <label>
                  {t('dashboard.adminMapCategory')}
                  <select value={adminMapCategory} onChange={(event) => setAdminMapCategory(event.target.value)}>
                    {mapCategoryOptions.map((entry) => (
                      <option key={entry} value={entry}>{entry}</option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('dashboard.adminMapStars')}
                  <input
                    type="number"
                    min={0}
                    max={5}
                    step={1}
                    value={adminMapStars}
                    onChange={(event) => setAdminMapStars(event.target.value)}
                  />
                </label>
                <label>
                  {t('dashboard.adminMapPoints')}
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    step={1}
                    value={adminMapPoints}
                    onChange={(event) => setAdminMapPoints(event.target.value)}
                  />
                </label>
                <label>
                  {t('dashboard.adminMapAuthor')}
                  <input
                    value={adminMapAuthor}
                    onChange={(event) => setAdminMapAuthor(event.target.value)}
                    placeholder="e.g. Ravion"
                  />
                </label>
                <label>
                  {t('dashboard.adminMapSource')}
                  <input
                    value={adminMapSourceLabel}
                    onChange={(event) => setAdminMapSourceLabel(event.target.value)}
                    placeholder="e.g. KoG"
                  />
                </label>
                <label>
                  {t('dashboard.adminMapNotes')}
                  <input
                    value={adminMapNotes}
                    onChange={(event) => setAdminMapNotes(event.target.value)}
                    placeholder="-"
                  />
                </label>
              </div>

              <div className="admin-map-targets">
                <p className="trail-mode-label">{t('dashboard.adminMapTargets')}</p>
                {adminMapTargets.length === 0 ? (
                  <p className="muted">{t('dashboard.adminMapNoTargets')}</p>
                ) : (
                  <div className="admin-map-target-grid">
                    {adminMapTargets.map((target) => {
                      const targetKey = String(target?.key || '');
                      const selected = adminSelectedMapTargets.includes(targetKey);
                      return (
                        <button
                          key={targetKey}
                          className={`trail-extra-option${selected ? ' is-selected' : ''}`}
                          type="button"
                          onClick={() => onAdminMapTargetToggle(targetKey)}
                          aria-pressed={selected}
                        >
                          <span className="trail-extra-label">
                            {target?.label || targetKey}
                            {target?.region ? ` (${target.region})` : ''}
                          </span>
                          <span className="trail-extra-check" aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="admin-actions">
                <button
                  className="btn admin-main-action"
                  type="button"
                  onClick={onAdminMapUpload}
                  disabled={adminMapUploadSubmitting}
                >
                  {adminMapUploadSubmitting ? t('dashboard.adminMapUploading') : t('dashboard.adminMapUploadAction')}
                </button>
              </div>

              <div className="dashboard-nav-divider" />
              <h3>{t('dashboard.adminMapRecentJobs')}</h3>
              <div className="admin-map-job-list">
                {adminMapJobsLoading && adminMapJobs.length === 0 ? (
                  <div className="admin-user-list-empty">{t('dashboard.subscriptionLoading')}</div>
                ) : adminMapJobs.length === 0 ? (
                  <div className="admin-user-list-empty">{t('dashboard.adminMapNoJobs')}</div>
                ) : (
                  adminMapJobs.map((job) => (
                    <section className="admin-map-job-card" key={job.id}>
                      <div className="admin-map-job-head">
                        <div>
                          <strong>{job?.map?.mapName || '-'}</strong>
                          <p className="muted">{formatDateTimeShort(job?.requestedAt, locale)}</p>
                        </div>
                        <span className={mapDeployStatusClass(job?.status)}>{mapDeployStatusLabel(job?.status)}</span>
                      </div>
                      <div className="admin-map-job-meta">
                        <span>{job?.map?.category || '-'}</span>
                        <span>{t('dashboard.adminMapStars')}: {job?.map?.stars ?? '-'}</span>
                        <span>{t('dashboard.adminMapPoints')}: {job?.map?.points ?? '-'}</span>
                      </div>
                      {job?.status === 'failed' ? (
                        <div className="admin-actions">
                          <button
                            className="btn ghost"
                            type="button"
                            onClick={() => onAdminMapRetry(job.id)}
                            disabled={adminMapRetryingJobId === job.id}
                          >
                            {adminMapRetryingJobId === job.id ? t('dashboard.adminMapRetrying') : t('dashboard.adminMapRetry')}
                          </button>
                        </div>
                      ) : null}
                      <div className="admin-map-job-targets">
                        {(Array.isArray(job?.targets) ? job.targets : []).map((target) => (
                          <div className="admin-map-job-target" key={target.id}>
                            <span>{target?.target_label || target?.target_key || '-'}</span>
                            <span className={mapDeployStatusClass(target?.deploy_status)}>{mapDeployStatusLabel(target?.deploy_status)}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))
                )}
              </div>
            </article>
          ) : null}

          {activeSection === 'admin-maintenance' && isOperator ? (
            <article className="panel">
              <h3>{maintenanceText.title}</h3>
              <p className="muted">{maintenanceText.body}</p>

              <div className="admin-form-grid">
                <label>
                  {maintenanceText.server}
                  <select
                    value={adminMaintenanceServerKey}
                    onChange={(event) => setAdminMaintenanceServerKey(event.target.value)}
                    disabled={adminMaintenanceLoading || adminMaintenanceSubmitting}
                  >
                    {adminMaintenanceServers.length === 0 ? (
                      <option value="">No servers configured</option>
                    ) : (
                      adminMaintenanceServers.map((entry) => (
                        <option key={String(entry?.key || '')} value={String(entry?.key || '')}>
                          {String(entry?.label || entry?.key || '-')}
                        </option>
                      ))
                    )}
                  </select>
                </label>

                <label>
                  {maintenanceText.enabled}
                  <button
                    className={`trail-toggle${adminMaintenanceEnabled ? ' is-on' : ''}`}
                    type="button"
                    role="switch"
                    aria-checked={adminMaintenanceEnabled}
                    onClick={() => setAdminMaintenanceEnabled((prev) => !prev)}
                    disabled={adminMaintenanceLoading || adminMaintenanceSubmitting || !adminMaintenanceServerKey}
                  >
                    <span className="trail-toggle-knob" />
                  </button>
                </label>

                <label>
                  {maintenanceText.blockMessage}
                  <input
                    value={adminMaintenanceMessage}
                    maxLength={180}
                    onChange={(event) => setAdminMaintenanceMessage(event.target.value)}
                    placeholder="Server is under maintenance."
                    disabled={adminMaintenanceLoading || adminMaintenanceSubmitting || !adminMaintenanceServerKey}
                  />
                </label>

                <label>
                  {maintenanceText.allowIps}
                  <input
                    value={adminMaintenanceAllowIps}
                    onChange={(event) => setAdminMaintenanceAllowIps(event.target.value)}
                    placeholder="127.0.0.1;10.0.0.5"
                    disabled={adminMaintenanceLoading || adminMaintenanceSubmitting}
                  />
                </label>
              </div>

              <div className="admin-actions">
                <button
                  className="btn ghost"
                  type="button"
                  onClick={refreshAdminMaintenance}
                  disabled={adminMaintenanceLoading || adminMaintenanceSubmitting}
                >
                  {adminMaintenanceLoading ? maintenanceText.refreshing : maintenanceText.refresh}
                </button>
                <button
                  className="btn admin-main-action"
                  type="button"
                  onClick={onAdminMaintenanceApply}
                  disabled={adminMaintenanceLoading || adminMaintenanceSubmitting || !adminMaintenanceServerKey}
                >
                  {adminMaintenanceSubmitting ? maintenanceText.applying : maintenanceText.apply}
                </button>
              </div>

              {adminMaintenanceLastPush ? (
                <p className={adminMaintenanceLastPush.ok ? 'status-text status-normal' : 'status-text status-permanent'}>
                  {maintenanceText.result}: {String(adminMaintenanceLastPush.message || (adminMaintenanceLastPush.ok ? 'ok' : 'failed'))}
                </p>
              ) : null}

              <div className="dashboard-nav-divider" />
              <h3>{maintenanceText.scheduleTitle}</h3>
              <p className="muted">{maintenanceText.scheduleBody}</p>

              <div className="admin-form-grid">
                <label>
                  {maintenanceText.servers}
                  <div className="admin-map-target-grid">
                    {adminMaintenanceServers.length === 0 ? (
                      <p className="muted">No maintenance server routes configured.</p>
                    ) : (
                      adminMaintenanceServers.map((entry) => {
                        const key = String(entry?.key || '');
                        const selected = adminMaintenanceScheduleServerKeys.includes(key);
                        return (
                          <button
                            key={key}
                            className={`trail-extra-option${selected ? ' is-selected' : ''}`}
                            type="button"
                            onClick={() => {
                              setAdminMaintenanceScheduleServerKeys((prev) => (
                                prev.includes(key)
                                  ? prev.filter((value) => value !== key)
                                  : [...prev, key]
                              ));
                            }}
                            aria-pressed={selected}
                            disabled={adminMaintenanceLoading || adminMaintenanceScheduleSubmitting}
                          >
                            <span className="trail-extra-label">{String(entry?.label || entry?.key || '-')}</span>
                            <span className="trail-extra-check" aria-hidden="true" />
                          </button>
                        );
                      })
                    )}
                  </div>
                </label>
                <label>
                  {maintenanceText.startDate}
                  <input
                    type="date"
                    value={adminMaintenanceScheduleDate}
                    onChange={(event) => setAdminMaintenanceScheduleDate(event.target.value)}
                    disabled={adminMaintenanceLoading || adminMaintenanceScheduleSubmitting}
                  />
                </label>
                <label>
                  {maintenanceText.startTime}
                  <input
                    type="time"
                    value={adminMaintenanceScheduleTime}
                    onChange={(event) => setAdminMaintenanceScheduleTime(event.target.value)}
                    disabled={adminMaintenanceLoading || adminMaintenanceScheduleSubmitting}
                  />
                </label>
                <label>
                  {maintenanceText.interval}
                  <input
                    type="number"
                    min={1}
                    max={120}
                    step={1}
                    value={adminMaintenanceScheduleInterval}
                    onChange={(event) => setAdminMaintenanceScheduleInterval(event.target.value)}
                    disabled={adminMaintenanceLoading || adminMaintenanceScheduleSubmitting}
                  />
                </label>
                <label>
                  {maintenanceText.scheduleBlockMessage}
                  <input
                    value={adminMaintenanceScheduleMessage}
                    onChange={(event) => setAdminMaintenanceScheduleMessage(event.target.value)}
                    placeholder={adminMaintenanceMessage || 'Server is under maintenance.'}
                    disabled={adminMaintenanceLoading || adminMaintenanceScheduleSubmitting}
                  />
                </label>
                <label>
                  {maintenanceText.scheduleAllowIps}
                  <input
                    value={adminMaintenanceScheduleAllowIps}
                    onChange={(event) => setAdminMaintenanceScheduleAllowIps(event.target.value)}
                    placeholder={adminMaintenanceAllowIps || '127.0.0.1;10.0.0.5'}
                    disabled={adminMaintenanceLoading || adminMaintenanceScheduleSubmitting}
                  />
                </label>
              </div>

              <div className="admin-actions">
                <button
                  className="btn admin-main-action"
                  type="button"
                  onClick={onAdminMaintenanceScheduleApply}
                  disabled={adminMaintenanceLoading || adminMaintenanceScheduleSubmitting || adminMaintenanceScheduleServerKeys.length === 0}
                >
                  {adminMaintenanceScheduleSubmitting ? maintenanceText.scheduling : maintenanceText.saveSchedule}
                </button>
              </div>

              <div className="dashboard-nav-divider" />
              <h3>{maintenanceText.serverStatus}</h3>
              <div className="admin-map-job-list">
                {adminMaintenanceServers.length === 0 ? (
                  <div className="admin-user-list-empty">{maintenanceText.noRoutes}</div>
                ) : (
                  adminMaintenanceServers.map((entry) => (
                    <section className="admin-map-job-card" key={String(entry?.key || '')}>
                      <div className="admin-map-job-head">
                        <div>
                          <strong>{String(entry?.label || entry?.key || '-')}</strong>
                          <p className="muted">{String(entry?.key || '-')}</p>
                        </div>
                        <span className={entry?.enabled ? 'status-text status-permanent' : 'status-text status-normal'}>
                          {entry?.enabled ? maintenanceText.maintenanceOn : maintenanceText.maintenanceOff}
                        </span>
                      </div>
                      <div className="admin-map-job-meta">
                        <span>{entry?.pushConfigured ? maintenanceText.pushConfigured : maintenanceText.pushNotConfigured}</span>
                        <span>{entry?.updatedAt ? formatDateTimeShort(entry.updatedAt, locale) : '-'}</span>
                      </div>
                      <p className="muted">{String(entry?.blockMessage || '-')}</p>
                    </section>
                  ))
                )}
              </div>

              <div className="dashboard-nav-divider" />
              <h3>{maintenanceText.scheduledJobs}</h3>
              <div className="admin-map-job-list">
                {adminMaintenanceSchedules.length === 0 ? (
                  <div className="admin-user-list-empty">{maintenanceText.noSchedules}</div>
                ) : (
                  adminMaintenanceSchedules.map((schedule) => {
                    const startAt = formatDateTimeShort(schedule?.startAt, locale);
                    const activationAt = formatDateTimeShort(schedule?.activationAt, locale);
                    const isCanceled = String(schedule?.state || '') === 'canceled';
                    const isActive = String(schedule?.state || '') === 'active';
                    return (
                      <section className="admin-map-job-card" key={String(schedule?.id || `${schedule?.serverKey}-${schedule?.startAt}`)}>
                        <div className="admin-map-job-head">
                          <div>
                            <strong>{String(schedule?.serverLabel || schedule?.serverKey || '-')}</strong>
                            <p className="muted">{maintenanceText.start}: {startAt}</p>
                          </div>
                          <span className={isCanceled ? 'status-text status-temporary' : (isActive ? 'status-text status-normal' : 'status-text status-permanent')}>
                            {isCanceled ? maintenanceText.canceled : (isActive ? maintenanceText.active : maintenanceText.scheduled)}
                          </span>
                        </div>
                        <div className="admin-map-job-meta">
                          <span>{maintenanceText.activate}: {activationAt}</span>
                          <span>{maintenanceText.intervalShort}: {Number(schedule?.announcementIntervalMinutes || 5)}m</span>
                        </div>
                        <p className="muted">{String(schedule?.blockMessage || '-')}</p>
                        {isCanceled ? null : (
                          <div className="admin-actions">
                            <button
                              className="btn ghost"
                              type="button"
                              onClick={() => onAdminMaintenanceCancelSchedule(schedule)}
                              disabled={adminMaintenanceScheduleSubmitting || adminMaintenanceCancelingScheduleId === String(schedule?.id || '')}
                            >
                              {adminMaintenanceCancelingScheduleId === String(schedule?.id || '') ? maintenanceText.canceling : maintenanceText.cancel}
                            </button>
                          </div>
                        )}
                      </section>
                    );
                  })
                )}
              </div>
            </article>
          ) : null}

          {activeSection === 'subscription-trail' ? (
            <article className="panel">
              <h3>{t('dashboard.subscriptionTrailTitle')}</h3>
              <div className="trail-setting-card">
                <div className="trail-toggle-row">
                  <div>
                    <p className="trail-toggle-title">{t('dashboard.subscriptionTrailToggleLabel')}</p>
                  </div>
                  <button
                    className={`trail-toggle${adminTrailEnabled ? ' is-on' : ''}`}
                    type="button"
                    role="switch"
                    aria-checked={adminTrailEnabled}
                    onClick={onAdminTrailToggle}
                    disabled={trailFeatureLocked || adminTrailLoading || adminTrailSubmitting}
                  >
                    <span className="trail-toggle-knob" />
                  </button>
                </div>

                <div className={`trail-mode-box${trailModeDisabled ? ' is-disabled' : ''}`} ref={adminTrailMenuRef}>
                  <p className="trail-mode-label">{t('dashboard.subscriptionTrailModeLabel')}</p>
                  <button
                    className={`trail-mode-trigger${adminTrailMenuOpen ? ' is-open' : ''}`}
                    type="button"
                    onClick={() => {
                      if(trailModeDisabled) {
                        return;
                      }
                      setAdminTrailMenuOpen((prev) => !prev);
                    }}
                    disabled={trailModeDisabled}
                    aria-expanded={adminTrailMenuOpen}
                  >
                    <span>{currentTrailModeLabel}</span>
                    <span className="trail-mode-caret">⌄</span>
                  </button>
                  {adminTrailMenuOpen ? (
                    <div className="trail-mode-list" role="listbox">
                      {trailModeOptions.map((option) => (
                        <button
                          key={option.value}
                          className={`trail-mode-option${adminTrailMode === option.value ? ' is-selected' : ''}`}
                          type="button"
                          onClick={() => onAdminTrailModeSelect(option.value)}
                        >
                          <span>{option.label}</span>
                          {adminTrailMode === option.value ? <span className="trail-mode-check">✓</span> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="trail-toggle-row">
                  <div>
                    <p className="trail-toggle-title">{t('dashboard.subscriptionTrailExtraToggleLabel')}</p>
                    <p className="trail-toggle-subtitle">{t('dashboard.subscriptionTrailExtraToggleDesc')}</p>
                  </div>
                  <button
                    className={`trail-toggle${adminTrailExtraEnabled ? ' is-on' : ''}`}
                    type="button"
                    role="switch"
                    aria-checked={adminTrailExtraEnabled}
                    onClick={onAdminTrailExtraToggle}
                    disabled={trailFeatureLocked || adminTrailLoading || adminTrailSubmitting}
                  >
                    <span className="trail-toggle-knob" />
                  </button>
                </div>

                <div className={`trail-extra-box${trailExtraDisabled ? ' is-disabled' : ''}`}>
                  <p className="trail-mode-label">{t('dashboard.subscriptionTrailExtraListLabel')}</p>
                  <div className="trail-extra-grid">
                    <button
                      className={`trail-extra-option${adminTrailExtraHook ? ' is-selected' : ''}`}
                      type="button"
                      onClick={() => onAdminTrailExtraOptionToggle('extraEndlessHook')}
                      disabled={trailExtraDisabled}
                      aria-pressed={adminTrailExtraHook}
                    >
                      <span className="trail-extra-label">{t('dashboard.subscriptionTrailExtraHook')}</span>
                      <span className="trail-extra-check" aria-hidden="true" />
                    </button>
                    <button
                      className={`trail-extra-option${adminTrailExtraJump ? ' is-selected' : ''}`}
                      type="button"
                      onClick={() => onAdminTrailExtraOptionToggle('extraEndlessJump')}
                      disabled={trailExtraDisabled}
                      aria-pressed={adminTrailExtraJump}
                    >
                      <span className="trail-extra-label">{t('dashboard.subscriptionTrailExtraJump')}</span>
                      <span className="trail-extra-check" aria-hidden="true" />
                    </button>
                    <button
                      className={`trail-extra-option${adminTrailExtraJetpack ? ' is-selected' : ''}`}
                      type="button"
                      onClick={() => onAdminTrailExtraOptionToggle('extraJetpack')}
                      disabled={trailExtraDisabled}
                      aria-pressed={adminTrailExtraJetpack}
                    >
                      <span className="trail-extra-label">{t('dashboard.subscriptionTrailExtraJetpack')}</span>
                      <span className="trail-extra-check" aria-hidden="true" />
                    </button>
                    <p className="trail-extra-warning">{t('dashboard.subscriptionTrailExtraJetpackWarning')}</p>
                  </div>
                </div>
              </div>
            </article>
          ) : null}

        </div>
      </section>

      {showRotateConfirm ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t('dashboard.rotateWarnTitle')}>
          <section className="modal-card">
            <h3>{t('dashboard.rotateWarnTitle')}</h3>
            <p className="muted">{t('dashboard.rotateWarnBody')}</p>
            <div className="modal-actions">
              <button className="btn ghost" type="button" onClick={() => setShowRotateConfirm(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setShowRotateConfirm(false);
                  executeRotate();
                }}
              >
                {t('dashboard.rotateWarnConfirm')}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showDummyRotateConfirm ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t('dashboard.dummyRotateWarnTitle')}>
          <section className="modal-card">
            <h3>{t('dashboard.dummyRotateWarnTitle')}</h3>
            <p className="muted">{t('dashboard.dummyRotateWarnBody')}</p>
            <div className="modal-actions">
              <button className="btn ghost" type="button" onClick={() => setShowDummyRotateConfirm(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setShowDummyRotateConfirm(false);
                  executeDummyRotate();
                }}
              >
                {t('dashboard.dummyRotateWarnConfirm')}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showDummyFirstIssue ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t('dashboard.dummyFirstIssueTitle')}>
          <section className="modal-card">
            <h3>{t('dashboard.dummyFirstIssueTitle')}</h3>
            <p className="muted">{t('dashboard.dummyFirstIssueBody')}</p>
            <label className="field">
              <input
                value={dummyNameForm}
                onChange={(event) => setDummyNameForm(event.target.value)}
                maxLength={32}
                autoComplete="nickname"
                autoFocus
              />
            </label>
            <div className="modal-actions">
              <button className="btn ghost" type="button" onClick={() => setShowDummyFirstIssue(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn"
                type="button"
                onClick={async () => {
                  const initialName = dummyNameForm.trim();
                  if(!initialName) {
                    setFeedback({ type: 'error', message: t('dashboard.dummyNameRequired') });
                    return;
                  }
                  setShowDummyFirstIssue(false);
                  await executeDummyRotate(initialName);
                }}
              >
                {t('dashboard.dummyFirstIssueConfirm')}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showNameConfirm ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t('dashboard.nameWarnTitle')}>
          <section className="modal-card">
            <h3>{t('dashboard.nameWarnTitle')}</h3>
            <p className="muted">{t('dashboard.nameWarnBody')}</p>
            <div className="modal-actions">
              <button className="btn ghost" type="button" onClick={() => setShowNameConfirm(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn"
                type="button"
                onClick={async () => {
                  setShowNameConfirm(false);
                  await saveName();
                }}
              >
                {t('dashboard.nameWarnConfirm')}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showEmailVerifyModal ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t('dashboard.emailVerifyTitle')}>
          <section className="modal-card">
            <h3>{t('dashboard.emailVerifyTitle')}</h3>
            <p className="muted">{t('dashboard.emailVerifyBody')}</p>
            <p className="muted email-verify-address">{maskEmail(user?.email)}</p>
            <label className="field">
              <div className="verify-code-row">
                <div className="verify-code-input-wrap">
                  <input
                    value={verifyCodeInput}
                    onChange={(event) => setVerifyCodeInput(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder={t('dashboard.emailVerifyCodePlaceholder')}
                    autoFocus
                    required
                  />
                  {verifyTimerText ? <span className="verify-code-timer">{verifyTimerText}</span> : null}
                </div>
                <button
                  className="btn ghost verify-resend-btn"
                  type="button"
                  onClick={onVerifyResend}
                  disabled={verifyResending || verifyResendCooldownSec > 0}
                >
                  {verifyResending
                    ? t('dashboard.emailVerifyResending')
                    : verifyResendCooldownSec > 0
                      ? `${t('dashboard.emailVerifyResend')} (${verifyResendCooldownSec}s)`
                      : t('dashboard.emailVerifyResend')}
                </button>
              </div>
            </label>
            <div className="modal-actions">
              <button className="btn ghost" type="button" onClick={() => setShowEmailVerifyModal(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn" type="button" onClick={onVerifyEmail} disabled={verifySubmitting || verifyCodeInput.length !== 6}>
                {verifySubmitting ? t('dashboard.emailVerifyVerifying') : t('dashboard.emailVerifySubmit')}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showAdminBanConfirm && adminSelectedUser ? (
        <div className="modal-backdrop modal-backdrop-ban" role="dialog" aria-modal="true" aria-label={t('dashboard.adminBanConfirmTitle')}>
          <section className="modal-card modal-card-ban">
            <h3>{t('dashboard.adminBanConfirmTitle')}</h3>
            <p className="muted">
              {adminBanUntilText
                ? t('dashboard.adminBanConfirmBodyUntil', {
                  name: adminSelectedUser.username || '-',
                  time: adminBanUntilText,
                })
                : t('dashboard.adminBanConfirmBodyPermanent', {
                  name: adminSelectedUser.username || '-',
                })}
            </p>
            <p className="muted">{t('dashboard.adminBanConfirmBodyLive')}</p>
            <div className="modal-actions modal-actions-even">
              <button className="btn ghost" type="button" onClick={() => setShowAdminBanConfirm(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn" type="button" onClick={onAdminBan} disabled={adminSubmitting}>
                {t('dashboard.adminBanConfirmAction')}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showAdminGrantConfirm && adminSelectedUser ? (
        <div className="modal-backdrop modal-backdrop-ban" role="dialog" aria-modal="true" aria-label={t('dashboard.adminGrantConfirmTitle')}>
          <section className="modal-card modal-card-ban">
            <h3>{t('dashboard.adminGrantConfirmTitle')}</h3>
            <p className="muted">
              {t('dashboard.adminGrantConfirmBody', {
                name: adminSelectedUser.username || '-',
                plan: adminGrantPlanKey === 'plus' ? t('dashboard.subscriptionPlanPlus') : t('dashboard.subscriptionPlanStarter'),
                months: parsedGrantMonths,
              })}
            </p>
            <div className="modal-actions modal-actions-even">
              <button className="btn ghost" type="button" onClick={() => setShowAdminGrantConfirm(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn" type="button" onClick={onAdminGrantMonths} disabled={adminGrantSubmitting}>
                {t('dashboard.adminBanConfirmAction')}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <Feedback feedback={feedback} />
    </main>
  );
}
