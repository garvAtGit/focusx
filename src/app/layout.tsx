import type { Metadata } from "next";
import { Plus_Jakarta_Sans, IBM_Plex_Serif } from "next/font/google";
import { Toaster } from "react-hot-toast";
import NextTopLoader from 'nextjs-toploader';
import { WebVitals } from "@/components/web-vitals";
import Script from "next/script";
import "./globals.css";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const headingFont = IBM_Plex_Serif({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://www.focusx.in'),
  title: {
    template: "%s | FocusX",
    default: "FocusX | Book Premium Study Libraries Near You",
  },
  description: "Find and book premium study libraries starting at ₹500/mo. Compare seats, amenities & ratings on FocusX — India's study space platform.",
  openGraph: {
    title: "FocusX | Book Premium Study Libraries",
    description: "Find and book premium study libraries starting at ₹500/mo. Compare seats, amenities & ratings on FocusX.",
    url: "https://www.focusx.in",
    siteName: "FocusX",
    images: [
      {
        url: "/final-logo.svg",
        width: 1200,
        height: 630,
        alt: "FocusX - Book Study Libraries",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FocusX | Book Premium Study Libraries",
    description: "Find and book premium study libraries starting at ₹500/mo. Compare seats, amenities & ratings on FocusX.",
    images: ["/final-logo.svg"],
  },
  icons: {
    icon: "/final-logo.svg",
  },
  manifest: "/manifest.json",
};

import { Suspense } from "react";
import { SessionRestorerWrapper } from "@/components/SessionRestorerWrapper";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jakartaSans.variable} ${headingFont.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://focusdesk-95385.firebaseapp.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://apis.google.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground">
        <NextTopLoader color="hsl(var(--primary))" showSpinner={false} />
        <WebVitals />
        <Suspense fallback={null}>
          <SessionRestorerWrapper />
        </Suspense>
        {children}
        <Toaster position="bottom-center" />
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').then(
                  function (registration) {
                    console.log('Service Worker registration successful with scope: ', registration.scope);
                  },
                  function (err) {
                    console.log('Service Worker registration failed: ', err);
                  }
                );
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
