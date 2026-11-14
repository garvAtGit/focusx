import assert from 'node:assert/strict';
import test from 'node:test';
const url=process.env.TEST_DATABASE_URL;
test('pause cycles preserve the seven-day rule and upgrades replace only after confirmation', {skip:!url}, async()=>{
  process.env.DATABASE_URL=url;process.env.DIRECT_URL=url;
  const [{default:db}, a]=await Promise.all([import('../src/lib/prisma'),import('../src/lib/booking-authority')]);
  const suffix=crypto.randomUUID();
  const owner=await db.user.create({data:{name:'QA owner',role:'LIBRARIAN'}});
  const user=await db.user.create({data:{name:'QA student',role:'STUDENT'}});
  const lib=await db.library.create({data:{name:'QA isolated '+suffix,librarianId:owner.id,address:'Local test',photos:[],facilities:[]}});
  const old=await db.plan.create({data:{libraryId:lib.id,name:'4h',type:'FLEXIBLE',price:1000,validityDays:30,durationHours:4}});
  const next=await db.plan.create({data:{libraryId:lib.id,name:'8h',type:'FLEXIBLE',price:1800,validityDays:30,durationHours:8}});
  const end=new Date(Date.now()+20*86400000);
  const b=await db.booking.create({data:{studentId:user.id,libraryId:lib.id,planId:old.id,startTime:new Date(Date.now()-10*86400000),endTime:end,status:'CONFIRMED',amountPaidCashPaise:100000}});
  try{
    await a.pauseConfirmedBooking(b.id);
    await db.booking.update({where:{id:b.id},data:{pausedAt:new Date(Date.now()-5*86400000)}});
    assert.equal((await a.resumePausedBooking(b.id)).extendedDays,0);
    await a.pauseConfirmedBooking(b.id);
    await db.booking.update({where:{id:b.id},data:{pausedAt:new Date(Date.now()-8*86400000)}});
    assert.equal((await a.resumePausedBooking(b.id)).extendedDays,8);
    const events=await db.bookingPauseEvent.findMany({where:{bookingId:b.id}});
    assert.equal(events.length,4);assert.equal(events.filter(e=>e.action==='RESUME').reduce((s,e)=>s+e.creditedDays,0),8);
    const selection={operation:'UPGRADE_PLAN' as const,sourceBookingId:b.id,studentId:user.id,libraryId:lib.id,planId:next.id,idempotencyKey:suffix};
    const intent=await a.createOnlineBookingIntent(selection);
    assert.ok(intent.expectedAmountPaise>0 && intent.expectedAmountPaise<180000);
    const unchanged=await db.booking.findUniqueOrThrow({where:{id:b.id}});
    assert.equal(unchanged.status,'CONFIRMED');assert.equal(+unchanged.endTime,+end+8*86400000);
    await assert.rejects(a.createOnlineBookingIntent({...selection,studentId:owner.id,idempotencyKey:suffix+'other'}),/source booking/);
    await a.claimPaymentLinkCreation(intent.id);await a.attachPaymentOrder(intent.id,{providerOrderId:'qa-order-'+suffix});
    const payload={referenceId:intent.referenceId,providerOrderId:'qa-order-'+suffix,paymentId:'qa-payment-'+suffix,paidAmountPaise:intent.expectedAmountPaise,paidAt:new Date(),currency:'INR'};
    const result=await a.confirmOnlinePayment(payload);assert.equal(result.status,'CONFIRMED');
    assert.equal((await db.booking.findUniqueOrThrow({where:{id:b.id}})).status,'COMPLETED');
    assert.equal((await a.confirmOnlinePayment(payload)).status,'CONFIRMED');
    assert.equal(await db.booking.count({where:{libraryId:lib.id,status:'CONFIRMED'}}),1);
  } finally {
    await db.resourceLease.deleteMany({where:{libraryId:lib.id}});await db.bookingIntent.deleteMany({where:{libraryId:lib.id}});await db.booking.deleteMany({where:{libraryId:lib.id}});await db.plan.deleteMany({where:{libraryId:lib.id}});await db.library.delete({where:{id:lib.id}});await db.notification.deleteMany({where:{studentId:{in:[owner.id,user.id]}}});await db.user.deleteMany({where:{id:{in:[owner.id,user.id]}}});await db.$disconnect();
  }
});
