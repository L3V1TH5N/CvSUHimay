// File: web/src/pages/auth/SignIn.jsx

import { useState, useContext, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import { AppContext } from "../../context/AppContext";
import {
  Eye, EyeOff, AlertCircle, X,
  ArrowLeft, Mail, Lock, Check,
} from "lucide-react";
import {
  inputBase, inputErrorCls,
  Spinner, Divider, GoogleButton, FieldLabel,
} from "./authUtils.jsx";

const EMAIL_RE = /\S+@\S+\.\S+/;
const inputIconLeft = inputBase.replace("px-3.5", "pl-10 pr-3.5");
const inputIconBoth = inputBase.replace("px-3.5", "pl-10 pr-11");

const SignIn = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const modalCloseRef = useRef(null);

  const { login, googleSignIn } = useContext(AppContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (showForgotModal && modalCloseRef.current) {
      modalCloseRef.current.focus();
      const handleTab = (e) => {
        const focusable = modalCloseRef.current?.parentElement?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.key === 'Tab') {
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };
      document.addEventListener('keydown', handleTab);
      const handleEsc = (e) => { if (e.key === 'Escape') setShowForgotModal(false); };
      document.addEventListener('keydown', handleEsc);
      return () => {
        document.removeEventListener('keydown', handleTab);
        document.removeEventListener('keydown', handleEsc);
      };
    }
  }, [showForgotModal]);

  const redirectToDashboard = (user) => {
    if (user.role === "admin") return navigate("/admin/dashboard");
    if (user.role === "instructor") return navigate("/instructor/dashboard");
    return navigate("/student/dashboard");
  };

  const handleEmailBlur = () => {
    if (!email) return;
    const hasError = !EMAIL_RE.test(email);
    setErrors((p) => ({ ...p, email: hasError ? "Email is invalid" : "" }));
  };

  const validateForm = () => {
    const errs = {};
    if (!email) {
      errs.email = "Email is required";
    } else if (!EMAIL_RE.test(email)) {
      errs.email = "Email is invalid";
    }
    if (!password) {
      errs.password = "Password is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);
    setSubmitError("");
    try {
      const { user, must_change_password } = await login(email, password);
      if (must_change_password) {
        navigate(`/${user.role}/dashboard/settings`);
        return;
      }
      redirectToDashboard(user);
    } catch (error) {
      const data = error.response?.data;
      if (data?.errors && typeof data.errors === "object") {
        setErrors((prev) => ({ ...prev, ...data.errors }));
      } else if (data?.error) {
        const msg = String(data.error);
        if (/no account|not found|signup_required/i.test(msg)) {
          setErrors((p) => ({ ...p, email: "No account found. Try signing up." }));
        } else if (/password|invalid credentials|incorrect/i.test(msg)) {
          setErrors((p) => ({ ...p, password: "Incorrect password" }));
        } else {
          setSubmitError(msg || "Invalid credentials");
        }
      } else {
        setSubmitError("Invalid credentials");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setSubmitError("");
      setIsGoogleLoading(true);
      try {
        const user = await googleSignIn({ accessToken: tokenResponse.access_token });
        redirectToDashboard(user);
      } catch (error) {
        const data = error.response?.data;
        if (data?.errors && typeof data.errors === "object") {
          setErrors((prev) => ({ ...prev, ...data.errors }));
        } else if (data?.action === "signup_required") {
          setErrors((p) => ({ ...p, email: "No account found. Please sign up first." }));
        } else if (data?.error) {
          setSubmitError(String(data.error) || "Google sign-in failed");
        } else {
          setSubmitError("Google sign-in failed");
        }
      } finally {
        setIsGoogleLoading(false);
      }
    },
    onError: () => {
      setSubmitError("Failed to sign in with Google");
      setIsGoogleLoading(false);
    },
  });

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText("fasd@cvsu.edu.ph");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy");
    }
  };

  const isAnyLoading = isLoading || isGoogleLoading;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* LEFT PANEL - 60% - Brand / Editorial */}
      <div className="relative w-full lg:w-[60%] bg-[color:var(--color-surface-2)] dark:bg-[color:var(--color-surface-3)] lg:border-r border-[color:var(--color-border)] overflow-hidden lg:min-h-full">
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none auth-scale-pattern"
          style={{ color: 'var(--color-fg)' }}
          aria-hidden="true"
        >
          <defs>
            <pattern id="auth-fish-scale" x="0" y="0" width="20" height="15" patternUnits="userSpaceOnUse">
              <path d="M 0 15 Q 10 5 20 15" fill="none" stroke="currentColor" strokeWidth="1"/>
              <path d="M -10 7.5 Q 0 -2.5 10 7.5" fill="none" stroke="currentColor" strokeWidth="1"/>
              <path d="M 10 7.5 Q 20 -2.5 30 7.5" fill="none" stroke="currentColor" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#auth-fish-scale)"/>
        </svg>

        <div className="relative z-10 flex items-center justify-center px-6 py-12 lg:py-0 overflow-y-auto min-h-full">
          <div className="max-w-[480px] w-full">
            <div className="flex items-center gap-4 mb-12">
              <img
                src="/img/cvsu_logo.png"
                alt="Cavite State University"
                className="w-14 h-14 object-contain opacity-80 flex-shrink-0"
              />
              <div className="flex flex-col gap-0.5 leading-tight">
                <span className="text-[13px] ink font-medium tracking-[0.01em]">Cavite State University</span>
                <span className="text-[11.5px] ink-faint tracking-[0.01em]">Fisheries &amp; Aquatic Sciences Department</span>
              </div>
            </div>

            <h1 className="font-outfit text-[clamp(52px,6.5vw,72px)] leading-[0.98] ink mb-5">
              Welcome <span className="font-outfit-italic display-accent">back.</span>
            </h1>

            <p className="text-[16.5px] ink leading-[1.75] mb-10">
              Sign in to resume your deboning rehearsal. Your sessions, reports, and saved runs are waiting.
            </p>

            <p className="text-[14px] ink-faint">
              Don't have an account?{' '}
              <button type="button" onClick={() => navigate('/get-started')} className="ink font-medium link-accent border-b border-current pb-0.5 inline-flex items-center gap-1">
                Create one <span aria-hidden="true">→</span>
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - 40% - Form */}
      <div className="relative w-full lg:w-[40%] bg-[color:var(--color-surface)] flex items-center justify-center px-6 py-12 lg:py-0">
        <div className="absolute top-6 right-6 lg:top-8 lg:right-8">
          <Link to="/" className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.16em] ink-faint link-accent">
            <ArrowLeft className="w-3 h-3" strokeWidth={1.75} />
            Back to home
          </Link>
        </div>

        <div className="w-full max-w-[400px]">
          <div className="mb-6 flex items-center gap-3">
            <img
              src="/img/fish_logo.png"
              alt=""
              aria-hidden="true"
              className="w-12 h-12 object-contain"
              style={{
                filter:
                  'drop-shadow(1px 0 0 var(--color-accent)) ' +
                  'drop-shadow(-1px 0 0 var(--color-accent)) ' +
                  'drop-shadow(0 1px 0 var(--color-accent)) ' +
                  'drop-shadow(0 -1px 0 var(--color-accent))',
              }}
            />
            <span className="font-outfit-wordmark text-2xl leading-none">
              <span className="display-accent">CvSU</span>
              <span className="ink">Himay</span>
            </span>
          </div>

          <div className="flex items-center gap-3 mb-8 text-[11px] uppercase tracking-[0.22em]">
            <span className="display-accent font-semibold">Sign in</span>
            <span className="w-8 h-px bg-current opacity-40 ink-faint" aria-hidden="true" />
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <FieldLabel htmlFor="email">Email address</FieldLabel>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ink-faint pointer-events-none" strokeWidth={1.75} aria-hidden="true" />
                <input
                  id="email" name="email" type="email" autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }}
                  onBlur={handleEmailBlur}
                  placeholder="your@email.com"
                  className={`${inputIconLeft} ${errors.email ? inputErrorCls : ""}`}
                />
              </div>
              {errors.email && <p className="mt-1.5 text-[12.5px] text-red-600 dark:text-red-400">{errors.email}</p>}
            </div>

            <div>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ink-faint pointer-events-none" strokeWidth={1.75} aria-hidden="true" />
                <input
                  id="password" name="password" type={showPassword ? "text" : "password"}
                  autoComplete="current-password" value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: "" })); }}
                  placeholder="••••••••"
                  className={`${inputIconBoth} ${errors.password ? inputErrorCls : ""}`}
                />
                <button
                  type="button" onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 ink-faint link-accent p-0.5"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-[12.5px] text-red-600 dark:text-red-400">{errors.password}</p>}
            </div>

            <div className="mt-1 mb-3 flex justify-end">
              <button type="button" onClick={() => setShowForgotModal(true)} className="text-[10.5px] uppercase tracking-[0.14em] ink-faint link-accent">
                Forgot password?
              </button>
            </div>

            {submitError && (
              <div role="alert" aria-live="assertive" className="flex items-start gap-2.5 border-l-2 border-red-500 dark:border-red-400 bg-red-500/[0.05] dark:bg-red-400/[0.06] pl-3 pr-3 py-2.5 text-[13px] ink">
                <AlertCircle className="w-4 h-4 mt-px text-red-600 dark:text-red-400 shrink-0" strokeWidth={1.75} />
                <span>{submitError}</span>
              </div>
            )}

            <button
              type="submit" disabled={isAnyLoading}
              className="primary-cta w-full justify-center"
            >
              {isLoading ? <><Spinner /> Signing in…</> : <span>Sign in</span>}
            </button>

            <Divider />
            <GoogleButton loading={isGoogleLoading} disabled={isAnyLoading} onClick={() => signInWithGoogle()} label="Continue with Google" />
          </form>
        </div>
      </div>

      {/* Forgot password modal */}
      {showForgotModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowForgotModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-modal-title"
        >
          <div
            className="relative max-w-md w-full mx-4 border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              ref={modalCloseRef}
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 ink-faint hover:ink transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6">
              <div className="flex items-start gap-4 mb-5">
                <Lock className="w-8 h-8 text-[color:var(--color-accent)] shrink-0" strokeWidth={1.5} />
                <div>
                  <h3 id="forgot-modal-title" className="font-outfit text-xl ink">Reset your password</h3>
                  <p className="text-[14px] ink-muted mt-1">Contact the FASD office</p>
                </div>
              </div>

              <p className="text-[15px] ink leading-relaxed mb-4">
                Visit the Fisheries Building (Ground Floor) with your student ID, or email the address below. Password resets are processed within one working day.
              </p>

              <div className="bg-[color:var(--color-surface-2)] p-3 text-sm ink-muted border-l-2 border-[color:var(--color-accent)] mb-5">
                <strong className="ink">FASD Office – Naic Campus</strong><br />
                Ground floor, Fisheries Building<br />
                <span className="flex items-center justify-between gap-2 mt-2">
                  <a href="mailto:fasd@cvsu.edu.ph" className="font-mono text-[13px] link-accent hover:underline">
                    fasd@cvsu.edu.ph
                  </a>
                  <button
                    onClick={copyEmail}
                    className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-2 py-1 border border-[color:var(--color-border)] hover:bg-[color:var(--color-surface-3)] transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3" /> : "Copy"}
                    {copied && <span className="ml-1">Copied!</span>}
                  </button>
                </span>
              </div>

              <button
                onClick={() => setShowForgotModal(false)}
                className="w-full py-2.5 text-center text-[11px] uppercase tracking-wide ink-muted border border-[color:var(--color-border)] hover:bg-[color:var(--color-surface-2)] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignIn;
