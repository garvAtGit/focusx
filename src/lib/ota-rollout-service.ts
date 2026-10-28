import fs from "fs";
import path from "path";
import crypto from "crypto";
import prisma from "@/lib/prisma";

const RELEASE_DIR = path.join(process.cwd(), "firmware_releases");
const MANIFEST_PATH = path.join(RELEASE_DIR, "manifest.json");

export interface FirmwareRelease {
  version: string;
  name: string;
  sha256: string;
  size: number;
  buildDate: string;
  capabilities: string[];
  filename: string;
  isLatest: boolean;
  downloadUrl?: string;
}

export interface RolloutDeviceAssignment {
  relayId: string;
  batchIndex: number;
}

export type BatchStrategy = "ALL_AT_ONCE" | "CANARY_FIRST" | "STAGED" | "CUSTOM";

/**
 * 1. Release Management
 * Lists available firmware releases from manifest.json and the filesystem.
 */
export function getAvailableReleases(baseUrl?: string): FirmwareRelease[] {
  const releases: FirmwareRelease[] = [];
  let manifest: any = null;

  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
    } catch (e) {
      console.error("[OTA Rollout] Failed to parse manifest.json:", e);
    }
  }

  // Primary release from manifest
  if (manifest && manifest.version && manifest.binary) {
    const rawVersion = manifest.version.replace(/^v/, "");
    const vVersion = `v${rawVersion}`;
    const filename = manifest.binary.filename || "FocusX_Scanner_Firmware_V5_DualRFID.ino.bin";

    releases.push({
      version: rawVersion,
      name: manifest.name || `FocusX Firmware ${rawVersion}`,
      sha256: manifest.binary.sha256,
      size: manifest.binary.size,
      buildDate: manifest.buildDate || new Date().toISOString(),
      capabilities: manifest.capabilities || [],
      filename,
      isLatest: true,
      downloadUrl: baseUrl ? `${baseUrl}/api/hardware/ota?download=1` : undefined,
    });
  }

  // Inspect release directories (e.g. v5.1.0-ota, v5.1.1-ota) for historical releases
  if (fs.existsSync(RELEASE_DIR)) {
    const entries = fs.readdirSync(RELEASE_DIR, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.isDirectory()) {
        const dirVer = ent.name.replace(/^v/, "");
        if (releases.some((r) => r.version === dirVer)) continue;

        const binFiles = fs.readdirSync(path.join(RELEASE_DIR, ent.name)).filter((f) => f.endsWith(".bin"));
        if (binFiles.length > 0) {
          const binPath = path.join(RELEASE_DIR, ent.name, binFiles[0]);
          const stat = fs.statSync(binPath);
          const buf = fs.readFileSync(binPath);
          const hash = crypto.createHash("sha256").update(buf).digest("hex");

          releases.push({
            version: dirVer,
            name: `FocusX Firmware ${dirVer}`,
            sha256: hash,
            size: stat.size,
            buildDate: stat.mtime.toISOString(),
            capabilities: ["dual-pn532", "wifi", "ota-rollback"],
            filename: binFiles[0],
            isLatest: false,
            downloadUrl: baseUrl ? `${baseUrl}/api/hardware/ota?download=1&version=${dirVer}` : undefined,
          });
        }
      }
    }
  }

  return releases;
}

/**
 * 2. Device Fleet Inventory
 * Shows each relay's hardware ID, firmware version, online status, last heartbeat, library, and active OTA state.
 */
