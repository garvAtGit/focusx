"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import { Search, Loader2, User, CheckCircle2, Calendar, Banknote, XCircle, Briefcase, Users, Armchair, AlertCircle, Edit2 } from 'lucide-react'
import { revokeBooking, updateBookingStartDate, getLibraryContext } from "@/app/actions/student-actions"
import { executeBookingWorkflowAction } from "@/app/actions/booking-actions"
import toast from "react-hot-toast"
import { PlanCard } from "../PlanCard"
import { useBookingWorkflow } from "@/app/(student)/student/dashboard/useBookingWorkflow"
import type { BookingDraft } from "@/lib/booking-engine/types"
import { useStudentSearch } from "./useStudentSearch"
import { parseCommand } from "./parser"
import { initializeApp, getApps } from "firebase/app"
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth"
import { firebaseConfig } from "@/lib/firebase/clientApp"
import { getStudentByPhoneOrAuthId, addStudentProfile } from "@/app/actions/student-actions"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

type RecaptchaWindow = Window & {
  recaptchaVerifier?: RecaptchaVerifier
}

type CommandPlan = {
  id: string
  name: string
  validityDays: number
  durationHours: number | null
  price: number
  discount?: number | null
}

type CommandBooking = {
  id: string
  planId: string
  seatId: string | null
  startTime: string | Date
  endTime: string | Date
  status: string
  plan: CommandPlan
  seat?: { id: string; name: string } | null
}

export type CommandStudent = {
  id: string
  name: string
  phone: string | null
  uniqueId: string | null
  bookings: CommandBooking[]
}

type StudentSearchResponse = {
  students?: CommandStudent[]
}

type ViewState = 
  | 'HOME' 
  | 'SEARCH_STUDENT' 
  | 'REVOKE_CONFIRM'
  | 'CHANGE_DATE_INPUT'
  | 'WORKFLOW_ENGINE'
  | 'ADD_STUDENT_OTP'
  | 'ADD_STUDENT_PROFILE';

