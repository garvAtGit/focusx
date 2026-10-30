import { NextResponse } from 'next/server';
import { createAndStoreWhatsAppOtp } from '@/lib/whatsapp-otp-service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone } = body;

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ error: 'Valid phone number is required' }, { status: 400 });
    }

    // Clean and normalize phone number
    let digits = phone.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }

    if (digits.length === 10) {
      digits = `91${digits}`;
    }

    if (digits.length < 10) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit phone number' }, { status: 400 });
    }

    const canonicalPhone = `+${digits}`;

    const result = await createAndStoreWhatsAppOtp(canonicalPhone);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 429 });
    }

    return NextResponse.json({
      success: true,
      message: 'OTP dispatched via WhatsApp',
      simulated: result.simulated,
      // Provide preview OTP in development / simulation mode so testing is instant
      previewOtp: result.simulated ? result.otp : undefined,
    });
  } catch (error: unknown) {
    console.error('[API /auth/whatsapp-otp/send] Error:', error);
    return NextResponse.json({ error: 'Failed to dispatch WhatsApp OTP' }, { status: 500 });
  }
}

