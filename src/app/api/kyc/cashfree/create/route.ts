import { NextResponse } from 'next/server';
import { getSession } from '@/app/actions/auth-actions';
import { getCashfreeSignature, getCashfreeBaseUrl } from '@/lib/cashfree';
import { redis } from '@/lib/redis';

// Pending verifications expire after 30 minutes — long enough to complete the
// DigiLocker flow, short enough to limit replay/guessing windows.
const KYC_PENDING_TTL_SECONDS = 30 * 60;

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { redirectUrl } = await req.json();

    const clientId = process.env.CASHFREE_VERIFICATION_CLIENT_ID;
    const clientSecret = process.env.CASHFREE_VERIFICATION_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.warn('Cashfree credentials missing. Please add them to .env');
      return NextResponse.json({ error: 'Cashfree credentials not configured' }, { status: 500 });
    }

    // Restrict the post-KYC redirect to our own origin to prevent the DigiLocker
    // return flow being used as an open redirect (phishing).
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.focusx.in';
    const isValidRedirect = 
      typeof redirectUrl === 'string' && 
      (redirectUrl.startsWith(appUrl) || 
       redirectUrl.startsWith('https://www.focusx.in') || 
       redirectUrl.startsWith('https://focusx.in'));
       
    const safeRedirectUrl = isValidRedirect ? redirectUrl : `${appUrl}/student/profile`;

    const shortId = session.userId.substring(0, 8);
    const verification_id = `KYC_${shortId}_${Date.now()}`;

    const response = await fetch(getCashfreeBaseUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': clientId,
        'x-client-secret': clientSecret,
        ...(getCashfreeSignature(clientId) ? { 'x-cf-signature': getCashfreeSignature(clientId) as string } : {})
      },
      body: JSON.stringify({
        verification_id,
        redirect_url: safeRedirectUrl,
        name: 'Student',
        document_requested: ["AADHAAR"]
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to initiate Cashfree OKYC');
    }

    // Authoritative id is whatever Cashfree acknowledges.
    const issuedId = data.verification_id || verification_id;

    // Bind this verification to the authenticated user server-side. `verify`
    // will ONLY trust this stored id, so a client cannot submit someone else's
    // verification_id to import their identity.
    await redis.set(`kyc:pending:${session.userId}`, issuedId, { ex: KYC_PENDING_TTL_SECONDS });

    return NextResponse.json({ success: true, url: data.url, verification_id: issuedId });

  } catch (error: unknown) {
    console.error('Cashfree Create Error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}
