import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function main() {
  const intentId = '47bc50e5-054f-4560-bda2-b22f0d701e17';
  
  const intent = await prisma.bookingIntent.findUnique({
    where: { id: intentId }
  });
  
  if (!intent) {
    console.error('Intent not found');
    return;
  }
  
  const booking = await prisma.booking.create({
    data: {
      studentId: intent.studentId,
      libraryId: intent.libraryId,
      seatId: intent.seatId,
      planId: intent.planId,
      startTime: intent.startsAt,
      endTime: intent.endsAt,
      status: 'CONFIRMED',
      paymentRef: 'MANUAL_RECOVERY_' + Date.now(),
      hasLocker: intent.hasLocker,
      standaloneLockerId: intent.standaloneLockerId
    }
  });
  
  await prisma.bookingIntent.update({
    where: { id: intent.id },
    data: { 
      status: 'CONFIRMED',
      bookingId: booking.id,
      providerPaymentId: 'pay_manual_recovery_july23'
    }
  });
  
  console.log('Successfully recovered booking!', booking.id);
}

main().catch(console.error).finally(() => prisma.$disconnect());
