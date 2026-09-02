import { NextResponse, type NextRequest } from 'next/server'

// Collects Core Web Vitals beacons from the client. Kept intentionally tiny and
// resilient — it only logs structured JSON (picked up by Vercel/Datadog) and is
// rate-limited by the global API limiter in middleware.
export async function POST(req: NextRequest) {
  try {
    const metric = await req.json()
    if (metric && typeof metric.name === 'string' && typeof metric.value === 'number') {
      console.log(
        `[web-vitals] ${metric.name} ${Math.round(metric.value)} ${metric.rating ?? ''} ${metric.path ?? ''}`.trim()
      )
    }
  } catch {
    // Ignore malformed beacons
  }
  return new NextResponse(null, { status: 204 })
}
