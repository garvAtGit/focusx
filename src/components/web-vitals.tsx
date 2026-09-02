'use client'

import { useReportWebVitals } from 'next/web-vitals'

// Streams Core Web Vitals (LCP, INP, CLS, FCP, TTFB) to /api/vitals so they can
// be tracked in production logs/Datadog. Uses sendBeacon so reporting never
// blocks the main thread or delays navigation.
export function WebVitals() {
  useReportWebVitals((metric) => {
    try {
      const body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
        path: window.location.pathname,
      })

      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/vitals', body)
      } else {
        fetch('/api/vitals', { body, method: 'POST', keepalive: true })
      }
    } catch {
      // Reporting must never break the page
    }
  })

  return null
}
