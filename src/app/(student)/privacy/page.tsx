import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy | FocusX",
  description:
    "How FocusX collects, uses, shares and protects personal information, and the choices and rights you have.",
  alternates: { canonical: "/privacy" },
}

const CONTACT_EMAIL = "focusdesk.in@gmail.com"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  )
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-6">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  )
}

export default function PrivacyPolicyPage() {
  return (
    <main className="container mx-auto min-h-[70vh] max-w-4xl px-6 py-16">
      <h1 className="font-heading text-4xl font-black text-foreground">Privacy Policy</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated: 15 November 2026</p>

      <div className="mt-10 space-y-10 leading-7 text-foreground/80">
        <Section title="Who we are">
          <p>
            FocusX (&ldquo;FocusX&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) connects students with
            study libraries. We provide the FocusX website at focusx.in and the FocusX mobile app
            (together, the &ldquo;Service&rdquo;), which let you discover libraries, book plans and
            seats, pay, and check in. This policy explains what personal data we collect, why, who
            receives it, how long we keep it, and the choices and rights you have under applicable
            law, including India&rsquo;s Digital Personal Data Protection Act, 2023.
          </p>
        </Section>

        <Section title="Information we collect">
          <p>
            <strong className="text-foreground">Information you give us.</strong>
          </p>
          <List
            items={[
              "Your mobile number (used to sign you in with a one-time password) and your name.",
              "Optional profile details you choose to share, such as your profile photo, the exam you are preparing for, your daily study target and your usual study time.",
              "Booking details: the library, plan, seat or locker you choose, start dates and the status of your bookings.",
              "Messages or details you send when you contact a library or our support team.",
            ]}
          />
          <p>
            <strong className="text-foreground">Information created when you use the Service.</strong>
          </p>
          <List
            items={[
              "Attendance records: when you check in or out at a library (by QR pass or Bluetooth) and the library involved. These power your activity calendar, streak and, if shown, leaderboard.",
              "Payment records: the amount, status and reference of a payment. Card, UPI and bank details are entered with our payment provider and are not stored by FocusX.",
              "Notification settings and a device token so we can send you reminders and announcements.",
            ]}
          />
          <p>
            <strong className="text-foreground">Information collected automatically.</strong>
          </p>
          <List
            items={[
              "Device and app information: device make and model, operating system and version, app version, screen size, language, time zone and accessibility settings such as font size or reduced motion.",
              "Technical status: battery level and charging state, low-power mode, network type (for example Wi-Fi or mobile data), available storage and whether Bluetooth, location and notification permissions are granted. We use these mainly to find and fix problems such as missed check-ins.",
              "Usage information: the screens you view, searches you make, buttons you tap, how long actions take, and errors that occur.",
              "Your IP address and an approximate location derived from it.",
              "Crash and performance reports.",
            ]}
          />
          <p>
            <strong className="text-foreground">Location and Bluetooth.</strong> With your permission,
            the app uses your device&rsquo;s precise location to show libraries near you and, together
            with Bluetooth, to detect a library&rsquo;s entry reader so you can check in. In analytics,
            location is reduced to an approximate area (about 100 metres) and is not used to track your
            movements. You can turn location and Bluetooth off in your device settings; the app still
            works, but nearby search and Bluetooth check-in will be limited.
          </p>
        </Section>

        <Section title="How we use information">
          <List
            items={[
              "To create your account, verify your number, and provide bookings, payments, check-in and your activity history.",
              "To send service messages, such as booking confirmations, plan-ending reminders and a weekly summary, and announcements from your library.",
              "To keep the Service secure, prevent fraud and misuse, and comply with legal obligations.",
              "To understand how the Service is used, measure performance and decide what to improve, including which areas have many students but few libraries.",
              "To provide support and respond to requests.",
            ]}
          />
          <p>
            We do not sell your personal data, and we do not use it for third-party advertising. The
            app does not show ads.
          </p>
        </Section>

        <Section title="Who we share information with">
          <p>We share information only as needed to run the Service:</p>
          <List
            items={[
              <>
                <strong className="text-foreground">The library you book.</strong> The library&rsquo;s
                staff can see your name, mobile number, FocusX ID, booking and attendance for their
                library, so they can manage your seat and entry.
              </>,
              <>
                <strong className="text-foreground">Service providers (processors)</strong> acting on
                our instructions: Google Firebase (sign-in, crash reporting and notifications),
                Supabase and Vercel (database and hosting), Razorpay and Cashfree (payments and identity
                checks), PostHog (product analytics, processed in the United States), Sentry (website
                error monitoring), Upstash (caching and rate limiting) and ImageKit (image delivery).
                Some of these providers process data outside India.
              </>,
              "Authorities, where required by law or to protect rights, safety and security.",
              "A successor, if FocusX is involved in a merger or acquisition, subject to this policy.",
            ]}
          />
        </Section>

        <Section title="Your choices">
          <List
            items={[
              <>
                <strong className="text-foreground">Analytics.</strong> In the app, go to Profile, then
                Privacy &amp; data, and turn off &ldquo;Usage analytics&rdquo; to stop usage and device
                data being sent to our analytics provider.
              </>,
              "Permissions. You can withdraw location, Bluetooth and notification permissions at any time in your device settings.",
              "Optional profile questions can be skipped, and you can ask us to remove your answers.",
              "You can sign out from Profile at any time.",
            ]}
          />
        </Section>

        <Section title="Your rights">
          <p>
            You can ask us to give you a summary of the personal data we hold about you, correct or
            complete it, erase it, or withdraw consent you have given. You may also nominate someone to
            exercise these rights for you, and you can make a grievance to us. To do any of these, email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-primary hover:underline">
              {CONTACT_EMAIL}
            </a>{" "}
            from your registered account or mention your registered mobile number. We respond within 30
            days. If you are not satisfied, you may complain to the Data Protection Board of India.
          </p>
          <p>
            You can also start an account deletion request in the app under Profile, then Privacy &amp;
            data.
          </p>
        </Section>

        <Section title="How long we keep information">
          <p>
            We keep account and booking information while your account is active. Attendance
            records are kept for up to 1 year, and analytics data for up to 24 months, then deleted or
            anonymised. When you delete
            your account we erase or anonymise your personal data within 30 days, except records we must
            keep by law, such as payment and tax records (kept for up to 8 years), and records needed to
            resolve a dispute or prevent fraud.
          </p>
        </Section>

        <Section title="Security">
          <p>
            We protect data with encryption in transit, access controls, rate limiting and monitoring.
            No system is perfectly secure; if a breach affecting you occurs we will notify you and the
            authorities as the law requires.
          </p>
        </Section>

        <Section title="Children">
          <p>
            The Service is intended for people aged 18 and over, and you must be 18 or older to create
            an account. We do not knowingly collect personal data from anyone under 18. If you believe a
            person under 18 has given us data, contact us and we will delete it.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            We may update this policy. We will change the date above and, for material changes, tell you
            in the app or by notification.
          </p>
        </Section>

        <Section title="Contact and grievance officer">
          <p>
            For privacy questions, data requests or grievances, email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-primary hover:underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>
      </div>
    </main>
  )
}
