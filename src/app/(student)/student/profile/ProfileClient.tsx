'use client'

import { useState, useEffect, useCallback } from "react"
import { updateStudentProfile } from "@/app/actions/student-profile-actions"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { User, Camera, ShieldCheck, Loader2 } from "lucide-react"
import { ImageCropperModal } from "@/components/ImageCropperModal"
import type { User as UserRecord } from "@prisma/client"

import { UpdatePhoneModal } from "./UpdatePhoneModal"

type ProfileUser = Omit<
  Pick<
    UserRecord,
    | "address"
    | "digilockerVerified"
    | "dob"
    | "email"
    | "gender"
    | "locality"
    | "name"
    | "organization"
    | "phone"
    | "profilePhotoUrl"
    | "qualification"
    | "uniqueId"
  >,
  "dob"
> & {
  dob: Date | string | null;
  checkins?: {
    id: string;
    library: { name: string };
    status: 'CHECK_IN' | 'CHECK_OUT';
    timestamp: Date;
  }[];
  limitHours?: number;
};

export function ProfileClient({ user: initialUser }: { user: ProfileUser }) {
  const [user, setUser] = useState(initialUser)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [success, setSuccess] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(user.profilePhotoUrl || "")
  const [uncroppedImageSrc, setUncroppedImageSrc] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const verifyCashfreeReturn = useCallback(async (verification_id: string) => {
    setVerifying(true);
    localStorage.removeItem("cashfreeVerificationId"); // Clear it so we don't verify again on refresh

    try {
      const res = await fetch('/api/kyc/cashfree/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verification_id })
      });
      const data = await res.json() as {
        success?: boolean;
        user?: Partial<ProfileUser>;
      };

      if (res.ok && data.success && data.user) {
        setUser((currentUser) => ({ ...currentUser, ...data.user }));
        setPhotoUrl(data.user.profilePhotoUrl ?? "");
      } else {
        alert("DigiLocker verification failed or was cancelled.");
      }
    } catch (e) {
      console.error(e);
      alert("Error verifying DigiLocker data.");
    } finally {
      setVerifying(false);
    }
  }, []);

  useEffect(() => {
    // Check if returning from Cashfree OKYC.
    const verificationId = localStorage.getItem("cashfreeVerificationId");
    if (!verificationId) return;
    const timer = window.setTimeout(
      () => void verifyCashfreeReturn(verificationId),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [verifyCashfreeReturn]);

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setSuccess(false)
    if (selectedFile) {
      formData.set("profilePhotoFile", selectedFile);
    }
    try {
      await updateStudentProfile(formData)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e: any) {
      console.error("Save profile error:", e);
      alert(e.message || "Failed to save profile. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyDigilocker() {
    setVerifying(true)
    try {
      const res = await fetch('/api/kyc/cashfree/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          redirectUrl: window.location.origin + "/student/profile" 
        })
      });
      
      const data = await res.json();
      
      if (res.ok && data.url) {
        localStorage.setItem("cashfreeVerificationId", data.verification_id);
        window.location.href = data.url; // Redirect to Cashfree Sandbox
      } else {
        alert(data.error || "Failed to initiate DigiLocker");
        setVerifying(false);
      }
    } catch (e) {
      console.error(e);
      setVerifying(false);
    }
  }

  return (
    <div className="bg-card border border-border shadow-sm rounded-3xl p-6 md:p-10 relative">
      {uncroppedImageSrc && (
        <ImageCropperModal 
          imageSrc={uncroppedImageSrc}
          onCropDone={(croppedFile, croppedUrl) => {
            setSelectedFile(croppedFile);
            setPhotoUrl(croppedUrl);
            setUncroppedImageSrc(null);
          }}
          onCancel={() => setUncroppedImageSrc(null)}
        />
      )}

      {user.digilockerVerified && (
        <div className="absolute top-6 right-6 flex items-center gap-2 bg-success/10 text-success px-4 py-2 rounded-full font-bold text-sm">
          <ShieldCheck className="w-5 h-5" /> KYC Verified
        </div>
      )}

      <form key={user.digilockerVerified ? 'verified' : 'unverified'} action={handleSubmit} className="space-y-8 mt-4">
        
        {/* Profile Picture Section */}
        <div className="flex flex-col md:flex-row items-center gap-6 pb-8 border-b border-border">
          <div className={`w-32 h-32 rounded-full border-4 border-muted flex items-center justify-center bg-muted/30 overflow-hidden relative shrink-0 group`}>
            {photoUrl ? (
              // Profile photos may use arbitrary user-provided providers.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-12 h-12 text-muted-foreground" />
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <Camera className="w-8 h-8 text-white" />
            </div>
            <input 
              type="file" 
              accept="image/*" 
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  const file = e.target.files[0];
                  const reader = new FileReader();
                  reader.addEventListener('load', () => {
                    setUncroppedImageSrc(reader.result?.toString() || null);
                  });
                  reader.readAsDataURL(file);
                  e.target.value = ''; // Reset input
                }
              }}
            />
          </div>
          <div className="flex-1 space-y-2 w-full">

          </div>
        </div>

        {/* KYC Details Section */}
        <div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h2 className="text-2xl font-bold text-foreground">KYC Details</h2>
            {!user.digilockerVerified && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleVerifyDigilocker}
                disabled={verifying}
                className="bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 gap-2"
              >
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {verifying ? "Fetching from DigiLocker..." : "Verify with DigiLocker"}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Legal Name *</Label>
              <Input id="name" name="name" defaultValue={user.name} required readOnly={user.digilockerVerified} className={user.digilockerVerified ? "bg-muted cursor-not-allowed text-muted-foreground" : ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uniqueId">FocusX ID</Label>
              <Input id="uniqueId" value={user.uniqueId || "Not Generated"} readOnly className="bg-muted font-mono font-bold cursor-not-allowed text-muted-foreground" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" name="email" defaultValue={user.email ?? ""} placeholder="your@email.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="flex gap-2">
                <Input id="phone" name="phone" value={user.phone || ""} readOnly className="bg-muted cursor-not-allowed text-muted-foreground" />
                <UpdatePhoneModal currentPhone={user.phone} onPhoneUpdated={(newPhone) => setUser({...user, phone: newPhone})} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input id="dob" name="dob" type="date" defaultValue={user.dob ? new Date(user.dob).toISOString().split('T')[0] : ""} readOnly={user.digilockerVerified} className={user.digilockerVerified ? "bg-muted cursor-not-allowed text-muted-foreground" : ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              {user.digilockerVerified ? (
                <Input name="gender" defaultValue={user.gender || ""} readOnly className="bg-muted cursor-not-allowed text-muted-foreground uppercase" />
              ) : (
                <Select name="gender" defaultValue={user.gender || undefined}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Verified Address</Label>
              <Input id="address" name="address" defaultValue={user.address || ""} placeholder="Full residential address" readOnly={user.digilockerVerified} className={user.digilockerVerified ? "bg-muted cursor-not-allowed text-muted-foreground" : ""} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="locality">Locality</Label>
              <Input id="locality" name="locality" defaultValue={user.locality || ""} placeholder="e.g. Rohini, Dwarka" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="qualification">Highest Qualification</Label>
              <Input id="qualification" name="qualification" defaultValue={user.qualification || ""} placeholder="e.g. B.Tech, 12th Pass" />
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="organization">Organization / College</Label>
              <Input id="organization" name="organization" defaultValue={user.organization || ""} placeholder="e.g. Delhi University, UPSC Prep" />
            </div>
          </div>
        </div>

        {/* Attendance History */}
        <div className="mt-12 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
            <h2 className="text-2xl font-bold text-foreground">Attendance History (Last 7 Days)</h2>
          </div>
          
          {(!user.checkins || user.checkins.length === 0) ? (
            <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-2xl border border-dashed border-border">
              <p>No check-in activity in the last 7 days.</p>
            </div>
          ) : (
            <div className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-6 py-4 text-xs uppercase tracking-wider font-bold text-muted-foreground">Date</th>
                      <th className="px-6 py-4 text-xs uppercase tracking-wider font-bold text-muted-foreground">First In</th>
                      <th className="px-6 py-4 text-xs uppercase tracking-wider font-bold text-muted-foreground">Last Out</th>
                      <th className="px-6 py-4 text-xs uppercase tracking-wider font-bold text-muted-foreground text-right">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(() => {
                      const sorted = [...user.checkins].reverse();
                      const grouped = new Map<string, any[]>();
                      
                      sorted.forEach(log => {
                        const d = new Date(log.timestamp);
                        const dateKey = d.toLocaleDateString('en-IN');
                        if (!grouped.has(dateKey)) grouped.set(dateKey, []);
                        grouped.get(dateKey)!.push(log);
                      });

                      const results = Array.from(grouped.entries()).map(([dateStr, logs]) => {
                        let totalDurationMs = 0;
                        let lastIn: number | null = null;
                        
                        logs.forEach(log => {
                          const time = new Date(log.timestamp).getTime();
                          if (log.status === 'CHECK_IN') {
                            lastIn = time;
                          } else if (log.status === 'CHECK_OUT' && lastIn) {
                            totalDurationMs += (time - lastIn);
                            lastIn = null;
                          }
                        });
                        
                        const isToday = dateStr === new Date().toLocaleDateString('en-IN');
                        if (lastIn && isToday) {
                          totalDurationMs += (new Date().getTime() - lastIn);
                        }
                        
                        const hrs = totalDurationMs / (1000 * 60 * 60);
                        const diffMins = Math.floor(totalDurationMs / 1000 / 60);
                        const h = Math.floor(diffMins / 60);
                        const m = diffMins % 60;
                        const formatted = `${h}h ${m}m`;
                        const isOverstaying = (hrs - (user.limitHours || 24)) > 0.5;
                        
                        const firstIn = logs.find(l => l.status === 'CHECK_IN');
                        const lastOut = [...logs].reverse().find(l => l.status === 'CHECK_OUT');

                        return {
                          date: new Date(logs[0].timestamp),
                          firstIn,
                          lastOut,
                          formatted,
                          isOverstaying,
                          isToday,
                          lastIn
                        };
                      }).sort((a, b) => b.date.getTime() - a.date.getTime());

                      return results.map((row, idx) => (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-foreground">
                              {row.date.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-slate-700">
                              {row.firstIn ? new Date(row.firstIn.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-slate-700">
                              {row.lastOut ? new Date(row.lastOut.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : (row.isToday && row.lastIn ? 'Still In' : '-')}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex flex-col items-end">
                              <span className={`text-[14px] font-bold ${row.isOverstaying ? 'text-rose-600' : 'text-slate-700'}`}>
                                {row.formatted}
                              </span>
                              {row.isOverstaying && (
                                <span className="text-[10px] font-black uppercase text-rose-500 tracking-widest mt-0.5">Time Exceeded</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-border flex items-center justify-between mt-8">
          <div>
            {success && <span className="text-success font-bold text-sm bg-success/10 px-3 py-1 rounded-full">Profile updated successfully!</span>}
          </div>
          <Button type="submit" disabled={loading} className="px-8 font-bold text-lg h-12 rounded-xl w-full sm:w-auto">
            {loading ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </form>
    </div>
  )
}
