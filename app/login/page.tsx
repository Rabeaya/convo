'use client';

/**
 * Login Page - Exact replication of AngularJS login UI
 * 
 * Matches the AngularJS login page pixel-perfect
 */

import { useEffect, useState, useRef } from 'react';
import { useLogin, useSession } from '@/lib/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from "next/link";
import { useAuthStore } from '@/lib/stores/auth-store';
import type { ApiResponse } from '@/lib/api/client';
import type { SessionCheckResponse } from '@/lib/api/auth';
import './login.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [shakeForm, setShakeForm] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  
  const loginMutation = useLogin();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: sessionData, isLoading: sessionLoading } = useSession();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const loginData = useAuthStore((state) => state.loginData);

  // Initialize email from URL hash or localStorage (matching AngularJS behavior)
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const emailFromHash = hashParams.get('email');
    
    if (emailFromHash && !email.trim()) {
      setTimeout(() => {
        setEmail(decodeURIComponent(emailFromHash));
      }, 150);
    } else {
      try {
        const localStorageEmail = localStorage.getItem('com.convo.login.email');
        if (localStorageEmail && !email.trim()) {
          setTimeout(() => {
            setEmail(localStorageEmail);
          }, 150);
        }
      } catch (excp) {
        // localStorage not available
      }
    }
  }, []);

  // Initialize input--filled class based on initial values & autofill check
  useEffect(() => {
    const emailInput = emailInputRef.current;
    const passwordInput = passwordInputRef.current;
    
    if (emailInput && emailInput.value.trim()) {
      emailInput.closest('.input')?.classList.add('input--filled');
    }
    if (passwordInput && passwordInput.value.trim()) {
      passwordInput.closest('.input')?.classList.add('input--filled');
    }
    
    // Check for browser autofill
    let intervalCount = 0;
    const checkAutofill = setInterval(() => {
      if (emailInput && emailInput.value.trim()) {
        emailInput.closest('.input')?.classList.add('input--filled');
      }
      if (passwordInput && passwordInput.value.trim()) {
        passwordInput.closest('.input')?.classList.add('input--filled');
      }
      intervalCount++;
      if (intervalCount >= 20) {
        clearInterval(checkAutofill);
      }
    }, 25);
    
    return () => clearInterval(checkAutofill);
  }, []);

  useEffect(() => {
    // Check for server-side redirect errors
    const errorMessage = searchParams.get('error');
    if (errorMessage) {
      setError(decodeURIComponent(errorMessage));
    }

    // If already logged in, redirect to feed (home experience)
    const sessionResponse = sessionData as ApiResponse<SessionCheckResponse> | undefined;
    if (!sessionLoading && (isAuthenticated || loginData || sessionResponse?.data?.isSignedIn)) {
      const redirectUrl = searchParams.get('redirect');
      router.push(redirectUrl || '/feed');
    }
  }, [searchParams, isAuthenticated, loginData, sessionData, sessionLoading, router]);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase();
    setEmail(value);
    setEmailError(false);
    setError(null);
    const inputSpan = e.target.closest('.input');
    if (value.trim()) {
      inputSpan?.classList.add('input--filled');
    } else {
      inputSpan?.classList.remove('input--filled');
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    setPasswordError(false);
    setError(null);
    const inputSpan = e.target.closest('.input');
    if (e.target.value.trim()) {
      inputSpan?.classList.add('input--filled');
    } else {
      inputSpan?.classList.remove('input--filled');
    }
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const inputSpan = e.target.closest('.input');
    inputSpan?.classList.add('input--filled');
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const input = e.target;
    const inputSpan = input.closest('.input');
    if (!input.value.trim()) {
      inputSpan?.classList.remove('input--filled');
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShakeForm(false);
    setEmailError(false);
    setPasswordError(false);
    setError(null);

    // Client-side validation
    if (!email.trim()) {
      setError('All fields must be completed.');
      setEmailError(true);
      setShakeForm(true);
      setTimeout(() => setShakeForm(false), 600);
      return;
    }

    if (!password.trim()) {
      setError('All fields must be completed.');
      setPasswordError(true);
      setShakeForm(true);
      setTimeout(() => setShakeForm(false), 600);
      return;
    }

    // Save email to localStorage if rememberMe is checked
    if (rememberMe) {
      try {
        localStorage.setItem('com.convo.login.email', email.trim());
      } catch (excp) {
        // localStorage not available
      }
    }

    try {
      await loginMutation.mutateAsync({
        email: email.trim(),
        pass: password,
        version: typeof window !== 'undefined' 
          ? (window as { com_convo?: { clientVersion?: string } }).com_convo?.clientVersion 
          : undefined,
        ct: 'w2', // client type: web
        timezoneOffset: -new Date().getTimezoneOffset(),
        rememberMe,
      });
      // Redirection is handled in useLogin's onSuccess
    } catch (err: any) {
      const errorMessage = err.message || 'Incorrect email/phone or password.';
      setError(errorMessage);
      setPasswordError(true);
      setShakeForm(true);
      setTimeout(() => setShakeForm(false), 600);
      console.error('Login error:', err);
    }
  };

  const loading = loginMutation.isPending;

  return (
    <div className="bodyContainer">
      <div className="container">
        {/* Logo Section */}
        <div className="logo logo-pad-bot">
          <a href="/" className="convo-logo">
            <img src="/images/logo.png" alt="Convo" />
          </a>
          <div className="logo_bot_container">
            {error && (
              <div className="errorWrapper" style={{ display: 'block' }}>
                <p dangerouslySetInnerHTML={{ __html: error }}></p>
              </div>
            )}
          </div>
        </div>

        {/* Login Form */}
        <form 
          id="loginForm" 
          onSubmit={handleSubmit} 
          className={shakeForm ? 'invalid' : ''}
        >
          <div className="fieldsWrapper">
            <div className="field-wrapper-signin">
              {/* Email Field */}
              <div className={`fieldHolder ${emailError ? 'errorField' : ''}`}>
                <span className="input input--haruki">
                  <input
                    ref={emailInputRef}
                    className="input__field input__field--haruki"
                    id="email"
                    type="text"
                    name="email"
                    value={email}
                    onChange={handleEmailChange}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    autoComplete="email"
                    required
                    disabled={loading}
                  />
                  <label className="input__label input__label--haruki email" htmlFor="email">
                    <span className="input__label-content input__label-content--haruki email" id="email_phone_label">
                      EMAIL OR PHONE NUMBER
                    </span>
                  </label>
                </span>
              </div>

              {/* Password Field */}
              <div className={`fieldHolder ${passwordError ? 'errorField' : ''}`}>
                <span className="input input--haruki">
                  <input
                    ref={passwordInputRef}
                    className="input__field input__field--haruki"
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={password}
                    onChange={handlePasswordChange}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    autoComplete="off"
                    data-required="1"
                    required
                    disabled={loading}
                  />
                  <label className="input__label input__label--haruki password" htmlFor="password">
                    <span className="input__label-content input__label-content--haruki password">
                      PASSWORD
                    </span>
                  </label>
                  {/* Password Visibility Toggle */}
                  <div className="password-toggle-icon" onClick={togglePasswordVisibility}>
                    {showPassword ? (
                      <img src="/images/view-red.svg" alt="Hide password" onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }} />
                    ) : (
                      <img src="/images/seen-icn.svg" alt="Show password" onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }} />
                    )}
                  </div>
                </span>
              </div>

              <div className="clear-fix"></div>

              {/* Forgot Password Link */}
              <div className="remember">
                <Link href="/forgot-password">Forgot password?</Link>
              </div>

              {/* Remember Me Checkbox - Below Forgot Password */}
              <div className="checkboxes">
                <table>
                  <tbody>
                    <tr>
                      <td>
                        <input
                          type="checkbox"
                          id="rememberMe"
                          name="rememberMe"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          disabled={loading}
                        />
                      </td>
                      <td style={{ paddingLeft: '4px' }}>
                        <label htmlFor="rememberMe">Remember me on this computer</label>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            id="signIn"
            type="submit"
            className={`progress-button ${loading ? 'state-loading' : ''}`}
            data-style="fill"
            data-horizontal=""
            disabled={loading}
          >
            <span className="content" id="btnSignIn">
              {loading ? 'Signing in...' : 'Sign in'}
            </span>
            <span className="progress">
              <span
                className={`progress-inner ${loading ? '' : 'notransition'}`}
                style={{ width: loading ? '100%' : '0%', opacity: 1 }}
              ></span>
            </span>
          </button>
        </form>

        {/* Footer */}
        <div className="footer">
          <p className="sso_text not_on_mfa not_on_sso" onClick={() => {
            console.log('SSO login clicked');
          }}>
            <span className="not_on_sso">
              <img 
                src="/images/Icon1_singlesignon-01.svg"
                alt="SSO" 
                style={{ display: 'inline-block', width: '16px', height: 'auto', marginRight: '8px', verticalAlign: 'middle' }}
                onError={(e) => {
                  console.error('Failed to load SSO icon. Attempted path:', e.currentTarget.src);
                }} 
              />{' '}Sign in with your company ID (SSO)
            </span>
          </p>
          <div style={{ height: '2px' }}>&nbsp;</div>
          <p className="signup_now">
            <Link href="/signup">New to Convo? Sign up now</Link>
          </p>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="footerbot">
        <a href="https://www.convo.com/privacy-policy/" target="_blank" rel="noopener noreferrer">
          Privacy
        </a>
        {' · '}
        <a href="https://www.convo.com/security-policy/" target="_blank" rel="noopener noreferrer">
          Security
        </a>
        {' · '}
        <a href="https://www.convo.com/gdpr/" target="_blank" rel="noopener noreferrer">
          GDPR
        </a>
        {' · '}
        <a href="https://www.convo.com/terms/" target="_blank" rel="noopener noreferrer">
          Terms of Service
        </a>
      </div>
    </div>
  );
}
