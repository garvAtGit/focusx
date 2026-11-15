import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Delete your FocusX account",
  description: "How to request deletion of your FocusX account and personal data.",
  alternates: { canonical: "/delete-account" },
  // Reachable by link (the Play Store and the app point here) but not listed in search results.
  robots: { index: false, follow: false },
}

const CONTACT_EMAIL = "focusdesk.in@gmail.com"

export default function DeleteAccountPage() {
  const subject = encodeURIComponent("Delete my FocusX account")
  const body = encodeURIComponent(
    "Please delete my FocusX account and personal data.\n\nRegistered mobile number: +91 \nName: \n",
  )

  return (
    <main className="container mx-auto min-h-[70vh] max-w-3xl px-6 py-16">
      <h1 className="font-heading text-4xl font-black text-foreground">Delete your FocusX account</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        For the FocusX app (com.focusx.app) and focusx.in
      </p>

      <div className="mt-10 space-y-8 leading-7 text-foreground/80">
        <section>
          <h2 className="text-xl font-bold text-foreground">How to request deletion</h2>
          <ol className="mt-2 list-decimal space-y-2 pl-6">
            <li>
              Email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`}
                className="font-semibold text-primary hover:underline"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              with the subject &ldquo;Delete my FocusX account&rdquo;.
            </li>
            <li>Include the mobile number registered to your account and your name.</li>
            <li>
              We will confirm it is you (for example by asking you to reply from the number on your
              account) and then delete your account.
            </li>
          </ol>
          <p className="mt-3">We complete deletion within 30 days of confirming your request.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground">What is deleted</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-6">
            <li>Your profile: name, mobile number sign-in, photo and optional profile answers.</li>
            <li>Your attendance history, activity calendar, streak and saved libraries.</li>
            <li>Notification tokens and the usage and device analytics linked to your account.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground">What we may keep</h2>
          <p className="mt-2">
            We keep records we are legally required to keep, such as payment and tax records (up to 8
            years), and limited records needed to resolve disputes or prevent fraud. These are kept
            only for those purposes and are not used for anything else.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground">Only want to stop analytics?</h2>
          <p className="mt-2">
            You do not need to delete your account for that. In the app, open Profile, then Privacy &amp;
            data, and turn off &ldquo;Usage analytics&rdquo;. See our{" "}
            <a href="/privacy" className="font-semibold text-primary hover:underline">
              Privacy Policy
            </a>{" "}
            for details.
          </p>
        </section>
      </div>
    </main>
  )
}
