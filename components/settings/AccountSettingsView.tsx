'use client';

/**
 * Account Settings View
 *
 * AngularJS sources:
 * - web_app/src/app/settings/templates/accountSettingsView.tpl.html
 * - web_app/src/app/settings/cnvMyAccSettings.js
 * - web_app/src/app/components/authCodesModal/cnvAuthCodes.tpl.html
 * - web_app/src/app/components/authCodesModal/cnvAuthCodesModalCtrl.js
 * - web_app/src/app/components/authCodesModal/styles.less
 * - web_app/src/app/components/authCodesModal/styles-print.less
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useLogout } from '@/lib/hooks/use-auth';
import { useUsers } from '@/lib/hooks/use-users';
import {
  useBackupCodes,
  useChangeEmail,
  useDeactivateMfa,
  useExpireAllOtherSessions,
  useGeneralSettings,
  useHideUserInfo,
  useRemoveUserFromNetwork,
  useResetPassword,
  type MultiFactorAuth,
} from '@/lib/hooks/use-settings';
import {
  setAdminDefinedPasswordPolicy,
  classifyFulfilledAndUnfulfilledConstraintsByPassword,
  checkIfAllConstraintsAreMet,
  type PasswordConstraint,
} from '@/lib/utils/password-policy';

const SIGNUP_WITH_WORK_EMAIL = 1;
const SIGNUP_WITH_PERSONAL_EMAIL = 2;
const SIGNUP_WITH_PHONE = 3;

function toInt(val: unknown, fallback = 0): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'string' && val.trim().length) {
    const n = Number(val);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

function firstNonEmptyString(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
    if (v && typeof v === 'object') continue;
  }
  return '';
}

function getTwoFactorAuthUrl(): string {
  // Angular: config.TWO_FACTOR_AUTH_URL = APP_BASE_URL + 'mfa/#/'
  // In Next.js, match the same-origin behavior.
  return '/mfa/#/';
}

function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.width = '1px';
  textarea.style.height = '1px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
  return Promise.resolve();
}

type BackupCode = { backup_code: string; consumed_at?: unknown };

function BackupCodesModal({
  accountName,
  backupCodes,
  onClose,
}: {
  accountName: string;
  backupCodes: BackupCode[];
  onClose: () => void;
}) {
  const [copiedText, setCopiedText] = useState(false);
  const copiedTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    document.body.classList.add('visible-dialog-only-on-print');
    return () => {
      document.body.classList.remove('visible-dialog-only-on-print');
    };
  }, []);

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) window.clearTimeout(copiedTimeoutRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    await copyToClipboard(backupCodes.map((obj) => obj.backup_code).join('\n'));
    setCopiedText(true);
    if (copiedTimeoutRef.current) window.clearTimeout(copiedTimeoutRef.current);
    copiedTimeoutRef.current = window.setTimeout(() => setCopiedText(false), 3000);
  }, [backupCodes]);

  return (
    <>
      <div className="modal-backdrop in" onMouseDown={onClose} />
      <div className="modal fade in cnv-modal backup-codes" role="dialog" aria-modal="true">
        <div className="modal-dialog cnv-modal-dialog" role="document" style={{ maxWidth: '382px' }}>
          <div className="modal-content">
            <div className="modal-header" style={{ padding: '15px 24px 15px 18px' }}>
              <h4 className="title" style={{ fontSize: '16px', fontWeight: 'bold' }}>
                Print out your backup codes
              </h4>
              <button type="button" className="close" onClick={onClose} aria-label="Close">
                ×
              </button>
            </div>
            <div className="modal-body" style={{ padding: '15px 18px' }}>
              <p className="backup-code-note" style={{ fontSize: '13px', color: 'black' }}>
                Print out your backup codes, and store it somewhere safe. If you lose access to your authentication device,
                you can use one of these backup codes to login to your account. Each code may be used only once.
              </p>

              <div className="print" style={{ display: 'none' }}>
                {accountName} two-factor authentication backup codes - Convo
              </div>

              <div className="backup-codes-wrap">
                {copiedText && <span className="copied-text">Copied</span>}
                <ul className="backup-codes">
                  {backupCodes.map((bc, idx) => (
                    <li key={`${bc.backup_code}-${idx}`}>
                      <span className={bc.consumed_at ? 'used' : undefined}>{bc.backup_code}</span>
                    </li>
                  ))}
                </ul>

                <div className="backup-codes-options">
                  <button className="btn" type="button" onClick={() => window.print()}>
                    Print Codes
                  </button>
                  <button className="btn" type="button" onClick={handleCopy}>
                    Copy Codes
                  </button>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-primary" type="button" onClick={onClose}>
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function PromptModal({
  title,
  message,
  okLabel,
  cancelLabel,
  onOk,
  onCancel,
}: {
  title: string;
  message: string;
  okLabel: string;
  cancelLabel: string;
  onOk: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div className="modal-backdrop in" onMouseDown={onCancel} />
      <div className="modal fade in cnv-modal" role="dialog" aria-modal="true">
        <div className="modal-dialog cnv-modal-dialog" role="document" style={{ width: '520px' }}>
          <div className="modal-content">
            <div className="modal-header">
              <h4>{title}</h4>
              <button type="button" className="close" onClick={onCancel} aria-label="Close">
                ×
              </button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: '14px', color: '#2b2b2b', lineHeight: 1.5 }}>{message}</div>
              <div style={{ marginTop: '20px', textAlign: 'right' }}>
                <button type="button" className="btn btn-default" onClick={onCancel} style={{ marginRight: '10px' }}>
                  {cancelLabel}
                </button>
                <button type="button" className="btn btn-primary" onClick={onOk}>
                  {okLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AccountSettingsView() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const loginData = useAuthStore((s) => s.loginData);
  const account = useAuthStore((s) => s.account);
  const logout = useLogout();

  const {
    data: settings,
    isLoading: settingsLoading,
    isError: settingsError,
    error: settingsErrorObj,
    refetch: refetchSettings,
  } = useGeneralSettings(true);
  const resetPasswordMutation = useResetPassword();
  const changeEmailMutation = useChangeEmail();
  const hideUserInfoMutation = useHideUserInfo();
  const expireSessionsMutation = useExpireAllOtherSessions();
  const deactivateMfaMutation = useDeactivateMfa();
  const removeUserMutation = useRemoveUserFromNetwork();

  const backupCodesQuery = useBackupCodes();

  const [newEmail, setNewEmail] = useState('');
  const [passwordHighlight, setPasswordHighlight] = useState<{ fulfilled: boolean; notFulfilled: boolean }>({
    fulfilled: false,
    notFulfilled: false,
  });
  const [passwordText, setPasswordText] = useState('');
  const [passwordConstraints, setPasswordConstraints] = useState<PasswordConstraint[]>([]);

  const [displayPhoneToEveryone, setDisplayPhoneToEveryone] = useState(0);
  const [displayEmailToEveryone, setDisplayEmailToEveryone] = useState(0);

  const [multiFactorAuth, setMultiFactorAuth] = useState<MultiFactorAuth | null>(null);

  const [bannerText, setBannerText] = useState<string | null>(null);
  const bannerTimeoutRef = useRef<number | null>(null);

  const [isBackupCodesModalOpen, setIsBackupCodesModalOpen] = useState(false);
  const [isDisableAccountModalOpen, setIsDisableAccountModalOpen] = useState(false);

  const currentPasswordRef = useRef<HTMLInputElement>(null);
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const newEmailRef = useRef<HTMLInputElement>(null);

  const sessionUser = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return (window as any)?.com_convo?.sessionData?.signInResponseData?.user ?? null;
  }, []);

  const currentUserId = useMemo(() => {
    const anyUser: any = user || {};
    const anyLogin: any = loginData || {};
    const anySession: any = sessionUser || {};
    return firstNonEmptyString(
      anyUser.user_id,
      anyUser.userId,
      anyLogin.user?.user_id,
      anyLogin.user?.userId,
      anySession.user_id,
      anySession.userId
    );
  }, [loginData, sessionUser, user]);

  const usersQuery = useUsers(Boolean(!((user as any)?.email) || !toInt((user as any)?.sign_up_identity, 0)));
  const meFromUsers = useMemo(() => {
    if (!currentUserId) return null;
    return usersQuery.data?.usersMap?.[currentUserId] ?? null;
  }, [currentUserId, usersQuery.data?.usersMap]);

  const userEmail = useMemo(() => {
    const anyUser: any = user || {};
    const anyLogin: any = loginData || {};
    const anySession: any = sessionUser || {};
    const anyMe: any = meFromUsers || {};
    return firstNonEmptyString(
      anyUser.email,
      anyUser.user_info?.email,
      anyUser.userInfo?.email,
      anyLogin.user?.email,
      anyLogin.user?.user_info?.email,
      anySession.email,
      anySession.user_info?.email,
      anyMe.email
    );
  }, [loginData, meFromUsers, sessionUser, user]);

  const userPhone = useMemo(() => {
    const anyUser: any = user || {};
    const anyLogin: any = loginData || {};
    const anySession: any = sessionUser || {};
    const anyMe: any = meFromUsers || {};
    return firstNonEmptyString(
      anyUser.phone_no,
      anyUser.phone,
      anyUser.phone_number,
      anyUser.user_info?.phone,
      anyLogin.user?.phone_no,
      anyLogin.user?.phone,
      anySession.phone_no,
      anySession.phone,
      anyMe.phone_no,
      anyMe.phone
    );
  }, [loginData, meFromUsers, sessionUser, user]);

  const signUpIdentity = useMemo(() => {
    const anyUser: any = user || {};
    const anyLogin: any = loginData || {};
    const anySession: any = sessionUser || {};
    const anyMe: any = meFromUsers || {};
    return toInt(
      anyUser.sign_up_identity ??
        anyUser.signUpIdentity ??
        anyLogin.user?.sign_up_identity ??
        anySession.sign_up_identity ??
        anyMe.sign_up_identity,
      0
    );
  }, [loginData, meFromUsers, sessionUser, user]);

  const showWorkEmailSection = Boolean(
    userEmail && (signUpIdentity === SIGNUP_WITH_WORK_EMAIL || signUpIdentity === 0)
  );

  const isAdmin = useMemo(() => {
    const anyUser: any = user || {};
    const anyLogin: any = loginData || {};
    const anySession: any = sessionUser || {};
    const anyMe: any = meFromUsers || {};
    return Boolean(
      anyUser.isAdmin ??
        anyUser.is_admin ??
        anyLogin.user?.isAdmin ??
        anyLogin.user?.is_admin ??
        anySession.isAdmin ??
        anySession.is_admin ??
        anyMe.isAdmin ??
        anyMe.is_admin
    );
  }, [loginData, meFromUsers, sessionUser, user]);

  const isGuest = useMemo(() => {
    const anyUser: any = user || {};
    const anyLogin: any = loginData || {};
    const anySession: any = sessionUser || {};
    const anyMe: any = meFromUsers || {};
    return Boolean(
      anyUser.is_guest_user ??
        anyLogin.user?.is_guest_user ??
        anySession.is_guest_user ??
        anyMe.is_guest_user
    );
  }, [loginData, meFromUsers, sessionUser, user]);

  const canEditLogin = useMemo(() => {
    // Angular disables only when SSO is enforced (is_sso_optional == 0) AND user isn't admin/guest.
    // If backend omits this field, default to optional (enabled) to avoid incorrectly locking the UI.
    const ssoOptional =
      toInt(
        (settings as any)?.sso_settings?.is_sso_optional ??
          (settings as any)?.ssoSettings?.is_sso_optional ??
          (settings as any)?.sso_settings?.sso_optional,
        1
      ) === 1;
    return ssoOptional || isAdmin || isGuest;
  }, [isAdmin, isGuest, settings]);

  const showBanner = useCallback((text: string) => {
    setBannerText(text);
    if (bannerTimeoutRef.current) window.clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = window.setTimeout(() => setBannerText(null), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (bannerTimeoutRef.current) window.clearTimeout(bannerTimeoutRef.current);
    };
  }, []);

  // INITIALIZE: matches cnvMyAccSettings.initialize()
  useEffect(() => {
    // If settings haven't loaded yet (or errored), keep the default rendering behavior.
    if (!settings) return;

    // Password policy
    setAdminDefinedPasswordPolicy((settings as any)?.password_policy);
    setPasswordText('');
    setPasswordHighlight({ fulfilled: false, notFulfilled: false });
    setPasswordConstraints(classifyFulfilledAndUnfulfilledConstraintsByPassword(''));

    // MFA
    const mfa = (settings as any)?.mfa as MultiFactorAuth | undefined;
    if (mfa) {
      const next: any = { ...mfa };
      if (next.mfa_enabled && Array.isArray(next.mfa_methods)) {
        next.mfa_methods.forEach((method: any) => {
          next[method.method] = method;
        });
      }
      setMultiFactorAuth(next);
    } else {
      // Angular shows the TWO-FACTOR AUTHENTICATION section in "inactive" state as long as the setting exists.
      // Some backend payloads omit `mfa`; to keep UI parity, default to inactive object.
      setMultiFactorAuth({
        mfa_enabled: false,
        allow_deactivate: false,
        mfa_methods: [],
      });
    }
  }, [settings]);

  // Display flags init: matches $scope.displayPhoneToEveryone / displayEmailToEveryone
  useEffect(() => {
    if (!user) return;
    setDisplayPhoneToEveryone(signUpIdentity === SIGNUP_WITH_PHONE && toInt((user as any).show_phone, 0) ? 1 : 0);
    setDisplayEmailToEveryone(signUpIdentity === SIGNUP_WITH_PERSONAL_EMAIL && toInt((user as any).show_email, 0) ? 1 : 0);
  }, [signUpIdentity, user]);

  // Backup codes into MFA: matches getBackupCodes()
  useEffect(() => {
    const resp: any = backupCodesQuery.data;
    if (!multiFactorAuth) return;
    if (resp?.type === 1 && resp?.data) {
      setMultiFactorAuth((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          backupCodes: resp.data.backup_codes,
          accountName: resp.data.account_name,
          num_of_unused_backup_codes: Array.isArray(resp.data.backup_codes) ? resp.data.backup_codes.filter((x: any) => !x.consumed_at).length : 0,
        };
      });
    }
  }, [backupCodesQuery.data, multiFactorAuth]);

  const updatePasswordConstraints = useCallback(
    (password: string, highlight: { fulfilled: boolean; notFulfilled: boolean }) => {
      setPasswordConstraints(classifyFulfilledAndUnfulfilledConstraintsByPassword(password));
      setPasswordHighlight(highlight);
    },
    []
  );

  const handleResetPassword = useCallback(() => {
    const curPass = currentPasswordRef.current?.value || '';
    const newPass = newPasswordRef.current?.value || '';

    if (!checkIfAllConstraintsAreMet(newPass)) {
      updatePasswordConstraints(newPass, { fulfilled: true, notFulfilled: true });
      return;
    }

    resetPasswordMutation.mutate(
      { current_password: curPass, new_password: newPass },
      {
        onSuccess: (resp: any) => {
          if (resp?.type === 1) {
            showBanner('Password updated.');
            if (currentPasswordRef.current) currentPasswordRef.current.value = '';
            if (newPasswordRef.current) newPasswordRef.current.value = '';
          } else if (resp?.type === 0 && resp?.message) {
            showBanner(String(resp.message));
          }

          updatePasswordConstraints('', { fulfilled: false, notFulfilled: false });
        },
        onError: (err: any) => {
          showBanner(err?.message ? String(err.message) : 'Failed to update password.');
          updatePasswordConstraints('', { fulfilled: false, notFulfilled: false });
        },
      }
    );
  }, [resetPasswordMutation, showBanner, updatePasswordConstraints]);

  const handleChangeEmail = useCallback(() => {
    const email = newEmailRef.current?.value || '';
    if (!email) return;

    changeEmailMutation.mutate(email, {
      onSuccess: (resp: any) => {
        if (resp?.type === 1) {
          showBanner('Email address updated.');
          if (newEmailRef.current) newEmailRef.current.value = '';
          setNewEmail('');
        } else if (resp?.type === 0 && resp?.message) {
          showBanner(String(resp.message));
        }
      },
      onError: (err: any) => {
        showBanner(err?.message ? String(err.message) : 'Failed to update email.');
      },
    });
  }, [changeEmailMutation, showBanner]);

  const handleUpdateDisplayStatus = useCallback(
    (prop: 'phone' | 'email', value: number) => {
      hideUserInfoMutation.mutate(
        { type: prop, value },
        {
          onError: () => {
            // Angular ignores errors here; keep parity (silent).
          },
        }
      );
    },
    [hideUserInfoMutation]
  );

  const handleSignOutAllOtherSessions = useCallback(() => {
    expireSessionsMutation.mutate(undefined, {
      onSuccess: (resp: any) => {
        if (resp?.type === 1) {
          showBanner("You're now signed out from all sessions except this.");
        }
      },
    });
  }, [expireSessionsMutation, showBanner]);

  const handleDeactivateMfa = useCallback(() => {
    if (!multiFactorAuth) return;
    setMultiFactorAuth({ ...multiFactorAuth, deactivating: true });

    deactivateMfaMutation.mutate(undefined, {
      onSuccess: async (resp: any) => {
        if (resp?.type === 1) {
          await refetchSettings();
          await backupCodesQuery.refetch();
          setMultiFactorAuth((prev) => (prev ? { ...prev, deactivating: false } : prev));
        } else {
          setMultiFactorAuth((prev) => (prev ? { ...prev, deactivating: false } : prev));
          if (resp?.message) showBanner(String(resp.message));
        }
      },
      onError: () => {
        setMultiFactorAuth((prev) => (prev ? { ...prev, deactivating: false } : prev));
      },
    });
  }, [backupCodesQuery, deactivateMfaMutation, multiFactorAuth, refetchSettings, showBanner]);

  const messageTitle = 'Disable your account';
  const messageText =
    'Are you sure you want to disable your account? You will be removed from ' +
    String((account as any)?.account_name || '') +
    ' network. Content shared by you will not be automatically deleted.';

  const handleDisableAccountConfirmed = useCallback(() => {
    const userId = String((user as any)?.user_id || (user as any)?.userId || '');
    setIsDisableAccountModalOpen(false);
    removeUserMutation.mutate(userId, {
      onSuccess: (resp: any) => {
        if (resp?.type === 1) {
          logout.mutate(undefined);
        }
      },
    });
  }, [logout, removeUserMutation, user]);

  const backupCodes = (multiFactorAuth as any)?.backupCodes as BackupCode[] | undefined;
  const accountNameForCodes = String((multiFactorAuth as any)?.accountName || '');

  const passwordPolicyEnabled = Boolean((settings as any)?.password_policy);

  const passwordPolicyList = useMemo(() => {
    // Always keep a stable list in UI (Angular always renders the ul and fills it).
    return passwordConstraints || [];
  }, [passwordConstraints]);

  const isNewEmailBtnDisabled = !newEmail || !canEditLogin || changeEmailMutation.isPending;
  const isPasswordInputsDisabled = !canEditLogin;

  // Always render MFA section like Angular does (inactive by default), even if settings fetch failed.
  const mfaForRender: MultiFactorAuth = (multiFactorAuth || {
    mfa_enabled: false,
    allow_deactivate: false,
    mfa_methods: [],
  }) as MultiFactorAuth;

  if (settingsLoading) {
    return (
      <div style={{ paddingLeft: '120px' }}>
        <div className="loading-spinner">
          <img src="/assets/img/feed/loading-spin.svg" alt="Loading icon" />
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingLeft: '120px' }}>
      {bannerText && (
        <div className="cnv-settings-saved-banner" role="status" aria-live="polite">
          {bannerText}
        </div>
      )}
      {/* If settings failed to load, still render the page (Angular keeps UI visible); show a subtle banner */}
      {settingsError && !bannerText && (
        <div className="cnv-settings-saved-banner" role="status" aria-live="polite">
          Failed to load some settings{settingsErrorObj ? `: ${(settingsErrorObj as any)?.message || ''}` : ''}.
        </div>
      )}

      <div className="header">My account</div>

      <div style={{ marginTop: '20px' }}></div>
      <div className="subHeader">MY LOGIN INFORMATION</div>
      <hr />

      {/* Work email login */}
      {showWorkEmailSection && (
        <div style={{ marginTop: '20px' }}>
          Your current login email: {userEmail}
          <div style={{ marginTop: '20px' }}></div>
          <div>
            <div style={{ display: 'inline-block', width: '120px' }}>New login email</div>
            <input
              id="newEmail"
              ref={newEmailRef}
              type="text"
              spellCheck={false}
              className="settings-custom"
              disabled={!canEditLogin}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <button
            id="emailBtn"
            onClick={handleChangeEmail}
            style={{ marginLeft: '144px', marginTop: '20px' }}
            type="button"
            className={`btn btn-primary ${isNewEmailBtnDisabled ? 'disabled' : ''}`}
            disabled={isNewEmailBtnDisabled}
          >
            Change email
          </button>
        </div>
      )}

      {/* Phone login */}
      {signUpIdentity === SIGNUP_WITH_PHONE && (
        <div style={{ marginTop: '20px' }} x-ms-format-detection="none">
          Your current phone number: {userPhone}
          <div style={{ marginTop: '20px' }}></div>
          <div>
            <input
              type="checkbox"
              name="show_phone_everyone"
              id="showPhoneEveryone"
              className="cnv-checkbox"
              checked={displayPhoneToEveryone === 1}
              onChange={(e) => {
                const val = e.target.checked ? 1 : 0;
                setDisplayPhoneToEveryone(val);
                handleUpdateDisplayStatus('phone', val);
              }}
            />
            <label htmlFor="showPhoneEveryone"></label>
            <span style={{ marginLeft: '10px' }}>Show my phone number to everyone</span>
          </div>
        </div>
      )}

      {/* Personal email login */}
      {signUpIdentity === SIGNUP_WITH_PERSONAL_EMAIL && (
        <div style={{ marginTop: '20px' }}>
          Your current login email: {userEmail}
          <div style={{ marginTop: '20px' }}></div>
          <div>
            <input
              type="checkbox"
              name="show_email_everyone"
              id="showEmailEveryone"
              className="cnv-checkbox"
              checked={displayEmailToEveryone === 1}
              onChange={(e) => {
                const val = e.target.checked ? 1 : 0;
                setDisplayEmailToEveryone(val);
                handleUpdateDisplayStatus('email', val);
              }}
            />
            <label htmlFor="showEmailEveryone"></label>
            <span style={{ marginLeft: '10px' }}>Show my email to everyone</span>
          </div>
        </div>
      )}

      <div style={{ marginTop: '20px' }}></div>
      <div className="subHeader">CHANGE PASSWORD</div>
      <hr />

      <div style={{ marginTop: '20px' }}></div>
      <div>
        <div style={{ display: 'inline-block', width: '120px' }}>Current password</div>
        <input id="curPass" ref={currentPasswordRef} className="settings-custom" type="password" disabled={isPasswordInputsDisabled} />

        {(toInt((settings as any)?.sso_settings?.is_sso_optional, 0) === 1 || isAdmin || isGuest) && (
          <div style={{ display: 'inline-block', marginLeft: '30px' }}>
            <a href="/app/forgot_password.php" target="_blank" rel="noopener noreferrer">
              Forgot your password?
            </a>
          </div>
        )}
      </div>

      <div className="clearfix" style={{ display: 'inline-block', marginTop: '20px', overflow: 'hidden' }}>
        <div style={{ display: 'inline-block' }}>
          <div style={{ display: 'inline-block', width: '120px' }}>New password</div>
          <input
            id="newPass"
            ref={newPasswordRef}
            className="settings-custom"
            type="password"
            disabled={isPasswordInputsDisabled}
            value={passwordText}
            onChange={(e) => {
              const v = e.target.value;
              setPasswordText(v);
              // input handler toggles button and highlights based on constraints
              if (v && currentPasswordRef.current?.value && checkIfAllConstraintsAreMet(v)) {
                // enabled via derived disabled attr below
              }
            }}
            onKeyUp={(e) => {
              if ((e as any).keyCode === 9 || e.key === 'Tab') return;
              updatePasswordConstraints((e.currentTarget as HTMLInputElement).value, { fulfilled: true, notFulfilled: false });
            }}
          />
          <button
            id="passBtn"
            style={{ display: 'block', marginLeft: '144px', marginTop: '20px' }}
            onClick={handleResetPassword}
            type="button"
            className={`btn btn-primary ${
              !currentPasswordRef.current?.value || !passwordText ? 'disabled' : ''
            }`}
            disabled={resetPasswordMutation.isPending || !currentPasswordRef.current?.value || !passwordText}
          >
            Change password
          </button>
        </div>

        {passwordPolicyEnabled && (
          <div id="password-policy-constraints">
            <div>Your password must:</div>
            <ul>
              {passwordPolicyList.map((c, idx) => {
                const fulfilled = (c as any).fulfilled === true || (c as any).fulfilled === '1';
                const isNotFulfilled = !fulfilled;
                const cls =
                  'cnv-list-style' +
                  (passwordHighlight.fulfilled && fulfilled ? ' fulfilled' : '') +
                  (passwordHighlight.notFulfilled && isNotFulfilled ? ' not-fulfilled' : '');

                return (
                  <li key={idx} className={cls}>
                    <div>{(c as any).constraint}</div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <br />
      <br />
      <br />

      {/* TWO-FACTOR AUTHENTICATION (always visible like Angular; inactive by default) */}
      <div>
        <div style={{ opacity: (mfaForRender as any).deactivating ? 0.6 : 1 }}>
            <div className="meta">
              <b>TWO-FACTOR AUTHENTICATION</b>
            </div>
            <hr />
            <div className="meta">
              Two-Factor authentication is <b>{mfaForRender.mfa_enabled ? 'active' : 'inactive'}</b>
            </div>
            <br />

            {!mfaForRender.mfa_enabled && (
              <div className="meta" style={{ width: '760px' }}>
                Protect your account with an extra layer of security by requiring access to your phone. Once configured,
                you'll be required to enter both your password and an authentication code from your mobile phone in order
                to sign in. <a href="https://convo.com/help/2fa">Learn more</a>.
                <br />
                <a href={getTwoFactorAuthUrl()} target="_blank" rel="noopener noreferrer">
                  <button className="btn btn-primary" style={{ margin: '10px 0px 6px 0px' }}>
                    Set up two-factor authentication
                  </button>
                </a>
                <div className="meta">Note: Activating two-factor authentication will sign you out of all other sessions.</div>
              </div>
            )}

            {mfaForRender.SMS && (mfaForRender.SMS as any).is_default && (
              <div className="meta">
                Authentication codes will be sent via SMS text message to&nbsp;<b>{(mfaForRender.SMS as any).phone_number}</b>
                &nbsp;<a href={`${getTwoFactorAuthUrl()}?view=sms_auth`}>Edit</a>
              </div>
            )}

            {mfaForRender.AUTH_APP && (mfaForRender.AUTH_APP as any).is_default && mfaForRender.SMS && (
              <div className="meta">
                Get your authentication codes via your&nbsp;<b>authentication app</b>&nbsp;
                <a href={`${getTwoFactorAuthUrl()}?view=authenticator_app`}>Edit</a>
              </div>
            )}

            {mfaForRender.AUTH_APP && (mfaForRender.AUTH_APP as any).is_default && !mfaForRender.SMS && (
              <div className="meta">
                Authentication codes will be sent to your&nbsp;<b>authentication app</b>&nbsp;
                <a href={`${getTwoFactorAuthUrl()}?view=authenticator_app`}>Edit</a>
              </div>
            )}

            {mfaForRender.SMS && !(mfaForRender.SMS as any).is_default && (
              <div className="meta">
                Your backup phone number is&nbsp;<b>{(mfaForRender.SMS as any).phone_number}</b>&nbsp;
                <a href={`${getTwoFactorAuthUrl()}?view=sms_auth`}>Edit</a>
              </div>
            )}

            {mfaForRender.AUTH_APP && !(mfaForRender.AUTH_APP as any).is_default && (
              <div className="meta">
                You have registered an&nbsp;<b>authentication</b>&nbsp;app as a backup option&nbsp;
                <a href={`${getTwoFactorAuthUrl()}?view=authenticator_app`}>Edit</a>
              </div>
            )}

            {mfaForRender.mfa_enabled && mfaForRender.SMS && !mfaForRender.AUTH_APP && (
              <a href={`${getTwoFactorAuthUrl()}?view=authenticator_app`} style={{ marginTop: '6px', display: 'inline-block' }}>
                Set up a backup option
              </a>
            )}

            {mfaForRender.mfa_enabled && !mfaForRender.SMS && mfaForRender.AUTH_APP && (
              <a href={`${getTwoFactorAuthUrl()}?view=sms_auth`} style={{ marginTop: '6px', display: 'inline-block' }}>
                Set up a backup option
              </a>
            )}

            {mfaForRender.mfa_enabled && Array.isArray(backupCodes) && backupCodes.length > 0 && (
              <div style={{ margin: '16px 0px' }}>
                <a
                  href="javascript:void(0);"
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.preventDefault();
                    setIsBackupCodesModalOpen(true);
                  }}
                >
                  <b>
                    You have <span>{(multiFactorAuth as any).num_of_unused_backup_codes}</span> unused backup codes &gt;
                  </b>
                </a>
              </div>
            )}

            {mfaForRender.mfa_enabled && (!mfaForRender.AUTH_APP || !(mfaForRender.AUTH_APP as any).is_default) && (
              <a href={`${getTwoFactorAuthUrl()}?view=authenticator_app&default=1`} style={{ textDecoration: 'none' }}>
                <button className="btn btn-primary">Use authentication app instead</button>
              </a>
            )}

            {mfaForRender.mfa_enabled && (!mfaForRender.SMS || !(mfaForRender.SMS as any).is_default) && (
              <a href={`${getTwoFactorAuthUrl()}?view=sms_auth&default=1`} style={{ textDecoration: 'none' }}>
                <button className="btn btn-primary">Use SMS instead</button>
              </a>
            )}

            {mfaForRender.mfa_enabled && (mfaForRender as any).allow_deactivate && (
              <a style={{ verticalAlign: 'middle' }} href="javascript:void(0);" onClick={(e) => { e.preventDefault(); handleDeactivateMfa(); }}>
                &nbsp;&nbsp;&nbsp;&nbsp;Deactivate two-factor authentication
              </a>
            )}
          </div>

        <br />
        <br />

        <div className="meta">
          <b>SIGN OUT OF ALL OTHER SESSIONS</b>
        </div>
        <hr />
        <div className="meta">Lost your phone or forgot to log out of a public computer? Sign out from everywhere except from here.</div>
        <button className="btn btn-primary" onClick={handleSignOutAllOtherSessions} style={{ marginTop: '10px' }} type="button">
          Sign out all other sessions
        </button>
      </div>

      <div style={{ marginTop: '40px' }}></div>
      <hr />
      <div style={{ marginTop: '20px' }}></div>

      <a
        href="javascript:void(0)"
        onClick={(e) => {
          e.preventDefault();
          setIsDisableAccountModalOpen(true);
        }}
      >
        Disable my account
      </a>

      <div style={{ marginTop: '10px', color: '#7b8386' }}>
        You will be removed from this network and lose access to all of company discussion. Content shared by you will not be automatically deleted.
      </div>

      <div style={{ marginTop: '60px' }}></div>

      {isBackupCodesModalOpen && Array.isArray(backupCodes) && (
        <BackupCodesModal accountName={accountNameForCodes} backupCodes={backupCodes} onClose={() => setIsBackupCodesModalOpen(false)} />
      )}

      {isDisableAccountModalOpen && (
        <PromptModal
          title={messageTitle}
          message={messageText}
          okLabel="Disable Account"
          cancelLabel="Cancel"
          onOk={handleDisableAccountConfirmed}
          onCancel={() => setIsDisableAccountModalOpen(false)}
        />
      )}

      <style jsx global>{`
        /* Backup codes modal styles (ported from authCodesModal/styles.less) */
        .cnv-modal.backup-codes .backup-codes-wrap {
          position: relative;
          background: #efefef;
          border: 1px solid #e0e0e0;
          border-radius: 3px;
          width: 260px;
          margin: 18px auto;
          text-align: center;
          padding: 15px 0px;
        }
        .cnv-modal.backup-codes .backup-codes-wrap .copied-text {
          position: absolute;
          right: 0px;
          top: 0px;
          padding: 4px 8px;
          background: #d8d8d8;
        }
        .cnv-modal.backup-codes ul.backup-codes {
          list-style: none;
          padding: 0;
          margin: 0;
          max-height: 220px;
          overflow: auto;
        }
        .cnv-modal.backup-codes ul.backup-codes li {
          font-weight: bold;
          padding: 0;
        }
        .cnv-modal.backup-codes ul.backup-codes li .used {
          position: relative;
          color: rgba(152, 152, 152, 1);
        }
        .cnv-modal.backup-codes ul.backup-codes li .used:before {
          content: '';
          position: absolute;
          top: 9px;
          left: 0px;
          width: 100%;
          background: #989898;
          height: 1px;
        }
        .cnv-modal.backup-codes .backup-codes-options {
          margin-top: 18px;
        }
        .cnv-modal.backup-codes .backup-codes-options .btn {
          color: black;
          min-width: 104px;
          background: #e0e0e0;
          border-radius: 2px;
          margin: 0px 4px;
        }
        .cnv-modal.backup-codes .modal-footer {
          border: none;
          margin: 4px 0px;
          padding: 0;
        }

        /* Print support (ported from styles-print.less) */
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .visible-dialog-only-on-print .settings-container {
            display: none !important;
          }
          .visible-dialog-only-on-print .cnv-modal.backup-codes .modal-dialog {
            max-width: 600px !important;
          }
          .visible-dialog-only-on-print .cnv-modal.backup-codes .modal-header {
            display: none !important;
          }
          .visible-dialog-only-on-print .cnv-modal.backup-codes .modal-body .print {
            display: block !important;
            text-align: center;
          }
          .visible-dialog-only-on-print .cnv-modal.backup-codes .backup-code-note,
          .visible-dialog-only-on-print .cnv-modal.backup-codes .backup-codes-options {
            display: none !important;
          }
          .visible-dialog-only-on-print .cnv-modal.backup-codes .modal-footer {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}


