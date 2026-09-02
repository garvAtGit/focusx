import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin"],
  cacheComponents: true,
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "recharts"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ik.imagekit.io",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/api/mobile/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            // Disable browser features this app never uses. `payment=*` is kept
            // open so Razorpay Checkout (which may use the Payment Request API in
            // a nested context) continues to work.
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=*',
          },
          {
            key: 'Content-Security-Policy',
            // Per-directive policy instead of a single catch-all default-src.
            // script-src is now an explicit allowlist rather than a blanket
            // `https:` — that wildcard previously let an attacker load executable
            // script from ANY https origin, which is the main XSS pivot. The
            // allowlisted hosts are: Razorpay Checkout, Google/Firebase auth +
            // reCAPTCHA. 'unsafe-inline'/'unsafe-eval' are still required by
            // Razorpay + framework runtime; removing them needs nonce plumbing
            // and runtime testing.
            // frame-ancestors is intentionally omitted to keep iframe embedding (?embed=true) working.
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://*.razorpay.com https://www.google.com https://www.gstatic.com https://apis.google.com https://*.firebaseapp.com",
              "style-src 'self' 'unsafe-inline' https:",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data: https:",
              "connect-src 'self' https: wss:",
              "frame-src 'self' https://*.razorpay.com https://api.razorpay.com https://www.google.com https://maps.google.com https://*.firebaseapp.com",
              "media-src 'self' https:",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self' https:",
            ].join('; ') + ';',
          }
        ],
      },
    ];
  },
};

export default nextConfig;
