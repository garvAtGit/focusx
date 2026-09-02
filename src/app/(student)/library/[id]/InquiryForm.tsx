"use client"

import { useState } from "react"
import { submitInquiry } from "@/app/actions/inquiry-actions"
import toast from "react-hot-toast"
import { Send } from "lucide-react"

export function InquiryForm({ libraryId }: { libraryId: string }) {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [phone, setPhone] = useState("+91 ")
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    formData.append("libraryId", libraryId)
    formData.set("phone", phone) // ensure controlled value is used

    const res = await submitInquiry(formData)
    if (res?.success) {
      toast.success("Inquiry sent successfully!")
      setSubmitted(true)
    } else {
      toast.error(res?.error || "Failed to send inquiry")
    }
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="bg-success/10 text-success p-6 rounded-2xl border border-success/20 text-center">
        <h3 className="font-bold text-lg mb-2">Message Sent!</h3>
        <p className="text-sm">The librarian has received your inquiry and will contact you shortly.</p>
      </div>
    )
  }

  return (
    <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
      <h3 className="font-bold text-lg mb-4">Have Questions?</h3>
      <p className="text-sm text-muted-foreground mb-4">Drop your details below and the librarian will get back to you.</p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Your Name</label>
          <input 
            required 
            name="name" 
            placeholder="John Doe" 
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone Number</label>
          <input 
            required 
            name="phone" 
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 9876543210" 
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Message (Optional)</label>
          <textarea 
            name="message" 
            rows={3}
            placeholder="I'd like to know about..." 
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? "Sending..." : (
            <>
              Send Inquiry <Send className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  )
}