type CommandContext = {
  action: 'NEW_BOOKING' | 'RENEW' | 'REVOKE' | 'CHANGE_DATE' | null;
  student: CommandStudent | null;
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()


  const [viewStack, setViewStack] = React.useState<ViewState[]>(['HOME'])
  const activeView = viewStack[viewStack.length - 1]

  const [context, setContext] = React.useState<CommandContext>({
    action: null,
    student: null,
  })

  const [searchQuery, setSearchQuery] = React.useState("")
  const parsed = React.useMemo(() => parseCommand(searchQuery), [searchQuery])
  const { results: students, isLoading: isSearching } = useStudentSearch(parsed.studentQuery)
  const [isExecuting, setIsExecuting] = React.useState(false)
  const [libraryId, setLibraryId] = React.useState<string | null>(null)
  const [newStartDate, setNewStartDate] = React.useState<string>("")

  // OTP Verification States
  const [phone, setPhone] = React.useState("+91 ")
  const [otp, setOtp] = React.useState("")
  const [otpLoading, setOtpLoading] = React.useState(false)
  const [verificationObj, setVerificationObj] = React.useState<ConfirmationResult | null>(null)
  const [verifiedAuthId, setVerifiedAuthId] = React.useState<string | null>(null)
  const [studentFormData, setStudentFormData] = React.useState({
    name: "",
    email: "",
    dob: "",
    gender: "",
    address: "",
    isKycVerified: false
  });
  const [addingStudent, setAddingStudent] = React.useState(false)

  // Fetch library context once
  React.useEffect(() => {
    if (open && !libraryId) {
      getLibraryContext().then(res => {
        if (res.libraryId) setLibraryId(res.libraryId)
      })
    }
  }, [open, libraryId])

  // Booking Engine hook (local evaluation)
  const engine = useBookingWorkflow({
    operation: context.action === 'RENEW' ? 'RENEW' : context.action === 'NEW_BOOKING' ? 'ADD_STUDENT' : undefined,
    libraryId: libraryId || undefined,
    studentId: context.student?.id,
    sourceBookingId: context.student?.bookings?.[0]?.id,
  })

  // Start workflow
  const hasInitializedWorkflow = React.useRef(false);
  React.useEffect(() => {
    if (activeView === 'WORKFLOW_ENGINE' && !hasInitializedWorkflow.current) {
      hasInitializedWorkflow.current = true;
      if (context.action === 'RENEW' && context.student?.bookings?.[0]) {
         engine.updateDraft({ 
           planId: context.student.bookings[0].planId,
           seatId: context.student.bookings[0].seatId || null
         });
      }
    }
    // Reset if we leave the workflow engine
    if (activeView !== 'WORKFLOW_ENGINE') {
      hasInitializedWorkflow.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, context.action, context.student, engine.updateDraft])

  const handleSendOTP = async () => {
    try {
      setOtpLoading(true);
      const secondaryApp = getApps().find(app => app.name === 'Secondary') || initializeApp(firebaseConfig, 'Secondary');
      const secondaryAuth = getAuth(secondaryApp);
      
      const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      const recaptchaWindow = window as RecaptchaWindow;
      
      if (recaptchaWindow.recaptchaVerifier) {
        try { recaptchaWindow.recaptchaVerifier.clear(); } catch {}
        recaptchaWindow.recaptchaVerifier = undefined;
      }
      
      const appVerifier = new RecaptchaVerifier(secondaryAuth, 'recaptcha-container', { size: 'invisible' });
      recaptchaWindow.recaptchaVerifier = appVerifier;
      
      const confirmation = await signInWithPhoneNumber(secondaryAuth, formattedPhone, appVerifier);
      
      setVerificationObj(confirmation);
      toast.success('OTP sent successfully!');
    } catch (error: unknown) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to send OTP");
    } finally {
      setOtpLoading(false);
    }
  }

  const handleVerifyOTP = async () => {
    try {
      setOtpLoading(true);
      const result = await verificationObj!.confirm(otp);
      setVerifiedAuthId(result.user.uid);
      const secondaryAuth = getAuth(getApps().find(app => app.name === 'Secondary')!);
      await secondaryAuth.signOut();
      
      const existingStudent = await getStudentByPhoneOrAuthId(result.user.uid, phone);
      if (existingStudent) {
        setStudentFormData({
          name: existingStudent.name || "",
          email: existingStudent.email || "",
          dob: existingStudent.dob || "",
          gender: existingStudent.gender || "",
          address: existingStudent.address || "",
          isKycVerified: existingStudent.digilockerVerified || false
        });
        if (existingStudent.digilockerVerified) toast.success("Found verified profile!");
        else toast.success("Found existing profile!");
      } else {
        toast.success("Phone verified!");
      }
      setViewStack([...viewStack, 'ADD_STUDENT_PROFILE']);
    } catch (error: unknown) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Invalid OTP");
    } finally {
      setOtpLoading(false);
    }
  }

  const handleAddStudentSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!verifiedAuthId) return;
    setAddingStudent(true);
    try {
      const formData = new FormData(e.currentTarget);
      formData.set("authId", verifiedAuthId);
      formData.set("phone", phone);
      
      // Browser omits disabled inputs from FormData.
      // Since this is a controlled form, we guarantee all values by appending them from state.
      formData.set("name", studentFormData.name);
      formData.set("email", studentFormData.email);
      formData.set("dob", studentFormData.dob);
      formData.set("gender", studentFormData.gender);
      formData.set("address", studentFormData.address);

      const res = await addStudentProfile(formData);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Student profile saved!");
      
      // Setup the context for a NEW_BOOKING and push to WORKFLOW_ENGINE
      setContext({
        action: 'NEW_BOOKING',
        student: {
          id: res.studentId!,
          name: studentFormData.name,
          phone,
          uniqueId: null,
          bookings: []
        }
      });
      setViewStack([...viewStack, 'WORKFLOW_ENGINE']);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create student");
    } finally {
      setAddingStudent(false);
    }
  }

  // Global hotkey
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  // Reset state on close
  React.useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setViewStack(['HOME'])
        setContext({ action: null, student: null })
        setSearchQuery("")
        setNewStartDate("")
        engine.updateDraft({ planId: undefined, seatId: undefined, attachedLockerSelected: undefined, paymentMethod: undefined })
      }, 300)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const pushView = (view: ViewState) => {
    setSearchQuery("")
    setViewStack([...viewStack, view])
  }

  const popView = () => {
    if (viewStack.length > 1) {
      setSearchQuery("")
      setViewStack(viewStack.slice(0, -1))
    }
  }



  // --- Actions ---
  const handleStartRenew = () => {
    setContext({ action: 'RENEW', student: null })
    pushView('SEARCH_STUDENT')
  }

  const handleStartRevoke = () => {
    setContext({ action: 'REVOKE', student: null })
    pushView('SEARCH_STUDENT')
  }

  const handleStartChangeDate = () => {
    setContext({ action: 'CHANGE_DATE', student: null })
    pushView('SEARCH_STUDENT')
  }

  const executeRevoke = async () => {
    if (!context.student) return;
    setIsExecuting(true);
    const activeBooking = context.student.bookings[0];
    try {
      const res = await revokeBooking(activeBooking.id, "Revoked via Command Palette");
      if (res.error) toast.error(res.error);
      else { toast.success("Access revoked"); setOpen(false); router.refresh(); }
    } catch { toast.error("Failed to revoke"); }
    setIsExecuting(false);
  }

  const executeChangeDate = async () => {
    if (!context.student || !newStartDate) return;
    setIsExecuting(true);
    const activeBooking = context.student.bookings[0];
    try {
      const res = await updateBookingStartDate(activeBooking.id, new Date(newStartDate));
      if (res.error) toast.error(res.error);
      else { toast.success("Start date updated"); setOpen(false); router.refresh(); }
    } catch { toast.error("Failed to update date"); }
    setIsExecuting(false);
  }

  const executeWorkflow = async () => {
    if (engine.workflowState?.status !== 'READY' || !context.student) return;
    setIsExecuting(true);
    try {
      const res = await executeBookingWorkflowAction(engine.draft as BookingDraft);
      if (res.error) toast.error(res.error);
      else { toast.success("Workflow executed successfully"); setOpen(false); router.refresh(); }
    } catch { toast.error("Failed to execute workflow"); }
    setIsExecuting(false);
  }

  if (!open) return null

  // --- Generic Requirement Rendering ---
  const renderEngineRequirements = () => {
    if (engine.isEvaluating) {
      return (
        <Command.Empty className="py-6 flex flex-col items-center text-sm text-muted-foreground">
           <Loader2 className="h-6 w-6 animate-spin mb-2" />
           Evaluating rules...
        </Command.Empty>
      );
    }
    
    if (engine.workflowState?.status === 'BLOCKED') {
       return (
         <Command.Group heading="Error" className="px-2">
            <div className="p-4 bg-destructive/10 text-destructive rounded flex items-start gap-2">
               <AlertCircle className="w-5 h-5 mt-0.5" />
               <div className="text-sm">
                 <strong>{engine.workflowState.errorCode}</strong>
                 <p className="mt-1 opacity-90">{engine.workflowState.userFacingExplanation}</p>
               </div>
            </div>
         </Command.Group>
       )
    }

    if (engine.workflowState?.status === 'READY') {
       // Payment method is a UI/operational step, not a policy concern.
       // Ask for it here before allowing execution.
       if (!engine.draft.paymentMethod) {
         return (
           <Command.Group heading="Select Payment Method" className="px-2">
             <Command.Item
               onSelect={() => engine.updateDraft({ paymentMethod: 'CASH' })}
               className="relative flex cursor-pointer select-none items-center rounded-md px-3 py-3 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground mb-1"
             >
               <Banknote className="mr-3 h-4 w-4 text-emerald-500" />
               <span className="font-medium">Cash</span>
             </Command.Item>
             <Command.Item
               onSelect={() => engine.updateDraft({ paymentMethod: 'ONLINE' })}
               className="relative flex cursor-pointer select-none items-center rounded-md px-3 py-3 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
             >
               <Banknote className="mr-3 h-4 w-4 text-blue-500" />
               <span className="font-medium">Online (UPI/Card)</span>
             </Command.Item>
           </Command.Group>
         )
       }

       return (
         <Command.Group heading="Ready to Execute" className="px-2">
            <Command.Item
              onSelect={executeWorkflow}
              className="relative flex cursor-pointer select-none items-center justify-center rounded-md px-2 py-3 text-sm font-medium outline-none aria-selected:bg-primary aria-selected:text-primary-foreground text-primary-foreground bg-primary mt-4 mb-2"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              <span>Confirm & Execute</span>
            </Command.Item>
            {(!engine.draft.attachedLockerSelected && !engine.draft.standaloneLockerId && (engine.facts?.standaloneLockers.length ?? 0) > 0) && (
              <Command.Item
                onSelect={() => engine.updateDraft({ wantsStandaloneLocker: true })}
                className="relative flex cursor-pointer select-none items-center justify-center rounded-md px-2 py-3 text-sm font-medium outline-none aria-selected:bg-secondary aria-selected:text-secondary-foreground text-secondary-foreground bg-secondary border border-border"
              >
                <Briefcase className="mr-2 h-4 w-4" />
                <span>Add Optional Locker</span>
              </Command.Item>
            )}
         </Command.Group>
       )
    }

    if (engine.workflowState?.status === 'NEEDS_INPUT') {
      const field = engine.workflowState.requiredFields[0];
      
      if (field === 'planId') {
        return (
          <Command.Group heading="Select Plan" className="px-2">
             {engine.facts?.activePlans.map(plan => (
               <Command.Item
                 key={plan.id}
                 value={plan.name}
                 onSelect={() => engine.updateDraft({ planId: plan.id })}
                 className="group mb-2 cursor-pointer outline-none block p-0 bg-transparent data-[selected=true]:bg-transparent"
               >
                 <PlanCard plan={plan as unknown as CommandPlan} />
               </Command.Item>
             ))}
          </Command.Group>
        )
      }

      if (field === 'seatId') {
        return (
          <Command.Group heading="Select Seat" className="px-2">
             {engine.facts?.eligibleSeats.map(seat => {
               const isAvail = engine.facts?.seatAvailabilitySnapshot[seat.id] ?? true;
               return (
                 <Command.Item
                   key={seat.id}
                   value={seat.name}
                   disabled={!isAvail}
                   onSelect={() => engine.updateDraft({ seatId: seat.id })}
                   className="relative flex cursor-pointer select-none items-center rounded-md px-3 py-3 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled=true]:opacity-50 data-[disabled=true]:cursor-not-allowed border border-transparent aria-selected:border-border mb-1"
                 >
                   <Armchair className="w-4 h-4 mr-3" />
                   <div className="flex-1 text-left">
                     <span className="font-medium">{seat.name}</span>
                     {seat.hasLocker && <span className="ml-2 text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">Has Locker</span>}
                   </div>
                   {!isAvail && <span className="text-xs text-destructive">Occupied</span>}
                 </Command.Item>
               )
             })}
          </Command.Group>
        )
      }

      if (field === 'attachedLockerSelected') {
        return (
          <Command.Group heading="Do you want the attached locker?" className="px-2">
             <Command.Item
               onSelect={() => engine.updateDraft({ attachedLockerSelected: true })}
               className="relative flex cursor-pointer select-none items-center rounded-md px-3 py-3 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground mb-1"
             >
               <CheckCircle2 className="w-4 h-4 mr-3 text-emerald-500" />
               <span className="font-medium">Yes, include locker</span>
             </Command.Item>
             <Command.Item
               onSelect={() => engine.updateDraft({ attachedLockerSelected: false })}
               className="relative flex cursor-pointer select-none items-center rounded-md px-3 py-3 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
             >
               <XCircle className="w-4 h-4 mr-3 text-destructive" />
               <span className="font-medium">No, skip locker</span>
             </Command.Item>
          </Command.Group>
        )
      }

      if (field === 'standaloneLockerId') {
        return (
          <Command.Group heading="Select Standalone Locker" className="px-2">
             {engine.facts?.standaloneLockers.map(locker => {
               const isAvail = engine.facts?.resourceAvailability[`STANDALONE_LOCKER:${locker.id}`] ?? true;
               return (
                 <Command.Item
                   key={locker.id}
                   value={locker.name}
                   disabled={!isAvail}
                   onSelect={() => engine.updateDraft({ standaloneLockerId: locker.id })}
                   className="relative flex cursor-pointer select-none items-center rounded-md px-3 py-3 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled=true]:opacity-50 data-[disabled=true]:cursor-not-allowed border border-transparent aria-selected:border-border mb-1"
                 >
                   <Briefcase className="w-4 h-4 mr-3" />
                   <div className="flex-1 text-left">
                     <span className="font-medium">{locker.name}</span>
                   </div>
                   {!isAvail && <span className="text-xs text-destructive">Occupied</span>}
                 </Command.Item>
               )
             })}
             <Command.Item
               onSelect={() => engine.updateDraft({ wantsStandaloneLocker: false, standaloneLockerId: undefined })}
               className="relative flex cursor-pointer select-none items-center rounded-md px-3 py-3 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground mt-2 border border-border/50"
             >
               <XCircle className="w-4 h-4 mr-3 text-muted-foreground" />
               <span className="font-medium text-muted-foreground">Cancel Add Locker</span>
             </Command.Item>
          </Command.Group>
        )
      }
    }
  }

  // --- Visualizer Right Pane ---
  const renderVisualizerPane = () => {
    if (activeView === 'HOME' || activeView === 'SEARCH_STUDENT') {
      if (context.student) {
        return (
          <div className="flex flex-col h-full items-center justify-center text-center p-4">
             <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
               <User className="w-8 h-8 text-muted-foreground" />
             </div>
             <h3 className="font-semibold text-lg">{context.student.name}</h3>
             <p className="text-sm text-muted-foreground mb-4">{context.student.phone} • {context.student.uniqueId}</p>
             {context.student.bookings[0] && (
                <div className="w-full text-left bg-background border border-border rounded p-3">
                   <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Active Booking</p>
                   <PlanCard plan={context.student.bookings[0].plan} />
                </div>
             )}
          </div>
        )
      }
      return (
        <div className="flex flex-col h-full items-center justify-center text-center p-4 opacity-50">
           <Search className="w-12 h-12 text-muted-foreground mb-4" />
           <p className="text-sm">Search for a student to view details and available actions.</p>
        </div>
      )
    }

    if (activeView === 'WORKFLOW_ENGINE') {
      const state = engine.workflowState;
      const isReady = state?.status === 'READY';

      return (
        <div className="flex flex-col h-full p-2">
           <h3 className="font-semibold mb-4 text-lg">Booking Context</h3>
           
           <div className="space-y-4">
              {/* Student Context */}
              {context.student && (
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                   <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                     <User className="w-5 h-5 text-muted-foreground" />
                   </div>
                   <div>
                     <p className="font-medium text-sm">{context.student.name}</p>
                     <p className="text-xs text-muted-foreground">Action: {context.action}</p>
                   </div>
                </div>
              )}

              {/* Draft State */}
              <div className="space-y-2">
                <div 
                  className="flex justify-between text-sm group cursor-pointer hover:bg-accent hover:text-accent-foreground p-1 -mx-1 rounded"
                  onClick={() => engine.updateDraft({ planId: undefined, seatId: undefined, attachedLockerSelected: undefined, paymentMethod: undefined })}
                >
                   <span className="text-muted-foreground group-hover:text-accent-foreground flex items-center gap-1">Plan <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100" /></span>
                   <span className="font-medium text-right max-w-[150px] truncate" title={engine.facts?.activePlans.find(p => p.id === engine.draft.planId)?.name}>
                     {engine.facts?.activePlans.find(p => p.id === engine.draft.planId)?.name || 'Pending...'}
                   </span>
                </div>
                <div 
                  className="flex justify-between text-sm group cursor-pointer hover:bg-accent hover:text-accent-foreground p-1 -mx-1 rounded"
                  onClick={() => engine.updateDraft({ seatId: undefined, attachedLockerSelected: undefined, paymentMethod: undefined })}
                >
                   <span className="text-muted-foreground group-hover:text-accent-foreground flex items-center gap-1">Seat <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100" /></span>
                   <span className="font-medium">{engine.facts?.eligibleSeats.find(s => s.id === engine.draft.seatId)?.name || 'Pending...'}</span>
                </div>
                <div 
                  className="flex justify-between text-sm group cursor-pointer hover:bg-accent hover:text-accent-foreground p-1 -mx-1 rounded"
                  onClick={() => engine.updateDraft({ attachedLockerSelected: undefined, paymentMethod: undefined })}
                >
                   <span className="text-muted-foreground group-hover:text-accent-foreground flex items-center gap-1">Locker <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100" /></span>
                   <span className="font-medium">
                     {engine.draft.attachedLockerSelected === true ? 'Yes' : 
                      engine.draft.attachedLockerSelected === false ? 'No' : 'Pending...'}
                   </span>
                </div>
                {engine.draft.paymentMethod && (
                  <div 
                    className="flex justify-between text-sm group cursor-pointer hover:bg-accent hover:text-accent-foreground p-1 -mx-1 rounded"
                    onClick={() => engine.updateDraft({ paymentMethod: undefined })}
                  >
                     <span className="text-muted-foreground group-hover:text-accent-foreground flex items-center gap-1">Payment <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100" /></span>
                     <span className="font-medium">{engine.draft.paymentMethod}</span>
                  </div>
                )}
              </div>

              {/* Preview Block */}
              {isReady && state && (
                <div className="mt-6 pt-4 border-t border-border bg-emerald-500/5 rounded-lg p-4 border-emerald-500/20 border">
                   <p className="text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold mb-3">Live Preview</p>
                   
                   <div className="flex justify-between text-sm mb-2">
                     <span className="text-muted-foreground">Start</span>
                     <span className="font-medium">{new Date(state.dates.startsAt).toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-muted-foreground flex items-center gap-2"><Calendar className="w-4 h-4"/> Ends</span>
                     <span className="font-medium">{new Date(state.dates.endsAt).toLocaleString()}</span>
                   </div>
                   
                   <div className="flex justify-between items-center pt-3 border-t border-emerald-500/10">
                     <span className="font-semibold text-foreground">Total</span>
                     <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">₹{(state.amountPaise / 100).toFixed(2)}</span>
                   </div>
                </div>
              )}

              {/* Input Prompt */}
              {state?.status === 'NEEDS_INPUT' && (
                <div className="mt-6 pt-4 border-t border-border">
                   <p className="text-sm font-medium text-blue-500 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      Awaiting {state.requiredFields[0]}
                   </p>
                </div>
              )}
           </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col h-full p-2 opacity-50">
        <h3 className="font-semibold mb-4 text-lg">Action Detail</h3>
        <p className="text-sm">{activeView}</p>
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm transition-all duration-100 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:animate-in data-[state=open]:fade-in" />
      
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[5vh] sm:pt-[10vh]">
        <div className="w-full max-w-5xl px-4 flex flex-col md:flex-row h-[80vh] md:h-[65vh] overflow-hidden shadow-2xl rounded-xl border border-border bg-card">
          
          {/* LEFT PANE - Registry / Input */}
          <Command
            className="flex-1 md:w-[60%] flex flex-col overflow-hidden bg-card text-card-foreground border-none ring-0 outline-none"
            loop
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !searchQuery && viewStack.length > 1) {
                e.preventDefault()
                popView()
              }
            }}
          >
            <div className="flex items-center border-b border-border px-3 shrink-0 bg-background/50 backdrop-blur">
              {isExecuting || isSearching ? <Loader2 className="mr-2 h-4 w-4 shrink-0 opacity-50 animate-spin" /> : <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />}
              <Command.Input 
                autoFocus
                value={searchQuery}
                onValueChange={setSearchQuery}
                className="flex h-14 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50" 
                placeholder={
                  activeView === 'HOME' ? "Type a command or search students..." : 
                  activeView === 'SEARCH_STUDENT' ? "Search student by name or phone..." :
                  activeView === 'WORKFLOW_ENGINE' ? "Select an option..." :
                  "Press Enter to confirm..."
                } 
                disabled={isExecuting || engine.workflowState?.status === 'READY'}
              />
              <div className="ml-2 text-[10px] text-muted-foreground font-medium px-1.5 py-0.5 rounded border border-border bg-muted/50 tracking-widest whitespace-nowrap">
                {viewStack.length > 1 ? "BACKSPACE" : "ESC"}
              </div>
            </div>
            
            <Command.List className="flex-1 overflow-y-auto overflow-x-hidden p-2 bg-card">
              <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                {isSearching ? "Searching..." : "No results found."}
              </Command.Empty>
              
              {/* --- VIEW: HOME (Default Options) --- */}
              {activeView === 'HOME' && parsed.studentQuery.length < 2 && (
                <>
                  <Command.Group heading="Enrollment">
                    <Command.Item
                      onSelect={() => {
                        setContext({ action: 'NEW_BOOKING', student: null });
                        setViewStack([...viewStack, 'ADD_STUDENT_OTP']);
                      }}
                      className="flex cursor-pointer select-none items-center rounded-md px-3 py-3 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-emerald-500/10 text-emerald-600 mr-3">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">Enroll New Student</div>
                        <div className="text-xs text-muted-foreground">Verify phone and create profile</div>
                      </div>
                    </Command.Item>
                  </Command.Group>
                  <Command.Group heading="Student Actions" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    <Command.Item
                      keywords={['renew', 'extend', 'subscribe', 'upgrade']}
                      onSelect={handleStartRenew}
                      className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
                    >
                      <Banknote className="mr-2 h-4 w-4 text-emerald-500" />
                      <span>Renew Plan</span>
                    </Command.Item>
                    <Command.Item
                      keywords={['date', 'startdate', 'changedate']}
                      onSelect={handleStartChangeDate}
                      className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground mt-1"
                    >
                      <Calendar className="mr-2 h-4 w-4 text-blue-500" />
                      <span>Change Start Date</span>
                    </Command.Item>
                    <Command.Item
                      keywords={['revoke', 'cancel', 'remove']}
                      onSelect={handleStartRevoke}
                      className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground mt-1"
                    >
                      <XCircle className="mr-2 h-4 w-4 text-red-500" />
                      <span>Revoke Access</span>
                    </Command.Item>
                  </Command.Group>
                  <Command.Group heading="Navigation" className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-t border-border mt-2">
                    <Command.Item onSelect={() => { setOpen(false); router.push("/dashboard") }} className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"><Briefcase className="mr-2 h-4 w-4" /><span>Dashboard Overview</span></Command.Item>
                    <Command.Item onSelect={() => { setOpen(false); router.push("/dashboard/students") }} className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"><Users className="mr-2 h-4 w-4" /><span>Students</span></Command.Item>
                    <Command.Item onSelect={() => { setOpen(false); router.push("/dashboard/seats") }} className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"><Armchair className="mr-2 h-4 w-4" /><span>Manage Seats</span></Command.Item>
                  </Command.Group>
                </>
              )}

              {/* --- VIEW: SEARCH_STUDENT (or Live Parsing in HOME) --- */}
              {(activeView === 'SEARCH_STUDENT' || (activeView === 'HOME' && parsed.studentQuery.length >= 2)) && (
                <Command.Group heading={parsed.action ? `Select Student for ${parsed.action}` : context.action ? `Select Student for ${context.action}` : "Select Student"} className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  {students.map((student) => (
                    <Command.Item
                      key={student.id}
                      value={student.name + " " + (student.uniqueId || "") + " " + (student.phone || "")}
                      onSelect={() => {
                        const nextAction = parsed.action || context.action;
                        if (!nextAction) {
                           // If no action selected yet, just set student and we'd ideally prompt for action. 
                           // For now, assume RENEW if no action is specified, as a default shortcut
                           setContext({ action: 'RENEW', student })
                           engine.updateDraft(parsed.draftUpdates)
                           setViewStack([...viewStack, 'WORKFLOW_ENGINE'])
                        } else {
                           setContext({ action: nextAction, student })
                           engine.updateDraft(parsed.draftUpdates)
                           if (nextAction === 'RENEW') setViewStack([...viewStack, 'WORKFLOW_ENGINE'])
                           else if (nextAction === 'REVOKE') setViewStack([...viewStack, 'REVOKE_CONFIRM'])
                           else if (nextAction === 'CHANGE_DATE') setViewStack([...viewStack, 'CHANGE_DATE_INPUT'])
                        }
                      }}
                      className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground mb-1"
                    >
                      <User className="mr-3 h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">{student.name}</span>
                          {student.uniqueId && <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{student.uniqueId}</span>}
                        </div>
                        {student.bookings?.[0] ? (
                          <div className="text-xs mt-0.5 text-muted-foreground">
                            Active: {student.bookings[0].plan.name} {student.bookings[0].seat ? `(${student.bookings[0].seat.name})` : ''}
                          </div>
                        ) : (
                          <div className="text-xs mt-0.5 text-muted-foreground">No active bookings</div>
                        )}
                      </div>
                    </Command.Item>
                  ))}
                  {isSearching && (
                    <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Searching...
                    </div>
                  )}
                  {!isSearching && students.length === 0 && parsed.studentQuery.length >= 2 && (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No students found matching &quot;{parsed.studentQuery}&quot;
                    </div>
                  )}
                </Command.Group>
              )}

              {/* --- VIEW: WORKFLOW_ENGINE (Powered by pure BookingEngine) --- */}
              {activeView === 'WORKFLOW_ENGINE' && renderEngineRequirements()}

              {/* --- VIEW: ADD_STUDENT_OTP --- */}
              {activeView === 'ADD_STUDENT_OTP' && (
                <div className="p-6">
                  <h3 className="font-semibold mb-4 text-lg">Verify Phone Number</h3>
                  <div id="recaptcha-container"></div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <div className="flex gap-2">
                        <Input 
                          value={phone} 
                          onChange={e => setPhone(e.target.value)} 
                          placeholder="+91 "
                          disabled={!!verificationObj}
                        />
                        {!verificationObj && (
                          <Button onClick={handleSendOTP} disabled={otpLoading || phone.length < 10}>
                            {otpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send OTP"}
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {verificationObj && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        <Label>Enter OTP</Label>
                        <div className="flex gap-2">
                          <Input 
                            value={otp} 
                            onChange={e => setOtp(e.target.value)} 
                            placeholder="123456" 
                            maxLength={6} 
                          />
                          <Button onClick={handleVerifyOTP} disabled={otpLoading || otp.length < 6}>
                            {otpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* --- VIEW: ADD_STUDENT_PROFILE --- */}
              {activeView === 'ADD_STUDENT_PROFILE' && (
                <div className="p-6 max-h-[400px] overflow-y-auto">
                  <h3 className="font-semibold mb-4 text-lg">Student Profile</h3>
                  <form onSubmit={handleAddStudentSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Full Legal Name * {studentFormData.isKycVerified && <span className="text-xs bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded">Verified</span>}</Label>
                      <Input 
                        name="name" 
                        value={studentFormData.name} 
                        onChange={e => setStudentFormData(s => ({...s, name: e.target.value}))} 
                        disabled={studentFormData.isKycVerified}
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email (Optional)</Label>
                      <Input 
                        type="email" 
                        name="email" 
                        value={studentFormData.email} 
                        onChange={e => setStudentFormData(s => ({...s, email: e.target.value}))} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date of Birth (Optional)</Label>
                      <Input 
                        type="date" 
                        name="dob" 
                        value={studentFormData.dob} 
                        onChange={e => setStudentFormData(s => ({...s, dob: e.target.value}))} 
                        disabled={studentFormData.isKycVerified}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Gender (Optional)</Label>
                      <Select 
                        name="gender" 
                        value={studentFormData.gender || undefined} 
                        onValueChange={v => setStudentFormData(s => ({...s, gender: v || ""}))}
                        disabled={studentFormData.isKycVerified}
                      >
                        <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MALE">Male</SelectItem>
                          <SelectItem value="FEMALE">Female</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      {studentFormData.isKycVerified && <input type="hidden" name="gender" value={studentFormData.gender} />}
                    </div>
                    <div className="space-y-2">
                      <Label>Address (Optional)</Label>
                      <Input 
                        name="address" 
                        value={studentFormData.address} 
                        onChange={e => setStudentFormData(s => ({...s, address: e.target.value}))} 
                        disabled={studentFormData.isKycVerified}
                      />
                    </div>
                    
                    <Button type="submit" className="w-full mt-4" disabled={addingStudent}>
                      {addingStudent ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Save Profile & Assign Plan
                    </Button>
                  </form>
                </div>
              )}

              {/* --- VIEW: REVOKE_CONFIRM --- */}
              {activeView === 'REVOKE_CONFIRM' && context.student && (
                <Command.Group heading="Confirm Action" className="px-2">
                  <Command.Item
                    onSelect={executeRevoke}
                    className="relative flex cursor-pointer select-none items-center justify-center rounded-md px-2 py-3 text-sm font-medium outline-none aria-selected:bg-destructive aria-selected:text-destructive-foreground text-destructive-foreground bg-destructive mt-4"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    <span>Execute Revocation</span>
                  </Command.Item>
                </Command.Group>
              )}

              {/* --- VIEW: CHANGE_DATE_INPUT --- */}
              {activeView === 'CHANGE_DATE_INPUT' && context.student && (
                <Command.Group heading="Change Start Date" className="px-2">
                  <div className="p-4">
                    <label className="text-sm font-medium text-foreground">New Start Date</label>
                    <input 
                      type="date"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
                      value={newStartDate}
                      onChange={(e) => setNewStartDate(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') executeChangeDate();
                      }}
                      autoFocus
                    />
                  </div>
                  <Command.Item
                    onSelect={executeChangeDate}
                    className="relative flex cursor-pointer select-none items-center justify-center rounded-md px-2 py-3 text-sm font-medium outline-none aria-selected:bg-primary aria-selected:text-primary-foreground text-primary-foreground bg-primary"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    <span>Confirm Date Change</span>
                  </Command.Item>
                </Command.Group>
              )}
            </Command.List>
          </Command>
          
          {/* RIGHT PANE - Visualizer (Desktop) */}
          <div className="hidden md:flex md:w-[40%] border-l border-border bg-muted/30 flex-col overflow-y-auto">
             {renderVisualizerPane()}
          </div>

          {/* BOTTOM PANE - Visualizer (Mobile) */}
          <div className="md:hidden border-t border-border bg-muted/30 max-h-[35vh] overflow-y-auto">
             {renderVisualizerPane()}
          </div>

        </div>
      </div>
    </>
  )
}
