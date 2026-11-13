"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Brand from "./Brand";

function Icon({ name }) {
  const paths = {
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    eyeOff: <><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3.2 4.1M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7c1 0 2-.2 2.8-.5"/></>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
  };
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function AuthPanel({ mode, notice }) {
  const router = useRouter();
  const isSignup = mode === "signup";
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [emailOrLogin, setEmailOrLogin] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [socialMessage, setSocialMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    setSubmitting(true);

    if (isSignup) {
      const passwordBytes = new TextEncoder().encode(password).length;
      if (!/^[a-zA-Z0-9_][a-zA-Z0-9_.-]{2,31}$/.test(username.trim())) {
        setFormError("Use 3–32 characters for your username: letters, numbers, dots, dashes, and underscores are allowed.");
        setSubmitting(false);
        return;
      }
      if (passwordBytes < 12 || passwordBytes > 72) {
        setFormError("Your password must be between 12 and 72 bytes.");
        setSubmitting(false);
        return;
      }
    } else if (new TextEncoder().encode(password).length > 72) {
      setFormError("Your password must be no more than 72 bytes.");
      setSubmitting(false);
      return;
    }

    try {
      const endpoint = isSignup ? "/api/auth/signup" : "/api/auth/login";
      const payload = isSignup
        ? { username: username.trim(), email: emailOrLogin.trim(), password }
        : { login: emailOrLogin.trim(), password };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setFormError(data?.error?.message || "We couldn’t complete your request. Please try again.");
        return;
      }
      setSuccess(true);
      const requestedNext = new URLSearchParams(window.location.search).get("next");
      const destination = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/dashboard";
      router.replace(destination);
      router.refresh();
    } catch {
      setFormError("Could not connect to the authentication service. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-panel">
      <div className="mobile-brand"><Brand /></div>
      <div className="auth-card">
        <div className="auth-heading">
          <span className="auth-kicker">{isSignup ? "GET STARTED" : "YOUR WORKSPACE AWAITS"}</span>
          <h2>{isSignup ? "Create your account" : "Welcome back"}</h2>
          <p>{isSignup ? "Start seeing your systems in a whole new light." : "Sign in to continue to your Tracewell workspace."}</p>
        </div>

        {success ? (
          <div className="success-panel" role="status">
            <span className="success-mark"><Icon name="check" /></span>
            <h3>{isSignup ? "Account created" : "You’re signed in"}</h3>
            <p>Your secure session is ready. Taking you to your dashboard…</p>
          </div>
        ) : (
          <>
            <button className="social-button" type="button" onClick={() => setSocialMessage("GitHub sign-in is not available yet. Use your email and password.")}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .9a11.1 11.1 0 0 0-3.5 21.6c.6.1.8-.3.8-.6v-2.1c-3.1.7-3.8-1.3-3.8-1.3-.5-1.3-1.2-1.6-1.2-1.6-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 .1.7 2.1 3.5 1.5.1-.7.4-1.2.7-1.5-2.5-.3-5.1-1.2-5.1-5.5 0-1.2.4-2.1 1.2-2.9-.1-.3-.5-1.4.1-2.9 0 0 1-.3 3.1 1.1a10.7 10.7 0 0 1 5.7 0c2.1-1.4 3.1-1.1 3.1-1.1.6 1.5.2 2.6.1 2.9.8.8 1.2 1.7 1.2 2.9 0 4.3-2.6 5.2-5.1 5.5.4.3.8 1 .8 2v2.9c0 .3.2.7.8.6A11.1 11.1 0 0 0 12 .9Z"/></svg>
              Continue with GitHub
            </button>
            {notice && <p className="inline-note" role="status">{notice}</p>}
            {socialMessage && <p className="inline-note" role="status">{socialMessage}</p>}
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <div className="auth-divider"><span/>OR CONTINUE WITH EMAIL<span/></div>
            <form className="auth-form" onSubmit={handleSubmit}>
              {isSignup && (
                <>
                  <label htmlFor="signup-username">Username</label>
                  <div className="input-field"><Icon name="user"/><input id="signup-username" type="text" name="username" placeholder="e.g. sam_dev" autoComplete="username" minLength={3} maxLength={32} value={username} onChange={event => setUsername(event.target.value)} required /></div>
                  <p className="field-hint">3–32 characters: letters, numbers, dots, dashes, or underscores.</p>
                </>
              )}
              <label htmlFor={isSignup ? "signup-email" : "login-identifier"}>{isSignup ? "Work email" : "Email or username"}</label>
              <div className="input-field"><Icon name="mail"/><input id={isSignup ? "signup-email" : "login-identifier"} type={isSignup ? "email" : "text"} name={isSignup ? "email" : "login"} maxLength={254} placeholder={isSignup ? "you@company.com" : "you@company.com or username"} autoComplete={isSignup ? "email" : "username"} value={emailOrLogin} onChange={event => setEmailOrLogin(event.target.value)} required /></div>
              <div className="password-label"><label htmlFor={mode + "-password"}>Password</label>{isSignup ? <span>12–72 bytes</span> : <a href="#forgot-password">Forgot password?</a>}</div>
              <div className="input-field"><Icon name="lock"/><input id={mode + "-password"} type={showPassword ? "text" : "password"} name="password" placeholder={isSignup ? "Create a password" : "Enter your password"} autoComplete={isSignup ? "new-password" : "current-password"} maxLength={72} value={password} onChange={event => setPassword(event.target.value)} required /><button className="visibility-button" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"}><Icon name={showPassword ? "eyeOff" : "eye"}/></button></div>
              {isSignup && <label className="remember-row"><input type="checkbox" required/><span>I agree to the <a href="#terms">Terms of Service</a> and <a href="#privacy">Privacy Policy</a>.</span></label>}
              <button className="submit-button" type="submit" disabled={submitting}>{submitting ? "Please wait…" : isSignup ? "Create account" : "Sign in"}<Icon name="arrow"/></button>
            </form>
            {!isSignup && <p className="secure-note"><span className="shield">✳</span> Your account is protected with secure authentication.</p>}
          </>
        )}
        <p className="auth-switch">{isSignup ? "Already have an account?" : "New to Tracewell?"} <Link href={isSignup ? "/login" : "/"} onClick={event => {
          const requestedNext = new URLSearchParams(window.location.search).get("next");
          if (requestedNext) {
            event.preventDefault();
            router.push((isSignup ? "/login" : "/") + "?next=" + encodeURIComponent(requestedNext));
          }
        }}>{isSignup ? "Sign in" : "Create an account"} <Icon name="arrow"/></Link></p>
      </div>
      <footer className="auth-footer"><span>Observability for the moments that matter.</span><span><a href="#privacy">Privacy</a><a href="#support">Support</a></span></footer>
    </section>
  );
}
