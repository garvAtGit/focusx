'use client'
import { useState } from "react";
import Image from "next/image";
import { CheckCircle2, ChevronRight, Building2, MapPin, CreditCard, Loader2, Image as ImageIcon, Check } from "lucide-react";
import { completeOnboarding } from "@/app/actions/onboarding-actions";
import { ImageKitProvider, IKUpload } from "imagekitio-next";

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

const authenticator = async () => {
  try {
    const response = await fetch("/api/imagekit/auth");
    if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
    const data = await response.json();
    return { signature: data.signature, expire: data.expire, token: data.token };
  } catch (error) {
    throw new Error(`Authentication request failed: ${error}`);
  }
};

export default function LibrarianOnboarding() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [libraryId, setLibraryId] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [passbookUrl, setPassbookUrl] = useState("");

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setError("");
    try {
      const res = await completeOnboarding(formData);
      if (res.success) {
        setLibraryId(res.libraryId);
        setStep(4); // Move to KYC step
      }
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to complete onboarding"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyKYC = async () => {
    if (!passbookUrl) {
      setError("Please upload a passbook photo first");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { uploadPassbook } = await import('@/app/actions/library-actions');
      await uploadPassbook(libraryId, passbookUrl);
      window.location.href = '/dashboard';
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to submit KYC. You can try again from settings."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-16 border-b border-border bg-card flex items-center px-6 gap-2 group">
        <Image src="/final-logo.svg" alt="FocusX Logo" width={48} height={48} className="object-contain" />
        <div className="text-xl font-heading font-bold text-primary hidden sm:block">FocusX for Partners</div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-3xl w-full">
          
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-muted -z-10 rounded-full" />
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary -z-10 rounded-full transition-all duration-300" style={{ width: `${((step - 1) / 2) * 100}%` }} />
              
              {[1, 2, 3].map((num) => (
                <div key={num} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors shadow-sm ${step >= num ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground border-2 border-muted'}`}>
                  {step > num ? <CheckCircle2 className="w-5 h-5" /> : num}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 px-1">
              <span className={`text-xs font-bold uppercase tracking-wider ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>Basics</span>
              <span className={`text-xs font-bold uppercase tracking-wider ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>Location</span>
              <span className={`text-xs font-bold uppercase tracking-wider ${step >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>Payments</span>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-card p-8 rounded-2xl border border-border shadow-lg">
            
            {error && <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-lg font-medium">{error}</div>}

            <form action={handleSubmit}>
              <div className={step === 1 ? 'block' : 'hidden'}>
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                  <div className="mb-6 flex items-center gap-3">
                    <Building2 className="w-8 h-8 text-primary" />
                    <div>
                      <h2 className="text-2xl font-heading font-bold text-foreground">Library Details</h2>
                      <p className="text-muted-foreground">Let&apos;s start with the basics of your establishment.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Library Name *</label>
                      <input name="name" type="text" placeholder="e.g., Central Study Hub" className="w-full px-4 py-2 rounded-lg border border-border bg-input/50 focus:outline-none focus:ring-2 focus:ring-primary text-foreground" required={step===1} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Manager Name</label>
                        <input name="managerName" type="text" placeholder="John Doe" className="w-full px-4 py-2 rounded-lg border border-border bg-input/50 focus:outline-none focus:ring-2 focus:ring-primary text-foreground" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Phone Number</label>
                        <input name="managerPhone" type="tel" placeholder="+1 234 567 890" className="w-full px-4 py-2 rounded-lg border border-border bg-input/50 focus:outline-none focus:ring-2 focus:ring-primary text-foreground" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-medium text-foreground">Facilities & Amenities</label>
                      <div className="grid grid-cols-2 gap-3">
                        {["AC", "Wi-Fi", "RO Water", "Washroom", "Power Backup", "CCTV", "Locker", "Parking", "Tea/Coffee", "Security Guard", "Charging Points", "Silent Zone"].map((facility) => (
                          <label key={facility} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-input/20 hover:bg-muted/50 cursor-pointer transition-all has-[:checked]:bg-primary/5 has-[:checked]:border-primary">
                            <input 
                              type="checkbox" 
                              name={`facility_${facility}`} 
                              className="w-4 h-4 rounded border-border text-primary focus:ring-primary accent-primary" 
                            />
                            <span className="text-sm font-medium text-foreground select-none">{facility}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button type="button" onClick={() => setStep(2)} className="bg-primary text-primary-foreground font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2">
                      Next Step <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className={step === 2 ? 'block' : 'hidden'}>
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                  <div className="mb-6 flex items-center gap-3">
                    <MapPin className="w-8 h-8 text-primary" />
                    <div>
                      <h2 className="text-2xl font-heading font-bold text-foreground">Location & Capacity</h2>
                      <p className="text-muted-foreground">Help students find your library easily.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Full Address *</label>
                      <textarea name="address" rows={3} placeholder="123 Main St, City, State" className="w-full px-4 py-2 rounded-lg border border-border bg-input/50 focus:outline-none focus:ring-2 focus:ring-primary text-foreground" required={step===2} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Nearest Metro/Landmark</label>
                        <input name="metroStation" type="text" placeholder="Central Station" className="w-full px-4 py-2 rounded-lg border border-border bg-input/50 focus:outline-none focus:ring-2 focus:ring-primary text-foreground" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Google Maps Link</label>
                        <input name="googleMapsUrl" type="url" placeholder="https://maps.google.com/..." className="w-full px-4 py-2 rounded-lg border border-border bg-input/50 focus:outline-none focus:ring-2 focus:ring-primary text-foreground" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Total Seat Capacity</label>
                      <input name="seatsAvailable" type="number" placeholder="50" className="w-full px-4 py-2 rounded-lg border border-border bg-input/50 focus:outline-none focus:ring-2 focus:ring-primary text-foreground" />
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <button type="button" onClick={() => setStep(1)} className="text-muted-foreground font-semibold px-6 py-2.5 rounded-lg hover:bg-muted transition-colors">
                      Back
                    </button>
                    <button type="button" onClick={() => setStep(3)} className="bg-primary text-primary-foreground font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2">
                      Next Step <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className={step === 3 ? 'block' : 'hidden'}>
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                  <div className="mb-6 flex items-center gap-3">
                    <CheckCircle2 className="w-8 h-8 text-primary" />
                    <div>
                      <h2 className="text-2xl font-heading font-bold text-foreground">Review & Submit</h2>
                      <p className="text-muted-foreground">Almost done! Submit your details to create your library.</p>
                    </div>
                  </div>
                  <div className="flex justify-between pt-4 border-t border-border mt-8">
                    <button type="button" onClick={() => setStep(2)} className="text-muted-foreground font-semibold px-6 py-2.5 rounded-lg hover:bg-muted transition-colors">
                      Back
                    </button>
                    <button type="submit" disabled={loading} className="bg-primary text-primary-foreground font-semibold px-8 py-2.5 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                      {loading ? "Creating..." : "Create Library"}
                    </button>
                  </div>
                </div>
              </div>
            </form>

            <div className={step === 4 ? 'block' : 'hidden'}>
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <div className="mb-6 flex items-center gap-3">
                  <CreditCard className="w-8 h-8 text-success" />
                  <div>
                    <h2 className="text-2xl font-heading font-bold text-foreground">Payments & KYC</h2>
                    <p className="text-muted-foreground">Library created successfully! Setup your account to receive payouts securely.</p>
                  </div>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-center space-y-4">
                  <h3 className="font-bold text-foreground text-lg">Upload Passbook / KYC Document</h3>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    Please upload a photo of your bank passbook or cancelled cheque to verify your library.
                  </p>
                  
                  {!passbookUrl ? (
                    <ImageKitProvider 
                      publicKey={process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY} 
                      urlEndpoint={process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT} 
                      authenticator={authenticator}
                    >
                      <div className="relative border-2 border-dashed border-border rounded-xl p-8 text-center hover:bg-muted/30 transition-colors max-w-xs mx-auto bg-card">
                        <IKUpload
                          fileName="passbook_kyc"
                          tags={["kyc"]}
                          onUploadStart={() => setUploadingImage(true)}
                          onError={() => { setUploadingImage(false); setError("Upload failed"); }}
                          onSuccess={(res) => { setUploadingImage(false); setPassbookUrl(res.url); }}
                          accept="image/*"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="pointer-events-none flex flex-col items-center gap-2 text-muted-foreground">
                          {uploadingImage ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImageIcon className="w-8 h-8" />}
                          <span className="font-medium">{uploadingImage ? "Uploading..." : "Click or drag to upload Passbook"}</span>
                        </div>
                      </div>
                    </ImageKitProvider>
                  ) : (
                    <div className="max-w-xs mx-auto border border-success/30 bg-success/10 p-4 rounded-xl flex items-center gap-3">
                      <Check className="w-6 h-6 text-success shrink-0" />
                      <div className="text-left">
                        <p className="font-bold text-success text-sm">Passbook Uploaded</p>
                        <p className="text-xs text-success/80 truncate">{passbookUrl.split('/').pop()}</p>
                      </div>
                    </div>
                  )}

                  <button onClick={handleVerifyKYC} disabled={loading || uploadingImage || !passbookUrl} className="bg-[#02042B] hover:bg-[#02042B]/90 text-white font-bold px-6 py-3 rounded-xl transition-colors mt-4 flex items-center justify-center gap-2 w-full max-w-xs mx-auto disabled:opacity-50">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                    Submit KYC Verification
                  </button>

                  <p className="text-xs text-muted-foreground mt-4 italic">
                    Note: Automated Razorpay KYC verification is coming soon!
                  </p>
                </div>

                <div className="flex justify-center pt-4 mt-4">
                  <button type="button" onClick={() => window.location.href = '/dashboard'} className="text-muted-foreground text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-muted transition-colors">
                    Skip for Now (Do it later in Settings)
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
