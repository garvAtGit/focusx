import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'dotenv';
import prisma from '../src/lib/prisma';
import { adminAuth } from '../src/lib/firebase/firebaseAdmin';
import { createOnlineBookingIntent } from '../src/lib/booking-authority';
const base='http://127.0.0.1:3100';
async function main(){
  if(!process.env.DATABASE_URL?.includes('127.0.0.1:55439/focusx_qa')) throw Error('QA checks require isolated local database');
  const config=parse(readFileSync(process.argv[2]));
  const identity=await adminAuth!.getUserByPhoneNumber(process.env.TEST_PHONE!);
  const custom=await adminAuth!.createCustomToken(identity.uid);
  const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key='+config.EXPO_PUBLIC_FIREBASE_API_KEY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:custom,returnSecureToken:true})});
  const session=await response.json();if(!session.idToken)throw Error('Unable to establish authenticated QA session');
  const checks: {name:string;milliseconds:number}[]=[];
  async function request(path:string,method='GET',body?:unknown,expected=200){const start=Date.now();const r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+session.idToken,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const result=await r.json();assert.equal(r.status,expected,JSON.stringify(result));checks.push({name:method+' '+path,milliseconds:Date.now()-start});return result;}
  const student=await prisma.user.findUniqueOrThrow({where:{authId:identity.uid}});
  const source=await prisma.booking.findUniqueOrThrow({where:{id:'qa-active'}});
  // More than fifty older records exercise the old active-plan truncation bug.
  for(let i=25;i<70;i++)await prisma.booking.upsert({where:{id:'qa-history-'+i},create:{id:'qa-history-'+i,studentId:student.id,libraryId:'qa-library',planId:'qa-plan',startTime:new Date(+source.startTime-(i+2)*31*86400000),endTime:new Date(+source.startTime-(i+1)*31*86400000),status:'COMPLETED',paymentRef:'QA_HISTORY_'+i,amountPaidCashPaise:100000},update:{}});
  const space=await request('/api/mobile/myspace');assert.ok(space.activeBookings.some((b:{id:string})=>b.id==='qa-active'));
  const ids:string[]=[];let cursor:string|null=null;do{const page=await request('/api/mobile/bookings'+(cursor?'?cursor='+cursor:''));assert.ok(page.bookings.length<=20);ids.push(...page.bookings.map((b:{id:string})=>b.id));cursor=page.nextCursor;}while(cursor);assert.equal(ids.length,new Set(ids).size);assert.ok(ids.length>=71);
  const receipt=await request('/api/mobile/bookings/qa-active/receipt');assert.equal(receipt.paidAmountPaise,100000);
  await request('/api/mobile/bookings/qa-history-24/receipt','GET',undefined,409);
  const paused=await request('/api/mobile/bookings/qa-active/pause-history','POST',{action:'PAUSE'});assert.equal(paused.success,true);
  await request('/api/mobile/bookings/qa-active/pause-history','POST',{action:'PAUSE'},409);
  const resumed=await request('/api/mobile/bookings/qa-active/pause-history','POST',{action:'RESUME'});assert.equal(resumed.result.extendedDays,0);
  const history=await request('/api/mobile/bookings/qa-active/pause-history');assert.ok(history.events.length>=2);
  const selection={sourceBookingId:'qa-active',operation:'UPGRADE_PLAN',planId:'qa-upgrade',seatId:null,hasLocker:false,standaloneLockerId:null};
  const quote=await request('/api/mobile/checkout/preview','POST',selection);assert.equal(quote.status,'READY');assert.ok(quote.amountPaise<180000);
  const renewal=await request('/api/mobile/checkout/preview','POST',{...selection,operation:'CHANGE_PLAN'});assert.equal(renewal.status,'READY');assert.ok(+new Date(renewal.dates.startsAt)>+source.endTime);
  const hold=await createOnlineBookingIntent({...selection,operation:'UPGRADE_PLAN',studentId:student.id,libraryId:'qa-library',idempotencyKey:crypto.randomUUID()});
  await request('/api/student/live-seats?libraryId=qa-library');assert.equal((await prisma.bookingIntent.findUniqueOrThrow({where:{id:hold.id}})).status,'HOLDING');
  await request('/api/mobile/checkout/cancel','POST',{referenceId:hold.referenceId,libraryId:'qa-library'});
  assert.equal((await request('/api/mobile/checkout/status?reference_id='+hold.referenceId)).status,'CANCELLED');
  assert.equal((await fetch(base+'/api/mobile/bookings')).status,401);
  console.log(JSON.stringify({passed:checks.length+2,historyRecords:ids.length,checks},null,2));
  if(process.env.QA_REPORT_PATH)writeFileSync(process.env.QA_REPORT_PATH,JSON.stringify({passed:checks.length+2,historyRecords:ids.length,checks},null,2));
}
main().finally(()=>prisma.$disconnect());
