'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createTicketAction } from '@/app/actions/ticket-actions';
import { TicketCategory, TicketPriority } from '@prisma/client';
import {
  Wrench,
  CreditCard,
  Users,
  Smartphone,
  ShieldCheck,
  HelpCircle,
  AlertCircle,
  Loader2,
  Cpu,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface RelayItem {
  id: string;
  nfcTagId: string;
  macAddress: string | null;
  status: string;
}

interface RaiseTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  libraryId: string;
  libraryName: string;
  relays: RelayItem[];
}

const CATEGORIES: {
  value: TicketCategory;
  label: string;
  icon: typeof Wrench;
  description: string;
}[] = [
  {
    value: 'HARDWARE',
    label: 'Hardware & Scanner',
    icon: Wrench,
    description: 'RFID reader, turnstile, lock relay, ESP32, or BLE scanning issues',
  },
  {
    value: 'BILLING_PAYOUTS',
    label: 'Billing & Payouts',
    icon: CreditCard,
    description: 'Settlements, student Razorpay payments, fee discrepancies, invoices',
  },
  {
    value: 'STUDENTS_BOOKINGS',
    label: 'Students & Bookings',
    icon: Users,
    description: 'Seat allocations, manual check-ins, overstays, booking disputes',
  },
  {
    value: 'APP_SOFTWARE',
    label: 'Portal & App Glitch',
    icon: Smartphone,
    description: 'Bug on web dashboard, student mobile app error, UI glitches',
  },
  {
    value: 'KYC_VERIFICATION',
    label: 'KYC & Bank Details',
    icon: ShieldCheck,
    description: 'Bank passbook update, owner identity verification, library profile',
  },
  {
    value: 'OTHER',
    label: 'General Inquiry / Other',
    icon: HelpCircle,
    description: 'General support, suggestions, questions, account help',
  },
];

export function RaiseTicketModal({
  isOpen,
  onClose,
  libraryId,
  libraryName,
  relays,
}: RaiseTicketModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TicketCategory>('HARDWARE');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [selectedDeviceMac, setSelectedDeviceMac] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error('Please enter a ticket title and description.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createTicketAction({
        libraryId,
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        deviceMac: category === 'HARDWARE' && selectedDeviceMac ? selectedDeviceMac : undefined,
      });

      if (res.success && res.ticketId) {
        toast.success(`Ticket #FX-${res.ticketNumber} created successfully! Our engineering team has been notified.`);
        setTitle('');
        setDescription('');
        setSelectedDeviceMac('');
        onClose();
        router.push(`/dashboard/tickets/${res.ticketId}`);
      } else {
        toast.error(res.error || 'Failed to create ticket.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
              FX
            </div>
            <div>
              <DialogTitle className="text-lg font-bold font-heading">Raise a Support Ticket</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Direct B2B line to FocusX Engineering &amp; Operations Support ({libraryName})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Category Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Issue Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary font-medium ring-1 ring-primary'
                        : 'border-border/70 bg-card hover:bg-muted/50 text-foreground/80'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{cat.label}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{cat.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hardware Device Picker if Hardware Category */}
          {category === 'HARDWARE' && relays.length > 0 && (
            <div className="space-y-1.5 p-3 rounded-lg bg-muted/40 border border-border/80">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-primary" /> Select Affected Scanner / Machine (Optional)
              </label>
              <Select value={selectedDeviceMac} onValueChange={setSelectedDeviceMac}>
                <SelectTrigger className="w-full text-xs bg-background">
                  <SelectValue placeholder="Choose a scanner from your library..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GENERAL_HARDWARE">General Hardware / Unsure</SelectItem>
                  {relays.map((r) => (
                    <SelectItem key={r.id} value={r.macAddress || r.id}>
                      Tag #{r.nfcTagId} ({r.macAddress || 'No MAC'}) - {r.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Priority & Urgency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Priority Level</label>
              <Select value={priority} onValueChange={(val: TicketPriority) => setPriority(val)}>
                <SelectTrigger className="w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">🟢 Low (Minor query / feature)</SelectItem>
                  <SelectItem value="MEDIUM">🟡 Medium (Normal issue)</SelectItem>
                  <SelectItem value="HIGH">🟠 High (Impacting operations)</SelectItem>
                  <SelectItem value="URGENT">🔴 Urgent (Door locked / system down)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-500 text-[11px] leading-tight">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                {priority === 'URGENT'
                  ? 'Urgent tickets alert on-call engineers via SMS/Discord.'
                  : 'Tickets are usually answered in under 2 hours.'}
              </span>
            </div>
          </div>

          {/* Ticket Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Subject / Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. RFID Reader 2 stopped scanning student cards"
              className="text-xs"
              required
              maxLength={150}
            />
          </div>

          {/* Ticket Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Describe the problem in detail
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain what happened, what error appeared, or steps you already tried..."
              rows={4}
              className="text-xs resize-none"
              required
            />
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !title.trim() || !description.trim()}
              className="text-xs font-semibold gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Submitting Ticket...
                </>
              ) : (
                'Create Ticket'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
