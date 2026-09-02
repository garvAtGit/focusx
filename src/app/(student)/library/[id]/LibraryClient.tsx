'use client'

import { useState, useEffect, useRef, useCallback } from "react"
import { 
  MapPin, Check, Loader2, Clock, Phone, Navigation, Lock, Share, Heart,
  Snowflake, Droplet, Video, Car, ShieldCheck, VolumeX, Wifi, Bath, Coffee, Plug, CheckCircle2 
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { LibraryPhotoGallery } from "@/components/library-photo-gallery"
import { InquiryForm } from "./InquiryForm";
import dynamic from "next/dynamic"
import { auth } from "@/lib/firebase/clientApp"

import { toast } from "react-hot-toast"
import { formatStandardDate } from "@/lib/date-utils"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"

type LibraryPlan = {
  id: string
  name: string
  type: "FIXED" | "FLEXIBLE"
  durationHours: number | null
  validityDays: number
  price: number
  discount: number | null
}

type LibrarySeat = {
  id: string
  name: string
  type: "RESERVED" | "NORMAL" | "PREMIUM" | "NON_RESERVABLE"
  gridX: number
  gridY: number
  hasLocker: boolean
  lockerPriceDaily: number | null
  premiumPriceDaily: number | null
  syncPremiumOffers: boolean
}

type StandaloneLocker = {
  id: string
  name: string
  price: number
}

type LibraryDetails = {
  id: string
  name: string
  address: string
  locality: string | null
  city: string | null
  metroStation: string | null
  metroDistance: number | null
  openingTime: string | null
  closingTime: string | null
  managerPhone: string | null
  seatsAvailable: number | null
  description: string | null
  photos: string[]
  facilities: string[]
  googleMapsUrl: string | null
  plans: LibraryPlan[]
  seats: LibrarySeat[]
  standaloneLockers: StandaloneLocker[]
}

type SavedLibrary = {
  id: string
  name?: string
  locality?: string
  city?: string | null
  metroStation?: string | null
  metroDistance?: number | null
  minPrice?: number
  imageUrl?: string | null
}

type CheckoutDraft = {
  planId?: string
  seatId?: string
  standaloneLockerId?: string
  paymentMode?: "ONLINE" | "RECEPTION"
}

type DynamicDataResponse = {
  occupiedSeatIds?: string[]
  occupiedLockerIds?: string[]
  currentPlanEndDate?: string | null
  session?: {
    userId?: string
    phone?: string
    email?: string
  } | null
}

type LibraryClientProps = {
  library: LibraryDetails
  occupiedSeatIds: string[]
  studentId: string
  currentPlanEndDate?: string | null
  studentPhone?: string
  studentEmail?: string
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function readSavedLibraries(): SavedLibrary[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem("savedLibraries") || "[]",
    )
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is SavedLibrary =>
        typeof item === "object"
        && item !== null
        && "id" in item
        && typeof item.id === "string",
    )
  } catch {
    return []
  }
}

const facilityIconMap: Record<string, React.ElementType> = {
  "AC": Snowflake,
  "RO Water": Droplet,
  "CCTV": Video,
  "Parking": Car,
  "Security Guard": ShieldCheck,
  "Silent Zone": VolumeX,
  "Wi-Fi": Wifi,
  "Washroom": Bath,
  "Locker": Lock,
  "Tea/Coffee": Coffee,
  "Charging Points": Plug
};

