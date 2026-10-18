"use client"

import { useState } from "react"
import { MessageSquarePlus } from "lucide-react"
import { getSession } from "@/app/actions/auth-actions"

export function GlobalFeedbackModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [targetType, setTargetType] = useState<"WEBSITE" | "LIBRARY" | "STUDENT">("WEBSITE")
  const [librarySearch, setLibrarySearch] = useState("")
  const [studentName, setStudentName] = useState("")
  const [studentPhone, setStudentPhone] = useState("")
  const [content, setContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleOpen = async () => {
    try {
      const session = await getSession();
      if (!session) {
        window.location.href = '/login?returnUrl=/';
        return;
      }
      setIsOpen(true);
    } catch {
      window.location.href = '/login?returnUrl=/';
    }
  }

  const handleTypeChange = (type: "WEBSITE" | "LIBRARY" | "STUDENT") => {
    setTargetType(type)
  }

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          libraryId: null, // Since we just use librarySearch text for now
          studentName: targetType === 'STUDENT' ? studentName : null,
          studentPhone: targetType === 'STUDENT' ? studentPhone : null,
          content: targetType === 'LIBRARY' && librarySearch ? `[Library: ${librarySearch}]\n${content}` : content
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit");
      }
      alert("Feedback submitted successfully!");
      setIsOpen(false);
      setContent("");
      setStudentName("");
      setStudentPhone("");
      setLibrarySearch("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to submit";
      alert(message);
      if (message.includes('login')) {
        window.location.href = '/login?returnUrl=/';
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <button 
        onClick={handleOpen}
        className="text-[14px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
      >
        <MessageSquarePlus className="w-4 h-4" /> Feedback to FocusX
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
            <h3 className="text-xl font-bold mb-2 text-foreground">Submit Feedback</h3>
            <p className="text-xs text-muted-foreground mb-4 font-medium px-2 py-1 bg-muted rounded inline-block">
              👤 You are submitting this as a registered user.
            </p>

            <div className="space-y-4 text-left">
              <div>
                <label className="text-sm font-bold text-foreground block mb-1">What is this regarding?</label>
                <div className="flex gap-2">
                  {(["WEBSITE", "LIBRARY", "STUDENT"] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => handleTypeChange(type)}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors ${targetType === type ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:bg-muted'}`}
                    >
                      {type.charAt(0) + type.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              {targetType === "LIBRARY" && (
                <div>
                  <label className="text-sm font-bold text-foreground block mb-1">Which Library?</label>
                  <input 
                    type="text" 
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                    placeholder="Search or enter library name..."
                    className="w-full p-2 border border-border rounded-lg bg-input/50 focus:outline-none focus:ring-2 focus:ring-primary text-sm text-foreground"
                  />
                </div>
              )}

              {targetType === "STUDENT" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm font-bold text-foreground block mb-1">Student Name <span className="text-muted-foreground font-normal">(Optional)</span></label>
                    <input 
                      type="text" 
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="Name"
                      className="w-full p-2 border border-border rounded-lg bg-input/50 focus:outline-none focus:ring-2 focus:ring-primary text-sm text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-foreground block mb-1">Phone <span className="text-muted-foreground font-normal">(Optional)</span></label>
                    <input 
                      type="text" 
                      value={studentPhone}
                      onChange={(e) => setStudentPhone(e.target.value)}
                      placeholder="Phone"
                      className="w-full p-2 border border-border rounded-lg bg-input/50 focus:outline-none focus:ring-2 focus:ring-primary text-sm text-foreground"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-bold text-foreground block mb-1">Your Feedback</label>
                <textarea 
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Tell us what's on your mind..."
                  className="w-full h-24 p-3 border border-border rounded-lg bg-input/50 focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm text-foreground"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSubmit}
                  disabled={isSubmitting || !content.trim()}
                  className="px-6 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting..." : "Submit Feedback"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
