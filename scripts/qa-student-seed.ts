import 'dotenv/config';
import prisma from '../src/lib/prisma';
import { adminAuth } from '../src/lib/firebase/firebaseAdmin';
import { endOfDayIST } from '../src/lib/date-utils';
async function main() {
  if (!process.env.DATABASE_URL?.includes('127.0.0.1:55439/focusx_qa')) throw new Error('QA seed is restricted to the isolated local database');
  const identity = await adminAuth!.getUserByPhoneNumber(process.env.TEST_PHONE!);
  const owner = await prisma.user.upsert({ where: { email: 'qa-owner@example.test' }, create: { name: 'QA Librarian', email: 'qa-owner@example.test', role: 'LIBRARIAN', username: 'qa_owner' }, update: {} });
  const student = await prisma.user.upsert({ where: { authId: identity.uid }, create: { authId: identity.uid, name: 'Emulator Student', phone: process.env.TEST_PHONE, role: 'STUDENT', uniqueId: 'QA-STUDENT', username: 'emulator_student' }, update: {} });
  const library = await prisma.library.upsert({ where: { id: 'qa-library' }, create: { id: 'qa-library', librarianId: owner.id, name: 'FocusX Emulator Test Library', address: 'Isolated local test data', city: 'Delhi', locality: 'Test Centre', photos: [], facilities: ['WiFi'], kycStatus: 'APPROVED' }, update: {} });
  for (const [id,name,hours,price,type] of [['qa-plan','Monthly 4 hours',4,1000,'FLEXIBLE'],['qa-upgrade','Monthly 8 hours',8,1800,'FLEXIBLE'],['qa-reserved','Reserved 8 hours',8,2400,'FIXED']] as const) await prisma.plan.upsert({ where: { id }, create: { id, libraryId: library.id, name, durationHours: hours, price, validityDays: 30, type }, update: {} });
  await prisma.seat.upsert({ where: { id: 'qa-seat' }, create: { id: 'qa-seat', libraryId: library.id, name: 'A1', type: 'NORMAL', gridX: 0, gridY: 0 }, update: {} });
  await prisma.standaloneLocker.upsert({ where: { id: 'qa-locker' }, create: { id: 'qa-locker', libraryId: library.id, name: 'L1', price: 300 }, update: {} });
  const now = new Date(); const start = new Date(+now - 10*86400000); const end = endOfDayIST(now,19);
  await prisma.booking.upsert({ where: { id: 'qa-active' }, create: { id:'qa-active', studentId:student.id,libraryId:library.id,planId:'qa-plan',startTime:start,endTime:end,status:'CONFIRMED',paymentRef:'QA_CASH',amountPaidCashPaise:100000,amountDuePaise:0 }, update: {} });
  for (let i=0;i<25;i++) await prisma.booking.upsert({ where:{id:'qa-history-'+i}, create:{id:'qa-history-'+i, studentId:student.id,libraryId:library.id,planId:'qa-plan',startTime:new Date(+start-(i+2)*31*86400000),endTime:new Date(+start-(i+1)*31*86400000),status:i%3===0?'CANCELLED':'COMPLETED',paymentRef:'QA_HISTORY_'+i,amountPaidCashPaise:i%3===0?0:100000,amountDuePaise:0},update:{} });
  console.log('QA library and student fixtures ready');
}
main().finally(()=>prisma.$disconnect());
