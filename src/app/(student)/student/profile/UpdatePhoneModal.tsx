'use client'

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

import { useState } from "react"
import { auth } from "@/lib/firebase/clientApp"
import { RecaptchaVerifier, PhoneAuthProvider, updatePhoneNumber } from "firebase/auth"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { syncUpdatedPhone } from "@/app/actions/student-profile-actions"

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function getErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object"
    && error !== null
    && "code" in error
    && typeof error.code === "string"
  ) {
    return error.code;
  }
  return undefined;
}

export function UpdatePhoneModal({ onPhoneUpdated }: { currentPhone: string | null, onPhoneUpdated: (phone: string) => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verificationId, setVerificationId] = useState("");

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setStep(1);
      setPhone("");
      setOtp("");
      setError("");
      setLoading(false);
      // Clean up recaptcha if it exists
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }
    }
  };

  const initRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
  }

  const handleSendOTP = async () => {
    setError("");
    setLoading(true);
    try {
      if (!auth.currentUser) throw new Error("You must be logged in.");
      initRecaptcha();
      
      const phoneProvider = new PhoneAuthProvider(auth);
      const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      const vId = await phoneProvider.verifyPhoneNumber(formattedPhone, window.recaptchaVerifier);
      
      setVerificationId(vId);
      setStep(2);
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, "Failed to send OTP"));
    } finally {
      setLoading(false);
    }
  }

  const handleVerifyOTP = async () => {
    setError("");
    setLoading(true);
    try {
      if (!auth.currentUser) throw new Error("You must be logged in.");
      const credential = PhoneAuthProvider.credential(verificationId, otp);
      
      await updatePhoneNumber(auth.currentUser, credential);
      
      // Sync with Postgres DB securely via Server Action
      const result = await syncUpdatedPhone();
      
      if (result.success) {
        onPhoneUpdated(result.phone);
        setOpen(false);
      } else {
        throw new Error("Failed to sync updated phone with database.");
      }

    } catch (err: unknown) {
      console.error(err);
      // Firebase throws specific errors for credentials already in use
      if (getErrorCode(err) === 'auth/credential-already-in-use') {
        setError("This phone number is already registered to another account.");
      } else {
        setError(getErrorMessage(err, "Failed to verify OTP"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        Change
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Phone Number</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && <div className="text-destructive text-sm font-medium p-3 bg-destructive/10 rounded-md">{error}</div>}

          {step === 1 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-phone">New Phone Number (with country code)</Label>
                <Input 
                  id="new-phone" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                  placeholder="+91 98765 43210" 
                />
              </div>
              <Button type="button" className="w-full" onClick={handleSendOTP} disabled={loading || phone.length < 10}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Verification Code
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Enter 6-digit OTP</Label>
                <Input 
                  id="otp" 
                  value={otp} 
                  onChange={(e) => setOtp(e.target.value)} 
                  placeholder="123456" 
                  maxLength={6}
                />
              </div>
              <Button type="button" className="w-full" onClick={handleVerifyOTP} disabled={loading || otp.length < 6}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify & Update
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setStep(1)} disabled={loading}>
                Back
              </Button>
            </div>
          )}
          
          {/* Invisible recaptcha container required by Firebase */}
          <div id="recaptcha-container"></div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
