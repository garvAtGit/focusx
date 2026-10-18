import assert from "node:assert/strict"
import test from "node:test"
import { BookingIntentStatus } from "@prisma/client"

const testDatabaseUrl = process.env.TEST_DATABASE_URL

test(
  "booking authority is idempotent and leases a seat atomically",
  { skip: !testDatabaseUrl },
  async () => {
    process.env.DATABASE_URL = testDatabaseUrl
    process.env.DIRECT_URL = testDatabaseUrl

    const [{ default: prisma }, authority] = await Promise.all([
      import("../src/lib/prisma"),
      import("../src/lib/booking-authority"),
    ])
    const suffix = crypto.randomUUID().slice(0, 8)

    const librarian = await prisma.user.create({
      data: {
        name: `Test librarian ${suffix}`,
        role: "LIBRARIAN",
        email: `librarian-${suffix}@example.test`,
      },
    })
    const library = await prisma.library.create({
      data: {
        librarianId: librarian.id,
        name: `Authority test ${suffix}`,
        address: "Test address",
        photos: [],
        facilities: [],
      },
    })
    const [studentA, studentB, plan, flexiblePlan, seatA, seatB, seatC] =
      await Promise.all([
      prisma.user.create({
        data: {
          name: `Student A ${suffix}`,
          role: "STUDENT",
          email: `student-a-${suffix}@example.test`,
        },
      }),
      prisma.user.create({
        data: {
          name: `Student B ${suffix}`,
          role: "STUDENT",
          email: `student-b-${suffix}@example.test`,
        },
      }),
      prisma.plan.create({
        data: {
          libraryId: library.id,
          name: "Test monthly",
          type: "FIXED",
          validityDays: 30,
          price: 1_000,
        },
      }),
      prisma.plan.create({
        data: {
          libraryId: library.id,
          name: "Test flexible",
          type: "FLEXIBLE",
          validityDays: 30,
          price: 750,
        },
      }),
      prisma.seat.create({
        data: {
          libraryId: library.id,
          name: `A-${suffix}`,
          type: "NORMAL",
          gridX: 0,
          gridY: 0,
        },
      }),
      prisma.seat.create({
        data: {
          libraryId: library.id,
          name: `B-${suffix}`,
          type: "NORMAL",
          gridX: 1,
          gridY: 0,
        },
      }),
      prisma.seat.create({
        data: {
          libraryId: library.id,
          name: `C-${suffix}`,
          type: "NORMAL",
          gridX: 2,
          gridY: 0,
        },
      }),
    ])

    try {
      const idempotencyKey = crypto.randomUUID()
      const firstIntent = await authority.createOnlineBookingIntent({
        studentId: studentA.id,
        libraryId: library.id,
        planId: plan.id,
        seatId: seatA.id,
        idempotencyKey,
      })
      const retriedIntent = await authority.createOnlineBookingIntent({
        studentId: studentA.id,
        libraryId: library.id,
        planId: plan.id,
        seatId: seatA.id,
        idempotencyKey,
      })
      assert.equal(retriedIntent.id, firstIntent.id)

      await authority.attachPaymentLink(firstIntent.id, {
        providerLinkId: `plink_${suffix}`,
        providerShortUrl: `https://example.test/${suffix}`,
      })
      const confirmation = {
        referenceId: firstIntent.referenceId,
        providerLinkId: `plink_${suffix}`,
        paymentId: `pay_${suffix}`,
        paidAmountPaise: firstIntent.expectedAmountPaise,
        paidAt: new Date(),
        currency: "INR",
      }
      const firstConfirmation = await authority.confirmOnlinePayment(confirmation)
      const replayedConfirmation = await authority.confirmOnlinePayment(confirmation)
      assert.equal(firstConfirmation.status, "CONFIRMED")
      assert.equal(replayedConfirmation.status, "CONFIRMED")
      assert.equal(
        await prisma.booking.count({ where: { paymentRef: confirmation.paymentId } }),
        1,
      )
      const duplicatePaymentId = `pay_duplicate_${suffix}`
      const duplicatePayment = await authority.confirmOnlinePayment({
        ...confirmation,
        paymentId: duplicatePaymentId,
      })
      assert.equal(duplicatePayment.status, "REFUND_PENDING")
      const confirmedIntent = await prisma.bookingIntent.findUniqueOrThrow({
        where: { id: firstIntent.id },
      })
      assert.equal(confirmedIntent.status, BookingIntentStatus.CONFIRMED)
      assert.equal(confirmedIntent.providerPaymentId, confirmation.paymentId)
      assert.equal(
        await prisma.refundTask.count({
          where: { paymentId: duplicatePaymentId },
        }),
        1,
      )

      const concurrentIdempotencyKey = crypto.randomUUID()
      const concurrentRetries = await Promise.all([
        authority.createOnlineBookingIntent({
          studentId: studentA.id,
          libraryId: library.id,
          planId: plan.id,
          seatId: seatC.id,
          idempotencyKey: concurrentIdempotencyKey,
        }),
        authority.createOnlineBookingIntent({
          studentId: studentA.id,
          libraryId: library.id,
          planId: plan.id,
          seatId: seatC.id,
          idempotencyKey: concurrentIdempotencyKey,
        }),
      ])
      assert.equal(concurrentRetries[0].id, concurrentRetries[1].id)
      await authority.cancelBookingIntentByReference(
        concurrentRetries[0].referenceId,
        "TEST_CLEANUP",
        BookingIntentStatus.CANCELLED,
      )

      const competing = await Promise.allSettled([
        authority.createOnlineBookingIntent({
          studentId: studentA.id,
          libraryId: library.id,
          planId: plan.id,
          seatId: seatB.id,
        }),
        authority.createOnlineBookingIntent({
          studentId: studentB.id,
          libraryId: library.id,
          planId: plan.id,
          seatId: seatB.id,
        }),
      ])
      assert.equal(
        competing.filter(({ status }) => status === "fulfilled").length,
        1,
      )
      assert.equal(
        competing.filter(({ status }) => status === "rejected").length,
        1,
      )
      for (const result of competing) {
        if (result.status === "fulfilled") {
          await authority.cancelBookingIntentByReference(
            result.value.referenceId,
            "TEST_CLEANUP",
            BookingIntentStatus.CANCELLED,
          )
        }
      }

      const flexibleIntent = await authority.createOnlineBookingIntent({
        studentId: studentB.id,
        libraryId: library.id,
        planId: flexiblePlan.id,
      })
      await assert.rejects(
        authority.createOnlineBookingIntent({
          studentId: studentB.id,
          libraryId: library.id,
          planId: flexiblePlan.id,
          idempotencyKey: crypto.randomUUID(),
        }),
        (error: unknown) =>
          error instanceof authority.BookingAuthorityError
          && error.code === "BOOKING_IN_PROGRESS",
      )
      const claims = await Promise.all([
        authority.claimPaymentLinkCreation(flexibleIntent.id),
        authority.claimPaymentLinkCreation(flexibleIntent.id),
      ])
      assert.equal(claims.filter(Boolean).length, 1)

      await authority.cancelBookingIntentByReference(
        flexibleIntent.referenceId,
        "TEST_CANCELLED",
        BookingIntentStatus.CANCELLED,
      )
      const rejectedPaymentId = `pay_refund_${suffix}`
      const rejected = await authority.confirmOnlinePayment({
        referenceId: flexibleIntent.referenceId,
        providerLinkId: `plink_refund_${suffix}`,
        paymentId: rejectedPaymentId,
        paidAmountPaise: flexibleIntent.expectedAmountPaise,
        paidAt: new Date(),
        currency: "INR",
      })
      assert.equal(rejected.status, "REFUND_PENDING")
      assert.equal(
        await prisma.refundTask.count({ where: { paymentId: rejectedPaymentId } }),
        1,
      )
    } finally {
      await prisma.resourceLease.deleteMany({ where: { libraryId: library.id } })
      await prisma.refundTask.deleteMany({
        where: { intent: { libraryId: library.id } },
      })
      await prisma.booking.deleteMany({ where: { libraryId: library.id } })
      await prisma.bookingIntent.deleteMany({ where: { libraryId: library.id } })
      await prisma.seat.deleteMany({ where: { libraryId: library.id } })
      await prisma.plan.deleteMany({ where: { libraryId: library.id } })
      await prisma.library.delete({ where: { id: library.id } })
      await prisma.user.deleteMany({
        where: { id: { in: [studentA.id, studentB.id, librarian.id] } },
      })
      await prisma.$disconnect()
    }
  },
)
