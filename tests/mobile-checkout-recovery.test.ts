import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
const require = createRequire(import.meta.url)
function load(file: string, mocks: Record<string, unknown>) {
  const output = ts.transpileModule(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  const exports: Record<string, any> = {}
  vm.runInNewContext(output,{exports,require:(id:string)=>mocks[id]??require(id),console,Date,setTimeout,clearTimeout,URL})
  return exports
}
function recovery(items: unknown[]) {
  const confirms: any[]=[];const cancellations: any[]=[]
  const module=load('src/lib/mobile-payment-recovery.ts',{
    './razorpay':{getRazorpayClient:()=>({orders:{fetchPayments:async()=>({items})}})},
    './booking-authority':{confirmOnlinePayment:async(input:unknown)=>{confirms.push(input);return {status:'CONFIRMED',booking:{libraryId:'l'}}},cancelBookingIntentByReference:async(...args:unknown[])=>cancellations.push(args)},
    './library-cache':{invalidateLibraryRuntimeCache:async()=>{}},
  })
  return {reconcileMobilePayment: module.reconcileMobilePayment as (intent: unknown) => Promise<void>,confirms,cancellations}
}
const intent={referenceId:'ref',providerOrderId:'order',status:'AWAITING_PAYMENT',holdExpiresAt:new Date(Date.now()-1000),expectedAmountPaise:10000,currency:'INR'}
test('a paid order with a lost native callback is recovered from captured provider facts',async()=>{
  const h=recovery([{id:'payment',order_id:'order',status:'captured',captured:true,amount:10000,currency:'INR',created_at:1000}]);await h.reconcileMobilePayment(intent)
  assert.equal(h.confirms.length,1);assert.equal(h.confirms[0].paidAmountPaise,10000);assert.equal(h.confirms[0].paidAt.getTime(),1000000);assert.equal(h.cancellations.length,0)
})
test('an authorized but uncaptured payment does not confirm or expire',async()=>{
  const h=recovery([{status:'authorized',captured:false}]);await h.reconcileMobilePayment(intent);assert.equal(h.confirms.length,0);assert.equal(h.cancellations.length,0)
})
test('a genuinely unpaid expired hold is released without a booking',async()=>{
  const h=recovery([]);await h.reconcileMobilePayment(intent);assert.equal(h.confirms.length,0);assert.equal(h.cancellations.length,1);assert.equal(h.cancellations[0][2],'EXPIRED')
})
test('mismatched provider payment details never confirm a booking',async()=>{
  const h=recovery([{id:'p',order_id:'other',status:'captured',captured:true,amount:1,currency:'INR'}]);await assert.rejects(h.reconcileMobilePayment(intent),/does not match/);assert.equal(h.confirms.length,0)
})
function cancellation(found: unknown) {
  let updates=0
  const tx={bookingIntent:{findFirst:async()=>found,update:async()=>{updates++}},resourceLease:{deleteMany:async()=>{updates++}}}
  const prisma={$transaction:async(fn:(tx:unknown)=>unknown)=>fn(tx)}
  const authority=load('src/lib/booking-authority.ts',{
    '@/lib/prisma':{__esModule:true,default:prisma},'@/lib/booking-pricing':{},'@/lib/booking-engine/server/server-fact-loader':{},'@/lib/booking-engine/evaluate-selection':{},'@/lib/date-utils':{},
  })
  return {cancelStudentPendingBooking: authority.cancelStudentPendingBooking as (input: unknown) => Promise<{success: boolean}>,updates:()=>updates}
}
test('unfinished-checkout cancellation cannot cancel a confirmed intent',async()=>{
  const h=cancellation({id:'intent',status:'CONFIRMED',booking:{status:'CONFIRMED'}})
  await assert.rejects(h.cancelStudentPendingBooking({studentId:'s',referenceId:'ref'}),/already confirmed/);assert.equal(h.updates(),0)
})
test('a missing explicit reference cannot fall through to another checkout',async()=>{
  const h=cancellation(null);const result=await h.cancelStudentPendingBooking({studentId:'s',referenceId:'missing'});assert.equal(result.success,false);assert.equal(h.updates(),0)
})

test('status recovery recognizes account-scoped online and reception idempotency keys',async()=>{
  let lookup: any
  const intent={id:'intent',studentId:'student',referenceId:'reference',status:'AWAITING_MANUAL_PAYMENT',booking:{id:'booking',status:'PENDING_PAYMENT'}}
  const route=load('src/app/api/mobile/checkout/status/route.ts',{
    '@/lib/prisma':{__esModule:true,default:{bookingIntent:{findFirst:async(query:unknown)=>{lookup=query;return intent},findUnique:async()=>intent}}},
    '@/lib/mobile-auth':{authenticateMobileRequest:async()=>({userId:'student'})},
    '@/lib/mobile-payment-recovery':{reconcileMobilePayment:async()=>{}},
  })
  const response=await route.GET(new Request('https://example.test/api/mobile/checkout/status?idempotency_key=key'))
  assert.equal(response.status,200);assert.equal(lookup.where.studentId,'student')
  assert.ok(lookup.where.idempotencyKey.in.includes('student:key'));assert.ok(lookup.where.idempotencyKey.in.includes('reception:student:key'))
  assert.equal((await response.json()).status,'AWAITING_MANUAL_PAYMENT')
})
