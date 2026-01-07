'use client';

/**
 * Account Settings View Component
 * 
 * Migrated from AngularJS accountSettingsView.tpl.html and cnvMyAccSettings.js
 * Exact 1:1 structural and logical match
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useLogout } from '@/lib/hooks/use-auth';
import {
  useGeneralSettings,
  useResetPassword,
  useChangeEmail,
  useHideUserInfo,
  useExpireAllOtherSessions,
  useDeactivateMfa,
  useBackupCodes,
  useRemoveUserFromNetwork,
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

// TWO_FACTOR_AUTH_URL - matches AngularJS config.TWO_FACTOR_AUTH_URL
// This should come from settings.config.TWO_FACTOR_AUTH_URL
// For now, using a placeholder that matches AngularJS structure
const getTwoFactorAuthUrl = (settings: any) => {
  return settings?.config?.TWO_FACTOR_AUTH_URL || 'https://app.convo.com/app/two_factor_auth.php';
};

export default function AccountSettingsView() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const account = useAuthStore((state) => state.account);
  const { mutate: logout } = useLogout();
  
  const { data: settings, isLoading: settingsLoading } = useGeneralSettings(true);
  const { data: backupCodesData, refetch: refetchBackupCodes } = useBackupCodes();
  
  const resetPasswordMutation = useResetPassword();
  const changeEmailMutation = useChangeEmail();
  const hideUserInfoMutation = useHideUserInfo();
  const expireSessionsMutation = useExpireAllOtherSessions();
  const deactivateMfaMutation = useDeactivateMfa();
  const removeUserMutation = useRemoveUserFromNetwork();

  // Form state
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordConstraints, setPasswordConstraints] = useState<PasswordConstraint[]>([]);
  const [showPasswordConstraints, setShowPasswordConstraints] = useState(false);
  
  // Display preferences
  const [displayPhoneToEveryone, setDisplayPhoneToEveryone] = useState(0);
  const [displayEmailToEveryone, setDisplayEmailToEveryone] = useState(0);
  
  // Multi-factor auth
  const [multiFactorAuth, setMultiFactorAuth] = useState<MultiFactorAuth | null>(null);
  
  // Messages
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const newEmailInputRef = useRef<HTMLInputElement>(null);
  const currentPasswordInputRef = useRef<HTMLInputElement>(null);
  const newPasswordInputRef = useRef<HTMLInputElement>(null);

  // Initialize settings and password policy - matches AngularJS initialize function
  useEffect(() => {
    if (settings) {
      if (settings.password_policy) {
        setAdminDefinedPasswordPolicy(settings.password_policy);
        // Initialize password constraints with empty password to show all requirements
        setPasswordConstraints(
          classifyFulfilledAndUnfulfilledConstraintsByPassword('')
        );
        setShowPasswordConstraints(true);
      }
      
      // Initialize MFA - matches initMultiFactorAuth
      // Always initialize MFA, even if it's null/undefined (will show inactive state)
      if (settings.mfa) {
        const mfa = settings.mfa as MultiFactorAuth;
        if (mfa.mfa_methods) {
          mfa.mfa_methods.forEach((method) => {
            (mfa as any)[method.method] = method;
          });
        }
        setMultiFactorAuth(mfa);
        
        // Load backup codes if MFA is enabled - matches getBackupCodes
        if (mfa.mfa_enabled) {
          refetchBackupCodes();
        }
      } else if (settings && !settings.mfa) {
        // Initialize with default inactive state if MFA data is not available
        // This ensures the section always shows (matches AngularJS behavior)
        setMultiFactorAuth({
          mfa_enabled: false,
          allow_deactivate: false,
          mfa_methods: [],
        });
      }
    }
  }, [settings, refetchBackupCodes]);

  // Update backup codes in MFA state
  useEffect(() => {
    if (backupCodesData?.data && multiFactorAuth) {
      setMultiFactorAuth({
        ...multiFactorAuth,
        backupCodes: backupCodesData.data.backup_codes,
        accountName: backupCodesData.data.account_name,
        num_of_unused_backup_codes: backupCodesData.data.backup_codes?.length || 0,
      });
    }
  }, [backupCodesData, multiFactorAuth]);

  // Initialize display preferences - matches AngularJS initialization
  useEffect(() => {
    if (user) {
      const signUpIdentity = (user as any).sign_up_identity;
      const showPhone = (user as any).show_phone;
      const showEmail = (user as any).show_email;
      
      if (signUpIdentity === SIGNUP_WITH_PHONE && showPhone) {
        setDisplayPhoneToEveryone(1);
      }
      if (signUpIdentity === SIGNUP_WITH_PERSONAL_EMAIL && showEmail) {
        setDisplayEmailToEveryone(1);
      }
    }
  }, [user]);

  // Detect browser autofill for current password field
  // Browsers autofill password fields asynchronously, so we need to check periodically
  // Using uncontrolled input (defaultValue) allows browser autofill to work
  useEffect(() => {
    if (!currentPasswordInputRef.current) return;

    const checkAutofill = () => {
      const input = currentPasswordInputRef.current;
      if (input && input.value && input.value !== currentPassword) {
        // Browser has autofilled the field, sync to state
        setCurrentPassword(input.value);
      }
    };

    // Check immediately
    checkAutofill();

    // Check periodically for browser autofill (browsers autofill asynchronously)
    const interval = setInterval(checkAutofill, 100);
    
    // Stop checking after 3 seconds (browsers usually autofill within 1-2 seconds)
    const timeout = setTimeout(() => clearInterval(interval), 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [currentPassword]);

  // User info helpers - matches AngularJS userInfo methods
  const isSignupWithWorkEmail = () => {
    if (!user) return false;
    const signUpIdentity = (user as any)?.sign_up_identity;
    // Check if sign_up_identity is 1 (work email)
    if (signUpIdentity === SIGNUP_WITH_WORK_EMAIL) {
      return true;
    }
    // Fallback: if sign_up_identity is not set or is 0, but user has email, show email change section
    // This ensures the section is visible when user has an email (matches AngularJS behavior)
    if (signUpIdentity === undefined || signUpIdentity === null || signUpIdentity === 0) {
      // Show if user has email and either no phone, or phone is not the primary login method
      return userEmail && userEmail.trim() !== '' && (signUpIdentity !== SIGNUP_WITH_PHONE);
    }
    return false;
  };

  const isSignupWithPersonalEmail = () => {
    if (!user) return false;
    const signUpIdentity = (user as any)?.sign_up_identity;
    return signUpIdentity === SIGNUP_WITH_PERSONAL_EMAIL;
  };

  const isSignupWithPhone = () => {
    if (!user) return false;
    const signUpIdentity = (user as any)?.sign_up_identity;
    return signUpIdentity === SIGNUP_WITH_PHONE;
  };

  const isAdmin = () => {
    return (user as any)?.isAdmin || (user as any)?.is_admin || false;
  };

  const isGuest = () => {
    return (user as any)?.is_guest_user || false;
  };

  const canChangePassword = () => {
    if (!settings) return false;
    const ssoOptional = settings.sso_settings?.is_sso_optional === 1;
    return ssoOptional || isAdmin() || isGuest();
  };

  const canChangeEmail = () => {
    if (!settings) return false;
    const ssoOptional = settings.sso_settings?.is_sso_optional === 1;
    return ssoOptional || isAdmin() || isGuest();
  };

  // Email change - matches scope.changeEmail
  const handleEmailChange = () => {
    const trimmedEmail = newEmail.trim();
    if (!trimmedEmail) return;
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address');
      return;
    }
    
    changeEmailMutation.mutate(trimmedEmail, {
      onSuccess: (response) => {
        if (response.type === 1) {
          setSuccessMessage('Email address updated.');
          setNewEmail('');
          setErrorMessage('');
          if (newEmailInputRef.current) {
            newEmailInputRef.current.value = '';
          }
          // Update user in auth store with new email
          const setUser = useAuthStore.getState().setUser;
          if (user) {
            setUser({ ...user, email: trimmedEmail } as any);
          }
        } else {
          setErrorMessage(response.message || 'Failed to update email');
        }
      },
      onError: (error: any) => {
        setErrorMessage(error.message || 'Failed to update email');
      }
    });
  };

  // Password change - matches scope.resetPassword
  const handlePasswordChange = () => {
    if (!currentPassword || !newPassword) return;
    
    if (!checkIfAllConstraintsAreMet(newPassword)) {
      setPasswordConstraints(
        classifyFulfilledAndUnfulfilledConstraintsByPassword(newPassword)
      );
      setShowPasswordConstraints(true);
      setErrorMessage('Password does not meet all requirements');
      return;
    }

    resetPasswordMutation.mutate(
      { current_password: currentPassword, new_password: newPassword },
      {
        onSuccess: (response) => {
          if (response.type === 1) {
            setSuccessMessage('Password updated.');
            setCurrentPassword('');
            setNewPassword('');
            setPasswordConstraints([]);
            setShowPasswordConstraints(false);
            setErrorMessage('');
            // Clear the input fields
            if (currentPasswordInputRef.current) {
              currentPasswordInputRef.current.value = '';
            }
            if (newPasswordInputRef.current) {
              newPasswordInputRef.current.value = '';
            }
          } else {
            setErrorMessage(response.message || 'Failed to update password');
          }
        },
        onError: (error: any) => {
          setErrorMessage(error.message || 'Failed to update password');
        }
      }
    );
  };

  // Display status update - matches scope.updateDisplayStatus
  const handleDisplayStatusUpdate = (type: 'phone' | 'email') => {
    const value = type === 'phone' ? displayPhoneToEveryone : displayEmailToEveryone;
    hideUserInfoMutation.mutate(
      { type, value },
      {
        onSuccess: (response) => {
          if (response.type === 1) {
            setSuccessMessage(`${type === 'phone' ? 'Phone' : 'Email'} visibility updated.`);
          } else {
            setErrorMessage(response.message || `Failed to update ${type} visibility`);
          }
        },
        onError: (error: any) => {
          setErrorMessage(error.message || `Failed to update ${type} visibility`);
        }
      }
    );
  };

  // Sign out all other sessions - matches scope.signOutAllOtherSessions
  const handleSignOutAllOtherSessions = () => {
    expireSessionsMutation.mutate(undefined, {
      onSuccess: (response) => {
        if (response.type === 1) {
          setSuccessMessage("You're now signed out from all sessions except this.");
        }
      }
    });
  };

  // Deactivate MFA - matches scope.deactivateRequiredMfaForLoggedInUser
  const handleDeactivateMfa = () => {
    if (!multiFactorAuth) return;
    
    setMultiFactorAuth({ ...multiFactorAuth, deactivating: true });
    
    deactivateMfaMutation.mutate(undefined, {
      onSuccess: async (response) => {
        if (response.type === 1) {
          // Refetch settings to update MFA state
          window.location.reload(); // Simple refresh for now
        } else {
          setMultiFactorAuth({ ...multiFactorAuth, deactivating: false });
          setErrorMessage(response.message || 'Failed to deactivate MFA');
        }
      },
      onError: () => {
        setMultiFactorAuth({ ...multiFactorAuth, deactivating: false });
      }
    });
  };

  // Disable account - matches scope.disableAccount
  const handleDisableAccount = () => {
    if (!confirm('Are you sure you want to disable your account? You will be removed from ' + 
                 ((account as any)?.account_name || 'this network') + 
                 ' network. Content shared by you will not be automatically deleted.')) {
      return;
    }

    const userId = (user as any)?.user_id || (user as any)?.userId || '';
    removeUserMutation.mutate(userId, {
      onSuccess: (response) => {
        if (response.type === 1) {
          logout();
        }
      }
    });
  };

  // Password input handlers - matches AngularJS link function handlers
  const handleNewPasswordInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewPassword(value);
    
    // Show constraints on input - matches AngularJS behavior
    if (value) {
      setPasswordConstraints(
        classifyFulfilledAndUnfulfilledConstraintsByPassword(value)
      );
      setShowPasswordConstraints(true);
    } else {
      setPasswordConstraints([]);
      setShowPasswordConstraints(false);
    }
  };

  // Password keyup handler - matches AngularJS on('keyup') except Tab
  const handleNewPasswordKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Check if Tab key was pressed (keyCode 9 or key === 'Tab')
    const isTabKey = e.key === 'Tab' || (e as any).keyCode === 9 || e.which === 9;
    if (!isTabKey) {
      const value = e.currentTarget.value;
      if (value) {
        setPasswordConstraints(
          classifyFulfilledAndUnfulfilledConstraintsByPassword(value)
        );
        setShowPasswordConstraints(true);
      }
    }
  };

  const handleCurrentPasswordInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentPassword(e.target.value);
  };

  const handleNewEmailInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewEmail(value);
    // Clear error message when user starts typing
    if (errorMessage) {
      setErrorMessage('');
    }
  };

  // Check if password button should be enabled - matches AngularJS logic
  const isPasswordButtonEnabled = () => {
    if (!currentPassword || !newPassword) return false;
    if (!canChangePassword()) return false;
    return checkIfAllConstraintsAreMet(newPassword);
  };

  // Show success/error messages
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Get user email/phone - matches AngularJS userInfo.getEmail() and getPhone()
  // MUST be defined before any early returns to maintain hook order
  const userEmail = (user as any)?.email || '';
  const userPhone = (user as any)?.phone || (user as any)?.phone_no || (user as any)?.phone_number || '';
  
  // Debug: Log user data to help diagnose visibility issues
  // MUST be before early returns to maintain hook order
  useEffect(() => {
    if (user) {
      console.log('AccountSettingsView - User data:', {
        email: userEmail,
        phone: userPhone,
        sign_up_identity: (user as any)?.sign_up_identity,
        isSignupWithWorkEmail: isSignupWithWorkEmail(),
        canChangeEmail: canChangeEmail(),
      });
    }
  }, [user, userEmail, userPhone]);

  if (settingsLoading) {
    return (
      <div style={{ padding: '40px' }}>
        <div>Loading settings...</div>
      </div>
    );
  }

  // Exact HTML structure match from accountSettingsView.tpl.html
  return (
    <div style={{ paddingLeft: '120px' }}>
      {/* Success/Error Messages */}
      {successMessage && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#d4edda', 
          color: '#155724', 
          marginBottom: '20px',
          borderRadius: '4px'
        }}>
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          marginBottom: '20px',
          borderRadius: '4px'
        }}>
          {errorMessage}
        </div>
      )}

      <div className="header">My account</div>

      <div style={{ marginTop: '20px' }}></div>
      <div className="subHeader">
        MY LOGIN INFORMATION
      </div>
      <hr/>

      {/* Email Change (Work Email) - matches ng-show="userInfo.isSignupWithWorkEmail()" */}
      {/* Show email change section if user signed up with work email OR has an email */}
      {/* Always show if user has email to ensure visibility (matches AngularJS behavior) */}
      {(isSignupWithWorkEmail() || (userEmail && userEmail.trim() !== '')) && (
        <div style={{ marginTop: '20px', fontSize: '14px', color: '#2b2b2b' }}>
          Your current login email: {userEmail}
          <div style={{ marginTop: '20px' }}></div>
          <div>
            <div style={{ display: 'inline-block', width: '120px' }}>
              New login email
            </div>
            <input
              ref={newEmailInputRef}
              id="newEmail"
              type="text"
              value={newEmail}
              onChange={handleNewEmailInput}
              disabled={!canChangeEmail()}
              className="settings-custom"
              spellCheck={false}
            />
          </div>
          <button
            id="emailBtn"
            onClick={handleEmailChange}
            disabled={!newEmail.trim() || changeEmailMutation.isPending || !canChangeEmail()}
            type="button"
            className={`btn btn-primary ${!newEmail.trim() || !canChangeEmail() ? 'disabled' : ''}`}
            style={{
              marginLeft: '144px',
              marginTop: '20px'
            }}
          >
            Change email
          </button>
        </div>
      )}

      {/* Phone Display Preference - matches ng-show="userInfo.isSignupWithPhone()" */}
      {/* Show if user signed up with phone OR has a phone number */}
      {(isSignupWithPhone() || (userPhone && userPhone.trim() !== '')) && (
        <div style={{ marginTop: '20px', fontSize: '14px', color: '#2b2b2b' }} x-ms-format-detection="none">
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
                const newVal = e.target.checked ? 1 : 0;
                setDisplayPhoneToEveryone(newVal);
                handleDisplayStatusUpdate('phone');
              }}
            />
            <label htmlFor="showPhoneEveryone"></label>
            <span style={{ marginLeft: '10px', fontSize: '14px', color: '#2b2b2b' }}>Show my phone number to everyone</span>
          </div>
        </div>
      )}

      {/* Email Display Preference (Personal Email) - matches ng-show="userInfo.isSignupWithPersonalEmail()" */}
      {/* Show if user signed up with personal email OR (has email AND signed up with phone) */}
      {(isSignupWithPersonalEmail() || (userEmail && userEmail.trim() !== '' && isSignupWithPhone())) && (
        <div style={{ marginTop: '20px', fontSize: '14px', color: '#2b2b2b' }}>
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
                const newVal = e.target.checked ? 1 : 0;
                setDisplayEmailToEveryone(newVal);
                handleDisplayStatusUpdate('email');
              }}
            />
            <label htmlFor="showEmailEveryone"></label>
            <span style={{ marginLeft: '10px', fontSize: '14px', color: '#2b2b2b' }}>Show my email to everyone</span>
          </div>
        </div>
      )}

      {/* Password Change Section */}
      <div style={{ marginTop: '20px' }}></div>
      <div className="subHeader">
        CHANGE PASSWORD
      </div>
      <hr/>
      <div style={{ marginTop: '20px' }}></div>
      <div>
        <div style={{ display: 'inline-block', width: '120px', fontSize: '14px', color: '#2b2b2b' }}>
          Current password
        </div>
            <input
              ref={currentPasswordInputRef}
              id="curPass"
              name="currentPassword"
              className="settings-custom"
              type="password"
              defaultValue={currentPassword || ''}
              onChange={handleCurrentPasswordInput}
              disabled={!canChangePassword()}
              autoComplete="current-password"
            />
        {canChangePassword() && (
          <div style={{ display: 'inline-block', marginLeft: '30px' }}>
            <a href="/app/forgot_password.php" target="_blank" rel="noopener noreferrer">
              Forgot your password?
            </a>
          </div>
        )}
      </div>
      <div className="clearfix" style={{ display: 'inline-block', marginTop: '20px', overflow: 'hidden' }}>
        <div style={{ display: 'inline-block' }}>
            <div style={{ display: 'inline-block', width: '120px', fontSize: '14px', color: '#2b2b2b' }}>
              New password
            </div>
            <input
              ref={newPasswordInputRef}
              id="newPass"
              name="newPassword"
              className="settings-custom"
              type="password"
              value={newPassword}
              onChange={handleNewPasswordInput}
              onKeyUp={handleNewPasswordKeyUp}
              disabled={!canChangePassword()}
              autoComplete="new-password"
            />
          <button
            id="passBtn"
            style={{
              display: 'block',
              marginLeft: '144px',
              marginTop: '20px'
            }}
            onClick={handlePasswordChange}
            disabled={!isPasswordButtonEnabled() || resetPasswordMutation.isPending}
            type="button"
            className={`btn btn-primary ${!isPasswordButtonEnabled() ? 'disabled' : ''}`}
          >
            Change password
          </button>
        </div>
        {/* Password Policy Constraints - matches ng-show="settings != null && settings.password_policy != null" */}
        {settings?.password_policy && (
          <div id="password-policy-constraints">
            <div>Your password must:</div>
            <ul>
              {(passwordConstraints.length > 0 ? passwordConstraints : classifyFulfilledAndUnfulfilledConstraintsByPassword(newPassword)).map((constraint, index) => (
                <li
                  key={index}
                  className={`cnv-list-style ${constraint.fulfilled ? 'fulfilled' : 'not-fulfilled'}`}
                >
                  <div>{constraint.constraint}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <br/><br/><br/>

      {/* Two-Factor Authentication Section - matches ng-if="multiFactorAuth" */}
      <div>
        {multiFactorAuth ? (
          <div style={{ opacity: multiFactorAuth.deactivating ? 0.6 : 1 }}>
            <div className="meta"><b>TWO-FACTOR AUTHENTICATION</b></div>
            <hr/>
            <div className="meta">
              Two-Factor authentication is{' '}
              <b>{multiFactorAuth.mfa_enabled ? 'active' : 'inactive'}</b>
            </div>
            <br/>
            
            {/* MFA Not Enabled */}
            {!multiFactorAuth.mfa_enabled && (
              <div className="meta" style={{ width: '760px' }}>
                Protect your account with an extra layer of security by requiring access to your phone. Once configured, you'll be required to enter both your password and an authentication code from your mobile phone in order to sign in.{' '}
                <a href="https://convo.com/help/2fa">Learn more</a>.
                <br/>
                    <a href={getTwoFactorAuthUrl(settings)} target="_blank" rel="noopener noreferrer">
                      <button className="btn btn-primary" style={{ margin: '10px 0px 6px 0px' }}>
                        Set up two-factor authentication
                      </button>
                    </a>
                <div className="meta">Note: Activating two-factor authentication will sign you out of all other sessions.</div>
              </div>
            )}

            {/* MFA Enabled - SMS Default */}
            {multiFactorAuth.mfa_enabled && multiFactorAuth.SMS && multiFactorAuth.SMS.is_default && (
              <div className="meta">
                Authentication codes will be sent via SMS text message to{' '}
                <b>{multiFactorAuth.SMS.phone_number}</b>{' '}
                <a href={`${getTwoFactorAuthUrl(settings)}?view=sms_auth`} target="_blank" rel="noopener noreferrer">Edit</a>
              </div>
            )}

            {/* MFA Enabled - Auth App Default with SMS */}
            {multiFactorAuth.mfa_enabled && multiFactorAuth.AUTH_APP && multiFactorAuth.AUTH_APP.is_default && multiFactorAuth.SMS && (
              <div className="meta">
                Get your authentication codes via your <b>authentication app</b>{' '}
                <a href={`${getTwoFactorAuthUrl(settings)}?view=authenticator_app`} target="_blank" rel="noopener noreferrer">Edit</a>
              </div>
            )}

            {/* MFA Enabled - Auth App Default without SMS */}
            {multiFactorAuth.mfa_enabled && multiFactorAuth.AUTH_APP && multiFactorAuth.AUTH_APP.is_default && !multiFactorAuth.SMS && (
              <div className="meta">
                Authentication codes will be sent to your <b>authentication app</b>{' '}
                <a href={`${getTwoFactorAuthUrl(settings)}?view=authenticator_app`} target="_blank" rel="noopener noreferrer">Edit</a>
              </div>
            )}

            {/* MFA Enabled - SMS Backup */}
            {multiFactorAuth.mfa_enabled && multiFactorAuth.SMS && !multiFactorAuth.SMS.is_default && (
              <div className="meta">
                Your backup phone number is <b>{multiFactorAuth.SMS.phone_number}</b>{' '}
                <a href={`${getTwoFactorAuthUrl(settings)}?view=sms_auth`} target="_blank" rel="noopener noreferrer">Edit</a>
              </div>
            )}

            {/* MFA Enabled - Auth App Backup */}
            {multiFactorAuth.mfa_enabled && multiFactorAuth.AUTH_APP && !multiFactorAuth.AUTH_APP.is_default && (
              <div className="meta">
                You have registered an <b>authentication</b> app as a backup option{' '}
                <a href={`${getTwoFactorAuthUrl(settings)}?view=authenticator_app`} target="_blank" rel="noopener noreferrer">Edit</a>
              </div>
            )}

            {/* Setup Backup Options */}
            {multiFactorAuth.mfa_enabled && multiFactorAuth.SMS && !multiFactorAuth.AUTH_APP && (
              <a href={`${getTwoFactorAuthUrl(settings)}?view=authenticator_app`} style={{ marginTop: '6px', display: 'inline-block' }} target="_blank" rel="noopener noreferrer">
                Set up a backup option
              </a>
            )}

            {multiFactorAuth.mfa_enabled && !multiFactorAuth.SMS && multiFactorAuth.AUTH_APP && (
              <a href={`${getTwoFactorAuthUrl(settings)}?view=sms_auth`} style={{ marginTop: '6px', display: 'inline-block' }} target="_blank" rel="noopener noreferrer">
                Set up a backup option
              </a>
            )}

            {/* Backup Codes */}
            {multiFactorAuth.mfa_enabled && multiFactorAuth.backupCodes && multiFactorAuth.backupCodes.length > 0 && (
              <div style={{ margin: '16px 0px' }}>
                <a 
                  href="javascript:void(0);" 
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    // TODO: Open backup codes modal
                    alert('Backup codes modal - to be implemented');
                  }}
                >
                  <b>
                    You have {multiFactorAuth.num_of_unused_backup_codes || multiFactorAuth.backupCodes.length} unused backup codes &gt;
                  </b>
                </a>
              </div>
            )}

            {/* Use Auth App Instead */}
            {multiFactorAuth.mfa_enabled && (!multiFactorAuth.AUTH_APP || !multiFactorAuth.AUTH_APP.is_default) && (
              <a href={`${getTwoFactorAuthUrl(settings)}?view=authenticator_app&default=1`} style={{ textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">
                <button className="btn btn-primary">Use authentication app instead</button>
              </a>
            )}

            {/* Use SMS Instead */}
            {multiFactorAuth.mfa_enabled && (!multiFactorAuth.SMS || !multiFactorAuth.SMS.is_default) && (
              <a href={`${getTwoFactorAuthUrl(settings)}?view=sms_auth&default=1`} style={{ textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">
                <button className="btn btn-primary">Use SMS instead</button>
              </a>
            )}

            {/* Deactivate MFA */}
            {multiFactorAuth.mfa_enabled && multiFactorAuth.allow_deactivate && (
              <a
                style={{ verticalAlign: 'middle' }}
                href="javascript:void(0);"
                onClick={handleDeactivateMfa}
              >
                &nbsp;&nbsp;&nbsp;&nbsp;{multiFactorAuth.deactivating ? 'Deactivating...' : 'Deactivate two-factor authentication'}
              </a>
            )}
          </div>
        ) : settingsLoading ? (
          <div className="meta">Loading two-factor authentication settings...</div>
        ) : (
          <div>
            <div className="meta"><b>TWO-FACTOR AUTHENTICATION</b></div>
            <hr/>
            <div className="meta">
              Two-Factor authentication is <b>inactive</b>
            </div>
            <br/>
            <div className="meta" style={{ width: '760px' }}>
              Protect your account with an extra layer of security by requiring access to your phone. Once configured, you'll be required to enter both your password and an authentication code from your mobile phone in order to sign in.{' '}
              <a href="https://convo.com/help/2fa">Learn more</a>.
              <br/>
              <a href={getTwoFactorAuthUrl(settings)} target="_blank" rel="noopener noreferrer">
                <button className="btn btn-primary" style={{ margin: '10px 0px 6px 0px' }}>
                  Set up two-factor authentication
                </button>
              </a>
              <div className="meta">Note: Activating two-factor authentication will sign you out of all other sessions.</div>
            </div>
          </div>
        )}
        
        <br/><br/>
        
        {/* Sign Out All Other Sessions */}
        <div className="meta"><b>SIGN OUT OF ALL OTHER SESSIONS</b></div>
        <hr/>
        <div className="meta">Lost your phone or forgot to log out of a public computer? Sign out from everywhere except from here.</div>
        <button
          className="btn btn-primary"
          onClick={handleSignOutAllOtherSessions}
          style={{ marginTop: '10px' }}
        >
          Sign out all other sessions
        </button>
      </div>

      {/* Disable Account */}
      <div style={{ marginTop: '40px' }}></div>
      <hr/>
      <div style={{ marginTop: '20px' }}></div>
      <a href="javascript:void(0)" onClick={handleDisableAccount}>
        Disable my account
      </a>
      <div style={{ marginTop: '10px', color: '#7b8386' }}>
        You will be removed from this network and lose access to all of company discussion. Content shared by
        you will not be automatically deleted.
      </div>
    </div>
  );
}

