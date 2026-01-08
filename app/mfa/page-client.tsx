'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMfaResendVerificationCode, useMfaSecretAndQRCode, useMfaSendVerificationCode, useMfaVerifyCode } from '@/lib/hooks/use-mfa';

type ViewType = 'options' | 'sms_auth' | 'authenticator_app' | 'auth_success';

function clampView(v: string | null): ViewType {
  if (v === 'sms_auth' || v === 'authenticator_app' || v === 'auth_success') return v;
  return 'options';
}

function toInt(val: string | null, fallback: number) {
  if (!val) return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function changeQrColor(qrCodeDataUrl: string): Promise<string> {
  // Angular recolors the QR code to uniqueColor [4,126,179].
  return new Promise((resolve) => {
    if (!qrCodeDataUrl) return resolve('');
    const canvas = document.createElement('canvas');
    const image = document.createElement('img');
    image.src = qrCodeDataUrl;
    setTimeout(() => {
      const o_w = image.width;
      const o_h = image.height;
      if (!o_w || !o_h) return resolve(qrCodeDataUrl);

      canvas.width = o_w;
      canvas.height = o_h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(qrCodeDataUrl);
      ctx.drawImage(image, 0, 0);
      const imgd = ctx.getImageData(0, 0, o_w, o_h);
      const pix = imgd.data;
      const uniqueColor = [4, 126, 179];
      for (let i = 0; i < pix.length; i += 4) {
        if (pix[i] === 0) {
          pix[i] = uniqueColor[0];
          pix[i + 1] = uniqueColor[1];
          pix[i + 2] = uniqueColor[2];
        }
      }
      ctx.putImageData(imgd, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    }, 100);
  });
}

function BackupCodesModal({
  accountName,
  backupCodes,
  onClose,
}: {
  accountName: string;
  backupCodes: Array<{ backup_code: string; consumed_at?: unknown }>;
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
    const text = backupCodes.map((b) => b.backup_code).join('\n');
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
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

export default function MfaPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const view = useMemo<ViewType>(() => clampView(searchParams.get('view')), [searchParams]);
  const accountId = useMemo(() => searchParams.get('account_id') || '', [searchParams]);
  const defaultFlag = useMemo(() => (toInt(searchParams.get('default'), 0) ? 1 : 0), [searchParams]);

  const [authPathComplete, setAuthPathComplete] = useState<{ SMS: boolean; AUTH_APP: boolean }>({ SMS: false, AUTH_APP: false });
  const [networkSwitched, setNetworkSwitched] = useState(false);

  const [banner, setBanner] = useState<string | null>(null);
  const bannerTimeoutRef = useRef<number | null>(null);

  const [backupCodesModal, setBackupCodesModal] = useState<null | { backup_codes: Array<{ backup_code: string; consumed_at?: unknown }>; account_name: string }>(null);

  const showBanner = useCallback((text: string, autoHideMs = 4000) => {
    setBanner(text);
    if (bannerTimeoutRef.current) window.clearTimeout(bannerTimeoutRef.current);
    if (autoHideMs > 0) {
      bannerTimeoutRef.current = window.setTimeout(() => setBanner(null), autoHideMs);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (bannerTimeoutRef.current) window.clearTimeout(bannerTimeoutRef.current);
    };
  }, []);

  const updateSearch = useCallback(
    (updates: Record<string, string | number | null | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => {
        if (v === null || v === undefined || v === '') next.delete(k);
        else next.set(k, String(v));
      });
      router.replace(`/mfa?${next.toString()}`);
    },
    [router, searchParams]
  );

  const requestView = useCallback(
    (nextView: ViewType, data?: { default?: number }) => {
      updateSearch({ view: nextView, default: data?.default ? 1 : 0 });
    },
    [updateSearch]
  );

  const composeRedirectUrl = useCallback(
    (postRedirectUrl?: string) => {
      const p1 = searchParams.get('redirect_url') || '';
      let po = postRedirectUrl || '';
      let composed = '';

      if (po) {
        composed = po;
        if (p1) {
          const p1Arr = p1.split('&redirect_url=');
          const lastP1 = p1Arr[p1Arr.length - 1];
          if (po !== lastP1) composed += `&redirect_url=${lastP1}`;
        }
      } else if (p1) {
        composed = p1;
      } else {
        composed = '/';
      }
      return composed;
    },
    [searchParams]
  );

  const navigateToApp = useCallback(
    (redirectUrl?: string) => {
      const navigateTo = redirectUrl || composeRedirectUrl();
      // Angular: localStore.writeDataGlobal('app_startup_banner', '2FA enabled. Stay safe!');
      try {
        localStorage.setItem('app_startup_banner', '2FA enabled. Stay safe!');
      } catch {}
      if (networkSwitched) {
        // Angular triggers a tabs reload; in Next.js new window, a full reload is enough.
        // (keep behavior minimal but safe)
      }
      window.location.href = navigateTo;
    },
    [composeRedirectUrl, networkSwitched]
  );

  const onAuthSuccess = useCallback(
    (payload: any) => {
      // Show backup codes modal if this is the first completed path (Angular condition)
      if (!authPathComplete.AUTH_APP && !authPathComplete.SMS && (view === 'authenticator_app' || view === 'sms_auth')) {
        if (payload?.backup_codes && payload?.account_name) {
          setBackupCodesModal({ backup_codes: payload.backup_codes, account_name: payload.account_name });
        }
      }

      if (payload?.network_switched) setNetworkSwitched(true);

      const composedRedirect = composeRedirectUrl(payload?.redirect_url);

      if (view === 'authenticator_app') setAuthPathComplete((p) => ({ ...p, AUTH_APP: true }));
      if (view === 'sms_auth') setAuthPathComplete((p) => ({ ...p, SMS: true }));

      // If both completed, navigate right away; else show success page.
      const nextStatus = {
        SMS: view === 'sms_auth' ? true : authPathComplete.SMS,
        AUTH_APP: view === 'authenticator_app' ? true : authPathComplete.AUTH_APP,
      };

      if (nextStatus.SMS && nextStatus.AUTH_APP) {
        navigateToApp(composedRedirect);
      } else {
        updateSearch({ view: 'auth_success', redirect_url: composedRedirect });
      }
    },
    [authPathComplete, composeRedirectUrl, navigateToApp, updateSearch, view]
  );

  // Options view
  const OptionsView = (
    <>
      <div className="mfa-title meta">
        <b>HOW WOULD YOU LIKE TO RECEIVE YOUR AUTHENTICATION CODES?</b>
      </div>
      <hr />
      <p className="meta">You will be asked for an authentication code when you sign in to your account.</p>
      <div>
        <div className="mfa-option">
          <button className="btn btn-primary" type="button" onClick={() => requestView('sms_auth', { default: 1 })}>
            SMS text message
          </button>
          &nbsp;&nbsp;&nbsp;&nbsp;
          <span className="meta-light">Receive a text message to your mobile device when signing in.</span>
        </div>
        <div className="mfa-option">
          <button className="btn btn-primary" type="button" onClick={() => requestView('authenticator_app', { default: 1 })}>
            Use an authenticator app
          </button>
          &nbsp;&nbsp;&nbsp;&nbsp;
          <span className="meta-light">Retrieve codes from an authenticator app on your device.</span>
        </div>
      </div>
    </>
  );

  // SMS flow
  const sendSmsMutation = useMfaSendVerificationCode();
  const resendSmsMutation = useMfaResendVerificationCode();
  const verifyMutation = useMfaVerifyCode();

  const [smsStep, setSmsStep] = useState<'step_contact' | 'step_contact_verification'>('step_contact');
  const [smsPhone, setSmsPhone] = useState('');
  const [smsError, setSmsError] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [smsCodeError, setSmsCodeError] = useState('');
  const [smsCodeProcessing, setSmsCodeProcessing] = useState(false);
  const smsAttemptsRef = useRef<{ counter: number; start: number; lockedUntil: number }>({ counter: 0, start: 0, lockedUntil: 0 });

  const submitSmsPhone = useCallback(async () => {
    if (!smsPhone.trim()) return;
    setSmsError('');
    sendSmsMutation.mutate(smsPhone.trim(), {
      onSuccess: (resp: any) => {
        if (resp?.type === 1) {
          setSmsStep('step_contact_verification');
        } else {
          setSmsError(resp?.message ? String(resp.message) : "please make sure you've entered the correct contact number");
        }
      },
      onError: () => {
        setSmsError("please make sure you've entered the correct contact number");
      },
    });
  }, [sendSmsMutation, smsPhone]);

  const resendSms = useCallback(() => {
    if (!smsPhone.trim()) return;
    resendSmsMutation.mutate(smsPhone.trim(), {
      onSuccess: (resp: any) => {
        if (resp?.type === 1) showBanner(`Verification code sent to ${smsPhone.trim()}`);
      },
    });
  }, [resendSmsMutation, showBanner, smsPhone]);

  const verifySmsCode = useCallback(() => {
    // Defensive UX: user reported the button sometimes "does nothing".
    // Always provide immediate feedback if we exit early.
    if (!smsCode || smsCode.length !== 6) {
      setSmsCodeError('Invalid code');
      return;
    }

    const now = (Date.now() / 1000) | 0;
    const attempts = smsAttemptsRef.current;
    if (attempts.lockedUntil && now < attempts.lockedUntil) {
      setSmsCodeError('Login is disabled. Try again in 1 minute.');
      return;
    }

    if (!attempts.start) attempts.start = now;
    setSmsCodeProcessing(true);
    setSmsCodeError('');

    verifyMutation.mutate(
      { auth_method: 'SMS', verification_code: smsCode, is_default: defaultFlag, account_id: accountId },
      {
        onSuccess: (resp: any) => {
          attempts.counter += 1;
          if (resp?.type === 1) {
            setSmsCodeProcessing(false);
            onAuthSuccess(resp.data || {});
            return;
          }

          if (now - attempts.start < 120 && attempts.counter >= 10) {
            attempts.lockedUntil = now + 60;
            showBanner('Login is disabled. Try again in 1 minute.', 60000);
            window.setTimeout(() => {
              attempts.start = ((Date.now() / 1000) | 0);
              attempts.counter = 0;
              attempts.lockedUntil = 0;
              setSmsCodeProcessing(false);
            }, 60000);
          } else {
            setSmsCodeProcessing(false);
            setSmsCodeError(resp?.message ? String(resp.message) : 'Invalid code');
          }
        },
        onError: (err: any) => {
          attempts.counter += 1;
          setSmsCodeProcessing(false);
          setSmsCodeError(err?.message ? String(err.message) : 'Invalid code');
        },
      }
    );
  }, [accountId, defaultFlag, onAuthSuccess, showBanner, smsCode, verifyMutation]);

  const SmsView = (
    <>
      <div className="mfa-title meta">
        <b>ADD SMS AUTHENTICATION</b>
      </div>
      <hr />

      {smsStep === 'step_contact' && (
        <div className="mfa-add-contact-input-comp">
          <p className="meta">We'll send a time-sensitive authentication code to your mobile phone via text message when you're signing in.</p>
          <div className="add-contact">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitSmsPhone();
              }}
            >
              <span className="input-wrap">
                <input id="phone-input" type="tel" autoFocus value={smsPhone} onChange={(e) => setSmsPhone(e.target.value)} />
              </span>
              <button className="btn btn-primary" type="submit" disabled={sendSmsMutation.isPending}>
                Add phone number
              </button>
              {smsError && <div className="auth-error-message">{smsError}</div>}
            </form>
            <div className="add-contact-note">
              <span className="meta-light">Standard SMS fees may apply.</span>
            </div>
          </div>
        </div>
      )}

      {smsStep === 'step_contact_verification' && (
        <div className="mfa-verify-sms-comp">
          <p className="meta">
            We've sent a 6-digit verification to <b>{smsPhone}</b>
          </p>
          <div className="bar-code-input-comp">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                verifySmsCode();
              }}
            >
              <input
                id="sms-verification-input"
                placeholder="Verification code"
                autoFocus
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value)}
              />
              <button
                className="btn btn-primary"
                type="button"
                disabled={smsCodeProcessing}
                onClick={() => verifySmsCode()}
              >
                Verify code and enable
              </button>
              {smsCodeError && <div className="auth-error-message">{smsCodeError}</div>}
            </form>
          </div>
          <div>
            <span className="meta-light">Didn't receive your code?</span>&nbsp;
            <a
              href="javascript:void(0);"
              onClick={(e) => {
                e.preventDefault();
                resendSms();
              }}
            >
              Resend code
            </a>
            <span className="meta">, or</span>&nbsp;
            <a
              href="javascript:void(0);"
              onClick={(e) => {
                e.preventDefault();
                setSmsStep('step_contact');
                setSmsCode('');
                setSmsCodeError('');
              }}
            >
              send to different phone number
            </a>
            <span className="meta">.</span>
          </div>
        </div>
      )}
    </>
  );

  // Authenticator App flow
  const secretQuery = useMfaSecretAndQRCode(view === 'authenticator_app');
  const [qrEnabled, setQrEnabled] = useState(false);
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [bcDetailsEnabled, setBcDetailsEnabled] = useState(false);
  const [authAppCode, setAuthAppCode] = useState('');
  const [authAppError, setAuthAppError] = useState('');
  const [authAppProcessing, setAuthAppProcessing] = useState(false);
  const authAppAttemptsRef = useRef<{ counter: number; start: number; lockedUntil: number }>({ counter: 0, start: 0, lockedUntil: 0 });

  useEffect(() => {
    if (!secretQuery.data) return;
    const resp: any = secretQuery.data;
    if (resp?.data?.qr_code) {
      setSecret(String(resp.data.secret || ''));
      changeQrColor(String(resp.data.qr_code || '')).then((colored) => {
        setQrCode(colored || String(resp.data.qr_code));
        setQrEnabled(true);
      });
    }
  }, [secretQuery.data]);

  const verifyAuthApp = useCallback(() => {
    // Defensive UX: user reported the button sometimes "does nothing".
    // Always provide immediate feedback if we exit early.
    if (!authAppCode || authAppCode.length !== 6) {
      setAuthAppError('Invalid code');
      return;
    }

    const now = (Date.now() / 1000) | 0;
    const attempts = authAppAttemptsRef.current;
    if (attempts.lockedUntil && now < attempts.lockedUntil) {
      setAuthAppError('Login is disabled. Try again in 1 minute.');
      return;
    }

    if (!attempts.start) attempts.start = now;
    setAuthAppProcessing(true);
    setAuthAppError('');

    verifyMutation.mutate(
      { auth_method: 'AUTH_APP', verification_code: authAppCode, is_default: defaultFlag, account_id: accountId },
      {
        onSuccess: (resp: any) => {
          attempts.counter += 1;
          if (resp?.type === 1) {
            setAuthAppProcessing(false);
            onAuthSuccess(resp.data || {});
            return;
          }

          if (now - attempts.start < 120 && attempts.counter >= 10) {
            attempts.lockedUntil = now + 60;
            showBanner('Login is disabled. Try again in 1 minute.', 60000);
            window.setTimeout(() => {
              attempts.start = ((Date.now() / 1000) | 0);
              attempts.counter = 0;
              attempts.lockedUntil = 0;
              setAuthAppProcessing(false);
            }, 60000);
          } else {
            setAuthAppProcessing(false);
            setAuthAppError(resp?.message ? String(resp.message) : 'Invalid code');
          }
        },
        onError: (err: any) => {
          attempts.counter += 1;
          setAuthAppProcessing(false);
          setAuthAppError(err?.message ? String(err.message) : 'Invalid code');
        },
      }
    );
  }, [accountId, authAppCode, defaultFlag, onAuthSuccess, showBanner, verifyMutation]);

  const AuthAppView = (
    <>
      <div className="mfa-title meta">
        <b>CONFIGURE BACKUP TWO-FACTOR AUTHENTICATION APP</b>
      </div>
      <hr />
      <p className="meta" style={{ maxWidth: '600px' }}>
        Once configured, you'll be able to enter a code created by an authenticator app, such as{' '}
        <a href="https://support.google.com/accounts/answer/1066447?hl=en" target="_blank" rel="noopener noreferrer">
          Google&nbsp;Authenticator
        </a>
        ,&nbsp;
        <a href="https://duo.com/solutions/features/two-factor-authentication-methods/duo-mobile" target="_blank" rel="noopener noreferrer">
          Duo&nbsp;Mobile
        </a>
        ,&nbsp;
        <a href="https://www.authy.com/" target="_blank" rel="noopener noreferrer">
          Authy
        </a>
        &nbsp;in order to sign in your Convo network.
      </p>
      <br />

      {qrEnabled ? (
        <div className="authenticator-bar-code-comp">
          <div className="meta">
            Open the authenticator app on your phone or tablet and <b>scan the barcode</b> below.
          </div>
          <div className="bar-code">
            <img src={qrCode} alt="QR code" />
            <span className="bar-code-info">
              <a
                href="javascript:void(0);"
                onClick={(e) => {
                  e.preventDefault();
                  setBcDetailsEnabled(true);
                }}
              >
                Can't scan this barcode?
              </a>
              {bcDetailsEnabled && (
                <div className="bar-code-meta meta">
                  <div>
                    Use your authentication app&apos;s &quot;Manual entry&quot;
                    <br />
                    or equivalent option and provide the following
                    <br />
                    time-based key.(Lower-case works too.)
                  </div>
                  <div className="auth-code">{secret}</div>
                  <div>Add the 6-digit verification code that your app.</div>
                </div>
              )}
            </span>
          </div>
          <br />
          <div className="meta bar-code-submit">
            <div>
              Now, <b>enter the 6 digit verification code</b> generated by the app below.
            </div>
            <div className="bar-code-input-comp">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  verifyAuthApp();
                }}
              >
                <input
                  id="qr-verification-input"
                  placeholder="Verification code"
                  autoFocus
                  value={authAppCode}
                  onChange={(e) => setAuthAppCode(e.target.value)}
                />
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={authAppProcessing}
                  onClick={() => verifyAuthApp()}
                >
                  Verify code and enable
                </button>
                {authAppError && <div className="auth-error-message">{authAppError}</div>}
              </form>
            </div>
          </div>
        </div>
      ) : (
        <div className="cnv-spinner" style={{ width: '20px', height: '20px', marginLeft: '200px' }} />
      )}
    </>
  );

  const SuccessView = (
    <>
      <div className="mfa-title meta">
        <b>SUCCESS!</b>
      </div>
      <div>
        <hr />
        {(!authPathComplete.SMS || !authPathComplete.AUTH_APP) && (
          <p className="meta">We strongly recommend that you set up an additional back up option.</p>
        )}

        <div className="mfa-success-wrap">
          {!authPathComplete.SMS && (
            <div className="mfa-option">
              <button className="btn btn-primary" type="button" onClick={() => requestView('sms_auth', { default: 0 })}>
                SMS text message
              </button>
              &nbsp;&nbsp;&nbsp;&nbsp;
              <span className="meta-light">Receive a text message to your mobile device when signing in.</span>
            </div>
          )}
          {!authPathComplete.AUTH_APP && (
            <div className="mfa-option">
              <button className="btn btn-primary" type="button" onClick={() => requestView('authenticator_app', { default: 0 })}>
                Use an authenticator app
              </button>
              &nbsp;&nbsp;&nbsp;&nbsp;
              <span className="meta-light">Retrieve codes from an authenticator app on your device.</span>
            </div>
          )}

          <div>
            <a
              href="javascript:void(0);"
              onClick={(e) => {
                e.preventDefault();
                navigateToApp();
              }}
            >
              Skip
            </a>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="mfa-panel-wrapper">
      {banner && <div className="cnv-settings-saved-banner">{banner}</div>}

      {view === 'options' && OptionsView}
      {view === 'sms_auth' && SmsView}
      {view === 'authenticator_app' && AuthAppView}
      {view === 'auth_success' && SuccessView}

      {view !== 'auth_success' && (
        <a
          href="javascript:void(0);"
          onClick={(e) => {
            e.preventDefault();
            window.history.back();
          }}
          style={{ marginTop: '10px', display: 'block' }}
        >
          back
        </a>
      )}

      {backupCodesModal && (
        <BackupCodesModal
          accountName={backupCodesModal.account_name}
          backupCodes={backupCodesModal.backup_codes}
          onClose={() => setBackupCodesModal(null)}
        />
      )}

      <style jsx global>{`
        .mfa-panel-wrapper {
          margin-left: 55px;
          text-align: left;
        }
        .mfa-panel-wrapper hr {
          margin-top: 10px;
          margin-bottom: 10px;
        }
        .mfa-panel-wrapper .mfa-title {
          margin-top: 18px;
        }
        .mfa-panel-wrapper .mfa-option {
          padding: 10px 0px 4px 0px;
        }
        .mfa-panel-wrapper .mfa-option .btn {
          width: 220px;
        }
        .mfa-panel-wrapper .mfa-add-contact-input-comp .add-contact {
          padding: 10px 0px;
        }
        .mfa-panel-wrapper .mfa-add-contact-input-comp .add-contact .auth-error-message,
        .mfa-panel-wrapper .mfa-verify-sms-comp .bar-code-input-comp .auth-error-message,
        .mfa-panel-wrapper .authenticator-bar-code-comp .bar-code-submit .bar-code-input-comp .auth-error-message {
          color: var(--cnv-red-error);
          margin-top: 4px;
        }
        .mfa-panel-wrapper .mfa-add-contact-input-comp .add-contact .add-contact-note {
          margin-top: 15px;
        }
        .mfa-panel-wrapper .mfa-add-contact-input-comp .add-contact .input-wrap {
          border-radius: 3px;
          border: 1px solid #e0e0e0;
          height: 38px;
          display: inline-block;
          padding: 2px;
          margin-right: 4px;
        }
        .mfa-panel-wrapper .mfa-add-contact-input-comp .add-contact .input-wrap input {
          height: 32px;
          vertical-align: middle;
          outline: none;
          border: none;
          width: 250px;
        }
        .mfa-panel-wrapper .mfa-verify-sms-comp .bar-code-input-comp,
        .mfa-panel-wrapper .authenticator-bar-code-comp .bar-code-submit .bar-code-input-comp {
          padding: 10px 0px;
        }
        .mfa-panel-wrapper .mfa-verify-sms-comp .bar-code-input-comp input,
        .mfa-panel-wrapper .authenticator-bar-code-comp .bar-code-submit .bar-code-input-comp input {
          height: 34px;
          vertical-align: middle;
          width: 280px;
          border-radius: 3px;
          border: 1px solid #e0e0e0;
          padding: 0px 4px;
          outline: none;
          transition: border 150ms;
        }
        .mfa-panel-wrapper .mfa-verify-sms-comp .bar-code-input-comp input:focus,
        .mfa-panel-wrapper .authenticator-bar-code-comp .bar-code-submit .bar-code-input-comp input:focus {
          border: 1px solid #aaa;
        }
        .mfa-panel-wrapper .mfa-verify-sms-comp .bar-code-input-comp .btn,
        .mfa-panel-wrapper .authenticator-bar-code-comp .bar-code-submit .bar-code-input-comp .btn {
          vertical-align: middle;
          margin-left: 4px;
        }
        .mfa-panel-wrapper .authenticator-bar-code-comp .bar-code {
          margin: 10px 0px;
        }
        .mfa-panel-wrapper .authenticator-bar-code-comp img {
          height: 186px;
          width: 186px;
          display: inline-block;
          vertical-align: middle;
        }
        .mfa-panel-wrapper .authenticator-bar-code-comp .bar-code-info {
          display: inline-block;
          vertical-align: middle;
          margin-left: 10px;
        }
        .mfa-panel-wrapper .authenticator-bar-code-comp .bar-code-info .bar-code-meta {
          margin: 10px 0px 0px 0px;
          background: #f2f8fb;
          padding: 4px;
          border-radius: 3px;
        }
        .mfa-panel-wrapper .authenticator-bar-code-comp .bar-code-info .bar-code-meta .auth-code {
          display: inline-block;
          padding: 2px 6px;
          background: #c3e0ed;
          border-radius: 3px;
          font-weight: bold;
          color: black;
          margin: 6px 0px;
        }
        .mfa-panel-wrapper .authenticator-bar-code-comp .bar-code-submit {
          margin: 8px 0px;
        }

        /* Backup codes modal styles (shared with Account Settings) */
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

        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .visible-dialog-only-on-print .app-wrapper {
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


