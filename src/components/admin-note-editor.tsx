'use client'

import { useState, useRef, useEffect } from "react"
import { updateLibraryNote } from "@/app/actions/library-actions"
import { Loader2 } from "lucide-react"

export function AdminNoteEditor({ libraryId, initialNote, phone }: { libraryId: string, initialNote: string, phone: string | null }) {
  const [note, setNote] = useState(initialNote || "")
  const [isSaving, setIsSaving] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Track the note that has been saved to prevent redundant saves
  const [savedNote, setSavedNote] = useState(initialNote || "")

  const saveNote = async (text: string) => {
    if (text === savedNote) return;
    setIsSaving(true)
    try {
      await updateLibraryNote(libraryId, text)
      setSavedNote(text)
    } finally {
      setIsSaving(false)
    }
  }

  // Auto-save on change (debounced)
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      saveNote(note)
    }, 1500)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [note, libraryId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      // Save it immediately
      saveNote(note)
      // Send to whatsapp
      const targetPhone = phone?.startsWith('+') ? phone : (phone ? `+91${phone}` : null)
      if (targetPhone) {
        const encoded = encodeURIComponent(note)
        window.open(`https://wa.me/${targetPhone.replace(/\D/g, '')}?text=${encoded}`, '_blank')
      } else {
        alert("No manager phone number available for this library to send WhatsApp.")
      }
    }
  }

  const addTemplate = () => {
    const template = "okay weve got this info now we'll cut those we got and need to get a follow up for others"
    const newNote = note ? note + "\n" + template : template
    setNote(newNote)
    // It will auto-save because of the useEffect
  }

  return (
    <div className="space-y-2 mt-6 p-6 border border-border rounded-xl bg-card shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          Admin Notes {isSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </h3>
        <button 
          type="button" 
          className="px-3 py-1.5 text-xs font-semibold bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
          onClick={addTemplate}
        >
          + Add P Template
        </button>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type note here... Press Enter to save and send via WhatsApp (Shift+Enter for new line)"
        className="w-full px-3 py-3 rounded-md border border-border bg-transparent text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[100px]"
      />
      <p className="text-xs text-muted-foreground">Press <strong>Enter</strong> to auto-save and send via WhatsApp. <strong>Shift+Enter</strong> for a new line. Notes are also auto-saved as you type.</p>
    </div>
  )
}
