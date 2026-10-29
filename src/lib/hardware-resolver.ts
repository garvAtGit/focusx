import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type RelayWithLibrary = Prisma.RelayGetPayload<{ include: { library: true } }>;
export type RelayBasic = Prisma.RelayGetPayload<{}>;

/**
 * Robust Hardware Relay Resolver
 * Resolves incoming device IDs, MAC addresses, BLE reader IDs, NFC tags, or claim codes
 * to the authoritative Relay record and associated Library.
 */
export async function resolveRelay(
  rawIdentifier: string | null | undefined,
  options: { includeLibrary: true }
): Promise<RelayWithLibrary | null>;

export async function resolveRelay(
  rawIdentifier: string | null | undefined,
  options?: { includeLibrary?: false }
): Promise<RelayBasic | null>;

export async function resolveRelay(
  rawIdentifier: string | null | undefined,
  options?: { includeLibrary?: boolean }
): Promise<any | null> {
  if (!rawIdentifier || typeof rawIdentifier !== "string") {
    return null;
  }

  const id = rawIdentifier.trim();
  if (!id) return null;

  const includeClause = options?.includeLibrary ? { library: true } : undefined;

  // 1. Direct match on Relay table
  let relay = await prisma.relay.findFirst({
    where: {
      OR: [
        { id },
        { bleReaderId: id },
        { macAddress: id },
        { nfcTagId: id }
      ]
    },
    include: includeClause
  });

  if (relay) return relay;

  // 2. MAC address formatting variations (with or without colons/dashes)
  const hexOnly = id.replace(/[:-]/g, "").toUpperCase();
  if (hexOnly.length === 12) {
    const withColons = hexOnly.match(/.{1,2}/g)?.join(":") || "";
    relay = await prisma.relay.findFirst({
      where: {
        OR: [
          { bleReaderId: withColons },
          { macAddress: withColons },
          { bleReaderId: hexOnly },
          { macAddress: hexOnly }
        ]
      },
      include: includeClause
    });
    if (relay) return relay;
  }

  // 3. Fallback: Check HardwareClaim table
  const claim = await prisma.hardwareClaim.findFirst({
    where: {
      OR: [
        { claimCode: id.toUpperCase() },
        { macAddress: id },
        { bleReaderId: id }
      ]
    }
  });

  if (claim && claim.libraryId) {
    // Check if there is a relay in that library with matching hardware attributes
    relay = await prisma.relay.findFirst({
      where: {
        libraryId: claim.libraryId,
        OR: [
          { macAddress: claim.macAddress },
          { bleReaderId: claim.bleReaderId },
          { id: claim.id }
        ]
      },
      include: includeClause
    });
    if (relay) return relay;

    // Secondary fallback: return any active relay belonging to the claimed library
    relay = await prisma.relay.findFirst({
      where: { libraryId: claim.libraryId },
      include: includeClause
    });
    if (relay) return relay;
  }

  // 4. Fallback for known legacy device mappings for Kripa Library
  const kripaKnownIds = [
    "38:3E:51:6F:ED:FC",
    "383E516FEDFC",
    "3A:41:5B:A7:B2:9F",
    "3A415BA7B29F",
    "ESP32-1789655554228",
    "A7B29F",
    "6FEDFC"
  ];

  if (kripaKnownIds.some(k => k.toLowerCase() === id.toLowerCase())) {
    relay = await prisma.relay.findUnique({
      where: { id: "b018a625-0a12-44a0-98b1-745a99a3d0d8" },
      include: includeClause
    });
    if (relay) return relay;
  }

  return null;
}
