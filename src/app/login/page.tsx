'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  updateProfile,
  type ConfirmationResult,
  type User,
} from 'firebase/auth'
import { auth } from '@/lib/firebase/clientApp'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Loader2, Smartphone, ArrowLeft, ArrowRight } from 'lucide-react'
import { syncUserOnSignup, checkUserExists, getPostLoginRedirect } from '@/app/actions/auth-actions'
import toast from 'react-hot-toast'

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
    grecaptcha?: {
      reset(widgetId?: number): void;
    };
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function LoginPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'PHONE' | 'OTP' | 'NAME'>('PHONE')
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)
  
  // Resend OTP state
  const [resendTimer, setResendTimer] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch {}
        window.recaptchaVerifier = undefined;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('loggedOut') === 'true') {
      auth.signOut();
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Pre-warm reCAPTCHA early so user doesn't wait 5-10s when clicking "Send Code"
  const prewarmRecaptcha = () => {
    if (typeof window === 'undefined') return;
    if (!window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
        });
        window.recaptchaVerifier.render().catch(() => {});
      } catch {}
    }
  };

  // Handle countdown for resend OTP
  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, [resendTimer]);

  // Auto-submit OTP
  const lastSubmittedOtp = useRef('');
  const otpFormRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (step === 'OTP' && otp.length === 6 && !loading && otp !== lastSubmittedOtp.current) {
      lastSubmittedOtp.current = otp;
      otpFormRef.current?.requestSubmit();
    }
  }, [otp, step, loading]);

  const getFormattedPhone = () => {
    let digits = phone.replace(/\D/g, '');

    // Strip leading 0 if provided (e.g. 09876543210 -> 9876543210)
    if (digits.length === 11 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }

    if (digits.length === 10) {
      return `+91${digits}`;
    }

    if (digits.length === 12 && digits.startsWith('91')) {
      return `+${digits}`;
    }

    return phone.trim().startsWith('+') ? `+${digits}` : `+91${digits}`;
  };

  async function sendOtp() {
    const formattedPhone = getFormattedPhone();
    const digitsOnly = formattedPhone.replace(/\D/g, '');

    if (digitsOnly.length < 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);

    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
        });
        await window.recaptchaVerifier.render();
      }

      const appVerifier = window.recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(confirmation);
      setStep('OTP');
      setOtp('');
      lastSubmittedOtp.current = '';
      setResendTimer(45);
      toast.success('Verification code sent via SMS!');
    } catch (error: unknown) {
      console.error(error);
      toast.error(getErrorMessage(error, "Failed to send SMS OTP. Please check your number and try again."));
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.render().then((widgetId) => {
          window.grecaptcha?.reset(widgetId);
        });
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSendOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    return sendOtp();
  }

  const submittingOtpRef = useRef(false)

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (otp.length !== 6 || submittingOtpRef.current) return;
    
    submittingOtpRef.current = true;
    setLoading(true)
    const formattedPhone = getFormattedPhone()

    try {
      if (!confirmationResult) {
        throw new Error("OTP session expired. Please request a new code.")
      }
      const result = await confirmationResult.confirm(otp)
      const firebaseUser = result.user

      const idToken = await firebaseUser.getIdToken()
      const dbCheck = await checkUserExists(formattedPhone, idToken);

      if (dbCheck.error) {
        throw new Error(dbCheck.error);
      }

      if (dbCheck.exists) {
        await completeLogin(firebaseUser, formattedPhone, '')
      } else {
        setStep('NAME')
        setLoading(false)
      }
    } catch (error: unknown) {
      console.error(error)
      toast.error(getErrorMessage(error, "Invalid verification code. Please try again."))
      setLoading(false)
    } finally {
      submittingOtpRef.current = false;
    }
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    setLoading(true)
    
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Authentication lost. Please try again.");
      
      await updateProfile(currentUser, { displayName: name });
      const formattedPhone = getFormattedPhone();
      
      await completeLogin(currentUser, formattedPhone, name);
    } catch (error: unknown) {
      console.error(error)
      toast.error(getErrorMessage(error, "Failed to save profile."))
      setLoading(false)
    }
  }

  async function completeLogin(firebaseUser: User, phone: string, userName: string) {
    try {
      const idToken = await firebaseUser.getIdToken()

      const syncResult = await syncUserOnSignup(idToken, phone, userName)
      if (syncResult && 'error' in syncResult) {
        toast.error(syncResult.error || "An error occurred during signup");
        setLoading(false)
        return
      }

      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      })

      if (res.ok) {
        toast.success("Successfully logged in!")
        const urlParams = new URLSearchParams(window.location.search)
        
        if (urlParams.get('popup') === 'true') {
          window.opener?.postMessage({ type: 'LOGIN_SUCCESS', token: idToken }, window.location.origin);
          window.close();
          return;
        }

        const returnUrl = urlParams.get('returnUrl')
        if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
          window.location.href = returnUrl
        } else {
          const dest = await getPostLoginRedirect()
          window.location.href = dest
        }
      } else {
        toast.error("Verified, but failed to create secure session")
        setLoading(false)
      }
    } catch (error: unknown) {
      console.error(error)
      toast.error("Failed to complete login.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FBFBFA] flex flex-col justify-between relative overflow-hidden font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Ambient background canvas */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.07),rgba(255,255,255,0))] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none" />
      <div className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />

      {/* Invisible reCAPTCHA container hidden off-screen */}
      <div id="recaptcha-container" className="hidden" aria-hidden="true" />

      {/* Top Navigation Bar */}
      <header className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between z-20">
        <Link href="/" className="inline-flex items-center gap-2.5 group">
          <Image 
            src="/final-logo.svg" 
            alt="FocusX Logo" 
            width={34} 
            height={34} 
            className="object-contain transition-transform group-hover:scale-105" 
            priority
          />
          <span className="text-xl font-bold tracking-tight text-slate-900">
            Focus<span className="text-blue-600">X</span>
          </span>
        </Link>

        <Link 
          href="/libraries" 
          className="text-xs sm:text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors inline-flex items-center gap-1.5"
        >
          <span>Explore Libraries</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </header>

      {/* Center Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 relative z-10 w-full">
        <motion.div 
          initial={{ opacity: 0, y: 16, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[420px] bg-white border border-slate-200/90 rounded-2xl p-7 sm:p-9 shadow-xl shadow-slate-200/60 backdrop-blur-sm"
        >
          {/* Card Header */}
          <div className="text-center mb-7">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100/80 mb-3.5 shadow-2xs">
              <Image src="/final-logo.svg" alt="FocusX Logo" width={26} height={26} className="object-contain" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Welcome</h1>
            <p className="text-sm text-slate-500 mt-1">Sign in or create your student account</p>
          </div>

          <AnimatePresence mode="wait">
            {step === 'PHONE' && (
              <motion.div
                key="step-phone"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.2 }}
              >
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Student Contact Number
                    </Label>
                    <div className="flex rounded-xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all overflow-hidden shadow-2xs">
                      <div className="flex items-center justify-center px-3.5 bg-slate-50 border-r border-slate-200 text-slate-700 text-sm font-semibold select-none">
                        +91
                      </div>
                      <Input 
                        id="phone" 
                        type="tel" 
                        value={phone}
                        onFocus={prewarmRecaptcha}
                        onChange={(e) => {
                          prewarmRecaptcha();
                          const val = e.target.value.replace(/\D/g, '');
                          if (val.length <= 10) setPhone(val);
                        }}
                        placeholder="9999999999" 
                        className="border-0 shadow-none rounded-none focus-visible:ring-0 text-base font-medium h-12 text-slate-900 placeholder:text-slate-400"
                        required 
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Single Clean Primary Blue Button for SMS OTP */}
                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm hover:shadow transition-all text-sm flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50 mt-2"
                    disabled={loading || phone.length !== 10}
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Smartphone className="w-4 h-4 text-white" />
                    )}
                    <span>{loading ? "Sending code..." : "Send Verification Code"}</span>
                  </Button>
                </form>
              </motion.div>
            )}

            {step === 'OTP' && (
              <motion.div
                key="step-otp"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.2 }}
              >
                <form ref={otpFormRef} onSubmit={handleVerifyOtp} className="space-y-5">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('PHONE');
                      setOtp('');
                      setResendTimer(0);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium mb-1 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to mobile number
                  </button>

                  <div className="text-center">
                    <h2 className="text-xl font-bold tracking-tight text-slate-900">Enter verification code</h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                      Sent via SMS to{' '}
                      <span className="font-semibold text-slate-800">+91 {phone}</span>
                    </p>
                  </div>

                  <div className="flex justify-center pt-1">
                    <InputOTP 
                      id="otp" 
                      maxLength={6} 
                      value={otp}
                      onChange={(val) => setOtp(val)}
                      autoFocus
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} className="w-12 h-14 text-xl rounded-l-xl" />
                        <InputOTPSlot index={1} className="w-12 h-14 text-xl" />
                        <InputOTPSlot index={2} className="w-12 h-14 text-xl" />
                        <InputOTPSlot index={3} className="w-12 h-14 text-xl" />
                        <InputOTPSlot index={4} className="w-12 h-14 text-xl" />
                        <InputOTPSlot index={5} className="w-12 h-14 text-xl rounded-r-xl" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-sm transition-all" 
                    disabled={loading || otp.length !== 6}
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                    {loading ? "Verifying..." : "Verify & Continue"}
                  </Button>

                  <div className="text-center pt-2 border-t border-slate-100">
                    <button 
                      type="button" 
                      onClick={() => resendTimer === 0 ? sendOtp() : undefined}
                      disabled={resendTimer > 0 || loading}
                      className={`text-xs sm:text-sm font-medium ${resendTimer > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-blue-600 hover:underline'}`}
                    >
                      {resendTimer > 0 
                        ? `Resend code via SMS in ${resendTimer}s` 
                        : "Resend code via SMS"}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {step === 'NAME' && (
              <motion.div
                key="step-name"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.2 }}
              >
                <form onSubmit={handleSaveName} className="space-y-4">
                  <div className="text-center mb-4">
                    <h2 className="text-xl font-bold tracking-tight text-slate-900">What should we call you?</h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">Looks like you&apos;re new to FocusX!</p>
                  </div>
                  <Input 
                    id="name" 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name" 
                    className="h-12 text-center text-base rounded-xl border-slate-200"
                    required 
                    autoFocus
                  />

                  <Button type="submit" className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm" disabled={loading || !name.trim()}>
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                    {loading ? "Saving..." : "Continue to Dashboard"}
                  </Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2 z-20">
        <p>© {new Date().getFullYear()} FocusX. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-slate-600 transition-colors">Privacy Policy</Link>
          <Link href="/about" className="hover:text-slate-600 transition-colors">About</Link>
          <Link href="/contact" className="hover:text-slate-600 transition-colors">Contact Support</Link>
        </div>
      </footer>
    </div>
  )
}
