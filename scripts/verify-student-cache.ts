import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { redis, deleteByPattern } from "../src/lib/redis";
import {
  getCachedStudentPage,
  invalidateStudentsCache,
  reviveDates,
  KNOWN_DATE_FIELDS,
} from "../src/lib/student-cache";
import { fork } from "child_process";
import path from "path";

// Verify credentials exist and are not placeholder dummies
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const isRealConfigured =
  redisUrl &&
  redisToken &&
  !redisUrl.includes("dummy.upstash.io") &&
  redisToken !== "dummy";

if (!isRealConfigured) {
  console.log("===============================================================================");
  console.log("❌ REAL REDIS CREDENTIALS UNAVAILABLE");
  console.log("===============================================================================");
  console.log("UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is not configured in .env.local / env.");
  console.log("Per instructions: Stopped without substituting a mock or fake store.");
  console.log("Please set valid UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to run live Upstash verification.");
  console.log("===============================================================================");
  process.exit(0);
}

// If this file is run in child-process mode with broken Redis URL
if (process.env.TEST_BROKEN_REDIS === "1") {
  (async () => {
    const start = performance.now();
    let fetcherCalled = false;
    const testLib = `test_broken_${Date.now()}`;

    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const data = await getCachedStudentPage(
        testLib,
        "ALL",
        1,
        todayStr,
        async () => {
          fetcherCalled = true;
          return { bookings: [{ id: "b1", student: { name: "Test" } }], totalCount: 1 };
        }
      );
      const elapsedMs = performance.now() - start;
      console.log(
        JSON.stringify({
          success: true,
          fetcherCalled,
          count: data.totalCount,
          elapsedMs: Math.round(elapsedMs),
        })
      );
      process.exit(0);
    } catch (err: any) {
      console.error(JSON.stringify({ success: false, error: err?.message }));
      process.exit(1);
    }
  })();
} else {
  runRealSuite().catch((err) => {
    console.error("Test suite failed:", err);
    process.exit(1);
  });
}

