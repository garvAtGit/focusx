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
  console.log("=== Running Backend Replay & Concurrency Tests ===");

  const library = await prisma.library.findFirst();
  if (!library) return console.log("No library.");
  
  const testMac = "test-mac-concurrent";
  const testRelay = await prisma.relay.create({
    data: {
      libraryId: library.id,
      macAddress: testMac,
      nfcTagId: "test-nfc-concurrent",
      status: "ONLINE",
    }
  });

  const eventIdDeny = "evt-concurrent-deny-" + Date.now();
  
  const payloadDeny = {
    eventId: eventIdDeny,
    readerId: testMac,
    scanType: "rfid",
    payload: "invalid_concurrent"
  };

  console.log("\\n--- Test C: Concurrent identical DENY requests ---");
  console.log("Submitting 3 identical requests concurrently...");
  
  // Note: Prisma transaction guarantees one will succeed and others will fail with P2002.
  // Next.js logic should catch P2002 and return DENY for the others.
  
  const reqs = await Promise.all([
    createMockRequest(payloadDeny),
    createMockRequest(payloadDeny),
    createMockRequest(payloadDeny)
  ]);
  
  const responses = await Promise.all(reqs.map(req => POST(req)));
  const jsons = await Promise.all(responses.map(res => res.json()));
  
  console.log("Responses:");
  jsons.forEach((j, i) => console.log(`  Req ${i}:`, j.status));

  const allDeny = jsons.every(j => j.status === "DENY");
  if (allDeny) {
    console.log("SUCCESS: All 3 concurrent requests returned DENY seamlessly.");
  } else {
    console.log("FAILED: Not all returned DENY.");
  }

  const logsCount = await prisma.entryLog.count({ where: { eventId: eventIdDeny } });
  console.log("Total EntryLogs in DB:", logsCount);
  if (logsCount === 1) {
    console.log("SUCCESS: Exactly one logical event recorded.");
  } else {
    console.log(`FAILED: Expected 1 EntryLog, got ${logsCount}`);
  }

  console.log("\\n--- Test E: Different eventIds independently ---");
  const evt1 = "evt-ind-1";
  const evt2 = "evt-ind-2";
  const reqInd1 = await createMockRequest({...payloadDeny, eventId: evt1});
  const reqInd2 = await createMockRequest({...payloadDeny, eventId: evt2});
  await Promise.all([POST(reqInd1), POST(reqInd2)]);
  
  const countInd = await prisma.entryLog.count({ where: { eventId: { in: [evt1, evt2] } } });
  if (countInd === 2) {
    console.log("SUCCESS: Different event IDs recorded independently.");
  } else {
    console.log("FAILED to record independent events.");
  }

  // Cleanup
  await prisma.entryLog.deleteMany({ where: { eventId: { in: [eventIdDeny, evt1, evt2] } } });
  await prisma.relay.delete({ where: { id: testRelay.id } });
  
  console.log("\\n=== Tests Completed ===");
}

runTests()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