function getFacilityIcon(fac: string) {
  const Icon = facilityIconMap[fac] || CheckCircle2;
  return <Icon className="w-5 h-5 text-primary shrink-0" />;
}
// Seat map pulls in react-zoom-pan-pinch; load it only when the section renders
// so it stays out of the initial library-page bundle.
const LiveSeatMap = dynamic(() => import("@/components/LiveSeatMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 w-full rounded-xl bg-muted animate-pulse">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
})
export function LibraryClient({ library, occupiedSeatIds: initialOccupiedSeatIds, studentId: initialStudentId, currentPlanEndDate: initialCurrentPlanEndDate, studentPhone: initialStudentPhone, studentEmail: initialStudentEmail }: LibraryClientProps) {
  const router = useRouter();
  const [selectedSeat, setSelectedSeat] = useState<LibrarySeat | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<LibraryPlan | null>(null);
  const [planFilter, setPlanFilter] = useState<number | null | "ALL">("ALL");
  const [monthFilter, setMonthFilter] = useState<number | null | "ALL">("ALL");
  
  const [selectedStandaloneLockerId, setSelectedStandaloneLockerId] = useState<string>("");
  
  const [paymentMode, setPaymentMode] = useState<"ONLINE" | "RECEPTION" | null>(null);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  
  // Feedback State
  const [feedbackType, setFeedbackType] = useState<"FEEDBACK" | "COMPLAINT" | null>(null);
  const [feedbackContent, setFeedbackContent] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  // Dynamic Session State
  const [dynamicState, setDynamicState] = useState({
    occupiedSeatIds: initialOccupiedSeatIds,
    occupiedLockerIds: [] as string[],
    studentId: initialStudentId,
    currentPlanEndDate: initialCurrentPlanEndDate,
    studentPhone: initialStudentPhone || "",
    studentEmail: initialStudentEmail || "",
    isLoading: true,
    hasError: false
  });

  const dynamicRetryAfterRef = useRef(0);
  const dynamicRequestInFlightRef = useRef(false);
  const realtimeOccupiedSeatIds = dynamicState.occupiedSeatIds;

  const loadDynamicData = useCallback(async (showLoading = true) => {
    if (
      dynamicRequestInFlightRef.current
      || Date.now() < dynamicRetryAfterRef.current
    ) {
      if (showLoading) {
        setDynamicState((state) => ({ ...state, isLoading: false }));
      }
      return;
    }

    if (showLoading) {
      setDynamicState(s => ({ ...s, isLoading: true, hasError: false }));
    }
    dynamicRequestInFlightRef.current = true;
    try {
      const response = await fetch(
        `/api/library/dynamic-data?libraryId=${encodeURIComponent(library.id)}`,
        { cache: "no-store" },
      );
      if (response.status === 429) {
        const retryAfterSeconds = Number(
          response.headers.get("Retry-After") ?? "30",
        );
        dynamicRetryAfterRef.current =
          Date.now()
          + (Number.isFinite(retryAfterSeconds)
            ? Math.max(1, retryAfterSeconds) * 1000
            : 30_000);
        // Keep the last server-rendered availability instead of clearing it or
        // blocking checkout solely because a refresh was throttled.
        setDynamicState((state) => ({
          ...state,
          isLoading: false,
          hasError: false,
        }));
        return;
      }
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const data = await response.json() as DynamicDataResponse;
      dynamicRetryAfterRef.current = 0;
      setDynamicState({
        occupiedSeatIds: data.occupiedSeatIds || [],
        occupiedLockerIds: data.occupiedLockerIds || [],
        studentId: data.session?.userId || "",
        currentPlanEndDate: data.currentPlanEndDate || null,
        studentPhone: data.session?.phone || "",
        studentEmail: data.session?.email || "",
        isLoading: false,
        hasError: false
      });
    } catch (error) {
      // Preserve the last known occupancy. Clearing it would make reserved
      // resources appear free until the next successful refresh.
      console.error("Failed to fetch dynamic library data:", error);
      setDynamicState((state) => ({
        ...state,
        isLoading: false,
        hasError: true,
      }));
    } finally {
      dynamicRequestInFlightRef.current = false;
    }
  }, [library.id]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadDynamicData(), 0);
    const interval = window.setInterval(
      () => void loadDynamicData(false),
      15_000,
    );
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadDynamicData]);

  const handleFeedbackSubmit = async () => {
    if (!dynamicState.studentId) {
      router.push(`/login?returnUrl=/library/${library.id}`);
      return;
    }
    if (!feedbackContent.trim()) return;
    
    setIsSubmittingFeedback(true);
    try {
      const res = await fetch('/api/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          libraryId: library.id,
          type: feedbackType,
          content: feedbackContent
        })
      });
      if (!res.ok) throw new Error("Failed to submit");
      alert("Submitted successfully!");
      setFeedbackType(null);
      setFeedbackContent("");
    } catch (error: unknown) {
      alert(errorMessage(error, "Failed to submit"));
    } finally {
      setIsSubmittingFeedback(false);
    }
  };
  const [isProcessing, setIsProcessing] = useState(false);
  const checkoutLockRef = useRef(false);
  const checkoutIdempotencyRef = useRef<{
    fingerprint: string;
    key: string;
  } | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const scrollToSection = (sectionId: string, align: ScrollLogicalPosition = 'start') => {
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: align });
    }, 150);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsSaved(readSavedLibraries().some((item) => item.id === library.id));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [library.id]);

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: library.name,
          text: `Check out ${library.name} on Library Near!`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedCheckout = sessionStorage.getItem(`checkout_${library.id}`);
        if (savedCheckout) {
          const parsed = JSON.parse(savedCheckout) as CheckoutDraft;
        
          if (parsed.planId) {
            const plan = library.plans.find((item) => item.id === parsed.planId);
            if (plan) setSelectedPlan(plan);
          }
        
          if (parsed.seatId) {
            const seat = library.seats.find((item) => item.id === parsed.seatId);
            if (seat) setSelectedSeat(seat);
          }
        
          if (parsed.standaloneLockerId) {
            setSelectedStandaloneLockerId(parsed.standaloneLockerId);
          }

          if (parsed.paymentMode) {
            setPaymentMode(parsed.paymentMode);
          }
        
          sessionStorage.removeItem(`checkout_${library.id}`);
        }
      } catch {
        // Ignore malformed legacy checkout state.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [library.id, library.plans, library.seats]);

  const handleSave = () => {
    try {
      let savedLibraries = readSavedLibraries();
      if (isSaved) {
        savedLibraries = savedLibraries.filter((item) => item.id !== library.id);
        setIsSaved(false);
      } else {
        const monthlyPlans = library.plans.filter((plan) => plan.validityDays >= 30);
        const plansToUse = monthlyPlans.length > 0 ? monthlyPlans : library.plans;
        const minPrice = plansToUse && plansToUse.length > 0 
          ? Math.min(...plansToUse.map((plan) => plan.price))
          : 0;

        savedLibraries.push({
          id: library.id,
          name: library.name,
          locality: library.locality || library.address.split(',')[0],
          city: library.city,
          metroStation: library.metroStation,
          metroDistance: library.metroDistance,
          minPrice: minPrice,
          imageUrl: library.photos?.[0] || null
        });
        setIsSaved(true);
      }
      localStorage.setItem('savedLibraries', JSON.stringify(savedLibraries));
      window.dispatchEvent(new Event("savedLibrariesUpdated"));
    } catch (e) {
      console.error('Error saving:', e);
    }
  };
  // Using the prop passed from the server side.

  const isFlexible = selectedPlan?.type === "FLEXIBLE";
  const seatHasMandatoryLocker = !isFlexible && selectedSeat?.hasLocker === true;
  
  // Calculate Prices
  let planPrice = 0;
  let lockerCost = 0;
  let premiumSurcharge = 0;
  
  if (selectedPlan) {
    planPrice = selectedPlan.discount 
      ? selectedPlan.price - (selectedPlan.price * selectedPlan.discount / 100) 
      : selectedPlan.price;

    if (seatHasMandatoryLocker) {
      lockerCost = (selectedSeat.lockerPriceDaily || 0) * selectedPlan.validityDays;
    } else if (selectedStandaloneLockerId) {
      const locker = library.standaloneLockers.find(
        (item) => item.id === selectedStandaloneLockerId,
      );
      if (locker) {
        // Prorate standalone lockers based on 28-day month since they weren't migrated
        lockerCost = Math.round((locker.price / 30) * selectedPlan.validityDays);
      }
    }
    
    if (selectedSeat?.type === 'PREMIUM' && selectedSeat?.premiumPriceDaily) {
      premiumSurcharge = selectedSeat.premiumPriceDaily * selectedPlan.validityDays;
      if (selectedSeat.syncPremiumOffers !== false && selectedPlan.discount) {
        premiumSurcharge -= (premiumSurcharge * selectedPlan.discount / 100);
      }
    }
  }

  const totalAmount = Math.round(planPrice + lockerCost + premiumSurcharge);

  const searchParams = useSearchParams();
  const upgradeBookingId = searchParams.get('upgrade');

  let startDate = new Date();
  if (dynamicState.currentPlanEndDate && !upgradeBookingId) {
    startDate = new Date(dynamicState.currentPlanEndDate);
  }
  const endDate = new Date(startDate);
  if (selectedPlan) {
    endDate.setDate(endDate.getDate() + selectedPlan.validityDays - 1);
  }

  const executeCheckout = async (idToken?: string, overrideMode?: "ONLINE" | "RECEPTION") => {
    if (!selectedPlan) {
      toast.error("Please select a plan.");
      return;
    }
    
    if (!isFlexible && !selectedSeat) {
      toast.error("Please select a seat for this Fixed plan.");
      return;
    }

    checkoutLockRef.current = true;
    setIsProcessing(true);

    const mode = overrideMode || paymentMode;
    const checkoutSeatId = isFlexible ? null : selectedSeat?.id ?? null;
    const checkoutFingerprint = JSON.stringify({
      studentId: dynamicState.studentId,
      libraryId: library.id,
      planId: selectedPlan.id,
      seatId: checkoutSeatId,
      hasLocker: seatHasMandatoryLocker,
      standaloneLockerId:
        !seatHasMandatoryLocker && selectedStandaloneLockerId
          ? selectedStandaloneLockerId
          : null,
      upgradeBookingId,
    });
    if (checkoutIdempotencyRef.current?.fingerprint !== checkoutFingerprint) {
      checkoutIdempotencyRef.current = {
        fingerprint: checkoutFingerprint,
        key: crypto.randomUUID(),
      };
    }
    const idempotencyKey = checkoutIdempotencyRef.current.key;

    const requestBody = {
      studentId: dynamicState.studentId,
      libraryId: library.id,
      seatId: checkoutSeatId,
      planId: selectedPlan.id,
      hasLocker: seatHasMandatoryLocker,
      standaloneLockerId: !seatHasMandatoryLocker && selectedStandaloneLockerId ? selectedStandaloneLockerId : null,
      idToken,
      ...(upgradeBookingId ? {
        operation: 'UPGRADE_PLAN',
        sourceBookingId: upgradeBookingId,
      } : {})
    };

    if (mode === "RECEPTION") {
      try {
        const res = await fetch('/api/checkout/reception', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify(requestBody)
        });
        const data = await res.json();
        if (data.success) {
          toast.success("Booking requested! Please pay at the reception to confirm your seat.");
          setShowSuccessModal(true);
        } else {
          toast.error(data.error || "Failed to initiate booking");
        }
      } catch {
        toast.error("An error occurred during booking");
      } finally {
        setIsProcessing(false);
        checkoutLockRef.current = false;
      }
      return;
    }

    try {
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(requestBody)
      });
      const data = await orderRes.json();

      if (!data.payment_url) {
        if (data.retryable !== true) {
          checkoutIdempotencyRef.current = null;
        }
        throw new Error(data.error || "Failed to create payment");
      }

      window.location.href = data.payment_url;
    } catch (error: unknown) {
      console.error(error);
      toast.error(errorMessage(error, "Error initiating checkout"));
      setIsProcessing(false);
      checkoutLockRef.current = false;
    }
  };

  const handleCheckout = async (overrideMode?: "ONLINE" | "RECEPTION") => {
    if (overrideMode === "RECEPTION") {
      executeCheckout(undefined, "RECEPTION");
      return;
    }

    if (checkoutLockRef.current) return;
    
    const user = auth.currentUser;
    if (!dynamicState.studentId && !user) {
      try {
        sessionStorage.setItem(`checkout_${library.id}`, JSON.stringify({
          planId: selectedPlan?.id,
          seatId: selectedSeat?.id,
          standaloneLockerId: selectedStandaloneLockerId,
          paymentMode: paymentMode
        }));
      } catch {
        // Storage can be unavailable in privacy-restricted embeds.
      }

      const isEmbed = new URLSearchParams(window.location.search).get('embed') === 'true';
      if (isEmbed) {
        // Use popup for iframes to bypass third-party cookie blocking
        const width = 400;
        const height = 650;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        window.open('/login?popup=true', 'Login', `width=${width},height=${height},top=${top},left=${left}`);
        
        const listener = (e: MessageEvent<{ type?: string; token?: string }>) => {
          // Only accept the login result from our own origin; ignore messages
          // injected by any other window/frame.
          if (e.origin !== window.location.origin) return;
          if (e.data?.type === 'LOGIN_SUCCESS' && e.data.token) {
            window.removeEventListener('message', listener);
            executeCheckout(e.data.token);
          }
        };
        window.addEventListener('message', listener);
        return;
      }

      const retUrl = isEmbed ? `/library/${library.id}?embed=true` : `/library/${library.id}`;
      router.push(`/login?returnUrl=${encodeURIComponent(retUrl)}`);
      return;
    }
    const idToken = user ? await user.getIdToken() : undefined;
    executeCheckout(idToken, overrideMode);
  }

  // Compute unique hours for filters
  const availableHours = Array.from(
    new Set(library.plans.map((plan) => plan.durationHours)),
  ).sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return a - b;
    });

  const availableDurations = Array.from(
    new Set(
      library.plans.map((plan) => plan.validityDays)
    )
  ).sort((a, b) => a - b);

  const filteredPlans = library.plans
    .filter((plan) => planFilter === "ALL" || plan.durationHours === planFilter)
    .filter(
      (plan) =>
        monthFilter === "ALL"
        || plan.validityDays === monthFilter
    )
    .sort((a, b) => {
      const priceA = a.discount ? a.price - (a.price * a.discount / 100) : a.price;
      const priceB = b.discount ? b.price - (b.price * b.discount / 100) : b.price;
      return priceA - priceB;
    });

  // Setup photos array
  let photos = library.photos || [];
  if (photos.length === 0) {
    photos = [
      "https://images.unsplash.com/photo-1568667256549-094345857637?w=1200&q=80",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
      "https://images.unsplash.com/photo-1510531704581-5b28709e5a16?w=800&q=80"
    ];
  }

  const mapEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(library.address)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  useEffect(() => {
    if (showSuccessModal) {
      const timer = setTimeout(() => {
        const url = '/student/dashboard?booking=success';
        try {
          if (window.top !== window.self) window.top!.location.href = url;
          else window.location.href = url;
        } catch { window.location.href = url; }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessModal]);

  return (
    <div className="min-h-screen bg-background pb-32">
      
      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border shadow-2xl rounded-3xl p-8 max-w-sm w-full text-center space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-heading font-black text-foreground">Booking Confirmed!</h2>
            <p className="text-muted-foreground">Your seat has been successfully reserved. You are being redirected to your bookings page...</p>
            <button 
              onClick={() => {
                const url = '/student/dashboard?booking=success';
                try {
                  if (window.top !== window.self) window.top!.location.href = url;
                  else window.location.href = url;
                } catch { window.location.href = url; }
              }}
              className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity mt-4"
            >
              Go to My Bookings
            </button>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-8">
        <div className="text-sm font-medium text-muted-foreground mb-4">
          Home / {library.city} / <span className="text-foreground font-bold">{library.name}</span>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-4xl font-heading font-bold text-foreground mb-3">{library.name}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-muted-foreground">
              {(library.name === "Kripa Library" || library.name === "Gyan Vatika Library") && (
                <span className="flex items-center gap-1 text-success bg-success/10 px-2 py-0.5 rounded text-xs border border-success/20"><Check className="w-3 h-3" /> Verified</span>
              )}
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {library.locality || library.address.split(',')[0]} {library.metroStation ? `· ${library.metroDistance} km from ${library.metroStation}` : ''}</span>
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {library.openingTime || "08:00"} – {library.closingTime || "22:00"}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-bold text-foreground hover:bg-muted transition-colors">
              <Share className="w-4 h-4" /> Share
            </button>
            <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-bold text-foreground hover:bg-muted transition-colors">
              <Heart className={`w-4 h-4 ${isSaved ? 'fill-foreground text-foreground' : ''}`} /> {isSaved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Top Full Width Photos */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-8 library-gallery">
        <LibraryPhotoGallery images={photos} libraryName={library.name} />
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-8 flex flex-col lg:grid lg:grid-cols-3 gap-y-12 lg:gap-x-12 relative">
        
        {/* Left Column 1: About */}
        <div className="order-1 lg:col-span-2 lg:col-start-1 lg:row-start-1 space-y-12 about-section">
          <section className="space-y-4">
            <h2 className="text-2xl font-bold font-heading tracking-tight">About</h2>
            <div className="flex flex-wrap gap-4 text-sm font-medium text-muted-foreground bg-muted/30 p-4 rounded-xl border border-border">
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-primary" /> {library.openingTime || "08:00"} - {library.closingTime || "22:00"}</span>
              {library.managerPhone && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-primary" /> {library.managerPhone}</span>}
              {library.seatsAvailable && <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-primary" /> {library.seatsAvailable} Seats Available</span>}
            </div>
            {library.description && (
              <p className="text-foreground leading-relaxed">
                {library.description}
              </p>
            )}
          </section>
        </div>

        {/* Right Column: Booking Widget */}
        <div className="order-2 lg:order-none lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:row-span-2 booking-widget-container" id="booking-widget">
          <div className="relative bg-card border border-border shadow-2xl rounded-3xl p-6 space-y-6" id="booking-scroll-container">
            <h3 className="text-2xl font-black font-heading tracking-tight text-foreground">
              {selectedPlan ? (
                <span>₹{totalAmount.toFixed(0)}</span>
              ) : (
                "Select a plan"
              )}
            </h3>

            <div className="space-y-3 scroll-mt-24" id="plans-section">
              <label className="text-sm font-bold text-foreground flex items-center justify-between">
                <span>1. Choose a Plan</span>
              </label>

              {/* Filters */}
              <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-none">
                <button 
                  onClick={() => setPlanFilter("ALL")}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${planFilter === "ALL" ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                >
                  All Hours
                </button>
                {availableHours.map((hr) => (
                  <button 
                    key={hr === null ? "FULL" : hr}
                    onClick={() => setPlanFilter(hr)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${planFilter === hr ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                  >
                    {hr === null ? "Full Day" : `${hr} hr`}
                  </button>
                ))}
              </div>
              <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-none">
                <button 
                  onClick={() => setMonthFilter("ALL")}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${monthFilter === "ALL" ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                >
                  All Durations
                </button>
                {availableDurations.map((d) => {
                  const isDaily = d < 30;
                  const label = isDaily ? `${d} Day${d > 1 ? 's' : ''}` : `${Math.max(1, Math.round(d / 30))} Month${Math.round(d / 30) > 1 ? 's' : ''}`;
                  return (
                    <button 
                      key={d}
                      onClick={() => setMonthFilter(d)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${monthFilter === d ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 gap-3 max-h-[350px] overflow-y-auto pr-2 scrollbar-thin">
                {filteredPlans.map((plan) => {
                  const isSelected = selectedPlan?.id === plan.id;
                  const finalPrice = plan.discount ? plan.price - (plan.price * plan.discount / 100) : plan.price;
                  const isDaily = plan.validityDays < 30;
                  const months = isDaily ? 0 : Math.max(1, Math.round(plan.validityDays / 30));
                  const perMonth = isDaily ? finalPrice.toFixed(0) : (finalPrice / months).toFixed(0);
                  const isFullDay = plan.durationHours === null;
                  
                  return (
                    <div 
                      key={plan.id} 
                      onClick={() => {
                        setSelectedPlan(plan);
                        if (plan.type === "FLEXIBLE") {
                          setSelectedSeat(null);
                          scrollToSection('payment-section', 'center');
                        } else {
                          scrollToSection('seat-section', 'start');
                        }
                      }}
                      className={`flex flex-row bg-white rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden group relative active:scale-[0.99] active:bg-slate-50/50 ${isSelected ? 'border-primary shadow-md ring-1 ring-primary' : 'border-slate-200 shadow-sm hover:shadow-md hover:border-primary/50'}`}
                    >
                      
                      {/* Subtle thin color line on left */}
                      <div className={`absolute left-0 top-0 bottom-0 w-[4px] ${isSelected ? 'bg-primary' : 'bg-slate-300'}`}></div>

                      {/* Left Side: Clean Typography */}
                      <div className="flex-1 py-5 pr-3 pl-5 flex flex-col justify-center relative min-w-0">
                        {/* Subtle hover gradient */}
                        <div className={`absolute inset-0 bg-gradient-to-r from-blue-50/[0.2] to-transparent transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}></div>
                        
                        <div className="relative z-10">
                          {/* Title & Subtitle */}
                          <div className="mb-2">
                            <h3 className={`text-[22px] md:text-[24px] font-black tracking-tight leading-none transition-colors truncate group-hover:text-primary ${isSelected ? 'text-primary' : 'text-slate-900'}`}>
                              {isDaily ? `${plan.validityDays} Day${plan.validityDays > 1 ? 's' : ''}` : `${months} Month${months > 1 ? 's' : ''}`}
                            </h3>
                            <div className="text-[13px] font-bold text-slate-700 mt-2 truncate bg-primary/10 inline-block px-2 py-0.5 rounded text-primary">
                              {isFullDay ? 'Full Day Access' : `${plan.durationHours} Hrs Daily`}
                            </div>
                          </div>
                          
                          {/* Details list */}
                          <ul className="flex flex-col gap-y-1.5 mt-3 pr-2">
                            <li className="text-[12px] font-medium text-slate-500 flex items-start gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0 mt-1.5"></div>
                              <span className="leading-tight">{plan.validityDays} Days Validity</span>
                            </li>
                            {(plan.discount ?? 0) > 0 && (
                              <li className="text-[12px] font-medium text-slate-500 flex items-start gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0 mt-1.5"></div>
                                <span className="leading-tight"><span className="text-success font-bold">{plan.discount}% OFF</span> applied</span>
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>

                      {/* Divider (Ticket Style) */}
                      <div className={`border-l-[1.5px] border-dashed my-3 transition-colors relative ${isSelected ? 'border-primary/30' : 'border-slate-200 group-hover:border-primary/20'}`}>
                        {/* Ticket notches */}
                        <div className="absolute -top-3 -left-1.5 w-3 h-3 bg-background border-b-[1.5px] border-r-[1.5px] border-transparent rounded-full z-20"></div>
                        <div className="absolute -bottom-3 -left-1.5 w-3 h-3 bg-background border-t-[1.5px] border-r-[1.5px] border-transparent rounded-full z-20"></div>
                      </div>

                      {/* Right Side: Price Block */}
                      <div className={`py-5 pr-5 pl-4 w-[145px] flex flex-col justify-center items-end relative z-10 transition-colors flex-shrink-0 ${isSelected ? 'bg-primary/5' : 'bg-slate-50/50 group-active:bg-slate-100/50'}`}>
                        <div className="text-right">
                          <div className="flex items-baseline justify-end gap-0.5 mb-1.5 truncate w-full">
                            <span className="text-[16px] font-bold text-slate-900">₹</span>
                            <span className="text-[32px] font-black tracking-tighter text-slate-900">{perMonth}</span>
                            {!isDaily && <span className="text-[12px] font-bold text-slate-500">/mo</span>}
                          </div>
                          <div className="text-[12px] font-semibold text-slate-500 leading-tight flex flex-col items-end gap-1 mt-1 truncate w-full">
                            {!isDaily && <span className="truncate w-full text-right">Total ₹{finalPrice.toFixed(0)}</span>}
                            {(plan.discount ?? 0) > 0 && (
                              <span className="line-through opacity-60 text-muted-foreground truncate w-full text-right">₹{plan.price.toFixed(0)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                    </div>
                  );
                  
                })}
                {filteredPlans.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">No plans found.</div>
                )}
              </div>
            </div>

            {/* Seat Selection Inline */}
            {selectedPlan && !isFlexible && (
              <>
                <div className="space-y-3 pt-4 border-t border-border scroll-mt-24" id="seat-section">
                  <label className="text-sm font-bold text-foreground flex justify-between items-center">
                    <span>2. Select a Seat</span>
                  </label>
                </div>
                <div className="mt-2">
                  <LiveSeatMap 
                    library={library}
                    occupiedSeatIds={realtimeOccupiedSeatIds}
                    interactive={true}
                    selectedSeat={selectedSeat}
                    selectedPlan={selectedPlan}
                    compactMode={true}
                    onSeatSelect={(seat) => {
                      const librarySeat = library.seats.find(
                        (candidate) => candidate.id === seat.id,
                      );
                      if (!librarySeat) return;
                      setSelectedSeat(librarySeat);
                      if (seat.hasLocker) {
                        setSelectedStandaloneLockerId("");
                      }
                      setTimeout(() => {
                        const widget = document.getElementById('payment-section');
                        if (widget) window.scrollTo({top: widget.getBoundingClientRect().top + window.pageYOffset - 100, behavior: 'smooth'});
                      }, 100);
                    }}
                  />
                </div>
              </>
            )}

            {/* Premium Seat UI */}
            {selectedPlan && selectedSeat?.type === 'PREMIUM' && (selectedSeat?.premiumPriceDaily ?? 0) > 0 && (
              <div className="p-4 rounded-xl border bg-amber-50 border-amber-200">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm text-amber-700 flex items-center gap-2">Premium Seat Surcharge</span>
                  <span className="font-bold text-sm text-amber-700">+₹{premiumSurcharge.toFixed(0)}</span>
                </div>
              </div>
            )}

            {/* Locker Add-on UI */}
            {selectedPlan && (seatHasMandatoryLocker || library.standaloneLockers?.length > 0) && (
              <div className={`p-4 rounded-xl border ${seatHasMandatoryLocker ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border'} space-y-3`}>
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <Lock className={`w-4 h-4 ${seatHasMandatoryLocker ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1 space-y-2">
                    {seatHasMandatoryLocker ? (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-sm text-foreground">Attached Locker</span>
                          <span className="font-bold text-sm">+₹{lockerCost.toFixed(0)}</span>
                        </div>
                        <p className="text-xs text-foreground/80">
                          Included with this seat.
                        </p>
                      </>
                    ) : (
                      <>
                        {library.standaloneLockers.length > 0 && (
                          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 transition-all">
                            <label className="text-sm font-bold text-primary mb-2 flex items-center justify-between">
                              <div className="flex items-center gap-2"><Lock className="w-4 h-4" /> Optional Locker</div>
                              {selectedStandaloneLockerId && <span className="font-bold text-sm text-primary">+₹{lockerCost.toFixed(0)}</span>}
                            </label>
                            <select 
                              value={selectedStandaloneLockerId}
                              onChange={(e) => setSelectedStandaloneLockerId(e.target.value)}
                              className="w-full text-sm rounded-lg border border-primary/20 bg-background p-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground font-medium"
                            >
                              <option value="">No locker needed</option>
                              {library.standaloneLockers.map((locker) => (
                                <option key={locker.id} value={locker.id}>
                                  {locker.name} - ₹{locker.price}/mo
                                </option>
                              ))}
                            </select>
                            {selectedStandaloneLockerId && (
                              <p className="text-xs text-primary/80 mt-2 font-medium">Locker fee will be added to your total.</p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Payment Mode Selection has been moved to Bottom Sheet */}

            {selectedPlan && (
              <div className="flex justify-between items-center text-sm font-medium mt-4 bg-muted/30 p-4 rounded-xl border border-border">
                <div className="flex flex-col">
                  <span className="text-foreground/70 text-xs uppercase tracking-wider font-bold mb-1">Valid From</span>
                  <span className="text-foreground">{formatStandardDate(startDate)}</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider font-bold mb-1">Valid Till</span>
                  <span className="text-foreground">{formatStandardDate(endDate)}</span>
                </div>
              </div>
            )}

            {/* Dynamic Load State Overlay */}
            {dynamicState.isLoading && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] z-20 flex items-center justify-center rounded-3xl">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}

            {/* Live availability failed to load — block checkout instead of risking a taken seat */}
            {dynamicState.hasError && !dynamicState.isLoading && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive">
                <span>Couldn&apos;t load live seat availability.</span>
                <button
                  onClick={() => loadDynamicData()}
                  className="shrink-0 rounded-lg bg-destructive/20 px-3 py-1.5 font-bold hover:bg-destructive/30 transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            <div id="payment-section" className="mt-4 scroll-mt-24">
              <button 
                onClick={() => setShowPaymentSheet(true)}
                disabled={!selectedPlan || (!isFlexible && !selectedSeat) || isProcessing || dynamicState.isLoading || dynamicState.hasError}
                className="w-full bg-primary text-primary-foreground font-bold text-lg py-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-lg"
              >
                Book Now for ₹{totalAmount.toFixed(0)}
              </button>
            </div>
            
            <p className="text-center text-xs text-muted-foreground mt-2">
              You will be asked to select a payment method next.
            </p>
            {upgradeBookingId && (
              <p className="text-center text-xs font-medium text-primary mt-2">
                A prorated credit for your current active plan will be applied automatically at checkout!
              </p>
            )}
          </div>
        </div>

        <Sheet open={showPaymentSheet} onOpenChange={setShowPaymentSheet}>
          <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh]">
            <SheetHeader className="px-1 text-left pb-4">
              <SheetTitle className="text-2xl font-black">Choose Payment Method</SheetTitle>
              <SheetDescription>
                How would you like to pay ₹{totalAmount.toFixed(0)} for your booking?
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-3 pb-8 px-1">
              <button
                onClick={() => {
                  setPaymentMode("ONLINE");
                  setShowPaymentSheet(false);
                  setTimeout(() => handleCheckout("ONLINE"), 100);
                }}
                className="w-full py-4 px-4 bg-primary text-primary-foreground rounded-2xl font-bold text-lg hover:opacity-90 transition-opacity flex justify-between items-center shadow-md"
              >
                <span>Pay Online-QR Code</span>
                <span className="bg-primary-foreground/20 px-2 py-1 rounded text-sm tracking-widest font-black">₹{totalAmount.toFixed(0)}</span>
              </button>
              <button
                onClick={() => {
                  setPaymentMode("RECEPTION");
                  setShowPaymentSheet(false);
                  setTimeout(() => handleCheckout("RECEPTION"), 100);
                }}
                className="w-full py-4 px-4 bg-muted text-foreground border border-border rounded-2xl font-bold text-lg hover:bg-muted/80 transition-colors flex justify-between items-center"
              >
                <span>Pay at Reception (Cash/Online)</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Left Column 2: Facilities & Map */}
        <div className="order-3 lg:order-none lg:col-span-2 lg:col-start-1 lg:row-start-2 space-y-12">
          <hr className="border-border hidden lg:block facilities-section" />

          {/* Facilities */}
          <section className="facilities-section">
            <h2 className="text-2xl font-bold font-heading tracking-tight mb-6">What this place offers</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-6 gap-x-8">
              {library.facilities.map((fac: string) => (
                <div key={fac} className="flex items-center gap-3 text-foreground font-medium text-sm">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    {getFacilityIcon(fac)}
                  </div>
                  {fac}
                </div>
              ))}
            </div>
          </section>

          <hr className="border-border location-section" />

          {/* Map Location */}
          <section className="location-section">
            <h2 className="text-2xl font-bold font-heading tracking-tight mb-6">Location</h2>
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <iframe 
                src={mapEmbedUrl} 
                width="100%" 
                height="350" 
                style={{ border: 0 }} 
                allowFullScreen={false} 
                loading="lazy" 
                referrerPolicy="no-referrer-when-downgrade"
                className="grayscale hover:grayscale-0 transition-all duration-700"
              />
              <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="font-bold text-foreground text-sm">{library.address}</h3>
                  <p className="text-muted-foreground text-xs mt-1">{library.locality}, {library.city}</p>
                </div>
                <a 
                  href={library.googleMapsUrl || `https://maps.google.com/?q=${encodeURIComponent(library.address)}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-bold text-sm shrink-0 flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                >
                  <Navigation className="w-4 h-4" /> Get Directions
                </a>
              </div>
            </div>
          </section>

          <section className="mt-8 border-t border-border pt-8 feedback-section">
            <h2 className="text-2xl font-black text-foreground mb-4 font-heading flex items-center gap-2">
              Feedback & Support
            </h2>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  if(!dynamicState.studentId) {
                    router.push(`/login?returnUrl=/library/${library.id}`);
                    return;
                  }
                  setFeedbackType("FEEDBACK");
                }}
                className="flex-1 bg-muted/50 hover:bg-muted text-foreground py-4 rounded-xl font-bold text-sm border border-border transition-colors"
              >
                💡 Give Suggestion
              </button>
              <button 
                onClick={() => {
                  if(!dynamicState.studentId) {
                    router.push(`/login?returnUrl=/library/${library.id}`);
                    return;
                  }
                  setFeedbackType("COMPLAINT");
                }}
                className="flex-1 bg-destructive/10 hover:bg-destructive/20 text-destructive py-4 rounded-xl font-bold text-sm border border-destructive/20 transition-colors"
              >
                ⚠️ File Complaint
              </button>
            </div>
          </section>

          <hr className="border-border inquiry-section" />

          {/* Contact / Inquiry */}
          <section className="inquiry-section">
            <InquiryForm libraryId={library.id} />
          </section>

        </div>
      </div>

      {feedbackType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-foreground">
              {feedbackType === "FEEDBACK" ? "Give Suggestion" : "File Complaint"}
            </h3>
            <textarea 
              value={feedbackContent}
              onChange={(e) => setFeedbackContent(e.target.value)}
              placeholder={`Write your ${feedbackType.toLowerCase()} here...`}
              className="w-full h-32 p-3 border border-border rounded-lg bg-input/50 focus:outline-none focus:ring-2 focus:ring-primary mb-4 resize-none text-foreground"
            ></textarea>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => { setFeedbackType(null); setFeedbackContent(""); }}
                className="px-4 py-2 font-bold text-muted-foreground hover:bg-muted rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleFeedbackSubmit}
                disabled={isSubmittingFeedback || !feedbackContent.trim()}
                className="px-4 py-2 font-bold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSubmittingFeedback ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border p-4 z-40 flex justify-between items-center shadow-[0_-4px_20px_-1px_rgba(0,0,0,0.1)]">
        <div>
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {selectedPlan ? "Total Price" : "Starting from"}
          </div>
          <div className="text-lg font-black text-foreground">
            ₹{selectedPlan ? totalAmount : (() => {
              const monthlyPlans = library.plans.filter((plan) => plan.validityDays >= 30);
              const plansToUse = monthlyPlans.length > 0 ? monthlyPlans : library.plans;
              return plansToUse.length > 0
                ? Math.min(...plansToUse.map((plan) => plan.price))
                : 0;
            })()} 
            {!selectedPlan && <span className="text-sm font-medium text-muted-foreground font-sans"> / month</span>}
          </div>
        </div>
        {!selectedPlan ? (
          <button 
            onClick={() => scrollToSection('plans-section', 'start')} 
            className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl hover:opacity-90 shadow-lg"
          >
            Select Plan
          </button>
        ) : (!isFlexible && !selectedSeat) ? (
          <button 
            onClick={() => {
              scrollToSection('seat-section', 'start');
              import('react-hot-toast').then(({ default: toast }) => {
                toast("Please select a seat first", { icon: "💺" });
              });
            }} 
            className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl hover:opacity-90 shadow-lg"
          >
            Select Seat
          </button>
        ) : (
          <button 
            onClick={() => setShowPaymentSheet(true)}
            disabled={isProcessing || dynamicState.isLoading || dynamicState.hasError}
            className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl hover:opacity-90 shadow-lg flex items-center gap-2 disabled:opacity-50"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isProcessing ? "Processing..." : "Book Now"}
          </button>
        )}
      </div>

    </div>
  )
}
