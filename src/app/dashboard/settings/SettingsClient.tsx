'use client'

import { useState } from "react"
import { 
  Save, Loader2, MapPin, Phone, Building, Clock, ImageIcon, 
  Trash2, CreditCard, Wind, Wifi, Droplets, Baby, Zap, 
  Camera, Lock, Car, Coffee, ShieldCheck, Plug, VolumeX,
  AlertCircle, CheckCircle2
} from "lucide-react"
import { 
  updateLibrarySettings, updateBasicInfo, updateLocation, updateFacilities 
} from "@/app/actions/library-actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ImageKitProvider, IKUpload } from "imagekitio-next"
import { HardwareProvisioningCard } from "./HardwareProvisioningCard"
import { AdminNoteEditor } from "@/components/admin-note-editor"
import Image from "next/image"
import type { Library as LibraryRecord } from "@prisma/client"

// Premium UI Icon Mapping
const FacilityIcons: Record<string, React.ReactNode> = {
  "AC": <Wind className="w-5 h-5" />,
  "Wi-Fi": <Wifi className="w-5 h-5" />,
  "RO Water": <Droplets className="w-5 h-5" />,
  "Washroom": <Baby className="w-5 h-5" />,
  "Power Backup": <Zap className="w-5 h-5" />,
  "CCTV": <Camera className="w-5 h-5" />,
  "Locker": <Lock className="w-5 h-5" />,
  "Parking": <Car className="w-5 h-5" />,
  "Tea/Coffee": <Coffee className="w-5 h-5" />,
  "Security Guard": <ShieldCheck className="w-5 h-5" />,
  "Charging Points": <Plug className="w-5 h-5" />,
  "Silent Zone": <VolumeX className="w-5 h-5" />
}

const facilityOptions = Object.keys(FacilityIcons)

interface ImageKitAuthResponse {
  signature: string;
  expire: number;
  token: string;
}
interface UploadResult {
  url: string;
}