export async function getFleetInventory() {
  const relays = await prisma.relay.findMany({
    include: {
      library: {
        select: { id: true, name: true },
      },
      deviceRollouts: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        include: {
          rollout: {
            select: { id: true, name: true, targetVersion: true, status: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = Date.now();
  const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  return relays.map((relay) => {
    const lastSeenTime = relay.lastSeenAt ? new Date(relay.lastSeenAt).getTime() : 0;
    const isStale = !relay.lastSeenAt || now - lastSeenTime > STALE_THRESHOLD_MS;
    const isOnline = relay.status === "ONLINE" && !isStale;

    let pendingCommandParsed: any = null;
    if (relay.pendingCommand) {
      try {
        pendingCommandParsed = JSON.parse(relay.pendingCommand);
      } catch {
        pendingCommandParsed = { action: relay.pendingCommand, status: "LEGACY" };
      }
    }

    const latestRollout = relay.deviceRollouts[0] || null;

    return {
      id: relay.id,
      macAddress: relay.macAddress,
      bleReaderId: relay.bleReaderId,
      nfcTagId: relay.nfcTagId,
      firmwareVersion: relay.firmwareVersion || "unknown",
      status: relay.status,
      isOnline,
      isStale,
      lastSeenAt: relay.lastSeenAt,
      lastSync: relay.lastSync,
      libraryId: relay.libraryId,
      libraryName: relay.library.name,
      pendingCommand: pendingCommandParsed,
      currentOtaState: latestRollout ? latestRollout.status : (pendingCommandParsed?.action === "OTA" ? pendingCommandParsed.status : "IDLE"),
      latestRollout: latestRollout
        ? {
            rolloutId: latestRollout.rolloutId,
            rolloutName: latestRollout.rollout.name,
            targetVersion: latestRollout.targetVersion,
            status: latestRollout.status,
            attempts: latestRollout.attempts,
            lastError: latestRollout.lastError,
            updatedAt: latestRollout.updatedAt,
          }
        : null,
    };
  });
}

/**
 * 3. Rollout Creation & Staged Batches
 * Transactionally creates a rollout and assigns devices into staged batches.
 */
export async function createFleetRollout(params: {
  name: string;
  targetVersion: string;
  deviceIds?: string[];
  libraryId?: string;
  onlyOutdated?: boolean;
  batchStrategy?: BatchStrategy;
  customBatches?: { batchIndex: number; relayId: string }[];
  createdById?: string;
  autoDispatchFirstBatch?: boolean;
  baseUrl?: string;
}) {
  const {
    name,
    targetVersion,
    deviceIds,
    libraryId,
    onlyOutdated = false,
    batchStrategy = "CANARY_FIRST",
    customBatches,
    createdById,
    autoDispatchFirstBatch = true,
    baseUrl = "https://www.focusx.in",
  } = params;

  // Validate release existence
  const releases = getAvailableReleases();
  const cleanTarget = targetVersion.replace(/^v/, "");
  const targetRelease = releases.find((r) => r.version.replace(/^v/, "") === cleanTarget);

  if (!targetRelease) {
    throw new Error(`Firmware release '${targetVersion}' was not found in available releases.`);
  }

  // Resolve target devices
  const whereClause: any = {};
  if (deviceIds && deviceIds.length > 0) {
    whereClause.id = { in: deviceIds };
  }
  if (libraryId) {
    whereClause.libraryId = libraryId;
  }
  if (onlyOutdated) {
    whereClause.OR = [
      { firmwareVersion: null },
      { firmwareVersion: { not: targetRelease.version } },
    ];
  }

  const eligibleRelays = await prisma.relay.findMany({
    where: whereClause,
    orderBy: { createdAt: "asc" },
  });

  if (eligibleRelays.length === 0) {
    throw new Error("No eligible devices found matching the specified rollout criteria.");
  }

  // Calculate batch assignments
  let assignments: RolloutDeviceAssignment[] = [];
  let totalBatches = 1;

  if (customBatches && customBatches.length > 0) {
    assignments = customBatches.map((cb) => ({
      relayId: cb.relayId,
      batchIndex: Math.max(1, cb.batchIndex),
    }));
    totalBatches = Math.max(...assignments.map((a) => a.batchIndex));
  } else if (batchStrategy === "ALL_AT_ONCE" || eligibleRelays.length === 1) {
    totalBatches = 1;
    assignments = eligibleRelays.map((r) => ({ relayId: r.id, batchIndex: 1 }));
  } else if (batchStrategy === "CANARY_FIRST") {
    totalBatches = 2;
    // Batch 1: First single device (canary / pilot)
    assignments.push({ relayId: eligibleRelays[0].id, batchIndex: 1 });
    // Batch 2: All remaining devices
    for (let i = 1; i < eligibleRelays.length; i++) {
      assignments.push({ relayId: eligibleRelays[i].id, batchIndex: 2 });
    }
  } else if (batchStrategy === "STAGED") {
    // 3 Batches: 1 canary / 10%, 40%, 50%
    totalBatches = Math.min(3, eligibleRelays.length);
    const count = eligibleRelays.length;
    const b1Count = Math.max(1, Math.floor(count * 0.1));
    const b2Count = Math.max(1, Math.floor(count * 0.4));

    eligibleRelays.forEach((r, idx) => {
      let bIndex = 1;
      if (idx < b1Count) bIndex = 1;
      else if (idx < b1Count + b2Count) bIndex = 2;
      else bIndex = 3;
      assignments.push({ relayId: r.id, batchIndex: bIndex });
    });
    totalBatches = Math.max(...assignments.map((a) => a.batchIndex));
  }

  // Create rollout and device rollouts transactionally
  const rollout = await prisma.$transaction(async (tx) => {
    const ro = await tx.otaRollout.create({
      data: {
        name,
        targetVersion: targetRelease.version,
        targetSha256: targetRelease.sha256,
        targetSize: targetRelease.size,
        status: "ACTIVE",
        totalBatches,
        currentBatch: 1,
        batchConfig: JSON.stringify({ batchStrategy, totalDevices: assignments.length }),
        createdById: createdById || null,
      },
    });

    for (const item of assignments) {
      const relay = eligibleRelays.find((r) => r.id === item.relayId);
      await tx.otaDeviceRollout.create({
        data: {
          rolloutId: ro.id,
          relayId: item.relayId,
          batchIndex: item.batchIndex,
          status: "NOT_STARTED",
          initialVersion: relay?.firmwareVersion || null,
          targetVersion: targetRelease.version,
          attempts: 0,
        },
      });
    }

    return ro;
  });

  // If autoDispatchFirstBatch is true, dispatch Batch 1 immediately
  if (autoDispatchFirstBatch) {
    await dispatchBatchInternal(rollout.id, 1, baseUrl);
  }

  return getRolloutDetails(rollout.id);
}

/**
 * Dispatches commands to devices belonging to a specific batch.
 */
async function dispatchBatchInternal(rolloutId: string, batchIndex: number, baseUrl: string) {
  const rollout = await prisma.otaRollout.findUnique({
    where: { id: rolloutId },
  });
  if (!rollout) return;

  const deviceRollouts = await prisma.otaDeviceRollout.findMany({
    where: { rolloutId, batchIndex },
    include: { relay: true },
  });

  const downloadUrl = `${baseUrl}/api/hardware/ota?download=1`;

  for (const dr of deviceRollouts) {
    const relay = dr.relay;

    // Check if device is already on the target version
    if (relay.firmwareVersion === rollout.targetVersion) {
      await prisma.otaDeviceRollout.update({
        where: { id: dr.id },
        data: {
          status: "SUCCEEDED",
          completedAt: new Date(),
          lastError: null,
        },
      });
      continue;
    }

    // Safety: check if relay already has an active conflicting command
    if (relay.pendingCommand) {
      try {
        const existing = JSON.parse(relay.pendingCommand);
        const activeStates = ["QUEUED", "DOWNLOADING", "INSTALLING", "REBOOTING", "VALIDATING", "EXECUTING"];
        if (existing.action === "OTA" && activeStates.includes(existing.status)) {
          // Device is already executing an update; link this rollout to the active command if matching
          if (existing.args?.targetVersion === rollout.targetVersion) {
            await prisma.otaDeviceRollout.update({
              where: { id: dr.id },
              data: {
                cmdId: existing.cmdId,
                status: existing.status === "QUEUED" ? "QUEUED" : "DOWNLOADING",
                dispatchedAt: new Date(),
                attempts: Math.max(1, dr.attempts),
              },
            });
            continue;
          } else {
            // Conflicting update for a different version; keep queued without overwriting
            continue;
          }
        }
      } catch {
        // Non-JSON pending command; proceed safely with overwrite
      }
    }

    // Construct unique durable command
    const now = Date.now();
    const cmdId = `cmd_ota_${now}_${crypto.randomBytes(3).toString("hex")}`;
    const expiresAt = now + 24 * 60 * 60 * 1000;

    const structuredCommand = JSON.stringify({
      cmdId,
      action: "OTA",
      status: "QUEUED",
      args: {
        url: downloadUrl,
        sha256: rollout.targetSha256,
        size: rollout.targetSize,
        targetVersion: rollout.targetVersion,
      },
      createdAt: now,
      expiresAt,
    });

    // Update relay pendingCommand and device rollout status transactionally
    await prisma.$transaction([
      prisma.relay.update({
        where: { id: relay.id },
        data: { pendingCommand: structuredCommand },
      }),
      prisma.otaDeviceRollout.update({
        where: { id: dr.id },
        data: {
          cmdId,
          status: "QUEUED",
          attempts: dr.attempts + 1,
          dispatchedAt: new Date(),
          lastError: null,
        },
      }),
    ]);
  }
}

/**
 * 4. Staged Rollout Advance
 * Explicit administrator action to advance to the next batch.
 */
export async function advanceRolloutBatch(rolloutId: string, baseUrl: string = "https://www.focusx.in") {
  const rollout = await prisma.otaRollout.findUnique({
    where: { id: rolloutId },
  });

  if (!rollout) {
    throw new Error("Rollout not found.");
  }
  if (rollout.status !== "ACTIVE") {
    throw new Error(`Cannot advance rollout: status is '${rollout.status}'.`);
  }
  if (rollout.currentBatch >= rollout.totalBatches) {
    throw new Error(`Rollout is already at final batch (${rollout.currentBatch} of ${rollout.totalBatches}).`);
  }

  const nextBatch = rollout.currentBatch + 1;

  await prisma.otaRollout.update({
    where: { id: rolloutId },
    data: { currentBatch: nextBatch },
  });

  await dispatchBatchInternal(rolloutId, nextBatch, baseUrl);

  return getRolloutDetails(rolloutId);
}

/**
 * 5. Failure Handling & Deliberate Retry
 * Retries a specific failed or expired device within a rollout.
 * Checks that no conflicting command is pending.
 */
export async function retryDeviceRollout(deviceRolloutId: string, baseUrl: string = "https://www.focusx.in") {
  const dr = await prisma.otaDeviceRollout.findUnique({
    where: { id: deviceRolloutId },
    include: { relay: true, rollout: true },
  });

  if (!dr) {
    throw new Error("Device rollout record not found.");
  }

  const terminalFailStates = ["FAILED", "EXPIRED", "NOT_STARTED", "CANCELLED"];
  if (!terminalFailStates.includes(dr.status)) {
    throw new Error(`Device is currently in state '${dr.status}' and cannot be retried.`);
  }

  const relay = dr.relay;
  // Conflict guard: Do not overwrite if a conflicting command is already actively executing
  if (relay.pendingCommand) {
    let parsed: any = null;
    try {
      parsed = JSON.parse(relay.pendingCommand);
    } catch {
      // Non-JSON pending command; proceed
    }
    const activeStates = ["DOWNLOADING", "INSTALLING", "REBOOTING", "VALIDATING", "EXECUTING"];
    if (parsed && activeStates.includes(parsed.status)) {
      throw new Error(`Cannot retry: device ${relay.id} is actively executing command '${parsed.cmdId}' (${parsed.status}).`);
    }
  }

  const now = Date.now();
  const cmdId = `cmd_ota_${now}_${crypto.randomBytes(3).toString("hex")}`;
  const expiresAt = now + 24 * 60 * 60 * 1000;
  const downloadUrl = `${baseUrl}/api/hardware/ota?download=1`;

  const structuredCommand = JSON.stringify({
    cmdId,
    action: "OTA",
    status: "QUEUED",
    args: {
      url: downloadUrl,
      sha256: dr.rollout.targetSha256,
      size: dr.rollout.targetSize,
      targetVersion: dr.rollout.targetVersion,
    },
    createdAt: now,
    expiresAt,
  });

  await prisma.$transaction([
    prisma.relay.update({
      where: { id: relay.id },
      data: { pendingCommand: structuredCommand },
    }),
    prisma.otaDeviceRollout.update({
      where: { id: dr.id },
      data: {
        cmdId,
        status: "QUEUED",
        attempts: dr.attempts + 1,
        dispatchedAt: new Date(),
        lastError: null,
      },
    }),
  ]);

  return prisma.otaDeviceRollout.findUnique({ where: { id: dr.id } });
}

/**
 * Retries all failed devices in an active rollout up to the current batch.
 */
export async function retryRolloutFailed(rolloutId: string, baseUrl: string = "https://www.focusx.in") {
  const rollout = await prisma.otaRollout.findUnique({
    where: { id: rolloutId },
  });
  if (!rollout) throw new Error("Rollout not found.");

  const failedDevices = await prisma.otaDeviceRollout.findMany({
    where: {
      rolloutId,
      status: { in: ["FAILED", "EXPIRED"] },
      batchIndex: { lte: rollout.currentBatch },
    },
  });

  let retriedCount = 0;
  const errors: string[] = [];

  for (const dr of failedDevices) {
    try {
      await retryDeviceRollout(dr.id, baseUrl);
      retriedCount++;
    } catch (e: any) {
      errors.push(`Device ${dr.relayId}: ${e.message}`);
    }
  }

  return { retriedCount, totalFailed: failedDevices.length, errors };
}

/**
 * 6. Cancel Rollout
 */
export async function cancelRollout(rolloutId: string) {
  const rollout = await prisma.otaRollout.findUnique({
    where: { id: rolloutId },
    include: { deviceRollouts: { include: { relay: true } } },
  });
  if (!rollout) throw new Error("Rollout not found.");

  await prisma.$transaction(async (tx) => {
    await tx.otaRollout.update({
      where: { id: rolloutId },
      data: { status: "CANCELLED" },
    });

    for (const dr of rollout.deviceRollouts) {
      if (["NOT_STARTED", "QUEUED"].includes(dr.status)) {
        await tx.otaDeviceRollout.update({
          where: { id: dr.id },
          data: { status: "CANCELLED" },
        });

        // Clear queued pendingCommand on relay if it matches this command
        if (dr.cmdId && dr.relay.pendingCommand?.includes(dr.cmdId)) {
          await tx.relay.update({
            where: { id: dr.relayId },
            data: { pendingCommand: null },
          });
        }
      }
    }
  });

  return getRolloutDetails(rolloutId);
}

/**
 * 7. Device Acknowledgement & Lifecycle Update
 * Integrates directly with heartbeat route to keep rollout device statuses synchronized.
 */
export async function handleDeviceOtaAck(params: {
  relayId: string;
  ackCommandId?: string | null;
  ackStatus?: string | null;
  ackError?: string | null;
  runningPartition?: string | null;
  firmwareVersion?: string | null;
}) {
  const { relayId, ackCommandId, ackStatus, ackError, firmwareVersion } = params;

  // Find all active device rollout records matching cmdId or relayId
  let drList: any[] = [];
  if (ackCommandId) {
    drList = await prisma.otaDeviceRollout.findMany({
      where: { cmdId: ackCommandId },
      include: { rollout: true },
    });
  }

  if (drList.length === 0) {
    drList = await prisma.otaDeviceRollout.findMany({
      where: {
        relayId,
        status: { in: ["QUEUED", "DISPATCHED", "DOWNLOADING", "INSTALLING", "REBOOTING", "VALIDATING", "EXECUTING"] },
      },
      orderBy: { updatedAt: "desc" },
      include: { rollout: true },
    });
  }

  if (drList.length === 0) return null;

  const normalizedAck = String(ackStatus || "").toUpperCase();
  let firstUpdated = null;

  for (const dr of drList) {
    const targetVer = dr.targetVersion.replace(/^v/, "");
    const currentFwVer = String(firmwareVersion || "").replace(/^v/, "");
    const isVersionMatched = currentFwVer === targetVer;

    let newStatus = dr.status;
    let isTerminal = false;

    if (normalizedAck === "SUCCESS" || isVersionMatched) {
      newStatus = "SUCCEEDED";
      isTerminal = true;
    } else if (normalizedAck === "FAILED") {
      newStatus = "FAILED";
      isTerminal = true;
    } else if (["DOWNLOADING", "INSTALLING", "REBOOTING", "VALIDATING", "EXECUTING"].includes(normalizedAck)) {
      newStatus = normalizedAck;
    } else if (dr.status === "QUEUED") {
      newStatus = "DISPATCHED";
    }

    const updatedDr = await prisma.otaDeviceRollout.update({
      where: { id: dr.id },
      data: {
        status: newStatus,
        completedAt: isTerminal ? new Date() : dr.completedAt,
        lastError: normalizedAck === "FAILED" ? (ackError || "Execution failure reported") : dr.lastError,
      },
    });

    if (!firstUpdated) firstUpdated = updatedDr;

    // Check if all devices in rollout are completed
    const remainingActive = await prisma.otaDeviceRollout.count({
      where: {
        rolloutId: dr.rolloutId,
        status: { notIn: ["SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"] },
      },
    });

    if (remainingActive === 0) {
      await prisma.otaRollout.update({
        where: { id: dr.rolloutId },
        data: { status: "COMPLETED" },
      });
    }
  }

  return firstUpdated;
}

/**
 * 8. Rollout Dashboard Details & Counters
 */
export async function getRolloutDetails(rolloutId: string) {
  const rollout = await prisma.otaRollout.findUnique({
    where: { id: rolloutId },
    include: {
      deviceRollouts: {
        include: {
          relay: {
            include: {
              library: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ batchIndex: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!rollout) return null;

  const devices = rollout.deviceRollouts;
  const targetCount = devices.length;
  const notStartedCount = devices.filter((d) => d.status === "NOT_STARTED").length;
  const queuedCount = devices.filter((d) => d.status === "QUEUED" || d.status === "DISPATCHED").length;
  const inProgressCount = devices.filter((d) =>
    ["DOWNLOADING", "INSTALLING", "REBOOTING", "VALIDATING", "EXECUTING"].includes(d.status)
  ).length;
  const succeededCount = devices.filter((d) => d.status === "SUCCEEDED").length;
  const failedCount = devices.filter((d) => d.status === "FAILED").length;
  const expiredCount = devices.filter((d) => d.status === "EXPIRED").length;
  const cancelledCount = devices.filter((d) => d.status === "CANCELLED").length;

  const now = Date.now();
  const STALE_THRESHOLD_MS = 5 * 60 * 1000;

  const enrichedDevices = devices.map((d) => {
    const relay = d.relay;
    const lastSeenTime = relay.lastSeenAt ? new Date(relay.lastSeenAt).getTime() : 0;
    const isStale = !relay.lastSeenAt || now - lastSeenTime > STALE_THRESHOLD_MS;
    const isOnline = relay.status === "ONLINE" && !isStale;

    let hasActivePendingCommand = false;
    if (relay.pendingCommand) {
      try {
        const parsed = JSON.parse(relay.pendingCommand);
        hasActivePendingCommand = ["DOWNLOADING", "INSTALLING", "REBOOTING", "VALIDATING", "EXECUTING"].includes(parsed.status);
      } catch {
        hasActivePendingCommand = false;
      }
    }

    const isEligibleForRetry =
      ["FAILED", "EXPIRED", "NOT_STARTED"].includes(d.status) && !hasActivePendingCommand;

    return {
      id: d.id,
      relayId: d.relayId,
      macAddress: relay.macAddress,
      bleReaderId: relay.bleReaderId,
      nfcTagId: relay.nfcTagId,
      libraryId: relay.libraryId,
      libraryName: relay.library.name,
      batchIndex: d.batchIndex,
      status: d.status,
      initialVersion: d.initialVersion,
      targetVersion: d.targetVersion,
      currentVersion: relay.firmwareVersion,
      cmdId: d.cmdId,
      attempts: d.attempts,
      lastError: d.lastError,
      dispatchedAt: d.dispatchedAt,
      completedAt: d.completedAt,
      updatedAt: d.updatedAt,
      isOnline,
      isStale,
      isEligibleForRetry,
    };
  });

  return {
    id: rollout.id,
    name: rollout.name,
    targetVersion: rollout.targetVersion,
    targetSha256: rollout.targetSha256,
    targetSize: rollout.targetSize,
    status: rollout.status,
    totalBatches: rollout.totalBatches,
    currentBatch: rollout.currentBatch,
    createdAt: rollout.createdAt,
    updatedAt: rollout.updatedAt,
    targetCount,
    notStartedCount,
    queuedCount,
    inProgressCount,
    succeededCount,
    failedCount,
    expiredCount,
    cancelledCount,
    devices: enrichedDevices,
  };
}

/**
 * Lists all rollouts with aggregated counts for fleet summary.
 */
export async function listRollouts() {
  const rollouts = await prisma.otaRollout.findMany({
    include: {
      deviceRollouts: {
        select: { status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return rollouts.map((ro) => {
    const devices = ro.deviceRollouts;
    const targetCount = devices.length;
    const succeededCount = devices.filter((d) => d.status === "SUCCEEDED").length;
    const failedCount = devices.filter((d) => d.status === "FAILED").length;
    const inProgressCount = devices.filter((d) =>
      ["QUEUED", "DISPATCHED", "DOWNLOADING", "INSTALLING", "REBOOTING", "VALIDATING", "EXECUTING"].includes(d.status)
    ).length;

    return {
      id: ro.id,
      name: ro.name,
      targetVersion: ro.targetVersion,
      status: ro.status,
      totalBatches: ro.totalBatches,
      currentBatch: ro.currentBatch,
      createdAt: ro.createdAt,
      updatedAt: ro.updatedAt,
      targetCount,
      succeededCount,
      failedCount,
      inProgressCount,
      progressPercent: targetCount > 0 ? Math.round((succeededCount / targetCount) * 100) : 0,
    };
  });
}
