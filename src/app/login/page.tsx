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
import { Loader2 } from 'lucide-react'
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
    if (typeof window !== 'undefined') {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch {}
      }
      
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
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
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('loggedOut') === 'true') {
      auth.signOut();
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

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
    let formatted = phone.trim();
    if (!formatted.startsWith('+91')) {
      formatted = '+91' + formatted;
    }
    return formatted;
  }

  async function handleSendOtp(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setLoading(true)

    try {
      const formattedPhone = getFormattedPhone()
      const appVerifier = window.recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier)
      setConfirmationResult(confirmation)
      setStep('OTP')
      setResendTimer(60) // Start 60s cooldown
      toast.success('OTP sent successfully!')
    } catch (error: unknown) {
      console.error(error)
      toast.error(getErrorMessage(error, "Failed to send OTP. Please try again."))
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
    setLoading(true)
    const formattedPhone = getFormattedPhone()

    try {
      if (!confirmationResult) {
        throw new Error("OTP session expired. Please request a new code.")
      }
      const result = await confirmationResult.confirm(otp)
      const user = result.user

      const idToken = await user.getIdToken()
      const dbCheck = await checkUserExists(formattedPhone, idToken);

      if (dbCheck.error) {
        throw new Error(dbCheck.error);
      }

      if (dbCheck.exists) {
        await completeLogin(user, formattedPhone, '')
      } else {
        setStep('NAME')
        setLoading(false)
      }
    } catch (error: unknown) {
      console.error(error)
      toast.error(getErrorMessage(error, "Invalid OTP code."))
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
          // The embedded (iframe) checkout can't rely on the session cookie due to
          // third-party cookie blocking, so it authenticates with this ID token.
          // Scope the message to our OWN origin — never '*', which would leak the
          // token to any page that happened to open this popup.
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-8 shadow-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-heading font-bold text-primary mb-2">Welcome</h1>
          <p className="text-muted-foreground">Sign in or create an account</p>
        </div>

        <div id="recaptcha-container" className="mb-4 flex justify-center"></div>

        {step === 'PHONE' && (
          <form onSubmit={handleSendOtp} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="phone">Student Contact Number</Label>
              <div className="flex">
                <div className="flex items-center justify-center bg-muted text-muted-foreground border border-border border-r-0 rounded-l-md px-3 font-medium">
                  +91
                </div>
                <Input 
                  id="phone" 
                  type="tel" 
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (val.length <= 10) setPhone(val);
                  }}
                  placeholder="9999999999" 
                  className="rounded-l-none"
                  required 
                  autoFocus
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-11" disabled={loading || phone.length !== 10}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              {loading ? "Sending..." : "Send OTP"}
            </Button>
          </form>
        )}

        {step === 'OTP' && (
          <form ref={otpFormRef} onSubmit={handleVerifyOtp} className="space-y-6">
            <div className="space-y-2 text-center">
              <Label htmlFor="otp">Enter the 6-digit code sent to +91 {phone}</Label>
              <div className="flex justify-center">
                <InputOTP 
                  id="otp" 
                  maxLength={6} 
                  value={otp}
                  onChange={(val) => setOtp(val)}
                  autoFocus
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="w-12 h-14 text-xl" />
                    <InputOTPSlot index={1} className="w-12 h-14 text-xl" />
                    <InputOTPSlot index={2} className="w-12 h-14 text-xl" />
                    <InputOTPSlot index={3} className="w-12 h-14 text-xl" />
                    <InputOTPSlot index={4} className="w-12 h-14 text-xl" />
                    <InputOTPSlot index={5} className="w-12 h-14 text-xl" />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

            <Button type="submit" className="w-full h-11" disabled={loading || otp.length !== 6}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              {loading ? "Verifying..." : "Verify OTP"}
            </Button>

            <div className="flex flex-col space-y-3 text-center pt-2">
              <button 
                type="button" 
                onClick={() => resendTimer === 0 ? handleSendOtp() : undefined}
                disabled={resendTimer > 0 || loading}
                className={`text-sm ${resendTimer > 0 ? 'text-muted-foreground cursor-not-allowed' : 'text-primary hover:underline font-medium'}`}
              >
                {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : "Resend OTP"}
              </button>
              
              <button 
                type="button" 
                onClick={() => {
                  setStep('PHONE');
                  setOtp('');
                  setResendTimer(0);
                }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Change phone number
              </button>
            </div>
          </form>
        )}

        {step === 'NAME' && (
          <form onSubmit={handleSaveName} className="space-y-6">
            <div className="space-y-2 text-center">
              <Label htmlFor="name" className="text-lg">What should we call you?</Label>
              <p className="text-sm text-muted-foreground pb-2">Looks like you&apos;re new here!</p>
              <Input 
                id="name" 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name" 
                className="text-center h-12 text-lg"
                required 
                autoFocus
              />
            </div>

            <Button type="submit" className="w-full h-11" disabled={loading || !name.trim()}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              {loading ? "Saving..." : "Continue"}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