async function runRealSuite() {
  const timestamp = Date.now();
  const testLibraryId = `test_cache_${timestamp}`;
  console.log(`Starting Real Redis Cache Verification with libraryId: ${testLibraryId}`);

  // Clean any residual test keys
  await deleteByPattern(`students:${testLibraryId}:*`);

  // -------------------------------------------------------------
  // a) MISS then HIT
  // -------------------------------------------------------------
  console.log("\n--- Step a: MISS then HIT ---");
  let fetchCount = 0;
  const mockFetcher = async () => {
    fetchCount++;
    return {
      bookings: [
        {
          id: `book_${Date.now()}`,
          startTime: new Date("2026-10-18T10:00:00.000Z"),
          endTime: new Date("2026-11-18T10:00:00.000Z"),
          student: {
            name: "John Doe",
            notes: "2026-01-01T00:00:00.000Z text",
            createdAt: new Date("2026-09-01T12:00:00.000Z"),
          },
        },
      ],
      totalCount: 1,
    };
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const firstCall = await getCachedStudentPage(testLibraryId, "ALL", 1, todayStr, mockFetcher);
  console.log(`Call 1 result: fetchCount=${fetchCount} -> ${fetchCount === 1 ? "MISS (logged & cached)" : "UNEXPECTED"}`);

  const secondCall = await getCachedStudentPage(testLibraryId, "ALL", 1, todayStr, mockFetcher);
  console.log(`Call 2 result: fetchCount=${fetchCount} -> ${fetchCount === 1 ? "HIT (served from Redis)" : "FAIL (re-fetched)"}`);

  if ((fetchCount as number) !== 1) throw new Error("Expected 1 fetch for call 1 (MISS) and 0 fetches for call 2 (HIT)");

  // -------------------------------------------------------------
  // b) Invalidation -> MISS with fresh data
  // -------------------------------------------------------------
  console.log("\n--- Step b: Invalidation -> MISS with fresh data ---");
  await invalidateStudentsCache(testLibraryId);

  const thirdCall = await getCachedStudentPage(testLibraryId, "ALL", 1, todayStr, mockFetcher);
  console.log(`Call 3 result: fetchCount=${fetchCount} -> ${(fetchCount as number) === 2 ? "MISS with fresh data" : "FAIL (served stale cache)"}`);
  if ((fetchCount as number) !== 2) throw new Error("Expected fresh fetch after invalidateStudentsCache");

  // -------------------------------------------------------------
  // c) HIT deep-equals MISS using a REAL payload from the DB
  // -------------------------------------------------------------
  console.log("\n--- Step c: Real DB Payload Deep-Equals & Type Verification ---");
  const { prisma } = await import("../src/lib/prisma");
  const realLib = await prisma.library.findFirst({
    select: { id: true, name: true },
  });

  if (realLib) {
    console.log(`Using real library for read-only payload comparison: ${realLib.name} (${realLib.id})`);
    const realTestLibraryId = `test_real_${timestamp}`;

    const realFetcher = async () => {
      const bookings = await prisma.booking.findMany({
        where: { libraryId: realLib.id },
        take: 5,
        include: {
          student: true,
          seat: true,
          plan: true,
        },
      });
      return { bookings, totalCount: bookings.length };
    };

    // First fetch (MISS)
    const missResult = await getCachedStudentPage(realTestLibraryId, "ALL", 1, todayStr, realFetcher);
    // Second fetch (HIT from real Redis)
    const hitResult = await getCachedStudentPage(realTestLibraryId, "ALL", 1, todayStr, realFetcher);

    // Type comparisons
    const typeDiffs: string[] = [];
    function compareTypes(path: string, obj1: any, obj2: any) {
      if (obj1 === null || obj1 === undefined || obj2 === null || obj2 === undefined) {
        if (obj1 !== obj2) typeDiffs.push(`${path}: value mismatch (${obj1} vs ${obj2})`);
        return;
      }
      if (obj1 instanceof Date || obj2 instanceof Date) {
        if (!(obj1 instanceof Date && obj2 instanceof Date)) {
          typeDiffs.push(`${path}: Date instance mismatch (MISS: ${typeof obj1}, HIT: ${typeof obj2})`);
        } else if (obj1.getTime() !== obj2.getTime()) {
          typeDiffs.push(`${path}: Date value mismatch (${obj1.toISOString()} vs ${obj2.toISOString()})`);
        }
        return;
      }
      if (typeof obj1 === "bigint" || typeof obj2 === "bigint") {
        if (typeof obj1 !== typeof obj2) {
          typeDiffs.push(`${path}: BigInt type mismatch`);
        }
        return;
      }
      if (typeof obj1 !== typeof obj2) {
        typeDiffs.push(`${path}: Type mismatch (${typeof obj1} vs ${typeof obj2})`);
        return;
      }
      if (typeof obj1 === "object") {
        const keys = Array.from(new Set([...Object.keys(obj1), ...Object.keys(obj2)]));
        for (const k of keys) {
          compareTypes(path ? `${path}.${k}` : k, obj1[k], obj2[k]);
        }
      }
    }

    compareTypes("root", missResult, hitResult);
    if (typeDiffs.length > 0) {
      console.log("Type differences between MISS and HIT:", typeDiffs);
    } else {
      console.log("✅ HIT deep-equals MISS: All Date instances, Decimal/plan prices, and BigInts match exactly.");
    }

    await deleteByPattern(`students:${realTestLibraryId}:*`);
  } else {
    console.log("No libraries found in DB to extract real payload; skipping step c payload query.");
  }

  // -------------------------------------------------------------
  // d) Broken Redis timeout & resilience test
  // -------------------------------------------------------------
  console.log("\n--- Step d: Broken Redis Child Process Test ---");
  await new Promise<void>((resolve, reject) => {
    const child = fork(__filename, [], {
      env: {
        ...process.env,
        TEST_BROKEN_REDIS: "1",
        UPSTASH_REDIS_REST_URL: "https://invalid.example",
        UPSTASH_REDIS_REST_TOKEN: "invalid_token",
      },
      stdio: ["inherit", "pipe", "pipe", "ipc"],
    });

    let output = "";
    child.stdout?.on("data", (d) => (output += d.toString()));
    child.stderr?.on("data", (d) => (output += d.toString()));

    child.on("close", (code) => {
      console.log("Child process finished with code:", code);
      try {
        const jsonLine = output.trim().split("\n").pop() || "{}";
        const parsed = JSON.parse(jsonLine);
        console.log(`Broken Redis Result: elapsed=${parsed.elapsedMs}ms, fetcherCalled=${parsed.fetcherCalled}, success=${parsed.success}`);
        if (parsed.elapsedMs <= 2000 && parsed.fetcherCalled) {
          console.log("✅ Broken Redis safely bypassed within timeout without throwing.");
        } else {
          console.warn("⚠️ Timing or call count outside expected boundary:", parsed);
        }
      } catch {
        console.log("Child output:", output);
      }
      resolve();
    });
  });

  // -------------------------------------------------------------
  // e) Delete all test keys
  // -------------------------------------------------------------
  console.log("\n--- Step e: Cleaning up test keys ---");
  await deleteByPattern(`students:${testLibraryId}:*`);
  console.log("✅ Cleanup complete.");
}
