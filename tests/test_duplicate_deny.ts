process.env.RELAY_API_KEY = "test_key";

import { POST } from "../src/app/api/hardware/scan/route";
import { NextRequest } from "next/server";
import prisma from "../src/lib/prisma";

async function createMockRequest(payload: any, token: string = "test_key") {
  return new NextRequest("http://localhost/api/hardware/scan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
}

async function runTests() {
  console.log("=== Running Backend Idempotency Tests ===");

  const library = await prisma.library.findFirst();
  if (!library) {
    console.log("No library found in DB. Test aborted.");
    return;
  }
  
  const testMac = "test-mac-" + Date.now();
  const testRelay = await prisma.relay.create({
    data: {
      libraryId: library.id,
      macAddress: testMac,
      nfcTagId: "test-nfc-" + Date.now(),
      status: "ONLINE",
    }
  });

  const eventIdDeny = "evt-deny-" + Date.now();
  
  console.log("\\n--- Test B: DENY duplicate ---");
  const payloadDeny = {
    eventId: eventIdDeny,
    readerId: testMac,
    scanType: "rfid",
    payload: "invalid_rfid_12345"
  };

  console.log("Sending Request 1 (Expect DENY)...");
  const req1 = await createMockRequest(payloadDeny);
  const res1 = await POST(req1);
  const json1 = await res1.json();
  console.log("Result 1:", json1);
  
  const entryLog1 = await prisma.entryLog.findUnique({ where: { eventId: eventIdDeny } });
  console.log("EntryLog created:", !!entryLog1);

  console.log("\\nSending Request 2 with identical eventId (Expect ALREADY_PROCESSED_DENIED -> DENY)...");
  const req2 = await createMockRequest(payloadDeny);
  const res2 = await POST(req2);
  const json2 = await res2.json();
  console.log("Result 2:", json2);

  if (json1.status === "DENY" && json2.status === "DENY") {
    console.log("SUCCESS: Duplicate DENY semantic preserved.");
  } else {
    console.log("FAILED: Duplicate DENY returned unexpected status.");
  }
  
  const logsCount = await prisma.entryLog.count({ where: { eventId: eventIdDeny } });
  console.log("Total EntryLogs for eventId:", logsCount);
  if (logsCount === 1) {
    console.log("SUCCESS: Exactly one logical event recorded.");
  } else {
    console.log("FAILED: Duplicate EntryLog detected!");
  }

  await prisma.entryLog.deleteMany({ where: { eventId: eventIdDeny } });
  await prisma.relay.delete({ where: { id: testRelay.id } });
  
  console.log("\\n=== Tests Completed ===");
}

runTests()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