function isImageKitAuthResponse(value: unknown): value is ImageKitAuthResponse {
  if (typeof value !== "object" || value === null) return false;
  const response = value as Record<string, unknown>;
  return (
    typeof response.signature === "string" &&
    typeof response.expire === "number" &&
    typeof response.token === "string"
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

const authenticator = async () => {
  try {
    const response = await fetch("/api/imagekit/auth");
    if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
    const data: unknown = await response.json();
    if (!isImageKitAuthResponse(data)) throw new Error("Authentication response was invalid.");
    return data;
  } catch (error) {
    throw new Error(`Authentication request failed: ${getErrorMessage(error, "Unknown error")}`);
  }
};

export function SettingsClient({ library }: { library: LibraryRecord }) {
  const [activeTab, setActiveTab] = useState<"general" | "location" | "facilities" | "media">("general")

  return (
    <div className="max-w-6xl mx-auto pb-10 flex flex-col md:flex-row gap-8">
      {/* Sidebar Navigation */}
      <div className="md:w-64 shrink-0">
        <div className="sticky top-24 space-y-2">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground mb-4">Settings</h1>
          </div>
          <TabButton active={activeTab === "general"} onClick={() => setActiveTab("general")} icon={<Building className="w-4 h-4"/>} label="General Info" />
          <TabButton active={activeTab === "location"} onClick={() => setActiveTab("location")} icon={<MapPin className="w-4 h-4"/>} label="Location & Maps" />
          <TabButton active={activeTab === "facilities"} onClick={() => setActiveTab("facilities")} icon={<Clock className="w-4 h-4"/>} label="Facilities & Hours" />
          <TabButton active={activeTab === "media"} onClick={() => setActiveTab("media")} icon={<ImageIcon className="w-4 h-4"/>} label="Photos & KYC" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1">
        {activeTab === "general" && <GeneralTab library={library} />}
        {activeTab === "location" && <LocationTab library={library} />}
        {activeTab === "facilities" && <FacilitiesTab library={library} />}
        {activeTab === "media" && <MediaTab library={library} />}

        {/* Admin Notes at the bottom of all tabs */}
        <AdminNoteEditor 
          libraryId={library.id} 
          initialNote={library.adminNotes || ""} 
          phone={library.managerPhone} 
        />
      </div>
    </div>
  )
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
        active 
          ? "bg-primary text-primary-foreground shadow-md" 
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {icon} {label}
    </button>
  )
}

// ----------------------------------------------------------------------
// TAB COMPONENTS
// ----------------------------------------------------------------------

function GeneralTab({ library }: { library: LibraryRecord }) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  const [phone, setPhone] = useState(library.managerPhone || "")
  const [whatsapp, setWhatsapp] = useState(library.whatsapp || "")
  const [sameAsPhone, setSameAsPhone] = useState(library.whatsapp === library.managerPhone && !!library.managerPhone)
  
  const isPhoneValid = phone === "" || /^[0-9]{10}$/.test(phone)

  async function handleSave(formData: FormData) {
    setIsSaving(true)
    setError(null)
    setSuccess(false)
    try {
      if (!isPhoneValid) throw new Error("Please enter a valid 10-digit phone number.")
      formData.append("whatsapp", sameAsPhone ? phone : whatsapp);
      await updateBasicInfo(formData)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save General Info.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="p-6 sm:p-8 border-b border-border bg-muted/20">
        <h2 className="text-xl font-bold text-foreground">General Information</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage core details and contact info.</p>
      </div>
      
      <form action={handleSave} className="p-6 sm:p-8 space-y-6">
        <input type="hidden" name="id" value={library.id} />
        
        {error && <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm font-medium flex items-center gap-2"><AlertCircle className="w-4 h-4"/>{error}</div>}
        {success && <div className="p-4 rounded-xl bg-success/10 text-success text-sm font-medium flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/>Saved successfully!</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="name">Display Name <span className="text-destructive">*</span></Label>
            <Input id="name" name="name" defaultValue={library.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="seatsAvailable">Seats Available <span className="text-destructive">*</span></Label>
            <Input id="seatsAvailable" name="seatsAvailable" type="number" defaultValue={library.seatsAvailable || ""} required />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <textarea 
              id="description" 
              name="description" 
              defaultValue={library.description || ""}
              placeholder="Tell students what makes your library a great place to study..."
              className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
        </div>

        <div className="pt-6 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="managerName">Manager Name</Label>
            <Input id="managerName" name="managerName" defaultValue={library.managerName || ""} placeholder="e.g. Rahul Kumar" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="managerPhone">Manager Phone (10 digits) <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input 
                id="managerPhone" name="managerPhone" 
                value={phone} onChange={(e) => setPhone(e.target.value)} 
                className={`pl-9 ${!isPhoneValid && phone ? 'border-destructive focus-visible:ring-destructive' : phone ? 'border-success' : ''}`}
                required 
              />
            </div>
            {!isPhoneValid && phone && <p className="text-xs text-destructive mt-1">Must be exactly 10 digits.</p>}
          </div>
          
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="whatsapp">WhatsApp (Optional)</Label>
            <div className="relative max-w-sm">
              <Phone className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input 
                id="whatsapp" 
                value={sameAsPhone ? phone : whatsapp} 
                onChange={(e) => setWhatsapp(e.target.value)} 
                disabled={sameAsPhone} 
                className="pl-9 disabled:opacity-70" 
              />
            </div>
            <label className="flex items-center gap-2 mt-3 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={sameAsPhone} onChange={(e) => setSameAsPhone(e.target.checked)} className="rounded border-border accent-primary" />
              Same as manager phone number
            </label>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <SaveButton isSaving={isSaving} />
        </div>
      </form>
    </div>
  )
}

function LocationTab({ library }: { library: LibraryRecord }) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [mapUrl, setMapUrl] = useState(library.googleMapsUrl || "")
  
  const isMapValid = mapUrl === "" || mapUrl.includes("google.com/maps") || mapUrl.includes("goo.gl/maps") || mapUrl.includes("maps.app.goo.gl")

  async function handleSave(formData: FormData) {
    setIsSaving(true)
    setError(null)
    setSuccess(false)
    try {
      if (!isMapValid) throw new Error("Invalid Google Maps URL. Please provide a valid link.")
      await updateLocation(formData)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save Location.")
    } finally {
      setIsSaving(false)
    }
  }

  // Extract embedded URL if they provided an iframe by mistake, or just use it in an iframe preview if possible
  // For safety, we will just show a preview if it's an embed url, otherwise standard maps link
  const embedUrl = mapUrl.includes("embed") ? mapUrl : null;

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="p-6 sm:p-8 border-b border-border bg-muted/20">
        <h2 className="text-xl font-bold text-foreground">Location & Address</h2>
        <p className="text-sm text-muted-foreground mt-1">Help students find your library easily.</p>
      </div>
      
      <form action={handleSave} className="p-6 sm:p-8 space-y-6">
        <input type="hidden" name="id" value={library.id} />
        
        {error && <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm font-medium flex items-center gap-2"><AlertCircle className="w-4 h-4"/>{error}</div>}
        {success && <div className="p-4 rounded-xl bg-success/10 text-success text-sm font-medium flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/>Saved successfully!</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">Full Address <span className="text-destructive">*</span></Label>
            <Input id="address" name="address" defaultValue={library.address} required />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="googleMapsUrl">Google Maps Link <span className="text-destructive">*</span></Label>
            <Input 
              id="googleMapsUrl" name="googleMapsUrl" 
              value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} 
              placeholder="https://maps.app.goo.gl/..." 
              className={`${!isMapValid && mapUrl ? 'border-destructive focus-visible:ring-destructive' : mapUrl ? 'border-success' : ''}`}
              required 
            />
            {!isMapValid && mapUrl && <p className="text-xs text-destructive mt-1">Must be a valid Google Maps link.</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="locality">Locality</Label>
            <Input id="locality" name="locality" defaultValue={library.locality || ""} placeholder="e.g. Mukherjee Nagar" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City <span className="text-destructive">*</span></Label>
            <Input id="city" name="city" defaultValue={library.city || ""} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="district">District</Label>
            <Input id="district" name="district" defaultValue={library.district || ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State <span className="text-destructive">*</span></Label>
            <Input id="state" name="state" defaultValue={library.state || ""} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pinCode">PIN Code <span className="text-destructive">*</span></Label>
            <Input id="pinCode" name="pinCode" defaultValue={library.pinCode || ""} required />
          </div>
        </div>

        {/* Map Preview section if valid link */}
        {isMapValid && mapUrl && (
          <div className="mt-6 border border-border rounded-xl overflow-hidden h-64 bg-muted flex items-center justify-center relative">
            {embedUrl ? (
              <iframe src={embedUrl} width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy"></iframe>
            ) : (
              <div className="text-center p-6">
                <MapPin className="w-10 h-10 text-primary/50 mx-auto mb-3" />
                <p className="font-medium">Map Link Linked Successfully</p>
                <a href={mapUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">Click to test link in new tab</a>
                <p className="text-xs text-muted-foreground mt-2">To show an embedded map, use the &apos;Embed a map&apos; iframe src URL from Google Maps.</p>
              </div>
            )}
          </div>
        )}

        <div className="pt-6 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="metroStation">Nearest Metro Station</Label>
            <Input id="metroStation" name="metroStation" defaultValue={library.metroStation || ""} placeholder="e.g. Rajiv Chowk" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="metroDistance">Metro Distance (km)</Label>
            <Input id="metroDistance" name="metroDistance" type="number" step="0.1" defaultValue={library.metroDistance || ""} placeholder="e.g. 0.5" />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <SaveButton isSaving={isSaving} />
        </div>
      </form>
    </div>
  )
}

function FacilitiesTab({ library }: { library: LibraryRecord }) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  const initialSelected = new Set(library.facilities || [])
  const [selectedFacilities, setSelectedFacilities] = useState<Set<string>>(initialSelected)

  const toggleFacility = (f: string) => {
    const next = new Set(selectedFacilities)
    if (next.has(f)) next.delete(f)
    else next.add(f)
    setSelectedFacilities(next)
  }

  async function handleSave(formData: FormData) {
    setIsSaving(true)
    setError(null)
    setSuccess(false)
    try {
      formData.set("facilities", JSON.stringify(Array.from(selectedFacilities)))
      await updateFacilities(formData)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save Facilities.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="p-6 sm:p-8 border-b border-border bg-muted/20">
        <h2 className="text-xl font-bold text-foreground">Facilities & Logistics</h2>
        <p className="text-sm text-muted-foreground mt-1">Configure your amenities and operating hours.</p>
      </div>
      
      <form action={handleSave} className="p-6 sm:p-8 space-y-8">
        <input type="hidden" name="id" value={library.id} />
        
        {error && <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm font-medium flex items-center gap-2"><AlertCircle className="w-4 h-4"/>{error}</div>}
        {success && <div className="p-4 rounded-xl bg-success/10 text-success text-sm font-medium flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/>Saved successfully!</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="openingTime">Opening Time <span className="text-destructive">*</span></Label>
            <Input id="openingTime" name="openingTime" type="time" defaultValue={library.openingTime || "08:00"} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="closingTime">Closing Time <span className="text-destructive">*</span></Label>
            <Input id="closingTime" name="closingTime" type="time" defaultValue={library.closingTime || "22:00"} required />
          </div>
        </div>

        <div>
          <Label className="mb-4 block text-base font-bold">Premium Amenities</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {facilityOptions.map((facility) => {
              const isSelected = selectedFacilities.has(facility);
              return (
                <button
                  key={facility}
                  type="button"
                  onClick={() => toggleFacility(facility)}
                  className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border transition-all duration-200 ${
                    isSelected 
                      ? 'border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary' 
                      : 'border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {FacilityIcons[facility]}
                  <span className="text-xs font-semibold tracking-wide text-center">{facility}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <SaveButton isSaving={isSaving} />
        </div>
      </form>
    </div>
  )
}

function MediaTab({ library }: { library: LibraryRecord }) {
  const [isSaving, setIsSaving] = useState(false)
  const [photos, setPhotos] = useState<string[]>(library.photos || [])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isKycLoading, setIsKycLoading] = useState(false)
  const [uploadingPassbook, setUploadingPassbook] = useState(false)

  async function handleSavePhotos() {
    setIsSaving(true)
    try {
      const fd = new FormData()
      fd.append("id", library.id)
      fd.append("photos", JSON.stringify(photos))
      await updateLibrarySettings(fd)
      alert("Photos saved successfully!")
    } catch {
      alert("Failed to save photos.")
    } finally {
      setIsSaving(false)
    }
  }

  const onUploadSuccess = (res: UploadResult) => {
    setPhotos(prev => [...prev, res.url].slice(0, 3));
    setUploadingImage(false);
  };

  const handlePassbookUploadSuccess = async (res: UploadResult) => {
    setUploadingPassbook(false);
    setIsKycLoading(true);
    try {
      const { uploadPassbook } = await import('@/app/actions/library-actions');
      await uploadPassbook(library.id, res.url);
      alert("Passbook uploaded successfully. Your library is now pending review.");
    } catch (error: unknown) {
      alert(getErrorMessage(error, "Failed to update KYC status."));
    } finally {
      setIsKycLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden p-6 sm:p-8">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-2">
          <ImageIcon className="w-5 h-5 text-primary" /> Library Photos
        </h2>
        <p className="text-sm text-muted-foreground mb-6">Upload up to 3 high-quality images of your space.</p>

        <div className="flex flex-wrap gap-4 mb-6">
          {photos.map((url, i) => (
            <div key={i} className="relative w-32 h-32 rounded-xl overflow-hidden border border-border group shadow-sm">
              <Image src={url} alt="Library" fill sizes="128px" className="object-cover" />
              <button 
                type="button" 
                onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-6 h-6 text-white" />
              </button>
            </div>
          ))}
          {photos.length < 3 && (
            <ImageKitProvider 
              publicKey={process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY} 
              urlEndpoint={process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT} 
              authenticator={authenticator}
            >
              <div className="relative border-2 border-dashed border-border rounded-xl w-32 h-32 flex flex-col items-center justify-center hover:bg-muted/30 transition-colors group cursor-pointer text-muted-foreground hover:text-primary hover:border-primary/50">
                <IKUpload
                  fileName="library_photo"
                  tags={["library"]}
                  onUploadStart={() => setUploadingImage(true)}
                  onError={() => { setUploadingImage(false); alert("Upload failed"); }}
                  onSuccess={onUploadSuccess}
                  accept="image/*"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                {uploadingImage ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImageIcon className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform" />}
                <span className="text-xs font-medium">{uploadingImage ? "Uploading..." : "Add Photo"}</span>
              </div>
            </ImageKitProvider>
          )}
        </div>
        
        <div className="flex justify-end pt-4 border-t border-border mt-4">
          <button 
            type="button" 
            onClick={handleSavePhotos}
            disabled={isSaving || uploadingImage} 
            className="bg-primary text-primary-foreground font-bold px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
            Save Photos
          </button>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
        <h2 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" /> Verification & KYC
        </h2>
        <p className="text-sm text-muted-foreground mb-6">Upload your passbook to verify your library identity.</p>

        <div className="bg-muted/30 border border-border rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-foreground">KYC Status</h3>
            <div className="mt-2 flex items-center gap-2">
              <span className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wide ${
                library.kycStatus === 'APPROVED' ? 'bg-success/20 text-success' :
                library.kycStatus === 'REJECTED' ? 'bg-destructive/20 text-destructive' :
                'bg-warning/20 text-warning'
              }`}>
                {library.kycStatus}
              </span>
            </div>
          </div>
          
          {library.kycStatus !== 'APPROVED' && (
            <div className="relative">
              <ImageKitProvider 
                publicKey={process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY} 
                urlEndpoint={process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT} 
                authenticator={authenticator}
              >
                <button 
                  type="button"
                  disabled={isKycLoading || uploadingPassbook} 
                  className="bg-foreground text-background font-bold px-6 py-2.5 rounded-xl transition-transform hover:scale-105 active:scale-95 flex items-center gap-2 whitespace-nowrap overflow-hidden relative shadow-md"
                >
                  <IKUpload
                    fileName="passbook_kyc"
                    tags={["kyc"]}
                    onUploadStart={() => setUploadingPassbook(true)}
                    onError={() => { setUploadingPassbook(false); alert("Upload failed"); }}
                    onSuccess={handlePassbookUploadSuccess}
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  {(isKycLoading || uploadingPassbook) ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  {uploadingPassbook ? "Uploading..." : library.passbookPhoto ? "Update Passbook" : "Upload Passbook"}
                </button>
              </ImageKitProvider>
            </div>
          )}
        </div>
      </div>

      <HardwareProvisioningCard libraryId={library.id} />
    </div>
  )
}

function SaveButton({ isSaving }: { isSaving: boolean }) {
  return (
    <button 
      type="submit" 
      disabled={isSaving} 
      className="bg-primary text-primary-foreground font-bold px-8 py-3 rounded-xl hover:opacity-90 hover:shadow-lg transition-all active:scale-[0.98] flex items-center gap-2 disabled:opacity-50 text-base shadow-md"
    >
      {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} 
      {isSaving ? 'Saving...' : 'Save Changes'}
    </button>
  )
}
