/**
 * HARDWARE API ACCEPTANCE TESTS
 * 
 * Instructions:
 * 1. Start your local dashboard dev server: `npm run dev`
 * 2. Ensure you have a valid HARDWARE_API_KEY set in your .env
 * 3. Run this script: `npx tsx tests/hardware-api-idempotency.test.ts`
 */

const API_URL = "http://localhost:3000/api/hardware/scan";
// Replace with the actual key from your .env
const API_KEY = process.env.RELAY_API_KEY || "esp32-focusx-setup"; 

// Replace with a valid test user and a valid door from your DB
const TEST_RFID = "YOUR_TEST_RFID_TAG"; 
const TEST_DOOR = "ESP32_MAIN_DOOR";

async function runTests() {
  console.log("=== RUNNING ZERO-DATA-LOSS ACCEPTANCE TESTS ===");

  const eventIdA = "evt_test_" + Date.now();
  
  const makeRequest = async (eventId: string, rfid: string = TEST_RFID, key: string = API_KEY) => {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        eventId,
        readerId: TEST_DOOR,
        scanType: "RFID",
        payload: rfid
      })
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  };

  // 1. INVALID API KEY
  console.log("\n[Test 1] Invalid API Key");
  const res1 = await makeRequest(eventIdA, TEST_RFID, "wrong-key");
  if (res1.status === 401) console.log("✅ Passed (401 Unauthorized)");
  else console.error("❌ Failed", res1);

  // 2. MALFORMED PAYLOAD
  console.log("\n[Test 2] Malformed Payload (Missing eventId)");
  const res2 = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
    body: JSON.stringify({ readerId: TEST_DOOR }) // Missing eventId
  });
  if (res2.status === 400) console.log("✅ Passed (400 Bad Request)");
  else console.error("❌ Failed", res2.status);

  // 3. NORMAL SCAN (Assuming student has active plan)
  console.log(`\n[Test 3] Normal Scan (Event ID: ${eventIdA})`);
  const res3 = await makeRequest(eventIdA);
  if (res3.data.status === "ALLOW" || res3.data.status === "DENY") {
    console.log(`✅ Passed (Business Result: ${res3.data.status} - ${res3.data.message})`);
  } else {
    console.error("❌ Failed", res3);
  }

  // 4. DUPLICATE EVENT ID / RESPONSE LOSS RETRY
  console.log("\n[Test 4] Timeout/Response Loss Retry (Same Event ID)");
  const res4 = await makeRequest(eventIdA);
  // It MUST return the exact same business result, ideally with RECOVERED message.
  if (res4.data.status === res3.data.status) {
    console.log(`✅ Passed (Idempotent Result: ${res4.data.status} - ${res4.data.message})`);
  } else {
    console.error("❌ Failed: Returned different business state!", res4);
  }

  // 5. CONCURRENT DUPLICATE REQUESTS (Race Condition)
  console.log("\n[Test 5] Concurrent Duplicate Requests");
  const eventIdB = "evt_test_race_" + Date.now();
  const reqA = makeRequest(eventIdB);
  const reqB = makeRequest(eventIdB);
  const reqC = makeRequest(eventIdB);
  
  const [resA, resB, resC] = await Promise.all([reqA, reqB, reqC]);
  console.log("Req A:", resA.data);
  console.log("Req B:", resB.data);
  console.log("Req C:", resC.data);
  
  const successes = [resA, resB, resC].filter(r => r.data.message === "PROCEED" || r.data.message === "ENTRY_GRANTED" || r.data.message === "EXIT_GRANTED");
  const recovered = [resA, resB, resC].filter(r => r.data.message === "RECOVERED");
  
  if (successes.length <= 1) {
    console.log(`✅ Passed (Only ${successes.length} original commit, ${recovered.length} gracefully recovered duplicates)`);
  } else {
    console.error("❌ Failed: Multiple concurrent inserts bypassed DB unique constraint!", successes);
  }

  console.log("\nTests finished. Please verify your DB manually to ensure only exactly 2 test check-in logs were created.");
}

runTests();
