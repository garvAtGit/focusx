import type { Metadata } from "next"
import Link from "next/link"
import { Mail, MessageSquareText } from "lucide-react"
import { GlobalFeedbackModal } from "@/components/global-feedback-modal"

export const metadata: Metadata = {
  title: "Contact | FocusX",
  description: "Contact FocusX for booking, account, or library support.",
}

export default function ContactPage() {
  return (
    <main className="container mx-auto min-h-[70vh] max-w-4xl px-6 py-16">
      <h1 className="font-heading text-4xl font-black text-foreground">
        Contact FocusX
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Get help with a booking, account, payment, or partner-library enquiry.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <a
          href="mailto:focusdesk.in@gmail.com"
          className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
        >
          <Mail className="h-6 w-6 text-primary" />
          <h2 className="mt-4 text-lg font-bold text-foreground">Email support</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            focusdesk.in@gmail.com
          </p>
        </a>

        <div className="rounded-2xl border border-border bg-card p-6">
          <MessageSquareText className="h-6 w-6 text-primary" />
          <h2 className="mt-4 text-lg font-bold text-foreground">Send feedback</h2>
          <div className="mt-2">
            <GlobalFeedbackModal />
          </div>
        </div>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Want to list a study library?{" "}
        <Link href="/onboarding" className="font-semibold text-primary hover:underline">
          Start partner onboarding
        </Link>
        .
      </p>
    </main>
  )
}
