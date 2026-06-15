// File: web/src/pages/auth/GetStarted.jsx

import { useState, useContext } from "react";
import { useNavigate, Link }    from "react-router-dom";
import { useGoogleLogin }       from "@react-oauth/google";
import { AppContext }           from "../../context/AppContext";
import {
  Eye, EyeOff, ArrowLeft, ArrowRight,
  AlertCircle, CheckCircle2, Circle,
  Mail, Lock, User,
} from "lucide-react";
import {
  inputBase, inputErrorCls,
  Spinner, Divider, GoogleButton, FieldLabel,
} from "./authUtils.jsx";

const inputIconLeft = inputBase.replace("px-3.5", "pl-10 pr-3.5");
const inputIconBoth = inputBase.replace("px-3.5", "pl-10 pr-11");

// ── Field wrapper ─────────────────────────────────────────────────────────────
const Field = ({ label, htmlFor, error, children }) => (
  <div>
    <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
    {children}
    {error && <p className="mt-1.5 text-[12px] text-red-600 dark:text-red-400">{error}</p>}
  </div>
);

// ── Component ─────────────────────────────────────────────────────────────────
const GetStarted = () => {
  const [formData, setFormData] = useState({
    full_name:       "",
    email:           "",
    password:        "",
    confirmPassword: "",
  });

  const [showPassword,        setShowPassword]        = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading,           setIsLoading]           = useState(false);
  const [isGoogleLoading,     setIsGoogleLoading]     = useState(false);
  const [errors,              setErrors]              = useState({});
  const [submitted,           setSubmitted]           = useState(false);

  const { register, googleSignUp } = useContext(AppContext);
  const navigate = useNavigate();

  const redirectAfterAuth = () => navigate("/student");

  // ── Password strength ─────────────────────────────────────────────────────
  const getPasswordStrength = (pw) => {
    if (!pw) return { strength: 0, label: "", color: "", checks: {} };
    const checks = {
      length:    pw.length >= 8,
      lowercase: /[a-z]/.test(pw),
      uppercase: /[A-Z]/.test(pw),
      number:    /[0-9]/.test(pw),
      special:   /[!@#$%^&*()_+\-={}[\]|\\:;"'<>,.?/~`]/.test(pw),
    };
    const score = Object.values(checks).filter(Boolean).length;
    if (score <= 2) return { strength: 1, label: "Weak",   color: "bg-red-500",    checks };
    if (score <= 3) return { strength: 2, label: "Fair",   color: "bg-yellow-500", checks };
    if (score <= 4) return { strength: 3, label: "Good",   color: "bg-blue-500",   checks };
    return               { strength: 4, label: "Strong", color: "bg-green-600",  checks };
  };
  const passwordStrength = getPasswordStrength(formData.password);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const errs = {};
    if (!formData.full_name.trim())                 errs.full_name = "Full name is required";
    if (!formData.email)                            errs.email     = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errs.email     = "Email is invalid";
    if (!formData.password)                         errs.password  = "Password is required";
    else if (formData.password.length < 8)          errs.password  = "At least 8 characters";
    else if (!/[A-Za-z]/.test(formData.password))  errs.password  = "Must contain a letter";
    else if (!/\d/.test(formData.password))         errs.password  = "Must contain a digit";
    if (!formData.confirmPassword)
      errs.confirmPassword = "Please confirm your password";
    else if (formData.password !== formData.confirmPassword)
      errs.confirmPassword = "Passwords do not match";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);
    setErrors({});
    try {
      await register({
        email:     formData.email,
        password:  formData.password,
        full_name: formData.full_name,
        role:      "student",
      });
      setSubmitted(true);
      setTimeout(redirectAfterAuth, 1500);
    } catch (error) {
      const data = error.response?.data;
      if (data?.errors && typeof data.errors === "object") {
        setErrors((prev) => ({ ...prev, ...data.errors }));
      } else if (data?.details) {
        const details = Array.isArray(data.details) ? data.details : [data.details];
        const fieldErrs = {};
        details.forEach((d) => {
          const msg = String(d);
          if (/email/i.test(msg))               fieldErrs.email     = msg;
          else if (/password/i.test(msg))       fieldErrs.password  = msg;
          else if (/name|full_name/i.test(msg)) fieldErrs.full_name = msg;
          else fieldErrs.submit = fieldErrs.submit ? `${fieldErrs.submit}; ${msg}` : msg;
        });
        setErrors((prev) => ({ ...prev, ...fieldErrs }));
      } else if (data?.error) {
        const msg = String(data.error || "Registration failed");
        if (/email/i.test(msg)) setErrors((p) => ({ ...p, email: msg }));
        else                    setErrors((p) => ({ ...p, submit: msg }));
      } else {
        setErrors((p) => ({ ...p, submit: "Registration failed" }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsGoogleLoading(true);
      setErrors({});
      try {
        await googleSignUp({ role: "student", accessToken: tokenResponse.access_token });
        redirectAfterAuth();
      } catch (error) {
        const data = error.response?.data;
        if (data?.errors && typeof data.errors === "object") {
          setErrors((prev) => ({ ...prev, ...data.errors }));
        } else if (data?.error) {
          const msg = String(data.error);
          if (/email/i.test(msg)) setErrors((p) => ({ ...p, email: msg }));
          else                    setErrors((p) => ({ ...p, submit: msg }));
        } else {
          setErrors((p) => ({ ...p, submit: "Google sign-up failed. Please try again." }));
        }
      } finally {
        setIsGoogleLoading(false);
      }
    },
    onError: () => {
      setErrors({ submit: "Failed to sign up with Google" });
      setIsGoogleLoading(false);
    },
  });

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
            <pattern id="auth-getstarted-scale" x="0" y="0" width="20" height="15" patternUnits="userSpaceOnUse">
              <path d="M 0 15 Q 10 5 20 15"       fill="none" stroke="currentColor" strokeWidth="1"/>
              <path d="M -10 7.5 Q 0 -2.5 10 7.5" fill="none" stroke="currentColor" strokeWidth="1"/>
              <path d="M 10 7.5 Q 20 -2.5 30 7.5" fill="none" stroke="currentColor" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#auth-getstarted-scale)"/>
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
              Begin <span className="font-outfit-italic display-accent">training.</span>
            </h1>

            <p className="text-[16.5px] ink leading-[1.75] mb-10">
              Set up your training profile in under two minutes. Practice the full bangus deboning procedure at your own pace — every cut, every bone, every retake.
            </p>

            <p className="text-[14px] ink-faint">
              Already have an account?{' '}
              <Link to="/signin" className="ink font-medium link-accent border-b border-current pb-0.5 inline-flex items-center gap-1">
                Sign in <span aria-hidden="true">→</span>
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - 40% - Form */}
      <div className="relative w-full lg:w-[40%] bg-[color:var(--color-surface)] flex items-center justify-center px-6 py-16 overflow-y-auto">
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
            <span className="display-accent font-semibold">Create account</span>
            <span className="w-8 h-px bg-current opacity-40 ink-faint" aria-hidden="true" />
          </div>

          {submitted ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-500" strokeWidth={1.5} />
              <div>
                <p className="font-outfit text-[26px] ink leading-tight mb-1">Welcome aboard.</p>
                <p className="text-[13.5px] ink-muted">Taking you to your bench…</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <Field label="Full name" htmlFor="full_name" error={errors.full_name}>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ink-faint pointer-events-none" strokeWidth={1.75} aria-hidden="true" />
                  <input
                    id="full_name" name="full_name" type="text" autoComplete="name"
                    value={formData.full_name} onChange={handleChange}
                    placeholder="Juan dela Cruz"
                    className={`${inputIconLeft} ${errors.full_name ? inputErrorCls : ""}`}
                  />
                </div>
              </Field>

              <Field label="Email address" htmlFor="email" error={errors.email}>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ink-faint pointer-events-none" strokeWidth={1.75} aria-hidden="true" />
                  <input
                    id="email" name="email" type="email" autoComplete="email"
                    value={formData.email} onChange={handleChange}
                    placeholder="you@cvsu.edu.ph"
                    className={`${inputIconLeft} ${errors.email ? inputErrorCls : ""}`}
                  />
                </div>
              </Field>

              <div>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ink-faint pointer-events-none" strokeWidth={1.75} aria-hidden="true" />
                  <input
                    id="password" name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={formData.password} onChange={handleChange}
                    placeholder="Min. 8 characters"
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

                {formData.password && (
                  <div className="mt-2.5 space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((seg) => (
                        <div
                          key={seg}
                          className={`flex-1 h-[2px] transition-colors duration-300 ${
                            passwordStrength.strength >= seg ? passwordStrength.color : "bg-[color:var(--color-surface-3)]"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-[11px] ink-faint">
                      {passwordStrength.label && <>Strength: <span className="ink font-medium">{passwordStrength.label}</span></>}
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px]">
                      {[
                        { key: "length",    label: "8+ chars" },
                        { key: "uppercase", label: "A–Z"      },
                        { key: "lowercase", label: "a–z"      },
                        { key: "number",    label: "0–9"      },
                        { key: "special",   label: "symbol"   },
                      ].map(({ key, label }) => {
                        const met = Boolean(passwordStrength.checks[key]);
                        return (
                          <li key={key} className={`inline-flex items-center gap-1 ${met ? "ink" : "ink-faint"}`}>
                            {met
                              ? <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-500 shrink-0" strokeWidth={2} aria-hidden="true" />
                              : <Circle className="w-3 h-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                            }
                            {label}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {errors.password && <p className="mt-1.5 text-[12px] text-red-600 dark:text-red-400">{errors.password}</p>}
              </div>

              <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword}>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ink-faint pointer-events-none" strokeWidth={1.75} aria-hidden="true" />
                  <input
                    id="confirmPassword" name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={formData.confirmPassword} onChange={handleChange}
                    placeholder="Re-enter password"
                    className={`${inputIconBoth} ${errors.confirmPassword ? inputErrorCls : ""}`}
                  />
                  <button
                    type="button" onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? "Hide" : "Show"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 ink-faint link-accent p-0.5"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
                  </button>
                </div>
              </Field>

              {errors.submit && (
                <div role="alert" aria-live="assertive" className="flex items-start gap-2.5 border-l-2 border-red-500 dark:border-red-400 bg-red-500/[0.05] dark:bg-red-400/[0.06] pl-3 pr-3 py-2.5 text-[13px] ink">
                  <AlertCircle className="w-4 h-4 mt-px text-red-600 dark:text-red-400 shrink-0" strokeWidth={1.75} />
                  <span>{errors.submit}</span>
                </div>
              )}

              <button
                type="submit" disabled={isAnyLoading}
                className="primary-cta w-full justify-center"
              >
                {isLoading ? (
                  <><Spinner /> Creating account…</>
                ) : (
                  <>Begin training <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} /></>
                )}
              </button>

              <Divider />
              <GoogleButton loading={isGoogleLoading} disabled={isAnyLoading} onClick={() => signUpWithGoogle()} label="Sign up with Google" />

              <p className="text-[11px] ink-faint text-center pt-1">
                Made exclusively for CvSU – Naic fisheries students.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default GetStarted;
