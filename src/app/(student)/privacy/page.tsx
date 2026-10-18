import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy | FocusX",
  description: "How FocusX collects, uses, and protects personal information.",
}

export default function PrivacyPolicyPage() {
  return (
    <main className="container mx-auto min-h-[70vh] max-w-4xl px-6 py-16">
      <h1 className="font-heading text-4xl font-black text-foreground">
        Privacy Policy
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Last updated: 15 July 2026
      </p>

      <div className="mt-10 space-y-8 leading-7 text-foreground/80">
        <section>
          <h2 className="text-xl font-bold text-foreground">Information we use</h2>
          <p className="mt-2">
            FocusX processes account details, contact information, booking
            history, identity-verification results, and access records needed
            to provide library discovery, booking, payment, and check-in
            services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground">Payments and verification</h2>
          <p className="mt-2">
            Payments and identity checks may be handled by service providers
            such as Razorpay and Cashfree. Their processing is also governed by
            their respective privacy policies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground">How information is used</h2>
          <p className="mt-2">
            Information is used to operate bookings, prevent fraud, maintain
            library security, provide support, meet legal obligations, and
            improve the service. FocusX does not sell personal information.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground">Contact</h2>
          <p className="mt-2">
            For privacy questions or data requests, email{" "}
            <a
              href="mailto:focusdesk.in@gmail.com"
              className="font-semibold text-primary hover:underline"
            >
              focusdesk.in@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  )
}
