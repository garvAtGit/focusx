'use client'

import { useState } from "react";
import { addReceptionist } from "@/app/actions/staff-actions";
import { Loader2 } from "lucide-react";
import { initializeApp, getApps } from "firebase/app"
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth"
import { firebaseConfig } from "@/lib/firebase/clientApp"
import toast from "react-hot-toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

declare global {
  interface Window {
    staffRecaptchaVerifier?: RecaptchaVerifier | null;
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function StaffForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OTP States
  const [step, setStep] = useState<1 | 2>(1)
  const [phone, setPhone] = useState("+91 ")
  const [otp, setOtp] = useState("")
  const [otpLoading, setOtpLoading] = useState(false)
  const [verificationObj, setVerificationObj] = useState<ConfirmationResult | null>(null)
  const [verifiedIdToken, setVerifiedIdToken] = useState<string | null>(null)

  const handleSendOTP = async () => {
    try {
      setOtpLoading(true);
      setError(null);
      const secondaryApp = getApps().find(app => app.name === 'Secondary') || initializeApp(firebaseConfig, 'Secondary');
      const secondaryAuth = getAuth(secondaryApp);
      
      const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      
      if (window.staffRecaptchaVerifier) {
        try {
          window.staffRecaptchaVerifier.clear();
        } catch {}
        window.staffRecaptchaVerifier = null;
      }
      
      const appVerifier = new RecaptchaVerifier(secondaryAuth, 'staff-recaptcha', { size: 'invisible' });
      window.staffRecaptchaVerifier = appVerifier;
      
      const confirmation = await signInWithPhoneNumber(secondaryAuth, formattedPhone, appVerifier);
      
      setVerificationObj(confirmation);
      setStep(2);
      toast.success('OTP sent successfully!');
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, "Failed to send OTP"));
    } finally {
      setOtpLoading(false);
    }
  }

  const handleVerifyOTP = async () => {
    if (!verificationObj) {
      setError("Please request a new OTP.");
      return;
    }

    try {
      setOtpLoading(true);
      setError(null);
      const result = await verificationObj.confirm(otp);
      // Capture a fresh ID token BEFORE signing out — the server re-verifies it
      // to prove this phone was really OTP-verified.
      const token = await result.user.getIdToken();
      setVerifiedIdToken(token);
      const secondaryApp = getApps().find(app => app.name === 'Secondary');
      if (secondaryApp) {
        await getAuth(secondaryApp).signOut();
      }
      toast.success("Phone verified!");
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, "Invalid OTP"));
    } finally {
      setOtpLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!verifiedIdToken) {
      setError("Please verify the staff's phone number first.");
      return;
    }

    setLoading(true);
    setError(null);
    
    const formData = new FormData(e.currentTarget);
    formData.append("idToken", verifiedIdToken); // Server re-verifies this token
    
    try {
      const res = await addReceptionist(formData);
      if (res?.error) {
        setError(res.error);
      } else {
        toast.success("Staff added successfully!");
        (e.target as HTMLFormElement).reset();
        setStep(1);
        setPhone("+91 ");
        setOtp("");
        setVerifiedIdToken(null);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to add receptionist"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div id="staff-recaptcha"></div>
      {error && (
        <div className="bg-destructive/10 text-destructive text-sm font-medium p-3 rounded-lg border border-destructive/20">
          {error}
        </div>
      )}
      
      <div className="space-y-2">
        <Label>Name</Label>
        <Input 
          name="name" 
          required 
          placeholder="Ramesh Kumar" 
        />
      </div>
      
      <div className="space-y-2">
        <Label>Phone Number (OTP Verified) *</Label>
        <div className="flex gap-2">
          <Input 
            name="phone" 
            value={phone} 
            onChange={(e) => setPhone(e.target.value)} 
            placeholder="+91 98765 43210" 
            readOnly={!!verifiedIdToken || step === 2} 
            className={!!verifiedIdToken || step === 2 ? "opacity-50 cursor-not-allowed" : ""}
            required 
          />
          {!verifiedIdToken && step === 1 && (
            <Button type="button" onClick={handleSendOTP} disabled={otpLoading || phone.length < 10}>
              {otpLoading ? "Sending..." : "Verify"}
            </Button>
          )}
        </div>
        {!verifiedIdToken && step === 2 && (
          <div className="flex gap-2 mt-2">
            <Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Enter OTP" maxLength={6} />
            <Button type="button" onClick={handleVerifyOTP} disabled={otpLoading || otp.length < 6}>
              {otpLoading ? "Checking..." : "Confirm"}
            </Button>
          </div>
        )}
        {verifiedIdToken && <div className="text-xs text-green-600 font-bold mt-1">✓ Phone Verified</div>}
      </div>

      <button 
        type="submit" 
        disabled={loading || !verifiedIdToken}
        className="w-full mt-4 bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? "Adding Staff..." : "Add Staff Member"}
      </button>
    </form>
  );
}
