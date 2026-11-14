import "dotenv/config";
import prisma from "../src/lib/prisma";
import { resolveRelay } from "../src/lib/hardware-resolver";

const SHANTI_LIB_ID = "92e8ce56-d9b9-40d7-b9bc-c1a8017f2b12";
const KRIPA_LIB_ID = "f6cd1770-e936-4457-b2ef-bf17bce9f730";
const OPERATIONAL_RELAY_ID = "90c825cd-920c-477f-8dbc-cf59b823f3b7";
const OLD_KRIPA_RELAY_ID = "b018a625-0a12-44a0-98b1-745a99a3d0d8";
const OPERATIONAL_DEVICE_ID = "87b99b2c-90fd-11e9-bc42-526af7764f64:1:1";

async function main() {
  console.log("=== STARTING REASSIGNMENT OF OPERATIONAL MACHINE TO KRIPA LIBRARY ===");

  const kripaLib = await prisma.library.findUnique({
    where: { id: KRIPA_LIB_ID },
    select: { id: true, name: true, authRevision: true }
  });
  const shantiLib = await prisma.library.findUnique({
    where: { id: SHANTI_LIB_ID },
    select: { id: true, name: true, authRevision: true }
  });

  if (!kripaLib || !shantiLib) {
    throw new Error("One or both libraries not found!");
  }

  console.log(`Found target Kripa Library: ${kripaLib.name} (Rev: ${kripaLib.authRevision})`);
  console.log(`Found source Shanti Library: ${shantiLib.name} (Rev: ${shantiLib.authRevision})`);

  const now = Date.now();
  const syncCommand = JSON.stringify({
    cmdId: `cmd_sync_${now}`,
    action: "SYNC",
    status: "QUEUED",
    createdAt: now
  });

  const result = await prisma.$transaction(async (tx) => {
    // 1. Move operational relay to Kripa Library
    const updatedOperationalRelay = await tx.relay.update({
      where: { id: OPERATIONAL_RELAY_ID },
      data: {
        libraryId: KRIPA_LIB_ID,
        currentAuthRevision: 0, // Reset so machine immediately downloads full Kripa snapshot
        pendingCommand: syncCommand,
        status: "ONLINE"
      }
    });

    // 2. Mark old inactive Kripa relay as OFFLINE
    const updatedOldKripaRelay = await tx.relay.update({
      where: { id: OLD_KRIPA_RELAY_ID },
      data: {
        status: "OFFLINE"
      }
    });

    // 3. Update HardwareClaims to ensure hardware claims point to Kripa Library
    await tx.hardwareClaim.updateMany({
      where: {
        OR: [
          { macAddress: OPERATIONAL_DEVICE_ID },
          { bleReaderId: OPERATIONAL_DEVICE_ID }
        ]
      },
      data: {
        libraryId: KRIPA_LIB_ID,
        isClaimed: true
      }
    });

    // 4. Increment auth revision for Kripa Library & enqueue sync outbox
    const updatedKripa = await tx.library.update({
      where: { id: KRIPA_LIB_ID },
      data: { authRevision: { increment: 1 } },
      select: { id: true, name: true, authRevision: true }
    });

    await tx.realtimeOutbox.create({
      data: {
        eventId: `sync-${KRIPA_LIB_ID}-${updatedKripa.authRevision}-${now}`,
        topic: `library/${KRIPA_LIB_ID}/auth/revision`,
        type: "MQTT_SYNC",
        payload: { revision: updatedKripa.authRevision },
        status: "PENDING"
      }
    });

    // 5. Increment auth revision for Shanti Library & enqueue sync outbox
    const updatedShanti = await tx.library.update({
      where: { id: SHANTI_LIB_ID },
      data: { authRevision: { increment: 1 } },
      select: { id: true, name: true, authRevision: true }
    });

    await tx.realtimeOutbox.create({
      data: {
        eventId: `sync-${SHANTI_LIB_ID}-${updatedShanti.authRevision}-${now}`,
        topic: `library/${SHANTI_LIB_ID}/auth/revision`,
        type: "MQTT_SYNC",
        payload: { revision: updatedShanti.authRevision },
        status: "PENDING"
      }
    });

    return {
      operationalRelay: updatedOperationalRelay,
      oldKripaRelay: updatedOldKripaRelay,
      kripaRevision: updatedKripa.authRevision,
      shantiRevision: updatedShanti.authRevision
    };
  });

  console.log("=== TRANSACTION COMMITTED SUCCESSFULLY ===");
  console.log(`Operational Relay ID: ${result.operationalRelay.id}`);
  console.log(`New Library ID: ${result.operationalRelay.libraryId} (Kripa Library)`);
  console.log(`Kripa new authRevision: ${result.kripaRevision}`);
  console.log(`Shanti new authRevision: ${result.shantiRevision}`);

  // Verification step: Test resolveRelay
  const resolved = await resolveRelay(OPERATIONAL_DEVICE_ID, { includeLibrary: true });
  console.log("\n=== VERIFICATION ===");
  console.log("Device ID:", OPERATIONAL_DEVICE_ID);
  console.log("Resolved to Relay ID:", resolved?.id);
  console.log("Resolved to Library:", resolved?.library?.name, `(${resolved?.library?.id})`);

  if (resolved?.library?.id === KRIPA_LIB_ID) {
    console.log("SUCCESS: Machine is now connected to Kripa Library!");
  } else {
    console.error("FAILURE: Machine failed to resolve to Kripa Library!");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Migration error:", e);
  process.exit(1);
});
