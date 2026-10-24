'use client'

import { useState, useEffect, useRef } from 'react'
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
import { ShieldCheck, Lock, Loader2, ArrowRight, ArrowLeft } from 'lucide-react'
import { verifyAdminLogin } from '@/app/actions/auth-actions'
import toast from 'react-hot-toast'
import Link from 'next/link'

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

export default function AdminLoginPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'PHONE' | 'OTP' | 'NAME'>('PHONE')
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  
  // Resend OTP cooldown
  const [resendTimer, setResendTimer] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch {}
      }
      
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'admin-recaptcha-container', {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved
        },
      });
    }

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
    if (resendTimer > 0) {
      timerRef.current = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, [resendTimer]);

  const lastSubmittedOtp = useRef('');
  const otpFormRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (step === 'OTP' && otp.length === 6 && !loading && otp !== lastSubmittedOtp.current) {
      lastSubmittedOtp.current = otp;
      otpFormRef.current?.requestSubmit();
    }
  }, [otp, step, loading]);

  const getFormattedPhone = () => {
    let formatted = phone.trim();
    if (!formatted.startsWith('+91')) {
      formatted = '+91' + formatted;
    }
    return formatted;
  }

  async function handleSendOtp(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setAuthError(null)
    setLoading(true)

    try {
      const formattedPhone = getFormattedPhone()
      const appVerifier = window.recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier)
      setConfirmationResult(confirmation)
      setStep('OTP')
      setResendTimer(60)
      toast.success('Admin verification code sent!')
    } catch (error: unknown) {
      console.error(error)
      const msg = getErrorMessage(error, "Failed to send verification code. Please try again.")
      setAuthError(msg)
      toast.error(msg)
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.render().then((widgetId) => {
          window.grecaptcha?.reset(widgetId);
        });
      }
    } finally {
      setLoading(false)
    }
  }

  const submittingOtpRef = useRef(false)

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (otp.length !== 6 || submittingOtpRef.current) return;
    
    submittingOtpRef.current = true;
    setAuthError(null);
    setLoading(true);
    const formattedPhone = getFormattedPhone();

    try {
      if (!confirmationResult) {
        throw new Error("OTP session expired. Please request a new code.")
      }
      const result = await confirmationResult.confirm(otp)
      const firebaseUser = result.user

      const idToken = await firebaseUser.getIdToken()
      const adminCheck = await verifyAdminLogin(idToken, formattedPhone);

      if ('error' in adminCheck && adminCheck.error) {
        // Sign out from client immediately
        await auth.signOut();
        setAuthError(adminCheck.error);
        toast.error(adminCheck.error);
        setLoading(false);
        return;
      }

      if ('isNewUser' in adminCheck && adminCheck.isNewUser) {
        setStep('NAME');
        setLoading(false);
      } else {
        await completeAdminSession(firebaseUser);
      }
    } catch (error: unknown) {
      console.error(error)
      const msg = getErrorMessage(error, "Invalid or expired verification code.")
      setAuthError(msg)
      toast.error(msg)
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
      const idToken = await currentUser.getIdToken();
      
      const adminCheck = await verifyAdminLogin(idToken, formattedPhone, name);
      if ('error' in adminCheck && adminCheck.error) {
        await auth.signOut();
        setAuthError(adminCheck.error);
        toast.error(adminCheck.error);
        setLoading(false);
        return;
      }

      await completeAdminSession(currentUser);
    } catch (error: unknown) {
      console.error(error)
      toast.error(getErrorMessage(error, "Failed to initialize admin profile."))
      setLoading(false)
    }
  }

  async function completeAdminSession(firebaseUser: User) {
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });

      if (res.ok) {
        toast.success("Welcome, Super Admin!");
        window.location.href = '/admin';
      } else {
        setAuthError("Failed to establish secure admin session.");
        toast.error("Authentication failed. Please contact platform engineering.");
        setLoading(false);
      }
    } catch (error) {
      console.error(error);
      setAuthError("Failed to finalize admin session.");
      toast.error("Session finalization error.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 px-4 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10 backdrop-blur-xl">
        {/* Header Icon */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4 text-red-500 shadow-inner">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30">
              Super Admin Control
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">FocusX Command Center</h1>
          <p className="text-slate-400 text-sm mt-1">
            Restricted access portal for authorized platform administrators
          </p>
        </div>

        {authError && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3">
            <Lock className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Authorization Alert</p>
              <p className="text-xs text-red-300 mt-0.5">{authError}</p>
            </div>
          </div>
        )}

        <div id="admin-recaptcha-container"></div>

        {step === 'PHONE' && (
          <form onSubmit={handleSendOtp} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="admin-phone" className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                Admin Registered Mobile
              </Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                  +91
                </span>
                <Input
                  id="admin-phone"
                  type="tel"
                  value={phone.replace(/^\+91/, '')}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="98765 43210"
                  className="pl-14 h-11 bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus:border-red-500 focus:ring-red-500/20 rounded-xl"
                  required
                />
              </div>
              <p className="text-xs text-slate-500">
                Only numbers registered as Super Admin or in ADMIN_PHONES can access.
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading || phone.replace(/\D/g, '').length < 10}
              className="w-full h-11 bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-red-600/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Verifying Identity...
                </>
              ) : (
                <>
                  Send Admin Passcode
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>
        )}

        {step === 'OTP' && (
          <form ref={otpFormRef} onSubmit={handleVerifyOtp} className="space-y-5">
            <div className="space-y-3 flex flex-col items-center">
              <Label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                Enter 6-Digit Passcode
              </Label>
              <p className="text-xs text-slate-400 text-center">
                Sent to <span className="text-white font-medium">{getFormattedPhone()}</span>
              </p>

              <div className="py-2">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                  disabled={loading}
                >
                  <InputOTPGroup className="gap-2">
                    <InputOTPSlot index={0} className="w-11 h-12 text-lg border-slate-700 bg-slate-950 text-white rounded-lg" />
                    <InputOTPSlot index={1} className="w-11 h-12 text-lg border-slate-700 bg-slate-950 text-white rounded-lg" />
                    <InputOTPSlot index={2} className="w-11 h-12 text-lg border-slate-700 bg-slate-950 text-white rounded-lg" />
                    <InputOTPSlot index={3} className="w-11 h-12 text-lg border-slate-700 bg-slate-950 text-white rounded-lg" />
                    <InputOTPSlot index={4} className="w-11 h-12 text-lg border-slate-700 bg-slate-950 text-white rounded-lg" />
                    <InputOTPSlot index={5} className="w-11 h-12 text-lg border-slate-700 bg-slate-950 text-white rounded-lg" />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full h-11 bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-red-600/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Authorizing Access...
                </>
              ) : (
                'Verify & Enter Command Center'
              )}
            </Button>

            <div className="flex items-center justify-between text-xs pt-2">
              <button
                type="button"
                onClick={() => { setStep('PHONE'); setOtp(''); setAuthError(null); }}
                className="text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Change Number
              </button>

              <button
                type="button"
                disabled={resendTimer > 0 || loading}
                onClick={() => handleSendOtp()}
                className={`font-medium transition-colors ${resendTimer > 0 ? 'text-slate-600 cursor-not-allowed' : 'text-red-400 hover:text-red-300'}`}
              >
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
              </button>
            </div>
          </form>
        )}

        {step === 'NAME' && (
          <form onSubmit={handleSaveName} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="admin-name" className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                Initial Admin Profile Name
              </Label>
              <Input
                id="admin-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Lead Administrator"
                className="h-11 bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-600 focus:border-red-500 focus:ring-red-500/20 rounded-xl"
                required
              />
              <p className="text-xs text-slate-500">
                This display name will be associated with your Super Admin actions.
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full h-11 bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-red-600/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creating Super Admin Session...
                </>
              ) : (
                'Finalize & Enter'
              )}
            </Button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-400 transition-colors">
            Return to FocusX Public Portal
          </Link>
        </div>
      </div>
    </div>
  )
}
