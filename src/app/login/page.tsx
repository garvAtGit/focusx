'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithCustomToken,
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
import { Loader2, Smartphone, ArrowLeft } from 'lucide-react'
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon'
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
  const [otpChannel, setOtpChannel] = useState<'WHATSAPP' | 'SMS'>('WHATSAPP')
  const [previewOtp, setPreviewOtp] = useState<string | null>(null)
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
      
      try {
        const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {
            // reCAPTCHA solved
          },
        });
        window.recaptchaVerifier = verifier;

        // Pre-warm and pre-render the reCAPTCHA widget immediately in the background
        // so token negotiation is already done before the user clicks "Send OTP".
        verifier.render().catch((err) => {
          console.warn("reCAPTCHA pre-warm non-fatal notice:", err);
        });
      } catch (err) {
        console.warn("reCAPTCHA initialization warning:", err);
      }
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
    // Strip all non-digit characters (spaces, hyphens, parentheses)
    let digits = phone.replace(/\D/g, '');

    // If student typed leading 0 (e.g. 09876543210), strip the leading 0
    if (digits.length === 11 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }

    // Standard 10-digit Indian mobile number
    if (digits.length === 10) {
      return `+91${digits}`;
    }

    // 12-digit already prefixed with country code 91
    if (digits.length === 12 && digits.startsWith('91')) {
      return `+${digits}`;
    }

    // Fallback for international numbers or pre-prefixed input
    return phone.trim().startsWith('+') ? `+${digits}` : `+91${digits}`;
  };

  async function sendOtp(targetChannel: 'WHATSAPP' | 'SMS') {
    const formattedPhone = getFormattedPhone();
    const digitsOnly = formattedPhone.replace(/\D/g, '');

    // Quick client-side check so invalid numbers don't hang waiting for carrier rejection
    if (digitsOnly.length < 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }

    setOtpChannel(targetChannel);
    setLoading(true);

    if (targetChannel === 'WHATSAPP') {
      try {
        const res = await fetch('/api/auth/whatsapp-otp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: formattedPhone }),
        });
        const data = await res.json();

        if (!res.ok || data.error) {
          throw new Error(data.error || 'Failed to send WhatsApp OTP');
        }

        setStep('OTP');
        setOtp('');
        lastSubmittedOtp.current = '';
        setResendTimer(30);

        if (data.simulated && data.previewOtp) {
          setPreviewOtp(data.previewOtp);
          toast.success(`WhatsApp OTP (Sandbox): ${data.previewOtp}`, { duration: 6000 });
        } else {
          setPreviewOtp(null);
          toast.success('OTP sent to your WhatsApp!');
        }
      } catch (error: unknown) {
        console.error(error);
        toast.error(getErrorMessage(error, 'Failed to send WhatsApp OTP. Try SMS instead.'));
      } finally {
        setLoading(false);
      }
    } else {
      // SMS via Firebase Phone Auth
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
        setResendTimer(45); // 45s cooldown for faster retry if carrier queues are slow
        setPreviewOtp(null);
        toast.success('OTP sent via SMS!');
      } catch (error: unknown) {
        console.error(error);
        toast.error(getErrorMessage(error, "Failed to send SMS OTP. Try WhatsApp instead."));
        if (window.recaptchaVerifier) {
          window.recaptchaVerifier.render().then((widgetId) => {
            window.grecaptcha?.reset(widgetId);
          });
        }
      } finally {
        setLoading(false);
      }
    }
  }

  function handleSendOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    return sendOtp(otpChannel);
  }

  const submittingOtpRef = useRef(false)

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (otp.length !== 6 || submittingOtpRef.current) return;
    
    submittingOtpRef.current = true;
    setLoading(true)
    const formattedPhone = getFormattedPhone()

    try {
      let firebaseUser: User;

      if (otpChannel === 'WHATSAPP') {
        const res = await fetch('/api/auth/whatsapp-otp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: formattedPhone, otp }),
        });
        const data = await res.json();

        if (!res.ok || data.error) {
          throw new Error(data.error || 'Invalid OTP code.');
        }

        // Authenticate client with minted custom token
        const cred = await signInWithCustomToken(auth, data.customToken);
        firebaseUser = cred.user;
      } else {
        if (!confirmationResult) {
          throw new Error("OTP session expired. Please request a new code.")
        }
        const result = await confirmationResult.confirm(otp)
        firebaseUser = result.user
      }

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
    <div className="relative min-h-screen flex items-center justify-center bg-background px-4 py-12 overflow-hidden selection:bg-primary/20 selection:text-primary">
      {/* Top Left FocusX Brand Header */}
      <header className="absolute top-6 left-6 md:top-8 md:left-8 z-20">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2.5 group transition-transform active:scale-95"
        >
          <Image 
            src="/final-logo.svg" 
            alt="FocusX Logo" 
            width={36} 
            height={36} 
            className="object-contain transition-transform duration-200 group-hover:scale-105" 
            priority
          />
          <span className="text-xl font-heading font-bold text-foreground tracking-tight">
            Focus<span className="text-primary">X</span>
          </span>
        </Link>
      </header>

      {/* Ambient subtle decorative background glows */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl" />

      {/* Card with subtle professional animation */}
      <motion.div 
        initial={{ opacity: 0, y: 16, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-card border border-border/80 rounded-2xl p-7 md:p-8 shadow-sm backdrop-blur-sm relative z-10"
      >
        <div className="text-center mb-6">
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground mb-1.5">Welcome</h1>
          <p className="text-sm text-muted-foreground">Sign in or create an account</p>
        </div>

        <div id="recaptcha-container" className="mb-2 flex justify-center"></div>

        <AnimatePresence mode="wait">
          {step === 'PHONE' && (
            <motion.div
              key="step-phone"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2 }}
            >
              <form onSubmit={handleSendOtp} className="space-y-5">
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
                      className="rounded-l-none text-base"
                      required 
                      autoFocus
                    />
                  </div>
                </div>

                {/* Primary Button: WhatsApp OTP by default */}
                <Button 
                  type="submit" 
                  className="w-full h-11 bg-[#25D366] hover:bg-[#20ba59] text-white font-semibold transition-all shadow-sm hover:shadow active:scale-[0.99]" 
                  disabled={loading || phone.length !== 10}
                >
                  {loading && otpChannel === 'WHATSAPP' ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <WhatsAppIcon className="w-4 h-4 mr-2" />
                  )}
                  {loading && otpChannel === 'WHATSAPP' ? "Sending code..." : "Send OTP via WhatsApp"}
                </Button>

                {/* Below button: click option to send through SMS */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => sendOtp('SMS')}
                    disabled={loading || phone.length !== 10}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed group inline-flex items-center gap-1.5"
                  >
                    <span>Prefer SMS?</span>
                    <span className="font-semibold text-primary underline underline-offset-2 group-hover:text-primary/80 inline-flex items-center gap-1">
                      <Smartphone className="w-3.5 h-3.5" /> Send code via SMS
                    </span>
                  </button>
                </div>
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
              <form ref={otpFormRef} onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="space-y-2 text-center">
                  <Label htmlFor="otp" className="text-sm font-medium">
                    Enter the 6-digit code sent via {otpChannel === 'WHATSAPP' ? 'WhatsApp' : 'SMS'} to{' '}
                    <span className="font-semibold text-foreground">+91 {phone}</span>
                  </Label>

                  {previewOtp && (
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      onClick={() => setOtp(previewOtp)} 
                      className="cursor-pointer mx-auto my-2 inline-flex items-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-full font-mono hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors shadow-xs"
                      title="Click to auto-fill sandbox OTP"
                    >
                      <span>⚡ Sandbox OTP: <strong>{previewOtp}</strong> (click to fill)</span>
                    </motion.div>
                  )}

                  <div className="flex justify-center pt-1">
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
                  {loading ? "Verifying..." : "Verify & Continue"}
                </Button>

                <div className="flex flex-col space-y-3 text-center pt-2">
                  <button 
                    type="button" 
                    onClick={() => resendTimer === 0 ? sendOtp(otpChannel) : undefined}
                    disabled={resendTimer > 0 || loading}
                    className={`text-sm ${resendTimer > 0 ? 'text-muted-foreground cursor-not-allowed' : 'text-primary hover:underline font-medium'}`}
                  >
                    {resendTimer > 0 
                      ? `Resend via ${otpChannel === 'WHATSAPP' ? 'WhatsApp' : 'SMS'} in ${resendTimer}s` 
                      : `Resend via ${otpChannel === 'WHATSAPP' ? 'WhatsApp' : 'SMS'}`}
                  </button>

                  {/* Cross-channel fallback */}
                  <div className="pt-2 border-t border-border/60">
                    <button
                      type="button"
                      onClick={() => {
                        const fallbackChannel = otpChannel === 'WHATSAPP' ? 'SMS' : 'WHATSAPP';
                        sendOtp(fallbackChannel);
                      }}
                      disabled={loading}
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>Didn&apos;t receive code?</span>
                      {otpChannel === 'WHATSAPP' ? (
                        <span className="text-primary font-semibold hover:underline inline-flex items-center gap-1">
                          <Smartphone className="w-3.5 h-3.5" /> Send via SMS instead
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline inline-flex items-center gap-1">
                          <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366]" /> Send via WhatsApp instead
                        </span>
                      )}
                    </button>
                  </div>
                  
                  <button 
                    type="button" 
                    onClick={() => {
                      setStep('PHONE');
                      setOtp('');
                      setResendTimer(0);
                      setPreviewOtp(null);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground pt-1 inline-flex items-center justify-center gap-1"
                  >
                    <ArrowLeft className="w-3 h-3" /> Change phone number
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
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
