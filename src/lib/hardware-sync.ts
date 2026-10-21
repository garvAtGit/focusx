import prisma from "./prisma";
import { Prisma } from "@prisma/client";
import mqtt from "mqtt";

const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
let mqttClient: mqtt.MqttClient | null = null;

export function getMqttClient() {
  if (!mqttClient && typeof window === "undefined") {
    try {
       mqttClient = mqtt.connect(MQTT_URL, { 
         connectTimeout: 3000,
         reconnectPeriod: 10000 
       });
       mqttClient.on('error', (err) => console.error("[MQTT Error]:", err?.message || err));
    } catch (e) {
       console.error("[MQTT] Failed to connect to MQTT broker", e);
    }
  }
  return mqttClient;
}

export function closeMqttClient() {
  if (mqttClient) {
    try {
      mqttClient.end(true);
    } catch {}
    mqttClient = null;
  }
}

export function publishMqttMessage(topic: string, payload: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = getMqttClient();
    if (!client) {
      return reject(new Error("MQTT client unavailable"));
    }

    const message = typeof payload === "string" ? payload : JSON.stringify(payload);

    if (!client.connected) {
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error("MQTT broker connection timeout"));
        }
      }, 1500);

      client.once("connect", () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          client.publish(topic, message, { qos: 1, retain: true }, (err) => {
            if (err) reject(err);
            else resolve();
          });
        }
      });
      return;
    }

    client.publish(topic, message, { qos: 1, retain: true }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function incrementLibraryRevision(libraryId: string, tx?: Prisma.TransactionClient) {
  const db = tx || prisma;
  
  // 1. Atomically increment the revision in Postgres
  const updated = await db.library.update({
    where: { id: libraryId },
    data: {
      authRevision: { increment: 1 }
    },
    select: { authRevision: true }
  });

  // 2. Publish MQTT notification via Outbox (so it's transactionally safe!)
  await db.realtimeOutbox.create({
    data: {
      eventId: `sync-${libraryId}-${updated.authRevision}-${Date.now()}`,
      topic: `library/${libraryId}/auth/revision`,
      type: "MQTT_SYNC",
      payload: { revision: updated.authRevision },
      status: "PENDING"
    }
  });
  
  // 3. Opportunistically flush outbox if we are not in a transaction (otherwise worker handles it)
  if (!tx) {
    checkMqttOutbox().catch((err) => console.error("[checkMqttOutbox error]:", err));
  }
  
  return updated.authRevision;
}

export async function checkMqttOutbox() {
  const pending = await prisma.realtimeOutbox.findMany({
    where: { 
      isPublished: false,
      OR: [
        { type: "MQTT_SYNC" },
        { topic: { startsWith: "library/" } }
      ]
    },
    take: 50
  });
  
  if (pending.length === 0) return;
  
  for (const item of pending) {
    try {
      if (item.topic) {
        await publishMqttMessage(item.topic, item.payload);
        await prisma.realtimeOutbox.update({
          where: { id: item.id },
          data: { 
            status: "PUBLISHED", 
            isPublished: true, 
            lockedAt: null, 
            lockedBy: null,
            lastError: null 
          }
        });
      }
    } catch (e: any) {
      console.error(`[checkMqttOutbox] Failed to publish ${item.id}:`, e?.message || e);
    }
  }
}
