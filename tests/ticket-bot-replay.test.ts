import test from 'node:test';
import assert from 'node:assert/strict';
import { TicketCategory } from '@prisma/client';
import prisma from '@/lib/prisma';
import { triageTicket } from '@/lib/ticket-auto-resolver/triage';
import { ProblemType } from '@/lib/ticket-auto-resolver/types';

interface ReplayCase {
  id: string;
  category: TicketCategory;
  title: string;
  description: string;
  expectedProblemType: ProblemType;
  expectedConfidenceMin?: number;
  expectedConfidenceMax?: number;
  expectedMultiIntent: boolean;
  intentGroup:
    | 'PAYMENT_PENDING'
    | 'PAYOUT_DISPUTE'
    | 'HARDWARE_OFFLINE'
    | 'ATTENDANCE_CHECKIN'
    | 'MULTI_INTENT'
    | 'AMBIGUOUS'
    | 'HARD_PAYOUT_DISPUTE'
    | 'HARD_HINGLISH_NO_KEYWORDS'
    | 'HARD_TYPO_BLIND';
}

const SYNTHETIC_REPLAY_SET: ReplayCase[] = [
  // ==================== BASE 30 SYNTHETIC CASES ====================
  // 1. Student Payment Pending (6 tickets)
  {
    id: 'PAY-1',
    category: 'BILLING_PAYOUTS',
    title: 'Student payment cut gaya booking pending hai 9876543210',
    description: 'Student paid through UPI app, razorpay debited 450 rupees but seat not booked.',
    expectedProblemType: 'PAYMENT_PENDING',
    expectedConfidenceMin: 0.8,
    expectedMultiIntent: false,
    intentGroup: 'PAYMENT_PENDING',
  },
  {
    id: 'PAY-2',
    category: 'BILLING_PAYOUTS',
    title: 'Razorpay debited 500 rupees paise kat gaye seat booking nahi hui 9812345678',
    description: 'Student payment debited on razorpay screen, booking pending show ho rahi hai.',
    expectedProblemType: 'PAYMENT_PENDING',
    expectedConfidenceMin: 0.8,
    expectedMultiIntent: false,
    intentGroup: 'PAYMENT_PENDING',
  },
  {
    id: 'PAY-3',
    category: 'BILLING_PAYOUTS',
    title: 'Student fee deducted amount debited but booking still pending',
    description: 'Booking payment deducted from account, receipt status pending in system.',
    expectedProblemType: 'PAYMENT_PENDING',
    expectedConfidenceMin: 0.8,
    expectedMultiIntent: false,
    intentGroup: 'PAYMENT_PENDING',
  },
  {
    id: 'PAY-4',
    category: 'BILLING_PAYOUTS',
    title: 'Paise cut gaye account se but student admission pending show ho raha hai 9123456780',
    description: 'Student payment cut paise kat gaye but booking pending status.',
    expectedProblemType: 'PAYMENT_PENDING',
    expectedConfidenceMin: 0.8,
    expectedMultiIntent: false,
    intentGroup: 'PAYMENT_PENDING',
  },
  {
    id: 'PAY-5',
    category: 'BILLING_PAYOUTS',
    title: 'Student payment debited on razorpay seat confirm nahi hui',
    description: 'Paise kat gaya student ka seat booking pending.',
    expectedProblemType: 'PAYMENT_PENDING',
    expectedConfidenceMin: 0.8,
    expectedMultiIntent: false,
    intentGroup: 'PAYMENT_PENDING',
  },
  {
    id: 'PAY-6',
    category: 'BILLING_PAYOUTS',
    title: 'Paise kat gya student ka booking pending hai please check 9988776655',
    description: 'Booking payment cut ho gaya student account se.',
    expectedProblemType: 'PAYMENT_PENDING',
    expectedConfidenceMin: 0.8,
    expectedMultiIntent: false,
    intentGroup: 'PAYMENT_PENDING',
  },

  // 2. Payout / Settlement Disputes in BILLING_PAYOUTS (5 tickets) -> MUST NOT BE PAYMENT_PENDING
  {
    id: 'PAYOUT-1',
    category: 'BILLING_PAYOUTS',
    title: 'Weekly payout transfer not received in library bank account',
    description: 'Last week settlement was supposed to arrive by Tuesday. Bank statement checked, payout missing.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: false,
    intentGroup: 'PAYOUT_DISPUTE',
  },
  {
    id: 'PAYOUT-2',
    category: 'BILLING_PAYOUTS',
    title: 'Settlement amount delayed why library payout is pending',
    description: 'Bank transfer has not been initiated for our branch. Need settlement status update immediately.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: false,
    intentGroup: 'PAYOUT_DISPUTE',
  },
  {
    id: 'PAYOUT-3',
    category: 'BILLING_PAYOUTS',
    title: 'Bank transfer for last week payout dispute please resolve',
    description: 'Library bank account credit was 5000 less than the settlement invoice report.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: false,
    intentGroup: 'PAYOUT_DISPUTE',
  },
  {
    id: 'PAYOUT-4',
    category: 'BILLING_PAYOUTS',
    title: 'Paisa account me nahi aya settlement delayed library payout',
    description: 'Hamara weekly settlement delay ho gaya hai bank account me transfer nahi hua.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: false,
    intentGroup: 'PAYOUT_DISPUTE',
  },
  {
    id: 'PAYOUT-5',
    category: 'BILLING_PAYOUTS',
    title: 'Payment settlement kab aayega bank account me credit nahi hua',
    description: 'Dispute regarding monthly library revenue payout transfer to branch bank account.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: false,
    intentGroup: 'PAYOUT_DISPUTE',
  },

  // 3. Hardware / Turnstile Offline (6 tickets)
  {
    id: 'HW-1',
    category: 'HARDWARE',
    title: 'Turnstile gate nahi khul raha red light blink ho rahi hai',
    description: 'Scanner band hai gate open nahi ho raha scanner offline blink kar raha hai.',
    expectedProblemType: 'SCANNER_OFFLINE',
    expectedConfidenceMin: 0.8,
    expectedMultiIntent: false,
    intentGroup: 'HARDWARE_OFFLINE',
  },
  {
    id: 'HW-2',
    category: 'HARDWARE',
    title: 'Scanner offline hai gate open nahi ho raha rfid reader unresponsive',
    description: 'RFID reader machine offline red light continuously on gate nahi khula.',
    expectedProblemType: 'SCANNER_OFFLINE',
    expectedConfidenceMin: 0.8,
    expectedMultiIntent: false,
    intentGroup: 'HARDWARE_OFFLINE',
  },
  {
    id: 'HW-3',
    category: 'HARDWARE',
    title: 'ESP32 scanner band ho gaya library entrance gate machine stuck',
    description: 'Gate relay machine offline turnstile not rotating when scanned.',
    expectedProblemType: 'SCANNER_OFFLINE',
    expectedConfidenceMin: 0.8,
    expectedMultiIntent: false,
    intentGroup: 'HARDWARE_OFFLINE',
  },
  {
    id: 'HW-4',
    category: 'HARDWARE',
    title: 'Turnstile machine nahi chal rahi students cannot enter gate band hai',
    description: 'Entrance gate open nahi ho raha scanner red light stuck.',
    expectedProblemType: 'SCANNER_OFFLINE',
    expectedConfidenceMin: 0.8,
    expectedMultiIntent: false,
    intentGroup: 'HARDWARE_OFFLINE',
  },
  {
    id: 'HW-5',
    category: 'HARDWARE',
    title: 'RFID reader machine offline hai scanner not responding',
    description: 'Main entry gate nahi khula relay not triggering turnstile flap.',
    expectedProblemType: 'SCANNER_OFFLINE',
    expectedConfidenceMin: 0.8,
    expectedMultiIntent: false,
    intentGroup: 'HARDWARE_OFFLINE',
  },
  {
    id: 'HW-6',
    category: 'HARDWARE',
    title: 'Biometric scanner band hai gate nahi khula students waiting',
    description: 'Turnstile gate nahi khul raha esp32 offline show kar raha hai.',
    expectedProblemType: 'SCANNER_OFFLINE',
    expectedConfidenceMin: 0.8,
    expectedMultiIntent: false,
    intentGroup: 'HARDWARE_OFFLINE',
  },

  // 4. Attendance / Stale Session (5 tickets)
  {
    id: 'ATT-1',
    category: 'STUDENTS_BOOKINGS',
    title: 'Student punched in entry nahi hui attendance issue checkin missing',
    description: 'Student punched in at entrance but checkin record not created in dashboard attendance.',
    expectedProblemType: 'ATTENDANCE_CHECKIN',
    expectedConfidenceMin: 0.8,
    expectedMultiIntent: false,
    intentGroup: 'ATTENDANCE_CHECKIN',
  },
  {
    id: 'ATT-2',
    category: 'STUDENTS_BOOKINGS',
    title: 'Student check-out nahi hua stale session show ho raha hai',
    description: 'Yesterday evening session is still active, stale session auto checkout did not trigger.',
    expectedProblemType: 'ATTENDANCE_CHECKIN',
    expectedConfidenceMin: 0.8,
    expectedMultiIntent: false,
    intentGroup: 'ATTENDANCE_CHECKIN',
  },
  {
    id: 'ATT-3',
    category: 'STUDENTS_BOOKINGS',
    title: 'Attendance missing student punched in but checkin record not found',
    description: 'Card tapped at reader but student entry attendance not logged.',
    expectedProblemType: 'ATTENDANCE_CHECKIN',
    expectedConfidenceMin: 0.8,
    expectedMultiIntent: false,
    intentGroup: 'ATTENDANCE_CHECKIN',
  },
  {
    id: 'ATT-4',
    category: 'STUDENTS_BOOKINGS',
    title: 'Student ki hajiri nahi lagi entry nahi hui checkout record missing',
    description: 'Attendance log not updated for morning check-in batch.',
    expectedProblemType: 'ATTENDANCE_CHECKIN',
    expectedConfidenceMin: 0.8,
    expectedMultiIntent: false,
    intentGroup: 'ATTENDANCE_CHECKIN',
  },
  {
    id: 'ATT-5',
    category: 'STUDENTS_BOOKINGS',
    title: 'Stale session check in attendance mark nahi ho rahi',
    description: 'Student open session needs closing, attendance check in showing error.',
    expectedProblemType: 'ATTENDANCE_CHECKIN',
    expectedConfidenceMin: 0.8,
    expectedMultiIntent: false,
    intentGroup: 'ATTENDANCE_CHECKIN',
  },

  // 5. Multi-Intent Tickets (4 tickets) -> MUST FLAG isMultiIntent: true
  {
    id: 'MULTI-1',
    category: 'OTHER',
    title: 'Student payment cut ho gaya and entrance turnstile gate bhi band hai',
    description: 'Paise kat gaye booking pending plus turnstile scanner offline nahi khul raha.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: true,
    intentGroup: 'MULTI_INTENT',
  },
  {
    id: 'MULTI-2',
    category: 'OTHER',
    title: 'Scanner offline hai aur student ki attendance checkin bhi nahi ho rahi',
    description: 'Gate turnstile band hai and checkin attendance punch in not working.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: true,
    intentGroup: 'MULTI_INTENT',
  },
  {
    id: 'MULTI-3',
    category: 'OTHER',
    title: 'Student booking payment pending and turnstile gate nahi khul raha',
    description: 'Payment debited on razorpay also RFID reader machine offline.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: true,
    intentGroup: 'MULTI_INTENT',
  },
  {
    id: 'MULTI-4',
    category: 'OTHER',
    title: 'Paise kat gaye seat booking pending plus biometric scanner band hai',
    description: 'Student fee deducted but booking pending and gate nahi khul raha.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: true,
    intentGroup: 'MULTI_INTENT',
  },

  // 6. Ambiguous / General Inquiries (4 tickets) -> Low confidence & UNKNOWN
  {
    id: 'AMB-1',
    category: 'OTHER',
    title: 'Locker size kitna hai study room me air conditioning service needed',
    description: 'Cabin 4 AC cooling is slow, what are standard locker dimensions?',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: false,
    intentGroup: 'AMBIGUOUS',
  },
  {
    id: 'AMB-2',
    category: 'OTHER',
    title: 'Library timing change request for next month',
    description: 'Can we open at 6:00 AM instead of 7:00 AM during exam season?',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: false,
    intentGroup: 'AMBIGUOUS',
  },
  {
    id: 'AMB-3',
    category: 'OTHER',
    title: 'Library room me paint karwana hai quiet area table repair',
    description: 'Floor 2 table 14 leg is loose, and wall paint is peeling near window.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: false,
    intentGroup: 'AMBIGUOUS',
  },
  {
    id: 'AMB-4',
    category: 'OTHER',
    title: 'Wi-Fi password update request for study zone',
    description: 'Please generate a new monthly guest password for the second floor router.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: false,
    intentGroup: 'AMBIGUOUS',
  },

  // ==================== 15 HARDER CASES ====================
  // 7. Hard Payout Disputes mentioning razorpay/student/booking (5 tickets)
  // Must NOT trigger student PAYMENT_PENDING; must fail closed to UNKNOWN with confidence < 0.6
  {
    id: 'HARD-PAYOUT-1',
    category: 'BILLING_PAYOUTS',
    title: 'Hamara razorpay settlement account me transfer nahi hua monthly payout pending',
    description: 'Razorpay payment gateway settlement for student bookings has not been credited to our library bank account.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: false,
    intentGroup: 'HARD_PAYOUT_DISPUTE',
  },
  {
    id: 'HARD-PAYOUT-2',
    category: 'BILLING_PAYOUTS',
    title: 'Student bookings ka total amount payout nahi mila bank me credit kab hoga',
    description: '35 student bookings amount debited on portal but librarian weekly settlement payout is withheld.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: false,
    intentGroup: 'HARD_PAYOUT_DISPUTE',
  },
  {
    id: 'HARD-PAYOUT-3',
    category: 'BILLING_PAYOUTS',
    title: 'Weekly settlement me 10 student booking ka cut share missing hai payout dispute',
    description: 'Dispute regarding deducted booking commission from the net payout transferred to vendor bank account.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: false,
    intentGroup: 'HARD_PAYOUT_DISPUTE',
  },
  {
    id: 'HARD-PAYOUT-4',
    category: 'BILLING_PAYOUTS',
    title: 'Razorpay se library ka balance withdraw nahi ho raha payout settlement issue',
    description: 'Student admission fee collection razorpay balance payout transfer to bank account failed.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: false,
    intentGroup: 'HARD_PAYOUT_DISPUTE',
  },
  {
    id: 'HARD-PAYOUT-5',
    category: 'BILLING_PAYOUTS',
    title: 'Student fee collection razorpay gateway settlement delayed to branch account',
    description: 'Direct payment settlement from FocusX student admissions to library account is delayed by 5 days.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: false,
    intentGroup: 'HARD_PAYOUT_DISPUTE',
  },

  // 8. Hard Hinglish with No Keywords (5 tickets)
  // Natural phrases without standard keywords -> must fail closed to UNKNOWN with confidence < 0.6
  {
    id: 'HARD-HINGLISH-1',
    category: 'OTHER',
    title: 'bhai kuch kaam nahi kar raha screen freeze hai sab band ho gaya',
    description: 'kal shaam se problem chal rahi hai monitor blank ho gaya hai kuch display nahi aa raha.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: false,
    intentGroup: 'HARD_HINGLISH_NO_KEYWORDS',
  },
  {
    id: 'HARD-HINGLISH-2',
    category: 'OTHER',
    title: 'sir kal se bahut paresani ho rahi hai yaha dekh lo zara',
    description: 'bache aake bar bar complaint kar rahe hai jaldi koi team member bhejo yaha.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: false,
    intentGroup: 'HARD_HINGLISH_NO_KEYWORDS',
  },
  {
    id: 'HARD-HINGLISH-3',
    category: 'OTHER',
    title: 'kuch update karwa do urgent basis pe aake check karo',
    description: 'hamari branch pe connectivity bilkul khatam hai urgent fix required.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: false,
    intentGroup: 'HARD_HINGLISH_NO_KEYWORDS',
  },
  {
    id: 'HARD-HINGLISH-4',
    category: 'OTHER',
    title: 'koi sunwai nahi ho rahi call pick karo jaldi',
    description: 'hum subah se message daal rahe hai koi resolution nahi mila abhi tak.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: false,
    intentGroup: 'HARD_HINGLISH_NO_KEYWORDS',
  },
  {
    id: 'HARD-HINGLISH-5',
    category: 'OTHER',
    title: 'library me sab log pareshan hai please jaldi reply do',
    description: 'operational hurdle aa gaya hai dispatch person ko jaldi bhejiye.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: false,
    intentGroup: 'HARD_HINGLISH_NO_KEYWORDS',
  },

  // 9. Hard Typos & Phonetic Variants Blind of Keywords (5 tickets)
  // Intent keywords misspelled -> must fail closed to UNKNOWN with confidence < 0.6
  {
    id: 'HARD-TYPO-1',
    category: 'HARDWARE',
    title: 'scannr ofline hai rfid gat open nhi ho ra red bulb continuously stuck',
    description: 'turnstle ka wire switch operate nhi kr ra device hang.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: false,
    intentGroup: 'HARD_TYPO_BLIND',
  },
  {
    id: 'HARD-TYPO-2',
    category: 'BILLING_PAYOUTS',
    title: 'paymnt kat gya but boking pendng 9876543210 please check',
    description: 'studnt account se pesa cut gaya status boking pendng.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: false,
    intentGroup: 'HARD_TYPO_BLIND',
  },
  {
    id: 'HARD-TYPO-3',
    category: 'HARDWARE',
    title: 'turnstle machne atki hui h bachhe khade h entrance block',
    description: 'gat opn nhi hua biomtric red bulb glow kr ra h.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: false,
    intentGroup: 'HARD_TYPO_BLIND',
  },
  {
    id: 'HARD-TYPO-4',
    category: 'STUDENTS_BOOKINGS',
    title: 'studnt chekin nhi ho pa ra punching fail rfid card error',
    description: 'atendance sheet me punch in record ni dikh raha sesion stle.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: false,
    intentGroup: 'HARD_TYPO_BLIND',
  },
  {
    id: 'HARD-TYPO-5',
    category: 'BILLING_PAYOUTS',
    title: 'rezorpay se pasa cut gya bookng confirm nhi hui please dekho',
    description: 'upi paymnt debited but receipt pendng studnt waiting.',
    expectedProblemType: 'UNKNOWN',
    expectedConfidenceMax: 0.6,
    expectedMultiIntent: false,
    intentGroup: 'HARD_TYPO_BLIND',
  },
];

