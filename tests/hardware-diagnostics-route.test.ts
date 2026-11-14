import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { NextRequest } from "next/server";
import * as policy from "../src/lib/diagnostic-policy";

const require = createRequire(import.meta.url);
function harness(failCommit = false) {
  const rows: Record<string, unknown>[] = [];
  const prisma = {
    $transaction: async (run: (tx: unknown) => unknown) => {
      if (failCommit) throw new Error("database unavailable");
      return run({
        deviceDiagnosticLog: { createManyAndReturn: async ({ data }: { data: Record<string, unknown>[] }) => {
          const inserted = data.filter((entry) => !rows.some((r) => r.eventId === entry.eventId));
          rows.push(...inserted); return inserted;
        } },
        relay: { update: async () => ({}) },
      });
    },
  };
  const mocks: Record<string, unknown> = {
    "@/lib/prisma": { __esModule: true, default: prisma },
    "@/lib/relay-auth": { verifyRelayKey: (key: string) => key === "test-device-key" },
    "@/lib/hardware-resolver": { resolveRelay: async () => ({ id: "relay-a" }) },
    "@/lib/admin-auth-guard": { verifyAdminAuth: async () => ({ authorized: false }) },
    "@/lib/supabase-server": { supabaseServer: null },
    "@/lib/diagnostic-policy": policy,
  };
  const output = ts.transpileModule(readFileSync(new URL("../src/app/api/hardware/diagnostics/route.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports: { POST?: (req: NextRequest) => Promise<Response> } = {};
  vm.runInNewContext(output, { exports, require: (id: string) => mocks[id] ?? require(id), crypto: { randomUUID }, console: { error() {} } });
  const post = (body: unknown, key = "test-device-key") => exports.POST!(new NextRequest("http://localhost/api/hardware/diagnostics", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
  }));
  return { post, rows };
}
const event = { eventId: "boot_nonce_sequence", eventCode: 1001, severity: "INFO", param1: 4, param2: 255000, uptimeMs: 1000, timestamp: 0 };

test("ingestion escalates faults, stores scoped IDs, ACKs retries without duplicate rows", async () => {
  const { post, rows } = harness();
  for (let i = 0; i < 2; i++) {
    const response = await post({ deviceId: "device-a", events: [event] });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).ackEventIds, [event.eventId]);
  }
  assert.equal(rows.length, 1);
  assert.equal(rows[0].severity, "CRITICAL");
  assert.equal(rows[0].eventId, `relay-a:${event.eventId}`);
});

test("invalid numeric data is rejected without acknowledging it", async () => {
  const { post, rows } = harness();
  const response = await post({ deviceId: "device-a", events: [{ ...event, param2: "NaN" }] });
  const body = await response.json();
  assert.deepEqual(body.ackEventIds, []);
  assert.deepEqual(body.rejectedEventIds, [event.eventId]);
  assert.equal(rows.length, 0);
});

test("failed commit never returns a successful ACK; unauthorized clients cannot write", async () => {
  const { post } = harness(true);
  assert.equal((await post({ deviceId: "device-a", events: [event] })).status, 500);
  assert.equal((await post({ deviceId: "device-a", events: [event] }, "wrong")).status, 401);
});
