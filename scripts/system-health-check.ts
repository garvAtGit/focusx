import prisma from "../src/lib/prisma";
import { evaluateHardwarePresence } from "../src/lib/hardware-presence";

async function main() {
  console.log("=========================================");
  console.log("   FOCUSX SYSTEM & HARDWARE HEALTH AUDIT ");
  console.log("   Timestamp:", new Date().toISOString());
  console.log("=========================================\n");

  const now = Date.now();

  // 1. Hardware & Relay Status
  console.log("--- [1] ESP32 Machines & Turnstiles ---");
  const relays = await prisma.relay.findMany({
    include: { library: { select: { name: true } } },
    orderBy: { lastSeenAt: "desc" },
  });

  if (relays.length === 0) {
    console.log("No machines configured in database.");
  } else {
    for (const r of relays) {
      const presence = evaluateHardwarePresence(r.lastSeenAt);
      const lastSeenSec = r.lastSeenAt ? Math.round((now - new Date(r.lastSeenAt).getTime()) / 1000) : "Never";
      console.log(`• Device MAC [${r.macAddress || r.id}] (Library: ${r.library?.name || "Unassigned"})`);
      console.log(`  Presence: ${presence.status} (${presence.label}) | Last Seen: ${lastSeenSec}s ago`);
      console.log(`  Firmware: ${r.firmwareVersion || "Unknown"} | Reset Reason: ${r.resetReason || "Normal"}`);
      console.log(`  Virtual LCD: Line0="${r.lastScreenLine0 || ""}" | Line1="${r.lastScreenLine1 || ""}"`);
      console.log(`  Screen Updated: ${r.lastScreenUpdatedAt ? r.lastScreenUpdatedAt.toISOString() : "Never"}`);
    }
  }

  // 2. Virtual LCD Screen Transitions
  console.log("\n--- [2] Recent Virtual LCD Screen Transitions ---");
  const screenHistory = await prisma.deviceScreenHistory.findMany({
    take: 10,
    orderBy: { timestamp: "desc" },
    include: { relay: { select: { macAddress: true } } },
  });
  if (screenHistory.length === 0) {
    console.log("No recent screen history transitions.");
  } else {
    for (const s of screenHistory) {
      console.log(`• [${s.timestamp.toISOString()}] Device: ${s.relay?.macAddress || s.relayId}`);
      console.log(`  L0: "${s.line0}" | L1: "${s.line1}" (Backlight: ${s.backlight})`);
    }
  }

  // 3. Machine Diagnostic Logs & Errors
  console.log("\n--- [3] Hardware Diagnostic Logs & Errors ---");
  const diagLogs = await prisma.deviceDiagnosticLog.findMany({
    orderBy: { timestamp: "desc" },
    take: 10,
    include: { relay: { select: { macAddress: true } } },
  });

  console.log(`Recent Machine Diagnostic Events: ${diagLogs.length}`);
  for (const d of diagLogs) {
    console.log(`  • [${d.severity}] Event #${d.eventCode} on ${d.relay?.macAddress || d.relayId} at ${d.timestamp.toISOString()}: ${d.detail || 'None'}`);
  }

  // 4. Activity Logs (Audit Trail)
  console.log("\n--- [4] Recent Staff Activity Logs (Audit Consistency) ---");
  const activityLogs = await prisma.libraryActivityLog.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
  });
  for (const a of activityLogs) {
    console.log(`• [${a.createdAt.toISOString()}] ${a.actorName} (${a.actorRole}): ${a.description}`);
  }

  // 5. System Health Endpoint Check
  console.log("\n--- [5] Production Monitoring Endpoint Check ---");
  try {
    const res = await fetch("https://www.focusx.in/api/monitoring/health");
    console.log(`Production /api/monitoring/health response: HTTP ${res.status}`);
    const data = await res.json().catch(() => null);
    if (data) {
      console.log("Health Payload:", JSON.stringify(data));
    }
  } catch (err) {
    console.log("Could not reach /api/monitoring/health directly:", (err as Error).message);
  }

  // 6. Automated Self-Healing & Runbook Engine
  const isHealMode = process.argv.includes("--heal");
  console.log("\n--- [6] Automated Self-Healing & Runbook Engine ---");
  if (!isHealMode) {
    console.log("Self-healing is in DRY-RUN mode. Pass --heal to automatically apply safe remedies.");
  } else {
    let remediesApplied = 0;

    // Remediation 1: Reclaim expired temporary resource leases
    const expiredLeases = await prisma.resourceLease.deleteMany({
      where: { expiresAt: { lt: new Date() } }
    });
    if (expiredLeases.count > 0) {
      console.log(`🧹 [Auto-Heal] Cleaned up ${expiredLeases.count} expired temporary leases.`);
      remediesApplied++;
    }

    // Remediation 2: Self-heal stale screen displays & sync degraded devices with circuit breaker
    for (const r of relays) {
      const presence = evaluateHardwarePresence(r.lastSeenAt);

      // Reset stale alarm screens (>30 mins old)
      const lastScreenAge = r.lastScreenUpdatedAt ? (now - new Date(r.lastScreenUpdatedAt).getTime()) : 0;
      const isAlarmScreen = (r.lastScreenLine0 || "").includes("SECURITY") || (r.lastScreenLine0 || "").includes("BREACH");
      if (isAlarmScreen && lastScreenAge > 30 * 60 * 1000) {
        console.log(`🔧 [Auto-Heal] Resetting stale alarm screen on device ${r.macAddress || r.id}`);
        await prisma.relay.update({
          where: { id: r.id },
          data: {
            lastScreenLine0: "SYSTEM ARMED    ",
            lastScreenLine1: "TAP YOUR CARD   ",
            lastScreenUpdatedAt: new Date(),
          }
        });
        remediesApplied++;
      }

      // If degraded and has no pending command, queue a non-destructive SYNC_SNAPSHOT
      if (presence.status === "DEGRADED" && !r.pendingCommand) {
        console.log(`🔄 [Auto-Heal] Queueing SYNC_SNAPSHOT for degraded device ${r.macAddress || r.id}`);
        const structuredCommand = JSON.stringify({
          cmdId: `cmd_heal_${now}`,
          action: "SYNC_SNAPSHOT",
          status: "QUEUED",
          createdAt: now,
          expiresAt: now + 3600 * 1000,
        });
        await prisma.relay.update({
          where: { id: r.id },
          data: { pendingCommand: structuredCommand }
        });
        remediesApplied++;
      }
    }

    console.log(`Auto-Healing Complete: ${remediesApplied} safe remedies executed.`);
  }

  console.log("\n=========================================");
  console.log("         HEALTH AUDIT COMPLETED          ");
  console.log("=========================================");
}

main().catch(console.error).finally(() => prisma.$disconnect());