test('Ticket Bot Offline Replay Harness: 45 Synthetic Hinglish Tickets (Base 30 + 15 Harder Cases)', async () => {
  // Mock DB user lookup for student phones
  const originalUserFindMany = prisma.user.findMany;
  prisma.user.findMany = (async (args: any) => {
    // Return mock student for 10-digit Indian numbers
    const phoneFilter = args?.where?.OR?.find((c: any) => c.phone);
    if (phoneFilter?.phone) {
      return [{ id: 'mock_student_uuid', name: 'Test Student', phone: phoneFilter.phone }];
    }
    return [];
  }) as any;

  try {
    let passedCount = 0;
    const groupStats: Record<string, { total: number; passed: number; confidences: number[] }> = {};
    const allConfidences: number[] = [];

    console.log(`\n=================== REPLAY TEST RUN (45 CASES) ===================`);

    for (const testCase of SYNTHETIC_REPLAY_SET) {
      if (!groupStats[testCase.intentGroup]) {
        groupStats[testCase.intentGroup] = { total: 0, passed: 0, confidences: [] };
      }
      groupStats[testCase.intentGroup].total++;

      const result = await triageTicket({
        title: testCase.title,
        description: testCase.description,
        category: testCase.category,
        libraryId: 'lib_replay_test',
      });

      allConfidences.push(result.confidence);
      groupStats[testCase.intentGroup].confidences.push(result.confidence);

      let passed = true;
      let failureReason = '';

      if (testCase.expectedMultiIntent) {
        if (!result.isMultiIntent) {
          passed = false;
          failureReason = `Expected isMultiIntent=true, got false (detected: ${result.detectedCategories.join(', ')})`;
        }
      } else {
        if (result.isMultiIntent) {
          passed = false;
          failureReason = `Expected single intent, got isMultiIntent=true (detected: ${result.detectedCategories.join(', ')})`;
        }
      }

      if (passed && result.problemType !== testCase.expectedProblemType) {
        passed = false;
        failureReason = `Expected problemType=${testCase.expectedProblemType}, got ${result.problemType}`;
      }

      if (passed && testCase.expectedConfidenceMin !== undefined) {
        if (result.confidence < testCase.expectedConfidenceMin) {
          passed = false;
          failureReason = `Confidence ${result.confidence} < min ${testCase.expectedConfidenceMin}`;
        }
      }

      if (passed && testCase.expectedConfidenceMax !== undefined) {
        if (result.confidence >= testCase.expectedConfidenceMax) {
          passed = false;
          failureReason = `Confidence ${result.confidence} >= max ${testCase.expectedConfidenceMax}`;
        }
      }

      if (passed) {
        passedCount++;
        groupStats[testCase.intentGroup].passed++;
        console.log(`[PASS] [${testCase.id}] (${testCase.intentGroup}) -> Type: ${result.problemType}, Conf: ${result.confidence.toFixed(2)}, Multi: ${result.isMultiIntent}`);
      } else {
        console.error(`[FAIL] [${testCase.id}] (${testCase.intentGroup}) -> ${failureReason}`);
      }

      assert.equal(passed, true, `Test case ${testCase.id} failed: ${failureReason}`);
    }

    // Compute Confidence Spread Statistics
    const sortedConf = [...allConfidences].sort((a, b) => a - b);
    const minConf = sortedConf[0];
    const maxConf = sortedConf[sortedConf.length - 1];
    const sumConf = sortedConf.reduce((acc, c) => acc + c, 0);
    const meanConf = sumConf / sortedConf.length;
    const medianConf = sortedConf[Math.floor(sortedConf.length / 2)];
    const variance = sortedConf.reduce((acc, c) => acc + Math.pow(c - meanConf, 2), 0) / sortedConf.length;
    const stdDev = Math.sqrt(variance);

    const highConfCount = sortedConf.filter((c) => c >= 0.8).length;
    const medConfCount = sortedConf.filter((c) => c >= 0.6 && c < 0.8).length;
    const lowConfCount = sortedConf.filter((c) => c < 0.6).length;

    const accuracy = (passedCount / SYNTHETIC_REPLAY_SET.length) * 100;
    console.log(`\n=================== REPLAY ACCURACY & CONFIDENCE REPORT ===================`);
    console.log(`Total Tickets Tested : ${SYNTHETIC_REPLAY_SET.length}`);
    console.log(`Total Passes         : ${passedCount}`);
    console.log(`Overall Pass Rate    : ${accuracy.toFixed(1)}%\n`);

    console.log(`CONFIDENCE SPREAD (OVERALL):`);
    console.log(`  - Min Confidence   : ${minConf.toFixed(2)}`);
    console.log(`  - Max Confidence   : ${maxConf.toFixed(2)}`);
    console.log(`  - Mean Confidence  : ${meanConf.toFixed(2)}`);
    console.log(`  - Median Confidence: ${medianConf.toFixed(2)}`);
    console.log(`  - Std Deviation    : ${stdDev.toFixed(3)}\n`);

    console.log(`CONFIDENCE BUCKET DISTRIBUTION:`);
    console.log(`  - High  [0.80 - 1.00] : ${highConfCount} (${((highConfCount / sortedConf.length) * 100).toFixed(1)}%) -> Eligible for automated actions`);
    console.log(`  - Med   [0.60 - 0.79] : ${medConfCount} (${((medConfCount / sortedConf.length) * 100).toFixed(1)}%) -> Shadow candidate / Human review`);
    console.log(`  - Low   [0.00 - 0.59] : ${lowConfCount} (${((lowConfCount / sortedConf.length) * 100).toFixed(1)}%) -> Fails closed to human queue\n`);

    console.log(`GROUP BREAKDOWN:`);
    for (const [group, stats] of Object.entries(groupStats)) {
      const groupAccuracy = (stats.passed / stats.total) * 100;
      const gMin = Math.min(...stats.confidences);
      const gMax = Math.max(...stats.confidences);
      const gMean = stats.confidences.reduce((a, b) => a + b, 0) / stats.confidences.length;
      console.log(`  - ${group.padEnd(26)}: ${stats.passed}/${stats.total} (${groupAccuracy.toFixed(1)}%) | Conf: [min ${gMin.toFixed(2)}, max ${gMax.toFixed(2)}, mean ${gMean.toFixed(2)}]`);
    }
    console.log(`===========================================================================\n`);

    assert.equal(passedCount, 45);
  } finally {
    prisma.user.findMany = originalUserFindMany;
  }
});
