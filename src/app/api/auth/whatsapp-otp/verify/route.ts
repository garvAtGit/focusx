import { NextResponse } from 'next/server';
import { verifyWhatsAppOtp } from '@/lib/whatsapp-otp-service';
import { adminAuth } from '@/lib/firebase/firebaseAdmin';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone, otp } = body;

    if (!phone || !otp) {
      return NextResponse.json({ error: 'Phone number and OTP are required' }, { status: 400 });
    }

    // Clean and normalize phone number
    let digits = phone.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    if (digits.length === 10) {
      digits = `91${digits}`;
    }
    const canonicalPhone = `+${digits}`;

    // Verify OTP
    const verification = verifyWhatsAppOtp(canonicalPhone, String(otp));
    if (!verification.valid) {
      return NextResponse.json({ error: verification.error || 'Invalid OTP' }, { status: 400 });
    }

    if (!adminAuth) {
      return NextResponse.json({ error: 'Authentication engine is offline' }, { status: 500 });
    }

    // Get or create Firebase User
    let user;
    try {
      user = await adminAuth.getUserByPhoneNumber(canonicalPhone);
    } catch (err: any) {
      if (err?.code === 'auth/user-not-found') {
        user = await adminAuth.createUser({
          phoneNumber: canonicalPhone,
        });
      } else {
        console.error('[verify-otp] Firebase user fetch error:', err);
        throw err;
      }
    }

    // Mint a custom Firebase token with the verified phone number claim
    const customToken = await adminAuth.createCustomToken(user.uid, {
      phone_number: user.phoneNumber,
    });

    return NextResponse.json({
      success: true,
      customToken,
    });
  } catch (error: unknown) {
    console.error('[API /auth/whatsapp-otp/verify] Error:', error);
    return NextResponse.json({ error: 'Failed to verify WhatsApp OTP' }, { status: 500 });
  }
}
