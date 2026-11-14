import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { diagnosticSeverity, diagnosticStorageId, diagnosticWireId, diagnosticInteger, readDiagnosticBody } from "../src/lib/diagnostic-policy";
import { translateDiagnosticEvent, translateResetReasonCode } from "../src/lib/diagnostic-dictionary";
import { assembleCrashDump } from "../src/lib/hardware-crash-dump";

test("legacy INFO resets are escalated without demoting reported faults", () => {
  for (const reason of [4, 5, 6, 7]) assert.equal(diagnosticSeverity(1001, reason, "INFO"), "CRITICAL");
  assert.equal(diagnosticSeverity(1001, 9, "INFO"), "ERROR");
  assert.equal(diagnosticSeverity(1001, 1, "FATAL"), "FATAL");
  assert.equal(diagnosticSeverity(1001, 42, "INFO"), "WARN");
  assert.equal(translateResetReasonCode(3), "Software Reset");
  assert.match(translateResetReasonCode(5), /Interrupt/);
  assert.match(translateResetReasonCode(8), /Sleep/);
  assert.doesNotMatch(translateDiagnosticEvent(1001, "INFO", 4, 255000).explanation, /safely persisted/);
});

test("device scoping prevents cross-device collisions and round-trips ACK identities", () => {
  assert.notEqual(diagnosticStorageId("a", "d_1_1"), diagnosticStorageId("b", "d_1_1"));
  assert.equal(diagnosticWireId("a", diagnosticStorageId("a", "d_1_1")), "d_1_1");
  for (const value of [Infinity, NaN, 1.5, -1, "1", null, 2**54]) assert.equal(diagnosticInteger(value), null);
});

test("crash export detects missing, reordered, duplicated and corrupt chunks", () => {
  const payload = Buffer.from("a".repeat(96) + "b".repeat(12));
  const prefix = `cd_001122334455_${createHash("sha256").update(payload).digest("hex").slice(0, 32)}`;
  const first = { offset: 0, hex: payload.subarray(0, 96).toString("hex") };
  const second = { offset: 96, hex: payload.subarray(96).toString("hex") };
  assert.deepEqual(Buffer.from(assembleCrashDump(prefix, payload.length, [second, first, first])), payload);
  assert.throws(() => assembleCrashDump(prefix, payload.length, [first]), /Incomplete/);
  assert.throws(() => assembleCrashDump(prefix, payload.length, [first, { ...second, hex: "00".repeat(12) }]), /checksum/);
});

test("diagnostic payload bounds are enforced without trusting Content-Length", async () => {
  const request = new Request("http://localhost", { method: "POST", body: JSON.stringify({ deviceId: "a", events: [] }) });
  assert.deepEqual(await readDiagnosticBody(request), { deviceId: "a", events: [] });
  await assert.rejects(readDiagnosticBody(new Request("http://localhost", {
    method: "POST", headers: { "Content-Length": "1" }, body: "x".repeat(65537),
  })), RangeError);
});
