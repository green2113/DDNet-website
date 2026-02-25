import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  adminBanAccount,
  adminDeletePatreonTier,
  adminGetPatreonTiers,
  adminGetTrailSettings,
  adminSearchUsers,
  adminUnbanAccount,
  adminUpdateTrailSettings,
  adminUpsertPatreonTier,
  getCurrentDummyGameCode,
  getCurrentGameCode,
  resendEmailVerification,
  rotateDummyGameCode,
  rotateGameCode,
  updateDummyProfileName,
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
  const [dummyNameForm, setDummyNameForm] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [editingDummyName, setEditingDummyName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingDummyName, setSavingDummyName] = useState(false);
  const [showCopyToast, setShowCopyToast] = useState(false);
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
  const [adminPatreonTierId, setAdminPatreonTierId] = useState('');
  const [adminPatreonTierTitle, setAdminPatreonTierTitle] = useState('');
  const [adminPatreonTierActive, setAdminPatreonTierActive] = useState(true);
  const [adminPatreonTiers, setAdminPatreonTiers] = useState([]);
  const [adminPatreonLoading, setAdminPatreonLoading] = useState(false);
  const [adminPatreonSubmitting, setAdminPatreonSubmitting] = useState(false);
  const [adminTrailEnabled, setAdminTrailEnabled] = useState(false);
  const [adminTrailMode, setAdminTrailMode] = useState(1);
  const [adminTrailLoading, setAdminTrailLoading] = useState(false);
  const [adminTrailSubmitting, setAdminTrailSubmitting] = useState(false);
  const adminPickerRef = useRef(null);
  const adminSearchInputRef = useRef(null);
  const adminUsersRequestIdRef = useRef(0);

  const currentName = String(user?.username || '');
  const currentDummyName = String(user?.dummy_name || '');
  const emailVerified = Number(user?.email_verified || 0) === 1;
  const signupCountry = String(user?.country_signup || '').toUpperCase();
  const canUseInvite = signupCountry === 'TW' || signupCountry === 'KR';
  const trimmedName = nameForm.trim();
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
  const canSaveName = editingName && !savingName && trimmedName.length > 0 && trimmedName !== currentName;
  const canSaveDummyName = editingDummyName && !dummyNameCooldownActive && !savingDummyName && trimmedDummyName.length > 0 && trimmedDummyName !== currentDummyName;
  const isDummyNameInputActive = editingDummyName || showDummyFirstIssue;
  const isAdmin = Number(user?.is_admin || 0) === 1;
  const isAdminSection = activeSection === 'admin-ban' || activeSection === 'admin-trail';
  const verifyRemainingSeconds = Math.min(600, Math.max(0, Math.ceil(verifyRemainingMs / 1000)));
  const verifyTimerText = verifyRemainingSeconds > 0
    ? `${String(Math.floor(verifyRemainingSeconds / 60)).padStart(2, '0')}:${String(verifyRemainingSeconds % 60).padStart(2, '0')}`
    : '';
  const parsedMinutes = Number(adminMinutes);
  const temporaryMinutesValid = Number.isInteger(parsedMinutes) && parsedMinutes >= 1 && parsedMinutes <= 1440;
  const adminMinutesNum = adminBanMode === 'permanent' ? 0 : parsedMinutes;
  const adminReasonValue = adminReasonPreset === 'custom'
    ? adminReasonCustom.trim()
    : adminReasonPreset;
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

  useEffect(() => {
    if(!isAdmin && isAdminSection) {
      setActiveSection('account');
    }
  }, [isAdmin, isAdminSection]);

  useEffect(() => {
    if(!isAdmin || activeSection !== 'admin-ban') {
      setAdminPickerOpen(false);
      adminUsersRequestIdRef.current += 1;
      return undefined;
    }
    refreshAdminUsers();
    refreshAdminPatreonTiers();
    return () => {
      adminUsersRequestIdRef.current += 1;
    };
  }, [isAdmin, activeSection]);

  const refreshAdminTrailSettings = async () => {
    setAdminTrailLoading(true);
    try {
      const result = await adminGetTrailSettings();
      setAdminTrailEnabled(Boolean(result?.trailEnabled));
      const modeRaw = Number(result?.trailMode || 1);
      const normalizedMode = Number.isFinite(modeRaw) && modeRaw >= 1 && modeRaw <= 3 ? Math.floor(modeRaw) : 1;
      setAdminTrailMode(normalizedMode);
    } catch (err) {
      setAdminTrailEnabled(false);
      setAdminTrailMode(1);
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setAdminTrailLoading(false);
    }
  };

  useEffect(() => {
    if(!isAdmin || activeSection !== 'admin-trail') {
      return;
    }
    refreshAdminTrailSettings();
  }, [isAdmin, activeSection]);

  useEffect(() => {
    if(!isAdmin || activeSection !== 'admin-ban' || !adminPickerOpen) {
      return;
    }
    refreshAdminUsers();
  }, [isAdmin, activeSection, adminPickerOpen]);

  useEffect(() => {
    setAdminBanMode('temporary');
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
        externalTierId: tierId,
        tierTitle: String(adminPatreonTierTitle || '').trim(),
        active: adminPatreonTierActive ? 1 : 0,
      });
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

  const onAdminTrailSave = async () => {
    if(adminTrailSubmitting) {
      return;
    }
    setAdminTrailSubmitting(true);
    setFeedback(null);
    try {
      await adminUpdateTrailSettings({
        enabled: adminTrailEnabled ? 1 : 0,
        mode: adminTrailMode,
      });
      setFeedback({ type: 'ok', message: t('dashboard.adminTrailSaved') });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setAdminTrailSubmitting(false);
    }
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
  const adminSearchLower = adminSearchName.trim().toLowerCase();
  const adminFilteredUsers = adminSearchLower
    ? adminUsers.filter((entry) => {
      const username = String(entry?.username || '').toLowerCase();
      const dummyName = String(entry?.dummy_name || '').toLowerCase();
      return username.includes(adminSearchLower) || dummyName.includes(adminSearchLower);
    })
    : adminUsers;
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
  const navItems = [
    { id: 'account', label: t('dashboard.accountTitle'), icon: iconUser },
    ...(canUseInvite ? [{ id: 'invite', label: t('dashboard.inviteTitle'), icon: iconEnvelope }] : []),
    { id: 'codes', label: t('dashboard.gameCodeTitle'), icon: iconKey },
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
          </nav>
          {isAdmin ? (
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
                className={`dashboard-nav-btn${activeSection === 'admin-trail' ? ' active' : ''}`}
                type="button"
                onClick={() => setActiveSection('admin-trail')}
              >
                <span className="dashboard-nav-icon" aria-hidden="true"><img src={iconSiren} alt="" /></span>
                <span>{t('dashboard.adminTrailNav')}</span>
              </button>
            </div>
          ) : null}
        </aside>

        <div className="dashboard-content">
          {activeSection === 'account' ? (
            <article className="panel">
          <h3>{t('dashboard.accountTitle')}</h3>
          <dl className="info">
            <dt>{t('dashboard.rowUserId')}</dt>
            <dd>{user?.id ?? '-'}</dd>
            <dt>{t('dashboard.rowUsername')}</dt>
            <dd>
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
            </dd>
            {(dummyCode || currentDummyName) ? (
              <>
                <dt>{t('dashboard.rowDummyName')}</dt>
                <dd>
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
                </dd>
              </>
            ) : null}

            <dt>{t('dashboard.rowEmail')}</dt>
            <dd>
              <div className="email-verify-row">
                <span>{maskEmail(user?.email)}</span>
                {emailVerified ? (
                  <span className="status-text status-normal">{t('dashboard.emailVerified')}</span>
                ) : (
                  <button className="btn ghost" type="button" onClick={openEmailVerifyModal}>{t('dashboard.emailVerifyAction')}</button>
                )}
              </div>
            </dd>
            <dt>{t('dashboard.rowAccess')}</dt>
            <dd><span className={`${accessStatusClass} preserve-lines`}>{accessStatusText}</span></dd>
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
            </div>
          ) : null}

          {activeSection === 'admin-ban' && isAdmin ? (
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
                                <span>{entry.username || '-'}</span>
                                <span>{entry.dummy_name || '-'}</span>
                                <Tooltip label={adminUserStatusText(entry)}>
                                  <span>{adminUserStatusCompact(entry)}</span>
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

              <div className="dashboard-nav-divider" />
              <h3>Patreon Plus Tier Rules</h3>
              <p className="muted">Only active patrons in allowed tiers are treated as Plus.</p>
              <div className="admin-form-grid">
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

          {activeSection === 'admin-trail' && isAdmin ? (
            <article className="panel">
              <h3>{t('dashboard.adminTrailTitle')}</h3>
              <p className="muted">{t('dashboard.adminTrailBody')}</p>
              <div className="admin-form-grid">
                <label>
                  {t('dashboard.adminTrailToggleLabel')}
                  <div className="admin-ban-mode-toggle">
                    <button
                      className={`btn ghost admin-ban-mode-btn${!adminTrailEnabled ? ' active' : ''}`}
                      type="button"
                      aria-pressed={!adminTrailEnabled}
                      onClick={() => setAdminTrailEnabled(false)}
                      disabled={adminTrailLoading || adminTrailSubmitting}
                    >
                      {!adminTrailEnabled ? `✓ ${t('dashboard.adminTrailOff')}` : t('dashboard.adminTrailOff')}
                    </button>
                    <button
                      className={`btn ghost admin-ban-mode-btn${adminTrailEnabled ? ' active' : ''}`}
                      type="button"
                      aria-pressed={adminTrailEnabled}
                      onClick={() => setAdminTrailEnabled(true)}
                      disabled={adminTrailLoading || adminTrailSubmitting}
                    >
                      {adminTrailEnabled ? `✓ ${t('dashboard.adminTrailOn')}` : t('dashboard.adminTrailOn')}
                    </button>
                  </div>
                </label>
                <label>
                  {t('dashboard.adminTrailModeLabel')}
                  <select
                    value={String(adminTrailMode)}
                    onChange={(event) => setAdminTrailMode(Number(event.target.value) || 1)}
                    disabled={adminTrailLoading || adminTrailSubmitting}
                  >
                    <option value="1">{t('dashboard.adminTrailMode1')}</option>
                    <option value="2">{t('dashboard.adminTrailMode2')}</option>
                    <option value="3">{t('dashboard.adminTrailMode3')}</option>
                  </select>
                </label>
              </div>
              <div className="admin-actions">
                <button
                  className="btn admin-main-action"
                  type="button"
                  onClick={onAdminTrailSave}
                  disabled={adminTrailLoading || adminTrailSubmitting}
                >
                  {adminTrailSubmitting ? t('dashboard.adminTrailSaving') : t('dashboard.adminTrailSave')}
                </button>
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

      <Feedback feedback={feedback} />
    </main>
  );
}
