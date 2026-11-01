'use client';

import { useState } from "react";
import { submitInquiry } from "@/app/actions/inquiry-actions";
import { toast } from "react-hot-toast";
import { 
  HelpCircle, 
  Send, 
  CheckCircle2, 
  Phone, 
  MessageSquare, 
  Building2, 
  User, 
  Sparkles,
  Loader2
} from "lucide-react";

export interface SupportLibrary {
  id: string;
  name: string;
  whatsapp?: string | null;
  managerPhone?: string | null;
}

interface StudentSupportCardProps {
  studentName: string;
  studentPhone: string;
  libraries: SupportLibrary[];
}

const QUICK_TOPICS = [
  "Locker availability & pricing",
  "Seat upgrade or shift timing change",
  "Wi-Fi connection or speed query",
  "Library rules & holiday schedule",
];

export function StudentSupportCard({
  studentName,
  studentPhone,
  libraries,
}: StudentSupportCardProps) {
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>(
    libraries[0]?.id || ""
  );
  const [name, setName] = useState(studentName);
  const [phone, setPhone] = useState(studentPhone.startsWith("+91") ? studentPhone : `+91 ${studentPhone}`.trim());
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const activeLibrary = libraries.find((l) => l.id === selectedLibraryId) || libraries[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLibraryId) {
      toast.error("Please select a library.");
      return;
    }
    if (!name.trim()) {
      toast.error("Please provide your name.");
      return;
    }
    if (!phone.trim()) {
      toast.error("Please provide your phone number.");
      return;
    }
    if (!message.trim()) {
      toast.error("Please write your question or inquiry.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("libraryId", selectedLibraryId);
      formData.append("name", name.trim());
      formData.append("phone", phone.trim());
      formData.append("message", message.trim());

      const res = await submitInquiry(formData);
      if (res?.success) {
        toast.success("Inquiry sent to the librarian!");
        setSubmitted(true);
      } else {
        toast.error(res?.error || "Failed to send inquiry. Please try again.");
      }
    } catch {
      toast.error("An unexpected error occurred while sending your inquiry.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickTopic = (topic: string) => {
    setMessage((prev) => (prev ? `${prev}\n• ${topic}` : topic));
  };

  const resetForm = () => {
    setSubmitted(false);
    setMessage("");
  };

  return (
    <div className="bg-card rounded-3xl border border-border/80 shadow-sm p-6 sm:p-8 mt-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60 relative">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-heading font-black text-foreground">
                Ask Librarian / Help & Inquiry
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" /> Quick Support
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Have a question, need a locker, or want to change shifts? Send your inquiry directly to the librarian.
            </p>
          </div>
        </div>

        {/* Quick Contact Buttons if configured */}
        {activeLibrary && (activeLibrary.whatsapp || activeLibrary.managerPhone) && (
          <div className="flex items-center gap-2 shrink-0">
            {activeLibrary.whatsapp && (
              <a
                href={`https://wa.me/${activeLibrary.whatsapp.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
                title="Direct WhatsApp"
              >
                <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
              </a>
            )}
            {activeLibrary.managerPhone && (
              <a
                href={`tel:${activeLibrary.managerPhone}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs transition-colors"
                title="Call Library"
              >
                <Phone className="w-3.5 h-3.5" /> Call
              </a>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      {submitted ? (
        <div className="py-10 text-center flex flex-col items-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 animate-in zoom-in-95">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h3 className="text-xl font-bold text-foreground">Inquiry Sent Successfully!</h3>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            The librarian at <span className="font-semibold text-foreground">{activeLibrary?.name}</span> has received your message and will reach out to you via WhatsApp or phone shortly.
          </p>
          <button
            onClick={resetForm}
            className="mt-6 px-5 py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-semibold text-foreground transition-colors"
          >
            Ask Another Question
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Library Selector if student is associated with multiple libraries */}
          {libraries.length > 1 ? (
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Select Library
              </label>
              <select
                value={selectedLibraryId}
                onChange={(e) => setSelectedLibraryId(e.target.value)}
                className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {libraries.map((lib) => (
                  <option key={lib.id} value={lib.id}>
                    {lib.name}
                  </option>
                ))}
              </select>
            </div>
          ) : activeLibrary ? (
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/40 px-3 py-2 rounded-xl border border-border/50 w-fit">
              <Building2 className="w-3.5 h-3.5 text-primary" />
              Inquiring at: <span className="font-bold text-foreground">{activeLibrary.name}</span>
            </div>
          ) : null}

          {/* Name & Phone Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Your Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Phone Number
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full bg-background border border-input rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Quick Question Chips */}
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-2 block">
              Quick Suggestions (Click to add):
            </label>
            <div className="flex flex-wrap gap-2">
              {QUICK_TOPICS.map((topic, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleQuickTopic(topic)}
                  className="text-xs bg-muted/60 hover:bg-muted text-foreground/80 hover:text-foreground px-3 py-1.5 rounded-lg border border-border/60 transition-colors text-left"
                >
                  + {topic}
                </button>
              ))}
            </div>
          </div>

          {/* Inquiry / Question Textarea */}
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center justify-between">
              <span>Your Question or Message</span>
              <span className="text-[11px] font-normal text-muted-foreground">Detailed inquiries get faster resolutions</span>
            </label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your question, doubt, or request for the librarian here..."
              className="w-full bg-background border border-input rounded-xl p-3.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none leading-relaxed"
            />
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Directly delivered to the librarian&apos;s CRM inquiries panel.
            </p>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Send Inquiry
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

